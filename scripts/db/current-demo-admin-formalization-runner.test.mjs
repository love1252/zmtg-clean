import assert from 'node:assert/strict';
import {
  chmod,
  link,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { test } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test');

import {
  S39_LEASE_VERSION,
  S39_MANIFEST_VERSION,
  S39_TASK,
  assertCandidateDatabaseUrl,
  assertRepositoryCodeIdentity,
  canonicalSha256,
  parseAuthorityManifest,
  parseExecutionLease,
  parseRunnerArguments,
  readPrivateJsonFile,
  runCurrentDemoAdminFormalizationCli,
  verifyExecutionLease,
} from './current-demo-admin-formalization-runner.mjs';

const HEAD = '7'.repeat(40);
const NOW = new Date('2026-08-16T02:00:00.000Z');
const DATABASE_URL =
  'postgresql://postgres:local@127.0.0.1:55434/zmtg_clean_local_dev_candidate';

function manifest(overrides = {}) {
  return {
    task: S39_TASK,
    version: S39_MANIFEST_VERSION,
    authorityRef: 'S39-AUTH-20260816-001',
    targetEnvironment: 'local_candidate',
    username: 'admin',
    accountId: 'demo-user-admin',
    accountDisplayName: '系统管理员',
    tenantId: 'growth-tenant-chengxing',
    tenantName: '澄星医疗美容',
    institutionId: 'growth-inst-chengxing',
    institutionName: '澄星医疗美容',
    membershipId: 'membership-chengxing-admin',
    bindingId: 'binding-chengxing-admin',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    approvedAt: '2026-08-16T01:00:00.000Z',
    effectiveAt: '2026-08-16T01:00:00.000Z',
    effectiveFromBusinessDate: '2026-08-16',
    assignmentSource: 'manual_admin',
    provenanceSource: 'access_control_command',
    reasonCode: 'post_rebuild_formal_provisioning',
    expectedCodeSha: HEAD,
    executionWindowNotAfter: '2026-08-16T03:00:00.000Z',
    ...overrides,
  };
}

function lease(authorityManifest, overrides = {}) {
  return {
    task: S39_TASK,
    version: S39_LEASE_VERSION,
    authorityRef: authorityManifest.authorityRef,
    executionAuthorized: true,
    expectedCodeSha: authorityManifest.expectedCodeSha,
    manifestSha256: canonicalSha256(authorityManifest),
    notBefore: '2026-08-16T01:30:00.000Z',
    notAfter: '2026-08-16T02:30:00.000Z',
    singleUseNonce: 'S39nonce_20260816_0001',
    ...overrides,
  };
}

async function privateJsonFile(directory, name, value, mode = 0o600) {
  const file = path.join(directory, name);
  await writeFile(file, JSON.stringify(value), { mode });
  await chmod(file, mode);
  return file;
}

function reusedResult(mode) {
  return {
    mode,
    accountState: 'reused',
    membershipState: 'reused',
    scopeState: 'reused',
    contextState: 'reused',
    bindingState: 'reused',
    phaseA: 'reused',
    phaseB: 'reused',
    phaseC: 'reused',
    conflictCount: 0,
    unexpectedCount: 0,
    databaseWriteExecuted: false,
  };
}

function appliedResult() {
  return {
    ...reusedResult('execute'),
    accountState: 'applied',
    phaseA: 'applied',
    databaseWriteExecuted: true,
  };
}

function databaseWriteOutput(output) {
  return output.find((line) => line.startsWith('DATABASE_WRITE_EXECUTED='));
}

function privateStat(source, overrides = {}) {
  return {
    dev: 11n,
    ino: 22n,
    uid: BigInt(process.getuid()),
    mode: 0o100600n,
    size: BigInt(Buffer.byteLength(source)),
    nlink: 1n,
    mtimeNs: 33n,
    ctimeNs: 44n,
    isFile: () => true,
    isSymbolicLink: () => false,
    ...overrides,
  };
}

function privateFileDependencies(input = {}) {
  const source = input.source ?? JSON.stringify(manifest());
  const baseline = privateStat(source);
  const lstatValues = [
    input.before ?? baseline,
    input.afterPath ?? baseline,
  ];
  const openedValues = [
    input.opened ?? baseline,
    input.afterOpened ?? baseline,
  ];
  return {
    uid: process.getuid(),
    oNoFollow: 0x20_000,
    async lstat(_filePath, options) {
      assert.deepEqual(options, { bigint: true });
      return lstatValues.shift();
    },
    async open() {
      const bytes = Buffer.from(source);
      return {
        async stat(options) {
          assert.deepEqual(options, { bigint: true });
          return openedValues.shift();
        },
        async read(buffer, offset, length, position) {
          if (position >= bytes.length) return { bytesRead: 0, buffer };
          const bytesRead = Math.min(length, bytes.length - position);
          bytes.copy(buffer, offset, position, position + bytesRead);
          return { bytesRead, buffer };
        },
        async close() {},
      };
    },
  };
}

test('runner defaults to dry-run and requires an explicit manifest file', () => {
  assert.deepEqual(
    parseRunnerArguments(['--manifest-file', '/tmp/s39-manifest.json']),
    {
      mode: 'dry-run',
      manifestFile: '/tmp/s39-manifest.json',
      executionLeaseFile: null,
    },
  );
  assert.throws(() => parseRunnerArguments([]), /runner_manifest_file_required/u);
});

test('execute requires a lease while dry-run rejects one', () => {
  assert.throws(() => parseRunnerArguments([
    '--execute',
    '--manifest-file',
    '/tmp/manifest.json',
  ]), /runner_execution_lease_file_required/u);
  assert.throws(() => parseRunnerArguments([
    '--manifest-file',
    '/tmp/manifest.json',
    '--execution-lease-file',
    '/tmp/lease.json',
  ]), /runner_lease_not_allowed_for_dry_run/u);
});

test('manifest parser freezes the exact current Chengxing identity', () => {
  const parsed = parseAuthorityManifest(manifest());
  assert.equal(parsed.accountId, 'demo-user-admin');
  assert.equal(parsed.institutionId, 'growth-inst-chengxing');
  assert.equal(Object.isFrozen(parsed), true);
  assert.throws(() => parseAuthorityManifest(manifest({
    institutionName: '星澜医美演示机构',
  })), /runner_manifest_identity_invalid/u);
});

test('manifest parser rejects unknown sensitive keys and semantic duplicates', () => {
  assert.throws(() => parseAuthorityManifest({
    ...manifest(),
    password: 'must-not-be-admitted',
  }), /runner_manifest_shape_invalid/u);
  assert.throws(() => parseAuthorityManifest(manifest({
    bindingId: 'membership-chengxing-admin',
  })), /runner_manifest_contract_invalid/u);
});

test('manifest parser enforces Shanghai business date and canonical UTC', () => {
  assert.throws(() => parseAuthorityManifest(manifest({
    effectiveFromBusinessDate: '2026-08-15',
  })), /runner_manifest_contract_invalid/u);
  assert.throws(() => parseAuthorityManifest(manifest({
    approvedAt: '2026-08-16T01:00:00Z',
  })), /runner_manifest_contract_invalid/u);
  assert.throws(() => parseAuthorityManifest(manifest({
    effectiveAt: '2026-08-16T01:00:01.000Z',
  })), /runner_manifest_contract_invalid/u);
});

test('canonical manifest digest is independent of object key order', () => {
  const value = manifest();
  const reversed = Object.fromEntries(Object.entries(value).reverse());
  assert.equal(canonicalSha256(value), canonicalSha256(reversed));
});

test('execution lease is strict, head-bound, manifest-bound, and time-bound', () => {
  const authorityManifest = parseAuthorityManifest(manifest());
  const executionLease = parseExecutionLease(lease(authorityManifest));
  assert.doesNotThrow(() => verifyExecutionLease({
    lease: executionLease,
    manifest: authorityManifest,
    manifestSha256: canonicalSha256(authorityManifest),
    actualHead: HEAD,
    now: NOW,
  }));
  for (const overrides of [
    { expectedCodeSha: '8'.repeat(40) },
    { manifestSha256: '9'.repeat(64) },
    { authorityRef: 'S39-AUTH-OTHER' },
    { executionAuthorized: false },
  ]) {
    const invalidLease = parseExecutionLease(lease(authorityManifest, overrides));
    assert.throws(() => verifyExecutionLease({
      lease: invalidLease,
      manifest: authorityManifest,
      manifestSha256: canonicalSha256(authorityManifest),
      actualHead: HEAD,
      now: NOW,
    }), /runner_execution_authorization_invalid/u);
  }
});

test('execution lease rejects invalid nonce and windows', () => {
  const authorityManifest = manifest();
  assert.throws(() => parseExecutionLease(lease(authorityManifest, {
    singleUseNonce: 'short',
  })), /runner_lease_contract_invalid/u);
  const executionLease = parseExecutionLease(lease(authorityManifest));
  assert.throws(() => verifyExecutionLease({
    lease: executionLease,
    manifest: parseAuthorityManifest(authorityManifest),
    manifestSha256: canonicalSha256(authorityManifest),
    actualHead: HEAD,
    now: new Date('2026-08-16T02:31:00.000Z'),
  }), /runner_execution_authorization_invalid/u);
});

test('candidate database gate accepts only the exact host, port, and database', () => {
  assert.equal(assertCandidateDatabaseUrl(DATABASE_URL), DATABASE_URL);
  for (const invalid of [
    'postgresql://postgres:local@127.0.0.1:55433/zmtg_clean_local_dev_candidate',
    'postgresql://postgres:local@127.0.0.1:55435/zmtg_clean_local_dev_candidate',
    'postgresql://postgres:local@localhost:55434/zmtg_clean_local_dev_candidate',
    'postgresql://postgres:local@127.0.0.1:55434/zmtg_clean_local_dev',
    'postgresql://postgres:local@10.0.0.1:55434/zmtg_clean_local_dev_candidate',
    'postgresql://postgres:local@127.0.0.1:55434/zmtg_clean_local_dev_candidate?host=10.0.0.1',
  ]) {
    assert.throws(
      () => assertCandidateDatabaseUrl(invalid),
      /runner_database_identity_invalid/u,
    );
  }
});

test('private reader accepts a single-owner 0400 or 0600 regular file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-private-'));
  try {
    const file = await privateJsonFile(directory, 'manifest.json', manifest());
    assert.deepEqual(await readPrivateJsonFile(file), manifest());
    await chmod(file, 0o400);
    assert.deepEqual(await readPrivateJsonFile(file), manifest());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('private reader rejects unsafe mode, symlink, and multiple hardlinks', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-private-'));
  try {
    const unsafe = await privateJsonFile(
      directory,
      'unsafe.json',
      manifest(),
      0o644,
    );
    await assert.rejects(readPrivateJsonFile(unsafe), /runner_private_file_unsafe/u);
    const original = await privateJsonFile(directory, 'original.json', manifest());
    const symbolic = path.join(directory, 'symbolic.json');
    await symlink(original, symbolic);
    await assert.rejects(readPrivateJsonFile(symbolic), /runner_private_file_unsafe/u);
    const hard = path.join(directory, 'hard.json');
    await link(original, hard);
    await assert.rejects(readPrivateJsonFile(original), /runner_private_file_unsafe/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('private reader rejects duplicate JSON keys and invalid UTF-8', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-private-'));
  try {
    const duplicate = path.join(directory, 'duplicate.json');
    await writeFile(duplicate, '{"task":"one","task":"two"}', { mode: 0o600 });
    await assert.rejects(
      readPrivateJsonFile(duplicate),
      /runner_private_json_duplicate_key/u,
    );
    const invalidUtf8 = path.join(directory, 'invalid.json');
    await writeFile(invalidUtf8, Buffer.from([0xff, 0xfe]), { mode: 0o600 });
    await assert.rejects(
      readPrivateJsonFile(invalidUtf8),
      /runner_private_file_utf8_invalid/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('private reader binds mtime and ctime before opening', async () => {
  const source = JSON.stringify(manifest());
  const baseline = privateStat(source);
  for (const changed of [
    { ...baseline, mtimeNs: baseline.mtimeNs + 1n },
    { ...baseline, ctimeNs: baseline.ctimeNs + 1n },
  ]) {
    await assert.rejects(readPrivateJsonFile('/private/manifest.json',
      privateFileDependencies({ source, opened: changed })),
    /runner_private_file_changed/u);
  }
});

test('private reader rejects post-read path identity changes', async () => {
  const source = JSON.stringify(manifest());
  const baseline = privateStat(source);
  await assert.rejects(readPrivateJsonFile('/private/manifest.json',
    privateFileDependencies({
      source,
      afterPath: { ...baseline, ino: baseline.ino + 1n },
    })), /runner_private_file_changed/u);
});

test('private reader rejects post-read opened-handle identity changes',
  async () => {
    const source = JSON.stringify(manifest());
    const baseline = privateStat(source);
    await assert.rejects(readPrivateJsonFile('/private/manifest.json',
      privateFileDependencies({
        source,
        afterOpened: { ...baseline, size: baseline.size + 1n },
      })), /runner_private_file_changed/u);
  });

test('private reader fails closed when O_NOFOLLOW is unavailable', async () => {
  await assert.rejects(readPrivateJsonFile('/private/manifest.json', {
    oNoFollow: null,
  }), /runner_nofollow_unavailable/u);
});

test('dry-run does not require or pass a password and emits only allowed fields', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const authorityManifest = manifest();
    const manifestFile = await privateJsonFile(
      directory,
      'manifest.json',
      authorityManifest,
    );
    const output = [];
    const executor = async (input) => {
      assert.equal(input.password, null);
      return reusedResult('dry-run');
    };
    const exitCode = await runCurrentDemoAdminFormalizationCli({
      argv: ['--manifest-file', manifestFile],
      databaseUrl: DATABASE_URL,
      actualHead: HEAD,
      worktreeStatus: '',
      now: NOW,
      executor,
      output: (line) => output.push(line),
    });
    assert.equal(exitCode, 0);
    assert.deepEqual(output.map((line) => line.split('=', 1)[0]), [
      'MODE',
      'TARGET',
      'ACCOUNT_STATE',
      'MEMBERSHIP_STATE',
      'SCOPE_STATE',
      'CONTEXT_STATE',
      'BINDING_STATE',
      'PHASE_A',
      'PHASE_B',
      'PHASE_C',
      'CONFLICT_COUNT',
      'UNEXPECTED_COUNT',
      'DATABASE_WRITE_EXECUTED',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('authorized execute requires password and passes an admitted lease', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const authorityManifest = manifest();
    const executionLease = lease(authorityManifest);
    const manifestFile = await privateJsonFile(
      directory,
      'manifest.json',
      authorityManifest,
    );
    const leaseFile = await privateJsonFile(
      directory,
      'lease.json',
      executionLease,
    );
    let calls = 0;
    const output = [];
    const exitCode = await runCurrentDemoAdminFormalizationCli({
      argv: [
        '--execute',
        '--manifest-file',
        manifestFile,
        '--execution-lease-file',
        leaseFile,
      ],
      databaseUrl: DATABASE_URL,
      actualHead: HEAD,
      worktreeStatus: '',
      now: NOW,
      password: 'not-printed-secret',
      executor: async (input) => {
        calls += 1;
        assert.equal(input.password, 'not-printed-secret');
        return reusedResult('execute');
      },
      output: (line) => output.push(line),
    });
    assert.equal(exitCode, 0);
    assert.equal(calls, 1);
    assert.equal(databaseWriteOutput(output), 'DATABASE_WRITE_EXECUTED=false');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('execute admission failure never prints password, path, URL, nonce, or hash', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const authorityManifest = manifest();
    const executionLease = lease(authorityManifest);
    const manifestFile = await privateJsonFile(
      directory,
      'private-manifest.json',
      authorityManifest,
    );
    const leaseFile = await privateJsonFile(
      directory,
      'private-lease.json',
      executionLease,
    );
    const output = [];
    const exitCode = await runCurrentDemoAdminFormalizationCli({
      argv: [
        '--execute',
        '--manifest-file',
        manifestFile,
        '--execution-lease-file',
        leaseFile,
      ],
      databaseUrl: DATABASE_URL,
      actualHead: HEAD,
      worktreeStatus: '',
      now: NOW,
      password: null,
      output: (line) => output.push(line),
      executor: async () => {
        throw new Error('executor must not be reached');
      },
    });
    assert.notEqual(exitCode, 0);
    assert.equal(databaseWriteOutput(output), 'DATABASE_WRITE_EXECUTED=false');
    const rendered = output.join('\n');
    for (const secret of [
      manifestFile,
      leaseFile,
      DATABASE_URL,
      executionLease.singleUseNonce,
      executionLease.manifestSha256,
    ]) {
      assert.equal(rendered.includes(secret), false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('execute boundary conservatively reports unknown and successful outcomes',
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
    try {
      const authorityManifest = manifest();
      const manifestFile = await privateJsonFile(
        directory,
        'manifest.json',
        authorityManifest,
      );
      const leaseFile = await privateJsonFile(
        directory,
        'lease.json',
        lease(authorityManifest),
      );
      const cases = [
        {
          executor: async () => {
            throw new Error('unknown executor outcome');
          },
          expectedExit: 4,
          expectedWrite: true,
        },
        {
          executor: async () => ({ malformed: true }),
          expectedExit: 4,
          expectedWrite: true,
        },
        {
          executor: async () => reusedResult('execute'),
          expectedExit: 0,
          expectedWrite: false,
        },
        {
          executor: async () => appliedResult(),
          expectedExit: 0,
          expectedWrite: true,
        },
      ];
      for (const testCase of cases) {
        const output = [];
        const exitCode = await runCurrentDemoAdminFormalizationCli({
          argv: [
            '--execute',
            '--manifest-file',
            manifestFile,
            '--execution-lease-file',
            leaseFile,
          ],
          databaseUrl: DATABASE_URL,
          actualHead: HEAD,
          worktreeStatus: '',
          now: NOW,
          password: 'not-printed-secret',
          executor: testCase.executor,
          output: (line) => output.push(line),
        });
        assert.equal(exitCode, testCase.expectedExit);
        assert.equal(
          databaseWriteOutput(output),
          `DATABASE_WRITE_EXECUTED=${String(testCase.expectedWrite)}`,
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

test('dry-run executor failure never reports a possible write', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const manifestFile = await privateJsonFile(
      directory,
      'manifest.json',
      manifest(),
    );
    const output = [];
    const exitCode = await runCurrentDemoAdminFormalizationCli({
      argv: ['--manifest-file', manifestFile],
      databaseUrl: DATABASE_URL,
      actualHead: HEAD,
      worktreeStatus: '',
      now: NOW,
      executor: async () => {
        throw new Error('dry-run executor failure');
      },
      output: (line) => output.push(line),
    });
    assert.equal(exitCode, 4);
    assert.equal(databaseWriteOutput(output), 'DATABASE_WRITE_EXECUTED=false');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('repository gate requires clean staged, unstaged, and untracked state', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const manifestFile = await privateJsonFile(
      directory,
      'manifest.json',
      manifest(),
    );
    for (const worktreeStatus of [
      ' M src/example.ts\n',
      'M  src/example.ts\n',
      '?? src/example.ts\n',
    ]) {
      await assert.rejects(assertRepositoryCodeIdentity({
        actualHead: HEAD,
        worktreeStatus,
      }), /runner_worktree_not_clean/u);
      let calls = 0;
      const exitCode = await runCurrentDemoAdminFormalizationCli({
        argv: ['--manifest-file', manifestFile],
        databaseUrl: DATABASE_URL,
        actualHead: HEAD,
        worktreeStatus,
        now: NOW,
        executor: async () => {
          calls += 1;
          return reusedResult('dry-run');
        },
        output: () => undefined,
      });
      assert.notEqual(exitCode, 0);
      assert.equal(calls, 0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('test-only HEAD injection cannot bypass worktree status', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's39-cli-'));
  try {
    const manifestFile = await privateJsonFile(
      directory,
      'manifest.json',
      manifest(),
    );
    let calls = 0;
    await assert.rejects(assertRepositoryCodeIdentity({
      actualHead: HEAD,
    }), /runner_repository_identity_dependencies_invalid/u);
    const exitCode = await runCurrentDemoAdminFormalizationCli({
      argv: ['--manifest-file', manifestFile],
      databaseUrl: DATABASE_URL,
      actualHead: HEAD,
      now: NOW,
      executor: async () => {
        calls += 1;
        return reusedResult('dry-run');
      },
      output: () => undefined,
    });
    assert.notEqual(exitCode, 0);
    assert.equal(calls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
