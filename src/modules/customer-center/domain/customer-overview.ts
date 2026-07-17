import {
  CUSTOMER_LIFECYCLES,
  CUSTOMER_PRIORITIES,
  isLowSensitiveCustomerText,
  type CustomerLifecycle,
  type CustomerPriority,
} from '@/modules/customer-center/domain/customer-query';

export type CustomerOverviewCustomerV1 = {
  customerId: string;
  displayName: string;
  maskedReference: string | null;
};

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
  customer: CustomerOverviewCustomerV1;
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
  customer: CustomerOverviewCustomerV1;
  lifecycle: string;
  priority: string;
  owner: CustomerOverviewOwnerV1 | null;
  primaryProject: CustomerOverviewProjectV1 | null;
  projects: readonly CustomerOverviewProjectV1[];
  tags: readonly CustomerOverviewTagV1[];
  lifecycleBasis: CustomerOverviewLifecycleBasisV1 | null;
  updatedAt: string;
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

function isOneOf<const TValues extends readonly string[]>(
  value: string,
  values: TValues,
): value is TValues[number] {
  return (values as readonly string[]).includes(value);
}

function normalizeIdentifier(value: string) {
  return value === value.trim() && normalizedIdentifierPattern.test(value) ? value : null;
}

function normalizeDisplayName(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value: string) {
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

function normalizeCustomer(
  input: CustomerOverviewCustomerV1,
  policy: CustomerOverviewProjectionPolicy,
): CustomerOverviewCustomerV1 | null {
  const customerId = normalizeIdentifier(input.customerId);
  const displayName = normalizeDisplayName(input.displayName);
  const maskedReference =
    input.maskedReference === null ? null : normalizeDisplayName(input.maskedReference);

  if (
    !customerId ||
    !displayName ||
    !isLowSensitiveCustomerText(displayName) ||
    !passesPolicyCheck(policy.isTrustedCustomerId, customerId) ||
    !passesPolicyCheck(policy.isApprovedDisplayName, displayName) ||
    (input.maskedReference !== null &&
      (!maskedReference ||
        !isLowSensitiveCustomerText(maskedReference) ||
        !passesPolicyCheck(policy.isApprovedMaskedReference, maskedReference)))
  ) {
    return null;
  }

  return { customerId, displayName, maskedReference };
}

function normalizeOwner(
  input: CustomerOverviewOwnerV1 | null,
  policy: CustomerOverviewProjectionPolicy,
) {
  if (input === null) return null;

  const userId = normalizeIdentifier(input.userId);
  const displayName = normalizeDisplayName(input.displayName);
  return userId &&
    displayName &&
    isLowSensitiveCustomerText(displayName) &&
    passesPolicyCheck(policy.isApprovedOwner, userId, displayName)
    ? { userId, displayName }
    : null;
}

function normalizeProject(
  input: CustomerOverviewProjectV1,
  policy: CustomerOverviewProjectionPolicy,
) {
  const projectId = normalizeIdentifier(input.projectId);
  const displayName = normalizeDisplayName(input.displayName);
  return projectId &&
    displayName &&
    isLowSensitiveCustomerText(displayName) &&
    passesPolicyCheck(policy.isApprovedProject, projectId, displayName)
    ? { projectId, displayName }
    : null;
}

function normalizeProjects(
  inputs: readonly CustomerOverviewProjectV1[],
  policy: CustomerOverviewProjectionPolicy,
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
  inputs: readonly CustomerOverviewTagV1[],
  policy: CustomerOverviewProjectionPolicy,
) {
  const tagCodes = new Set<string>();
  const tags: CustomerOverviewTagV1[] = [];

  for (const input of inputs) {
    const tagCode = normalizeIdentifier(input.tagCode);
    const displayName = normalizeDisplayName(input.displayName);
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
  input: CustomerOverviewLifecycleBasisV1 | null,
  policy: CustomerOverviewProjectionPolicy,
) {
  if (input === null) return null;
  if (
    !policy.allowedLifecycleBasisCodes.has(input.basisCode) ||
    !policy.allowedLifecycleBasisSourceKinds.has(input.sourceKind)
  ) {
    return null;
  }

  const sourceId = normalizeIdentifier(input.sourceId);
  const occurredAt = normalizeTimestamp(input.occurredAt);
  if (
    !sourceId ||
    !occurredAt ||
    !passesPolicyCheck(policy.isTrustedLifecycleBasisSourceId, sourceId)
  ) {
    return null;
  }

  return {
    basisCode: input.basisCode,
    sourceKind: input.sourceKind,
    sourceId,
    occurredAt,
  };
}

export function mapCustomerOverviewV1(
  input: CustomerOverviewProjectionInput,
  policy: CustomerOverviewProjectionPolicy,
): CustomerOverviewV1 | null {
  const customer = normalizeCustomer(input.customer, policy);
  const updatedAt = normalizeTimestamp(input.updatedAt);
  if (
    !customer ||
    !updatedAt ||
    !isOneOf(input.lifecycle, CUSTOMER_LIFECYCLES) ||
    !isOneOf(input.priority, CUSTOMER_PRIORITIES) ||
    !Array.isArray(input.projects) ||
    !Array.isArray(input.tags)
  ) {
    return null;
  }

  const projects = normalizeProjects(input.projects, policy);
  const normalizedPrimaryProject =
    input.primaryProject === null ? null : normalizeProject(input.primaryProject, policy);
  const primaryProject = normalizedPrimaryProject
    ? projects.find(
        (project) =>
          project.projectId === normalizedPrimaryProject.projectId &&
          project.displayName === normalizedPrimaryProject.displayName,
      ) ?? null
    : null;

  return {
    contractVersion: 'v1',
    customer,
    lifecycle: input.lifecycle,
    priority: input.priority,
    owner: normalizeOwner(input.owner, policy),
    primaryProject: primaryProject ? { ...primaryProject } : null,
    projects,
    tags: normalizeTags(input.tags, policy),
    lifecycleBasis: normalizeLifecycleBasis(input.lifecycleBasis, policy),
    updatedAt,
  };
}
