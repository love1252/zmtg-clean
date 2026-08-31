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
    expect(preparedHtml).toContain(
      'globalThis.__institutionV11RefinementAction?.(act.dataset.action,act)',
    );
    expect(preparedHtml).toContain('[data-action]');
  });

  it('收起侧栏时带子菜单的一级栏目进入默认路由，展开时仍切换子菜单', () => {
    const legacyNavigation =
      " const nav=e.target.closest('[data-nav]');if(nav){const n=DATA.nav.find(x=>x.id===nav.dataset.nav);if(n?.children){state.openNav=state.openNav===n.id?null:n.id;render()}else if(n)go(n.route);return}";
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body><script>',
      "const DATA={nav:[{id:'customers',route:'/customers/list',children:[['/customers/list','客户列表']]},{id:'care',route:'/appointments',children:[['/appointments','预约管理']]}]};",
      "const state={collapsed:true,openNav:null};const go=()=>{};const render=()=>{};",
      "document.addEventListener('click',e=>{",
      legacyNavigation,
      '});',
      '</script></body></html>',
    ].join(''));

    expect(preparedHtml).not.toContain(legacyNavigation);
    expect(preparedHtml).toContain(
      'if(state.collapsed){state.openNav=null;go(n.route)}',
    );
    expect(preparedHtml).toContain(
      'else{state.openNav=state.openNav===n.id?null:n.id;render()}',
    );
    expect(preparedHtml).toContain("route:'/customers/list'");
    expect(preparedHtml).toContain("route:'/appointments'");
    expect(preparedHtml).toContain("state.workbenchPending='all'");
    expect(preparedHtml).toContain("state.appointmentView='list'");
    expect(preparedHtml).toContain("state.knowledgeTab='知识文档'");
    expect(preparedHtml).toContain("state.analyticsTab='overview'");
    expect(preparedHtml).toContain("state.managementTab='institution'");
  });

  it('在正式 Approved 运行时细化工作台列表与响应式顶部栏', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain(
      'id="institution-v11-presentation-refinement"',
    );
    expect(preparedHtml).toContain(
      'id="institution-v11-presentation-refinement-runtime"',
    );
    expect(preparedHtml).toContain('.search-btn{width:auto;max-width:390px');
    expect(preparedHtml).toContain('.profile>span:nth-child(2)');
    expect(preparedHtml).toContain(
      '.list-row[data-pending]>.tag{width:28px;min-width:28px',
    );
    expect(preparedHtml).toContain(
      '.list-row[data-pending]>.muted:last-child{width:44px;flex:0 0 44px',
    );
    expect(preparedHtml).toContain(
      "document.querySelector('.review-ribbon')?.remove()",
    );
    expect(preparedHtml).toContain(
      "document.querySelector('.topbar .org')?.remove()",
    );
    expect(preparedHtml).toContain(
      "document.querySelector('.topbar .shell-link')?.remove()",
    );
    expect(preparedHtml).toContain(
      '.institution-brand-logo-wide{display:block;width:auto;height:42px',
    );
    expect(preparedHtml).toContain(
      '.institution-brand-lockup{width:100%;height:100%;display:flex;align-items:center;justify-content:center',
    );
    expect(preparedHtml).toContain(
      '.sidebar.collapsed .institution-brand-logo-mark{display:block}',
    );
    expect(preparedHtml).toContain(':root{--sidebar:212px}');
    expect(preparedHtml).toContain(
      '.sidebar.collapsed{width:68px;flex-basis:68px}',
    );
    expect(preparedHtml).toContain(
      'linear-gradient(180deg,#0d2a40 0%,#0a2234 52%,#081c2c 100%)',
    );
    expect(preparedHtml).toContain(
      '.nav-main.active{background:linear-gradient(90deg,rgba(45,136,210,.24)',
    );
    expect(preparedHtml).toContain(
      '@media (max-width:1050px){.app{min-width:0;width:100vw;overflow:hidden}',
    );
    expect(preparedHtml).toContain(
      '.tab-scroll{overflow-x:auto;overflow-y:hidden;scrollbar-width:none}',
    );
    expect(preparedHtml).toContain(
      '.kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    );
    expect(preparedHtml).toContain(
      '.conversation{grid-template-columns:60px 210px minmax(0,1fr);min-height:0;margin:-16px -16px -30px}',
    );
    expect(preparedHtml).toContain(
      'if(narrow&&!responsiveSidebarNarrow&&!state.collapsed)',
    );
    expect(preparedHtml).toContain(
      "wideLogo.src='/brand/zmtg-logo-horizontal-night-clean.png'",
    );
    expect(preparedHtml).toContain("markLogo.src='/brand/logo-mark.png'");
    expect(preparedHtml).toContain("brand.replaceChildren(lockup)");
    expect(preparedHtml).toContain("conversation:'会话'");
    expect(preparedHtml).toContain("appointment:'预约'");
    expect(preparedHtml).toContain("followup:'随访'");
    expect(preparedHtml).toContain("opportunity:'机会'");
    expect(preparedHtml).toContain('appointment-status-dot');
    expect(preparedHtml).toContain('new MutationObserver(refine)');
  });

  it('按参考工作台统一正文、标题、指标、列表与辅助文字的字号和字重层级', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain(
      'id="institution-v11-typography-refinement"',
    );
    expect(preparedHtml).toContain('.pagehead h1{font-size:24px;font-weight:750');
    expect(preparedHtml).toContain('.card-head h2{font-size:16px;font-weight:700');
    expect(preparedHtml).toContain('.kvalue{font-size:26px;font-weight:800');
    expect(preparedHtml).toContain('.list-title{font-size:13px;font-weight:600');
    expect(preparedHtml).toContain('.list-meta{font-size:11px;font-weight:400');
    expect(preparedHtml).toContain('.table th{font-size:12px;font-weight:650');
    expect(preparedHtml).toContain(
      '.table th:nth-last-child(-n+2),.table td:nth-last-child(-n+2){white-space:nowrap}',
    );
    expect(preparedHtml).toContain('.tag{font-size:11px;font-weight:600');
    expect(preparedHtml).toContain(
      '.conversation{grid-template-columns:66px 250px minmax(360px,1fr) 270px}',
    );
    expect(preparedHtml).toContain(
      '.chat-head .actions .btn,.chat-head .actions .select',
    );
  });

  it('在 Approved 运行时按授权作用域注入机构，并从同源会话补全当前账号', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''), {
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
      institutionName: '澄星医疗美容',
    });

    expect(preparedHtml).toContain(
      '"institutionName":"澄星医疗美容"',
    );
    expect(preparedHtml).toContain("fetch('/api/auth/session'");
    expect(preparedHtml).toContain(
      'user.tenantId!==approvedInstitutionContext.tenantId',
    );
    expect(preparedHtml).toContain(
      'user.institutionId!==approvedInstitutionContext.institutionId',
    );
    expect(preparedHtml).not.toContain("institution:'上海美颜'");
    expect(preparedHtml).toContain("item.dataset.action='preview-personal-info'");
    expect(preparedHtml).toContain("item.dataset.action='preview-account-security'");
    expect(preparedHtml).toContain("item.dataset.action='preview-session-logout'");
    expect(preparedHtml).toContain("action:'preview-confirm-logout'");
    expect(preparedHtml).toContain("fetch('/api/auth/logout'");
    expect(preparedHtml).toContain("method:'POST'");
    expect(preparedHtml).toContain("credentials:'same-origin'");
    expect(preparedHtml).toContain(
      "window.parent.postMessage({type:'institution-v11:logout-complete'},window.location.origin)",
    );
    expect(preparedHtml).toContain("else window.location.assign('/login')");
    expect(preparedHtml).toContain('不展示手机号、Cookie、Token 或其他敏感信息');
  });

  it('对机构展示名称做 HTML-safe JSON 注入', () => {
    const preparedHtml = prepareApprovedPrototypeHtml(
      '<html><head></head><body></body></html>',
      {
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
        institutionName: '</script><script>alert(1)</script>',
      },
    );

    expect(preparedHtml).toContain('\\u003c/script\\u003e');
    expect(preparedHtml).not.toContain('<script>alert(1)</script>');
  });

  it('补齐 Approved 原型中的分页、批量分群、会话附件、话术和方案编辑交互', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain(
      'id="institution-v11-interaction-completion-runtime"',
    );
    expect(preparedHtml).toContain("button.dataset.action='preview-page'");
    expect(preparedHtml).toContain("'preview-batch-segment'");
    expect(preparedHtml).toContain("'preview-compose-image'");
    expect(preparedHtml).toContain("'preview-compose-file'");
    expect(preparedHtml).toContain("'preview-compose-phrase'");
    expect(preparedHtml).toContain("'preview-edit-plan-trigger'");
    expect(preparedHtml).toContain("'preview-apply-node-offset'");
    expect(preparedHtml).toContain('当前为 Approved 交互预览');
  });

  it('客户列表使用正式 Reader 分页并支持页容量与独立滚动', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('CUSTOMER_LIST_PAGE_SIZES=[10,20,50,100]');
    expect(preparedHtml).toContain(
      "fetch(customerListUrl(page,pageSize)",
    );
    expect(preparedHtml).toContain('credentials:\'same-origin\'');
    expect(preparedHtml).toContain('preview-customer-table-scroll');
    expect(preparedHtml).toContain(
      '.preview-customer-table-scroll .table thead{position:sticky;top:0;z-index:3}',
    );
    expect(preparedHtml).toContain('data-customer-page-size');
    expect(preparedHtml).toContain('data-action="preview-customer-page"');
    expect(preparedHtml).toContain("if(action==='preview-customer-card-toggle')");
    expect(preparedHtml).toContain('record.displayName');
    expect(preparedHtml).toContain('未接入投影');
    expect(preparedHtml).toContain('手机号、微信、负责人和业务载荷均未读取');
    expect(preparedHtml).toContain(
      '客户表格、分页、快捷筛选与高级筛选来自当前本地开发数据库的正式 Customer Reader',
    );
    expect(preparedHtml).toContain(
      '当前仅显示登录账号有权访问的 tenantId + institutionId 客户主档',
    );
    expect(preparedHtml).toContain("query.set('keyword',activeFilters.keyword)");
    expect(preparedHtml).toContain("query.set('gender',activeFilters.gender)");
    expect(preparedHtml).toContain("query.set('ageBand',activeFilters.ageBand)");
    expect(preparedHtml).toContain("query.set('createdFrom',activeFilters.createdFrom)");
    expect(preparedHtml).toContain("data-action=\"preview-customer-quick\"");
    expect(preparedHtml).toContain('快捷筛选');
    expect(preparedHtml).toContain('保存视图尚无正式持久化契约');
    expect(preparedHtml).toContain("[['female','女'],['male','男']]");
    expect(preparedHtml).toContain('CUSTOMER_AGE_BAND_LABELS');
    expect(preparedHtml).toContain("if(action==='apply-advanced-filter')");
    expect(preparedHtml).toContain('#popover .layer{z-index:130}');
    expect(preparedHtml).toContain("datePickerDraft.target==='customer-created-range'");
    expect(preparedHtml).toContain(
      'quick&&quick.dataset.customerFilterSignature!==filterSignature',
    );
    expect(preparedHtml).toContain(
      'chips&&chips.dataset.customerFilterSignature!==filterSignature',
    );
    expect(preparedHtml).toContain(
      "page.querySelectorAll('.filter-chips:not(.preview-customer-filter-chips)').forEach(element=>element.remove())",
    );
    expect(preparedHtml).toContain("'当前机构筛选结果'");
  });

  it('客户分群只展示正式 Reader 可证明的人数并联动服务端筛选', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('CUSTOMER_SEGMENT_DEFINITIONS');
    expect(preparedHtml).toContain("label:'咨询中客户'");
    expect(preparedHtml).toContain("label:'已预约客户'");
    expect(preparedHtml).toContain("label:'术后关怀客户'");
    expect(preparedHtml).toContain("label:'复购窗口客户'");
    expect(preparedHtml).toContain("label:'沉默唤醒客户'");
    expect(preparedHtml).toContain("label:'高优先级客户'");
    expect(preparedHtml).toContain(
      "query.set('lifecycle',lifecycle)",
    );
    expect(preparedHtml).toContain("query.set('priority',priority)");
    expect(preparedHtml).toContain(
      '仅统计当前 tenantId + institutionId 范围内已授权记录',
    );
    expect(preparedHtml).toContain(
      '不展示任何原型演示人数',
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-customer-segment')",
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-clear-customer-segment')",
    );
    expect(preparedHtml).toContain('未回退到原型演示人数');
    expect(preparedHtml).toContain(
      "page.querySelector('.preview-real-segment-source')",
    );
  });

  it('工作台使用正式客户、预约与随访 Reader，且不会恢复原型固定数字', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('workbenchRuntime');
    expect(preparedHtml).toContain(
      "request(customerListUrl(1,10,null,null))",
    );
    expect(preparedHtml).toContain(
      "request('/api/v1/institution/appointments?page=1&pageSize=100')",
    );
    expect(preparedHtml).toContain(
      "request('/api/v1/institution/followups')",
    );
    expect(preparedHtml).toContain(
      'Customer、Appointment 与 Follow-up 均经过当前 tenantId + institutionId',
    );
    expect(preparedHtml).toContain(
      '不使用任何原型固定数据',
    );
    expect(preparedHtml).toContain(
      '正式 Analytics 聚合尚未开放',
    );
    expect(preparedHtml).toContain(
      "page.querySelector('.preview-workbench-runtime')",
    );
  });

  it('随访管理使用正式 Follow-up API 并提供分页、页容量与独立滚动', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('FOLLOW_UP_LIST_PAGE_SIZES=[10,20,50,100]');
    expect(preparedHtml).toContain(
      "fetch('/api/v1/institution/followups'",
    );
    expect(preparedHtml).toContain('preview-followup-runtime-card');
    expect(preparedHtml).toContain('preview-followup-pagebtn');
    expect(preparedHtml).toContain('data-followup-page-size');
    expect(preparedHtml).toContain(
      "if(action==='preview-followup-page')",
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-followup-card-toggle')",
    );
    expect(preparedHtml).toContain(
      "page.querySelector('.preview-followup-runtime-card')",
    );
    expect(preparedHtml).toContain(
      '不展示任何原型演示统计',
    );
    expect(preparedHtml).toContain(
      '消息状态、渠道、项目和随访方案未进入该 API',
    );
  });

  it('经营机会使用正式客户 Reader 的只读投影并支持分页与独立滚动', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('CUSTOMER_OPPORTUNITY_DEFINITIONS');
    expect(preparedHtml).toContain("label:'复诊机会'");
    expect(preparedHtml).toContain("label:'复购机会'");
    expect(preparedHtml).toContain("label:'沉默唤醒'");
    expect(preparedHtml).toContain(
      '根据当前机构客户主档生命周期生成可审计的只读机会候选',
    );
    expect(preparedHtml).toContain(
      '不创建正式 Opportunity，不启用旧机会池',
    );
    expect(preparedHtml).toContain(
      'fetch(customerListUrl(page,100,definition.lifecycle,priority,{})',
    );
    expect(preparedHtml).not.toContain(
      "fetch('/api/institution/opportunities'",
    );
    expect(preparedHtml).toContain('data-opportunity-page-size');
    expect(preparedHtml).toContain('preview-opportunity-pagebtn');
    expect(preparedHtml).toContain(
      "if(action==='preview-opportunity-page')",
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-opportunity-card-toggle')",
    );
    expect(preparedHtml).toContain(
      '.preview-opportunity-runtime-card{overflow:hidden!important}',
    );
    expect(preparedHtml).toContain('每页显示');
    expect(preparedHtml).toContain('未回退到旧机会池或原型 Demo');
    expect(preparedHtml).toContain('当前未启用机会 Writer');
  });

  it('预约指标、状态、日期与列表使用正式 Appointment Reader 并提供安全分页', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('APPOINTMENT_LIST_PAGE_SIZE=20');
    expect(preparedHtml).toContain('APPOINTMENT_LIST_PAGE_SIZES=[10,20,50,100]');
    expect(preparedHtml).toContain('APPOINTMENT_LIST_MAX_PAGE=100');
    expect(preparedHtml).toContain(
      "return'/api/v1/institution/appointments?'",
    );
    expect(preparedHtml).toContain(
      "fetch(appointmentListUrl(page,pageSize),{credentials:'same-origin'",
    );
    expect(preparedHtml).toContain('preview-appointment-runtime-card');
    expect(preparedHtml).toContain('preview-appointment-pagebtn');
    expect(preparedHtml).toContain(
      "if(action==='preview-appointment-page')",
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-appointment-card-toggle')",
    );
    expect(preparedHtml).toContain(
      "if(action==='preview-appointment-status')",
    );
    expect(preparedHtml).toContain('data-appointment-page-size');
    expect(preparedHtml).toContain('preview-appointment-date-clear');
    expect(preparedHtml).toContain('preview-appointment-query');
    expect(preparedHtml).toContain('data-appointment-keyword');
    expect(preparedHtml).toContain('appointmentListRuntime.summary.statusCounts');
    expect(preparedHtml).toContain("query.set('q',appointmentListRuntime.keyword)");
    expect(preparedHtml).toContain("query.set('startDate',appointmentListRuntime.startDate)");
    expect(preparedHtml).toContain("query.set('endDate',appointmentListRuntime.endDate)");
    expect(preparedHtml).toContain('正式预约主档实时汇总');
    expect(preparedHtml).toContain('record.customerDisplayName');
    expect(preparedHtml).toContain('record.project');
    expect(preparedHtml).toContain('appointmentDisplayCode');
    expect(preparedHtml).toContain('.preview-appointment-summary-card{');
    expect(preparedHtml).toContain("page.querySelector('.preview-appointment-runtime-card')");
    expect(preparedHtml).toContain('不补入原型 Demo');
    expect(preparedHtml).not.toContain('未补入原型中的 426 条 Demo 预约');
    expect(preparedHtml).toContain(
      '手机号、病历号、备注和 HIS 载荷不进入列表',
    );
    expect(preparedHtml).not.toContain(
      "fetch('/api/institution/appointments'",
    );
  });

  it('注入的 Approved 运行时脚本保持可解析', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));
    const scripts = Array.from(
      preparedHtml.matchAll(
        /<script id="institution-v11-[^"]+">([\s\S]*?)<\/script>/g,
      ),
      (match) => match[1],
    );

    expect(scripts).toHaveLength(2);
    expect(() => scripts.forEach((script) => new Function(script))).not.toThrow();
  });

  it('补齐客户更多、导入处理、筛选导出、Connector 和管理中心安全交互', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain("'preview-edit-customer'");
    expect(preparedHtml).toContain("'preview-customer-evidence'");
    expect(preparedHtml).toContain("'preview-merge-customer'");
    expect(preparedHtml).toContain("'preview-import-warnings'");
    expect(preparedHtml).toContain("'preview-import-errors'");
    expect(preparedHtml).toContain("if(action==='mock-query')");
    expect(preparedHtml).toContain("if(action==='export')");
    expect(preparedHtml).toContain("if(action==='new-member')");
    expect(preparedHtml).toContain("if(action==='new-segment')");
    expect(preparedHtml).toContain("if(action==='new-opportunity')");
    expect(preparedHtml).toContain("if(action==='test-connector')");
    expect(preparedHtml).toContain("if(action==='sync-now')");
    expect(preparedHtml).toContain('不连接真实 HIS、微信或其他外部系统');
  });

  it('客户 Excel 导入使用真实文件选择、服务端预检与本地开发库事务写入', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain("input.type='file'");
    expect(preparedHtml).toContain(
      "input.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    );
    expect(preparedHtml).toContain('CUSTOMER_IMPORT_MAX_BYTES=10*1024*1024');
    expect(preparedHtml).toContain('file.slice(0,4).arrayBuffer()');
    expect(preparedHtml).toContain("if(action==='choose-import-file')");
    expect(preparedHtml).toContain(
      "if(action==='import-next'&&state.importStep===2)",
    );
    expect(preparedHtml).toContain('if(state.importStep===2){ensureCustomerImportInput();');
    expect(preparedHtml).toContain(
      'const setTextIfChanged=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value}',
    );
    expect(preparedHtml).toContain(
      'if(body.dataset.customerImportRuntimeSignature===signature)return',
    );
    expect(preparedHtml).toContain(
      'body.dataset.customerImportRuntimeSignature=signature',
    );
    expect(preparedHtml).not.toContain(
      "if(heading)heading.textContent=customerImportFile",
    );
    expect(preparedHtml).toContain("fetch('/api/institution/customers/import'");
    expect(preparedHtml).toContain("requestCustomerImport('POST')");
    expect(preparedHtml).toContain("requestCustomerImport('PUT')");
    expect(preparedHtml).toContain("fetch('/api/institution/customers/import',{method:'GET'");
    expect(preparedHtml).toContain("if(action==='import-log')");
    expect(preparedHtml).toContain('暂无真实导入记录');
    expect(preparedHtml).toContain('未展示原型静态记录');
    expect(preparedHtml).toContain('正在导入…');
    expect(preparedHtml).toContain('写入本地开发库');
    expect(preparedHtml).toContain('数据库事务已整体回滚');
    expect(preparedHtml).toContain('重复不会自动合并');
    expect(preparedHtml).toContain('查看重复匹配与字段合并规则');
    expect(preparedHtml).toContain(
      "if(action==='preview-import-duplicate-guide')",
    );
    expect(preparedHtml).toContain('当前正式导入器不提供逐行候选或自动合并');
    expect(preparedHtml).toContain('手机号相同但姓名冲突时禁止自动合并');
    expect(preparedHtml).toContain(
      "button.title='当前正式导入器未开放自动合并或覆盖写入'",
    );
    expect(preparedHtml).not.toContain('28 条 · 可继续导入');
    expect(preparedHtml).not.toContain('15 条 · 需要在重复处理步骤人工确认');
  });

  it('将全部日期入口统一为可交互的双月日期范围选择器', () => {
    const preparedHtml = prepareApprovedPrototypeHtml([
      '<!doctype html>',
      '<html><head></head><body>',
      '<main>Approved</main>',
      '</body></html>',
    ].join(''));

    expect(preparedHtml).toContain('.preview-date-range-picker');
    expect(preparedHtml).toContain('.preview-calendar-panes');
    expect(preparedHtml).toContain("['日','一','二','三','四','五','六']");
    expect(preparedHtml).toContain("if(action==='date-menu'||action==='date-picker'||action==='analytics-period'||action==='strategy-calendar')");
    expect(preparedHtml).toContain("data-action=\"preview-date-prev-year\"");
    expect(preparedHtml).toContain("data-action=\"preview-date-prev-month\"");
    expect(preparedHtml).toContain("data-action=\"preview-date-next-month\"");
    expect(preparedHtml).toContain("data-action=\"preview-date-next-year\"");
    expect(preparedHtml).toContain("data-action=\"preview-date-day\"");
    expect(preparedHtml).toContain("data-action=\"preview-date-quick\"");
    expect(preparedHtml).toContain("action:'preview-date-apply'");
    expect(preparedHtml).toContain("state.dateSelection[datePickerDraft.target]");
    expect(preparedHtml).toContain("button.setAttribute('aria-haspopup','dialog')");
    expect(preparedHtml).toContain("const future=iso>today");
    expect(preparedHtml).toContain('disabled aria-disabled="true"');
    expect(preparedHtml).toContain('尚未到达，不可选择');
    expect(preparedHtml).toContain('尚未到达的日期不可选择');
    expect(preparedHtml).toContain('.preview-date-day.future');
    expect(preparedHtml).toContain("if(range==='month')start=new Date");
    expect(preparedHtml).toContain('delete state.dateSelection[target]');
    expect(preparedHtml).toContain("target==='appointment-range'?'选择已到日期'");
    expect(preparedHtml).toContain(
      "if(stored.start>today||stored.end>today)delete state.dateSelection[target]",
    );
    expect(preparedHtml).toContain(
      "if(datePickerDraft.target==='appointment-range')",
    );
    expect(preparedHtml).toContain(
      'startDate:datePickerDraft.start,endDate:datePickerDraft.end',
    );
    expect(preparedHtml).toContain(
      "void loadAppointmentList(1,appointmentListRuntime.pageSize)",
    );
  });

  it('将知识库上传替换为真实文件、解析预览、确认与发布闭环', () => {
    const preparedHtml = prepareApprovedPrototypeHtml(
      '<!doctype html><html><head></head><body><main>Approved</main></body></html>',
    );

    expect(preparedHtml).toContain('id="institution-knowledge-upload-file"');
    expect(preparedHtml).toContain('data-action="preview-knowledge-file-input"');
    expect(preparedHtml).toContain('aria-label="选择知识库上传文件"');
    expect(preparedHtml).toContain("if(action==='upload-knowledge')");
    expect(preparedHtml).toContain("method:'POST'");
    expect(preparedHtml).toContain("method:'PATCH'");
    expect(preparedHtml).toContain("method:'PUT'");
    expect(preparedHtml).toContain('确认解析内容');
    expect(preparedHtml).toContain('发布知识');
    expect(preparedHtml).toContain('未确认草稿不会进入 AI 可读取的正式知识清单');
    expect(preparedHtml).toContain('/api/v1/institution/knowledge-documents?page=1');
    expect(preparedHtml).toContain("document.querySelector('#page .preview-knowledge-runtime-card')");
    expect(preparedHtml).toContain('card.dataset.previewKnowledgeSignature===signature');
    expect(preparedHtml).toContain("Number(record.version)");
    expect(preparedHtml).not.toContain("Number(record.currentVersion)");
    expect(preparedHtml).toContain('当前机构暂无已发布知识');
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
