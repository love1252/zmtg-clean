export const weComCustomerContactReadonlyProofEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET',
  'ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID',
  'ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED',
  'ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED',
  'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY',
  'ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED',
  'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  'ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED',
  'ZMTG_WECOM_REAL_SEND_ENABLED',
] as const;

export const requiredWeComCustomerContactReadonlyProofEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET',
  'ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID',
] as const;

export const weComCustomerContactReadonlyProofStatuses = [
  'readonly_proof_not_requested',
  'blocked_missing_config',
  'blocked_static_precheck_not_ready',
  'blocked_real_network_disabled',
  'blocked_customer_read_disabled',
  'blocked_real_send_must_remain_disabled',
  'blocked_missing_confirmation',
  'blocked_no_external_contact',
  'blocked_external_contact_scope_not_single',
  'readonly_proof_completed',
  'readonly_proof_auth_failed',
  'readonly_proof_permission_failed',
  'readonly_proof_network_error',
  'readonly_proof_failed',
] as const;

export const weComCustomerContactReadonlyProofAction = 'read_single_external_contact_once';
export const weComCustomerContactReadonlyProofConfirmation =
  'CONFIRM_READ_SINGLE_EXTERNAL_CONTACT_ONCE';

export type WeComCustomerContactReadonlyProofEnvKey =
  (typeof weComCustomerContactReadonlyProofEnvKeys)[number];
export type RequiredWeComCustomerContactReadonlyProofEnvKey =
  (typeof requiredWeComCustomerContactReadonlyProofEnvKeys)[number];
export type WeComCustomerContactReadonlyProofStatus =
  (typeof weComCustomerContactReadonlyProofStatuses)[number];
export type WeComCustomerContactReadonlyProofReason = WeComCustomerContactReadonlyProofStatus;

export type WeComCustomerContactReadonlyProofConfig = {
  corpId: string | null;
  customerContactSecret: string | null;
  testEmployeeUserId: string | null;
  capabilityEnabled: boolean;
  permissionConfirmed: boolean;
  credentialPlaceholderReady: boolean;
  singleEmployeeSelected: boolean;
  networkEnabled: boolean;
  customerReadEnabled: boolean;
  realSendEnabled: boolean;
};

export type MaskedWeComCustomerContactReadonlyProofConfigField = {
  configured: boolean;
  maskedValue: '***configured***' | null;
};

export type MaskedWeComCustomerContactReadonlyProofConfig = {
  corpId: MaskedWeComCustomerContactReadonlyProofConfigField;
  customerContactSecret: MaskedWeComCustomerContactReadonlyProofConfigField;
  testEmployeeUserId: MaskedWeComCustomerContactReadonlyProofConfigField;
};

export type WeComCustomerContactReadonlyProofDiagnostic = {
  stage: 'gettoken' | 'externalcontact_list' | 'externalcontact_get';
  wecomErrcode: number;
};

export type WeComCustomerContactReadonlyProofContact = {
  proofContactId: 'live-contact-proof-01';
  proofEmployeeId: 'live-employee-proof-01';
  customerType: 'external_contact';
  addedAt: string | null;
  relationshipStatus: 'visible';
  deletionStatus: 'active' | 'unknown';
  mode: 'real_readonly_proof';
  fieldWhitelistApplied: true;
  singleReadExecuted: true;
  proofAuthorized: false;
};

export type WeComCustomerContactReadonlyProofSummary = {
  configured: boolean;
  staticPrecheckReady: boolean;
  maskedConfig: MaskedWeComCustomerContactReadonlyProofConfig;
  capabilityEnabled: boolean;
  permissionConfirmed: boolean;
  credentialPlaceholderReady: boolean;
  singleEmployeeSelected: boolean;
  networkEnabled: boolean;
  customerReadEnabled: boolean;
  realSendEnabled: boolean;
  readonlyProofStatus: WeComCustomerContactReadonlyProofStatus;
  reason: WeComCustomerContactReadonlyProofReason;
  proofAuthorized: false;
  diagnostic?: WeComCustomerContactReadonlyProofDiagnostic;
  contact?: WeComCustomerContactReadonlyProofContact;
};

