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
  status: 'success' | 'provider_unavailable' | 'service_unavailable';
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

function extractQuestion(messages: AiChatMessage[]) {
  const userMessage = [...messages].reverse().find((message) => message.role === 'user');
  const content = userMessage?.content ?? '';
  const match = content.match(/问题：([\s\S]*?)(?:\n\n|$)/);
  return (match?.[1] ?? content).trim();
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
          inputTokens: input.messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4), 0),
          outputTokens: Math.ceil(answerText.length / 4),
        },
        latencyMs: options.latencyMs ?? Math.max(1, Date.now() - startedAt),
      };
    },
  };
}
