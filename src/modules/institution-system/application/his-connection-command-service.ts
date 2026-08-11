export const hisConnectionStatuses = [
  'draft',
  'active',
  'paused',
  'revoked',
  'deleted',
  'error',
] as const;
export type HisConnectionStatus = (typeof hisConnectionStatuses)[number];

export const hisConnectionHealthStatuses = [
  'unknown',
  'healthy',
  'degraded',
  'failed',
] as const;
export type HisConnectionHealthStatus = (typeof hisConnectionHealthStatuses)[number];

export type HisConnectionHealthErrorCode =
  | 'missing_credential'
  | 'credential_provider_unavailable'
  | 'credential_unavailable'
  | 'credential_revoked'
  | 'provider_timeout'
  | 'external_unreachable'
  | 'external_auth_failed'
  | 'external_rate_limited'
  | 'external_service_unavailable'
  | 'unsupported_vendor'
  | 'unsafe_external_response'
  | 'connection_not_active'
  | 'service_unavailable'
  | 'partial_capability_unavailable'
  | 'provider_retry_succeeded'
  | 'provider_warning'
  | 'limited_health_probe';

export type HisConnectionReadModel = {
  connectionId: string;
  tenantId: string;
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  status: HisConnectionStatus;
  credentialConfigured: boolean;
  healthStatus: HisConnectionHealthStatus;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
};

export type HisConnectionCredentialStatus =
  | 'configured'
  | 'missing'
  | 'revoked'
  | 'deleted';

export type HisConnectionCredentialSummary = {
  connectionId: string;
  tenantId: string;
  status: HisConnectionStatus;
  credentialConfigured: boolean;
  credentialStatus: HisConnectionCredentialStatus;
  updatedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
};

export type CreateHisConnectionForTenantCommand = {
  tenantId: string;
  actorUserId: string;
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
};

export type UpdateHisConnectionForTenantCommand = {
  tenantId: string;
  connectionId: string;
  actorUserId: string;
  values: Partial<{
    connectionName: string;
    sourceSystem: string;
    vendorType: string;
    systemType: string;
  }>;
};

export type HisConnectionStatusTransitionCommand = {
  tenantId: string;
  connectionId: string;
  actorUserId: string;
  reasonCode?: string;
};

export type HisConnectionCredentialReferenceCommand = {
  tenantId: string;
  connectionId: string;
  actorUserId: string;
  credentialRef: string;
};

export type HisConnectionCredentialClearCommand = {
  tenantId: string;
  connectionId: string;
  actorUserId: string;
  reasonCode?: string;
};

export type WriteHisConnectionHealthSummaryForTenantCommand = {
  tenantId: string;
  connectionId: string;
  healthStatus: HisConnectionHealthStatus;
  checkedAt: Date | null;
  lastErrorCode: HisConnectionHealthErrorCode | null;
  actorUserId?: string;
};

export type CreateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'conflict' }
  | { status: 'validation_failed' };

export type UpdateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'validation_failed' };

export type HisConnectionStatusTransitionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' };

export type HisConnectionCredentialReferenceResult =
  | {
      status: 'ok';
      record: HisConnectionReadModel;
      summary: HisConnectionCredentialSummary;
    }
  | { status: 'not_found' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' };

export type HisConnectionHealthSummaryWriteResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'validation_failed' };

export type StatusTransitionDecision =
  | {
      status: 'ok';
      nextStatus: HisConnectionStatus;
      setRevokedAt?: boolean;
      setDeletedAt?: boolean;
    }
  | { status: 'conflict' | 'invalid_state_transition' };

export type NormalizedCreateHisConnectionCommand =
  CreateHisConnectionForTenantCommand;
export type NormalizedUpdateHisConnectionCommand =
  UpdateHisConnectionForTenantCommand;
export type NormalizedStatusTransitionCommand =
  HisConnectionStatusTransitionCommand;
export type NormalizedCredentialReferenceCommand =
  HisConnectionCredentialReferenceCommand;
export type NormalizedCredentialClearCommand =
  HisConnectionCredentialClearCommand;
export type NormalizedHealthSummaryCommand =
  WriteHisConnectionHealthSummaryForTenantCommand;

export interface HisConnectionCommandPersistence {
  createHisConnectionForTenant(
    input: NormalizedCreateHisConnectionCommand,
  ): Promise<CreateHisConnectionResult>;
  updateHisConnectionForTenant(
    input: NormalizedUpdateHisConnectionCommand,
  ): Promise<UpdateHisConnectionResult>;
  pauseHisConnectionForTenant(
    input: NormalizedStatusTransitionCommand,
  ): Promise<HisConnectionStatusTransitionResult>;
  resumeHisConnectionForTenant(
    input: NormalizedStatusTransitionCommand,
  ): Promise<HisConnectionStatusTransitionResult>;
  revokeHisConnectionForTenant(
    input: NormalizedStatusTransitionCommand,
  ): Promise<HisConnectionStatusTransitionResult>;
  softDeleteHisConnectionForTenant(
    input: NormalizedStatusTransitionCommand,
  ): Promise<HisConnectionStatusTransitionResult>;
  setHisConnectionCredentialReferenceForTenant(
    input: NormalizedCredentialReferenceCommand,
  ): Promise<HisConnectionCredentialReferenceResult>;
  rotateHisConnectionCredentialReferenceForTenant(
    input: NormalizedCredentialReferenceCommand,
  ): Promise<HisConnectionCredentialReferenceResult>;
  clearHisConnectionCredentialReferenceForTenant(
    input: NormalizedCredentialClearCommand,
  ): Promise<HisConnectionCredentialReferenceResult>;
  revokeHisConnectionCredentialReferenceForTenant(
    input: NormalizedCredentialClearCommand,
  ): Promise<HisConnectionCredentialReferenceResult>;
  writeHisConnectionHealthSummaryForTenant(
    input: NormalizedHealthSummaryCommand,
  ): Promise<HisConnectionHealthSummaryWriteResult>;
}

