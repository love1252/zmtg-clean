import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  open as openFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
} from '../../src/modules/tenancy/provisioning/provisioning-canonicalization.ts';
import {
  parseRunnerArguments,
  readManifestFileSecure,
  runProvisioningCli,
} from './mig01-a2-provisioning-runner.mjs';

const temporaryDirectories = [];
const contextPolicy = {
  timezones: ['Asia/Shanghai'],
  currencies: ['CNY'],
};

function createManifest() {
  const draft = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: 'approval-ref-001',
    approvedAt: '2026-07-30T00:00:00.000Z',
    entries: [
      {
        tenantId: 'tenant-fixture',
        institutionId: 'institution-fixture',
        scopeStatus: 'active',
        scopeRevision: 1,
        provisioningSource: 'approved_migration_manifest',
        contextVersion: 1,
        contextHeadRevision: 1,
        latestVersion: 1,
        contextSource: 'institution_config',
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
        effectiveFromBusinessDate: '2026-07-30',
        effectiveAt: '2026-07-30T00:00:00.000Z',
      },
    ],
  };
  return {
    ...draft,
    digest: computeProvisioningManifestDigest(draft).external,
  };
}

async function createManifestFile(content = JSON.stringify(createManifest())) {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'zmtg-a2-runner-test-'),
  );
  temporaryDirectories.push(directory);
  const file = path.join(directory, 'manifest.json');
  await writeFile(file, content);
  await chmod(file, 0o600);
  return { directory, file };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('MIG-01A2 Provisioning CLI 参数', () => {
  it('只接受唯一 Manifest 文件路径及唯一模式', () => {
    expect(parseRunnerArguments(['--manifest-file', '/safe/path'])).toEqual({
      mode: 'dry-run',
      manifestFile: '/safe/path',
    });
    expect(
      parseRunnerArguments([
        '--',
        '--execute',
        '--manifest-file',
        '/safe/path',
      ]),
    ).toEqual({ mode: 'execute', manifestFile: '/safe/path' });
  });

  it.each([
    [],
    ['--manifest-file=/unsafe/body'],
    ['--manifest-file', '/one', '--manifest-file', '/two'],
    ['--dry-run', '--execute', '--manifest-file', '/safe/path'],
    ['--manifest-file', '/safe/path', '--manifest-body', '{"secret":true}'],
    ['--manifest-file', '{"approvalStatus":"approved"}'],
    ['--manifest-file', 'relative/manifest.json'],
  ])('拒绝未知、重复或正文型参数 %#', (argv) => {
    expect(() => parseRunnerArguments(argv)).toThrow();
  });
});

