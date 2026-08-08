export type WeComMappingStatus = 'confirmed' | 'rejected' | 'revoked';
export type WeComMappingSourceMode = 'real_readonly_proof';

export type WeComMappingCommandScope = {
  tenantId: string;
  institutionId: string;
  proofContactId: string;
};

export type WeComMappingDecision = {
  decidedBy: string;
  decidedAt: string;
};

export type WeComMappingState = WeComMappingCommandScope & {
  id: string;
  proofEmployeeId: string;
  sourceMode: WeComMappingSourceMode;
  customerId: string;
  status: WeComMappingStatus;
  decidedBy: string;
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateWeComMappingCommand = {
  scope: WeComMappingCommandScope;
  mapping: {
    id: string;
    proofEmployeeId: string;
    sourceMode: WeComMappingSourceMode;
    customerId: string;
    status: WeComMappingStatus;
  };
  decision: WeComMappingDecision;
};

export type UpdateWeComMappingCommand = {
  scope: WeComMappingCommandScope;
  transition: {
    customerId: string;
    expectedCustomerId: string;
    expectedStatus: WeComMappingStatus;
    status: WeComMappingStatus;
  };
  decision: WeComMappingDecision;
};

export type WeComMappingRepositoryCreateInput = WeComMappingCommandScope & {
  id: string;
  proofEmployeeId: string;
  sourceMode: WeComMappingSourceMode;
  customerId: string;
  status: WeComMappingStatus;
  decidedBy: string;
  decidedAt: string;
};

export type WeComMappingRepositoryUpdateInput = WeComMappingCommandScope & {
  customerId: string;
  expectedCustomerId: string;
  expectedStatus: WeComMappingStatus;
  status: WeComMappingStatus;
  decidedBy: string;
  decidedAt: string;
};

export interface WeComMappingCommandRepository {
  create(input: WeComMappingRepositoryCreateInput): Promise<WeComMappingState | null>;
  update(input: WeComMappingRepositoryUpdateInput): Promise<WeComMappingState | null>;
}

export class WeComMappingCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeComMappingCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new WeComMappingCommandInputError(`invalid_${field}`);
  }
  return value;
}

function requireTimestamp(value: unknown): string {
  const normalized = requireExactIdentifier(value, 'decided_at');
  if (Number.isNaN(Date.parse(normalized))) {
    throw new WeComMappingCommandInputError('invalid_decided_at');
  }
  return normalized;
}

function requireStatus(value: unknown): WeComMappingStatus {
  if (value === 'confirmed' || value === 'rejected' || value === 'revoked') return value;
  throw new WeComMappingCommandInputError('invalid_mapping_status');
}

function requireSourceMode(value: unknown): WeComMappingSourceMode {
  if (value === 'real_readonly_proof') return value;
  throw new WeComMappingCommandInputError('invalid_mapping_source_mode');
}

function normalizeScope(scope: WeComMappingCommandScope): WeComMappingCommandScope {
  return {
    tenantId: requireExactIdentifier(scope?.tenantId, 'tenant_id'),
    institutionId: requireExactIdentifier(scope?.institutionId, 'institution_id'),
    proofContactId: requireExactIdentifier(scope?.proofContactId, 'proof_contact_id'),
  };
}

export function createWeComMappingCommandService(repository: WeComMappingCommandRepository) {
  return Object.freeze({
    async createMapping(input: CreateWeComMappingCommand): Promise<WeComMappingState | null> {
      const scope = normalizeScope(input.scope);
      return repository.create({
        ...scope,
        id: requireExactIdentifier(input.mapping?.id, 'mapping_id'),
        proofEmployeeId: requireExactIdentifier(input.mapping?.proofEmployeeId, 'proof_employee_id'),
        sourceMode: requireSourceMode(input.mapping?.sourceMode),
        customerId: requireExactIdentifier(input.mapping?.customerId, 'customer_id'),
        status: requireStatus(input.mapping?.status),
        decidedBy: requireExactIdentifier(input.decision?.decidedBy, 'decided_by'),
        decidedAt: requireTimestamp(input.decision?.decidedAt),
      });
    },

    async updateMapping(input: UpdateWeComMappingCommand): Promise<WeComMappingState | null> {
      const scope = normalizeScope(input.scope);
      return repository.update({
        ...scope,
        customerId: requireExactIdentifier(input.transition?.customerId, 'customer_id'),
        expectedCustomerId: requireExactIdentifier(input.transition?.expectedCustomerId, 'expected_customer_id'),
        expectedStatus: requireStatus(input.transition?.expectedStatus),
        status: requireStatus(input.transition?.status),
        decidedBy: requireExactIdentifier(input.decision?.decidedBy, 'decided_by'),
        decidedAt: requireTimestamp(input.decision?.decidedAt),
      });
    },
  });
}
