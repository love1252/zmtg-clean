import { isProxy } from 'node:util/types';

import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import { isInstitutionSectionAllowV1 } from '@/modules/security/server/institution-section-guard';

const FACTORY_KEYS = Object.freeze(['sectionId', 'handler'] as const);

export type InstitutionRouteHandlerV1<
  TArguments extends readonly unknown[] = readonly unknown[],
> = (...args: TArguments) => Response | Promise<Response>;

const FORBIDDEN_BODY = Object.freeze({
  error: 'institution_route_forbidden',
  code: 'institution_section_forbidden',
} as const);

function forbiddenResponse(): Response {
  return Response.json(FORBIDDEN_BODY, {
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
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

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

function isTrustedHandler(
  value: unknown,
): value is InstitutionRouteHandlerV1<readonly unknown[]> {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

export function withInstitutionSectionRouteGuardV1<
  TArguments extends readonly unknown[],
>(input: Readonly<{
  sectionId: InstitutionNavigationSectionIdV1;
  handler: InstitutionRouteHandlerV1<TArguments>;
}>): InstitutionRouteHandlerV1<TArguments> {
  const snapshot = snapshotExactPlainRecord(input, FACTORY_KEYS);
  const sectionId = snapshot?.sectionId;
  const handler = snapshot?.handler;

  if (
    !isInstitutionNavigationSectionIdV1(sectionId) ||
    !isTrustedHandler(handler)
  ) {
    return async () => forbiddenResponse();
  }

  return async (...args: TArguments): Promise<Response> => {
    let authorization: Awaited<
      ReturnType<typeof resolveInstitutionServerAuthorizationV1>
    > = null;

    try {
      authorization = await resolveInstitutionServerAuthorizationV1();
    } catch {
      authorization = null;
    }

    if (!isInstitutionRequestAuthorizationV1(authorization)) {
      return forbiddenResponse();
    }

    let resolution: Awaited<
      ReturnType<
        typeof authorization.authorizeCurrentInstitutionSectionV1
      >
    >;

    try {
      resolution =
        await authorization.authorizeCurrentInstitutionSectionV1({
          sectionId,
        });
    } catch {
      return forbiddenResponse();
    }

    if (
      !isInstitutionSectionAllowV1(resolution) ||
      resolution.sectionId !== sectionId
    ) {
      return forbiddenResponse();
    }

    return await (handler as InstitutionRouteHandlerV1<TArguments>)(...args);
  };
}
