export const INSTITUTION_OBJECT_TYPES_V1 = Object.freeze([
  'customer',
  'care_task',
  'conversation',
  'knowledge_item',
] as const);

export type InstitutionObjectTypeV1 =
  (typeof INSTITUTION_OBJECT_TYPES_V1)[number];

export const INSTITUTION_OBJECT_ACTIONS_V1 = Object.freeze([
  'read',
  'update',
  'delete',
  'approve',
] as const);

export type InstitutionObjectActionV1 =
  (typeof INSTITUTION_OBJECT_ACTIONS_V1)[number];

export type AuthoritativeInstitutionObjectFactQueryV1 = Readonly<{
  objectType: InstitutionObjectTypeV1;
  objectId: string;
  tenantId: string;
  institutionId: string;
}>;

export type AuthoritativeInstitutionObjectFactV1 = Readonly<{
  kind: 'current_object_fact';
  objectType: InstitutionObjectTypeV1;
  objectId: string;
  tenantId: string;
  institutionId: string;
  status: 'active' | 'inactive';
  revision: number;
  observedAt: string;
}>;

export type AuthoritativeInstitutionObjectFactRejectionCodeV1 =
  | 'object_denied'
  | 'object_invalid'
  | 'object_unavailable';

export type AuthoritativeInstitutionObjectFactResolutionV1 =
  | AuthoritativeInstitutionObjectFactV1
  | Readonly<{
      kind: 'rejected';
      code: AuthoritativeInstitutionObjectFactRejectionCodeV1;
    }>;

export type InstitutionObjectFactReaderV1 = Readonly<{
  resolve: (
    input: AuthoritativeInstitutionObjectFactQueryV1,
  ) => Promise<AuthoritativeInstitutionObjectFactResolutionV1>;
}>;

export function isInstitutionObjectTypeV1(
  value: unknown,
): value is InstitutionObjectTypeV1 {
  return INSTITUTION_OBJECT_TYPES_V1.some((item) => item === value);
}

export function isInstitutionObjectActionV1(
  value: unknown,
): value is InstitutionObjectActionV1 {
  return INSTITUTION_OBJECT_ACTIONS_V1.some((item) => item === value);
}
