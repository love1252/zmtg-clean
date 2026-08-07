import {
  chmod,
  link,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BASE02_B5_AUTHORITY_REF,
  BASE02_B5_TRANSFER_TASK,
  Base02B5TransferRunnerError,
  LOCAL_ACCEPTANCE_DATABASE_URL,
  MAX_PRIVATE_FILE_BYTES,
  assertSafeShellDatabaseUrl,
  canonicalSha256,
  classifyOutcomeUnknown,
  isLocalDatabaseUrl,
  parseRunnerArguments,
  readSecureJsonFile,
  runBase02B5TransferCli,
  validateExecutionLease,
  validateManifest,
} from './base02-b5-cross-tenant-transfer-runner.mjs';

const CODE_SHA = 'a'.repeat(40);
const JOURNAL = 'b'.repeat(64);
const COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const NOW = new Date('2026-08-08T00:00:00.000Z');
const MANIFEST_PATH = '/private/base02-b5-manifest.json';
const LEASE_PATH = '/private/base02-b5-lease.json';

const tempPaths = [];

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map((value) =>
      rm(value, { recursive: true, force: true }),
    ),
  );
});

function manifest(overrides = {}) {
  return {
    version: 1,
    task: BASE02_B5_TRANSFER_TASK,
    authorityRef: BASE02_B5_AUTHORITY_REF,
    expectedCodeSha: CODE_SHA,
    transferCommandId: COMMAND_ID,
    accountId: 'account-private-001',
    sourceTenantId: 'tenant-source-private',
    sourceMembershipId: 'membership-source-private',
    sourceExpectedMembershipRevision: 1,
    sourceBindingId: 'binding-source-private',
    sourceExpectedBindingVersion: 1,
    targetTenantId: 'tenant-target-private',
    targetInstitutionId: 'institution-target-private',
    targetMembershipId: 'membership-target-private',
    targetBindingId: 'binding-target-private',
    actorId: 'actor-private',
    reasonCode: 'base-b5-cross-tenant-transfer',
    occurredAt: '2026-08-07T23:00:00.000Z',
    targetBindingExpiresAt: null,
    expectedJournalFingerprint: JOURNAL,
    executionWindowNotAfter: '2026-08-08T01:00:00.000Z',
    ...overrides,
  };
}

function lease(value = manifest(), overrides = {}) {
  return {
    version: 1,
    task: BASE02_B5_TRANSFER_TASK,
    expectedCodeSha: value.expectedCodeSha,
    authorityRef: value.authorityRef,
    manifestSha256: canonicalSha256(value),
    executionAuthorized: true,
    notBefore: '2026-08-07T23:30:00.000Z',
    notAfter: '2026-08-08T00:30:00.000Z',
    singleUseNonce: 'nonce_BASE02B5_20260808_001',
    ...overrides,
  };
}

function readyPrestate(overrides = {}) {
  return {
    sourceMembershipCount: 1,
    sourceMembershipActiveComplete: true,
    sourceMembershipRevisionMatch: true,
    sourceActiveBindingCount: 1,
    sourceBindingVersionMatch: true,
    sourceBindingAccountMatch: true,
    targetMembershipCount: 0,
    targetActiveBindingCount: 0,
    targetScopeCount: 1,
    targetScopeActive: true,
    sameGlobalAccount: true,
    sourceCommandReplayCount: 0,
    targetCommandReplayCount: 0,
    concurrentWriterCount: 0,
    preparedTransactionCount: 0,
    journalFingerprint: JOURNAL,
    ...overrides,
  };
}