export type WeComCustomerContactReadonlyProofReadInput = {
  corpId: string;
  customerContactSecret: string;
  testEmployeeUserId: string;
};

export type WeComCustomerContactReadonlyProofReadOutcome =
  | { ok: true; addedAt: string | null }
  | {
      ok: false;
      reason:
        | 'auth_failed'
        | 'permission_failed'
        | 'network_error'
        | 'failed'
        | 'no_external_contact'
        | 'external_contact_scope_not_single';
      diagnostic?: WeComCustomerContactReadonlyProofDiagnostic;
    };

export type WeComCustomerContactReadonlyProofClient = {
  readSingleExternalContactOnce(
    input: WeComCustomerContactReadonlyProofReadInput,
  ): Promise<WeComCustomerContactReadonlyProofReadOutcome>;
};

export type EvaluateWeComCustomerContactReadonlyProofInput = {
  config: WeComCustomerContactReadonlyProofConfig;
  confirmed: boolean;
  client?: WeComCustomerContactReadonlyProofClient;
};

function normalizeConfigValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function maskConfigured(
  value: string | null | undefined,
): MaskedWeComCustomerContactReadonlyProofConfigField {
  return normalizeConfigValue(value)
    ? { configured: true, maskedValue: '***configured***' }
    : { configured: false, maskedValue: null };
}

export function getWeComCustomerContactReadonlyProofMissingKeys(
  config: WeComCustomerContactReadonlyProofConfig,
): RequiredWeComCustomerContactReadonlyProofEnvKey[] {
  const missingKeys: RequiredWeComCustomerContactReadonlyProofEnvKey[] = [];

  if (!normalizeConfigValue(config.corpId)) missingKeys.push('ZMTG_WECOM_CORP_ID');
  if (!normalizeConfigValue(config.customerContactSecret)) {
    missingKeys.push('ZMTG_WECOM_CUSTOMER_CONTACT_SECRET');
  }
  if (!normalizeConfigValue(config.testEmployeeUserId)) {
    missingKeys.push('ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID');
  }

  return missingKeys;
}

export function maskWeComCustomerContactReadonlyProofConfig(
  config: WeComCustomerContactReadonlyProofConfig,
): MaskedWeComCustomerContactReadonlyProofConfig {
  return {
    corpId: maskConfigured(config.corpId),
    customerContactSecret: maskConfigured(config.customerContactSecret),
    testEmployeeUserId: maskConfigured(config.testEmployeeUserId),
  };
}

function isStaticPrecheckReady(config: WeComCustomerContactReadonlyProofConfig) {
  return config.capabilityEnabled &&
    config.permissionConfirmed &&
    config.credentialPlaceholderReady &&
    config.singleEmployeeSelected;
}

function resolveBlockedStatus(
  config: WeComCustomerContactReadonlyProofConfig,
): WeComCustomerContactReadonlyProofStatus | null {
  if (!isStaticPrecheckReady(config)) return 'blocked_static_precheck_not_ready';
  if (getWeComCustomerContactReadonlyProofMissingKeys(config).length > 0) {
    return 'blocked_missing_config';
  }
  if (!config.networkEnabled) return 'blocked_real_network_disabled';
  if (!config.customerReadEnabled) return 'blocked_customer_read_disabled';
  if (config.realSendEnabled) return 'blocked_real_send_must_remain_disabled';
  return null;
}

export function isWeComCustomerContactReadonlyProofExecutionReady(
  config: WeComCustomerContactReadonlyProofConfig,
) {
  return resolveBlockedStatus(config) === null;
}

