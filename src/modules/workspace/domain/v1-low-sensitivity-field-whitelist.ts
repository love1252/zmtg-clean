export const defaultV1LowSensitivityForbiddenFieldFragments = [
  'phone',
  'mobile',
  'contact',
  'idCard',
  'identityCard',
  'medicalRecord',
  'diagnosis',
  'treatmentRaw',
  'consultationRaw',
  'hisConnection',
  'hisConnections',
  'hisRawPayload',
  'credential',
  'credentials',
  'token',
  'secret',
  'password',
  'DATABASE_URL',
  'DB_URL',
  'SQL',
  'stack',
  'tenantId',
  'customerId',
  'customerList',
  'realCustomerData',
  'modelApiKey',
  'prompt',
  'completion',
  'payment',
  'contract',
  'invoice',
  'allowedActions',
  'selectedAction',
  'executableAction',
  'actionToken',
  'mutationPayload',
  'createTask',
  'createAppointment',
  'createDeal',
  'autoMarketing',
  'autoTouch',
  '真实 HIS',
  '真实客户数据',
  '真实模型',
  '自动营销',
  '自动触达',
  '创建任务',
  '创建预约',
  '创建成交',
  '支付',
  '合同',
  '发票',
] as const;

export type V1LowSensitivityFieldWhitelistViolationKind =
  | 'unknown_field'
  | 'forbidden_field'
  | 'forbidden_value';

export type V1LowSensitivityFieldWhitelistViolation = {
  kind: V1LowSensitivityFieldWhitelistViolationKind;
  path: string;
  field?: string;
  fragment?: string;
};

export type V1LowSensitivityFieldWhitelistValidationOptions = {
  allowedFields: readonly string[];
  forbiddenFragments?: readonly string[];
  scanStringValues?: boolean;
};

export type V1LowSensitivityFieldWhitelistValidationResult = {
  valid: boolean;
  unknownFields: string[];
  forbiddenFields: string[];
  forbiddenValues: string[];
  violations: V1LowSensitivityFieldWhitelistViolation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldPath(parentPath: string, field: string): string {
  if (parentPath === '$') {
    return `$.${field}`;
  }

  return `${parentPath}.${field}`;
}

function arrayPath(parentPath: string, index: number): string {
  return `${parentPath}[${index}]`;
}

function includesFragment(value: string, fragment: string): boolean {
  return value.toLowerCase().includes(fragment.toLowerCase());
}

function findForbiddenFragment(
  value: string,
  forbiddenFragments: readonly string[],
): string | undefined {
  return forbiddenFragments.find((fragment) => includesFragment(value, fragment));
}

export function validateV1LowSensitivityFieldWhitelist(
  payload: unknown,
  options: V1LowSensitivityFieldWhitelistValidationOptions,
): V1LowSensitivityFieldWhitelistValidationResult {
  const allowedFields = new Set(options.allowedFields);
  const forbiddenFragments =
    options.forbiddenFragments ?? defaultV1LowSensitivityForbiddenFieldFragments;
  const scanStringValues = options.scanStringValues ?? true;
  const unknownFields: string[] = [];
  const forbiddenFields: string[] = [];
  const forbiddenValues: string[] = [];
  const violations: V1LowSensitivityFieldWhitelistViolation[] = [];

  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, arrayPath(path, index));
      });
      return;
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([field, fieldValue]) => {
        const currentPath = fieldPath(path, field);

        if (!allowedFields.has(field)) {
          unknownFields.push(currentPath);
          violations.push({
            kind: 'unknown_field',
            path: currentPath,
            field,
          });
        }

        const forbiddenFieldFragment = findForbiddenFragment(field, forbiddenFragments);

        if (forbiddenFieldFragment) {
          forbiddenFields.push(currentPath);
          violations.push({
            kind: 'forbidden_field',
            path: currentPath,
            field,
            fragment: forbiddenFieldFragment,
          });
        }

        visit(fieldValue, currentPath);
      });
      return;
    }

    if (scanStringValues && typeof value === 'string') {
      const forbiddenValueFragment = findForbiddenFragment(value, forbiddenFragments);

      if (forbiddenValueFragment) {
        forbiddenValues.push(path);
        violations.push({
          kind: 'forbidden_value',
          path,
          fragment: forbiddenValueFragment,
        });
      }
    }
  }

  visit(payload, '$');

  return {
    valid: violations.length === 0,
    unknownFields,
    forbiddenFields,
    forbiddenValues,
    violations,
  };
}
