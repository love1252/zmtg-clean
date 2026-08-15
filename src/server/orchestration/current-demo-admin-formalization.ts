export const CURRENT_DEMO_ADMIN_FORMALIZATION_TASK =
  'S39_CURRENT_DEMO_ADMIN_FORMALIZATION_AND_INSTITUTION_PROVISIONING_CONTROL_PLANE';
export const CURRENT_DEMO_ADMIN_FORMALIZATION_VERSION =
  'current-demo-admin-formalization/v1';
export const CURRENT_DEMO_ADMIN_FORMALIZATION_LEASE_VERSION =
  'current-demo-admin-formalization-execution-lease/v1';

export const CURRENT_DEMO_ADMIN_IDENTITY = Object.freeze({
  username: 'admin',
  accountId: 'demo-user-admin',
  accountDisplayName: '系统管理员',
  tenantId: 'growth-tenant-chengxing',
  tenantName: '澄星医疗美容',
  institutionId: 'growth-inst-chengxing',
  institutionName: '澄星医疗美容',
  role: 'tenant_admin',
  timezone: 'Asia/Shanghai',
  currency: 'CNY',
  assignmentSource: 'manual_admin',
  provenanceSource: 'access_control_command',
  reasonCode: 'post_rebuild_formal_provisioning',
} as const);

export type CurrentDemoAdminFormalizationMode = 'dry-run' | 'execute';
export type CurrentDemoAdminComponentState =
  | 'not_evaluated'
  | 'missing'
  | 'candidate'
  | 'reused'
  | 'applied'
  | 'conflict'
  | 'unexpected';
export type CurrentDemoAdminPhaseState =
  | 'not_run'
  | 'candidate'
  | 'reused'
  | 'applied'
  | 'conflict'
  | 'unexpected';

export type CurrentDemoAdminAuthorityManifest = Readonly<{
  task: typeof CURRENT_DEMO_ADMIN_FORMALIZATION_TASK;
  version: typeof CURRENT_DEMO_ADMIN_FORMALIZATION_VERSION;
  authorityRef: string;
  targetEnvironment: 'local_candidate';
  username: 'admin';
  accountId: 'demo-user-admin';
  accountDisplayName: '系统管理员';
  tenantId: 'growth-tenant-chengxing';
  tenantName: '澄星医疗美容';
  institutionId: 'growth-inst-chengxing';
  institutionName: '澄星医疗美容';
  membershipId: string;
  bindingId: string;
  timezone: 'Asia/Shanghai';
  currency: 'CNY';
  approvedAt: string;
  effectiveAt: string;
  effectiveFromBusinessDate: string;
  assignmentSource: 'manual_admin';
  provenanceSource: 'access_control_command';
  reasonCode: 'post_rebuild_formal_provisioning';
  expectedCodeSha: string;
  executionWindowNotAfter: string;
}>;

export type CurrentDemoAccountSnapshot = Readonly<{
  id: string;
  username: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  passwordResetRequired: boolean;
  status: string;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdBy: string;
  updatedBy: string;
}>;

export type CurrentDemoMembershipSnapshot = Readonly<{
  membershipId: string;
  tenantId: string;
  userId: string;
  role: string;
  displayName: string;
  revision: number | null;
  lifecycleStatus: string | null;
  provenanceSource: string | null;
  provenanceActorId: string | null;
  provenanceReasonCode: string | null;
}>;

export type CurrentDemoBindingSnapshot = Readonly<{
  bindingId: string;
  accountId: string;
  tenantId: string;
  institutionId: string;
  status: string;
  source: string;
  expiresAt: string | null;
  version: number;
}>;

export class CurrentDemoAdminPhaseExecutionError extends Error {
  readonly phase: 'phase_a' | 'phase_b' | 'phase_c';
  readonly databaseWriteExecuted: boolean;

  constructor(
    phase: 'phase_a' | 'phase_b' | 'phase_c',
    databaseWriteExecuted: boolean,
  ) {
    super('current_demo_admin_phase_execution_failed');
    this.name = 'CurrentDemoAdminPhaseExecutionError';
    this.phase = phase;
    this.databaseWriteExecuted = databaseWriteExecuted;
  }
}

