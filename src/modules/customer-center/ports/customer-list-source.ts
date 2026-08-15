export const CUSTOMER_LIST_LIFECYCLES_V1 = Object.freeze([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
] as const);

export const CUSTOMER_LIST_PRIORITIES_V1 = Object.freeze([
  'high',
  'medium',
  'observe',
] as const);

export type CustomerListLifecycleV1 =
  (typeof CUSTOMER_LIST_LIFECYCLES_V1)[number];
export type CustomerListPriorityV1 =
  (typeof CUSTOMER_LIST_PRIORITIES_V1)[number];

export type CustomerListSourceQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  lifecycle: CustomerListLifecycleV1 | null;
  priority: CustomerListPriorityV1 | null;
  limit: number;
  offset: number;
}>;

export type CustomerListSourceRowV1 = Readonly<{
  customerId: string;
  displayName: string;
  lifecycle: CustomerListLifecycleV1;
  priority: CustomerListPriorityV1;
  updatedAt: string;
  tenantId: string;
  institutionId: string;
}>;

export type CustomerListSourceV1 = Readonly<{
  list: (
    query: CustomerListSourceQueryV1,
  ) => Promise<readonly CustomerListSourceRowV1[]>;
}>;
