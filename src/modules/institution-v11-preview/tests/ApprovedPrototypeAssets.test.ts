import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  findApprovedPrototypePackageRoot,
  getApprovedPrototypeContentType,
  prepareApprovedPrototypeHtml,
  readApprovedPrototypeAsset,
  resolveApprovedPrototypeAssetPath,
} from '@/modules/institution-v11-preview/server/approved-prototype-assets';
import {
  isInstitutionV11HospitalSyncEnabled,
  isInstitutionV11VisualPreviewEnabled,
  resolveInstitutionV11HospitalEntryMode,
} from '@/modules/institution-v11-preview/server/visual-preview-gate';

describe('Approved prototype asset boundary', () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.splice(0).map((root) =>
        rm(root, { recursive: true, force: true }),
      ),
    );
  });

  it('仅在开发和测试环境开放', () => {
    expect(isInstitutionV11VisualPreviewEnabled('development')).toBe(true);
    expect(isInstitutionV11VisualPreviewEnabled('test')).toBe(true);
    expect(isInstitutionV11VisualPreviewEnabled('production')).toBe(false);
  });

  it('正式 /hospital 仅在本地开发环境同步 Approved 界面', () => {
    expect(isInstitutionV11HospitalSyncEnabled('development')).toBe(true);
    expect(isInstitutionV11HospitalSyncEnabled('test')).toBe(false);
    expect(isInstitutionV11HospitalSyncEnabled('production')).toBe(false);
  });

  it('本地 /hospital 不再回退旧壳层，已授权显示 Approved，未授权进入登录页', () => {
    expect(
      resolveInstitutionV11HospitalEntryMode({
        syncEnabled: true,
        genuineAllowed: true,
      }),
    ).toBe('approved');
    expect(
      resolveInstitutionV11HospitalEntryMode({
        syncEnabled: true,
        genuineAllowed: false,
      }),
    ).toBe('login');
    expect(
      resolveInstitutionV11HospitalEntryMode({
        syncEnabled: false,
        genuineAllowed: false,
      }),
    ).toBe('legacy');
  });

  it('只允许读取批准包根目录内的文件', () => {
    const root = '/tmp/zmtg-approved-reference';

    expect(resolveApprovedPrototypeAssetPath(root, ['institution.html'])).toBe(
      path.join(root, 'institution.html'),
    );
    expect(resolveApprovedPrototypeAssetPath(root, ['assets', 'templates', '客户.xlsx'])).toBe(
      path.join(root, 'assets/templates/客户.xlsx'),
    );
    expect(resolveApprovedPrototypeAssetPath(root, ['..', 'secret.txt'])).toBeNull();
    expect(resolveApprovedPrototypeAssetPath(root, [])).toBeNull();
  });

  it('使用准确的静态资源类型', () => {
    expect(getApprovedPrototypeContentType('institution.html')).toBe('text/html; charset=utf-8');
    expect(getApprovedPrototypeContentType('template.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(getApprovedPrototypeContentType('unknown.bin')).toBe('application/octet-stream');
  });

  it('仅在预览响应中提高动作按钮优先级', () => {
    const legacyHtml = [
      '<script>',
      'const handleAction=()=>{};',
      '<aside class="drawer" onclick="event.stopPropagation()">',
      '<button data-action="pick-slot" data-customer="c001">选择时段</button>',
      '</aside>',
      '<section class="modal" onclick="event.stopPropagation()">内容</section>',
      "document.addEventListener('click',e=>{});",
      '</script>',
    ].join('');

    const preparedHtml = prepareApprovedPrototypeHtml(legacyHtml);

    expect(preparedHtml.match(/onclick="event\.stopPropagation\(\)"/g)).toHaveLength(2);
    expect(preparedHtml).toContain("e.target.closest?.('[data-action]')");
    expect(preparedHtml).toContain('e.stopImmediatePropagation()');
    expect(preparedHtml).toContain("act.classList.contains('backdrop')");
    expect(preparedHtml).toContain('[data-action]');
  });

  it('从受控候选根读取 V1.1 Approved 原型包', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zmtg-approved-'));
    temporaryRoots.push(root);
    await writeFile(
      path.join(root, 'institution.html'),
      [
        '<!doctype html>',
        '<title>机构端统一交互原型 V1.1 APPROVED</title>',
        '<script>',
        'const handleAction=()=>{};',
        "document.addEventListener('click',e=>{});",
        '</script>',
      ].join(''),
      'utf8',
    );
    const resolvedRoot = await findApprovedPrototypePackageRoot([root]);
    const asset = await readApprovedPrototypeAsset(
      ['institution.html'],
      [root],
    );

    expect(resolvedRoot).toBe(root);
    expect(asset?.contentType).toBe('text/html; charset=utf-8');
    expect(asset?.bytes.toString('utf8')).toContain('机构端统一交互原型 V1.1 APPROVED');
    expect(asset?.bytes.toString('utf8')).toContain('e.stopImmediatePropagation()');
  });
});
