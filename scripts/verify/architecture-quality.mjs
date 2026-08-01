#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const EXIT_OK = 0;
const EXIT_VIOLATION = 1;
const EXIT_ERROR = 2;
const MAX_GIT_OUTPUT = 128 * 1024 * 1024;
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];
const INTERNAL_RESOLUTION_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.d.ts',
  '.json',
];
const PATH_RULE_IDS = new Set([
  'AQ001_SECOND_DATABASE_ROOT',
  'AQ002_NEW_INSTITUTION_LEGACY_ROUTE',
  'AQ003_NEW_PLATFORM_LEGACY_ROUTE',
  'AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE',
  'AQ005_FROZEN_PLATFORM_MODULE_NEW_FILE',
]);
const EDGE_RULE_IDS = new Set([
  'AQ006_DOMAIN_LAYER_DEPENDENCY',
  'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
]);
const ALL_RULE_IDS = new Set([...PATH_RULE_IDS, ...EDGE_RULE_IDS]);
const MEMBERSHIP_WRITER_RULE_ID = 'AQ008_MEMBERSHIP_DIRECT_WRITER';
const MEMBERSHIP_WRITER_ALLOWLIST = new Set([
  'src/modules/access-control/server/membership-command-repository.ts',
]);
const REQUIRED_METADATA_KEYS = [
  'ruleId',
  'taskId',
  'reason',
  'owner',
  'reviewCondition',
];
const RULE_MESSAGES = {
  AQ001_SECOND_DATABASE_ROOT: '禁止新增第二套根级 database 目录。',
  AQ002_NEW_INSTITUTION_LEGACY_ROUTE: '禁止新增机构端 legacy Route。',
  AQ003_NEW_PLATFORM_LEGACY_ROUTE: '禁止新增平台端 legacy Route。',
  AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE: '冻结模块 institution 禁止新增未登记文件。',
  AQ005_FROZEN_PLATFORM_MODULE_NEW_FILE: '冻结模块 open-platform 禁止新增未登记文件。',
  AQ006_DOMAIN_LAYER_DEPENDENCY: 'Domain 层禁止新增对应用、数据库、集成或框架层的依赖。',
  AQ007_CROSS_MODULE_SERVER_REPOSITORY: '模块间禁止新增对 server 或 Repository 实现的直接依赖。',
  AQ008_MEMBERSHIP_DIRECT_WRITER: 'Membership 只能由 Access Control Owner Repository 直接写入。',
};

class ArchitectureQualityError extends Error {}

function fail(message) {
  throw new ArchitectureQualityError(message);
}

function parseArguments(argv) {
  const tokens = argv[0] === '--' ? argv.slice(1) : argv;
  const values = new Map();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token !== '--base' && token !== '--head') {
      fail('存在未知参数。');
    }
    if (values.has(token)) {
      fail(`参数重复：${token}`);
    }
    const value = tokens[index + 1];
    if (value === undefined || value === '' || value.startsWith('--')) {
      fail(`参数缺少值：${token}`);
    }
    if (value.includes('\0')) {
      fail(`参数包含非法字符：${token}`);
    }
    values.set(token, value);
    index += 1;
  }

  if (!values.has('--base') || !values.has('--head')) {
    fail('必须同时提供 --base 与 --head。');
  }

  return {
    base: values.get('--base'),
    head: values.get('--head'),
  };
}

function runGit(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: null,
    maxBuffer: MAX_GIT_OUTPUT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    fail('无法执行 Git 命令。');
  }
  if (result.status !== 0 && !allowFailure) {
    fail('Git 取证失败。');
  }
  return result;
}

function decodeUtf8(buffer, context) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${context} 不是有效的 UTF-8。`);
  }
}

function runGitText(cwd, args, options) {
  const result = runGit(cwd, args, options);
  return {
    ...result,
    stdoutText: decodeUtf8(result.stdout, 'Git 输出'),
  };
}

function resolveRepositoryRoot(cwd) {
  const result = runGitText(cwd, ['rev-parse', '--show-toplevel']);
  const root = result.stdoutText.trim();
  if (!root) {
    fail('当前目录不是可识别的 Git 仓库。');
  }
  return root;
}

function resolveCommit(repositoryRoot, label, reference) {
  const result = runGitText(
    repositoryRoot,
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${reference}^{commit}`],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    fail(`${label} 不是有效的提交引用。`);
  }

  const lines = result.stdoutText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1 || !/^[0-9a-f]{40,64}$/u.test(lines[0])) {
    fail(`${label} 未解析为唯一提交对象。`);
  }

  const objectType = runGitText(repositoryRoot, ['cat-file', '-t', lines[0]]).stdoutText.trim();
  if (objectType !== 'commit') {
    fail(`${label} 不是提交对象。`);
  }
  return lines[0];
}

function findMergeBase(repositoryRoot, baseCommit, headCommit) {
  const result = runGitText(
    repositoryRoot,
    ['merge-base', '--all', baseCommit, headCommit],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    fail('base 与 head 没有可确认的共同历史。');
  }
  const mergeBases = result.stdoutText.trim().split(/\r?\n/).filter(Boolean);
  if (mergeBases.length !== 1 || !/^[0-9a-f]{40,64}$/u.test(mergeBases[0])) {
    fail('base 与 head 的共同历史不唯一或不可确认。');
  }
  return mergeBases[0];
}

function splitNulBuffer(buffer, context) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) {
      continue;
    }
    values.push(decodeUtf8(buffer.subarray(start, index), context));
    start = index + 1;
  }
  if (start !== buffer.length) {
    fail(`${context} 缺少 NUL 终止符。`);
  }
  return values;
}

function loadTree(repositoryRoot, commit) {
  const result = runGit(repositoryRoot, ['ls-tree', '-r', '-z', '--full-tree', commit]);
  const entries = new Map();

  for (const record of splitNulBuffer(result.stdout, 'Git tree 路径')) {
    if (!record) {
      continue;
    }
    const tabIndex = record.indexOf('\t');
    if (tabIndex < 0) {
      fail('Git tree 记录格式无效。');
    }
    const metadata = record.slice(0, tabIndex).split(' ');
    const filePath = record.slice(tabIndex + 1);
    const isRegularBlob = (
      /^(?:100644|100755)$/u.test(metadata[0])
      && metadata[1] === 'blob'
    );
    const isSymlinkBlob = metadata[0] === '120000' && metadata[1] === 'blob';
    const isGitlink = metadata[0] === '160000' && metadata[1] === 'commit';
    if (
      metadata.length !== 3
      || (!isRegularBlob && !isSymlinkBlob && !isGitlink)
      || !/^[0-9a-f]{40,64}$/u.test(metadata[2])
      || !filePath
    ) {
      fail('Git tree 记录格式无效。');
    }
    if (entries.has(filePath)) {
      fail('Git tree 中出现重复路径。');
    }
    entries.set(filePath, {
      mode: metadata[0],
      type: metadata[1],
      objectId: metadata[2],
    });
  }

  return entries;
}

function readBlob(repositoryRoot, tree, filePath) {
  const entry = tree.get(filePath);
  if (
    !entry
    || entry.type !== 'blob'
    || (entry.mode !== '100644' && entry.mode !== '100755')
  ) {
    fail(`无法从提交对象读取文件：${filePath}`);
  }
  const result = runGit(repositoryRoot, ['cat-file', 'blob', entry.objectId]);
  return decodeUtf8(result.stdout, `提交文件 ${filePath}`);
}

function parseDiff(repositoryRoot, mergeBase, headCommit) {
  const result = runGit(repositoryRoot, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    '--find-copies',
    '--find-copies-harder',
    '--diff-filter=ACDMRTUXB',
    mergeBase,
    headCommit,
    '--',
  ]);
  const fields = splitNulBuffer(result.stdout, 'Git diff 路径');
  const changes = [];
  const validateChangedPath = (filePath) => {
    if (!filePath || /[\0-\x1f\x7f]/u.test(filePath)) {
      fail('Git diff 路径为空或包含控制字符。');
    }
  };

  for (let index = 0; index < fields.length;) {
    const status = fields[index];
    index += 1;
    if (!status) {
      continue;
    }

    if (/^[ACDMRTUXB]$/u.test(status)) {
      const filePath = fields[index];
      index += 1;
      validateChangedPath(filePath);
      if (status === 'U' || status === 'X' || status === 'B') {
        fail(`Git diff 出现不支持的状态：${status}`);
      }
      changes.push({ status, oldPath: status === 'D' ? filePath : null, path: filePath });
      continue;
    }

    if (/^[RC][0-9]{1,3}$/u.test(status)) {
      const oldPath = fields[index];
      const filePath = fields[index + 1];
      index += 2;
      validateChangedPath(oldPath);
      validateChangedPath(filePath);
      const score = Number(status.slice(1));
      if (oldPath === filePath || score < 0 || score > 100) {
        fail('Git diff 的 rename/copy 记录无效。');
      }
      changes.push({ status: status[0], score, oldPath, path: filePath });
      continue;
    }

    fail(`Git diff 出现未知状态：${status}`);
  }

  return changes;
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} 必须是对象。`);
  }
}

function ensureExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} 包含缺失或未允许的字段。`);
  }
}