export type CurrentDemoProvisioningCounts = Readonly<{
  input: number;
  insertedCandidate: number;
  reusedCandidate: number;
  conflict: number;
  unexpected: number;
}>;

export type CurrentDemoPhaseAOutcome = Readonly<{
  phase: CurrentDemoAdminPhaseState;
  accountState: CurrentDemoAdminComponentState;
  membershipState: CurrentDemoAdminComponentState;
  databaseWriteExecuted: boolean;
}>;

export type CurrentDemoPhaseBOutcome = Readonly<{
  phase: CurrentDemoAdminPhaseState;
  scopeState: CurrentDemoAdminComponentState;
  contextState: CurrentDemoAdminComponentState;
  databaseWriteExecuted: boolean;
}>;

export type CurrentDemoPhaseCOutcome = Readonly<{
  phase: CurrentDemoAdminPhaseState;
  bindingState: CurrentDemoAdminComponentState;
  databaseWriteExecuted: boolean;
}>;

export type CurrentDemoAdminFormalizationPhasePorts = Readonly<{
  runPhaseA(input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
    password: string | null;
    now: Date;
  }>): Promise<CurrentDemoPhaseAOutcome>;
  runPhaseB(input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
  }>): Promise<CurrentDemoPhaseBOutcome>;
  runPhaseC(input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
    phaseA: CurrentDemoPhaseAOutcome;
    now: Date;
  }>): Promise<CurrentDemoPhaseCOutcome>;
}>;

export type CurrentDemoAdminFormalizationResult = Readonly<{
  mode: CurrentDemoAdminFormalizationMode;
  accountState: CurrentDemoAdminComponentState;
  membershipState: CurrentDemoAdminComponentState;
  scopeState: CurrentDemoAdminComponentState;
  contextState: CurrentDemoAdminComponentState;
  bindingState: CurrentDemoAdminComponentState;
  phaseA: CurrentDemoAdminPhaseState;
  phaseB: CurrentDemoAdminPhaseState;
  phaseC: CurrentDemoAdminPhaseState;
  conflictCount: number;
  unexpectedCount: number;
  databaseWriteExecuted: boolean;
}>;

const SUCCESS_PHASE_STATES = new Set<CurrentDemoAdminPhaseState>([
  'candidate',
  'reused',
  'applied',
]);
const COMPONENT_STATES = new Set<CurrentDemoAdminComponentState>([
  'not_evaluated',
  'missing',
  'candidate',
  'reused',
  'applied',
  'conflict',
  'unexpected',
]);
const PHASE_STATES = new Set<CurrentDemoAdminPhaseState>([
  'not_run',
  'candidate',
  'reused',
  'applied',
  'conflict',
  'unexpected',
]);

function isValidPhaseOutcome(
  mode: CurrentDemoAdminFormalizationMode,
  phase: CurrentDemoAdminPhaseState,
  states: readonly CurrentDemoAdminComponentState[],
  databaseWriteExecuted: boolean,
): boolean {
  if (
    !PHASE_STATES.has(phase) ||
    states.some((state) => !COMPONENT_STATES.has(state)) ||
    (mode === 'dry-run' && databaseWriteExecuted)
  ) {
    return false;
  }
  if (phase === 'conflict') return states.includes('conflict');
  if (phase === 'unexpected') return states.includes('unexpected');
  if (phase === 'candidate') return states.some((state) => state === 'missing');
  if (phase === 'reused') return states.every((state) => state === 'reused');
  if (phase === 'applied') {
    return mode === 'execute' && databaseWriteExecuted &&
      states.some((state) => state === 'applied');
  }
  return false;
}

export function classifyCurrentDemoAccount(
  actual: CurrentDemoAccountSnapshot | null,
): 'missing' | 'reused' | 'conflict' {
  if (actual === null) return 'missing';
  const expected = CURRENT_DEMO_ADMIN_IDENTITY;
  return actual.id === expected.accountId &&
      actual.username === expected.username &&
      actual.displayName === expected.accountDisplayName &&
      actual.phone === null &&
      actual.email === null &&
      actual.passwordResetRequired === false &&
      actual.status === 'active' &&
      actual.lockedUntil === null &&
      actual.createdBy === expected.accountId
    ? 'reused'
    : 'conflict';
}