const limits = {
  tenantId: 64,
  connectionId: 64,
  connectionName: 160,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
  actorUserId: 96,
  reasonCode: 96,
  credentialRef: 128,
} as const;

const safeCredentialRefPattern = /^cred_ref_[a-zA-Z0-9_-]{12,}$/;
const forbiddenCredentialRefPattern =
  /sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|oauth|basic[_-]?auth|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function exactText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > maxLength || value.trim() !== value) {
    return null;
  }
  return value;
}

function optionalExactText(
  value: unknown,
  maxLength: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  return exactText(value, maxLength);
}

function normalizeCreate(
  input: CreateHisConnectionForTenantCommand,
): NormalizedCreateHisConnectionCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const actorUserId = exactText(input.actorUserId, limits.actorUserId);
  const connectionName = exactText(input.connectionName, limits.connectionName);
  const sourceSystem = exactText(input.sourceSystem, limits.sourceSystem);
  const vendorType = exactText(input.vendorType, limits.vendorType);
  const systemType = exactText(input.systemType, limits.systemType);
  if (
    !tenantId ||
    !actorUserId ||
    !connectionName ||
    !sourceSystem ||
    !vendorType ||
    !systemType
  ) return null;
  return {
    tenantId,
    actorUserId,
    connectionName,
    sourceSystem,
    vendorType,
    systemType,
  };
}

function normalizeUpdate(
  input: UpdateHisConnectionForTenantCommand,
): NormalizedUpdateHisConnectionCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const connectionId = exactText(input.connectionId, limits.connectionId);
  const actorUserId = exactText(input.actorUserId, limits.actorUserId);
  if (!tenantId || !connectionId || !actorUserId || !input.values) return null;

  const values: NormalizedUpdateHisConnectionCommand['values'] = {};
  if (input.values.connectionName !== undefined) {
    const value = exactText(input.values.connectionName, limits.connectionName);
    if (!value) return null;
    values.connectionName = value;
  }
  if (input.values.sourceSystem !== undefined) {
    const value = exactText(input.values.sourceSystem, limits.sourceSystem);
    if (!value) return null;
    values.sourceSystem = value;
  }
  if (input.values.vendorType !== undefined) {
    const value = exactText(input.values.vendorType, limits.vendorType);
    if (!value) return null;
    values.vendorType = value;
  }
  if (input.values.systemType !== undefined) {
    const value = exactText(input.values.systemType, limits.systemType);
    if (!value) return null;
    values.systemType = value;
  }
  if (Object.keys(values).length === 0) return null;
  return { tenantId, connectionId, actorUserId, values };
}

function normalizeStatus(
  input: HisConnectionStatusTransitionCommand,
): NormalizedStatusTransitionCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const connectionId = exactText(input.connectionId, limits.connectionId);
  const actorUserId = exactText(input.actorUserId, limits.actorUserId);
  const reasonCode = optionalExactText(input.reasonCode, limits.reasonCode);
  if (!tenantId || !connectionId || !actorUserId || reasonCode === null) {
    return null;
  }
  return {
    tenantId,
    connectionId,
    actorUserId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
  };
}

function normalizeCredentialRef(
  input: HisConnectionCredentialReferenceCommand,
): NormalizedCredentialReferenceCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const connectionId = exactText(input.connectionId, limits.connectionId);
  const actorUserId = exactText(input.actorUserId, limits.actorUserId);
  const credentialRef = exactText(input.credentialRef, limits.credentialRef);
  if (
    !tenantId ||
    !connectionId ||
    !actorUserId ||
    !credentialRef ||
    !safeCredentialRefPattern.test(credentialRef) ||
    forbiddenCredentialRefPattern.test(credentialRef)
  ) return null;
  return { tenantId, connectionId, actorUserId, credentialRef };
}