function validateRepositoryPath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} 必须是非空仓库相对路径。`);
  }
  if (
    value.startsWith('/')
    || value.startsWith('./')
    || value.includes('\\')
    || value.includes('//')
    || value.endsWith('/')
    || /[*?[\]{}]/u.test(value)
    || /[\0-\x1f\x7f]/u.test(value)
  ) {
    fail(`${label} 不是允许的精确仓库路径。`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`${label} 不是允许的精确仓库路径。`);
  }
  if (path.posix.normalize(value) !== value) {
    fail(`${label} 未规范化。`);
  }
}

function isPackageTarget(value) {
  if (typeof value !== 'string' || !value.startsWith('package:')) {
    return false;
  }
  const packageName = value.slice('package:'.length);
  return (
    packageName.length > 0
    && !/[*?[\]{}\\/\s]/u.test(packageName.replace(/^@[^/]+\//u, ''))
    && (
      /^[a-zA-Z0-9._~-]+(?::[a-zA-Z0-9._~/-]+)?$/u.test(packageName)
      || /^@[a-zA-Z0-9._~-]+\/[a-zA-Z0-9._~-]+$/u.test(packageName)
    )
  );
}

function validateMetadata(exception, index) {
  for (const key of REQUIRED_METADATA_KEYS) {
    if (
      typeof exception[key] !== 'string'
      || exception[key].trim() === ''
      || exception[key].trim() !== exception[key]
    ) {
      fail(`exceptions[${index}].${key} 必须是无首尾空白的非空字符串。`);
    }
  }
}

function loadRulesConfig(raw, headTree) {
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    fail('架构质量规则配置不是有效 JSON。');
  }

  ensureObject(config, '架构质量规则配置');
  ensureExactKeys(config, ['version', 'exceptions'], '架构质量规则配置');
  if (config.version !== 1) {
    fail('架构质量规则配置版本不受支持。');
  }
  if (!Array.isArray(config.exceptions)) {
    fail('架构质量规则配置 exceptions 必须是数组。');
  }

  const identities = new Set();
  const validated = [];
  for (let index = 0; index < config.exceptions.length; index += 1) {
    const exception = config.exceptions[index];
    ensureObject(exception, `exceptions[${index}]`);
    if (!ALL_RULE_IDS.has(exception.ruleId)) {
      fail(`exceptions[${index}] 使用未知 ruleId。`);
    }
    validateMetadata(exception, index);

    if (PATH_RULE_IDS.has(exception.ruleId)) {
      ensureExactKeys(exception, [...REQUIRED_METADATA_KEYS, 'path'], `exceptions[${index}]`);
      validateRepositoryPath(exception.path, `exceptions[${index}].path`);
      const entry = headTree.get(exception.path);
      if (
        !entry
        || entry.type !== 'blob'
        || (entry.mode !== '100644' && entry.mode !== '100755')
      ) {
        fail(`exceptions[${index}].path 不是 head 中的实际文件。`);
      }
      const identity = `${exception.ruleId}\0path\0${exception.path}`;
      if (identities.has(identity)) {
        fail(`exceptions[${index}] 与已有例外重复。`);
      }
      identities.add(identity);
      validated.push(exception);
      continue;
    }

    ensureExactKeys(exception, [...REQUIRED_METADATA_KEYS, 'from', 'to'], `exceptions[${index}]`);
    validateRepositoryPath(exception.from, `exceptions[${index}].from`);
    const fromEntry = headTree.get(exception.from);
    if (
      !fromEntry
      || fromEntry.type !== 'blob'
      || (fromEntry.mode !== '100644' && fromEntry.mode !== '100755')
    ) {
      fail(`exceptions[${index}].from 不是 head 中的实际文件。`);
    }
    if (isPackageTarget(exception.to)) {
      // Package targets use the canonical package:<name> form.
    } else {
      validateRepositoryPath(exception.to, `exceptions[${index}].to`);
      const toEntry = headTree.get(exception.to);
      if (
        !toEntry
        || toEntry.type !== 'blob'
        || (toEntry.mode !== '100644' && toEntry.mode !== '100755')
      ) {
        fail(`exceptions[${index}].to 不是 head 中的实际文件或 package 目标。`);
      }
    }
    const identity = `${exception.ruleId}\0from\0${exception.from}\0to\0${exception.to}`;
    if (identities.has(identity)) {
      fail(`exceptions[${index}] 与已有例外重复。`);
    }
    identities.add(identity);
    validated.push(exception);
  }

  return validated;
}

function exceptionMatches(exception, violation) {
  if (exception.ruleId !== violation.ruleId) {
    return false;
  }
  if ('path' in violation) {
    return exception.path === violation.path;
  }
  return exception.from === violation.from && exception.to === violation.to;
}

function pathRuleIds(filePath) {
  const ruleIds = [];
  if (/^database\/.+/u.test(filePath)) {
    ruleIds.push('AQ001_SECOND_DATABASE_ROOT');
  }
  if (/^src\/app\/api\/institution\/(?:.+\/)?route\.ts$/u.test(filePath)) {
    ruleIds.push('AQ002_NEW_INSTITUTION_LEGACY_ROUTE');
  }
  if (/^src\/app\/api\/open-platform\/(?:.+\/)?route\.ts$/u.test(filePath)) {
    ruleIds.push('AQ003_NEW_PLATFORM_LEGACY_ROUTE');
  }
  if (/^src\/modules\/institution\/.+/u.test(filePath)) {
    ruleIds.push('AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE');
  }
  if (/^src\/modules\/open-platform\/.+/u.test(filePath)) {
    ruleIds.push('AQ005_FROZEN_PLATFORM_MODULE_NEW_FILE');
  }
  return ruleIds;
}

function isProductionModuleSource(filePath) {
  if (!/^src\/modules\/[^/]+\/.+/u.test(filePath)) {
    return false;
  }
  if (!SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
    return false;
  }
  if (/(?:^|\/)(?:tests|__tests__)(?:\/|$)/iu.test(filePath)) {
    return false;
  }
  return !/\.(?:test|spec)\.[^/]+$/iu.test(filePath);
}

function moduleName(filePath) {
  const match = /^src\/modules\/([^/]+)\//u.exec(filePath);
  return match ? match[1] : null;
}

function isDomainSource(filePath) {
  return /^src\/modules\/[^/]+\/domain\/.+/u.test(filePath);
}

function scriptKindForFile(ts, filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function literalModuleSpecifier(ts, expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return null;
}

function sourcePosition(ts, sourceFile, node) {
  const start = node.getStart(sourceFile, false);
  const position = sourceFile.getLineAndCharacterOfPosition(start);
  return `${position.line + 1}:${position.character + 1}`;
}

function collectModuleSpecifiers(ts, filePath, content) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(ts, filePath),
  );
  const parseDiagnostics = sourceFile.parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0) {
    const diagnostic = [...parseDiagnostics].sort((left, right) => (left.start ?? 0) - (right.start ?? 0))[0];
    const position = diagnostic.start === undefined
      ? '未知位置'
      : (() => {
          const point = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
          return `${point.line + 1}:${point.character + 1}`;
        })();
    fail(`源码解析失败：${filePath}（${position}）`);
  }

  const specifiers = new Set();
  let hasJsxSyntax = false;
  const addLiteral = (expression, node, kind) => {
    const specifier = literalModuleSpecifier(ts, expression);
    if (specifier === null || specifier === '') {
      fail(`发现非字面量${kind}依赖：${filePath}（${sourcePosition(ts, sourceFile, node)}）`);
    }
    specifiers.add(specifier);
  };

  const visit = (node) => {
    if (
      ts.isJsxElement(node)
      || ts.isJsxSelfClosingElement(node)
      || ts.isJsxFragment(node)
    ) {
      hasJsxSyntax = true;
    }
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      addLiteral(node.moduleSpecifier, node, ' import');
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      addLiteral(node.moduleSpecifier, node, ' export');
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
    ) {
      addLiteral(node.moduleReference.expression, node, ' import equals');
    } else if (ts.isImportTypeNode(node)) {
      if (!ts.isLiteralTypeNode(node.argument)) {
        fail(`发现非字面量 import type 依赖：${filePath}（${sourcePosition(ts, sourceFile, node)}）`);
      }
      addLiteral(node.argument.literal, node, ' import type');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length < 1 || node.arguments.length > 2) {
          fail(`动态 import 参数数量无效：${filePath}（${sourcePosition(ts, sourceFile, node)}）`);
        }
        addLiteral(node.arguments[0], node, '动态 import');
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        if (node.arguments.length !== 1) {
          fail(`require 参数数量无效：${filePath}（${sourcePosition(ts, sourceFile, node)}）`);
        }
        addLiteral(node.arguments[0], node, ' require');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (hasJsxSyntax) {
    specifiers.add('react');
  }
  return [...specifiers].sort();
}

function canonicalPackageTarget(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    if (!scope || !name) {
      fail('发现无法识别的外部 package 依赖。');
    }
    return `package:${scope}/${name}`;
  }
  if (specifier.includes(':')) {
    return `package:${specifier}`;
  }
  return `package:${specifier.split('/')[0]}`;
}

function internalResolutionCandidates(basePath) {
  const candidates = [basePath];
  const extension = path.posix.extname(basePath);

  if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs') {
    const withoutExtension = basePath.slice(0, -extension.length);
    candidates.push(
      `${withoutExtension}.ts`,
      `${withoutExtension}.tsx`,
      `${withoutExtension}.mts`,
      `${withoutExtension}.cts`,
      `${withoutExtension}.d.ts`,
    );
  }
  if (!INTERNAL_RESOLUTION_EXTENSIONS.some((candidateExtension) => basePath.endsWith(candidateExtension))) {
    for (const candidateExtension of INTERNAL_RESOLUTION_EXTENSIONS) {
      candidates.push(`${basePath}${candidateExtension}`);
    }
  }
  for (const candidateExtension of INTERNAL_RESOLUTION_EXTENSIONS) {
    candidates.push(`${basePath}/index${candidateExtension}`);
  }

  return [...new Set(candidates)];
}

function resolveModuleSpecifier(tree, sourcePath, specifier) {
  let unresolvedPath;
  if (specifier.startsWith('@/')) {
    unresolvedPath = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith('src/')) {
    unresolvedPath = specifier;
  } else if (specifier.startsWith('.')) {
    unresolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
  } else if (specifier.startsWith('/')) {
    fail(`不允许仓库绝对导入：${sourcePath}`);
  } else {
    return canonicalPackageTarget(specifier);
  }

  if (
    !unresolvedPath
    || unresolvedPath === '.'
    || unresolvedPath === '..'
    || unresolvedPath.startsWith('../')
    || path.posix.isAbsolute(unresolvedPath)
  ) {
    fail(`内部依赖越出仓库边界：${sourcePath}`);
  }

  for (const candidate of internalResolutionCandidates(unresolvedPath)) {
    const entry = tree.get(candidate);
    if (
      entry?.type === 'blob'
      && (entry.mode === '100644' || entry.mode === '100755')
    ) {
      return candidate;
    }
    if (entry) {
      fail(`内部依赖不是可检查的普通文件：${sourcePath}`);
    }
  }
  fail(`无法解析内部依赖：${sourcePath}`);
}

function collectDependencyEdges(ts, repositoryRoot, tree, sourcePath) {
  const content = readBlob(repositoryRoot, tree, sourcePath);
  const specifiers = collectModuleSpecifiers(ts, sourcePath, content);
  const targets = specifiers.map((specifier) => resolveModuleSpecifier(tree, sourcePath, specifier));
  return new Set(targets);
}

function isForbiddenDomainTarget(target) {
  return (
    target === 'package:react'
    || target === 'package:next'
    || target.startsWith('src/app/')
    || target.startsWith('src/server/db/')
    || target.startsWith('src/integrations/')
  );
}

function isRepositoryImplementation(target, targetModule) {
  const moduleRelativePath = target.slice(`src/modules/${targetModule}/`.length);
  const segments = moduleRelativePath.split('/');
  const directories = segments.slice(0, -1).map((segment) => segment.toLowerCase());
  if (directories.includes('domain') || directories.includes('port') || directories.includes('ports')) {
    return false;
  }
  return (
    directories.includes('repository')
    || directories.includes('repositories')
    || /repository/iu.test(segments.at(-1) ?? '')
  );
}

function isCrossModuleImplementationTarget(sourcePath, target) {
  const sourceModule = moduleName(sourcePath);
  const targetModule = moduleName(target);
  if (!sourceModule || !targetModule || sourceModule === targetModule) {
    return false;
  }
  const modulePrefix = `src/modules/${targetModule}/`;
  const moduleRelativePath = target.slice(modulePrefix.length);
  return moduleRelativePath.startsWith('server/') || isRepositoryImplementation(target, targetModule);
}

function dependencyRuleViolations(sourcePath, targets) {
  if (!isProductionModuleSource(sourcePath)) {
    return [];
  }
  const violations = [];
  for (const target of targets) {
    if (isDomainSource(sourcePath) && isForbiddenDomainTarget(target)) {
      violations.push({
        ruleId: 'AQ006_DOMAIN_LAYER_DEPENDENCY',
        from: sourcePath,
        to: target,
      });
    }
    if (isCrossModuleImplementationTarget(sourcePath, target)) {
      violations.push({
        ruleId: 'AQ007_CROSS_MODULE_SERVER_REPOSITORY',
        from: sourcePath,
        to: target,
      });
    }
  }
  return violations;
}

function dependencyViolationIdentity(violation) {
  return `${violation.ruleId}\0${violation.to}`;
}

function addedDependencyViolations(ts, repositoryRoot, baseTree, headTree, change) {
  const headTargets = collectDependencyEdges(ts, repositoryRoot, headTree, change.path);
  const headViolations = dependencyRuleViolations(change.path, headTargets);
  if (change.status === 'A' || change.status === 'C') {
    return headViolations;
  }

  const oldPath = change.status === 'R' ? change.oldPath : change.path;
  if (!oldPath || !baseTree.has(oldPath)) {
    fail(`无法确认历史依赖基线：${change.path}`);
  }
  const baseTargets = collectDependencyEdges(ts, repositoryRoot, baseTree, oldPath);
  const baseViolationIdentities = new Set(
    dependencyRuleViolations(oldPath, baseTargets).map(dependencyViolationIdentity),
  );
  return headViolations.filter(
    (violation) => !baseViolationIdentities.has(dependencyViolationIdentity(violation)),
  );
}

function isMembershipWriterSource(filePath) {
  if (!/^(?:src|scripts)\/.+/u.test(filePath)) {
    return false;
  }
  if (!SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
    return false;
  }
  if (/(?:^|\/)(?:tests|__tests__)(?:\/|$)/iu.test(filePath)) {
    return false;
  }
  return !/\.(?:test|spec)\.[^/]+$/iu.test(filePath);
}

function unwrapExpression(ts, expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyNameText(ts, expression) {
  const current = unwrapExpression(ts, expression);
  if (ts.isIdentifier(current)) {
    return current.text;
  }
  if (ts.isPropertyAccessExpression(current)) {
    return current.name.text;
  }
  if (
    ts.isElementAccessExpression(current)
    && current.argumentExpression
    && (ts.isStringLiteral(current.argumentExpression)
      || ts.isNoSubstitutionTemplateLiteral(current.argumentExpression))
  ) {
    return current.argumentExpression.text;
  }
  return null;
}

function literalText(ts, expression) {
  const current = unwrapExpression(ts, expression);
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
    return current.text;
  }
  return null;
}

function collectConstInitializers(ts, sourceFile) {
  const initializers = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && ts.isVariableDeclarationList(node.parent)
      && (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const entries = initializers.get(node.name.text) ?? [];
      entries.push({ declaration: node, initializer: node.initializer });
      initializers.set(node.name.text, entries);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return initializers;
}

function lexicalConstInitializer(ts, identifier, initializers) {
  const entries = initializers.get(identifier.text) ?? [];
  let selected = null;
  let selectedWidth = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    let scope = entry.declaration.parent;
    while (
      scope
      && !ts.isSourceFile(scope)
      && !ts.isBlock(scope)
      && !ts.isFunctionLike(scope)
    ) {
      scope = scope.parent;
    }
    if (!scope || identifier.pos < scope.pos || identifier.end > scope.end) continue;
    const width = scope.end - scope.pos;
    if (
      width < selectedWidth
      || (width === selectedWidth && entry.declaration.pos < identifier.pos
        && (!selected || entry.declaration.pos > selected.declaration.pos))
    ) {
      selected = entry;
      selectedWidth = width;
    }
  }
  return selected?.initializer ?? null;
}

function staticStringText(ts, expression, initializers, seen = new Set()) {
  const current = unwrapExpression(ts, expression);
  const direct = literalText(ts, current);
  if (direct !== null) return direct;

  if (ts.isIdentifier(current) && !seen.has(current.text)) {
    const initializer = lexicalConstInitializer(ts, current, initializers);
    if (!initializer) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    return staticStringText(ts, initializer, initializers, nextSeen);
  }

  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringText(ts, current.left, initializers, seen);
    const right = staticStringText(ts, current.right, initializers, seen);
    return left === null || right === null ? null : `${left}${right}`;
  }

  if (ts.isTemplateExpression(current)) {
    let value = current.head.text;
    for (const span of current.templateSpans) {
      const part = staticStringText(ts, span.expression, initializers, seen);
      if (part === null) return null;
      value += `${part}${span.literal.text}`;
    }
    return value;
  }

  return null;
}

function staticSqlTexts(ts, expression, initializers, seen = new Set()) {
  const current = unwrapExpression(ts, expression);
  const direct = staticStringText(ts, current, initializers);
  if (direct !== null) return [direct];

  if (ts.isIdentifier(current) && !seen.has(current.text)) {
    const initializer = lexicalConstInitializer(ts, current, initializers);
    if (initializer) {
      const nextSeen = new Set(seen);
      nextSeen.add(current.text);
      return staticSqlTexts(ts, initializer, initializers, nextSeen);
    }
  }

  if (!ts.isObjectLiteralExpression(current)) return [];
  const values = [];
  for (const property of current.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyNameText(ts, property.name);
    if (name !== 'text' && name !== 'sql') continue;
    const text = staticStringText(ts, property.initializer, initializers);
    if (text !== null) values.push(text);
  }
  for (const property of current.properties) {
    if (!ts.isShorthandPropertyAssignment(property)) continue;
    if (property.name.text !== 'text' && property.name.text !== 'sql') continue;
    const text = staticStringText(ts, property.name, initializers);
    if (text !== null) values.push(text);
  }
  return values;
}

function rootExpressionIdentifier(ts, expression) {
  let current = unwrapExpression(ts, expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(ts, current.expression);
  }
  return ts.isIdentifier(current) ? current : null;
}

function resolvedConstRootName(ts, expression, initializers, seen = new Set()) {
  const root = rootExpressionIdentifier(ts, expression);
  if (!root) return null;
  if (seen.has(root.text)) return root.text;
  const initializer = lexicalConstInitializer(ts, root, initializers);
  if (!initializer) return root.text;
  const nextSeen = new Set(seen);
  nextSeen.add(root.text);
  return resolvedConstRootName(ts, initializer, initializers, nextSeen) ?? root.text;
}

function isSqlTaggedTemplate(ts, node, initializers) {
  if (!ts.isTaggedTemplateExpression(node)) return false;
  const tag = unwrapExpression(ts, node.tag);
  if (
    ts.isPropertyAccessExpression(tag)
    && ts.isIdentifier(tag.expression)
    && tag.expression.text === 'String'
    && tag.name.text === 'raw'
  ) {
    return false;
  }
  const root = resolvedConstRootName(ts, tag, initializers);
  return Boolean(
    root && /^(?:sql|db|database|tx|transaction|client|pool|connection)$/iu.test(root),
  );
}

function stripSqlStringsAndComments(sqlText) {
  let output = '';
  let index = 0;
  while (index < sqlText.length) {
    if (sqlText.startsWith('--', index)) {
      const newline = sqlText.indexOf('\n', index + 2);
      if (newline < 0) break;
      output += '\n';
      index = newline + 1;
      continue;
    }
    if (sqlText.startsWith('/*', index)) {
      const end = sqlText.indexOf('*/', index + 2);
      if (end < 0) return output;
      output += ' ';
      index = end + 2;
      continue;
    }
    if (sqlText[index] === "'") {
      index += 1;
      while (index < sqlText.length) {
        if (sqlText[index] === "'" && sqlText[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (sqlText[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
      output += ' ';
      continue;
    }
    if (sqlText[index] === '$') {
      const delimiter = /^\$[a-zA-Z_0-9]*\$/u.exec(sqlText.slice(index))?.[0];
      if (delimiter) {
        const end = sqlText.indexOf(delimiter, index + delimiter.length);
        if (end < 0) return output;
        output += ' ';
        index = end + delimiter.length;
        continue;
      }
    }
    output += sqlText[index];
    index += 1;
  }
  return output;
}

function containsMembershipMutationSql(sqlText) {
  const executable = stripSqlStringsAndComments(sqlText);
  const qualifier = '(?:(?:"(?:[^"]|"")*"|[a-zA-Z_][a-zA-Z0-9_$]*)\\s*\\.\\s*)?';
  const target = '(?:"tenant_members"|tenant_members)';
  const rowMutation = '(?:insert\\s+into|update|delete\\s+from)';
  if (
    new RegExp(
      `\\b${rowMutation}\\s+(?:only\\s+)?${qualifier}${target}(?=$|[\\s;(,])`,
      'iu',
    ).test(executable)
  ) {
    return true;
  }

  const truncateTarget = new RegExp(
    `(?:^|,)\\s*(?:only\\s+)?${qualifier}${target}(?=$|[\\s,(])`,
    'iu',
  );
  for (const statement of executable.split(';')) {
    const truncate = /\btruncate(?:\s+table)?\s+([\s\S]*)$/iu.exec(statement);
    if (truncate && truncateTarget.test(truncate[1])) return true;
  }
  return false;
}

function templateEvidence(ts, template) {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return { text: template.text, expressions: [] };
  }
  let text = template.head.text;
  const expressions = [];
  for (const [index, span] of template.templateSpans.entries()) {
    expressions.push(span.expression);
    text += ` __AQ_EXPR_${index}__ ${span.literal.text}`;
  }
  return { text, expressions };
}

function dynamicMutationTargets(ts, template) {
  const evidence = templateEvidence(ts, template);
  const executable = stripSqlStringsAndComments(evidence.text);
  const pattern = /\b(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+(?:only\s+)?__AQ_EXPR_(\d+)__/giu;
  const indexes = new Set();
  for (const match of executable.matchAll(pattern)) {
    indexes.add(Number(match[1]));
  }
  for (const statement of executable.split(';')) {
    const truncate = /\btruncate(?:\s+table)?\s+([\s\S]*)$/iu.exec(statement);
    if (!truncate) continue;
    for (const match of truncate[1].matchAll(/(?:^|,)\s*(?:only\s+)?__AQ_EXPR_(\d+)__/giu)) {
      indexes.add(Number(match[1]));
    }
  }
  return [...indexes]
    .map((index) => evidence.expressions[index])
    .filter(Boolean);
}

function dynamicTableExpression(ts, expression) {
  const current = unwrapExpression(ts, expression);
  if (ts.isCallExpression(current) && current.arguments.length > 0) {
    return unwrapExpression(ts, current.arguments[0]);
  }
  return current;
}

function createMembershipWriterSourceFile(ts, filePath, content) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(ts, filePath),
  );
  const diagnostics = sourceFile.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const diagnostic = [...diagnostics].sort(
      (left, right) => (left.start ?? 0) - (right.start ?? 0),
    )[0];
    const position = diagnostic.start === undefined
      ? '未知位置'
      : (() => {
          const point = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
          return `${point.line + 1}:${point.character + 1}`;
        })();
    fail(`源码解析失败：${filePath}（${position}）`);
  }
  return sourceFile;
}

function hasExportModifier(ts, node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function hasDefaultModifier(ts, node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}

function resolvedInternalModule(ts, tree, filePath, moduleSpecifier) {
  const specifier = literalModuleSpecifier(ts, moduleSpecifier);
  if (!specifier) return null;
  const target = resolveModuleSpecifier(tree, filePath, specifier);
  return target.startsWith('package:') ? null : target;
}

function bindingNameContains(ts, bindingName, identifierName) {
  if (ts.isIdentifier(bindingName)) return bindingName.text === identifierName;
  return bindingName.elements.some((element) =>
    ts.isBindingElement(element) && bindingNameContains(ts, element.name, identifierName));
}

function isShadowedByFunctionParameter(ts, identifier) {
  let current = identifier.parent;
  while (current && !ts.isSourceFile(current)) {
    if (
      ts.isFunctionLike(current)
      && current.parameters.some((parameter) =>
        bindingNameContains(ts, parameter.name, identifier.text))
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function collectLocalBindings(ts, sourceFile) {
  const bindings = new Map();
  const add = (name, declaration, kind) => {
    let scope = kind === 'parameter' ? declaration.parent : declaration.parent;
    while (
      scope
      && !ts.isSourceFile(scope)
      && !ts.isBlock(scope)
      && !ts.isFunctionLike(scope)
    ) {
      scope = scope.parent;
    }
    if (!scope) return;
    const entries = bindings.get(name) ?? [];
    entries.push({ declaration, kind, scope });
    bindings.set(name, entries);
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      add(node.name.text, node, 'variable');
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      add(node.name.text, node, 'parameter');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings;
}

function lexicalLocalBinding(identifier, bindings) {
  let selected = null;
  let selectedWidth = Number.POSITIVE_INFINITY;
  for (const entry of bindings.get(identifier.text) ?? []) {
    if (identifier.pos < entry.scope.pos || identifier.end > entry.scope.end) continue;
    const width = entry.scope.end - entry.scope.pos;
    if (
      width < selectedWidth
      || (width === selectedWidth && entry.declaration.pos < identifier.pos
        && (!selected || entry.declaration.pos > selected.declaration.pos))
    ) {
      selected = entry;
      selectedWidth = width;
    }
  }
  return selected;
}

function latestAssignmentBefore(ts, scope, identifier) {
  let selected = null;
  const visit = (node) => {
    if (node !== scope && ts.isFunctionLike(node)) return;
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(unwrapExpression(ts, node.left))
      && unwrapExpression(ts, node.left).text === identifier.text
      && node.pos < identifier.pos
      && (!selected || node.pos > selected.pos)
    ) {
      selected = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return selected?.right ?? null;
}

function collectMembershipBindings(
  ts,
  repositoryRoot,
  tree,
  filePath,
  sourceFile,
  exportCache = new Map(),
  visiting = new Set(),
) {
  const identifiers = new Set();
  const namespaces = new Map();
  const localBindings = collectLocalBindings(ts, sourceFile);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const target = resolvedInternalModule(ts, tree, filePath, statement.moduleSpecifier);
    if (!target) continue;
    const exported = membershipExportNames(
      ts,
      repositoryRoot,
      tree,
      target,
      exportCache,
      visiting,
    );
    if (exported.size === 0) continue;
    const clause = statement.importClause;
    if (!clause?.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaces.set(clause.namedBindings.name.text, exported);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (exported.has(importedName)) identifiers.add(element.name.text);
    }
  }

  const isMembershipTable = (expression, seen = new Set()) => {
    const current = unwrapExpression(ts, expression);
    if (ts.isIdentifier(current)) {
      if (!identifiers.has(current.text) || seen.has(current)) return false;
      const binding = lexicalLocalBinding(current, localBindings);
      if (!binding) return !isShadowedByFunctionParameter(ts, current);
      if (binding.kind === 'parameter') return false;
      const nextSeen = new Set(seen);
      nextSeen.add(current);
      if (binding.declaration.initializer) {
        return isMembershipTable(binding.declaration.initializer, nextSeen);
      }
      const assignment = latestAssignmentBefore(ts, binding.scope, current);
      return assignment ? isMembershipTable(assignment, nextSeen) : false;
    }
    if (
      ts.isPropertyAccessExpression(current)
      && ts.isIdentifier(current.expression)
      && !isShadowedByFunctionParameter(ts, current.expression)
      && namespaces.get(current.expression.text)?.has(current.name.text)
    ) {
      return true;
    }
    if (
      ts.isElementAccessExpression(current)
      && ts.isIdentifier(current.expression)
      && !isShadowedByFunctionParameter(ts, current.expression)
      && current.argumentExpression
    ) {
      const property = literalText(ts, current.argumentExpression);
      return Boolean(property && namespaces.get(current.expression.text)?.has(property));
    }
    return false;
  };

  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        if (isMembershipTable(node.initializer) && !identifiers.has(node.name.text)) {
          identifiers.add(node.name.text);
          changed = true;
        }
        const initializer = unwrapExpression(ts, node.initializer);
        if (ts.isIdentifier(initializer)) {
          const sourceNamespace = namespaces.get(initializer.text);
          if (sourceNamespace && namespaces.get(node.name.text) !== sourceNamespace) {
            namespaces.set(node.name.text, sourceNamespace);
            changed = true;
          }
        }
      }
      if (
        ts.isVariableDeclaration(node)
        && ts.isObjectBindingPattern(node.name)
        && node.initializer
        && ts.isIdentifier(unwrapExpression(ts, node.initializer))
      ) {
        const exported = namespaces.get(unwrapExpression(ts, node.initializer).text);
        if (exported) {
          for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name)) continue;
            const property = element.propertyName
              ? propertyNameText(ts, element.propertyName)
              : element.name.text;
            if (property && exported.has(property) && !identifiers.has(element.name.text)) {
              identifiers.add(element.name.text);
              changed = true;
            }
          }
        }
      }
      if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(unwrapExpression(ts, node.left))
      ) {
        const targetName = unwrapExpression(ts, node.left).text;
        if (isMembershipTable(node.right) && !identifiers.has(targetName)) {
          identifiers.add(targetName);
          changed = true;
        }
        const right = unwrapExpression(ts, node.right);
        if (ts.isIdentifier(right)) {
          const sourceNamespace = namespaces.get(right.text);
          if (sourceNamespace && namespaces.get(targetName) !== sourceNamespace) {
            namespaces.set(targetName, sourceNamespace);
            changed = true;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { identifiers, namespaces, isMembershipTable };
}

function membershipExportNames(
  ts,
  repositoryRoot,
  tree,
  filePath,
  cache = new Map(),
  visiting = new Set(),
) {
  if (!SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
    return new Set();
  }
  if (filePath === 'src/server/db/schema.ts') return new Set(['tenantMembers']);
  if (cache.has(filePath)) return new Set(cache.get(filePath));
  if (visiting.has(filePath)) return new Set();

  visiting.add(filePath);
  const sourceFile = createMembershipWriterSourceFile(
    ts,
    filePath,
    readBlob(repositoryRoot, tree, filePath),
  );
  const bindings = collectMembershipBindings(
    ts,
    repositoryRoot,
    tree,
    filePath,
    sourceFile,
    cache,
    visiting,
  );
  const exportedNames = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const target = statement.moduleSpecifier
        ? resolvedInternalModule(ts, tree, filePath, statement.moduleSpecifier)
        : null;
      if (statement.moduleSpecifier && !target) continue;
      const targetExports = target
        ? membershipExportNames(ts, repositoryRoot, tree, target, cache, visiting)
        : null;
      if (!statement.exportClause && targetExports) {
        for (const name of targetExports) exportedNames.add(name);
        continue;
      }
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        const originalName = element.propertyName?.text ?? element.name.text;
        if (
          (targetExports && targetExports.has(originalName))
          || (!targetExports && bindings.identifiers.has(originalName))
        ) {
          exportedNames.add(element.name.text);
        }
      }
      continue;
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(ts, statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && bindings.identifiers.has(declaration.name.text)) {
          exportedNames.add(declaration.name.text);
        }
      }
    }
  }

  visiting.delete(filePath);
  cache.set(filePath, exportedNames);
  return new Set(exportedNames);
}

function localFunctionDescriptors(ts, sourceFile) {
  const descriptors = new Set();
  const byName = new Map();
  const byQualifiedName = new Map();

  const register = (name, node, body, parameters, exportNames = [], owner = null) => {
    if (!name || !body) return;
    const descriptor = {
      name,
      owner,
      node,
      body,
      parameters,
      exportNames: new Set(exportNames),
      targetParameterIndexes: new Set(),
    };
    descriptors.add(descriptor);
    const named = byName.get(name) ?? new Set();
    named.add(descriptor);
    byName.set(name, named);
    if (owner) {
      const qualifiedName = `${owner}.${name}`;
      const qualified = byQualifiedName.get(qualifiedName) ?? new Set();
      qualified.add(descriptor);
      byQualifiedName.set(qualifiedName, qualified);
    }
  };

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const exportNames = hasExportModifier(ts, node)
        ? [hasDefaultModifier(ts, node) ? 'default' : node.name.text]
        : [];
      register(node.name.text, node, node.body, node.parameters, exportNames);
    } else if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const statement = ts.isVariableDeclarationList(node.parent) ? node.parent.parent : null;
      register(
        node.name.text,
        node.initializer,
        node.initializer.body,
        node.initializer.parameters,
        statement && ts.isVariableStatement(statement) && hasExportModifier(ts, statement)
          ? [node.name.text]
          : [],
      );
    } else if (ts.isMethodDeclaration(node) && node.body) {
      const methodName = propertyNameText(ts, node.name);
      let owner = null;
      let exportNames = [];
      if (ts.isClassDeclaration(node.parent) && node.parent.name) {
        owner = node.parent.name.text;
        if (hasExportModifier(ts, node.parent)) {
          const exportedOwner = hasDefaultModifier(ts, node.parent) ? 'default' : owner;
          exportNames = [`${exportedOwner}.${methodName}`];
        }
      } else if (
        ts.isObjectLiteralExpression(node.parent)
        && ts.isVariableDeclaration(node.parent.parent)
        && ts.isIdentifier(node.parent.parent.name)
      ) {
        owner = node.parent.parent.name.text;
        const statement = ts.isVariableDeclarationList(node.parent.parent.parent)
          ? node.parent.parent.parent.parent
          : null;
        if (statement && ts.isVariableStatement(statement) && hasExportModifier(ts, statement)) {
          exportNames = [`${owner}.${methodName}`];
        }
      }
      register(methodName, node, node.body, node.parameters, exportNames, owner);
    } else if (
      ts.isPropertyAssignment(node)
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const methodName = propertyNameText(ts, node.name);
      let owner = null;
      let exportNames = [];
      if (
        ts.isObjectLiteralExpression(node.parent)
        && ts.isVariableDeclaration(node.parent.parent)
        && ts.isIdentifier(node.parent.parent.name)
      ) {
        owner = node.parent.parent.name.text;
        const statement = ts.isVariableDeclarationList(node.parent.parent.parent)
          ? node.parent.parent.parent.parent
          : null;
        if (statement && ts.isVariableStatement(statement) && hasExportModifier(ts, statement)) {
          exportNames = [`${owner}.${methodName}`];
        }
      }
      register(
        methodName,
        node.initializer,
        node.initializer.body,
        node.initializer.parameters,
        exportNames,
        owner,
      );
    } else if (
      ts.isExportAssignment(node)
      && (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))
    ) {
      register(
        'default',
        node.expression,
        node.expression.body,
        node.expression.parameters,
        ['default'],
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const addQualifiedAlias = (qualifiedName, sourceName) => {
    const qualified = byQualifiedName.get(qualifiedName) ?? new Set();
    for (const descriptor of byName.get(sourceName) ?? []) {
      if (!descriptor.owner) qualified.add(descriptor);
    }
    if (qualified.size > 0) byQualifiedName.set(qualifiedName, qualified);
  };
  const collectObjectAliases = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && ts.isObjectLiteralExpression(unwrapExpression(ts, node.initializer))
    ) {
      for (const property of unwrapExpression(ts, node.initializer).properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
          addQualifiedAlias(`${node.name.text}.${property.name.text}`, property.name.text);
        } else if (
          ts.isPropertyAssignment(property)
          && ts.isIdentifier(unwrapExpression(ts, property.initializer))
        ) {
          const methodName = propertyNameText(ts, property.name);
          if (methodName) {
            addQualifiedAlias(
              `${node.name.text}.${methodName}`,
              unwrapExpression(ts, property.initializer).text,
            );
          }
        }
      }
    }
    ts.forEachChild(node, collectObjectAliases);
  };
  collectObjectAliases(sourceFile);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier) continue;
    for (const element of statement.exportClause.elements) {
      const localName = element.propertyName?.text ?? element.name.text;
      for (const descriptor of descriptors) {
        if (descriptor.name === localName) descriptor.exportNames.add(element.name.text);
        if (descriptor.owner === localName) {
          descriptor.exportNames.add(`${element.name.text}.${descriptor.name}`);
        }
      }
    }
  }

  return { descriptors, byName, byQualifiedName };
}

function visitFunctionBody(ts, descriptor, callback) {
  const visit = (node) => {
    if (node !== descriptor.body && ts.isFunctionLike(node)) return;
    callback(node);
    ts.forEachChild(node, visit);
  };
  visit(descriptor.body);
}

function parameterIndexForExpression(ts, descriptor, expression, initializers = new Map(), seen = new Set()) {
  const current = dynamicTableExpression(ts, expression);
  if (ts.isIdentifier(current)) {
    const direct = descriptor.parameters.findIndex(
      (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === current.text,
    );
    if (direct >= 0) return direct;
    if (!seen.has(current.text)) {
      const initializer = lexicalConstInitializer(ts, current, initializers);
      if (!initializer) return -1;
      const nextSeen = new Set(seen);
      nextSeen.add(current.text);
      return parameterIndexForExpression(
        ts,
        descriptor,
        initializer,
        initializers,
        nextSeen,
      );
    }
  }
  if (ts.isArrayLiteralExpression(current)) {
    for (const element of current.elements) {
      const index = parameterIndexForExpression(ts, descriptor, element, initializers, seen);
      if (index >= 0) return index;
    }
  }
  return -1;
}

function isDrizzleMutationCall(ts, node, isMembershipTable) {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return false;
  const operation = propertyNameText(ts, node.expression);
  return (
    (operation === 'insert' || operation === 'update' || operation === 'delete')
    && isMembershipTable(node.arguments[0])
  );
}

function executableSqlCall(ts, node, initializers) {
  if (!ts.isCallExpression(node)) return false;
  const name = propertyNameText(ts, node.expression);
  if (!name || !/^(?:raw|unsafe|query|execute|executeRaw|\$executeRaw)$/iu.test(name)) {
    return false;
  }
  const expression = unwrapExpression(ts, node.expression);
  if (ts.isIdentifier(expression)) return name !== 'query';
  const root = resolvedConstRootName(ts, expression, initializers);
  if (name === 'query') {
    return Boolean(root && /^(?:db|database|tx|transaction|client|pool|connection)$/iu.test(root));
  }
  return Boolean(
    root && /^(?:sql|db|database|tx|transaction|client|pool|connection)$/iu.test(root),
  );
}

function calledFunctionDescriptors(ts, functions, expression) {
  const current = unwrapExpression(ts, expression);
  if (ts.isIdentifier(current)) {
    return functions.byName.get(current.text) ?? new Set();
  }
  if (ts.isPropertyAccessExpression(current)) {
    if (ts.isIdentifier(current.expression)) {
      return functions.byQualifiedName.get(
        `${current.expression.text}.${current.name.text}`,
      ) ?? new Set();
    }
    if (
      ts.isNewExpression(current.expression)
      && ts.isIdentifier(current.expression.expression)
    ) {
      return functions.byQualifiedName.get(
        `${current.expression.expression.text}.${current.name.text}`,
      ) ?? new Set();
    }
  }
  if (
    ts.isElementAccessExpression(current)
    && ts.isIdentifier(current.expression)
    && current.argumentExpression
  ) {
    const name = literalText(ts, current.argumentExpression);
    return name
      ? functions.byQualifiedName.get(`${current.expression.text}.${name}`) ?? new Set()
      : new Set();
  }
  return new Set();
}

function isMembershipTargetExpression(ts, expression, bindings, initializers, seen = new Set()) {
  const current = unwrapExpression(ts, expression);
  if (bindings.isMembershipTable(current)) return true;
  if (staticStringText(ts, current, initializers) === 'tenant_members') return true;

  if (ts.isIdentifier(current) && !seen.has(current.text)) {
    const initializer = lexicalConstInitializer(ts, current, initializers);
    if (!initializer) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    return isMembershipTargetExpression(
      ts,
      initializer,
      bindings,
      initializers,
      nextSeen,
    );
  }
  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.some((element) =>
      isMembershipTargetExpression(ts, element, bindings, initializers, seen));
  }
  if (ts.isCallExpression(current)) {
    const name = propertyNameText(ts, current.expression);
    if (name === 'identifier' || name === 'ident') {
      return current.arguments.some((argument) =>
        isMembershipTargetExpression(ts, argument, bindings, initializers, seen));
    }
  }
  return false;
}

function analyzeLocalMutationSinks(ts, sourceFile, functions, initializers) {
  for (const descriptor of functions.descriptors) {
    visitFunctionBody(ts, descriptor, (node) => {
      if (ts.isCallExpression(node) && node.arguments.length > 0) {
        const operation = propertyNameText(ts, node.expression);
        if (operation === 'insert' || operation === 'update' || operation === 'delete') {
          const parameterIndex = parameterIndexForExpression(
            ts,
            descriptor,
            node.arguments[0],
            initializers,
          );
          if (parameterIndex >= 0) descriptor.targetParameterIndexes.add(parameterIndex);
        }
      }
      if (isSqlTaggedTemplate(ts, node, initializers)) {
        for (const target of dynamicMutationTargets(ts, node.template)) {
          const parameterIndex = parameterIndexForExpression(
            ts,
            descriptor,
            target,
            initializers,
          );
          if (parameterIndex >= 0) descriptor.targetParameterIndexes.add(parameterIndex);
        }
      }
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const descriptor of functions.descriptors) {
      visitFunctionBody(ts, descriptor, (node) => {
        if (!ts.isCallExpression(node)) return;
        for (const called of calledFunctionDescriptors(ts, functions, node.expression)) {
          for (const targetIndex of called.targetParameterIndexes) {
            const argument = node.arguments[targetIndex];
            if (!argument) continue;
            const parameterIndex = parameterIndexForExpression(
              ts,
              descriptor,
              argument,
              initializers,
            );
            if (parameterIndex >= 0 && !descriptor.targetParameterIndexes.has(parameterIndex)) {
              descriptor.targetParameterIndexes.add(parameterIndex);
              changed = true;
            }
          }
        }
      });
    }
  }
}

function exportedMutationSinksForModule(
  ts,
  repositoryRoot,
  tree,
  filePath,
  cache = new Map(),
  visiting = new Set(),
) {
  if (!SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
    return new Map();
  }
  if (cache.has(filePath)) return cache.get(filePath);
  if (visiting.has(filePath)) return new Map();
  visiting.add(filePath);

  const sourceFile = createMembershipWriterSourceFile(
    ts,
    filePath,
    readBlob(repositoryRoot, tree, filePath),
  );
  const functions = localFunctionDescriptors(ts, sourceFile);
  const initializers = collectConstInitializers(ts, sourceFile);
  analyzeLocalMutationSinks(ts, sourceFile, functions, initializers);
  const exported = new Map();
  for (const descriptor of functions.descriptors) {
    if (descriptor.targetParameterIndexes.size === 0) continue;
    for (const exportName of descriptor.exportNames) {
      exported.set(exportName, new Set(descriptor.targetParameterIndexes));
    }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;
    const target = resolvedInternalModule(ts, tree, filePath, statement.moduleSpecifier);
    if (!target) continue;
    const targetSinks = exportedMutationSinksForModule(
      ts,
      repositoryRoot,
      tree,
      target,
      cache,
      visiting,
    );
    if (!statement.exportClause) {
      for (const [name, indexes] of targetSinks) exported.set(name, new Set(indexes));
      continue;
    }
    if (!ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      const originalName = element.propertyName?.text ?? element.name.text;
      for (const [targetName, indexes] of targetSinks) {
        if (targetName === originalName) {
          exported.set(element.name.text, new Set(indexes));
        } else if (targetName.startsWith(`${originalName}.`)) {
          exported.set(
            `${element.name.text}${targetName.slice(originalName.length)}`,
            new Set(indexes),
          );
        }
      }
    }
  }

  visiting.delete(filePath);
  cache.set(filePath, exported);
  return exported;
}

function collectImportedMutationSinks(
  ts,
  repositoryRoot,
  tree,
  filePath,
  sourceFile,
  moduleFilter = null,
) {
  const identifiers = new Map();
  const objects = new Map();
  const namespaces = new Map();
  const cache = new Map();

  const bindExport = (localName, exportedName, sinks) => {
    const direct = sinks.get(exportedName);
    if (direct) identifiers.set(localName, direct);
    const methods = new Map();
    for (const [name, indexes] of sinks) {
      const prefix = `${exportedName}.`;
      if (name.startsWith(prefix)) methods.set(name.slice(prefix.length), indexes);
    }
    if (methods.size > 0) objects.set(localName, methods);
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const target = resolvedInternalModule(ts, tree, filePath, statement.moduleSpecifier);
    if (!target) continue;
    if (moduleFilter && !moduleFilter.has(target)) continue;
    const sinks = exportedMutationSinksForModule(ts, repositoryRoot, tree, target, cache);
    if (sinks.size === 0) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) bindExport(clause.name.text, 'default', sinks);
    if (!clause.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaces.set(clause.namedBindings.name.text, sinks);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      bindExport(element.name.text, importedName, sinks);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const initializer = unwrapExpression(ts, node.initializer);
        if (ts.isIdentifier(node.name)) {
          let methods = null;
          if (ts.isIdentifier(initializer)) methods = objects.get(initializer.text) ?? null;
          if (
            ts.isNewExpression(initializer)
            && ts.isIdentifier(initializer.expression)
          ) {
            methods = objects.get(initializer.expression.text) ?? null;
          }
          if (methods && objects.get(node.name.text) !== methods) {
            objects.set(node.name.text, methods);
            changed = true;
          }
        }
        if (ts.isObjectBindingPattern(node.name) && ts.isIdentifier(initializer)) {
          const methods = objects.get(initializer.text);
          if (methods) {
            for (const element of node.name.elements) {
              if (!ts.isIdentifier(element.name)) continue;
              const property = element.propertyName
                ? propertyNameText(ts, element.propertyName)
                : element.name.text;
              const indexes = property ? methods.get(property) : null;
              if (indexes && identifiers.get(element.name.text) !== indexes) {
                identifiers.set(element.name.text, indexes);
                changed = true;
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return {
    hasAny: identifiers.size > 0 || objects.size > 0 || namespaces.size > 0,
    indexesFor(expression) {
      const current = unwrapExpression(ts, expression);
      if (ts.isIdentifier(current)) return identifiers.get(current.text) ?? new Set();
      if (
        ts.isPropertyAccessExpression(current)
      ) {
        if (ts.isIdentifier(current.expression)) {
          const objectMethod = objects.get(current.expression.text)?.get(current.name.text);
          if (objectMethod) return objectMethod;
          return namespaces.get(current.expression.text)?.get(current.name.text) ?? new Set();
        }
        if (
          ts.isNewExpression(current.expression)
          && ts.isIdentifier(current.expression.expression)
        ) {
          return objects.get(current.expression.expression.text)?.get(current.name.text) ?? new Set();
        }
      }
      if (
        ts.isElementAccessExpression(current)
        && ts.isIdentifier(current.expression)
        && current.argumentExpression
      ) {
        const name = literalText(ts, current.argumentExpression);
        if (!name) return new Set();
        const objectMethod = objects.get(current.expression.text)?.get(name);
        if (objectMethod) return objectMethod;
        return namespaces.get(current.expression.text)?.get(name) ?? new Set();
      }
      return new Set();
    },
  };
}

function reexportClosure(ts, repositoryRoot, tree, originPath) {
  const affected = new Set([originPath]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidatePath of tree.keys()) {
      if (
        affected.has(candidatePath)
        || !SOURCE_EXTENSIONS.some((extension) => candidatePath.endsWith(extension))
      ) {
        continue;
      }
      const sourceFile = createMembershipWriterSourceFile(
        ts,
        candidatePath,
        readBlob(repositoryRoot, tree, candidatePath),
      );
      const reexportsAffected = sourceFile.statements.some((statement) => {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) return false;
        const target = resolvedInternalModule(ts, tree, candidatePath, statement.moduleSpecifier);
        return Boolean(target && affected.has(target));
      });
      if (reexportsAffected) {
        affected.add(candidatePath);
        changed = true;
      }
    }
  }
  return affected;
}

function headHasMembershipCallToChangedSink(ts, repositoryRoot, tree, changedFilePath) {
  const changedSinks = exportedMutationSinksForModule(
    ts,
    repositoryRoot,
    tree,
    changedFilePath,
  );
  if (changedSinks.size === 0) return false;
  const affectedModules = reexportClosure(ts, repositoryRoot, tree, changedFilePath);

  for (const candidatePath of tree.keys()) {
    if (!isMembershipWriterSource(candidatePath) || candidatePath === changedFilePath) continue;
    const sourceFile = createMembershipWriterSourceFile(
      ts,
      candidatePath,
      readBlob(repositoryRoot, tree, candidatePath),
    );
    const importedSinks = collectImportedMutationSinks(
      ts,
      repositoryRoot,
      tree,
      candidatePath,
      sourceFile,
      affectedModules,
    );
    if (!importedSinks.hasAny) continue;
    const bindings = collectMembershipBindings(
      ts,
      repositoryRoot,
      tree,
      candidatePath,
      sourceFile,
    );
    const initializers = collectConstInitializers(ts, sourceFile);
    let found = false;
    const visit = (node) => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        for (const targetIndex of importedSinks.indexesFor(node.expression)) {
          const argument = node.arguments[targetIndex];
          if (
            argument
            && isMembershipTargetExpression(ts, argument, bindings, initializers)
          ) {
            found = true;
            return;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (found) return true;
  }
  return false;
}

function hasMembershipDirectWriter(ts, repositoryRoot, tree, filePath) {
  const sourceFile = createMembershipWriterSourceFile(
    ts,
    filePath,
    readBlob(repositoryRoot, tree, filePath),
  );
  const bindings = collectMembershipBindings(ts, repositoryRoot, tree, filePath, sourceFile);
  const functions = localFunctionDescriptors(ts, sourceFile);
  const initializers = collectConstInitializers(ts, sourceFile);
  const importedSinks = collectImportedMutationSinks(
    ts,
    repositoryRoot,
    tree,
    filePath,
    sourceFile,
  );
  analyzeLocalMutationSinks(ts, sourceFile, functions, initializers);
  let directViolation = headHasMembershipCallToChangedSink(
    ts,
    repositoryRoot,
    tree,
    filePath,
  );

  const visit = (node) => {
    if (directViolation) return;
    if (
      isDrizzleMutationCall(
        ts,
        node,
        (target) => isMembershipTargetExpression(ts, target, bindings, initializers),
      )
    ) {
      directViolation = true;
      return;
    }
    if (isSqlTaggedTemplate(ts, node, initializers)) {
      const evidence = templateEvidence(ts, node.template);
      if (containsMembershipMutationSql(evidence.text)) {
        directViolation = true;
        return;
      }
      for (const target of dynamicMutationTargets(ts, node.template)) {
        if (isMembershipTargetExpression(ts, target, bindings, initializers)) {
          directViolation = true;
          return;
        }
      }
    }
    if (executableSqlCall(ts, node, initializers)) {
      for (const argument of node.arguments) {
        if (staticSqlTexts(ts, argument, initializers).some(containsMembershipMutationSql)) {
          directViolation = true;
          return;
        }
      }
    }
    if (ts.isCallExpression(node)) {
      for (const called of calledFunctionDescriptors(ts, functions, node.expression)) {
        for (const targetIndex of called.targetParameterIndexes) {
          const argument = node.arguments[targetIndex];
          if (!argument) continue;
          if (isMembershipTargetExpression(ts, argument, bindings, initializers)) {
            directViolation = true;
            return;
          }
        }
      }
      for (const targetIndex of importedSinks.indexesFor(node.expression)) {
        const argument = node.arguments[targetIndex];
        if (
          argument
          && isMembershipTargetExpression(ts, argument, bindings, initializers)
        ) {
          directViolation = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return directViolation;
}

function collectViolations(ts, repositoryRoot, baseTree, headTree, changes, exceptions) {
  const violations = [];

  for (const change of changes) {
    if (change.status === 'D') {
      continue;
    }

    if (change.status === 'A' || change.status === 'C' || change.status === 'R') {
      const previousRuleIds = change.status === 'R'
        ? new Set(pathRuleIds(change.oldPath))
        : new Set();
      for (const ruleId of pathRuleIds(change.path)) {
        if (previousRuleIds.has(ruleId)) {
          continue;
        }
        violations.push({ ruleId, path: change.path });
      }
    }

    if (
      isMembershipWriterSource(change.path)
      && !MEMBERSHIP_WRITER_ALLOWLIST.has(change.path)
      && headTree.has(change.path)
      && hasMembershipDirectWriter(ts, repositoryRoot, headTree, change.path)
    ) {
      violations.push({ ruleId: MEMBERSHIP_WRITER_RULE_ID, path: change.path });
    }

    if (!isProductionModuleSource(change.path)) {
      continue;
    }
    if (!headTree.has(change.path)) {
      fail(`head 中缺少变更文件：${change.path}`);
    }

    const addedViolations = addedDependencyViolations(
      ts,
      repositoryRoot,
      baseTree,
      headTree,
      change,
    );
    violations.push(...addedViolations);
  }

  const unique = new Map();
  for (const violation of violations) {
    const key = 'path' in violation
      ? `${violation.ruleId}\0${violation.path}`
      : `${violation.ruleId}\0${violation.from}\0${violation.to}`;
    if (!exceptions.some((exception) => exceptionMatches(exception, violation))) {
      unique.set(key, violation);
    }
  }

  return [...unique.values()].sort((left, right) => {
    const leftKey = 'path' in left
      ? `${left.ruleId}\0${left.path}`
      : `${left.ruleId}\0${left.from}\0${left.to}`;
    const rightKey = 'path' in right
      ? `${right.ruleId}\0${right.path}`
      : `${right.ruleId}\0${right.from}\0${right.to}`;
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  });
}

function printViolations(violations) {
  console.error(`架构质量检查未通过：发现 ${violations.length} 项新增违规。`);
  for (const violation of violations) {
    if ('path' in violation) {
      console.error(`- [${violation.ruleId}] ${RULE_MESSAGES[violation.ruleId]} 路径：${violation.path}`);
    } else {
      console.error(
        `- [${violation.ruleId}] ${RULE_MESSAGES[violation.ruleId]} 来源：${violation.from}；目标：${violation.to}`,
      );
    }
  }
}

async function main() {
  const { base, head } = parseArguments(process.argv.slice(2));
  const repositoryRoot = resolveRepositoryRoot(process.cwd());
  const baseCommit = resolveCommit(repositoryRoot, 'base', base);
  const headCommit = resolveCommit(repositoryRoot, 'head', head);
  const mergeBase = findMergeBase(repositoryRoot, baseCommit, headCommit);
  const [baseTree, headTree] = [
    loadTree(repositoryRoot, mergeBase),
    loadTree(repositoryRoot, headCommit),
  ];

  const configPath = 'scripts/verify/architecture-quality-rules.json';
  const configRaw = readBlob(repositoryRoot, headTree, configPath);
  const exceptions = loadRulesConfig(configRaw, headTree);

  let ts;
  try {
    const imported = await import('typescript');
    ts = imported.default ?? imported;
  } catch {
    fail('无法加载 TypeScript Compiler API。');
  }

  const changes = parseDiff(repositoryRoot, mergeBase, headCommit);
  const violations = collectViolations(
    ts,
    repositoryRoot,
    baseTree,
    headTree,
    changes,
    exceptions,
  );
  if (violations.length > 0) {
    printViolations(violations);
    process.exitCode = EXIT_VIOLATION;
    return;
  }

  console.log('架构质量检查通过：未发现新增架构违规。');
  process.exitCode = EXIT_OK;
}

main().catch((error) => {
  const message = error instanceof ArchitectureQualityError
    ? error.message
    : '发生未分类的内部错误。';
  console.error(`架构质量检查错误：${message}`);
  process.exitCode = EXIT_ERROR;
});