describe('MIG-01A2 Manifest 安全文件读取', () => {
  it('只读取当前用户拥有的 0600 普通文件', async () => {
    const { file } = await createManifestFile();
    await expect(readManifestFileSecure(file)).resolves.toEqual(
      createManifest(),
    );
    await chmod(file, 0o400);
    await expect(readManifestFileSecure(file)).resolves.toEqual(
      createManifest(),
    );
  });

  it('拒绝权限过宽、符号链接及非法 UTF-8', async () => {
    const permissive = await createManifestFile();
    await chmod(permissive.file, 0o644);
    await expect(readManifestFileSecure(permissive.file)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );
    await chmod(permissive.file, 0o4600);
    await expect(readManifestFileSecure(permissive.file)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );

    const target = await createManifestFile();
    const link = path.join(target.directory, 'manifest-link.json');
    await symlink(target.file, link);
    await expect(readManifestFileSecure(link)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );

    const invalid = await createManifestFile(Buffer.from([0xc3, 0x28]));
    await expect(readManifestFileSecure(invalid.file)).rejects.toThrow(
      'runner_manifest_encoding_invalid',
    );
  });

  it('拒绝空文件、目录、BOM、非法 JSON、重复 JSON key 与 hard link', async () => {
    const empty = await createManifestFile('');
    await expect(readManifestFileSecure(empty.file)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );
    await expect(readManifestFileSecure(empty.directory)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );

    const bom = await createManifestFile(`\ufeff${JSON.stringify(createManifest())}`);
    await expect(readManifestFileSecure(bom.file)).rejects.toThrow(
      'runner_manifest_encoding_invalid',
    );
    const invalidJson = await createManifestFile('{"entries":');
    await expect(readManifestFileSecure(invalidJson.file)).rejects.toThrow(
      'runner_manifest_json_invalid',
    );
    const duplicateKey = await createManifestFile(
      '{"manifestVersion":"one","manifestVersion":"two"}',
    );
    await expect(readManifestFileSecure(duplicateKey.file)).rejects.toThrow(
      'runner_manifest_duplicate_json_key',
    );

    const hardLinked = await createManifestFile();
    const secondLink = path.join(hardLinked.directory, 'manifest-hardlink.json');
    await link(hardLinked.file, secondLink);
    await expect(readManifestFileSecure(hardLinked.file)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );
  });

  it('拒绝 owner 不匹配并证明 open 使用 O_NOFOLLOW', async () => {
    const { file } = await createManifestFile();
    await expect(
      readManifestFileSecure(file, {
        currentUid: (process.getuid?.() ?? 0) + 1,
      }),
    ).rejects.toThrow('runner_manifest_file_unsafe');

    let observedFlags = 0;
    await readManifestFileSecure(file, {
      open: async (target, flags) => {
        observedFlags = flags;
        return openFile(target, flags);
      },
    });
    expect(observedFlags & fsConstants.O_NOFOLLOW).toBe(
      fsConstants.O_NOFOLLOW,
    );
  });

  it('拒绝超过 1 MiB 或打开前后身份变化的文件', async () => {
    const large = await createManifestFile('x'.repeat(1024 * 1024 + 1));
    await expect(readManifestFileSecure(large.file)).rejects.toThrow(
      'runner_manifest_file_unsafe',
    );

    const stable = await createManifestFile();
    const stat = await lstat(stable.file, { bigint: true });
    let calls = 0;
    await expect(
      readManifestFileSecure(stable.file, {
        lstat: async () => {
          calls += 1;
          return calls === 1
            ? stat
            : Object.create(stat, {
                size: { value: stat.size + 1n },
              });
        },
      }),
    ).rejects.toThrow('runner_manifest_file_changed');

    let nlinkCalls = 0;
    await expect(
      readManifestFileSecure(stable.file, {
        lstat: async () => {
          nlinkCalls += 1;
          if (nlinkCalls === 1) return stat;
          return new Proxy(stat, {
            get(target, property) {
              if (property === 'nlink') return 2n;
              const value = Reflect.get(target, property);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        },
      }),
    ).rejects.toThrow('runner_manifest_file_unsafe');
  });
});

describe('MIG-01A2 Provisioning CLI fail-closed 输出', () => {
  it('dry-run 只输出五项低敏守恒计数', async () => {
    const { file } = await createManifestFile();
    const stdout = [];
    const stderr = [];
    let writeTouched = false;
    const transactionPort = {
      read: async (work) =>
        work({
          tenantExists: async () => true,
          readTriplet: async () => ({
            scopes: [],
            versions: [],
            heads: [],
          }),
          insertScope: async () => {
            writeTouched = true;
            return 1;
          },
          insertContextVersion: async () => {
            writeTouched = true;
            return 1;
          },
          insertContextHead: async () => {
            writeTouched = true;
            return 1;
          },
        }),
      write: async () => {
        writeTouched = true;
        throw new Error('dry-run must not write');
      },
    };

    const exitCode = await runProvisioningCli({
      argv: ['--manifest-file', file],
      contextPolicy,
      transactionPort,
      output: {
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0])).toEqual({
      input: 1,
      insertedCandidate: 1,
      reusedCandidate: 0,
      conflict: 0,
      unexpected: 0,
    });
    expect(writeTouched).toBe(false);
  });

  it('缺少批准集合、Repository 或执行授权时只输出固定错误码', async () => {
    const { file } = await createManifestFile();

    for (const [options, expectedCode] of [
      [{}, 'runner_context_policy_unavailable'],
      [{ contextPolicy }, 'runner_repository_adapter_unavailable'],
      [{
        contextPolicy,
        transactionPort: {
          read: async () => {
            throw new Error('not expected');
          },
          write: async () => {
            throw new Error('not expected');
          },
        },
        argv: ['--execute', '--manifest-file', file],
      }, 'runner_execution_authorization_unavailable'],
    ]) {
      const stdout = [];
      const stderr = [];
      const exitCode = await runProvisioningCli({
        argv: options.argv ?? ['--manifest-file', file],
        ...options,
        output: {
          stdout: (line) => stdout.push(line),
          stderr: (line) => stderr.push(line),
        },
      });
      expect(exitCode).not.toBe(0);
      expect(stdout).toEqual([]);
      expect(stderr).toHaveLength(1);
      expect(JSON.parse(stderr[0])).toEqual({
        code: expectedCode,
      });
      expect(stderr[0]).not.toContain(file);
      expect(stderr[0]).not.toContain('tenant-fixture');
    }
  });

  it('忽略环境变量中的正文，并屏蔽 Repository 原始异常', async () => {
    const { file } = await createManifestFile();
    const environmentKey = 'MIG01_A2_MANIFEST_BODY_TEST_ONLY';
    const syntheticBody = 'synthetic-secret-marker-must-not-leak';
    const previous = process.env[environmentKey];
    process.env[environmentKey] = syntheticBody;
    const stdout = [];
    const stderr = [];
    try {
      const exitCode = await runProvisioningCli({
        argv: ['--manifest-file', file],
        contextPolicy,
        transactionPort: {
          read: async () => {
            throw new Error(syntheticBody);
          },
          write: async () => {
            throw new Error(syntheticBody);
          },
        },
        output: {
          stdout: (line) => stdout.push(line),
          stderr: (line) => stderr.push(line),
        },
      });
      expect(exitCode).not.toBe(0);
      expect(stdout).toEqual([]);
      expect(stderr).toEqual([
        JSON.stringify({ code: 'runner_provisioning_unavailable' }),
      ]);
      expect(stderr.join('')).not.toContain(syntheticBody);
    } finally {
      if (previous === undefined) {
        delete process.env[environmentKey];
      } else {
        process.env[environmentKey] = previous;
      }
    }
  });
});