function normalizeCredentialClear(
  input: HisConnectionCredentialClearCommand,
): NormalizedCredentialClearCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const connectionId = exactText(input.connectionId, limits.connectionId);
  const actorUserId = exactText(input.actorUserId, limits.actorUserId);
  const reasonCode = optionalExactText(input.reasonCode, limits.reasonCode);
  if (!tenantId || !connectionId || !actorUserId || reasonCode === null) {
    return null;
  }
  return {
    tenantId,
    connectionId,
    actorUserId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
  };
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeHealth(
  input: WriteHisConnectionHealthSummaryForTenantCommand,
): NormalizedHealthSummaryCommand | null {
  const tenantId = exactText(input.tenantId, limits.tenantId);
  const connectionId = exactText(input.connectionId, limits.connectionId);
  let actorUserId: string | undefined;
  if (input.actorUserId !== undefined) {
    const normalizedActorUserId = exactText(
      input.actorUserId,
      limits.actorUserId,
    );
    if (!normalizedActorUserId) return null;
    actorUserId = normalizedActorUserId;
  }

  if (
    !tenantId ||
    !connectionId ||
    !hisConnectionHealthStatuses.includes(input.healthStatus)
  ) return null;

  if (input.healthStatus === 'unknown') {
    if (input.checkedAt !== null || input.lastErrorCode !== null) return null;
  } else {
    if (!validDate(input.checkedAt)) return null;
    if (input.healthStatus === 'healthy' && input.lastErrorCode !== null) {
      return null;
    }
    if (
      input.healthStatus !== 'healthy' &&
      (typeof input.lastErrorCode !== 'string' || input.lastErrorCode.length === 0)
    ) {
      return null;
    }
  }

  return {
    tenantId,
    connectionId,
    healthStatus: input.healthStatus,
    checkedAt: input.checkedAt,
    lastErrorCode: input.lastErrorCode,
    ...(actorUserId === undefined ? {} : { actorUserId }),
  };
}

export function decideHisConnectionStatusTransition(
  action: 'pause' | 'resume' | 'revoke' | 'delete',
  currentStatus: HisConnectionStatus,
): StatusTransitionDecision {
  if (action === 'pause') {
    if (currentStatus === 'active' || currentStatus === 'error') {
      return { status: 'ok', nextStatus: 'paused' };
    }
    return currentStatus === 'paused'
      ? { status: 'conflict' }
      : { status: 'invalid_state_transition' };
  }
  if (action === 'resume') {
    if (currentStatus === 'paused') {
      return { status: 'ok', nextStatus: 'active' };
    }
    return currentStatus === 'active'
      ? { status: 'conflict' }
      : { status: 'invalid_state_transition' };
  }
  if (action === 'revoke') {
    if (['draft', 'active', 'paused', 'error'].includes(currentStatus)) {
      return { status: 'ok', nextStatus: 'revoked', setRevokedAt: true };
    }
    return currentStatus === 'revoked'
      ? { status: 'conflict' }
      : { status: 'invalid_state_transition' };
  }
  if (['draft', 'active', 'paused', 'revoked', 'error'].includes(currentStatus)) {
    return { status: 'ok', nextStatus: 'deleted', setDeletedAt: true };
  }
  return currentStatus === 'deleted'
    ? { status: 'conflict' }
    : { status: 'invalid_state_transition' };
}

export function createHisConnectionCommandService(
  persistence: HisConnectionCommandPersistence,
) {
  return Object.freeze({
    async createHisConnectionForTenant(input: CreateHisConnectionForTenantCommand) {
      const command = normalizeCreate(input);
      return command
        ? persistence.createHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async updateHisConnectionForTenant(input: UpdateHisConnectionForTenantCommand) {
      const command = normalizeUpdate(input);
      return command
        ? persistence.updateHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async pauseHisConnectionForTenant(input: HisConnectionStatusTransitionCommand) {
      const command = normalizeStatus(input);
      return command
        ? persistence.pauseHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async resumeHisConnectionForTenant(input: HisConnectionStatusTransitionCommand) {
      const command = normalizeStatus(input);
      return command
        ? persistence.resumeHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async revokeHisConnectionForTenant(input: HisConnectionStatusTransitionCommand) {
      const command = normalizeStatus(input);
      return command
        ? persistence.revokeHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async softDeleteHisConnectionForTenant(input: HisConnectionStatusTransitionCommand) {
      const command = normalizeStatus(input);
      return command
        ? persistence.softDeleteHisConnectionForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async setHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialReferenceCommand,
    ) {
      const command = normalizeCredentialRef(input);
      return command
        ? persistence.setHisConnectionCredentialReferenceForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async rotateHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialReferenceCommand,
    ) {
      const command = normalizeCredentialRef(input);
      return command
        ? persistence.rotateHisConnectionCredentialReferenceForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async clearHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialClearCommand,
    ) {
      const command = normalizeCredentialClear(input);
      return command
        ? persistence.clearHisConnectionCredentialReferenceForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async revokeHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialClearCommand,
    ) {
      const command = normalizeCredentialClear(input);
      return command
        ? persistence.revokeHisConnectionCredentialReferenceForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
    async writeHisConnectionHealthSummaryForTenant(
      input: WriteHisConnectionHealthSummaryForTenantCommand,
    ) {
      const command = normalizeHealth(input);
      return command
        ? persistence.writeHisConnectionHealthSummaryForTenant(command)
        : ({ status: 'validation_failed' } as const);
    },
  });
}

export type HisConnectionCommandService =
  ReturnType<typeof createHisConnectionCommandService>;
