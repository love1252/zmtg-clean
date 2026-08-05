import { isProxy } from 'node:util/types';

import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import {
  isInstitutionObjectActionV1,
  isInstitutionObjectTypeV1,
  type InstitutionObjectActionV1,
  type InstitutionObjectTypeV1,
} from '@/modules/security/ports/institution-object-fact';
import {
  isInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import { isInstitutionObjectActionAllowV1 } from '@/modules/security/server/institution-object-guard';
import { isInstitutionSectionAllowV1 } from '@/modules/security/server/institution-section-guard';

const SECTION_FACTORY_KEYS = Object.freeze(['sectionId', 'handler'] as const);
const OBJECT_FACTORY_KEYS = Object.freeze([
  'sectionId',
  'objectType',
  'action',
  'resolveObjectId',
  'handler',
] as const);

export type InstitutionRouteHandlerV1<
  TArguments extends readonly unknown[] = readonly unknown[],
> = (...args: TArguments) => Response | Promise<Response>;

export type InstitutionRouteObjectIdResolverV1<
  TArguments extends readonly unknown[] = readonly unknown[],
> = (...args: TArguments) => unknown | Promise<unknown>;

const SECTION_FORBIDDEN_BODY = Object.freeze({
  error: 'institution_route_forbidden',
  code: 'institution_section_forbidden',
} as const);
const OBJECT_FORBIDDEN_BODY = Object.freeze({
  error: 'institution_route_forbidden',
  code: 'institution_object_forbidden',
} as const);

function sectionForbiddenResponse(): Response {
  return Response.json(SECTION_FORBIDDEN_BODY, {
    status: 403,
    headers: { 'cache-control': 'no-store' },
  });
}

function objectForbiddenResponse(): Response {
  return Response.json(OBJECT_FORBIDDEN_BODY, {
    status: 403,
    headers: { 'cache-control': 'no-store' },
  });
}

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
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
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) return null;

    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
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

function isTrustedFunction(
  value: unknown,
): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function isRouteObjectId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 96 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

async function resolveAuthorization(): Promise<
  InstitutionRequestAuthorizationV1 | null
> {
  let authorization: Awaited<
    ReturnType<typeof resolveInstitutionServerAuthorizationV1>
  > = null;
  try {
    authorization = await resolveInstitutionServerAuthorizationV1();
  } catch {
    authorization = null;
  }
  return isInstitutionRequestAuthorizationV1(authorization)
    ? authorization
    : null;
}

export function withInstitutionSectionRouteGuardV1<
  TArguments extends readonly unknown[],
>(input: Readonly<{
  sectionId: InstitutionNavigationSectionIdV1;
  handler: InstitutionRouteHandlerV1<TArguments>;
}>): InstitutionRouteHandlerV1<TArguments> {
  const snapshot = snapshotExactPlainRecord(input, SECTION_FACTORY_KEYS);
  const sectionId = snapshot?.sectionId;
  const handler = snapshot?.handler;

  if (
    !isInstitutionNavigationSectionIdV1(sectionId) ||
    !isTrustedFunction(handler)
  ) return async () => sectionForbiddenResponse();

  return async (...args: TArguments): Promise<Response> => {
    const authorization = await resolveAuthorization();
    if (!authorization) return sectionForbiddenResponse();

    let resolution;
    try {
      resolution =
        await authorization.authorizeCurrentInstitutionSectionV1({
          sectionId,
        });
    } catch {
      return sectionForbiddenResponse();
    }

    if (
      !isInstitutionSectionAllowV1(resolution) ||
      resolution.sectionId !== sectionId
    ) return sectionForbiddenResponse();

    return await (handler as InstitutionRouteHandlerV1<TArguments>)(...args);
  };
}

export function withInstitutionObjectRouteGuardV1<
  TArguments extends readonly unknown[],
>(input: Readonly<{
  sectionId: InstitutionNavigationSectionIdV1;
  objectType: InstitutionObjectTypeV1;
  action: InstitutionObjectActionV1;
  resolveObjectId: InstitutionRouteObjectIdResolverV1<TArguments>;
  handler: InstitutionRouteHandlerV1<TArguments>;
}>): InstitutionRouteHandlerV1<TArguments> {
  const snapshot = snapshotExactPlainRecord(input, OBJECT_FACTORY_KEYS);
  const sectionId = snapshot?.sectionId;
  const objectType = snapshot?.objectType;
  const action = snapshot?.action;
  const resolveObjectId = snapshot?.resolveObjectId;
  const handler = snapshot?.handler;

  if (
    !isInstitutionNavigationSectionIdV1(sectionId) ||
    !isInstitutionObjectTypeV1(objectType) ||
    !isInstitutionObjectActionV1(action) ||
    !isTrustedFunction(resolveObjectId) ||
    !isTrustedFunction(handler)
  ) return async () => objectForbiddenResponse();

  const trustedResolver =
    resolveObjectId as InstitutionRouteObjectIdResolverV1<TArguments>;
  const trustedHandler =
    handler as InstitutionRouteHandlerV1<TArguments>;

  return async (...args: TArguments): Promise<Response> => {
    const sectionAuthorization = await resolveAuthorization();
    if (!sectionAuthorization) return objectForbiddenResponse();

    let sectionResolution;
    try {
      sectionResolution =
        await sectionAuthorization.authorizeCurrentInstitutionSectionV1({
          sectionId,
        });
    } catch {
      return objectForbiddenResponse();
    }
    if (
      !isInstitutionSectionAllowV1(sectionResolution) ||
      sectionResolution.sectionId !== sectionId
    ) return objectForbiddenResponse();

    let rawObjectId: unknown;
    try {
      rawObjectId = await trustedResolver(...args);
    } catch {
      return objectForbiddenResponse();
    }
    if (!isRouteObjectId(rawObjectId)) return objectForbiddenResponse();

    const objectAuthorization = await resolveAuthorization();
    if (!objectAuthorization) return objectForbiddenResponse();

    let objectResolution;
    try {
      objectResolution =
        await objectAuthorization.authorizeCurrentInstitutionObjectV1({
          objectType,
          objectId: rawObjectId,
          action,
        });
    } catch {
      return objectForbiddenResponse();
    }

    if (
      !isInstitutionObjectActionAllowV1(objectResolution) ||
      objectResolution.objectType !== objectType ||
      objectResolution.action !== action
    ) return objectForbiddenResponse();

    return await trustedHandler(...args);
  };
}
