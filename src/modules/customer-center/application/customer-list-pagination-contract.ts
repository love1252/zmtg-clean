export const CUSTOMER_LIST_PAGE_SIZE_V1 = 20;
export const CUSTOMER_LIST_PAGE_SIZES_V1 = Object.freeze([
  10,
  20,
  50,
  100,
] as const);
export type CustomerListPageSizeV1 =
  (typeof CUSTOMER_LIST_PAGE_SIZES_V1)[number];
export const CUSTOMER_LIST_MAX_PAGE_V1 = 100;
export const CUSTOMER_LIST_MAX_OFFSET_V1 = 9900;
