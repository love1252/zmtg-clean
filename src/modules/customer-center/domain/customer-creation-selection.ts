import { types as nodeUtilTypes } from 'node:util';

import { isLowSensitiveCustomerText } from '@/modules/customer-center/domain/customer-query';
import {
  resolveCustomerProjectSelection,
  type CustomerProjectCatalog,
  type CustomerProjectCatalogEntry,
} from '@/modules/customer-center/domain/customer-project-selection';

/**
 * This module only normalizes a low-sensitive customer-creation candidate. It
 * does not authenticate an actor, authorize creation, issue a customer
 * reference, or persist a customer.
 */

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

export const customerCreationOwnerRequirements = Object.freeze([
  'server_authorization',
  'fresh_institution_membership',
  'institution_action_object_guard',
  'stable_external_reference_and_deduplication',
  'authoritative_owner_and_project',
  'mig_01_mig_02_relations',
  'capability_and_release',
  'audit_and_atomicity',
] as const);

export type CustomerCreationOwnerRequirement =
  (typeof customerCreationOwnerRequirements)[number];

export type CustomerCreationSelectionCandidate = Readonly<{
  /** Low-sensitivity display data only; it is neither a customer record nor an authorization. */
  displayName: string;
  maskedReference: string;
  projectDisplayNames: readonly string[];
  primaryProjectIndex: number;
  ownerRequirements: readonly CustomerCreationOwnerRequirement[];
}>;

export type CustomerCreationSelectionResult =
  | Readonly<{
      kind: 'non_authorizing_candidate';
      candidate: CustomerCreationSelectionCandidate;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_customer_creation_selection';
    }>;

const MAX_LOW_SENSITIVE_TEXT_LENGTH = 128;
const MAX_SELECTION_CODE_LENGTH = 128;
const MAX_SELECTED_PROJECT_COUNT = 32;
const MAX_APPROVED_MEMBER_COUNT = 512;
const MAX_APPROVED_SOURCE_COUNT = 128;
const MAX_PROJECT_CATALOG_COUNT = 256;

const selectionCodePattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;

const inputKeys = Object.freeze([
  'displayName',
  'ownerUserId',
  'sourceCode',
  'selectedProjectIds',
  'primaryProjectId',
] as const);
const factsKeys = Object.freeze([
  'stableReference',
  'approvedMemberIds',
  'requiredOwnerUserId',
  'approvedSourceCodes',
  'projectCatalog',
] as const);
const policyKeys = Object.freeze([
  'isApprovedDisplayName',
  'isApprovedMaskedReference',
] as const);
const stableReferenceKeys = Object.freeze(['sourceCode', 'maskedReference'] as const);
const projectEntryKeys = Object.freeze(['projectId', 'displayName'] as const);

function blocked(): CustomerCreationSelectionResult {
  return Object.freeze({
    kind: 'blocked' as const,
    code: 'invalid_customer_creation_selection' as const,
  });
}

function isRuntimeProxy(value: object): boolean {
  try {
    return nodeUtilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function readExactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      typeof input !== 'object' ||
      input === null ||
      isRuntimeProxy(input) ||
      Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return null;
    }

    // Check the bounded key set before obtaining any property descriptors. A
    // 10k-extra-key object is rejected without descriptor amplification.
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) => typeof key !== 'string' || !expectedKeys.includes(key),
      )
    ) {
      return null;
    }

    const values: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      values[key] = descriptor.value;
    }

    return Object.freeze(values);
  } catch {
    return null;
  }
}

function readExactStringArray(input: unknown): readonly string[] | null {
  try {
    if (
      typeof input !== 'object' ||
      input === null ||
      isRuntimeProxy(input) ||
      !Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Array.prototype
    ) {
      return null;
    }

    const length = input.length;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_SELECTED_PROJECT_COUNT
    ) {
      return null;
    }

    // Reject extras, symbols and sparse arrays before reading element
    // descriptors. Frozen dense arrays remain valid.
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== length + 1 ||
      !ownKeys.includes('length') ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key)),
      )
    ) {
      return null;
    }

    const values: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        descriptor.enumerable !== true ||
        !isCanonicalSelectionCode(descriptor.value)
      ) {
        return null;
      }
      values.push(descriptor.value);
    }

    return Object.freeze(values);
  } catch {
    return null;
  }
}

