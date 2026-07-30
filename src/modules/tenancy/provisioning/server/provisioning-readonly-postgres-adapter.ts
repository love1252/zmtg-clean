import type postgres from 'postgres';
import type {
  ProvisioningContextHeadRowV1,
  ProvisioningContextVersionRowV1,
  ProvisioningRepositoryV1,
  ProvisioningScopeRowV1,
  ProvisioningTransactionPortV1,
  ProvisioningTripletSnapshotV1,
} from '../provisioning-ports';

export const PROVISIONING_READONLY_TRANSACTION_OPTIONS =
  'isolation level repeatable read read only' as const;
export const PROVISIONING_READONLY_STATEMENT_TIMEOUT_MS = 5_000;
export const PROVISIONING_READONLY_LOCK_TIMEOUT_MS = 1_000;
export const PROVISIONING_READONLY_IDLE_TIMEOUT_MS = 5_000;

export type ProvisioningReadonlyPostgresErrorCode =
  | 'provisioning_readonly_connection_unavailable'
  | 'provisioning_readonly_transaction_unavailable'
  | 'provisioning_readonly_transaction_not_read_only'
  | 'provisioning_readonly_query_failed'
  | 'provisioning_readonly_row_shape_invalid'
  | 'provisioning_readonly_enum_invalid'
  | 'provisioning_readonly_time_invalid'
  | 'provisioning_readonly_write_forbidden'
  | 'provisioning_readonly_timeout';

export class ProvisioningReadonlyPostgresError extends Error {
  constructor(readonly code: ProvisioningReadonlyPostgresErrorCode) {
    super(code);
    this.name = 'ProvisioningReadonlyPostgresError';
  }
}

type ProvisioningPostgresClient = Pick<postgres.Sql, 'begin'>;
type ProvisioningPostgresTransaction = postgres.TransactionSql;
type UnknownRow = Record<string, unknown>;

const TIMEOUT_CODES = new Set([
  '25P03',
  '25P04',
  '55P03',
  '57014',
  'CONNECT_TIMEOUT',
  'ETIMEDOUT',
  'ETIMEOUT',
]);
const CONNECTION_CODES = new Set([
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATABASE_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.(\d{6})Z$/;

function fail(code: ProvisioningReadonlyPostgresErrorCode): never {
  throw new ProvisioningReadonlyPostgresError(code);
}

function errorCode(value: unknown): string | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const code = Reflect.get(value, 'code');
  return typeof code === 'string' ? code : null;
}

function mapDatabaseError(
  value: unknown,
  fallback: ProvisioningReadonlyPostgresErrorCode,
): ProvisioningReadonlyPostgresError {
  if (value instanceof ProvisioningReadonlyPostgresError) {
    return value;
  }
  const code = errorCode(value);
  if (code && TIMEOUT_CODES.has(code)) {
    return new ProvisioningReadonlyPostgresError(
      'provisioning_readonly_timeout',
    );
  }
  if (code && CONNECTION_CODES.has(code)) {
    return new ProvisioningReadonlyPostgresError(
      'provisioning_readonly_connection_unavailable',
    );
  }
  return new ProvisioningReadonlyPostgresError(fallback);
}

async function runQuery<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapDatabaseError(error, 'provisioning_readonly_query_failed');
  }
}

function isRecord(value: unknown): value is UnknownRow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRows(value: unknown): readonly UnknownRow[] {
  if (!Array.isArray(value) || value.some((row) => !isRecord(row))) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return value;
}

function requireExactKeys(
  row: UnknownRow,
  expected: readonly string[],
): void {
  const actual = Object.keys(row).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    fail('provisioning_readonly_row_shape_invalid');
  }
}

function requireIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return value;
}

function requireReference(value: unknown, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.normalize('NFC') !== value
  ) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return value;
}

function requirePositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return value as number;
}

function requireCanonicalInstant(value: unknown): string {
  if (typeof value !== 'string') {
    fail('provisioning_readonly_time_invalid');
  }
  const match = DATABASE_INSTANT_PATTERN.exec(value);
  if (!match || match[1].slice(3) !== '000') {
    fail('provisioning_readonly_time_invalid');
  }
  const canonical = `${value.slice(0, 23)}Z`;
  if (
    Number.isNaN(Date.parse(canonical)) ||
    new Date(canonical).toISOString() !== canonical
  ) {
    fail('provisioning_readonly_time_invalid');
  }
  return canonical;
}

function requireBusinessDate(value: unknown): string {
  if (typeof value !== 'string' || !BUSINESS_DATE_PATTERN.test(value)) {
    fail('provisioning_readonly_time_invalid');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    fail('provisioning_readonly_time_invalid');
  }
  return value;
}

function requireNullableReference(
  value: unknown,
  maxLength: number,
): string | null {
  return value === null ? null : requireReference(value, maxLength);
}