function committedPoststate(overrides = {}) {
  return {
    sourceMembershipRevokedCount: 1,
    sourceMembershipActiveCount: 0,
    sourceActiveBindingCount: 0,
    targetMembershipActiveCount: 1,
    targetActiveBindingCount: 1,
    targetScopeActiveCount: 1,
    activeAuthorizationOrphanCount: 0,
    activeScopeRelationOrphanCount: 0,
    retainedRevokedHistoricalRelationOrphanCount: 1,
    targetMembershipEvidenceCount: 1,
    targetBindingEvidenceCount: 1,
    sourceMembershipEvidenceCount: 1,
    sourceBindingEvidenceCount: 1,
    journalFingerprint: JOURNAL,
    ...overrides,
  };
}

function notCommittedPoststate(overrides = {}) {
  return {
    sourceMembershipRevokedCount: 0,
    sourceMembershipActiveCount: 1,
    sourceActiveBindingCount: 1,
    targetMembershipActiveCount: 0,
    targetActiveBindingCount: 0,
    targetScopeActiveCount: 1,
    activeAuthorizationOrphanCount: 1,
    activeScopeRelationOrphanCount: 1,
    retainedRevokedHistoricalRelationOrphanCount: 0,
    targetMembershipEvidenceCount: 0,
    targetBindingEvidenceCount: 0,
    sourceMembershipEvidenceCount: 0,
    sourceBindingEvidenceCount: 0,
    journalFingerprint: JOURNAL,
    ...overrides,
  };
}

function harness(options = {}) {
  const currentManifest = options.manifest ?? manifest();
  const currentLease = options.lease ?? lease(currentManifest);
  const stdout = [];
  const stderr = [];
  const closes = [];

  const openDatabase = vi.fn(async () => {
    const close = vi.fn(async () => undefined);
    closes.push(close);
    return { database: Object.freeze({}), close };
  });

  const executeTransfer = vi.fn(async () => ({
    status: 'applied',
    commandId: currentManifest.transferCommandId,
  }));

  const dependencies = {
    shellDatabaseUrl: undefined,
    now: () => new Date(NOW),
    gitState: vi.fn(async () => ({
      head: CODE_SHA,
      clean: true,
    })),
    readSecureJsonFile: vi.fn(async (filePath) => {
      if (filePath === MANIFEST_PATH) return currentManifest;
      if (filePath === LEASE_PATH) return currentLease;
      throw new Error('unexpected private file');
    }),
    openDatabase,
    readPrestate: vi.fn(async () =>
      options.prestate ?? readyPrestate()),
    readPoststate: vi.fn(async () =>
      options.poststate ?? committedPoststate()),
    executeTransfer,
    ...(options.dependencies ?? {}),
  };

  const output = {
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  };

  return {
    currentManifest,
    currentLease,
    dependencies,
    output,
    stdout,
    stderr,
    openDatabase,
    executeTransfer,
    closes,
  };
}

async function run(h, argv = [
  '--manifest-file',
  MANIFEST_PATH,
  '--dry-run',
]) {
  const exitCode = await runBase02B5TransferCli({
    argv,
    dependencies: h.dependencies,
    output: h.output,
  });
  return {
    exitCode,
    stdout: h.stdout.map((line) => JSON.parse(line)),
    stderr: h.stderr.map((line) => JSON.parse(line)),
  };
}

async function createPrivateFile(content, mode = 0o600) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'zmtg-base02-b5-runner-'),
  );
  tempPaths.push(directory);
  const file = path.join(directory, 'private.json');
  await writeFile(file, content, { mode });
  await chmod(file, mode);
  return { directory, file };
}