export function classifyCurrentDemoMembership(
  actual: CurrentDemoMembershipSnapshot | null,
  manifest: Pick<CurrentDemoAdminAuthorityManifest, 'membershipId'>,
): 'missing' | 'reused' | 'conflict' {
  if (actual === null) return 'missing';
  const expected = CURRENT_DEMO_ADMIN_IDENTITY;
  return actual.membershipId === manifest.membershipId &&
      actual.tenantId === expected.tenantId &&
      actual.userId === expected.accountId &&
      actual.role === expected.role &&
      actual.displayName === expected.accountDisplayName &&
      actual.revision === 1 &&
      actual.lifecycleStatus === 'active' &&
      actual.provenanceSource === 'formal_onboarding' &&
      actual.provenanceActorId === expected.accountId &&
      actual.provenanceReasonCode === 'formal_onboarding'
    ? 'reused'
    : 'conflict';
}

export function classifyCurrentDemoProvisioning(
  counts: CurrentDemoProvisioningCounts,
): 'missing' | 'reused' | 'conflict' | 'unexpected' {
  const values = Object.values(counts);
  if (
    values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    counts.input !== 1 ||
    counts.input !==
      counts.insertedCandidate + counts.reusedCandidate + counts.conflict +
        counts.unexpected
  ) {
    return 'unexpected';
  }
  if (counts.unexpected > 0) return 'unexpected';
  if (counts.conflict > 0) return 'conflict';
  if (counts.insertedCandidate === 1) return 'missing';
  if (counts.reusedCandidate === 1) return 'reused';
  return 'unexpected';
}

export function classifyCurrentDemoBinding(
  actual: CurrentDemoBindingSnapshot | null,
  manifest: Pick<CurrentDemoAdminAuthorityManifest, 'bindingId'>,
): 'missing' | 'reused' | 'conflict' {
  if (actual === null) return 'missing';
  const expected = CURRENT_DEMO_ADMIN_IDENTITY;
  return actual.bindingId === manifest.bindingId &&
      actual.accountId === expected.accountId &&
      actual.tenantId === expected.tenantId &&
      actual.institutionId === expected.institutionId &&
      actual.status === 'active' &&
      actual.source === expected.assignmentSource &&
      actual.expiresAt === null &&
      actual.version === 1
    ? 'reused'
    : 'conflict';
}

export function decideCurrentDemoPhaseA(input: Readonly<{
  mode: CurrentDemoAdminFormalizationMode;
  accountState: 'missing' | 'reused' | 'conflict';
  membershipState: 'missing' | 'reused' | 'conflict';
  passwordVerified?: boolean;
}>): CurrentDemoAdminPhaseState {
  if (input.accountState === 'conflict' || input.membershipState === 'conflict') {
    return 'conflict';
  }
  if (input.accountState === 'missing' && input.membershipState === 'reused') {
    return 'conflict';
  }
  if (
    input.mode === 'execute' &&
    input.accountState === 'reused' &&
    input.passwordVerified !== true
  ) {
    return 'conflict';
  }
  if (input.accountState === 'reused' && input.membershipState === 'reused') {
    return 'reused';
  }
  return 'candidate';
}

function unexpectedA(databaseWriteExecuted = false): CurrentDemoPhaseAOutcome {
  return Object.freeze({
    phase: 'unexpected',
    accountState: 'unexpected',
    membershipState: 'unexpected',
    databaseWriteExecuted,
  });
}

function unexpectedB(databaseWriteExecuted = false): CurrentDemoPhaseBOutcome {
  return Object.freeze({
    phase: 'unexpected',
    scopeState: 'unexpected',
    contextState: 'unexpected',
    databaseWriteExecuted,
  });
}

function unexpectedC(databaseWriteExecuted = false): CurrentDemoPhaseCOutcome {
  return Object.freeze({
    phase: 'unexpected',
    bindingState: 'unexpected',
    databaseWriteExecuted,
  });
}

function writeMayHaveExecuted(
  mode: CurrentDemoAdminFormalizationMode,
  phase: CurrentDemoAdminPhaseExecutionError['phase'],
  error: unknown,
): boolean {
  return mode === 'execute' &&
    error instanceof CurrentDemoAdminPhaseExecutionError &&
    error.phase === phase &&
    error.databaseWriteExecuted;
}

