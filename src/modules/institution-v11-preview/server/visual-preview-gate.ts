export function isInstitutionV11VisualPreviewEnabled(
  runtime = process.env.NODE_ENV,
) {
  return runtime === 'development' || runtime === 'test';
}

export function isInstitutionV11HospitalSyncEnabled(
  runtime = process.env.NODE_ENV,
) {
  return runtime === 'development';
}

export type InstitutionV11HospitalEntryMode =
  | 'approved'
  | 'login'
  | 'legacy';

export function resolveInstitutionV11HospitalEntryMode(input: Readonly<{
  syncEnabled: boolean;
  genuineAllowed: boolean;
}>): InstitutionV11HospitalEntryMode {
  if (!input.syncEnabled) return 'legacy';
  return input.genuineAllowed ? 'approved' : 'login';
}