describe('BASE-B5 controlled execution runner', () => {
  it('CLI 默认 dry-run，且支持显式 dry-run', () => {
    expect(parseRunnerArguments([
      '--manifest-file',
      MANIFEST_PATH,
    ])).toEqual({
      mode: 'dry-run',
      manifestFile: MANIFEST_PATH,
      executionLeaseFile: null,
    });
    expect(parseRunnerArguments([
      '--manifest-file',
      MANIFEST_PATH,
      '--dry-run',
    ]).mode).toBe('dry-run');
  });

  it('CLI execute 必须提供 secure lease path', () => {
    expect(() =>
      parseRunnerArguments([
        '--manifest-file',
        MANIFEST_PATH,
        '--execute',
      ]),
    ).toThrowError(
      expect.objectContaining({
        code: 'runner_execution_lease_file_required',
      }),
    );
  });

  it('CLI 拒绝未知、重复和 dry-run 携带 lease', () => {
    for (const argv of [
      ['--manifest-file', MANIFEST_PATH, '--unknown'],
      [
        '--manifest-file',
        MANIFEST_PATH,
        '--manifest-file',
        MANIFEST_PATH,
      ],
      [
        '--manifest-file',
        MANIFEST_PATH,
        '--dry-run',
        '--execution-lease-file',
        LEASE_PATH,
      ],
    ]) {
      expect(() => parseRunnerArguments(argv)).toThrowError(
        Base02B5TransferRunnerError,
      );
    }
  });

  it('CLI 拒绝相对 private path', () => {
    expect(() =>
      parseRunnerArguments([
        '--manifest-file',
        './manifest.json',
      ]),
    ).toThrowError(
      expect.objectContaining({ code: 'runner_arguments_invalid' }),
    );
  });

  it('secure private JSON 接受 0600 regular file', async () => {
    const input = manifest();
    const { file } = await createPrivateFile(
      JSON.stringify(input),
    );
    await expect(readSecureJsonFile(file)).resolves.toEqual(input);
  });

  it('secure private JSON 拒绝 unsafe mode', async () => {
    const { file } = await createPrivateFile(
      JSON.stringify(manifest()),
      0o644,
    );
    await expect(readSecureJsonFile(file)).rejects.toMatchObject({
      code: 'runner_private_file_unsafe',
    });
  });

  it('secure private JSON 拒绝 symlink', async () => {
    const { directory, file } = await createPrivateFile(
      JSON.stringify(manifest()),
    );
    const symlinkPath = path.join(directory, 'link.json');
    await symlink(file, symlinkPath);
    await expect(
      readSecureJsonFile(symlinkPath),
    ).rejects.toMatchObject({ code: 'runner_private_file_unsafe' });
  });

  it('secure private JSON 拒绝 hardlink count > 1', async () => {
    const { directory, file } = await createPrivateFile(
      JSON.stringify(manifest()),
    );
    await link(file, path.join(directory, 'hardlink.json'));
    await expect(readSecureJsonFile(file)).rejects.toMatchObject({
      code: 'runner_private_file_unsafe',
    });
  });

  it('secure private JSON 拒绝 owner mismatch', async () => {
    const { file } = await createPrivateFile(
      JSON.stringify(manifest()),
    );
    const uid = typeof process.getuid === 'function'
      ? process.getuid()
      : 1000;
    await expect(
      readSecureJsonFile(file, { currentUid: uid + 1 }),
    ).rejects.toMatchObject({ code: 'runner_private_file_unsafe' });
  });

  it('secure private JSON 拒绝 oversize', async () => {
    const { file } = await createPrivateFile(
      JSON.stringify({ value: 'x'.repeat(MAX_PRIVATE_FILE_BYTES) }),
    );
    await expect(readSecureJsonFile(file)).rejects.toMatchObject({
      code: 'runner_private_file_unsafe',
    });
  });

  it('secure private JSON 拒绝 invalid UTF-8', async () => {
    const { file } = await createPrivateFile(
      Buffer.from([0xff, 0xfe, 0xfd]),
    );
    await expect(readSecureJsonFile(file)).rejects.toMatchObject({
      code: 'runner_private_file_encoding_invalid',
    });
  });

  it('secure private JSON 拒绝 duplicate JSON key', async () => {
    const { file } = await createPrivateFile(
      '{"version":1,"version":1}',
    );
    await expect(readSecureJsonFile(file)).rejects.toMatchObject({
      code: 'runner_private_json_duplicate_key',
    });
  });

  it('manifest 契约精确并绑定已签发 authority', () => {
    expect(validateManifest(manifest())).toEqual(manifest());
    expect(() =>
      validateManifest(manifest({ authorityRef: 'OTHER' })),
    ).toThrowError(
      expect.objectContaining({
        code: 'runner_manifest_contract_invalid',
      }),
    );
  });

  it('canonical SHA 对 object key order 稳定', () => {
    const left = { b: 2, a: 1 };
    const right = { a: 1, b: 2 };
    expect(canonicalSha256(left)).toBe(canonicalSha256(right));
  });

  it('execution lease 绑定 manifest SHA / code SHA / authority / window', () => {
    const value = manifest();
    expect(
      validateExecutionLease(
        lease(value),
        value,
        canonicalSha256(value),
        NOW,
      ),
    ).toEqual(lease(value));

    expect(() =>
      validateExecutionLease(
        lease(value, { manifestSha256: 'c'.repeat(64) }),
        value,
        canonicalSha256(value),
        NOW,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'runner_execution_lease_contract_invalid',
      }),
    );
  });

  it('shell DATABASE_URL 只接受 local URL', () => {
    expect(isLocalDatabaseUrl(
      'postgresql://u:p@127.0.0.1:55432/db',
    )).toBe(true);
    expect(isLocalDatabaseUrl(
      'postgresql://u:p@db.example.com:5432/db',
    )).toBe(false);
    expect(() =>
      assertSafeShellDatabaseUrl(
        'postgresql://u:p@db.example.com:5432/db',
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'runner_nonlocal_shell_database_url',
      }),
    );
  });

  it('固定使用 local_acceptance endpoint', () => {
    expect(LOCAL_ACCEPTANCE_DATABASE_URL).toBe(
      'postgresql://postgres:postgres@127.0.0.1:55432/zmtg_clean_local_acceptance',
    );
  });

  it('code SHA mismatch 在 DB adapter 前 fail-closed', async () => {
    const h = harness({
      dependencies: {
        gitState: vi.fn(async () => ({
          head: 'f'.repeat(40),
          clean: true,
        })),
      },
    });
    const result = await run(h);
    expect(result.exitCode).toBe(3);
    expect(result.stderr[0].errorCode).toBe(
      'runner_code_sha_mismatch',
    );
    expect(h.openDatabase).not.toHaveBeenCalled();
  });

  it('dirty worktree 在 DB adapter 前 fail-closed', async () => {
    const h = harness({
      dependencies: {
        gitState: vi.fn(async () => ({
          head: CODE_SHA,
          clean: false,
        })),
      },
    });
    const result = await run(h);
    expect(result.exitCode).toBe(3);
    expect(result.stderr[0].errorCode).toBe(
      'runner_worktree_not_clean',
    );
    expect(h.openDatabase).not.toHaveBeenCalled();
  });

  it('non-local shell DATABASE_URL 在 private/DB read 前 fail-closed', async () => {
    const readPrivate = vi.fn();
    const h = harness({
      dependencies: {
        shellDatabaseUrl:
          'postgresql://u:p@prod.example.com:5432/prod',
        readSecureJsonFile: readPrivate,
      },
    });
    const result = await run(h);
    expect(result.exitCode).toBe(2);
    expect(result.stderr[0].errorCode).toBe(
      'runner_nonlocal_shell_database_url',
    );
    expect(readPrivate).not.toHaveBeenCalled();
    expect(h.openDatabase).not.toHaveBeenCalled();
  });

  it('dry-run ready 只执行 readPrestate，不调用 transfer mutation service', async () => {
    const h = harness();
    const result = await run(h);
    expect(result.exitCode).toBe(0);
    expect(result.stdout[0]).toMatchObject({
      mode: 'dry-run',
      status: 'ready',
      prestateMatch: true,
      journalMatch: true,
    });
    expect(h.dependencies.readPrestate).toHaveBeenCalledTimes(1);
    expect(h.executeTransfer).not.toHaveBeenCalled();
    expect(h.openDatabase).toHaveBeenCalledTimes(1);
    expect(h.closes[0]).toHaveBeenCalledTimes(1);
  });

  it('source Membership revision mismatch 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({
        sourceMembershipRevisionMatch: false,
      }),
    });
    const result = await run(h);
    expect(result.exitCode).toBe(3);
    expect(result.stdout[0].status).toBe('blocked');
    expect(h.executeTransfer).not.toHaveBeenCalled();
  });

  it('source Binding version mismatch 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({
        sourceBindingVersionMatch: false,
      }),
    });
    expect((await run(h)).exitCode).toBe(3);
  });

  it('target Membership conflict 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({ targetMembershipCount: 1 }),
    });
    expect((await run(h)).exitCode).toBe(3);
  });

  it('target Binding conflict 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({ targetActiveBindingCount: 1 }),
    });
    expect((await run(h)).exitCode).toBe(3);
  });

  it('target Scope missing/inactive 阻断 dry-run', async () => {
    for (const prestate of [
      readyPrestate({ targetScopeCount: 0 }),
      readyPrestate({ targetScopeActive: false }),
    ]) {
      const h = harness({ prestate });
      expect((await run(h)).exitCode).toBe(3);
    }
  });

  it('command replay 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({
        sourceCommandReplayCount: 1,
      }),
    });
    expect((await run(h)).exitCode).toBe(3);
  });

  it('journal/schema fingerprint mismatch 阻断 dry-run', async () => {
    const h = harness({
      prestate: readyPrestate({
        journalFingerprint: 'c'.repeat(64),
      }),
    });
    const result = await run(h);
    expect(result.exitCode).toBe(3);
    expect(result.stdout[0].journalMatch).toBe(false);
  });

  it('execute 在 valid lease + ready prestate 下只调用 transfer service 一次', async () => {
    const h = harness();
    const result = await run(h, [
      '--manifest-file',
      MANIFEST_PATH,
      '--execution-lease-file',
      LEASE_PATH,
      '--execute',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout[0]).toMatchObject({
      status: 'applied_verified',
      prestateMatch: true,
      poststateMatch: true,
      retainedHistoricalRelationOrphanCount: 1,
      membershipEvidenceCount: 2,
      bindingEvidenceCount: 2,
    });
    expect(h.executeTransfer).toHaveBeenCalledTimes(1);
    expect(h.openDatabase).toHaveBeenCalledTimes(3);
    expect(h.closes).toHaveLength(3);
    for (const close of h.closes) {
      expect(close).toHaveBeenCalledTimes(1);
    }
  });

  it('postcheck 严格采用 Option 1：active orphan=0 且 retained historical orphan=1', async () => {
    const h = harness({
      poststate: committedPoststate(),
    });
    const result = await run(h, [
      '--manifest-file',
      MANIFEST_PATH,
      '--execution-lease-file',
      LEASE_PATH,
      '--execute',
    ]);
    expect(result.stdout[0]).toMatchObject({
      activeAuthorizationOrphanCount: 0,
      activeScopeRelationOrphanCount: 0,
      retainedHistoricalRelationOrphanCount: 1,
      poststateMatch: true,
    });
  });

  it('outcome_unknown committed 只做 fresh postcheck，不自动 retry', async () => {
    const h = harness({
      dependencies: {
        executeTransfer: vi.fn(async () => ({
          status: 'outcome_unknown',
          commandId: COMMAND_ID,
        })),
      },
      poststate: committedPoststate(),
    });
    const result = await run(h, [
      '--manifest-file',
      MANIFEST_PATH,
      '--execution-lease-file',
      LEASE_PATH,
      '--execute',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout[0].outcomeClassification).toBe('committed');
    expect(h.dependencies.executeTransfer).toHaveBeenCalledTimes(1);
  });

  it('outcome_unknown not_committed 可唯一分类且不 retry', async () => {
    const h = harness({
      dependencies: {
        executeTransfer: vi.fn(async () => ({
          status: 'outcome_unknown',
          commandId: COMMAND_ID,
        })),
      },
      poststate: notCommittedPoststate(),
    });
    const result = await run(h, [
      '--manifest-file',
      MANIFEST_PATH,
      '--execution-lease-file',
      LEASE_PATH,
      '--execute',
    ]);
    expect(result.exitCode).toBe(4);
    expect(result.stdout[0].outcomeClassification).toBe(
      'not_committed',
    );
    expect(h.dependencies.executeTransfer).toHaveBeenCalledTimes(1);
  });

  it('outcome_unknown indeterminate 必须 nonzero', async () => {
    const value = committedPoststate({
      sourceMembershipRevokedCount: 0,
      sourceMembershipActiveCount: 0,
    });
    expect(classifyOutcomeUnknown(value, manifest())).toBe(
      'indeterminate',
    );

    const h = harness({
      dependencies: {
        executeTransfer: vi.fn(async () => ({
          status: 'outcome_unknown',
          commandId: COMMAND_ID,
        })),
      },
      poststate: value,
    });
    const result = await run(h, [
      '--manifest-file',
      MANIFEST_PATH,
      '--execution-lease-file',
      LEASE_PATH,
      '--execute',
    ]);
    expect(result.exitCode).toBe(5);
    expect(result.stdout[0].status).toBe(
      'outcome_unknown_indeterminate',
    );
  });

  it('stdout/stderr 不输出 raw technical identifiers 或 private path', async () => {
    const h = harness();
    const result = await run(h);
    const serialized = JSON.stringify(result);
    for (const sensitive of [
      h.currentManifest.accountId,
      h.currentManifest.sourceTenantId,
      h.currentManifest.targetTenantId,
      h.currentManifest.sourceMembershipId,
      h.currentManifest.sourceBindingId,
      h.currentManifest.targetInstitutionId,
      MANIFEST_PATH,
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it('reader failure 也必须关闭 client', async () => {
    const h = harness({
      dependencies: {
        readPrestate: vi.fn(async () => {
          throw new Error('synthetic read failure');
        }),
      },
    });
    const result = await run(h);
    expect(result.exitCode).toBe(4);
    expect(h.closes[0]).toHaveBeenCalledTimes(1);
  });

  it('runner source 只含 SELECT/read-only 观测，不直接写 Membership/Binding current/evidence', async () => {
    const source = await readFile(
      path.resolve(
        process.cwd(),
        'scripts/db/base02-b5-cross-tenant-transfer-runner.mjs',
      ),
      'utf8',
    );
    expect(source).toContain("accessMode: 'read only'");
    expect(source).toContain('createCrossTenantTransferService');
    expect(source).toContain('createTransactionBoundInstitutionScopeAssertion');
    expect(source).toContain('createPostgresClient(LOCAL_ACCEPTANCE_DATABASE_URL)');
    expect(source).toContain('O_NOFOLLOW');

    expect(source).not.toMatch(
      /\bINSERT\s+INTO\s+(tenant_members|auth_account_institution_bindings|tenant_membership_transitions|auth_account_institution_binding_transitions)\b/iu,
    );
    expect(source).not.toMatch(
      /\bUPDATE\s+(tenant_members|auth_account_institution_bindings|tenant_membership_transitions|auth_account_institution_binding_transitions)\b/iu,
    );
    expect(source).not.toMatch(
      /\bDELETE\s+FROM\s+(tenant_members|auth_account_institution_bindings|tenant_membership_transitions|auth_account_institution_binding_transitions)\b/iu,
    );
    expect(source).not.toMatch(/\bTRUNCATE\b/iu);
    expect(source).not.toContain("from './");
  });
});
