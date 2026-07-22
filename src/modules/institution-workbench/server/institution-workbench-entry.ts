import { isProxy } from 'node:util/types';

import {
  isInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import { isInstitutionSectionAllowV1 } from '@/modules/security/server/institution-section-guard';

const DISABLED_INPUT_KEYS = Object.freeze([] as const);
const CONTROLLED_INPUT_KEYS = Object.freeze(['authorization'] as const);
const WORKBENCH_SECTION_INPUT = Object.freeze({ sectionId: 'workbench' as const });
const CAPABILITY_OFF_VIEW = 'capability_off' as const;

declare class InstitutionWorkbenchEntryDecisionSealV1 {
  private readonly ownerSeal;
}

export type InstitutionWorkbenchDisabledEntryInputV1 = Readonly<
  Record<never, never>
>;

export type InstitutionWorkbenchControlledEntryInputV1 = Readonly<{
  authorization: InstitutionRequestAuthorizationV1;
}>;

export type InstitutionWorkbenchEntryDecisionV1 =
  InstitutionWorkbenchEntryDecisionSealV1 &
    Readonly<{
      kind: 'blocked' | 'allowed';
      view: typeof CAPABILITY_OFF_VIEW;
    }>;

const authenticDecisionsV1 = new WeakSet<object>();

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Array.isArray(value) ||
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

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
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

function createDecision(
  kind: InstitutionWorkbenchEntryDecisionV1['kind'],
): InstitutionWorkbenchEntryDecisionV1 {
  const decision = Object.freeze({ kind, view: CAPABILITY_OFF_VIEW });
  authenticDecisionsV1.add(decision);
  return decision as InstitutionWorkbenchEntryDecisionV1;
}

export function isInstitutionWorkbenchEntryDecisionV1(
  value: unknown,
): value is InstitutionWorkbenchEntryDecisionV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      authenticDecisionsV1.has(value)
    );
  } catch {
    return false;
  }
}

/**
 * Production capability-off entry. The empty exact input deliberately has no request, session,
 * authorization, repository, service or provider dependency, so it closes before downstream work.
 */
export function createDisabledInstitutionWorkbenchEntryV1(
  input: InstitutionWorkbenchDisabledEntryInputV1,
): InstitutionWorkbenchEntryDecisionV1 {
  snapshotExactPlainRecord(input, DISABLED_INPUT_KEYS);
  return createDecision('blocked');
}

/**
 * Controlled server-only seam for the future composition root. It accepts only a genuine opaque
 * authorization, invokes the workbench section once, discards the raw resolution immediately and
 * keeps the rendered view capability-off even after a genuine allow.
 */
export async function createControlledInstitutionWorkbenchEntryV1(
  input: InstitutionWorkbenchControlledEntryInputV1,
): Promise<InstitutionWorkbenchEntryDecisionV1> {
  const snapshot = snapshotExactPlainRecord(input, CONTROLLED_INPUT_KEYS);
  const authorization = snapshot?.authorization;
  if (!isInstitutionRequestAuthorizationV1(authorization)) {
    return createDecision('blocked');
  }

  try {
    const resolution =
      await authorization.authorizeCurrentInstitutionSectionV1(
        WORKBENCH_SECTION_INPUT,
      );
    return createDecision(
      isInstitutionSectionAllowV1(resolution) &&
        resolution.sectionId === 'workbench'
        ? 'allowed'
        : 'blocked',
    );
  } catch {
    return createDecision('blocked');
  }
}
