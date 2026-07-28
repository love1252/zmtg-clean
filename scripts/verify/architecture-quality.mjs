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
