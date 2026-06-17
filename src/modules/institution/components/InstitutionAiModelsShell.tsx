'use client';

import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Clock3 } from 'lucide-react';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { cn } from '@/shared/utils/cn';

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  doubao: '豆包 (Volcengine)',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  chatglm: '智谱 GLM',
  kimi: 'Kimi',
};

type VendorModelView = {
  vendor: string;
  displayName: string;
  provider: string;
  baseUrl: string;
  model: string;
  configured: boolean;
  lastCheckStatus: string;
  lastCheckedAt: string | null;
};

type PanelState =
  | { status: 'loading' }
  | { status: 'success'; models: VendorModelView[] }
  | { status: 'error'; title: string; description: string };

const forbiddenFragments = [
  'apiKey',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'iv',
];

function expectLowSensitivePayload(data: unknown) {
  const serialized = JSON.stringify(data);
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseVendorModel(value: unknown): VendorModelView | null {
  if (!isRecord(value)) return null;
  if (typeof value.vendor !== 'string' || !value.vendor.trim()) return null;

  return {
    vendor: value.vendor as string,
    displayName: typeof value.displayName === 'string' ? value.displayName : value.vendor as string,
    provider: typeof value.provider === 'string' ? value.provider : 'unknown',
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : '',
    model: typeof value.model === 'string' ? value.model : '',
    configured: value.configured === true,
    lastCheckStatus: typeof value.lastCheckStatus === 'string' ? value.lastCheckStatus : 'not_checked',
    lastCheckedAt: typeof value.lastCheckedAt === 'string' ? value.lastCheckedAt : null,
  };
}

function parseModelList(payload: unknown): VendorModelView[] {
  if (!isRecord(payload) || !Array.isArray(payload.models)) return [];
  return payload.models
    .map(parseVendorModel)
    .filter((m): m is VendorModelView => m !== null);
}

function formatLastChecked(value: string | null) {
  if (!value) return '未检查';
  try {
    return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return value;
  }
}

async function loadAiModels(): Promise<PanelState> {
  try {
    const response = await fetch('/api/v1/institution/ai-models', { cache: 'no-store' });

    if (response.status === 401) {
      return { status: 'error', title: '登录状态已失效，请重新登录', description: '' };
    }
    if (response.status === 403) {
      return { status: 'error', title: '当前账号没有查看 AI 模型的权限', description: '' };
    }

    if (!response.ok) {
      return { status: 'error', title: 'AI 模型数据暂时不可用', description: '' };
    }

    const payload: unknown = await response.json();

    if (!expectLowSensitivePayload(payload)) {
      return { status: 'error', title: 'AI 模型数据包含异常字段', description: '服务端返回了不应暴露的敏感内容' };
    }

    const models = parseModelList(payload);
    return { status: 'success', models };
  } catch {
    return { status: 'error', title: '加载 AI 模型数据失败', description: '请稍后重试' };
  }
}

export function InstitutionAiModelsShell() {
  const [panelState, setPanelState] = useState<PanelState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    loadAiModels().then((state) => {
      if (isMounted) setPanelState(state);
    });
    return () => { isMounted = false; };
  }, []);

  if (panelState.status === 'loading') {
    return <InstitutionPageState kind="loading" title="加载 AI 模型列表..." />;
  }

  if (panelState.status === 'error') {
    return (
      <InstitutionPageState
        kind="error"
        title={panelState.title}
        description={panelState.description}
      />
    );
  }

  const configuredCount = panelState.models.filter((m) => m.configured).length;

  return (
    <section aria-labelledby="institution-ai-models-heading" className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Brain className="h-4 w-4" />
              平台已启用
            </div>
            <h2 id="institution-ai-models-heading" className="mt-3 text-xl font-semibold tracking-normal text-slate-900">
              AI 模型
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              平台端已配置的 AI 模型列表，仅展示低敏状态信息，不暴露厂商 Key 及加密凭据。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              共 {panelState.models.length} 家厂商，{configuredCount} 家已配置
            </p>
          </div>
          <span className={cn(
            'inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold',
            configuredCount > 0
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}>
            {configuredCount > 0 ? '部分可用' : '暂无可用模型'}
          </span>
        </div>
      </div>

      {panelState.models.length === 0 ? (
        <InstitutionPageState
          kind="empty"
          title="当前没有可用的 AI 模型"
          description="请联系平台管理员在管理后台配置厂商 Key 后再查看"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {panelState.models.map((model) => (
            <article
              key={model.vendor}
              className={cn(
                'rounded-[20px] border p-4 shadow-sm transition',
                model.configured
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-slate-200 bg-slate-50/60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {VENDOR_DISPLAY_NAMES[model.vendor] ?? model.displayName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{model.vendor}</p>
                </div>
                <span className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                  model.configured
                    ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                    : 'border border-slate-200 bg-slate-100 text-slate-500',
                )}>
                  {model.configured ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      已配置
                    </>
                  ) : (
                    <>
                      <Clock3 className="h-3 w-3" />
                      未配置
                    </>
                  )}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>模型</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[180px]">{model.model}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>状态</span>
                  <span className="font-semibold text-slate-700">{model.lastCheckStatus}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>最后检查</span>
                  <span className="font-semibold text-slate-700 text-right">{formatLastChecked(model.lastCheckedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
