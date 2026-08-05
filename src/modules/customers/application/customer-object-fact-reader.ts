import { isProxy } from 'node:util/types';

import type {
  CustomerObjectFactSourceQueryV1,
  CustomerObjectFactSourceResolutionV1,
  CustomerObjectFactSourceResolverV1,
  CustomerObjectFactSourceV1,
} from '@/modules/customers/ports/customer-object-fact-source';
import type {
  AuthoritativeInstitutionObjectFactResolutionV1,
  InstitutionObjectFactReaderV1,
} from '@/modules/security/ports/institution-object-fact';
import {
  createInstitutionObjectFactReaderV1,
} from '@/modules/security/application/institution-object-fact-reader';

const SOURCE_FACTORY_KEYS = Object.freeze(['resolve'] as const);
const READER_FACTORY_KEYS = Object.freeze(['source', 'now'] as const);
const QUERY_KEYS = Object.freeze([
  'customerId',
  'tenantId',
  'institutionId',
] as const);
const CANDIDATE_KEYS = Object.freeze([
  'customerId',
  'tenantId',
  'institutionId',
  'updatedAt',
] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const sourceHandles = new WeakSet<object>();

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;

    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) return null;
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isFunction(
  value: unknown,
): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function parseQuery(
  value: unknown,
): CustomerObjectFactSourceQueryV1 | null {
  const input = snapshot(value, QUERY_KEYS);
  if (
    !input ||
    !isId(input.customerId) ||
    !isId(input.tenantId) ||
    !isId(input.institutionId)
  ) return null;

  return Object.freeze({
    customerId: input.customerId,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
  });
}

function canonicalInstant(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !CANONICAL_UTC_INSTANT.test(value)
  ) return null;
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) &&
    new Date(epochMs).toISOString() === value
    ? value
    : null;
}

function parseCandidate(
  value: unknown,
  query: CustomerObjectFactSourceQueryV1,
): CustomerObjectFactSourceResolutionV1 {
  if (value === null) {
    return Object.freeze({
      kind: 'rejected',
      code: 'customer_denied',
    });
  }

  const candidate = snapshot(value, CANDIDATE_KEYS);
  if (
    !candidate ||
    !isId(candidate.customerId) ||
    !isId(candidate.tenantId) ||
    !isId(candidate.institutionId)
  ) {
    return Object.freeze({
      kind: 'rejected',
      code: 'customer_invalid',
    });
  }

  if (
    candidate.customerId !== query.customerId ||
    candidate.tenantId !== query.tenantId ||
    candidate.institutionId !== query.institutionId
  ) {
    return Object.freeze({
      kind: 'rejected',
      code: 'customer_denied',
    });
  }

  const updatedAt = canonicalInstant(candidate.updatedAt);
  if (!updatedAt) {
    return Object.freeze({
      kind: 'rejected',
      code: 'customer_invalid',
    });
  }

  return Object.freeze({
    kind: 'customer_current_source',
    customerId: candidate.customerId,
    tenantId: candidate.tenantId,
    institutionId: candidate.institutionId,
    updatedAt,
  });
}

function makeSource(
  resolver: CustomerObjectFactSourceResolverV1 | null,
): CustomerObjectFactSourceV1 {
  const source = Object.freeze({
    async resolve(
      value: CustomerObjectFactSourceQueryV1,
    ): Promise<CustomerObjectFactSourceResolutionV1> {
      const query = parseQuery(value);
      if (!query) {
        return Object.freeze({
          kind: 'rejected',
          code: 'customer_invalid',
        });
      }
      if (!resolver) {
        return Object.freeze({
          kind: 'rejected',
          code: 'customer_unavailable',
        });
      }
      try {
        return parseCandidate(await resolver(query), query);
      } catch {
        return Object.freeze({
          kind: 'rejected',
          code: 'customer_unavailable',
        });
      }
    },
  });
  sourceHandles.add(source);
  return source;
}

export function createCustomerObjectFactSourceV1(input: Readonly<{
  resolve: CustomerObjectFactSourceResolverV1;
}>): CustomerObjectFactSourceV1 {
  const record = snapshot(input, SOURCE_FACTORY_KEYS);
  return makeSource(
    record && isFunction(record.resolve)
      ? (record.resolve as CustomerObjectFactSourceResolverV1)
      : null,
  );
}

export function isCustomerObjectFactSourceV1(
  value: unknown,
): value is CustomerObjectFactSourceV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      sourceHandles.has(value)
    );
  } catch {
    return false;
  }
}

function readNow(
  now: (() => Date) | null,
): Readonly<{ raw: string; epochMs: number }> | null {
  if (!now) return null;
  try {
    const value = now();
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) return null;
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isFinite(epochMs)
      ? Object.freeze({
          raw: new Date(epochMs).toISOString(),
          epochMs,
        })
      : null;
  } catch {
    return null;
  }
}

function unavailableReader(): InstitutionObjectFactReaderV1 {
  return createInstitutionObjectFactReaderV1({
    async resolve() {
      return Object.freeze({
        kind: 'rejected',
        code: 'object_unavailable',
      });
    },
  });
}

function mapRejection(
  value: Extract<
    CustomerObjectFactSourceResolutionV1,
    Readonly<{ kind: 'rejected' }>
  >,
): AuthoritativeInstitutionObjectFactResolutionV1 {
  if (value.code === 'customer_denied') {
    return Object.freeze({
      kind: 'rejected',
      code: 'object_denied',
    });
  }
  if (value.code === 'customer_invalid') {
    return Object.freeze({
      kind: 'rejected',
      code: 'object_invalid',
    });
  }
  return Object.freeze({
    kind: 'rejected',
    code: 'object_unavailable',
  });
}

export function createCustomerObjectFactReaderV1(input: Readonly<{
  source: CustomerObjectFactSourceV1;
  now: () => Date;
}>): InstitutionObjectFactReaderV1 {
  const record = snapshot(input, READER_FACTORY_KEYS);
  if (
    !record ||
    !isCustomerObjectFactSourceV1(record.source) ||
    !isFunction(record.now)
  ) return unavailableReader();

  const source = record.source;
  const now = record.now as () => Date;

  return createInstitutionObjectFactReaderV1({
    async resolve(
      query,
    ): Promise<AuthoritativeInstitutionObjectFactResolutionV1> {
      if (query.objectType !== 'customer') {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_invalid',
        });
      }

      const observed = readNow(now);
      if (!observed) {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_invalid',
        });
      }

      const resolved = await source.resolve({
        customerId: query.objectId,
        tenantId: query.tenantId,
        institutionId: query.institutionId,
      });
      if (resolved.kind === 'rejected') {
        return mapRejection(resolved);
      }

      const updatedAt = canonicalInstant(resolved.updatedAt);
      const revision = updatedAt ? Date.parse(updatedAt) : Number.NaN;
      if (
        !updatedAt ||
        !Number.isSafeInteger(revision) ||
        revision <= 0
      ) {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_invalid',
        });
      }

      return Object.freeze({
        kind: 'current_object_fact',
        objectType: 'customer',
        objectId: resolved.customerId,
        tenantId: resolved.tenantId,
        institutionId: resolved.institutionId,
        status: 'active',
        revision,
        observedAt: observed.raw,
      });
    },
  });
}