function countState(
  states: readonly CurrentDemoAdminComponentState[],
  expected: CurrentDemoAdminComponentState,
): number {
  return states.filter((state) => state === expected).length;
}

/**
 * S39 只在此编排三个 Owner phase。任一 phase 冲突或异常都会停止，
 * 不会自动重试、修复或 rebind。
 */
export async function orchestrateCurrentDemoAdminFormalization(input: Readonly<{
  mode: CurrentDemoAdminFormalizationMode;
  manifest: CurrentDemoAdminAuthorityManifest;
  password: string | null;
  now: Date;
  phases: CurrentDemoAdminFormalizationPhasePorts;
}>): Promise<CurrentDemoAdminFormalizationResult> {
  let phaseA: CurrentDemoPhaseAOutcome;
  let phaseB: CurrentDemoPhaseBOutcome = Object.freeze({
    phase: 'not_run',
    scopeState: 'not_evaluated',
    contextState: 'not_evaluated',
    databaseWriteExecuted: false,
  });
  let phaseC: CurrentDemoPhaseCOutcome = Object.freeze({
    phase: 'not_run',
    bindingState: 'not_evaluated',
    databaseWriteExecuted: false,
  });

  try {
    phaseA = await input.phases.runPhaseA({
      mode: input.mode,
      manifest: input.manifest,
      password: input.password,
      now: input.now,
    });
  } catch (error) {
    phaseA = unexpectedA(writeMayHaveExecuted(input.mode, 'phase_a', error));
  }
  if (!isValidPhaseOutcome(input.mode, phaseA.phase, [
    phaseA.accountState,
    phaseA.membershipState,
  ], phaseA.databaseWriteExecuted)) {
    phaseA = unexpectedA(
      input.mode === 'execute' && phaseA.databaseWriteExecuted === true,
    );
  }

  if (SUCCESS_PHASE_STATES.has(phaseA.phase)) {
    try {
      phaseB = await input.phases.runPhaseB({
        mode: input.mode,
        manifest: input.manifest,
      });
    } catch (error) {
      phaseB = unexpectedB(writeMayHaveExecuted(input.mode, 'phase_b', error));
    }
    if (!isValidPhaseOutcome(input.mode, phaseB.phase, [
      phaseB.scopeState,
      phaseB.contextState,
    ], phaseB.databaseWriteExecuted)) {
      phaseB = unexpectedB(
        input.mode === 'execute' && phaseB.databaseWriteExecuted === true,
      );
    }
  }

  if (SUCCESS_PHASE_STATES.has(phaseA.phase) &&
      SUCCESS_PHASE_STATES.has(phaseB.phase)) {
    try {
      phaseC = await input.phases.runPhaseC({
        mode: input.mode,
        manifest: input.manifest,
        phaseA,
        now: input.now,
      });
    } catch (error) {
      phaseC = unexpectedC(writeMayHaveExecuted(input.mode, 'phase_c', error));
    }
    if (!isValidPhaseOutcome(input.mode, phaseC.phase, [phaseC.bindingState],
      phaseC.databaseWriteExecuted)) {
      phaseC = unexpectedC(
        input.mode === 'execute' && phaseC.databaseWriteExecuted === true,
      );
    }
  }

  const componentStates = [
    phaseA.accountState,
    phaseA.membershipState,
    phaseB.scopeState,
    phaseB.contextState,
    phaseC.bindingState,
  ] as const;

  return Object.freeze({
    mode: input.mode,
    accountState: phaseA.accountState,
    membershipState: phaseA.membershipState,
    scopeState: phaseB.scopeState,
    contextState: phaseB.contextState,
    bindingState: phaseC.bindingState,
    phaseA: phaseA.phase,
    phaseB: phaseB.phase,
    phaseC: phaseC.phase,
    conflictCount: countState(componentStates, 'conflict'),
    unexpectedCount: countState(componentStates, 'unexpected'),
    databaseWriteExecuted:
      phaseA.databaseWriteExecuted || phaseB.databaseWriteExecuted ||
      phaseC.databaseWriteExecuted,
  });
}
