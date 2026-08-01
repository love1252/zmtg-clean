import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import nodeTest from 'node:test';

const checkerPath = path.resolve(
  process.cwd(),
  'scripts/verify/architecture-quality.mjs',
);
const runningUnderVitest = process.env.VITEST === 'true';
const test = runningUnderVitest ? () => undefined : nodeTest;

if (runningUnderVitest) {
  const { test: vitestTest } = await import('vitest');
  vitestTest('完整 Vitest 基线可识别专用 Node 自测入口', () => {
    const result = run(process.execPath, [checkerPath], process.cwd());
    assert.equal(result.status, 2, resultDetails(result));
    assert.match(result.output, /必须同时提供 --base 与 --head/);
  });
}

const validRules = Object.freeze({
  version: 1,
  exceptions: [],
});

const rulesPath = 'scripts/verify/architecture-quality-rules.json';
const internalDependencyTargets = Object.freeze({
  'src/app/bootstrap.ts': 'export const bootstrap = true;\n',
  'src/server/db/client.ts': [
    'export const database = true;',
    'export default database;',
    '',
  ].join('\n'),
  'src/integrations/his/client.ts':
    'export const integration = true;\n',
});
const membershipSchemaFixture = Object.freeze({
  'src/server/db/schema.ts':
    'export const tenantMembers = { tableName: "tenant_members" };\n',
});

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout: options.timeout ?? 20_000,
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function runGit(repository, args, expectedStatus = 0) {
  const result = run('git', args, repository);
  assert.equal(
    result.status,
    expectedStatus,
    [
      `git ${args.join(' ')} 的退出码不符合预期`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'),
  );
  return result.stdout.trim();
}

function resolveFixturePath(repository, relativePath) {
  const resolved = path.resolve(repository, relativePath);
  assert.ok(
    resolved.startsWith(`${path.resolve(repository)}${path.sep}`),
    `fixture 路径必须位于临时仓库内：${relativePath}`,
  );
  return resolved;
}

async function writeFixtureFile(repository, relativePath, content) {
  const target = resolveFixturePath(repository, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function removeFixtureFile(repository, relativePath) {
  await rm(resolveFixturePath(repository, relativePath), {
    force: true,
    recursive: true,
  });
}

async function applyFixtureChanges(repository, changes) {
  for (const [relativePath, content] of Object.entries(changes)) {
    if (content === null) {
      await removeFixtureFile(repository, relativePath);
    } else {
      await writeFixtureFile(repository, relativePath, content);
    }
  }
}

function commitAll(repository, message) {
  runGit(repository, ['add', '-A']);
  runGit(repository, [
    'commit',
    '--quiet',
    '--no-gpg-sign',
    '-m',
    message,
  ]);
  return runGit(repository, ['rev-parse', 'HEAD']);
}

async function createRepository(t, initialFiles = {}) {
  const repository = await mkdtemp(
    path.join(tmpdir(), 'zmtg-architecture-quality-'),
  );

  t.after(async () => {
    await rm(repository, { force: true, recursive: true });
  });

  runGit(repository, ['init', '--quiet', '--initial-branch=main']);
  runGit(repository, ['config', 'user.name', 'Architecture Quality Test']);
  runGit(repository, [
    'config',
    'user.email',
    'architecture-quality@example.invalid',
  ]);

  await applyFixtureChanges(repository, {
    'README.md': '# 临时架构门禁仓库\n',
    [rulesPath]: `${JSON.stringify(validRules, null, 2)}\n`,
    ...initialFiles,
  });

  const base = commitAll(repository, 'test: 初始化临时仓库');
  return { repository, base };
}

async function commitChanges(context, changes, message = 'test: 更新 fixture') {
  await applyFixtureChanges(context.repository, changes);
  return commitAll(context.repository, message);
}

async function renameAndCommit(
  context,
  source,
  target,
  message = 'test: 重命名 fixture',
) {
  await mkdir(path.dirname(resolveFixturePath(context.repository, target)), {
    recursive: true,
  });
  runGit(context.repository, ['mv', source, target]);
  return commitAll(context.repository, message);
}

async function copyAndCommit(
  context,
  source,
  target,
  message = 'test: 复制 fixture',
) {
  const targetPath = resolveFixturePath(context.repository, target);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(resolveFixturePath(context.repository, source), targetPath);
  return commitAll(context.repository, message);
}

async function runChecker(
  context,
  {
    base = context.base,
    head,
    args,
    config,
  } = {},
) {
  let effectiveHead =
    head ?? runGit(context.repository, ['rev-parse', 'HEAD']);

  if (config !== undefined) {
    const currentHead = runGit(context.repository, ['rev-parse', 'HEAD']);
    assert.equal(
      currentHead,
      effectiveHead,
      '自定义配置必须提交到当前被测 Head，禁止从工作树或环境覆盖读取',
    );
    await writeFixtureFile(
      context.repository,
      rulesPath,
      typeof config === 'string'
        ? config
        : `${JSON.stringify(config, null, 2)}\n`,
    );
    effectiveHead = commitAll(context.repository, 'test: 更新架构规则配置');
  }

  return run(
    process.execPath,
    [
      checkerPath,
      ...(args ?? ['--base', base, '--head', effectiveHead]),
    ],
    context.repository,
  );
}

function resultDetails(result) {
  return [
    `退出码：${result.status}`,
    `stdout：${result.stdout}`,
    `stderr：${result.stderr}`,
  ].join('\n');
}

function assertPassed(result) {
  assert.equal(result.status, 0, resultDetails(result));
}

function assertViolation(result, ...ruleIds) {
  assert.equal(result.status, 1, resultDetails(result));
  for (const ruleId of ruleIds) {
    assert.match(result.output, new RegExp(`\\[${ruleId}\\]`));
  }
}

function assertCheckerError(result) {
  assert.equal(result.status, 2, resultDetails(result));
  assert.match(result.output, /架构质量检查错误/);
}

function exceptionMetadata(overrides = {}) {
  return {
    taskId: 'V2-QUALITY-CI-01-TEST',
    reason: '验证精确例外只能豁免单一违规身份',
    owner: 'architecture',
    reviewCondition: 'fixture 测试结束后立即删除',
    ...overrides,
  };
}

test('CLI 强制要求唯一的 --base 与 --head 参数', async (t) => {
  const context = await createRepository(t);

  await t.test('接受 pnpm 传入的单个前置分隔符', async () => {
    assertPassed(
      await runChecker(context, {
        args: [
          '--',
          '--base',
          context.base,
          '--head',
          context.base,
        ],
      }),
    );
  });

  const cases = [
    {
      name: '缺少全部参数',
      args: [],
    },
    {
      name: '缺少 Head',
      args: ['--base', context.base],
    },
    {
      name: '缺少 Base',
      args: ['--head', context.base],
    },
    {
      name: '未知参数',
      args: ['--base', context.base, '--head', context.base, '--unknown'],
    },
    {
      name: '重复分隔符',
      args: [
        '--',
        '--',
        '--base',
        context.base,
        '--head',
        context.base,
      ],
    },
    {
      name: '重复 Base',
      args: [
        '--base',
        context.base,
        '--base',
        context.base,
        '--head',
        context.base,
      ],
    },
    {
      name: '重复 Head',
      args: [
        '--base',
        context.base,
        '--head',
        context.base,
        '--head',
        context.base,
      ],
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      assertCheckerError(
        await runChecker(context, {
          args: item.args,
        }),
      );
    });
  }
});

test('Git ref、对象类型与共同历史异常均 fail-closed', async (t) => {
  await t.test('无法解析的 ref 返回退出码 2', async (subtest) => {
    const context = await createRepository(subtest);
    assertCheckerError(
      await runChecker(context, {
        args: [
          '--base',
          'refs/heads/not-found',
          '--head',
          context.base,
        ],
      }),
    );
  });

  await t.test('blob 对象不能冒充 commit', async (subtest) => {
    const context = await createRepository(subtest);
    await writeFixtureFile(
      context.repository,
      'blob-source.txt',
      '不是 commit\n',
    );
    const blob = runGit(context.repository, [
      'hash-object',
      '-w',
      'blob-source.txt',
    ]);
    await removeFixtureFile(context.repository, 'blob-source.txt');

    assertCheckerError(
      await runChecker(context, {
        args: ['--base', context.base, '--head', blob],
      }),
    );
  });

  await t.test('没有共同历史的两个 commit 被拒绝', async (subtest) => {
    const context = await createRepository(subtest);
    runGit(context.repository, ['switch', '--quiet', '--orphan', 'unrelated']);
    await writeFixtureFile(
      context.repository,
      'UNRELATED.md',
      '# 无共同历史\n',
    );
    await writeFixtureFile(
      context.repository,
      rulesPath,
      `${JSON.stringify(validRules, null, 2)}\n`,
    );
    const unrelatedHead = commitAll(
      context.repository,
      'test: 创建无共同历史提交',
    );

    assertCheckerError(
      await runChecker(context, {
        base: context.base,
        head: unrelatedHead,
      }),
    );
  });
});

test('配置格式、版本、键、规则和例外元数据严格校验', async (t) => {
  const context = await createRepository(t, {
    'src/modules/institution/allowed.ts':
      'export const existingAllowedFile = true;\n',
  });
  const metadata = exceptionMetadata();
  const cases = [
    {
      name: 'JSON 语法错误',
      config: '{"version":1,"exceptions":[',
    },
    {
      name: '版本错误',
      config: { version: 2, exceptions: [] },
    },
    {
      name: '未知顶层键',
      config: { version: 1, exceptions: [], allowAll: true },
    },
    {
      name: '未知规则',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ999_UNKNOWN',
            path: 'src/modules/care/new.ts',
            ...metadata,
          },
        ],
      },
    },
    {
      name: '空任务编号',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...exceptionMetadata({ taskId: '' }),
          },
        ],
      },
    },
    {
      name: '空原因',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...exceptionMetadata({ reason: '   ' }),
          },
        ],
      },
    },
    {
      name: '空所有者',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...exceptionMetadata({ owner: '' }),
          },
        ],
      },
    },
    {
      name: '空复核条件',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...exceptionMetadata({ reviewCondition: '' }),
          },
        ],
      },
    },
    {
      name: 'path 通配符',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/**',
            ...metadata,
          },
        ],
      },
    },
    {
      name: '目录前缀不能冒充精确文件 path',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution',
            ...metadata,
          },
        ],
      },
    },
    {
      name: '依赖边通配符',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
            from: 'src/modules/care/application/*.ts',
            to: 'src/modules/customers/server/repository.ts',
            ...metadata,
          },
        ],
      },
    },
    {
      name: 'path 与依赖边 shape 混用',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
            path: 'src/modules/care/application/service.ts',
            from: 'src/modules/care/application/service.ts',
            to: 'src/modules/customers/server/repository.ts',
            ...metadata,
          },
        ],
      },
    },
    {
      name: '路径规则错误使用依赖边 shape',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            from: 'src/modules/institution/allowed.ts',
            to: 'src/modules/customers/domain/customer.ts',
            ...metadata,
          },
        ],
      },
    },
    {
      name: '重复例外',
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...metadata,
          },
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: 'src/modules/institution/allowed.ts',
            ...metadata,
          },
        ],
      },
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      assertCheckerError(
        await runChecker(context, {
          config: item.config,
        }),
      );
    });
  }
});

test('五条新增路径规则分别阻止第二数据库、legacy Route 与冻结模块文件', async (t) => {
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    'database/new/schema.ts': 'export const schema = true;\n',
    'src/app/api/institution/customers/route.ts':
      'export function GET() { return new Response(); }\n',
    'src/app/api/open-platform/accounts/route.ts':
      'export function GET() { return new Response(); }\n',
    'src/modules/institution/new-owner.ts':
      'export const institutionOwner = true;\n',
    'src/modules/open-platform/new-owner.ts':
      'export const platformOwner = true;\n',
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ001_SECOND_DATABASE_ROOT',
    'AQ002_NEW_INSTITUTION_LEGACY_ROUTE',
    'AQ003_NEW_PLATFORM_LEGACY_ROUTE',
    'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
    'AQ005_FROZEN_PLATFORM_MODULE_NEW_FILE',
  );
});

test('精确 path 例外只豁免完全匹配的单一文件', async (t) => {
  const metadata = exceptionMetadata();

  await t.test('完全匹配的文件可以通过', async (subtest) => {
    const context = await createRepository(subtest);
    const allowedPath = 'src/modules/institution/allowed.ts';
    const head = await commitChanges(context, {
      [allowedPath]: 'export const allowed = true;\n',
    });

    assertPassed(
      await runChecker(context, {
        head,
        config: {
          version: 1,
          exceptions: [
            {
              ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
              path: allowedPath,
              ...metadata,
            },
          ],
        },
      }),
    );
  });

  await t.test('相邻文件仍然失败', async (subtest) => {
    const context = await createRepository(subtest);
    const allowedPath = 'src/modules/institution/allowed.ts';
    const siblingPath = 'src/modules/institution/sibling.ts';
    const head = await commitChanges(context, {
      [allowedPath]: 'export const allowed = true;\n',
      [siblingPath]: 'export const sibling = true;\n',
    });
    const result = await runChecker(context, {
      head,
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
            path: allowedPath,
            ...metadata,
          },
        ],
      },
    });

    assertViolation(result, 'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE');
    assert.match(result.output, /src\/modules\/institution\/sibling\.ts/);
    assert.doesNotMatch(result.output, /src\/modules\/institution\/allowed\.ts/);
  });
});

test('Domain 新增到 app、db、integrations、React 与 Next.js 的依赖均失败', async (t) => {
  const context = await createRepository(t, internalDependencyTargets);
  const source = 'src/modules/care/domain/forbidden-dependencies.ts';
  const head = await commitChanges(context, {
    [source]: [
      "import '@/app/bootstrap';",
      "import database from '@/server/db/client';",
      "export { integration } from '@/integrations/his/client';",
      "export * from 'react';",
      "export const nextRuntime = import('next/server');",
      'export { database };',
      '',
    ].join('\n'),
  });
  const result = await runChecker(context, { head });

  assertViolation(result, 'AQ006_DOMAIN_LAYER_DEPENDENCY');
  for (const target of [
    'src/app/bootstrap',
    'src/server/db/client',
    'src/integrations/his/client',
    'package:react',
    'package:next',
  ]) {
    assert.match(result.output, new RegExp(target.replaceAll('/', '\\/')));
  }
});

test('跨业务模块 server 与 Repository 实现依赖均失败', async (t) => {
  const context = await createRepository(t, {
    'src/modules/customers/server/customer-reader.ts':
      'export const customerReader = true;\n',
    'src/modules/conversations/infrastructure/ConversationRepository.ts':
      'export const conversationRepository = true;\n',
    'src/modules/analytics/infrastructure/repositories/report.ts':
      'export const reportRepository = true;\n',
  });
  const head = await commitChanges(context, {
    'src/modules/care/application/care-service.ts': [
      "import { customerReader } from '@/modules/customers/server/customer-reader';",
      "import { conversationRepository } from '@/modules/conversations/infrastructure/ConversationRepository';",
      "import { reportRepository } from '@/modules/analytics/infrastructure/repositories/report';",
      'export { customerReader, conversationRepository, reportRepository };',
      '',
    ].join('\n'),
  });
  const result = await runChecker(context, { head });

  assertViolation(result, 'AQ007_CROSS_MODULE_SERVER_REPOSITORY');
  assert.match(result.output, /customers\/server\/customer-reader/);
  assert.match(result.output, /ConversationRepository/);
  assert.match(result.output, /repositories\/report/);
});

test('精确依赖边例外不放宽同模块的相邻来源文件', async (t) => {
  const target = 'src/modules/customers/server/customer-repository.ts';
  const allowedSource = 'src/modules/care/application/allowed-service.ts';
  const siblingSource = 'src/modules/care/application/sibling-service.ts';
  const importLine =
    "import { repository } from '@/modules/customers/server/customer-repository';\n";
  const metadata = exceptionMetadata();

  await t.test('完全匹配的 from/to 边可以通过', async (subtest) => {
    const context = await createRepository(subtest, {
      [target]: 'export const repository = true;\n',
    });
    const head = await commitChanges(context, {
      [allowedSource]: importLine,
    });

    assertPassed(
      await runChecker(context, {
        head,
        config: {
          version: 1,
          exceptions: [
            {
              ruleId: 'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
              from: allowedSource,
              to: target,
              ...metadata,
            },
          ],
        },
      }),
    );
  });

  await t.test('相邻来源的相同目标边仍然失败', async (subtest) => {
    const context = await createRepository(subtest, {
      [target]: 'export const repository = true;\n',
    });
    const head = await commitChanges(context, {
      [allowedSource]: importLine,
      [siblingSource]: importLine,
    });
    const result = await runChecker(context, {
      head,
      config: {
        version: 1,
        exceptions: [
          {
            ruleId: 'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
            from: allowedSource,
            to: target,
            ...metadata,
          },
        ],
      },
    });

    assertViolation(result, 'AQ007_CROSS_MODULE_SERVER_REPOSITORY');
    assert.match(result.output, /sibling-service\.ts/);
    assert.doesNotMatch(result.output, /allowed-service\.ts/);
  });
});

test('未修改的历史债务不会使增量检查失败', async (t) => {
  const context = await createRepository(t, {
    'database/historical/schema.ts': 'export const historical = true;\n',
    'src/modules/care/domain/historical-debt.ts': [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    'docs/change.md': '# 仅修改无关文档\n',
  });

  assertPassed(await runChecker(context, { head }));
});

test('旧文件正常修改不会重复清算既有违规依赖边', async (t) => {
  const source = 'src/modules/care/domain/existing-debt.ts';
  const context = await createRepository(t, {
    [source]: [
      "import React from 'react';",
      'export const version = 1;',
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    [source]: [
      "import React from 'react';",
      'export const version = 2;',
      'export { React };',
      '',
    ].join('\n'),
  });

  assertPassed(await runChecker(context, { head }));
});

test('修改旧文件时只有本次新增的违规依赖边失败', async (t) => {
  const source = 'src/modules/care/domain/existing-debt.ts';
  const context = await createRepository(t, {
    [source]: [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    [source]: [
      "import React from 'react';",
      "import nextRuntime from 'next/server';",
      'export { React, nextRuntime };',
      '',
    ].join('\n'),
  });
  const result = await runChecker(context, { head });

  assertViolation(result, 'AQ006_DOMAIN_LAYER_DEPENDENCY');
  assert.match(result.output, /package:next/);
  assert.doesNotMatch(result.output, /package:react/);
});

test('新文件的全部依赖边都按新增边检查', async (t) => {
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    'src/modules/care/domain/new-domain.ts': [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ006_DOMAIN_LAYER_DEPENDENCY',
  );
});

test('纯重命名保留依赖连续性，不重复清算既有违规边', async (t) => {
  const context = await createRepository(t, {
    'src/modules/care/domain/old-name.ts': [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await renameAndCommit(
    context,
    'src/modules/care/domain/old-name.ts',
    'src/modules/care/domain/new-name.ts',
  );

  assertPassed(await runChecker(context, { head }));
});

test('同一受限根内纯重命名不被误报为新增文件', async (t) => {
  const context = await createRepository(t, {
    'src/modules/institution/old-name.ts':
      'export const historicalOwner = true;\n',
  });
  const head = await renameAndCommit(
    context,
    'src/modules/institution/old-name.ts',
    'src/modules/institution/new-name.ts',
  );

  assertPassed(await runChecker(context, { head }));
});

test('重命名同时新增违规依赖边仍然失败', async (t) => {
  const source = 'src/modules/care/domain/old-name.ts';
  const target = 'src/modules/care/domain/new-name.ts';
  const context = await createRepository(t, {
    [source]: [
      "import React from 'react';",
      'export const unchanged1 = 1;',
      'export const unchanged2 = 2;',
      'export const unchanged3 = 3;',
      'export const unchanged4 = 4;',
      'export const unchanged5 = 5;',
      'export const unchanged6 = 6;',
      'export { React };',
      '',
    ].join('\n'),
  });
  await mkdir(path.dirname(resolveFixturePath(context.repository, target)), {
    recursive: true,
  });
  runGit(context.repository, ['mv', source, target]);
  await writeFixtureFile(
    context.repository,
    target,
    [
      "import React from 'react';",
      "import nextRuntime from 'next/server';",
      'export const unchanged1 = 1;',
      'export const unchanged2 = 2;',
      'export const unchanged3 = 3;',
      'export const unchanged4 = 4;',
      'export const unchanged5 = 5;',
      'export const unchanged6 = 6;',
      'export { React, nextRuntime };',
      '',
    ].join('\n'),
  );
  const head = commitAll(context.repository, 'test: 重命名并新增依赖边');
  const result = await runChecker(context, { head });

  assertViolation(result, 'AQ006_DOMAIN_LAYER_DEPENDENCY');
  assert.match(result.output, /package:next/);
  assert.doesNotMatch(result.output, /package:react/);
});

test('重命名改变来源身份并使既有边首次违规时失败', async (t) => {
  const source = 'src/modules/care/application/react-view.ts';
  const target = 'src/modules/care/domain/react-view.ts';
  const context = await createRepository(t, {
    [source]: [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await renameAndCommit(context, source, target);

  assertViolation(
    await runChecker(context, { head }),
    'AQ006_DOMAIN_LAYER_DEPENDENCY',
  );
});

test('复制旧文件按新文件检查其全部依赖边', async (t) => {
  const source = 'src/modules/care/domain/original.ts';
  const context = await createRepository(t, {
    [source]: [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });
  const head = await copyAndCommit(
    context,
    source,
    'src/modules/care/domain/copied.ts',
  );

  assertViolation(
    await runChecker(context, { head }),
    'AQ006_DOMAIN_LAYER_DEPENDENCY',
  );
});

test('删除受限路径文件本身不会被误报为新增违规', async (t) => {
  const context = await createRepository(t, {
    'src/app/api/institution/historical/route.ts':
      'export function GET() { return new Response(); }\n',
  });
  const head = await commitChanges(context, {
    'src/app/api/institution/historical/route.ts': null,
  });

  assertPassed(await runChecker(context, { head }));
});

test('迁出受限路径通过，迁入受限路径失败', async (t) => {
  await t.test('从 database 迁出不触发新增规则', async (subtest) => {
    const context = await createRepository(subtest, {
      'database/historical.ts': 'export const historical = true;\n',
    });
    const head = await renameAndCommit(
      context,
      'database/historical.ts',
      'archive/historical.ts',
    );

    assertPassed(await runChecker(context, { head }));
  });

  await t.test('重命名迁入 database 按新增处理', async (subtest) => {
    const context = await createRepository(subtest, {
      'archive/schema.ts': 'export const schema = true;\n',
    });
    const head = await renameAndCommit(
      context,
      'archive/schema.ts',
      'database/schema.ts',
    );

    assertViolation(
      await runChecker(context, { head }),
      'AQ001_SECOND_DATABASE_ROOT',
    );
  });
});

test('正常 /api/v1 路由不被 legacy Route 规则误报', async (t) => {
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    'src/app/api/v1/institution/customers/route.ts':
      'export function GET() { return new Response(); }\n',
    'src/app/api/v1/open-platform/accounts/route.ts':
      'export function GET() { return new Response(); }\n',
  });

  assertPassed(await runChecker(context, { head }));
});

test('TypeScript AST 覆盖静态、side-effect、re-export 与动态 import', async (t) => {
  const cases = [
    {
      name: '静态 import',
      source: "import nextRuntime from 'next/server';\nexport { nextRuntime };\n",
    },
    {
      name: 'side-effect import',
      source: "import '@/app/bootstrap';\nexport const loaded = true;\n",
    },
    {
      name: 'export from',
      source: "export { database } from '@/server/db/client';\n",
    },
    {
      name: 'export star',
      source: "export * from '@/integrations/his/client';\n",
    },
    {
      name: '动态 import 字面量',
      source:
        "export async function load() { return import('@/server/db/client'); }\n",
    },
    {
      name: 'TSX 隐式 React Runtime',
      source: 'export const view = <div>domain</div>;\n',
      extension: 'tsx',
    },
  ];

  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async (subtest) => {
      const context = await createRepository(
        subtest,
        internalDependencyTargets,
      );
      const head = await commitChanges(context, {
        [`src/modules/care/domain/ast-${index}.${item.extension ?? 'ts'}`]:
          item.source,
      });

      assertViolation(
        await runChecker(context, { head }),
        'AQ006_DOMAIN_LAYER_DEPENDENCY',
      );
    });
  }
});

test('alias、相对路径和含空格路径均可靠处理', async (t) => {
  const context = await createRepository(t, internalDependencyTargets);
  const head = await commitChanges(context, {
    'src/modules/care/domain/alias.ts':
      "import '@/app/bootstrap';\nexport const alias = true;\n",
    'src/modules/care/domain/relative.ts':
      "import '../../../server/db/client';\nexport const relative = true;\n",
    'src/modules/care/domain/space name.ts':
      "import nextRuntime from 'next/server';\nexport { nextRuntime };\n",
  });
  const result = await runChecker(context, { head });

  assertViolation(result, 'AQ006_DOMAIN_LAYER_DEPENDENCY');
  assert.match(result.output, /alias\.ts/);
  assert.match(result.output, /relative\.ts/);
  assert.match(result.output, /space name\.ts/);
});

test('tsconfig baseUrl 的 src/ 导入仍按仓库内部依赖检查', async (t) => {
  const context = await createRepository(t, internalDependencyTargets);
  const head = await commitChanges(context, {
    'src/modules/care/domain/base-url.ts':
      "import database from 'src/server/db/client';\nexport { database };\n",
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ006_DOMAIN_LAYER_DEPENDENCY',
  );
});

test('测试文件不作为生产依赖来源参与 AQ006 与 AQ007', async (t) => {
  const context = await createRepository(t, {
    'src/modules/customers/server/customer-repository.ts':
      'export const repository = true;\n',
  });
  const head = await commitChanges(context, {
    'src/modules/care/tests/architecture-boundary.test.ts': [
      "import nextRuntime from 'next/server';",
      "import { repository } from '@/modules/customers/server/customer-repository';",
      'export { nextRuntime, repository };',
      '',
    ].join('\n'),
    'src/modules/care/domain/domain-boundary.test.ts': [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });

  assertPassed(await runChecker(context, { head }));
});

test('生产 TypeScript 语法解析失败时 fail-closed', async (t) => {
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    'src/modules/care/domain/broken.ts':
      "import { missing from '@/server/db/client';\n",
  });

  assertCheckerError(await runChecker(context, { head }));
});

test('生产 TypeScript 的非字面量动态依赖无法归一化时 fail-closed', async (t) => {
  const cases = [
    {
      name: '动态 import 非字面量',
      source:
        "const target = '@/server/db/client';\nexport const loaded = import(target);\n",
    },
    {
      name: 'require 非字面量',
      source:
        "const target = '@/server/db/client';\nexport const loaded = require(target);\n",
    },
  ];

  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async (subtest) => {
      const context = await createRepository(subtest);
      const head = await commitChanges(context, {
        [`src/modules/care/application/non-literal-${index}.ts`]: item.source,
      });

      assertCheckerError(await runChecker(context, { head }));
    });
  }
});

test('检查器读取 commit blob，不受 Head 提交后的工作树内容影响', async (t) => {
  const source = 'src/modules/care/domain/committed-violation.ts';
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    [source]: [
      "import React from 'react';",
      'export { React };',
      '',
    ].join('\n'),
  });

  await writeFixtureFile(
    context.repository,
    source,
    'export const worktreeLooksSafe = true;\n',
  );

  assertViolation(
    await runChecker(context, { head }),
    'AQ006_DOMAIN_LAYER_DEPENDENCY',
  );
});

test('规则配置读取 Head commit blob，不受工作树配置污染', async (t) => {
  const context = await createRepository(t);
  const head = await commitChanges(context, {
    'docs/safe-change.md': '# 安全变更\n',
  });

  await writeFixtureFile(
    context.repository,
    rulesPath,
    '{"version":1,"exceptions":[',
  );

  assertPassed(await runChecker(context, { head }));
});

test('AQ008 识别 Drizzle Membership insert、update、delete 与别名', async (t) => {
  const cases = [
    {
      name: 'named import insert',
      source: [
        "import { tenantMembers } from '@/server/db/schema';",
        'export const write = (db) => db.insert(tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: 'named alias update',
      source: [
        "import { tenantMembers as membershipCurrent } from '@/server/db/schema';",
        'export const write = (db) => db.update(membershipCurrent);',
        '',
      ].join('\n'),
    },
    {
      name: 'namespace delete',
      source: [
        "import * as tables from '@/server/db/schema';",
        'export const write = (db) => db.delete(tables.tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: 'local alias delete',
      source: [
        "import { tenantMembers } from '@/server/db/schema';",
        'const currentMembership = tenantMembers;',
        'export const write = (db) => db.delete(currentMembership);',
        '',
      ].join('\n'),
    },
  ];

  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async (subtest) => {
      const context = await createRepository(subtest, membershipSchemaFixture);
      const head = await commitChanges(context, {
        [`src/server/membership-writer-${index}.ts`]: item.source,
      });

      assertViolation(
        await runChecker(context, { head }),
        'AQ008_MEMBERSHIP_DIRECT_WRITER',
      );
    });
  }
});

test('AQ008 识别 raw SQL 四类写入、引号与 schema qualified 目标', async (t) => {
  const statements = [
    'INSERT INTO tenant_members (id) VALUES (1)',
    'UPDATE ONLY public.tenant_members SET id = 1',
    'DELETE FROM "public"."tenant_members" WHERE id = 1',
    'TRUNCATE TABLE "tenant_members"',
    'TRUNCATE TABLE tenant_members, audit_events',
  ];

  for (const [index, statement] of statements.entries()) {
    await t.test(statement.split(' ')[0], async (subtest) => {
      const context = await createRepository(subtest);
      const head = await commitChanges(context, {
        [`scripts/future-membership-raw-${index}.ts`]: [
          'export const write = (sql) =>',
          `  sql\`${statement}\`;`,
          '',
        ].join('\n'),
      });

      assertViolation(
        await runChecker(context, { head }),
        'AQ008_MEMBERSHIP_DIRECT_WRITER',
      );
    });
  }
});

test('AQ008 追踪本地 mutation helper 的动态表参数与 wrapper', async (t) => {
  const context = await createRepository(t, membershipSchemaFixture);
  const head = await commitChanges(context, {
    'scripts/future-membership-helper.ts': [
      "import { tenantMembers as current } from '@/server/db/schema';",
      'async function insertRows(db, tableName, rows) {',
      '  return db`insert into ${db(tableName)} ${db(rows)}`;',
      '}',
      'function wrapper(db, target, rows) {',
      '  return insertRows(db, target, rows);',
      '}',
      'export const writeLiteral = (db, rows) => wrapper(db, "tenant_members", rows);',
      'export const writeBinding = (db, rows) => wrapper(db, current, rows);',
      '',
    ].join('\n'),
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});

test('AQ008 识别导入 mutation helper 的 tenant_members 字面量目标', async (t) => {
  const context = await createRepository(t, {
    'scripts/writer-helper.ts': [
      'export const insertRows = (db, target, rows) =>',
      '  db.insert(target).values(rows);',
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    'scripts/future-membership-imported-helper.ts': [
      "import { insertRows } from './writer-helper';",
      'export const write = (db, rows) => insertRows(db, "tenant_members", rows);',
      '',
    ].join('\n'),
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});

test('AQ008 拒绝 Membership 间接别名、SQL 与 helper 绕过', async (t) => {
  const cases = [
    {
      name: 'barrel 重导出',
      initial: {
        ...membershipSchemaFixture,
        'src/server/db/index.ts':
          "export { tenantMembers } from './schema';\n",
      },
      source: [
        "import { tenantMembers as current } from '@/server/db';",
        'export const write = (db) => db.insert(current);',
        '',
      ].join('\n'),
    },
    {
      name: 'namespace 解构',
      initial: membershipSchemaFixture,
      source: [
        "import * as tables from '@/server/db/schema';",
        'const { tenantMembers: current } = tables;',
        'export const write = (db) => db.delete(current);',
        '',
      ].join('\n'),
    },
    {
      name: '赋值别名',
      initial: membershipSchemaFixture,
      source: [
        "import { tenantMembers } from '@/server/db/schema';",
        'let current;',
        'current = tenantMembers;',
        'export const write = (db) => db.update(current);',
        '',
      ].join('\n'),
    },
    {
      name: 'const SQL',
      initial: {},
      source: [
        "const statement = 'DELETE FROM tenant_members';",
        'export const write = (client) => client.query(statement);',
        '',
      ].join('\n'),
    },
    {
      name: '对象 helper',
      initial: membershipSchemaFixture,
      source: [
        "import { tenantMembers } from '@/server/db/schema';",
        'function insertRows(db, target) { return db.insert(target); }',
        'const helpers = { insertRows };',
        'export const write = (db) => helpers.insertRows(db, tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: '类 helper',
      initial: membershipSchemaFixture,
      source: [
        "import { tenantMembers } from '@/server/db/schema';",
        'class Writer {',
        '  insertRows(db, target) { return db.insert(target); }',
        '}',
        'export const write = (db) => new Writer().insertRows(db, tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: 'identifier 数组',
      initial: {},
      source: [
        'export const write = (sql) =>',
        "  sql`DELETE FROM ${sql.identifier(['tenant_members'])}`;",
        '',
      ].join('\n'),
    },
    {
      name: 'TRUNCATE 非首位目标',
      initial: {},
      source: [
        'export const write = (sql) =>',
        '  sql`TRUNCATE TABLE audit_events, tenant_members`;',
        '',
      ].join('\n'),
    },
    {
      name: 'TRUNCATE 非首位动态目标',
      initial: {},
      source: [
        'export const write = (sql) =>',
        "  sql`TRUNCATE TABLE audit_events, ${sql.identifier(['tenant_members'])}`;",
        '',
      ].join('\n'),
    },
    {
      name: 'query 对象参数',
      initial: {},
      source: [
        'export const write = (client) =>',
        "  client.query({ text: 'DELETE FROM tenant_members' });",
        '',
      ].join('\n'),
    },
    {
      name: 'query shorthand 参数',
      initial: {},
      source: [
        "const text = 'DELETE FROM tenant_members';",
        'export const write = (client) => client.query({ text });',
        '',
      ].join('\n'),
    },
    {
      name: 'SQL executor const 别名',
      initial: {},
      source: [
        'export const write = (client) => {',
        '  const first = client;',
        '  const second = first;',
        "  return second.query('DELETE FROM tenant_members');",
        '};',
        '',
      ].join('\n'),
    },
    {
      name: 'SQL tag const 别名',
      initial: {},
      source: [
        'export const write = (sql) => {',
        '  const query = sql;',
        '  return query`DELETE FROM tenant_members`;',
        '};',
        '',
      ].join('\n'),
    },
    {
      name: 'const SQL 词法遮蔽不覆盖真实引用',
      initial: {},
      source: [
        "const statement = 'DELETE FROM tenant_members';",
        'function unrelated() {',
        "  const statement = 'SELECT 1';",
        '  return statement;',
        '}',
        'export const write = (client) => client.query(statement);',
        'export { unrelated };',
        '',
      ].join('\n'),
    },
    {
      name: 'const table helper',
      initial: {},
      source: [
        'function insertRows(db, target) { return db.insert(target); }',
        "const table = 'tenant_members';",
        'export const write = (db) => insertRows(db, table);',
        '',
      ].join('\n'),
    },
    {
      name: '非关键词 helper',
      initial: {},
      source: [
        'function persistRows(db, target) { return db.insert(target); }',
        "export const write = (db) => persistRows(db, 'tenant_members');",
        '',
      ].join('\n'),
    },
    {
      name: '嵌套 helper',
      initial: {},
      source: [
        'export function write(db) {',
        '  function nested(target) { return db.delete(target); }',
        "  return nested('tenant_members');",
        '}',
        '',
      ].join('\n'),
    },
  ];

  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async (subtest) => {
      const context = await createRepository(subtest, item.initial);
      const head = await commitChanges(context, {
        [`src/server/aq008-adversarial-${index}.ts`]: item.source,
      });

      assertViolation(
        await runChecker(context, { head }),
        'AQ008_MEMBERSHIP_DIRECT_WRITER',
      );
    });
  }
});

test('AQ008 拒绝 changed generic sink 激活未修改 Membership caller', async (t) => {
  const context = await createRepository(t, {
    ...membershipSchemaFixture,
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.select().from(target);\n',
    'src/server/existing-caller.ts': [
      "import { tenantMembers } from '@/server/db/schema';",
      "import { mutate } from './generic-helper';",
      'export const run = (db) => mutate(db, tenantMembers);',
      '',
    ].join('\n'),
  });

  const head = await commitChanges(context, {
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.insert(target);\n',
  });

  assertViolation(
    await runChecker(context, { head }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});

test('AQ008 反向扫描经 barrel 重导出的 changed generic sink', async (t) => {
  const context = await createRepository(t, {
    ...membershipSchemaFixture,
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.select().from(target);\n',
    'src/server/generic-index.ts':
      "export { mutate } from './generic-helper';\n",
    'src/server/existing-caller.ts': [
      "import { tenantMembers } from '@/server/db/schema';",
      "import { mutate } from './generic-index';",
      'export const run = (db) => mutate(db, tenantMembers);',
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.insert(target);\n',
  });
  assertViolation(
    await runChecker(context, { head }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});

test('AQ008 只在 changed generic sink 存在 Membership caller 时失败', async (t) => {
  const context = await createRepository(t, {
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.select().from(target);\n',
    'src/server/customer-caller.ts': [
      "import { mutate } from './generic-helper';",
      "export const run = (db) => mutate(db, 'customers');",
      '',
    ].join('\n'),
  });
  const head = await commitChanges(context, {
    'src/server/generic-helper.ts':
      'export const mutate = (db, target) => db.insert(target);\n',
  });
  assertPassed(await runChecker(context, { head }));
});

test('AQ008 反向扫描 default、object 与 class exported sink 的既有 caller', async (t) => {
  const cases = [
    {
      name: 'default function',
      before: 'export default (db, target) => db.select().from(target);\n',
      after: 'export default (db, target) => db.insert(target);\n',
      caller: [
        "import mutate from './generic-helper';",
        "import { tenantMembers } from '@/server/db/schema';",
        'export const run = (db) => mutate(db, tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: 'exported object',
      before: 'export const helpers = { mutate(db, target) { return db.select().from(target); } };\n',
      after: 'export const helpers = { mutate(db, target) { return db.insert(target); } };\n',
      caller: [
        "import { helpers } from './generic-helper';",
        "import { tenantMembers } from '@/server/db/schema';",
        'const { mutate } = helpers;',
        'export const run = (db) => mutate(db, tenantMembers);',
        '',
      ].join('\n'),
    },
    {
      name: 'exported class',
      before: 'export class Writer { mutate(db, target) { return db.select().from(target); } }\n',
      after: 'export class Writer { mutate(db, target) { return db.insert(target); } }\n',
      caller: [
        "import { Writer } from './generic-helper';",
        "import { tenantMembers } from '@/server/db/schema';",
        'const writer = new Writer();',
        'export const run = (db) => writer.mutate(db, tenantMembers);',
        '',
      ].join('\n'),
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async (subtest) => {
      const context = await createRepository(subtest, {
        ...membershipSchemaFixture,
        'src/server/generic-helper.ts': item.before,
        'src/server/existing-caller.ts': item.caller,
      });
      const head = await commitChanges(context, {
        'src/server/generic-helper.ts': item.after,
      });
      assertViolation(
        await runChecker(context, { head }),
        'AQ008_MEMBERSHIP_DIRECT_WRITER',
      );
    });
  }
});

test('AQ008 不误报非 SQL query 与纯文本 tag', async (t) => {
  const cases = [
    "export const find = (search) => search.query('DELETE FROM tenant_members');\n",
    'export const example = String.raw`DELETE FROM tenant_members`;\n',
    "export const writeAuditEvent = (value) => value;\nexport const run = () => writeAuditEvent('tenant_members');\n",
    'export const example = markdown.raw`DELETE FROM tenant_members`;\n',
    [
      "import { tenantMembers } from '@/server/db/schema';",
      'export const write = (db, tenantMembers) => db.insert(tenantMembers);',
      '',
    ].join('\n'),
    [
      "const statement = 'DELETE FROM tenant_members';",
      'export function read(client) {',
      "  const statement = 'SELECT 1';",
      '  return client.query(statement);',
      '}',
      '',
    ].join('\n'),
    [
      "import { tenantMembers } from '@/server/db/schema';",
      "const customers = { tableName: 'customers' };",
      'export function write(db) {',
      '  const tenantMembers = customers;',
      '  return db.insert(tenantMembers);',
      '}',
      '',
    ].join('\n'),
    [
      "import { tenantMembers } from '@/server/db/schema';",
      'const writer = { mutate(db, target) { return db.insert(target); } };',
      'const reader = { mutate(db, target) { return db.select().from(target); } };',
      'export const read = (db) => reader.mutate(db, tenantMembers);',
      'export { writer };',
      '',
    ].join('\n'),
  ];

  for (const [index, source] of cases.entries()) {
    await t.test(String(index), async (subtest) => {
      const context = await createRepository(subtest, membershipSchemaFixture);
      const head = await commitChanges(context, {
        [`src/server/aq008-negative-${index}.ts`]: source,
      });
      assertPassed(await runChecker(context, { head }));
    });
  }
});

test('AQ008 忽略本地 CSS 与 JSON import 的非源码内容', async (t) => {
  const cases = [
    {
      initial: { 'src/app/globals.css': 'body { color: red; }\n' },
      path: 'src/app/layout.tsx',
      source: "import './globals.css';\nexport default function Layout() { return null; }\n",
    },
    {
      initial: { 'src/server/config.json': '{"enabled":true}\n' },
      path: 'src/server/config-reader.ts',
      source: "import config from './config.json';\nexport const enabled = config.enabled;\n",
    },
  ];
  for (const [index, item] of cases.entries()) {
    await t.test(String(index), async (subtest) => {
      const context = await createRepository(subtest, item.initial);
      const head = await commitChanges(context, { [item.path]: item.source });
      assertPassed(await runChecker(context, { head }));
    });
  }
});

test('AQ008 唯一内建 allowlist 不随复制或重命名扩散', async (t) => {
  const ownerPath =
    'src/modules/access-control/server/membership-command-repository.ts';
  const ownerSource = [
    "import { tenantMembers } from '@/server/db/schema';",
    'export const write = (db) => db.insert(tenantMembers);',
    '',
  ].join('\n');

  await t.test('精确 Owner Repository 允许', async (subtest) => {
    const context = await createRepository(subtest, membershipSchemaFixture);
    const head = await commitChanges(context, { [ownerPath]: ownerSource });
    assertPassed(await runChecker(context, { head }));
  });

  await t.test('复制到相邻路径失败', async (subtest) => {
    const context = await createRepository(subtest, {
      ...membershipSchemaFixture,
      [ownerPath]: ownerSource,
    });
    const head = await copyAndCommit(
      context,
      ownerPath,
      'src/modules/access-control/server/membership-command-repository-copy.ts',
    );
    assertViolation(
      await runChecker(context, { head }),
      'AQ008_MEMBERSHIP_DIRECT_WRITER',
    );
  });

  await t.test('重命名后失去 allowlist', async (subtest) => {
    const context = await createRepository(subtest, {
      ...membershipSchemaFixture,
      [ownerPath]: ownerSource,
    });
    const head = await renameAndCommit(
      context,
      ownerPath,
      'src/modules/access-control/server/renamed-membership-writer.ts',
    );
    assertViolation(
      await runChecker(context, { head }),
      'AQ008_MEMBERSHIP_DIRECT_WRITER',
    );
  });
});

test('AQ008 对修改后的旧文件检查完整 Head 内容，但不追溯未改历史债务', async (t) => {
  const legacyPath = 'src/server/legacy-membership-writer.ts';
  const legacySource = [
    "import { tenantMembers } from '@/server/db/schema';",
    'export const write = (db) => db.insert(tenantMembers);',
    '',
  ].join('\n');
  const context = await createRepository(t, {
    ...membershipSchemaFixture,
    [legacyPath]: legacySource,
  });

  const docsHead = await commitChanges(context, {
    'README.md': '# 只修改文档，不触碰历史 Writer\n',
  });
  assertPassed(await runChecker(context, { head: docsHead }));

  const changedWriterHead = await commitChanges(context, {
    [legacyPath]: `${legacySource}\nexport const unrelated = true;\n`,
  });
  assertViolation(
    await runChecker(context, { base: docsHead, head: changedWriterHead }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});

test('AQ008 不误报 Reader、普通字符串、注释、相邻表或测试文件', async (t) => {
  const context = await createRepository(t, membershipSchemaFixture);
  const head = await commitChanges(context, {
    'src/server/membership-reader.ts': [
      "import { tenantMembers } from '@/server/db/schema';",
      'const note = "delete from tenant_members";',
      'export const read = (db, sql) => {',
      '  // db.delete(tenantMembers);',
      '  sql`-- DELETE FROM tenant_members',
      '      SELECT * FROM tenant_membership_transitions',
      "      WHERE note = 'TRUNCATE tenant_members'`;",
      '  return db.select().from(tenantMembers);',
      '};',
      'export { note };',
      '',
    ].join('\n'),
    'src/server/tests/future-membership-writer.test.ts': [
      "import { tenantMembers } from '@/server/db/schema';",
      'export const fixtureWrite = (db) => db.delete(tenantMembers);',
      '',
    ].join('\n'),
  });

  assertPassed(await runChecker(context, { head }));
});

test('AQ008 不接受 rules.json 配置例外', async (t) => {
  const writerPath = 'src/server/future-membership-writer.ts';
  const context = await createRepository(t, {
    ...membershipSchemaFixture,
    [writerPath]: [
      "import { tenantMembers } from '@/server/db/schema';",
      'export const write = (db) => db.insert(tenantMembers);',
      '',
    ].join('\n'),
  });

  const result = await runChecker(context, {
    head: context.base,
    config: {
      version: 1,
      exceptions: [{
        ruleId: 'AQ008_MEMBERSHIP_DIRECT_WRITER',
        path: writerPath,
        ...exceptionMetadata(),
      }],
    },
  });

  assertCheckerError(result);
  assert.match(result.output, /未知 ruleId/);
});

test('AQ008 从提交 blob 取证，不受 Head 后工作树清理影响', async (t) => {
  const writerPath = 'src/server/committed-membership-writer.ts';
  const context = await createRepository(t, membershipSchemaFixture);
  const head = await commitChanges(context, {
    [writerPath]: [
      "import { tenantMembers } from '@/server/db/schema';",
      'export const write = (db) => db.insert(tenantMembers);',
      '',
    ].join('\n'),
  });
  await writeFixtureFile(context.repository, writerPath, 'export const safe = true;\n');

  assertViolation(
    await runChecker(context, { head }),
    'AQ008_MEMBERSHIP_DIRECT_WRITER',
  );
});
