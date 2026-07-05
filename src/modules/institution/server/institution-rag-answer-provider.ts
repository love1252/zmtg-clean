import { decryptSecret, type EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';

export type AiChatMessageRole = 'system' | 'user' | 'assistant';

export type AiChatMessage = {
  role: AiChatMessageRole;
  content: string;
};

export type AiChatProviderInput = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type AiChatProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type AiChatProviderResult = {
  status: 'success' | 'provider_disabled' | 'provider_unavailable' | 'service_unavailable';
  answerText?: string;
  usage?: AiChatProviderUsage;
  latencyMs?: number;
  errorCode?: string;
};

export interface AiChatProvider {
  chat(input: AiChatProviderInput): Promise<AiChatProviderResult>;
}

export type InstitutionDryRunAiChatProviderOptions = {
  answerText?: string;
  status?: AiChatProviderResult['status'];
  errorCode?: string;
  latencyMs?: number;
};

export type InstitutionOpenAiCompatibleChatProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type InstitutionOpenAiCompatibleChatProviderOptions = {
  config: InstitutionOpenAiCompatibleChatProviderConfig;
  fetchImpl?: typeof fetch;
};

export type InstitutionRagAnswerProviderConfigRepository = {
  findVendorConfig(vendor: string): Promise<{
    baseUrl: string;
    model: string;
    encryptedApiKey: EncryptedSecretEnvelope;
    configured: boolean;
  } | null>;
};

export type InstitutionRagAnswerResolvedProvider = {
  status: 'ready';
  provider: AiChatProvider;
  providerId: string;
  model: string;
};

export type InstitutionRagAnswerProviderDisabled = {
  status: 'provider_disabled';
  providerStatus: 'missing_config' | 'disabled' | 'invalid_secret';
};

export type InstitutionRagAnswerProviderResolution =
  | InstitutionRagAnswerResolvedProvider
  | InstitutionRagAnswerProviderDisabled;

export type InstitutionRagAnswerProviderResolver = {
  resolve(): Promise<InstitutionRagAnswerProviderResolution>;
};

type OpenAiCompatibleChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function extractQuestion(messages: AiChatMessage[]) {
  const userMessage = [...messages].reverse().find((message) => message.role === 'user');
  const content = userMessage?.content ?? '';
  const match = content.match(/问题：([\s\S]*?)(?:\n\n|$)/);
  return (match?.[1] ?? content).trim();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function estimateTokens(text: string) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function createInstitutionDryRunAiChatProvider(
  options: InstitutionDryRunAiChatProviderOptions = {},
): AiChatProvider {
  return {
    async chat(input) {
      const startedAt = Date.now();
      if (options.status && options.status !== 'success') {
        return {
          status: options.status,
          latencyMs: options.latencyMs ?? Math.max(1, Date.now() - startedAt),
          errorCode: options.errorCode ?? 'dry_run_provider_unavailable',
        };
      }

      const question = extractQuestion(input.messages);
      const answerText = options.answerText ?? [
        '当前基于机构知识库召回片段生成受控问答草稿。',
        question ? `问题要点：${question}` : '问题要点：已收到机构端问题。',
        '请结合下方引用来源逐条核对，不要将本草稿作为确定性医疗建议。',
      ].join('\n');

      return {
        status: 'success',
        answerText,
        usage: {
          inputTokens: input.messages.reduce((sum, message) => sum + estimateTokens(message.content), 0),
          outputTokens: estimateTokens(answerText),
        },
        latencyMs: options.latencyMs ?? Math.max(1, Date.now() - startedAt),
      };
    },
  };
}

export function createInstitutionOpenAiCompatibleChatProvider(
  options: InstitutionOpenAiCompatibleChatProviderOptions,
): AiChatProvider {
  return {
    async chat(input) {
      const fetchImpl = options.fetchImpl ?? fetch;
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = input.timeoutMs
        ? setTimeout(() => controller.abort(), input.timeoutMs)
        : null;

      try {
        const response = await fetchImpl(`${normalizeBaseUrl(options.config.baseUrl)}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${options.config.apiKey}`,
          },
          body: JSON.stringify({
            model: options.config.model,
            messages: input.messages,
            max_tokens: input.maxTokens ?? 800,
            temperature: input.temperature ?? 0,
          }),
          signal: controller.signal,
        });
        const latencyMs = Math.max(1, Date.now() - startedAt);

        if (!response.ok) {
          return {
            status: 'provider_unavailable',
            latencyMs,
            errorCode: response.status === 429 ? 'rate_limited' : 'http_error',
          };
        }

        const body = await response.json().catch(() => null) as OpenAiCompatibleChatCompletionResponse | null;
        const answerText = body?.choices?.[0]?.message?.content?.trim();
        if (!answerText) {
          return {
            status: 'service_unavailable',
            latencyMs,
            errorCode: 'malformed_response',
          };
        }

        const usage = body?.usage;
        const fallbackInputTokens = input.messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
        const fallbackOutputTokens = estimateTokens(answerText);

        return {
          status: 'success',
          answerText,
          usage: {
            inputTokens: usage?.prompt_tokens ?? usage?.total_tokens ?? fallbackInputTokens,
            outputTokens: usage?.completion_tokens ?? fallbackOutputTokens,
          },
          latencyMs,
        };
      } catch (error) {
        return {
          status: 'service_unavailable',
          latencyMs: Math.max(1, Date.now() - startedAt),
          errorCode: isAbortError(error) ? 'timeout' : 'network_error',
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

export function createInstitutionRagAnswerProviderResolver(input: {
  repository: InstitutionRagAnswerProviderConfigRepository;
  vendor: string;
  fetchImpl?: typeof fetch;
}): InstitutionRagAnswerProviderResolver {
  return {
    async resolve() {
      const config = await input.repository.findVendorConfig(input.vendor);
      if (!config) {
        return { status: 'provider_disabled', providerStatus: 'missing_config' };
      }
      if (!config.configured) {
        return { status: 'provider_disabled', providerStatus: 'disabled' };
      }

      let apiKey: string;
      try {
        apiKey = decryptSecret(config.encryptedApiKey);
      } catch {
        return { status: 'provider_disabled', providerStatus: 'invalid_secret' };
      }

      return {
        status: 'ready',
        providerId: input.vendor,
        model: config.model,
        provider: createInstitutionOpenAiCompatibleChatProvider({
          config: {
            baseUrl: config.baseUrl,
            model: config.model,
            apiKey,
          },
          fetchImpl: input.fetchImpl,
        }),
      };
    },
  };
}
