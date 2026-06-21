import {
  getPlatformAiReadonlyResponse,
  type PlatformAiReadonlyResponse,
} from '@/modules/open-platform/server/platformAiReadonlyApiContract';

export type OpenPlatformAiReadonlyView = PlatformAiReadonlyResponse & {
  scopeLabel: string;
};

export function loadOpenPlatformAiReadonlyView(params: { month?: string | null; usageDate?: string | null } = {}): OpenPlatformAiReadonlyView {
  const response = getPlatformAiReadonlyResponse(params);

  return {
    ...response,
    scopeLabel: '平台端 AI 模型与用量低敏只读基础',
  };
}

export function getOpenPlatformAiReadonlyErrorMessage(_error: unknown) {
  return 'AI 模型与用量只读数据暂时无法加载';
}
