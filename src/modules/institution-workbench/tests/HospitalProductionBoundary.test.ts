import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ImportKind = 'dynamic' | 'require' | 'static';

type ImportOccurrence = {
  bindings: string[];
  kind: ImportKind;
  line: number;
  moduleSpecifier: string;
};

type BoundaryViolation = ImportOccurrence & {
  reason: string;
};

const HOSPITAL_SOURCE_ROOT = resolve(process.cwd(), 'src/app/hospital');
const PRODUCTION_SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const TEST_SOURCE_FILE = /\.test\.(?:[cm]?[jt]s|[jt]sx)$/u;

const PROHIBITED_BINDINGS = new Set([
  'InstitutionAiServiceUsageShell',
  'InstitutionWorkspace',
  'getDemoAccessContextFromRequest',
]);

function collectBindingNames(bindingName: ts.BindingName): string[] {
  if (ts.isIdentifier(bindingName)) return [bindingName.text];

  return bindingName.elements.flatMap((element) => {
    if (ts.isOmittedExpression(element)) return [];

    const propertyName = element.propertyName;
    const propertyBinding = propertyName && ts.isIdentifier(propertyName) ? [propertyName.text] : [];

    return [...propertyBinding, ...collectBindingNames(element.name)];
  });
}

function collectImportClauseBindings(importClause: ts.ImportClause | undefined): string[] {
  if (!importClause) return [];

  const bindings = importClause.name ? [importClause.name.text] : [];
  const namedBindings = importClause.namedBindings;

  if (!namedBindings) return bindings;
  if (ts.isNamespaceImport(namedBindings)) return [...bindings, namedBindings.name.text];

  return [
    ...bindings,
    ...namedBindings.elements.flatMap((element) => [
      ...(element.propertyName ? [element.propertyName.text] : []),
      element.name.text,
    ]),
  ];
}

function getStringModuleSpecifier(expression: ts.Expression): string | null {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
    ? expression.text
    : null;
}

function collectCallBindings(node: ts.CallExpression): string[] {
  let expression: ts.Node = node;

  while (
    ts.isAwaitExpression(expression.parent) ||
    ts.isParenthesizedExpression(expression.parent) ||
    ts.isAsExpression(expression.parent) ||
    ts.isTypeAssertionExpression(expression.parent) ||
    ts.isNonNullExpression(expression.parent) ||
    ts.isPropertyAccessExpression(expression.parent)
  ) {
    expression = expression.parent;
  }

  return ts.isVariableDeclaration(expression.parent) ? collectBindingNames(expression.parent.name) : [];
}