function createSummary(input: {
  config: WeComCustomerContactReadonlyProofConfig;
  status: WeComCustomerContactReadonlyProofStatus;
  diagnostic?: WeComCustomerContactReadonlyProofDiagnostic;
  contact?: WeComCustomerContactReadonlyProofContact;
}): WeComCustomerContactReadonlyProofSummary {
  return {
    configured: getWeComCustomerContactReadonlyProofMissingKeys(input.config).length === 0,
    staticPrecheckReady: isStaticPrecheckReady(input.config),
    maskedConfig: maskWeComCustomerContactReadonlyProofConfig(input.config),
    capabilityEnabled: input.config.capabilityEnabled,
    permissionConfirmed: input.config.permissionConfirmed,
    credentialPlaceholderReady: input.config.credentialPlaceholderReady,
    singleEmployeeSelected: input.config.singleEmployeeSelected,
    networkEnabled: input.config.networkEnabled,
    customerReadEnabled: input.config.customerReadEnabled,
    realSendEnabled: input.config.realSendEnabled,
    readonlyProofStatus: input.status,
    reason: input.status,
    proofAuthorized: false,
    ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}),
    ...(input.contact ? { contact: input.contact } : {}),
  };
}

export function summarizeWeComCustomerContactReadonlyProofConfig(
  config: WeComCustomerContactReadonlyProofConfig,
): WeComCustomerContactReadonlyProofSummary {
  const blockedStatus = resolveBlockedStatus(config);
  return createSummary({
    config,
    status: blockedStatus ?? 'readonly_proof_not_requested',
  });
}

function normalizeAddedAt(value: string | null) {
  if (value === null) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function createCompletedContact(
  addedAt: string | null,
): WeComCustomerContactReadonlyProofContact {
  return {
    proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01',
    customerType: 'external_contact',
    addedAt: normalizeAddedAt(addedAt),
    relationshipStatus: 'visible',
    deletionStatus: 'active',
    mode: 'real_readonly_proof',
    fieldWhitelistApplied: true,
    singleReadExecuted: true,
    proofAuthorized: false,
  };
}

function statusFromFailure(
  reason: Exclude<WeComCustomerContactReadonlyProofReadOutcome, { ok: true }>['reason'],
): WeComCustomerContactReadonlyProofStatus {
  if (reason === 'auth_failed') return 'readonly_proof_auth_failed';
  if (reason === 'permission_failed') return 'readonly_proof_permission_failed';
  if (reason === 'network_error') return 'readonly_proof_network_error';
  if (reason === 'no_external_contact') return 'blocked_no_external_contact';
  if (reason === 'external_contact_scope_not_single') {
    return 'blocked_external_contact_scope_not_single';
  }
  return 'readonly_proof_failed';
}

export async function evaluateWeComCustomerContactReadonlyProof(
  input: EvaluateWeComCustomerContactReadonlyProofInput,
): Promise<WeComCustomerContactReadonlyProofSummary> {
  const blockedStatus = resolveBlockedStatus(input.config);
  if (blockedStatus) return createSummary({ config: input.config, status: blockedStatus });

  if (!input.confirmed) {
    return createSummary({
      config: input.config,
      status: 'blocked_missing_confirmation',
    });
  }

  if (!input.client) {
    return createSummary({
      config: input.config,
      status: 'readonly_proof_network_error',
    });
  }

  let outcome: WeComCustomerContactReadonlyProofReadOutcome;
  try {
    outcome = await input.client.readSingleExternalContactOnce({
      corpId: input.config.corpId ?? '',
      customerContactSecret: input.config.customerContactSecret ?? '',
      testEmployeeUserId: input.config.testEmployeeUserId ?? '',
    });
  } catch {
    return createSummary({
      config: input.config,
      status: 'readonly_proof_network_error',
    });
  }

  if (outcome.ok) {
    return createSummary({
      config: input.config,
      status: 'readonly_proof_completed',
      contact: createCompletedContact(outcome.addedAt),
    });
  }

  return createSummary({
    config: input.config,
    status: statusFromFailure(outcome.reason),
    diagnostic: outcome.diagnostic,
  });
}
