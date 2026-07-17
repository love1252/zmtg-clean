import {
  CUSTOMER_LIFECYCLES,
  CUSTOMER_PRIORITIES,
  isLowSensitiveCustomerText,
  type CustomerLifecycle,
  type CustomerPriority,
} from '@/modules/customer-center/domain/customer-query';
import {
  mapCustomerReferenceV1,
  type CustomerReferenceProjectionInput,
  type CustomerReferenceProjectionPolicy,
} from '@/modules/customer-center/domain/customer-projections';
import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';

export type CustomerOverviewOwnerV1 = {
  userId: string;
  displayName: string;
};

export type CustomerOverviewProjectV1 = {
  projectId: string;
  displayName: string;
};

export type CustomerOverviewTagV1 = {
  tagCode: string;
  displayName: string;
};

export type CustomerOverviewLifecycleBasisV1 = {
  basisCode: string;
  sourceKind: string;
  sourceId: string;
  occurredAt: string;
};

export type CustomerOverviewV1 = {
  contractVersion: 'v1';
  customer: CustomerReferenceV1;
  lifecycle: CustomerLifecycle;
  priority: CustomerPriority;
  owner: CustomerOverviewOwnerV1 | null;
  primaryProject: CustomerOverviewProjectV1 | null;
  projects: CustomerOverviewProjectV1[];
  tags: CustomerOverviewTagV1[];
  lifecycleBasis: CustomerOverviewLifecycleBasisV1 | null;
  updatedAt: string;
};

export type CustomerOverviewProjectionInput = {
  customer: CustomerReferenceProjectionInput;
  lifecycle: unknown;
  priority: unknown;
  owner: unknown;
  primaryProject: unknown;
  projects: unknown;
  tags: unknown;
  lifecycleBasis: unknown;
  updatedAt: unknown;
};

export type CustomerOverviewProjectionPolicy = {
  allowedLifecycleBasisCodes: ReadonlySet<string>;
  allowedLifecycleBasisSourceKinds: ReadonlySet<string>;
  isTrustedCustomerId: (customerId: string) => boolean;
  isApprovedDisplayName: (displayName: string) => boolean;
  isApprovedMaskedReference: (maskedReference: string) => boolean;
  isApprovedOwner: (userId: string, displayName: string) => boolean;
  isApprovedProject: (projectId: string, displayName: string) => boolean;
  isApprovedTag: (tagCode: string, displayName: string) => boolean;
  isTrustedLifecycleBasisSourceId: (sourceId: string) => boolean;
};

const normalizedIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u;
const controlledTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/u;
const OVERVIEW_INPUT_KEYS = Object.freeze([
  'customer',
  'lifecycle',
  'priority',
  'owner',
  'primaryProject',
  'projects',
  'tags',
  'lifecycleBasis',
  'updatedAt',
] as const);
const OWNER_KEYS = Object.freeze(['userId', 'displayName'] as const);
const PROJECT_KEYS = Object.freeze(['projectId', 'displayName'] as const);
const TAG_KEYS = Object.freeze(['tagCode', 'displayName'] as const);
const LIFECYCLE_BASIS_KEYS = Object.freeze([
  'basisCode',
  'sourceKind',
  'sourceId',
  'occurredAt',
] as const);
const OVERVIEW_POLICY_KEYS = Object.freeze([
  'allowedLifecycleBasisCodes',
  'allowedLifecycleBasisSourceKinds',
  'isTrustedCustomerId',
  'isApprovedDisplayName',
  'isApprovedMaskedReference',
  'isApprovedOwner',
  'isApprovedProject',
  'isApprovedTag',
  'isTrustedLifecycleBasisSourceId',
] as const);

type CustomerOverviewPolicySnapshot = CustomerReferenceProjectionPolicy & {
  isApprovedOwner: (userId: string, displayName: string) => boolean;
  isApprovedProject: (projectId: string, displayName: string) => boolean;
  isApprovedTag: (tagCode: string, displayName: string) => boolean;
  isTrustedLifecycleBasisSourceId: (sourceId: string) => boolean;
  isAllowedLifecycleBasisCode: (basisCode: string) => boolean;
  isAllowedLifecycleBasisSourceKind: (sourceKind: string) => boolean;
};

function snapshotRequiredDataFields(
  value: unknown,
  requiredKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of requiredKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotArrayDataItems(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value;
    if (
      !lengthDescriptor ||
      !('value' in lengthDescriptor) ||
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0
    ) {
      return null;
    }

    const items: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      items.push(descriptor.value);
    }
    return Object.freeze(items);
  } catch {
    return null;
  }
}

function snapshotSetMembership(
  value: unknown,
): ((candidate: string) => boolean) | null {
  try {
    if (
      value === null ||
      (typeof value !== 'object' && typeof value !== 'function')
    ) {
      return null;
    }
    const has = Reflect.get(value, 'has');
    if (typeof has !== 'function') return null;
    return (candidate: string) => Reflect.apply(has, value, [candidate]) === true;
  } catch {
    return null;
  }
}

