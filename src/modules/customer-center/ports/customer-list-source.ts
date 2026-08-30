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

export const CUSTOMER_LIST_GENDERS_V1 = Object.freeze([
  'female',
  'male',
] as const);

export const CUSTOMER_LIST_AGE_BANDS_V1 = Object.freeze([
  'under_20',
  '20_29',
  '30_39',
  '40_49',
  '50_59',
  '60_plus',
] as const);

export type CustomerListLifecycleV1 =
  (typeof CUSTOMER_LIST_LIFECYCLES_V1)[number];
export type CustomerListPriorityV1 =
  (typeof CUSTOMER_LIST_PRIORITIES_V1)[number];
export type CustomerListGenderV1 =
  (typeof CUSTOMER_LIST_GENDERS_V1)[number];
export type CustomerListAgeBandV1 =
  (typeof CUSTOMER_LIST_AGE_BANDS_V1)[number];

export type CustomerListSourceFilterV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  lifecycle: CustomerListLifecycleV1 | null;
  priority: CustomerListPriorityV1 | null;
  keyword: string | null;
  gender: CustomerListGenderV1 | null;
  ageBand: CustomerListAgeBandV1 | null;
  createdFrom: string | null;
  createdTo: string | null;
}>;

export type CustomerListSourceQueryV1 = CustomerListSourceFilterV1 & Readonly<{
  limit: number;
  offset: number;
}>;

export type CustomerListSourceCountQueryV1 = CustomerListSourceFilterV1;

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
  count: (query: CustomerListSourceCountQueryV1) => Promise<number>;
}>;
