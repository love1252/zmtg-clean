import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { resolveInstitutionWorkbenchRuntimeV1 } from '@/modules/institution-workbench/server/institution-workbench-runtime';
import * as workbenchEntry from '@/modules/institution-workbench/server/institution-workbench-entry';
import {
  createDisabledInstitutionWorkbenchEntryV1,
  isInstitutionWorkbenchEntryDecisionV1,
  type InstitutionWorkbenchEntryDecisionV1,
} from '@/modules/institution-workbench/server/institution-workbench-entry';
import {
  createInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';

const runtimeMocks = vi.hoisted(() => ({
  resolveInstitutionServerAuthorizationV1: vi.fn(),
}));

vi.mock(
  '@/modules/institution/server/institution-server-runtime',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/institution/server/institution-server-runtime')
      >();
    return {
      ...actual,
      resolveInstitutionServerAuthorizationV1:
        runtimeMocks.resolveInstitutionServerAuthorizationV1,
    };
  },
);

function genuineAuthorization(): InstitutionRequestAuthorizationV1 {
  return createInstitutionRequestAuthorizationV1({} as never);
}

function expectExactDecision(
  value: InstitutionWorkbenchEntryDecisionV1,
  kind: 'allowed' | 'blocked',
) {
  expect(isInstitutionWorkbenchEntryDecisionV1(value)).toBe(true);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Reflect.ownKeys(value)).toEqual(['kind', 'view']);
  expect(value).toEqual({ kind, view: 'capability_off' });
  expect(JSON.stringify(value)).toBe(
    `{"kind":"${kind}","view":"capability_off"}`,
  );
}

describe('BASE-RUNTIME-01 thin institution workbench runtime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    runtimeMocks.resolveInstitutionServerAuthorizationV1.mockReset();
    runtimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      genuineAuthorization(),
    );
  });

  it('keeps a no-input exact low-sensitive decision surface', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionWorkbenchRuntimeV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionWorkbenchRuntimeV1>
    >().toEqualTypeOf<Promise<InstitutionWorkbenchEntryDecisionV1>>();

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(runtimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledWith();
  });

  it('calls the shared root and controlled entry exactly once with a genuine authorization', async () => {
    const authorization = genuineAuthorization();
    const genuineDecision = createDisabledInstitutionWorkbenchEntryV1({});
    runtimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      authorization,
    );
    const controlledEntry = vi
      .spyOn(workbenchEntry, 'createControlledInstitutionWorkbenchEntryV1')
      .mockResolvedValueOnce(genuineDecision);

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expect(result).toBe(genuineDecision);
    expect(runtimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
    expect(controlledEntry).toHaveBeenCalledTimes(1);
    expect(controlledEntry).toHaveBeenCalledWith({ authorization });
  });

  it.each(['null', 'throw'] as const)(
    'returns genuine blocked when shared root is %s and skips controlled entry',
    async (runtimeCase) => {
      if (runtimeCase === 'throw') {
        runtimeMocks.resolveInstitutionServerAuthorizationV1.mockRejectedValueOnce(
          new Error('shared runtime unavailable'),
        );
      } else {
        runtimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
          null,
        );
      }
      const controlledEntry = vi.spyOn(
        workbenchEntry,
        'createControlledInstitutionWorkbenchEntryV1',
      );

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
      expect(controlledEntry).not.toHaveBeenCalled();
    },
  );

  it('rejects fake authorization shapes without getter or proxy trap access', async () => {
    const genuine = genuineAuthorization();
    let getterReads = 0;
    let traps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'authorizeCurrentInstitutionSectionV1', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('authorization getter');
      },
    });
    const handler: ProxyHandler<object> = {
      getPrototypeOf() {
        traps += 1;
        throw new Error('authorization prototype trap');
      },
    };
    const proxy = new Proxy(genuine, handler);
    const revoked = Proxy.revocable(genuine, handler);
    revoked.revoke();
    const controlledEntry = vi.spyOn(
      workbenchEntry,
      'createControlledInstitutionWorkbenchEntryV1',
    );

    for (const value of [
      {},
      { ...genuine },
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      runtimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
        value,
      );
      const result = await resolveInstitutionWorkbenchRuntimeV1();
      expectExactDecision(result, 'blocked');
    }
    expect(controlledEntry).not.toHaveBeenCalled();
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
  });

  it('rejects fake controlled decisions without getter or proxy trap access', async () => {
    const genuineDecision = createDisabledInstitutionWorkbenchEntryV1({});
    let getterReads = 0;
    let traps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'kind', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('decision getter');
      },
    });
    const handler: ProxyHandler<object> = {
      get() {
        traps += 1;
        throw new Error('decision get trap');
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error('decision prototype trap');
      },
    };
    const proxy = new Proxy(genuineDecision, handler);
    const revoked = Proxy.revocable(genuineDecision, handler);
    revoked.revoke();

    for (const value of [
      {},
      { ...genuineDecision },
      Object.create(genuineDecision) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      vi.spyOn(
        workbenchEntry,
        'createControlledInstitutionWorkbenchEntryV1',
      ).mockResolvedValueOnce(value as InstitutionWorkbenchEntryDecisionV1);
      const result = await resolveInstitutionWorkbenchRuntimeV1();
      expectExactDecision(result, 'blocked');
      vi.restoreAllMocks();
    }
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
  });

  it('returns genuine blocked when controlled entry throws', async () => {
    const controlledEntry = vi
      .spyOn(workbenchEntry, 'createControlledInstitutionWorkbenchEntryV1')
      .mockRejectedValueOnce(new Error('controlled entry unavailable'));

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(runtimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
    expect(controlledEntry).toHaveBeenCalledTimes(1);
  });

  it('does not expose the shared resolver as caller input or a bypass surface', () => {
    expect(resolveInstitutionServerAuthorizationV1).toBe(
      runtimeMocks.resolveInstitutionServerAuthorizationV1,
    );
    expect(Object.keys(workbenchEntry).sort()).toEqual([
      'createControlledInstitutionWorkbenchEntryV1',
      'createDisabledInstitutionWorkbenchEntryV1',
      'isInstitutionWorkbenchEntryDecisionV1',
    ]);
  });
});