function snapshotOverviewPolicy(
  value: unknown,
): CustomerOverviewPolicySnapshot | null {
  const snapshot = snapshotRequiredDataFields(value, OVERVIEW_POLICY_KEYS);
  if (!snapshot) return null;

  const isTrustedCustomerId = snapshot.isTrustedCustomerId;
  const isApprovedDisplayName = snapshot.isApprovedDisplayName;
  const isApprovedMaskedReference = snapshot.isApprovedMaskedReference;
  const isApprovedOwner = snapshot.isApprovedOwner;
  const isApprovedProject = snapshot.isApprovedProject;
  const isApprovedTag = snapshot.isApprovedTag;
  const isTrustedLifecycleBasisSourceId = snapshot.isTrustedLifecycleBasisSourceId;
  const isAllowedLifecycleBasisCode = snapshotSetMembership(
    snapshot.allowedLifecycleBasisCodes,
  );
  const isAllowedLifecycleBasisSourceKind = snapshotSetMembership(
    snapshot.allowedLifecycleBasisSourceKinds,
  );

  if (
    typeof isTrustedCustomerId !== 'function' ||
    typeof isApprovedDisplayName !== 'function' ||
    typeof isApprovedMaskedReference !== 'function' ||
    typeof isApprovedOwner !== 'function' ||
    typeof isApprovedProject !== 'function' ||
    typeof isApprovedTag !== 'function' ||
    typeof isTrustedLifecycleBasisSourceId !== 'function' ||
    !isAllowedLifecycleBasisCode ||
    !isAllowedLifecycleBasisSourceKind
  ) {
    return null;
  }

  return Object.freeze({
    isTrustedCustomerId: isTrustedCustomerId as (customerId: string) => boolean,
    isApprovedDisplayName: isApprovedDisplayName as (displayName: string) => boolean,
    isApprovedMaskedReference: isApprovedMaskedReference as (
      maskedReference: string,
    ) => boolean,
    isApprovedOwner: isApprovedOwner as (
      userId: string,
      displayName: string,
    ) => boolean,
    isApprovedProject: isApprovedProject as (
      projectId: string,
      displayName: string,
    ) => boolean,
    isApprovedTag: isApprovedTag as (
      tagCode: string,
      displayName: string,
    ) => boolean,
    isTrustedLifecycleBasisSourceId: isTrustedLifecycleBasisSourceId as (
      sourceId: string,
    ) => boolean,
    isAllowedLifecycleBasisCode,
    isAllowedLifecycleBasisSourceKind,
  });
}

