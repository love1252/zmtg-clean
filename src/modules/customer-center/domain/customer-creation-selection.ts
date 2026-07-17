import { isLowSensitiveCustomerText } from '@/modules/customer-center/domain/customer-query';
import {
  resolveCustomerProjectSelection,
  type CustomerProjectCatalog,
  type CustomerProjectCatalogEntry,
} from '@/modules/customer-center/domain/customer-project-selection';

export type CustomerCreationSelectionInput = {
  displayName: string;
  ownerUserId: string;
  sourceCode: string;
  selectedProjectIds: readonly string[];
  primaryProjectId: string;
};

export type CustomerCreationStableReferenceFact = {
  sourceCode: string;
  maskedReference: string;
};

export type CustomerCreationSelectionFacts = {
  stableReference: Readonly<CustomerCreationStableReferenceFact>;
  approvedMemberIds: ReadonlySet<string>;
  requiredOwnerUserId: string | null;
  approvedSourceCodes: ReadonlySet<string>;
  projectCatalog: CustomerProjectCatalog;
};

export type CustomerCreationSelectionPolicy = {
  isApprovedDisplayName: (value: string) => boolean;
  isApprovedMaskedReference: (value: string) => boolean;
};

export type CustomerCreationSelection = {
  displayName: string;
  stableReference: CustomerCreationStableReferenceFact;
  ownerUserId: string;
  sourceCode: string;
  projects: CustomerProjectCatalogEntry[];
  primaryProject: CustomerProjectCatalogEntry;
};

export type CustomerCreationSelectionResult =
  | {
      ok: true;
      value: CustomerCreationSelection;
    }
  | {
      ok: false;
      code: 'invalid_customer_creation_selection';
    };

const inputKeys = new Set<PropertyKey>([
  'displayName',
  'ownerUserId',
  'sourceCode',
  'selectedProjectIds',
  'primaryProjectId',
]);
const factsKeys = new Set<PropertyKey>([
  'stableReference',
  'approvedMemberIds',
  'requiredOwnerUserId',
  'approvedSourceCodes',
  'projectCatalog',
]);
const policyKeys = new Set<PropertyKey>([
  'isApprovedDisplayName',
  'isApprovedMaskedReference',
]);
const stableReferenceKeys = new Set<PropertyKey>(['sourceCode', 'maskedReference']);

function invalidSelection(): CustomerCreationSelectionResult {
  return {
    ok: false,
    code: 'invalid_customer_creation_selection',
  };
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readExactDataRecord(
  input: unknown,
  expectedKeys: ReadonlySet<PropertyKey>,
): Record<PropertyKey, unknown> | null {
  if (!isPlainRecord(input)) return null;

  const keys = Reflect.ownKeys(input);
  if (keys.length !== expectedKeys.size || keys.some((key) => !expectedKeys.has(key))) {
    return null;
  }

  const values: Record<PropertyKey, unknown> = Object.create(null) as Record<
    PropertyKey,
    unknown
  >;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) return null;
    values[key] = descriptor.value;
  }

  return values;
}

function readExactStringArray(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;

  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (
    !lengthDescriptor ||
    !('value' in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return null;
  }

  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length + 1 || !keys.includes('length')) return null;

  const values: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') {
      return null;
    }
    values.push(descriptor.value);
  }

  return values;
}

function normalizeLowSensitiveText(
  input: unknown,
  isApproved: (value: string) => boolean,
) {
  if (typeof input !== 'string') return null;

  const normalized = input.trim();
  if (
    normalized.length === 0 ||
    !isLowSensitiveCustomerText(normalized) ||
    isApproved(normalized) !== true
  ) {
    return null;
  }

  return normalized;
}

function isCanonicalSelectionCode(input: unknown): input is string {
  return typeof input === 'string' && input.length > 0 && input === input.trim();
}

export function resolveCustomerCreationSelection(
  input: unknown,
  factsInput: CustomerCreationSelectionFacts,
  policyInput: CustomerCreationSelectionPolicy,
): CustomerCreationSelectionResult {
  try {
    const inputValues = readExactDataRecord(input, inputKeys);
    const facts = readExactDataRecord(factsInput, factsKeys);
    const policy = readExactDataRecord(policyInput, policyKeys);
    if (!inputValues || !facts || !policy) return invalidSelection();

    const stableReference = readExactDataRecord(
      facts.stableReference,
      stableReferenceKeys,
    );
    const selectedProjectIds = readExactStringArray(inputValues.selectedProjectIds);
    const isApprovedDisplayName = policy.isApprovedDisplayName;
    const isApprovedMaskedReference = policy.isApprovedMaskedReference;
    if (
      !stableReference ||
      !selectedProjectIds ||
      typeof isApprovedDisplayName !== 'function' ||
      typeof isApprovedMaskedReference !== 'function'
    ) {
      return invalidSelection();
    }

    const displayName = normalizeLowSensitiveText(
      inputValues.displayName,
      isApprovedDisplayName as (value: string) => boolean,
    );
    const maskedReference = normalizeLowSensitiveText(
      stableReference.maskedReference,
      isApprovedMaskedReference as (value: string) => boolean,
    );
    const ownerUserId = inputValues.ownerUserId;
    const sourceCode = inputValues.sourceCode;
    const referenceSourceCode = stableReference.sourceCode;
    const primaryProjectId = inputValues.primaryProjectId;
    const requiredOwnerUserId = facts.requiredOwnerUserId;
    const approvedMemberIds = facts.approvedMemberIds as ReadonlySet<string>;
    const approvedSourceCodes = facts.approvedSourceCodes as ReadonlySet<string>;

    if (
      !displayName ||
      !maskedReference ||
      !isCanonicalSelectionCode(ownerUserId) ||
      !isCanonicalSelectionCode(sourceCode) ||
      !isCanonicalSelectionCode(referenceSourceCode) ||
      !isCanonicalSelectionCode(primaryProjectId) ||
      referenceSourceCode !== sourceCode ||
      approvedMemberIds.has(ownerUserId) !== true ||
      approvedSourceCodes.has(sourceCode) !== true ||
      (requiredOwnerUserId !== null &&
        (!isCanonicalSelectionCode(requiredOwnerUserId) ||
          requiredOwnerUserId !== ownerUserId))
    ) {
      return invalidSelection();
    }

    const projectSelection = resolveCustomerProjectSelection(
      { selectedProjectIds, primaryProjectId },
      facts.projectCatalog as CustomerProjectCatalog,
    );
    if (
      !projectSelection.ok ||
      projectSelection.value.projects.length === 0 ||
      projectSelection.value.primaryProject === null
    ) {
      return invalidSelection();
    }

    return {
      ok: true,
      value: {
        displayName,
        stableReference: {
          sourceCode: referenceSourceCode,
          maskedReference,
        },
        ownerUserId,
        sourceCode,
        projects: projectSelection.value.projects.map((project) => ({ ...project })),
        primaryProject: { ...projectSelection.value.primaryProject },
      },
    };
  } catch {
    return invalidSelection();
  }
}
