import {
  mapCustomerOverviewV1,
  type CustomerOverviewOwnerV1,
  type CustomerOverviewProjectV1,
  type CustomerOverviewProjectionInput,
  type CustomerOverviewProjectionPolicy,
  type CustomerOverviewTagV1,
} from '@/modules/customer-center/domain/customer-overview';
import type {
  CustomerLifecycle,
  CustomerPriority,
} from '@/modules/customer-center/domain/customer-query';
import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';

/** Local customer-center list DTO; it is not a shared/public wire contract. */
export type CustomerListItemV1 = Readonly<{
  contractVersion: 'v1';
  customer: CustomerReferenceV1;
  lifecycle: CustomerLifecycle;
  priority: CustomerPriority;
  owner: CustomerOverviewOwnerV1 | null;
  primaryProject: CustomerOverviewProjectV1 | null;
  tags: CustomerOverviewTagV1[];
  lastTouchedAt: string;
  updatedAt: string;
}>;

export type CustomerListItemProjectionInput = CustomerOverviewProjectionInput &
  Readonly<{
    lastTouchedAt: unknown;
  }>;

const LIST_ITEM_INPUT_KEYS = Object.freeze([
  'customer',
  'lifecycle',
  'priority',
  'owner',
  'primaryProject',
  'projects',
  'tags',
  'lifecycleBasis',
  'lastTouchedAt',
  'updatedAt',
] as const);

const controlledTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/u;

function snapshotExactDataRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== LIST_ITEM_INPUT_KEYS.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      LIST_ITEM_INPUT_KEYS.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of LIST_ITEM_INPUT_KEYS) {
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

function normalizeTimestamp(value: unknown): string | null {
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

/**
 * Projects a fully local, low-sensitivity customer list item. Scope and authorization are never
 * accepted as input; callers must establish them before calling this pure mapper.
 */
export function mapCustomerListItemV1(
  input: unknown,
  policy: CustomerOverviewProjectionPolicy,
): CustomerListItemV1 | null {
  try {
    const snapshot = snapshotExactDataRecord(input);
    if (!snapshot) return null;

    const lastTouchedAt = normalizeTimestamp(snapshot.lastTouchedAt);
    if (!lastTouchedAt) return null;

    const overview = mapCustomerOverviewV1(
      {
        customer: snapshot.customer,
        lifecycle: snapshot.lifecycle,
        priority: snapshot.priority,
        owner: snapshot.owner,
        primaryProject: snapshot.primaryProject,
        projects: snapshot.projects,
        tags: snapshot.tags,
        lifecycleBasis: snapshot.lifecycleBasis,
        updatedAt: snapshot.updatedAt,
      },
      policy,
    );
    if (!overview) return null;

    return Object.freeze({
      contractVersion: 'v1',
      customer: Object.freeze({ ...overview.customer }),
      lifecycle: overview.lifecycle,
      priority: overview.priority,
      owner: overview.owner === null ? null : Object.freeze({ ...overview.owner }),
      primaryProject:
        overview.primaryProject === null
          ? null
          : Object.freeze({ ...overview.primaryProject }),
      tags: overview.tags.map((tag) => ({ ...tag })),
      lastTouchedAt,
      updatedAt: overview.updatedAt,
    });
  } catch {
    return null;
  }
}