function getScriptKind(sourcePath: string): ts.ScriptKind {
  if (sourcePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (sourcePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (sourcePath.endsWith('.js') || sourcePath.endsWith('.mjs') || sourcePath.endsWith('.cjs')) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function collectImportOccurrences(sourcePath: string, sourceText: string): ImportOccurrence[] {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(sourcePath),
  );
  const occurrences: ImportOccurrence[] = [];

  function addOccurrence(
    kind: ImportKind,
    moduleSpecifier: string | null,
    bindings: string[],
    node: ts.Node,
  ) {
    if (!moduleSpecifier) return;

    occurrences.push({
      bindings,
      kind,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      moduleSpecifier,
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      addOccurrence(
        'static',
        getStringModuleSpecifier(node.moduleSpecifier),
        collectImportClauseBindings(node.importClause),
        node,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addOccurrence(
        'static',
        node.moduleReference.expression
          ? getStringModuleSpecifier(node.moduleReference.expression)
          : null,
        [node.name.text],
        node,
      );
    } else if (ts.isCallExpression(node)) {
      const moduleSpecifier = node.arguments[0]
        ? getStringModuleSpecifier(node.arguments[0])
        : null;

      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addOccurrence('dynamic', moduleSpecifier, collectCallBindings(node), node);
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        addOccurrence('require', moduleSpecifier, collectCallBindings(node), node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return occurrences;
}

function isFixtureOrMockBusinessShell(value: string): boolean {
  const normalized = value.toLowerCase();
  const looksLikeFixtureOrMock = normalized.includes('fixture') || normalized.includes('mock');
  const looksLikeBusinessShell = normalized.includes('shell') || normalized.includes('workspace');

  return looksLikeFixtureOrMock && looksLikeBusinessShell;
}

function findBoundaryViolations(occurrences: ImportOccurrence[]): BoundaryViolation[] {
  return occurrences.flatMap((occurrence) => {
    const reasons: string[] = [];

    if (
      occurrence.moduleSpecifier === '@/modules/workspace' ||
      occurrence.moduleSpecifier.startsWith('@/modules/workspace/')
    ) {
      reasons.push('禁止导入旧 workspace 模块');
    }

    if (isFixtureOrMockBusinessShell(occurrence.moduleSpecifier)) {
      reasons.push('禁止导入 fixture/mock business shell');
    }

    for (const binding of occurrence.bindings) {
      if (PROHIBITED_BINDINGS.has(binding)) {
        reasons.push(`禁止导入 ${binding}`);
      } else if (isFixtureOrMockBusinessShell(binding)) {
        reasons.push('禁止导入 fixture/mock business shell');
      }
    }

    return reasons.map((reason) => ({ ...occurrence, reason }));
  });
}

function findHospitalProductionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) return findHospitalProductionSources(entryPath);
    if (
      !entry.isFile() ||
      !PRODUCTION_SOURCE_FILE.test(entry.name) ||
      TEST_SOURCE_FILE.test(entry.name)
    ) {
      return [];
    }

    return [entryPath];
  });
}

describe('WB-GATE-01 /hospital 生产入口边界', () => {
  it('递归拒绝旧演示 workspace、demo 权限路径和 fixture/mock business shell 导入', () => {
    const productionSources = findHospitalProductionSources(HOSPITAL_SOURCE_ROOT);
    const violations = productionSources.flatMap((sourcePath) =>
      findBoundaryViolations(collectImportOccurrences(sourcePath, readFileSync(sourcePath, 'utf8'))).map(
        (violation) => ({
          ...violation,
          sourcePath: relative(process.cwd(), sourcePath),
        }),
      ),
    );

    expect(productionSources.map((sourcePath) => relative(process.cwd(), sourcePath))).not.toEqual([]);
    expect(violations).toEqual([]);
  });

  it('以 TypeScript AST 负例验证静态、动态和 require 导入均 fail-closed，注释不参与判定', () => {
    const negativeControl = `
      // import { InstitutionWorkspace } from '@/modules/workspace/comment-only';
      const commentOnly = "require('@/modules/workspace/comment-only')";
      import { InstitutionWorkspace } from '@/modules/workspace/legacy';
      async function loadLegacyShell() {
        const { getDemoAccessContextFromRequest } = await import('@/modules/auth/demo-access');
        await import('@/modules/workspace/dynamic-legacy');
        const { InstitutionAiServiceUsageShell } = require('@/modules/ai/service-usage');
        const mockShell = require('@/modules/fake/mock-workspace-shell');
        return [InstitutionWorkspace, getDemoAccessContextFromRequest, mockShell];
      }
    `;

    const violations = findBoundaryViolations(
      collectImportOccurrences('negative-control.ts', negativeControl),
    );

    expect(new Set(violations.map(({ kind, moduleSpecifier }) => `${kind}:${moduleSpecifier}`))).toEqual(
      new Set([
        'static:@/modules/workspace/legacy',
        'dynamic:@/modules/auth/demo-access',
        'dynamic:@/modules/workspace/dynamic-legacy',
        'require:@/modules/ai/service-usage',
        'require:@/modules/fake/mock-workspace-shell',
      ]),
    );
    expect(violations.some((violation) => violation.moduleSpecifier.includes('comment-only'))).toBe(false);
  });
});