function mapScopeRow(row: UnknownRow): ProvisioningScopeRowV1 {
  requireExactKeys(row, [
    'approvedAt',
    'approvedBy',
    'institutionId',
    'provisioningReferenceDigest',
    'provisioningSource',
    'revision',
    'status',
    'tenantId',
  ]);
  if (row.status !== 'active' && row.status !== 'suspended') {
    fail('provisioning_readonly_enum_invalid');
  }
  // Schema 预留的 formal_onboarding 属于未来正式 Runtime；当前
  // ProvisioningScopeRowV1 与 A2-P1 契约只允许已审批 Migration Manifest。
  if (row.provisioningSource !== 'approved_migration_manifest') {
    fail('provisioning_readonly_enum_invalid');
  }
  if (
    typeof row.provisioningReferenceDigest !== 'string' ||
    !DIGEST_PATTERN.test(row.provisioningReferenceDigest)
  ) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return Object.freeze({
    tenantId: requireIdentifier(row.tenantId),
    institutionId: requireIdentifier(row.institutionId),
    status: row.status,
    revision: requirePositiveInteger(row.revision),
    provisioningSource: row.provisioningSource,
    provisioningReferenceDigest: row.provisioningReferenceDigest,
    approvedBy: requireReference(row.approvedBy, 96),
    approvedAt: requireCanonicalInstant(row.approvedAt),
  });
}

function mapContextVersionRow(
  row: UnknownRow,
): ProvisioningContextVersionRowV1 {
  requireExactKeys(row, [
    'createdBy',
    'currency',
    'effectiveAt',
    'effectiveFromBusinessDate',
    'institutionId',
    'migrationProvenance',
    'source',
    'tenantId',
    'timezone',
    'version',
  ]);
  if (
    row.source !== 'institution_config' &&
    row.source !== 'product_default'
  ) {
    fail('provisioning_readonly_enum_invalid');
  }
  if (
    typeof row.timezone !== 'string' ||
    row.timezone.length === 0 ||
    row.timezone.length > 64 ||
    typeof row.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(row.currency)
  ) {
    fail('provisioning_readonly_row_shape_invalid');
  }
  return Object.freeze({
    tenantId: requireIdentifier(row.tenantId),
    institutionId: requireIdentifier(row.institutionId),
    version: requirePositiveInteger(row.version),
    timezone: row.timezone,
    currency: row.currency,
    effectiveFromBusinessDate: requireBusinessDate(
      row.effectiveFromBusinessDate,
    ),
    effectiveAt: requireCanonicalInstant(row.effectiveAt),
    source: row.source,
    migrationProvenance: requireNullableReference(
      row.migrationProvenance,
      128,
    ),
    createdBy: requireReference(row.createdBy, 96),
  });
}

function mapContextHeadRow(
  row: UnknownRow,
): ProvisioningContextHeadRowV1 {
  requireExactKeys(row, [
    'institutionId',
    'latestVersion',
    'revision',
    'tenantId',
    'updatedBy',
  ]);
  return Object.freeze({
    tenantId: requireIdentifier(row.tenantId),
    institutionId: requireIdentifier(row.institutionId),
    revision: requirePositiveInteger(row.revision),
    latestVersion: requirePositiveInteger(row.latestVersion),
    updatedBy: requireReference(row.updatedBy, 96),
  });
}