function readExactStringSet(
  input: unknown,
  maximumSize: number,
): ReadonlySet<string> | null {
  try {
    if (
      typeof input !== 'object' ||
      input === null ||
      isRuntimeProxy(input) ||
      Object.getPrototypeOf(input) !== Set.prototype ||
      Reflect.ownKeys(input).length !== 0
    ) {
      return null;
    }

    const source = input as Set<unknown>;
    if (source.size > maximumSize) return null;

    const snapshot = new Set<string>();
    for (const value of source) {
      if (!isCanonicalSelectionCode(value)) return null;
      snapshot.add(value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function readExactProjectCatalog(input: unknown): CustomerProjectCatalog | null {
  try {
    if (
      typeof input !== 'object' ||
      input === null ||
      isRuntimeProxy(input) ||
      Object.getPrototypeOf(input) !== Map.prototype ||
      Reflect.ownKeys(input).length !== 0
    ) {
      return null;
    }

    const source = input as Map<unknown, unknown>;
    if (source.size > MAX_PROJECT_CATALOG_COUNT) return null;

    const snapshot = new Map<string, Readonly<CustomerProjectCatalogEntry>>();
    for (const [rawProjectId, rawEntry] of source) {
      const projectId = isCanonicalSelectionCode(rawProjectId)
        ? rawProjectId
        : null;
      const entry = readExactDataRecord(rawEntry, projectEntryKeys);
      const entryProjectId = entry?.projectId;
      const displayName = normalizeLowSensitiveText(entry?.displayName);
      if (
        projectId === null ||
        entryProjectId !== projectId ||
        displayName === null ||
        snapshot.has(projectId)
      ) {
        return null;
      }

      snapshot.set(projectId, Object.freeze({ projectId, displayName }));
    }
    return snapshot;
  } catch {
    return null;
  }
}

function normalizeLowSensitiveText(input: unknown): string | null {
  if (
    typeof input !== 'string' ||
    input.length === 0 ||
    input.length > MAX_LOW_SENSITIVE_TEXT_LENGTH
  ) {
    return null;
  }

  const normalized = input.trim();
  return normalized.length > 0 && isLowSensitiveCustomerText(normalized)
    ? normalized
    : null;
}

function normalizeApprovedLowSensitiveText(
  input: unknown,
  isApproved: unknown,
): string | null {
  if (
    typeof isApproved !== 'function' ||
    isRuntimeProxy(isApproved) ||
    Reflect.ownKeys(isApproved).some(
      (key) => key !== 'length' && key !== 'name',
    )
  ) {
    return null;
  }

  const normalized = normalizeLowSensitiveText(input);
  return normalized !== null && isApproved(normalized) === true ? normalized : null;
}

function isCanonicalSelectionCode(input: unknown): input is string {
  return (
    typeof input === 'string' &&
    input.length > 0 &&
    input.length <= MAX_SELECTION_CODE_LENGTH &&
    selectionCodePattern.test(input)
  );
}

function buildCandidate(
  displayName: string,
  maskedReference: string,
  projects: readonly CustomerProjectCatalogEntry[],
  primaryProjectId: string,
): CustomerCreationSelectionResult {
  const primaryProjectIndex = projects.findIndex(
    (project) => project.projectId === primaryProjectId,
  );
  if (primaryProjectIndex < 0) return blocked();

  const projectDisplayNames = Object.freeze(
    projects.map((project) => project.displayName),
  );
  const candidate: CustomerCreationSelectionCandidate = Object.freeze({
    displayName,
    maskedReference,
    projectDisplayNames,
    primaryProjectIndex,
    ownerRequirements: customerCreationOwnerRequirements,
  });

  return Object.freeze({
    kind: 'non_authorizing_candidate' as const,
    candidate,
  });
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
    if (!inputValues || !facts || !policy) return blocked();

    const stableReference = readExactDataRecord(
      facts.stableReference,
      stableReferenceKeys,
    );
    const selectedProjectIds = readExactStringArray(
      inputValues.selectedProjectIds,
    );
    const approvedMemberIds = readExactStringSet(
      facts.approvedMemberIds,
      MAX_APPROVED_MEMBER_COUNT,
    );
    const approvedSourceCodes = readExactStringSet(
      facts.approvedSourceCodes,
      MAX_APPROVED_SOURCE_COUNT,
    );
    const projectCatalog = readExactProjectCatalog(facts.projectCatalog);
    if (
      !stableReference ||
      !selectedProjectIds ||
      !approvedMemberIds ||
      !approvedSourceCodes ||
      !projectCatalog
    ) {
      return blocked();
    }

    const displayName = normalizeApprovedLowSensitiveText(
      inputValues.displayName,
      policy.isApprovedDisplayName,
    );
    const maskedReference = normalizeApprovedLowSensitiveText(
      stableReference.maskedReference,
      policy.isApprovedMaskedReference,
    );
    const ownerUserId = inputValues.ownerUserId;
    const sourceCode = inputValues.sourceCode;
    const referenceSourceCode = stableReference.sourceCode;
    const primaryProjectId = inputValues.primaryProjectId;
    const requiredOwnerUserId = facts.requiredOwnerUserId;

    if (
      displayName === null ||
      maskedReference === null ||
      !isCanonicalSelectionCode(ownerUserId) ||
      !isCanonicalSelectionCode(sourceCode) ||
      !isCanonicalSelectionCode(referenceSourceCode) ||
      !isCanonicalSelectionCode(primaryProjectId) ||
      referenceSourceCode !== sourceCode ||
      !approvedMemberIds.has(ownerUserId) ||
      !approvedSourceCodes.has(sourceCode) ||
      (requiredOwnerUserId !== null &&
        (!isCanonicalSelectionCode(requiredOwnerUserId) ||
          requiredOwnerUserId !== ownerUserId))
    ) {
      return blocked();
    }

    const projectSelection = resolveCustomerProjectSelection(
      { selectedProjectIds, primaryProjectId },
      projectCatalog,
    );
    if (
      !projectSelection.ok ||
      projectSelection.value.projects.length === 0 ||
      projectSelection.value.primaryProject === null
    ) {
      return blocked();
    }

    return buildCandidate(
      displayName,
      maskedReference,
      projectSelection.value.projects,
      projectSelection.value.primaryProject.projectId,
    );
  } catch {
    return blocked();
  }
}
