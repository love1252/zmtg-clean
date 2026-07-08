export type LowSensitiveOutputViolationKind =
  | 'sensitive_key'
  | 'phone_number'
  | 'id_card_number'
  | 'database_url'
  | 'api_key_like_value'
  | 'raw_payload_marker';

export type LowSensitiveOutputViolation = {
  path: string;
  kind: LowSensitiveOutputViolationKind;
  marker: string;
};

export type LowSensitiveOutputCheckResult = {
  safe: boolean;
  violations: LowSensitiveOutputViolation[];
};

const sensitiveKeyMarkers = [
  'phone',
  'phonenumber',
  'mobile',
  'mobilephone',
  'mobilenumber',
  'idcard',
  'idnumber',
  'idcardnumber',
  'identitycardnumber',
  'identitynumber',
  'medicalrecordno',
  'medicalrecordnumber',
  'birthday',
  'birthdate',
  'fullbirthday',
  'fulladdress',
  'detailedaddress',
  'address',
  'chatrecord',
  'chathistory',
  'chattranscript',
  'conversation',
  'secret',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'databaseurl',
  'rawpayload',
  'hispayload',
  'externaluserid',
  'externaluserid',
  'wecomuserid',
  'realuserid',
  'userid',
  'corpid',
] as const;

const phonePattern = /(?<!\d)1[3-9]\d{9}(?!\d)/;
const idCardPattern = /(?<![0-9A-Za-z])\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx](?![0-9A-Za-z])/;
const databaseUrlPattern = /(?:postgres(?:ql)?:\/\/|mysql:\/\/|DATABASE_URL\s*=)/i;
const apiKeyLikePattern = /(?:sk_(?:live|test)_[0-9A-Za-z_\-]{8,}|zmtg_sk_[0-9A-Za-z_\-]{4,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=])/i;
const rawPayloadPattern = /(?:raw\s*payload|his\s*payload|access_token|refresh_token|corpId|external_userid)/i;

function normalizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function pathFor(parent: string, key: string | number) {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function checkKey(key: string, path: string, violations: LowSensitiveOutputViolation[]) {
  const normalized = normalizeKey(key);
  const marker = sensitiveKeyMarkers.find((candidate) => normalized === candidate);
  if (marker) {
    violations.push({ path, kind: 'sensitive_key', marker });
  }
}

function checkString(value: string, path: string, violations: LowSensitiveOutputViolation[]) {
  if (phonePattern.test(value)) {
    violations.push({ path, kind: 'phone_number', marker: 'phone_number' });
  }
  if (idCardPattern.test(value)) {
    violations.push({ path, kind: 'id_card_number', marker: 'id_card_number' });
  }
  if (databaseUrlPattern.test(value)) {
    violations.push({ path, kind: 'database_url', marker: 'database_url' });
  }
  if (apiKeyLikePattern.test(value)) {
    violations.push({ path, kind: 'api_key_like_value', marker: 'api_key_like_value' });
  }
  if (rawPayloadPattern.test(value)) {
    violations.push({ path, kind: 'raw_payload_marker', marker: 'raw_payload_marker' });
  }
}

function visit(value: unknown, path: string, violations: LowSensitiveOutputViolation[]) {
  if (typeof value === 'string') {
    checkString(value, path, violations);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, pathFor(path, index), violations));
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = pathFor(path, key);
    checkKey(key, childPath, violations);
    visit(child, childPath, violations);
  }
}

export function checkLowSensitiveOutput(value: unknown): LowSensitiveOutputCheckResult {
  const violations: LowSensitiveOutputViolation[] = [];
  visit(value, '$', violations);

  return {
    safe: violations.length === 0,
    violations,
  };
}

export function assertLowSensitiveOutput(value: unknown) {
  const result = checkLowSensitiveOutput(value);
  if (!result.safe) {
    throw new Error(
      `低敏输出检查失败：${result.violations
        .map((violation) => `${violation.path}:${violation.marker}`)
        .join(', ')}`,
    );
  }
}