function createReadonlyRepository(
  transaction: ProvisioningPostgresTransaction,
  isTransactionActive: () => boolean,
): ProvisioningRepositoryV1 {
  const assertTransactionActive = (): void => {
    if (!isTransactionActive()) {
      fail('provisioning_readonly_transaction_unavailable');
    }
  };
  const writeForbidden = async (): Promise<never> => {
    fail('provisioning_readonly_write_forbidden');
  };

  return Object.freeze({
    tenantExists: async (tenantId: string): Promise<boolean> => {
      assertTransactionActive();
      const result = await runQuery(() => transaction`
        SELECT id
        FROM "public"."tenants"
        WHERE id = ${tenantId}
        LIMIT 1
      `);
      const rows = requireRows(result);
      if (rows.length > 1) {
        fail('provisioning_readonly_row_shape_invalid');
      }
      if (rows.length === 0) {
        return false;
      }
      requireExactKeys(rows[0], ['id']);
      return requireIdentifier(rows[0].id) === tenantId;
    },
    readTriplet: async (input: {
      readonly tenantId: string;
      readonly institutionId: string;
    }): Promise<ProvisioningTripletSnapshotV1> => {
      assertTransactionActive();
      const { tenantId, institutionId } = input;
      const scopeResult = await runQuery(() => transaction`
        SELECT
          tenant_id AS "tenantId",
          institution_id AS "institutionId",
          status,
          revision,
          provisioning_source AS "provisioningSource",
          provisioning_reference_digest AS "provisioningReferenceDigest",
          approved_by AS "approvedBy",
          pg_catalog.to_char(
            approved_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS "approvedAt"
        FROM "public"."institution_scopes"
        WHERE tenant_id = ${tenantId}
          AND institution_id = ${institutionId}
        ORDER BY tenant_id ASC, institution_id ASC
      `);
      const versionResult = await runQuery(() => transaction`
        SELECT
          tenant_id AS "tenantId",
          institution_id AS "institutionId",
          version,
          timezone,
          currency,
          pg_catalog.to_char(
            effective_from_business_date,
            'YYYY-MM-DD'
          ) AS "effectiveFromBusinessDate",
          pg_catalog.to_char(
            effective_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS "effectiveAt",
          source,
          migration_provenance AS "migrationProvenance",
          created_by AS "createdBy"
        FROM "public"."institution_operating_context_versions"
        WHERE tenant_id = ${tenantId}
          AND institution_id = ${institutionId}
        ORDER BY version ASC
      `);
      const headResult = await runQuery(() => transaction`
        SELECT
          tenant_id AS "tenantId",
          institution_id AS "institutionId",
          revision,
          latest_version AS "latestVersion",
          updated_by AS "updatedBy"
        FROM "public"."institution_operating_contexts"
        WHERE tenant_id = ${tenantId}
          AND institution_id = ${institutionId}
        ORDER BY tenant_id ASC, institution_id ASC
      `);

      const versions = requireRows(versionResult)
        .map(mapContextVersionRow)
        .sort((left, right) => left.version - right.version);
      return Object.freeze({
        scopes: Object.freeze(requireRows(scopeResult).map(mapScopeRow)),
        versions: Object.freeze(versions),
        heads: Object.freeze(requireRows(headResult).map(mapContextHeadRow)),
      });
    },
    insertScope: writeForbidden,
    insertContextVersion: writeForbidden,
    insertContextHead: writeForbidden,
  });
}

export function createProvisioningReadonlyPostgresAdapter(
  sql: ProvisioningPostgresClient,
): ProvisioningTransactionPortV1 {
  return Object.freeze({
    read: async <T>(
      work: (repository: ProvisioningRepositoryV1) => Promise<T>,
    ): Promise<T> => {
      let transactionStarted = false;
      try {
        const result = await sql.begin(
          PROVISIONING_READONLY_TRANSACTION_OPTIONS,
          async (transaction) => {
            transactionStarted = true;
            await runQuery(() => transaction`
              SET LOCAL statement_timeout = '5000ms'
            `);
            await runQuery(() => transaction`
              SET LOCAL lock_timeout = '1000ms'
            `);
            await runQuery(() => transaction`
              SET LOCAL idle_in_transaction_session_timeout = '5000ms'
            `);
            const readOnlyResult = await runQuery(() => transaction`
              SELECT
                pg_catalog.current_setting('transaction_read_only') AS "transactionReadOnly",
                pg_catalog.current_setting('transaction_isolation') AS "transactionIsolation",
                pg_catalog.current_setting('statement_timeout') AS "statementTimeout",
                pg_catalog.current_setting('lock_timeout') AS "lockTimeout",
                pg_catalog.current_setting('idle_in_transaction_session_timeout') AS "idleTimeout"
            `);
            const rows = requireRows(readOnlyResult);
            if (
              rows.length !== 1 ||
              Object.keys(rows[0]).length !== 5 ||
              rows[0].transactionReadOnly !== 'on'
            ) {
              fail('provisioning_readonly_transaction_not_read_only');
            }
            if (rows[0].transactionIsolation !== 'repeatable read') {
              fail('provisioning_readonly_transaction_unavailable');
            }
            if (
              rows[0].statementTimeout !== '5s' ||
              rows[0].lockTimeout !== '1s' ||
              rows[0].idleTimeout !== '5s'
            ) {
              fail('provisioning_readonly_timeout');
            }
            let repositoryActive = true;
            const repository = createReadonlyRepository(
              transaction,
              () => repositoryActive,
            );
            try {
              return {
                value: await work(repository),
              };
            } catch (error) {
              throw mapDatabaseError(
                error,
                'provisioning_readonly_query_failed',
              );
            } finally {
              repositoryActive = false;
            }
          },
        );
        return result.value;
      } catch (error) {
        throw mapDatabaseError(
          error,
          transactionStarted
            ? 'provisioning_readonly_transaction_unavailable'
            : 'provisioning_readonly_connection_unavailable',
        );
      }
    },
    write: async <T>(
      _work: (repository: ProvisioningRepositoryV1) => Promise<T>,
    ): Promise<T> => {
      fail('provisioning_readonly_write_forbidden');
    },
  });
}
