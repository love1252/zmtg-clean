export type HisConnectionCredentialSuccessDto = {
  ok: true;
  credentialConfigured: boolean;
};

export type HisConnectionCredentialErrorCode =
  | 'validation_failed'
  | 'not_found'
  | 'invalid_state_transition'
  | 'service_unavailable';

export type HisConnectionCredentialErrorDto = {
  ok: false;
  code: HisConnectionCredentialErrorCode;
  error: string;
};

const credentialErrorMessages: Record<HisConnectionCredentialErrorCode, string> = {
  validation_failed: '请求参数无效',
  not_found: '连接不存在或无权限',
  invalid_state_transition: '当前连接状态不允许该操作',
  service_unavailable: '服务暂不可用',
};

export function mapHisConnectionCredentialSuccessToDto(input: {
  credentialConfigured: boolean;
}): HisConnectionCredentialSuccessDto {
  return {
    ok: true,
    credentialConfigured: input.credentialConfigured,
  };
}

export function mapHisConnectionCredentialErrorToDto(
  code: HisConnectionCredentialErrorCode,
): HisConnectionCredentialErrorDto {
  return {
    ok: false,
    code,
    error: credentialErrorMessages[code],
  };
}
