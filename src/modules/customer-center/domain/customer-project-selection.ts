import type { CustomerOverviewV1 } from '@/modules/customer-center/domain/customer-overview';
import { isLowSensitiveCustomerText } from '@/modules/customer-center/domain/customer-query';

export type CustomerProjectSelectionInput = {
  selectedProjectIds: readonly string[];
  primaryProjectId: string | null;
};

export type CustomerProjectCatalogEntry = {
  projectId: string;
  displayName: string;
};

export type CustomerProjectCatalog = ReadonlyMap<
  string,
  Readonly<CustomerProjectCatalogEntry>
>;

export type CustomerProjectSelection = Pick<
  CustomerOverviewV1,
  'projects' | 'primaryProject'
>;

export type CustomerProjectSelectionResult =
  | {
      ok: true;
      value: CustomerProjectSelection;
    }
  | {
      ok: false;
      code: 'invalid_customer_project_selection';
    };

const inputKeys = new Set<PropertyKey>(['selectedProjectIds', 'primaryProjectId']);
const normalizedProjectIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u;

function invalidSelection(): CustomerProjectSelectionResult {
  return {
    ok: false,
    code: 'invalid_customer_project_selection',
  };
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readExactInput(input: unknown): CustomerProjectSelectionInput | null {
  if (!isPlainRecord(input)) return null;

  const keys = Reflect.ownKeys(input);
  if (keys.length !== inputKeys.size || keys.some((key) => !inputKeys.has(key))) return null;

  const selectedProjectIdsDescriptor = Object.getOwnPropertyDescriptor(
    input,
    'selectedProjectIds',
  );
  const primaryProjectIdDescriptor = Object.getOwnPropertyDescriptor(input, 'primaryProjectId');
  if (
    !selectedProjectIdsDescriptor ||
    !('value' in selectedProjectIdsDescriptor) ||
    !primaryProjectIdDescriptor ||
    !('value' in primaryProjectIdDescriptor)
  ) {
    return null;
  }

  const selectedProjectIds = selectedProjectIdsDescriptor.value;
  const primaryProjectId = primaryProjectIdDescriptor.value;
  if (
    !Array.isArray(selectedProjectIds) ||
    (primaryProjectId !== null && typeof primaryProjectId !== 'string')
  ) {
    return null;
  }

  return {
    selectedProjectIds,
    primaryProjectId,
  };
}

function isCanonicalProjectId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    normalizedProjectIdPattern.test(value)
  );
}

function readCatalogProject(
  catalog: CustomerProjectCatalog,
  projectId: string,
): CustomerProjectCatalogEntry | null {
  const entry = catalog.get(projectId) as unknown;
  if (!isPlainRecord(entry)) return null;

  const catalogProjectId = entry.projectId;
  const displayName = entry.displayName;
  if (
    catalogProjectId !== projectId ||
    typeof displayName !== 'string' ||
    displayName.trim().length === 0 ||
    !isLowSensitiveCustomerText(displayName)
  ) {
    return null;
  }

  return {
    projectId,
    displayName: displayName.trim(),
  };
}

export function resolveCustomerProjectSelection(
  input: unknown,
  catalog: CustomerProjectCatalog,
): CustomerProjectSelectionResult {
  try {
    const parsed = readExactInput(input);
    if (!parsed) return invalidSelection();

    const seenProjectIds = new Set<string>();
    const projects: CustomerProjectCatalogEntry[] = [];

    for (const projectId of parsed.selectedProjectIds) {
      if (!isCanonicalProjectId(projectId) || seenProjectIds.has(projectId)) {
        return invalidSelection();
      }

      const project = readCatalogProject(catalog, projectId);
      if (!project) return invalidSelection();

      seenProjectIds.add(projectId);
      projects.push(project);
    }

    if (projects.length === 0) {
      return parsed.primaryProjectId === null
        ? {
            ok: true,
            value: {
              projects: [],
              primaryProject: null,
            },
          }
        : invalidSelection();
    }

    if (
      !isCanonicalProjectId(parsed.primaryProjectId) ||
      !seenProjectIds.has(parsed.primaryProjectId)
    ) {
      return invalidSelection();
    }

    const primaryProject = projects.find(
      (project) => project.projectId === parsed.primaryProjectId,
    );
    if (!primaryProject) return invalidSelection();

    return {
      ok: true,
      value: {
        projects,
        primaryProject: { ...primaryProject },
      },
    };
  } catch {
    return invalidSelection();
  }
}