function isOneOf<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
): value is TValues[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function normalizeIdentifier(value: unknown) {
  if (typeof value !== 'string') return null;
  return value === value.trim() && normalizedIdentifierPattern.test(value) ? value : null;
}

function normalizeDisplayName(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = controlledTimestampPattern.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > daysInMonth ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function passesPolicyCheck<TArgs extends readonly unknown[]>(
  check: (...args: TArgs) => boolean,
  ...args: TArgs
) {
  try {
    return check(...args) === true;
  } catch {
    return false;
  }
}

function normalizeOwner(
  input: unknown,
  policy: CustomerOverviewPolicySnapshot,
) {
  if (input === null) return null;
  const owner = snapshotRequiredDataFields(input, OWNER_KEYS);
  if (!owner) return null;

  const userId = normalizeIdentifier(owner.userId);
  const displayName = normalizeDisplayName(owner.displayName);
  return userId &&
    displayName &&
    isLowSensitiveCustomerText(displayName) &&
    passesPolicyCheck(policy.isApprovedOwner, userId, displayName)
    ? { userId, displayName }
    : null;
}

function normalizeProject(
  input: unknown,
  policy: CustomerOverviewPolicySnapshot,
) {
  const project = snapshotRequiredDataFields(input, PROJECT_KEYS);
  if (!project) return null;
  const projectId = normalizeIdentifier(project.projectId);
  const displayName = normalizeDisplayName(project.displayName);
  return projectId &&
    displayName &&
    isLowSensitiveCustomerText(displayName) &&
    passesPolicyCheck(policy.isApprovedProject, projectId, displayName)
    ? { projectId, displayName }
    : null;
}

function normalizeProjects(
  inputs: readonly unknown[],
  policy: CustomerOverviewPolicySnapshot,
) {
  const projectIds = new Set<string>();
  const projects: CustomerOverviewProjectV1[] = [];

  for (const input of inputs) {
    const project = normalizeProject(input, policy);
    if (!project || projectIds.has(project.projectId)) continue;
    projectIds.add(project.projectId);
    projects.push(project);
  }

  return projects;
}

function normalizeTags(
  inputs: readonly unknown[],
  policy: CustomerOverviewPolicySnapshot,
) {
  const tagCodes = new Set<string>();
  const tags: CustomerOverviewTagV1[] = [];

  for (const input of inputs) {
    const tag = snapshotRequiredDataFields(input, TAG_KEYS);
    if (!tag) continue;
    const tagCode = normalizeIdentifier(tag.tagCode);
    const displayName = normalizeDisplayName(tag.displayName);
    if (
      !tagCode ||
      !displayName ||
      !isLowSensitiveCustomerText(displayName) ||
      !passesPolicyCheck(policy.isApprovedTag, tagCode, displayName) ||
      tagCodes.has(tagCode)
    ) {
      continue;
    }
    tagCodes.add(tagCode);
    tags.push({ tagCode, displayName });
  }

  return tags;
}

function normalizeLifecycleBasis(
  input: unknown,
  policy: CustomerOverviewPolicySnapshot,
) {
  if (input === null) return null;
  const basis = snapshotRequiredDataFields(input, LIFECYCLE_BASIS_KEYS);
  if (!basis) return null;
  const basisCode = basis.basisCode;
  const sourceKind = basis.sourceKind;
  if (
    typeof basisCode !== 'string' ||
    typeof sourceKind !== 'string' ||
    !passesPolicyCheck(policy.isAllowedLifecycleBasisCode, basisCode) ||
    !passesPolicyCheck(policy.isAllowedLifecycleBasisSourceKind, sourceKind)
  ) {
    return null;
  }

  const sourceId = normalizeIdentifier(basis.sourceId);
  const occurredAt = normalizeTimestamp(basis.occurredAt);
  if (
    !sourceId ||
    !occurredAt ||
    !passesPolicyCheck(policy.isTrustedLifecycleBasisSourceId, sourceId)
  ) {
    return null;
  }

  return {
    basisCode,
    sourceKind,
    sourceId,
    occurredAt,
  };
}

export function mapCustomerOverviewV1(
  input: unknown,
  policy: CustomerOverviewProjectionPolicy,
): CustomerOverviewV1 | null {
  try {
    const source = snapshotRequiredDataFields(input, OVERVIEW_INPUT_KEYS);
    const policySnapshot = snapshotOverviewPolicy(policy);
    if (!source || !policySnapshot) return null;

    const customerInput = source.customer;
    const lifecycle = source.lifecycle;
    const priority = source.priority;
    const ownerInput = source.owner;
    const primaryProjectInput = source.primaryProject;
    const projectsInput = snapshotArrayDataItems(source.projects);
    const tagsInput = snapshotArrayDataItems(source.tags);
    const lifecycleBasisInput = source.lifecycleBasis;
    const updatedAtInput = source.updatedAt;

    const customer = mapCustomerReferenceV1(customerInput, policySnapshot);
    const updatedAt = normalizeTimestamp(updatedAtInput);
    if (
      !customer ||
      !updatedAt ||
      !isOneOf(lifecycle, CUSTOMER_LIFECYCLES) ||
      !isOneOf(priority, CUSTOMER_PRIORITIES) ||
      !projectsInput ||
      !tagsInput
    ) {
      return null;
    }

    const projects = normalizeProjects(projectsInput, policySnapshot);
    let primaryProject: CustomerOverviewProjectV1 | null = null;
    if (primaryProjectInput !== null) {
      const normalizedPrimaryProject = normalizeProject(
        primaryProjectInput,
        policySnapshot,
      );
      if (!normalizedPrimaryProject) return null;

      const matchedPrimaryProject = projects.find(
        (project) =>
          project.projectId === normalizedPrimaryProject.projectId &&
          project.displayName === normalizedPrimaryProject.displayName,
      );
      if (!matchedPrimaryProject) return null;
      primaryProject = matchedPrimaryProject;
    }

    return {
      contractVersion: 'v1',
      customer,
      lifecycle,
      priority,
      owner: normalizeOwner(ownerInput, policySnapshot),
      primaryProject: primaryProject ? { ...primaryProject } : null,
      projects,
      tags: normalizeTags(tagsInput, policySnapshot),
      lifecycleBasis: normalizeLifecycleBasis(lifecycleBasisInput, policySnapshot),
      updatedAt,
    };
  } catch {
    return null;
  }
}

/** The first list slice intentionally reuses the same minimum whitelist as the overview DTO. */
export type CustomerListItemV1 = {
  contractVersion: 'v1';
  customer: CustomerReferenceV1;
  lifecycle: CustomerLifecycle;
  priority: CustomerPriority;
  owner: CustomerOverviewOwnerV1 | null;
  primaryProject: CustomerOverviewProjectV1 | null;
  projects: CustomerOverviewProjectV1[];
  tags: CustomerOverviewTagV1[];
  lifecycleBasis: CustomerOverviewLifecycleBasisV1 | null;
  updatedAt: string;
};

export function mapCustomerListItemV1(
  input: unknown,
  policy: CustomerOverviewProjectionPolicy,
): CustomerListItemV1 | null {
  return mapCustomerOverviewV1(input, policy);
}
