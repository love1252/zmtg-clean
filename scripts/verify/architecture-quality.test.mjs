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
