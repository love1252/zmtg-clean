export type CustomerLifecycle =
  | 'consulting'
  | 'scheduled'
  | 'post_care'
  | 'repurchase_window'
  | 'silent_reactivation';

export type CustomerPriority = 'high' | 'medium' | 'observe';

export type CustomerInstitutionAttribution = {
  tenantId: string;
  institutionId: string;
};

export type CustomerMutableFields = {
  displayName: string;
  lifecycle: CustomerLifecycle;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
  gender: string;
  birthDate: string;
  referralSource: string;
  notes: string;
};

export type CustomerCommandRecord = CustomerInstitutionAttribution &
  CustomerMutableFields & {
    id: string;
  };

export type CreateCustomerCommand = {
  attribution: CustomerInstitutionAttribution;
  customer: CustomerMutableFields & {
    id: string;
  };
};

export type UpdateCustomerCommand = {
  attribution: CustomerInstitutionAttribution;
  customerId: string;
  changes: Partial<CustomerMutableFields>;
};

export type CustomerRepositoryCreateInput = CustomerCommandRecord;

export type CustomerRepositoryUpdateInput = CustomerInstitutionAttribution & {
  id: string;
  changes: Partial<CustomerMutableFields>;
};

export interface CustomerCommandRepository {
  create(input: CustomerRepositoryCreateInput): Promise<CustomerCommandRecord>;
  update(input: CustomerRepositoryUpdateInput): Promise<CustomerCommandRecord | null>;
}

export class CustomerCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new CustomerCommandInputError(`invalid_${field}`);
  }

  return value;
}

function normalizeAttribution(
  attribution: CustomerInstitutionAttribution,
): CustomerInstitutionAttribution {
  return {
    tenantId: requireExactIdentifier(attribution?.tenantId, 'tenant_id'),
    institutionId: requireExactIdentifier(attribution?.institutionId, 'institution_id'),
  };
}

function copyTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new CustomerCommandInputError('invalid_tags');
  }

  return [...value];
}

function pickCreateCustomer(
  customer: CreateCustomerCommand['customer'],
): CreateCustomerCommand['customer'] {
  return {
    id: requireExactIdentifier(customer?.id, 'customer_id'),
    displayName: customer.displayName,
    lifecycle: customer.lifecycle,
    priority: customer.priority,
    ownerUserId: customer.ownerUserId,
    projectInterest: customer.projectInterest,
    maskedPhone: customer.maskedPhone,
    maskedMedicalRecordNo: customer.maskedMedicalRecordNo,
    lastTouchSummary: customer.lastTouchSummary,
    nextAction: customer.nextAction,
    tags: copyTags(customer.tags),
    gender: customer.gender,
    birthDate: customer.birthDate,
    referralSource: customer.referralSource,
    notes: customer.notes,
  };
}

function pickUpdateChanges(
  changes: Partial<CustomerMutableFields>,
): Partial<CustomerMutableFields> {
  const result: Partial<CustomerMutableFields> = {};

  if (changes.displayName !== undefined) result.displayName = changes.displayName;
  if (changes.lifecycle !== undefined) result.lifecycle = changes.lifecycle;
  if (changes.priority !== undefined) result.priority = changes.priority;
  if (changes.ownerUserId !== undefined) result.ownerUserId = changes.ownerUserId;
  if (changes.projectInterest !== undefined) result.projectInterest = changes.projectInterest;
  if (changes.maskedPhone !== undefined) result.maskedPhone = changes.maskedPhone;
  if (changes.maskedMedicalRecordNo !== undefined) {
    result.maskedMedicalRecordNo = changes.maskedMedicalRecordNo;
  }
  if (changes.lastTouchSummary !== undefined) result.lastTouchSummary = changes.lastTouchSummary;
  if (changes.nextAction !== undefined) result.nextAction = changes.nextAction;
  if (changes.tags !== undefined) result.tags = copyTags(changes.tags);
  if (changes.gender !== undefined) result.gender = changes.gender;
  if (changes.birthDate !== undefined) result.birthDate = changes.birthDate;
  if (changes.referralSource !== undefined) result.referralSource = changes.referralSource;
  if (changes.notes !== undefined) result.notes = changes.notes;

  return result;
}

export function createCustomerCommandService(repository: CustomerCommandRepository) {
  return Object.freeze({
    async createCustomer(input: CreateCustomerCommand): Promise<CustomerCommandRecord> {
      const attribution = normalizeAttribution(input.attribution);
      const customer = pickCreateCustomer(input.customer);

      return repository.create({
        tenantId: attribution.tenantId,
        institutionId: attribution.institutionId,
        ...customer,
      });
    },

    async updateCustomer(input: UpdateCustomerCommand): Promise<CustomerCommandRecord | null> {
      const attribution = normalizeAttribution(input.attribution);
      const customerId = requireExactIdentifier(input.customerId, 'customer_id');

      return repository.update({
        tenantId: attribution.tenantId,
        institutionId: attribution.institutionId,
        id: customerId,
        changes: pickUpdateChanges(input.changes),
      });
    },
  });
}
