import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const APPROVED_PACKAGE_NAME = 'ZMTG_INSTITUTION_PROTOTYPE_V1_1_APPROVED';

export const APPROVED_PROTOTYPE_ROOT_CANDIDATES = [
  path.join(
    process.cwd(),
    '.codex-reference/institution-v1.1-approved',
    APPROVED_PACKAGE_NAME,
  ),
] as const;

const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export type ApprovedPrototypeRuntimeContextV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  institutionName: string;
}>;

const APPROVED_RUNTIME_CONTEXT_TOKEN =
  '__ZMTG_APPROVED_RUNTIME_CONTEXT_JSON__';
const DEFAULT_APPROVED_RUNTIME_CONTEXT = Object.freeze({
  tenantId: '',
  institutionId: '',
  institutionName: '当前机构',
}) satisfies ApprovedPrototypeRuntimeContextV1;

function serializeApprovedRuntimeContext(
  context: ApprovedPrototypeRuntimeContextV1 | null,
) {
  const value = context ?? DEFAULT_APPROVED_RUNTIME_CONTEXT;
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

const DOCUMENT_CLICK_DISPATCHER = "document.addEventListener('click',e=>{";
const APPROVED_NAVIGATION_DISPATCHER =
  " const nav=e.target.closest('[data-nav]');if(nav){const n=DATA.nav.find(x=>x.id===nav.dataset.nav);if(n?.children){state.openNav=state.openNav===n.id?null:n.id;render()}else if(n)go(n.route);return}";
const CANONICAL_PRIMARY_NAVIGATION_DISPATCHER =
  " const nav=e.target.closest('[data-nav]');if(nav){const n=DATA.nav.find(x=>x.id===nav.dataset.nav);if(n){if(n.id==='workbench')state.workbenchPending='all';if(n.id==='care'){state.appointmentView='list';state.appointmentStatus='all'}if(n.id==='knowledge')state.knowledgeTab='知识文档';if(n.id==='analytics')state.analyticsTab='overview';if(n.id==='management')state.managementTab='institution';if(n.children){if(state.collapsed){state.openNav=null;go(n.route)}else{state.openNav=state.openNav===n.id?null:n.id;render()}}else go(n.route)}return}";
const PREVIEW_ACTION_PRIORITY_BRIDGE = [
  "document.addEventListener('click',e=>{",
  "const act=e.target.closest?.('[data-action]');",
  "if(!act||act.matches('select,input,textarea')||(act.classList.contains('backdrop')&&e.target!==act))return;",
  'e.preventDefault();',
  'e.stopImmediatePropagation();',
  "if(globalThis.__institutionV11RefinementAction?.(act.dataset.action,act))return;",
  'handleAction(act.dataset.action,act)',
  '},true);',
].join('');

const APPROVED_PRESENTATION_REFINEMENT_STYLE = [
  '<style id="institution-v11-presentation-refinement">',
  ':root{--sidebar:212px}',
  '.sidebar{background:linear-gradient(180deg,#0d2a40 0%,#0a2234 52%,#081c2c 100%);border-right:1px solid rgba(93,160,205,.18);box-shadow:4px 0 18px rgba(11,31,48,.1)}',
  '.sidebar.collapsed{width:68px;flex-basis:68px}',
  '.nav-main:hover{background:rgba(255,255,255,.055)}',
  '.nav-main.active{background:linear-gradient(90deg,rgba(45,136,210,.24),rgba(34,105,164,.12));box-shadow:inset 3px 0 0 #47b4e8}',
  '.nav-child.active{color:#61d1ef;background:rgba(56,155,211,.12)}',
  '.topbar{gap:clamp(7px,.8vw,13px);padding-inline:clamp(10px,1.25vw,20px)}',
  '.top-title,.review-ribbon,.org,.shell-link,.profile-name,.profile-role{white-space:nowrap}',
  '.top-title{flex:0 0 auto;font-size:clamp(14px,1.2vw,16px)}',
  '.review-ribbon,.org,.shell-link,.profile{flex:0 0 auto}',
  '.search-btn{width:auto;max-width:390px;min-width:170px;flex:1 1 390px;overflow:hidden}',
  '.search-btn>span:not(.key){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.profile{min-width:0}',
  '.profile>span:nth-child(2){min-width:0}',
  '.profile-account-action b{color:var(--blue)}',
  '.profile-logout-action b{color:var(--red)}',
  '.account-summary{display:flex;align-items:center;gap:12px;margin-bottom:16px}',
  '.account-summary .avatar{width:48px;height:48px;font-size:15px}',
  '.account-summary-name{font-size:18px;font-weight:850}',
  '.account-summary-role{margin-top:3px;font-size:12px;color:var(--muted)}',
  '.brand{padding:0 14px;gap:0}',
  '.institution-brand-lockup{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}',
  '.institution-brand-logo-wide{display:block;width:auto;height:42px;max-width:100%;object-fit:contain;object-position:center;filter:drop-shadow(0 4px 10px rgba(28,197,216,.14))}',
  '.institution-brand-logo-mark{display:none;width:30px;height:30px;object-fit:contain;border-radius:9px;padding:3px;background:rgba(255,255,255,.96);box-shadow:0 6px 15px rgba(0,17,27,.24),0 0 0 1px rgba(28,197,216,.16)}',
  '.sidebar.collapsed .brand{padding:0 19px}',
  '.sidebar.collapsed .institution-brand-logo-wide{display:none}',
  '.sidebar.collapsed .institution-brand-logo-mark{display:block}',
  '.list-row[data-pending]{min-height:48px}',
  '.list-row[data-pending]>.tag{width:28px;min-width:28px;padding-inline:0;justify-content:center}',
  '.list-row[data-pending]>.muted:last-child{width:44px;flex:0 0 44px;text-align:right;font-variant-numeric:tabular-nums}',
  '.pending-kind{width:52px;min-width:52px;height:28px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:750;letter-spacing:.02em}',
  '.pending-kind-conversation{color:#ef4545;background:#fff0f0}',
  '.pending-kind-appointment{color:#e88213;background:#fff3e7}',
  '.pending-kind-followup{color:#0698a8;background:#e8fbfc}',
  '.list-row[data-pending="followup"]:has(.tag.red)>.pending-kind{color:#ef4545;background:#fff0f0}',
  '.pending-kind-opportunity{color:#15945a;background:#eaf8f0}',
  '.list-row[data-appt]{min-height:48px;gap:10px}',
  '.appointment-status-dot{width:8px;height:8px;border-radius:999px;flex:0 0 8px;background:#8d9bad}',
  '.appointment-status-dot[data-status="已到店"]{background:#20ae68}',
  '.appointment-status-dot[data-status="已确认"]{background:#327df2}',
  '.appointment-status-dot[data-status="待确认"],.appointment-status-dot[data-status="待执行"]{background:#f39a2e}',
  '.appointment-status-dot[data-status="异常"]{background:#f05252}',
  '.list-row[data-appt]>b{width:50px!important;font-size:14px;font-variant-numeric:tabular-nums;letter-spacing:.01em}',
  '.list-row[data-appt]>.avatar{width:34px;height:34px}',
  '.list-row[data-appt] .list-title{font-size:13px;font-weight:750}',
  '@media (max-width:1320px){',
  '.topbar{gap:7px;padding-inline:10px}',
  '.search-btn{min-width:145px}',
  '.profile{gap:4px;padding-inline:2px}',
  '.profile>span:nth-child(2){display:none}',
  '.shell-link{padding-inline:9px}',
  '}',
  '@media (max-width:1050px){',
  '.app{min-width:0;width:100vw;overflow:hidden}',
  '.main{width:0;min-width:0}',
  '.topbar{min-width:0;padding-inline:8px;gap:6px}',
  '.top-title{max-width:120px;overflow:hidden;text-overflow:ellipsis}',
  '.search-btn{min-width:0;max-width:none;flex:1 1 220px}',
  '.workspace{min-width:0;padding-inline:8px}',
  '.tab-scroll{overflow-x:auto;overflow-y:hidden;scrollbar-width:none}',
  '.tab-scroll::-webkit-scrollbar{display:none}',
  '.wtab{min-width:90px}',
  '.page{min-width:0;padding:16px 16px 30px}',
  '.pagehead{flex-wrap:wrap;margin-bottom:14px}',
  '.pagehead .actions{max-width:100%;flex-wrap:wrap}',
  '.kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
  '.kpi{min-width:0;padding:13px}',
  '.grid2{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px}',
  '.grid3{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
  '.grid3>:last-child{grid-column:1/-1}',
  '.card-head{padding-inline:14px}',
  '.card-body{padding:14px}',
  '.summary,.analytics-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
  '.analytics-grid,.strategy-grid,.profile-insight,.calendar-shell{grid-template-columns:1fr}',
  '.table-card{overflow:auto}',
  '.conversation{grid-template-columns:60px 210px minmax(0,1fr);min-height:0;margin:-16px -16px -30px}',
  '.conversation>*{min-width:0}',
  '.conversation .context{display:none}',
  '.designer{grid-template-columns:1fr;min-height:0}',
  '.designer .canvas{min-height:520px}',
  '.drawer{width:min(480px,100vw)}',
  '.drawer.wide{width:min(680px,100vw)}',
  '.palette{width:calc(100vw - 28px)}',
  '.modal.xlarge{width:min(1120px,calc(100vw - 28px))}',
  '}',
  '@media (max-width:760px){',
  '.top-title{display:none}',
  '.page{padding:14px 12px 28px}',
  '.pagehead{display:block}',
  '.pagehead .actions{width:100%;margin:12px 0 0}',
  '.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
  '.grid2,.grid3{grid-template-columns:1fr}',
  '.grid3>:last-child{grid-column:auto}',
  '.segment-grid,.plan-grid,.connector-grid{grid-template-columns:1fr}',
  '.conversation{grid-template-columns:52px 190px minmax(0,1fr)}',
  '.cal-head,.cal-grid{min-width:720px}',
  '}',
  '</style>',
].join('');

const APPROVED_TYPOGRAPHY_REFINEMENT_STYLE = String.raw`<style id="institution-v11-typography-refinement">
body{font-size:14px;line-height:1.45;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
button,input,select,textarea{letter-spacing:0}
.brand-name{font-size:19px;font-weight:800;letter-spacing:.01em}
.brand-sub{font-size:10px;font-weight:500;letter-spacing:.14em}
.nav-label{font-size:15px;font-weight:650;letter-spacing:.01em}
.nav-child{font-size:13px;font-weight:450;line-height:1.45}
.nav-child.active{font-weight:650}
.top-title{font-size:17px;font-weight:750;line-height:1.25}
.org,.shell-link{font-size:13px;font-weight:550}
.review-ribbon{font-size:10px;font-weight:700;letter-spacing:.02em}
.search-btn{font-size:13px;font-weight:400}
.profile-name{font-size:13px;font-weight:700}
.profile-role{font-size:10px;font-weight:450}
.wtab .txt{font-size:13px;font-weight:500}
.wtab.active .txt{font-weight:650}
.pagehead h1{font-size:24px;font-weight:750;line-height:1.25;letter-spacing:-.01em}
.pagehead p{font-size:13px;font-weight:400;line-height:1.6}
.btn{font-size:13px;font-weight:600}
.btn.small{font-size:12px;font-weight:600}
.label{font-size:11px;font-weight:550}
.input,.select,.selectlike{font-size:13px;font-weight:400}
.card-head h2{font-size:16px;font-weight:700;line-height:1.35}
.section-title,.dhead{font-size:13px;font-weight:700}
.sub{font-size:11px;font-weight:400;line-height:1.45}
.klabel{font-size:12px;font-weight:500}
.kvalue{font-size:26px;font-weight:800;line-height:1.05;letter-spacing:-.01em}
.kdelta{font-size:10px;font-weight:450}
.list-title{font-size:13px;font-weight:600;line-height:1.35}
.list-meta{font-size:11px;font-weight:400;line-height:1.4}
.list-row[data-pending] .list-title{font-weight:650}
.list-row[data-appt]>b{font-size:15px!important;font-weight:750}
.list-row[data-appt] .list-title{font-size:13px;font-weight:650}
.pending-kind{font-size:11px;font-weight:650}
.tag{font-size:11px;font-weight:600}
.meta{font-size:11px;font-weight:400;line-height:1.4}
.table{font-size:13px}
.table th{font-size:12px;font-weight:650}
.table td{font-weight:400;line-height:1.45}
.table th:nth-last-child(-n+2),.table td:nth-last-child(-n+2){white-space:nowrap}
.customer-name,.link{font-weight:650}
.table-foot{font-size:12px;font-weight:450}
.ptab,.ctab{font-size:13px;font-weight:500}
.ptab.active,.ctab.active{font-weight:650}
.tab-count{font-size:10px;font-weight:600}
.metric{font-size:12px;font-weight:450}
.metric b{font-size:14px;font-weight:700}
.trend-box .v{font-size:18px;font-weight:750}
.rule,.reference{font-size:11px;font-weight:400;line-height:1.6}
.hero-name{font-size:22px;font-weight:750}
.kv{font-size:12px}.kv span:last-child{font-weight:600}
.account-name{font-size:10px;font-weight:550}
.account-channel{font-size:9px;font-weight:500}
.pill,.context-tab{font-size:11px;font-weight:500}
.pill.active,.context-tab.active{font-weight:650}
.bubble,.ai-suggestion{font-size:12px;font-weight:400}
.sum-value{font-size:21px;font-weight:800}
.segment-card h3,.plan-card h3,.strategy-card h3{font-weight:700}
.segment-card .count{font-weight:800}
.node-time{font-weight:750}.node-name{font-weight:650}
.fact .v,.package-price,.strategy-score,.strategy-index{font-weight:700}
.small-pop .pop-item b,.drawer-title,.modal-title{font-weight:700}
.toast{font-size:12px;font-weight:500}
@media(max-width:1320px){
.top-title{font-size:16px}.org,.shell-link{font-size:12px}.search-btn{font-size:12px}
.pagehead h1{font-size:23px}.kvalue{font-size:25px}
.conversation{grid-template-columns:66px 250px minmax(360px,1fr) 270px}
.chat-head{padding-inline:12px;gap:8px}
.chat-head>div:not(.actions){min-width:0}
.chat-head>div:not(.actions) .meta{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-head .actions{flex:0 0 auto;gap:5px}
.chat-head .actions .btn,.chat-head .actions .select{flex:0 0 auto;min-width:0;padding-inline:8px;font-size:12px;white-space:nowrap}
}
</style>`;

const APPROVED_PRESENTATION_REFINEMENT_SCRIPT = [
  '<script id="institution-v11-presentation-refinement-runtime">',
  '(()=>{',
  `const approvedInstitutionContext=Object.freeze(${APPROVED_RUNTIME_CONTEXT_TOKEN});`,
  "const approvedRoleLabels=Object.freeze({tenant_admin:'机构管理员',tenant_operator:'机构运营员',consultant:'咨询师',customer_service:'客服',security_auditor:'安全审计员'});",
  "let previewAccount=Object.freeze({name:'当前账号',role:'机构成员',institution:approvedInstitutionContext.institutionName});",
  'let logoutBusy=false;',
  "const pendingLabels=Object.freeze({conversation:'会话',appointment:'预约',followup:'随访',opportunity:'机会'});",
  'const personalInfoModal=()=>{closeAll();openModal(\'个人信息\',`<div class="account-summary"><span class="avatar">A</span><div><div class="account-summary-name">${previewAccount.name}</div><div class="account-summary-role">${previewAccount.role}</div></div></div><div class="detail"><div class="drow"><span class="dkey">登录账号</span><span class="dvalue">${previewAccount.name}</span></div><div class="drow"><span class="dkey">当前角色</span><span class="dvalue">${previewAccount.role}</span></div><div class="drow"><span class="dkey">当前机构</span><span class="dvalue">${previewAccount.institution}</span></div><div class="drow"><span class="dkey">账号状态</span><span class="dvalue">已启用</span></div></div><div class="rule">个人资料和角色由机构认证系统统一管理，此处不展示手机号、Cookie、Token 或其他敏感信息。</div>`,`${btn(\'关闭\',{action:\'close-overlays\'})}`)};',
  'const accountSecurityModal=()=>{closeAll();openModal(\'账号安全\',`<div class="detail"><div class="drow"><span class="dkey">登录账号</span><span class="dvalue">${previewAccount.name}</span></div><div class="drow"><span class="dkey">认证状态</span><span class="dvalue">已通过机构端认证</span></div><div class="drow"><span class="dkey">二次验证</span><span class="dvalue">由认证系统管理</span></div></div><div class="rule">当前页面不读取密码、二次验证密钥、Cookie 或 Token；只展示已验证的会话结果。</div>`,`${btn(\'关闭\',{action:\'close-overlays\'})}`)};',
  'const logoutConfirmation=()=>{closeAll();openModal(\'退出登录\',`<p style="margin-top:0;line-height:1.75">确认退出当前 ${previewAccount.name} 账号吗？退出后需要重新登录才能进入机构工作台。</p><div class="rule">退出将清除当前正式会话与本地演示会话 Cookie，不会修改机构业务数据。</div>`,`${btn(\'取消\',{action:\'close-overlays\'})}${btn(\'确认退出\',{cls:\'danger\',action:\'preview-confirm-logout\'})}`)};',
  'const logout=async trigger=>{',
  'if(logoutBusy)return;',
  'logoutBusy=true;',
  'trigger.disabled=true;',
  "trigger.textContent='正在退出…';",
  'try{',
  "const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'}});",
  "if(!response.ok)throw new Error('logout_failed');",
  "if(window.parent!==window)window.parent.postMessage({type:'institution-v11:logout-complete'},window.location.origin);else window.location.assign('/login');",
  '}catch{',
  'logoutBusy=false;',
  'trigger.disabled=false;',
  "trigger.textContent='确认退出';",
  "toast('退出失败，请稍后重试');",
  '}',
  '};',
  'globalThis.__institutionV11RefinementAction=(action,element)=>{',
  "if(action==='preview-personal-info'){personalInfoModal();return true}",
  "if(action==='preview-account-security'){accountSecurityModal();return true}",
  "if(action==='preview-session-logout'){logoutConfirmation();return true}",
  "if(action==='preview-confirm-logout'){void logout(element);return true}",
  'return false;',
  '};',
  'const refine=()=>{',
  "document.querySelector('.review-ribbon')?.remove();",
  "document.querySelector('.topbar .org')?.remove();",
  "document.querySelector('.topbar .shell-link')?.remove();",
  "const brand=document.querySelector('.brand');",
  "if(brand&&!brand.querySelector('.institution-brand-lockup')){",
  "const lockup=document.createElement('span');",
  "lockup.className='institution-brand-lockup';",
  "lockup.setAttribute('role','img');",
  "lockup.setAttribute('aria-label','智美天工 ZHIMEI TIANGONG');",
  "const wideLogo=document.createElement('img');",
  "wideLogo.className='institution-brand-logo-wide';",
  "wideLogo.src='/brand/zmtg-logo-horizontal-night-clean.png';",
  "wideLogo.alt='';",
  "const markLogo=document.createElement('img');",
  "markLogo.className='institution-brand-logo-mark';",
  "markLogo.src='/brand/logo-mark.png';",
  "markLogo.alt='';",
  'lockup.append(wideLogo,markLogo);',
  'brand.replaceChildren(lockup);',
  '}',
  "const profile=document.querySelector('.profile');",
  "const avatar=profile?.querySelector(':scope > .avatar');",
  "const name=profile?.querySelector('.profile-name');",
  "const role=profile?.querySelector('.profile-role');",
  "const avatarText=(previewAccount.name.trim().slice(0,1)||'机').toUpperCase();",
  'if(avatar&&avatar.textContent!==avatarText)avatar.textContent=avatarText;',
  'if(name&&name.textContent!==previewAccount.name)name.textContent=previewAccount.name;',
  'if(role&&role.textContent!==previewAccount.role)role.textContent=previewAccount.role;',
  "document.querySelectorAll('.pagehead h1').forEach(heading=>{",
  "const current=heading.textContent?.trim()||'';",
  "if(!/^(上午好|下午好|晚上好)，/.test(current))return;",
  "const updated=current.replace(/^(上午好|下午好|晚上好)，.+$/,'$1，'+previewAccount.name);",
  'if(updated!==current)heading.textContent=updated;',
  '});',
  "document.querySelectorAll('#popover .pop-item').forEach(item=>{",
  "const label=item.querySelector('b')?.textContent?.trim();",
  "const meta=item.querySelector('.meta');",
  "if(label==='个人信息'){item.dataset.action='preview-personal-info';item.classList.add('profile-account-action');if(meta&&meta.textContent!==previewAccount.name)meta.textContent=previewAccount.name}",
  "if(label==='账号安全'){item.dataset.action='preview-account-security';item.classList.add('profile-account-action')}",
  "if(label==='退出登录'){item.dataset.action='preview-session-logout';item.classList.add('profile-logout-action')}",
  '});',
  "document.querySelectorAll('[data-pending]').forEach(row=>{",
  'const type=row.dataset.pending;',
  'const label=pendingLabels[type];',
  'if(!label)return;',
  'const current=row.firstElementChild;',
  "if(current?.classList.contains('pending-kind'))return;",
  "const badge=document.createElement('span');",
  "badge.className=`pending-kind pending-kind-${type}`;",
  'badge.textContent=label;',
  'current?.replaceWith(badge);',
  '});',
  "document.querySelectorAll('[data-appt]').forEach(row=>{",
  "if(row.querySelector(':scope > .appointment-status-dot'))return;",
  "const dot=document.createElement('span');",
  "dot.className='appointment-status-dot';",
  "dot.setAttribute('aria-hidden','true');",
  "dot.dataset.status=row.querySelector(':scope > .tag')?.textContent?.trim()||'';",
  'row.prepend(dot);',
  '});',
  '};',
  'let responsiveSidebarNarrow=false;',
  'const syncResponsiveSidebar=()=>{',
  'const narrow=window.innerWidth<=1050;',
  'if(narrow&&!responsiveSidebarNarrow&&!state.collapsed){responsiveSidebarNarrow=true;state.collapsed=true;render();return}',
  'if(!narrow)responsiveSidebarNarrow=false;',
  '};',
  "window.addEventListener('resize',syncResponsiveSidebar,{passive:true});",
  'syncResponsiveSidebar();',
  'const hydratePreviewAccount=async()=>{',
  'try{',
  "const response=await fetch('/api/auth/session',{credentials:'same-origin',headers:{Accept:'application/json'}});",
  'if(!response.ok)return;',
  'const result=await response.json();',
  'const user=result?.authenticated===true?result.user:null;',
  "if(!user||typeof user.username!=='string'||typeof user.role!=='string'||user.tenantId!==approvedInstitutionContext.tenantId||user.institutionId!==approvedInstitutionContext.institutionId)return;",
  "previewAccount=Object.freeze({name:user.username,role:approvedRoleLabels[user.role]||'机构成员',institution:approvedInstitutionContext.institutionName});",
  'refine();',
  '}catch{}',
  '};',
  "new MutationObserver(refine).observe(document.body,{childList:true,subtree:true});",
  'refine();',
  'void hydratePreviewAccount();',
  '})();',
  '</script>',
].join('');

const APPROVED_INTERACTION_COMPLETION_STYLE = String.raw`<style id="institution-v11-interaction-completion">
.preview-form{display:grid;gap:12px}.preview-form.two-columns{grid-template-columns:repeat(2,minmax(0,1fr))}
.preview-action-note{margin-top:10px;padding:10px 12px;border:1px solid #d8e6fb;border-radius:9px;background:#f5f9ff;color:#496079;font-size:12px;line-height:1.65}
.preview-choice-list{display:grid;gap:8px}.preview-choice{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid var(--line);border-radius:10px;background:#fff}
.preview-choice input{margin-top:2px}.preview-choice b{display:block;margin-bottom:3px}.preview-choice span{color:var(--muted);font-size:11px}
.preview-filter-state{display:flex;align-items:center;gap:8px;margin:-5px 0 14px;padding:9px 12px;border:1px solid #cfe1fb;border-radius:9px;background:#f4f8ff;color:#395978;font-size:12px}
.preview-filter-state b{color:var(--blue)}.preview-pagination-state{margin-right:10px;color:var(--blue);font-weight:700}
.preview-attachment-name{margin-top:10px;padding:10px 12px;border-radius:8px;background:#f4f7fb;color:#53647a;font-size:12px}
.preview-import-file-input{position:fixed;inset:auto auto 0 0;width:1px;height:1px;opacity:0;pointer-events:none}
.dropzone.preview-import-dropzone{cursor:pointer;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}
.dropzone.preview-import-dropzone:hover,.dropzone.preview-import-dropzone:focus-visible,.dropzone.preview-import-dropzone.is-dragging{border-color:#2f7cf6;background:#f4f8ff;box-shadow:0 0 0 3px rgba(47,124,246,.1);outline:0}
.preview-import-boundary{display:grid;gap:13px;padding:6px 2px 2px}.preview-import-boundary h2{margin:0;font-size:20px}.preview-import-boundary-list{display:grid;gap:8px}
.preview-import-boundary-item{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid #e0e7f0;border-radius:10px;background:#f8fafc;color:#52657b;font-size:12px;line-height:1.65}.preview-import-boundary-item b{display:block;color:#24364c;font-size:13px}
.preview-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.small-pop:has(.preview-date-range-picker){width:min(840px,calc(100vw - 32px));max-width:none;padding:0;border-radius:12px;overflow:hidden;box-shadow:0 22px 58px rgba(20,43,72,.2)}
.preview-date-range-picker{background:#fff;color:#1c2a3d}
.preview-date-entry{display:flex;align-items:center;gap:16px;padding:14px 18px;border-bottom:1px solid #e3e9f1;background:#fbfcfe}
.preview-date-entry svg{width:20px;height:20px;color:#7d8fa8}.preview-date-entry-value{min-width:116px;color:#7f91aa;font-size:14px;font-weight:500}
.preview-date-entry-value.has-value{color:#26384f}.preview-date-entry-separator{color:#2d3d53;font-size:14px;font-weight:700}
.preview-date-entry .preview-date-quick{margin-left:auto;display:flex;gap:7px}
.preview-date-quick button{height:32px;padding:0 11px;border:1px solid #dce5f0;border-radius:8px;background:#fff;color:#52647a;font-size:12px;font-weight:600;cursor:pointer}
.preview-date-quick button:hover,.preview-date-quick button:focus-visible{border-color:#2f7cf6;color:#2478f2;background:#f3f7ff;outline:0}
.preview-calendar-panes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.preview-month-panel{padding:16px 18px 12px}.preview-month-panel+.preview-month-panel{border-left:1px solid #e3e9f1}
.preview-month-head{display:grid;grid-template-columns:76px 1fr 76px;align-items:center;min-height:36px;margin-bottom:7px}
.preview-month-title{text-align:center;color:#33445b;font-size:17px;font-weight:700;letter-spacing:.02em}
.preview-month-nav{display:flex;align-items:center}.preview-month-nav.end{justify-content:flex-end}
.preview-date-nav{width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:#43566e;display:grid;place-items:center;cursor:pointer}
.preview-date-nav:hover,.preview-date-nav:focus-visible{background:#f0f5fc;color:#2478f2;outline:0}.preview-date-nav svg{width:17px;height:17px}
.preview-date-nav.double{display:flex;justify-content:center;gap:0}.preview-date-nav.double svg+svg{margin-left:-9px}
.preview-weekdays,.preview-date-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.preview-weekdays{border-bottom:1px solid #e8edf4}.preview-weekdays span{height:36px;display:grid;place-items:center;color:#516279;font-size:12px;font-weight:600}
.preview-date-grid{padding-top:6px;row-gap:2px}.preview-date-day{position:relative;height:38px;border:0;background:transparent;color:#33445a;font-size:13px;cursor:pointer;display:grid;place-items:center;z-index:0}
.preview-date-day::before{content:"";position:absolute;inset:3px 0;background:transparent;z-index:-1}.preview-date-day.outside{color:#9aa9bc}
.preview-date-day:hover::before,.preview-date-day:focus-visible::before{inset:3px;border-radius:7px;background:#edf4ff}.preview-date-day:focus-visible{outline:0}
.preview-date-day.in-range::before{background:#eaf2ff}.preview-date-day.is-start::before{inset:3px 0 3px 3px;border-radius:7px 0 0 7px;background:#2f7cf6}.preview-date-day.is-end::before{inset:3px 3px 3px 0;border-radius:0 7px 7px 0;background:#2f7cf6}
.preview-date-day.is-start.is-end::before{inset:3px;border-radius:7px}.preview-date-day.is-start,.preview-date-day.is-end{color:#fff;font-weight:750}
.preview-date-day.today:not(.is-start):not(.is-end){color:#2478f2;font-weight:750}.preview-date-day.today:not(.is-start):not(.is-end)::after{content:"";position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:#2f7cf6}
.preview-date-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid #e3e9f1;background:#fbfcfe}.preview-date-status{flex:1;color:#71839a;font-size:12px}.preview-date-status b{color:#2d4058}
.preview-date-foot .btn{min-width:72px}.preview-date-trigger-label{white-space:nowrap}
#popover .layer{z-index:130}
.preview-customer-filter-bar{display:grid!important;grid-template-columns:minmax(260px,1fr) auto auto;align-items:end;gap:12px}
.preview-customer-filter-bar .filter{min-width:0}.preview-customer-filter-bar .input{width:100%}
.preview-customer-quick{align-items:center;flex-wrap:wrap}.preview-customer-quick .view-chip[disabled]{opacity:.54;cursor:not-allowed}
.preview-customer-filter-chips:empty{display:none}.preview-customer-filter-note{margin:8px 0 0;color:#6c7e94;font-size:11px}
.preview-customer-choice{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.preview-customer-choice button{height:34px;padding:0 14px;border:1px solid #d8e1ec;border-radius:9px;background:#fff;color:#455870;font:inherit;cursor:pointer}
.preview-customer-choice button.active{border-color:#2f7cf6;background:#edf4ff;color:#1768d9;font-weight:700;box-shadow:0 0 0 1px rgba(47,124,246,.08)}
.preview-customer-choice button.link{height:auto;padding:0;border:0;background:transparent;color:#2478f2}
.preview-customer-advanced .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-customer-advanced .filter-group{margin-bottom:14px}
.preview-customer-advanced .select,.preview-customer-advanced .selectlike{width:100%}
.preview-customer-unavailable{display:grid;gap:6px;margin-top:10px;padding:11px 12px;border:1px solid #e1e7ef;border-radius:9px;background:#f7f9fc;color:#6d7f95;font-size:11px;line-height:1.55}
.preview-customer-runtime-card{overflow:hidden!important}
.preview-customer-table-scroll{max-height:min(54vh,560px);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.preview-customer-table-scroll.is-expanded{max-height:min(74vh,760px)}
.preview-customer-table-scroll .table{min-width:1020px}
.preview-customer-table-scroll .table thead{position:sticky;top:0;z-index:3}
.preview-customer-table-scroll .table th{background:#f7f9fc;box-shadow:inset 0 -1px #dfe6ef}
.preview-customer-runtime-card button.link{border:0;background:transparent;padding:0;font:inherit;cursor:pointer}
.preview-customer-runtime-card .table-foot{gap:12px;flex-wrap:wrap}
.preview-customer-page-status{min-width:230px;flex:1;color:#6c7e94}
.preview-customer-page-tools{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}
.preview-customer-page-size{display:inline-flex;align-items:center;gap:7px;color:#63758b;white-space:nowrap}
.preview-customer-page-size select{height:32px;padding:0 28px 0 10px;border:1px solid #d8e1ec;border-radius:8px;background:#fff;color:#304258;font:inherit;cursor:pointer}
.preview-customer-pagebtn[disabled]{opacity:.42;cursor:not-allowed}
.preview-customer-table-state{min-height:270px;display:grid;place-items:center;padding:28px;text-align:center;color:#71839a}
.preview-customer-table-state b{display:block;margin-bottom:6px;color:#2a3c52;font-size:15px}
.preview-customer-table-state .btn{margin-top:12px}
.preview-real-segment-source{display:flex;align-items:flex-start;gap:9px;margin:0 0 14px;padding:11px 13px;border:1px solid #cfe1fb;border-radius:10px;background:#f4f8ff;color:#496079;font-size:12px;line-height:1.65}
.preview-real-segment-source svg{width:17px;height:17px;flex:0 0 auto;margin-top:1px;color:#2478f2}.preview-real-segment-source b{color:#255a99}
.preview-real-segment-card .count{font-variant-numeric:tabular-nums}.preview-real-segment-card .rule{min-height:42px}
.preview-real-segment-card .preview-real-segment-link{border:0;background:transparent;padding:0;color:var(--blue);font:inherit;font-weight:700;cursor:pointer}
.preview-real-segment-card .preview-real-segment-link:hover,.preview-real-segment-card .preview-real-segment-link:focus-visible{text-decoration:underline;outline:0}
.preview-real-segment-state{grid-column:1/-1;min-height:280px;display:grid;place-items:center;padding:32px;text-align:center}
.preview-real-segment-state b{display:block;margin-bottom:6px;color:#2a3c52;font-size:16px}.preview-real-segment-state span{color:#71839a}
.preview-opportunity-runtime-card{overflow:hidden!important}.preview-opportunity-runtime-card .table-foot{gap:12px;flex-wrap:wrap}
.preview-opportunity-runtime-card .preview-customer-table-scroll .table{min-width:930px}.preview-opportunity-runtime-card button.link{border:0;background:transparent;padding:0;font:inherit;cursor:pointer}
.preview-opportunity-pagebtn[disabled]{opacity:.42;cursor:not-allowed}.preview-opportunity-filter-note{margin:-2px 0 14px;color:#65788f;font-size:11px}
.preview-appointment-runtime-card{overflow:hidden!important}.preview-appointment-runtime-card .table-foot{gap:12px;flex-wrap:wrap}
.preview-appointment-runtime-card .preview-customer-table-scroll .table{min-width:860px}.preview-appointment-runtime-card button.link{border:0;background:transparent;padding:0;font:inherit;cursor:pointer}
.preview-appointment-pagebtn[disabled]{opacity:.42;cursor:not-allowed}.preview-appointment-filter-note{margin:-2px 0 14px;color:#65788f;font-size:11px}
.preview-appointment-status-tabs{padding:0 14px;margin-bottom:14px}.preview-appointment-status-tabs .ctab{border:0;background:transparent;cursor:pointer}
.preview-appointment-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
.preview-appointment-summary-card{min-width:0;min-height:96px;padding:15px;display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:12px}
.preview-appointment-summary-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#eaf3ff;color:#2478f2}.preview-appointment-summary-icon.orange{background:#fff1e2;color:#ef8c21}.preview-appointment-summary-icon.green{background:#e5f7ed;color:#19a462}.preview-appointment-summary-icon.purple{background:#efe9ff;color:#7c59e8}
.preview-appointment-summary-copy{min-width:0}.preview-appointment-summary-copy>span,.preview-appointment-summary-copy>small{display:block;color:#7d8ea4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-appointment-summary-copy>span{font-size:11px}.preview-appointment-summary-copy>strong{display:block;margin:2px 0;font-size:24px;line-height:1.1;color:#17263b;font-variant-numeric:tabular-nums}.preview-appointment-summary-copy>small{font-size:10px}
.preview-appointment-filters{display:grid!important;grid-template-columns:minmax(130px,.72fr) minmax(250px,1.15fr) minmax(260px,1.35fr) auto;align-items:end;gap:12px}.preview-appointment-filters .filter{min-width:0}.preview-appointment-filters .input,.preview-appointment-filters .selectlike{width:100%}.preview-appointment-filter-action{height:36px;min-width:72px}
.preview-appointment-customer{display:flex;align-items:center;gap:9px;min-width:150px}.preview-appointment-customer .avatar{flex:0 0 auto}.preview-appointment-customer-main{min-width:0}.preview-appointment-customer-main .link{max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--blue);font-weight:700}.preview-appointment-project{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:650}.preview-appointment-code{font-variant-numeric:tabular-nums;letter-spacing:.04em}
.preview-workbench-runtime .kpi{min-width:0;min-height:104px;padding:15px;background:#fff;border:1px solid #dfe6ef;border-radius:12px;box-shadow:0 5px 16px rgba(33,65,104,.05)}.preview-workbench-runtime .kvalue{font-variant-numeric:tabular-nums}.preview-workbench-runtime button.link{border:0;background:transparent;padding:0;color:var(--blue);font:inherit;font-weight:700;cursor:pointer}.preview-workbench-source{margin-bottom:14px}.preview-workbench-list .list-row{min-height:52px}.preview-workbench-unavailable{min-height:176px;display:grid;place-items:center;padding:24px;text-align:center;color:#71839a}.preview-workbench-unavailable b{display:block;margin-bottom:5px;color:#2a3c52;font-size:14px}
.preview-followup-runtime-card{overflow:hidden!important}.preview-followup-runtime-card .preview-customer-table-scroll .table{min-width:970px}.preview-followup-runtime-card button.link{border:0;background:transparent;padding:0;font:inherit;cursor:pointer}.preview-followup-status-tabs{padding:0 14px;margin-bottom:14px}.preview-followup-status-tabs .ctab{border:0;background:transparent;cursor:pointer}.preview-followup-filters{display:grid!important;grid-template-columns:minmax(260px,1fr) auto;align-items:end;gap:12px}.preview-followup-filters .filter{min-width:0}.preview-followup-filters .input{width:100%}.preview-followup-pagebtn[disabled]{opacity:.42;cursor:not-allowed}.preview-followup-customer{display:flex;align-items:center;gap:9px;min-width:160px}.preview-followup-customer .avatar{flex:0 0 auto}.preview-followup-customer-main{min-width:0}.preview-followup-customer-main .link{max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--blue);font-weight:700}.preview-followup-read-limit{margin:-2px 0 14px;color:#65788f;font-size:11px}
.preview-date-day.future,.preview-date-day:disabled{color:#c4ceda!important;cursor:not-allowed;opacity:.62}
.preview-date-day.future::before,.preview-date-day:disabled::before{inset:3px;border-radius:7px;background:repeating-linear-gradient(135deg,#f5f7fa 0,#f5f7fa 4px,#edf1f5 4px,#edf1f5 8px)!important}
.preview-date-day.future:hover::before,.preview-date-day.future:focus-visible::before,.preview-date-day:disabled:hover::before{background:repeating-linear-gradient(135deg,#f5f7fa 0,#f5f7fa 4px,#edf1f5 4px,#edf1f5 8px)!important}
#modal .day.future,#modal .day:disabled{color:#c4ceda!important;background:#f5f7fa!important;cursor:not-allowed;opacity:.62}
.preview-knowledge-file-input{position:fixed;left:-9999px;width:1px;height:1px;opacity:0}.preview-knowledge-dropzone{min-height:210px;display:grid;place-items:center;padding:28px;border:1.5px dashed #8ebbf5;border-radius:12px;background:#f7fbff;text-align:center}.preview-knowledge-dropzone h3{margin:10px 0 5px}.preview-knowledge-dropzone .sub{max-width:560px;margin:0 auto 16px}.preview-knowledge-progress{min-height:210px;display:grid;place-items:center;text-align:center}.preview-knowledge-progress b{display:block;margin-bottom:7px;font-size:16px}.preview-knowledge-preview{display:grid;gap:14px}.preview-knowledge-file-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #dce6f2;border-radius:10px;background:#f8fbff}.preview-knowledge-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview-knowledge-sections{max-height:280px;overflow:auto;border:1px solid #dfe7f1;border-radius:10px}.preview-knowledge-section{padding:11px 13px;border-bottom:1px solid #edf1f6;line-height:1.65}.preview-knowledge-section:last-child{border-bottom:0}.preview-knowledge-section b{display:block;margin-bottom:3px;color:#30445c}.preview-knowledge-published{padding:22px;border:1px solid #bfe8d0;border-radius:12px;background:#f1fbf5;text-align:center}.preview-knowledge-published b{display:block;margin-bottom:6px;color:#148951;font-size:17px}.preview-knowledge-table-state{min-height:220px;display:grid;place-items:center;padding:28px;text-align:center;color:#71839a}.preview-knowledge-table-state b{display:block;margin-bottom:6px;color:#2a3c52;font-size:15px}
@media(max-width:1100px){.preview-appointment-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-appointment-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-appointment-filter-action{justify-self:start}}
@media(max-width:900px){.preview-form.two-columns,.preview-check-grid,.preview-knowledge-form{grid-template-columns:1fr}.preview-appointment-summary{grid-template-columns:1fr}.preview-appointment-filters,.preview-followup-filters{grid-template-columns:1fr}.small-pop:has(.preview-date-range-picker){left:12px!important;right:12px!important;width:auto!important;max-height:calc(100vh - 24px);overflow:auto}.preview-date-entry{flex-wrap:wrap;gap:9px 12px}.preview-date-entry .preview-date-quick{width:100%;margin-left:0;overflow:auto}.preview-calendar-panes{grid-template-columns:1fr}.preview-month-panel+.preview-month-panel{border-left:0;border-top:1px solid #e3e9f1}}
@media(max-width:900px){.preview-customer-filter-bar,.preview-customer-advanced .form-grid{grid-template-columns:1fr}.preview-customer-filter-bar .btn{justify-self:start}}
</style>`;

const APPROVED_INTERACTION_COMPLETION_SCRIPT = String.raw`<script id="institution-v11-interaction-completion-runtime">
(()=>{
const previousAction=globalThis.__institutionV11RefinementAction;
let pendingAttachment='';
let customerImportFile=null;
let customerImportPreview=null;
let customerImportCompleted=null;
let customerImportBusy=false;
let customerListRuntime={page:1,pageSize:20,records:[],pageInfo:null,loading:false,error:'',requestKey:'',requestToken:0,expanded:false,lifecycle:null,priority:null,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:''};
let customerSegmentRuntime={items:[],loading:false,error:'',requestKey:'',requestToken:0};
let customerOpportunityRuntime={page:1,pageSize:20,records:[],pageInfo:null,loading:false,error:'',requestKey:'',requestToken:0,expanded:false,type:'all',priority:null};
let appointmentListRuntime={page:1,pageSize:20,records:[],pageInfo:null,summary:null,loading:false,error:'',requestKey:'',requestToken:0,expanded:false,status:null,keyword:'',startDate:'',endDate:''};
let followUpListRuntime={page:1,pageSize:20,records:[],hasMore:false,loading:false,error:'',requestKey:'',requestToken:0,expanded:false,state:null,keyword:''};
let workbenchRuntime={customers:[],customerInfo:null,appointments:[],appointmentSummary:null,followUps:[],followUpHasMore:false,highPriorityTotal:0,loading:false,error:'',requestKey:'',requestToken:0};
let knowledgeUploadRuntime={busy:false,upload:null,error:''};
let knowledgeDocumentRuntime={loading:false,loaded:false,error:'',records:[]};
let calendarCursor={year:2026,month:7};
let datePickerDraft={target:'generic',start:'',end:'',phase:'start',year:2026,month:7};
const CUSTOMER_IMPORT_MAX_BYTES=10*1024*1024;
const CUSTOMER_LIST_PAGE_SIZES=[10,20,50,100];
const APPOINTMENT_LIST_PAGE_SIZE=20;
const APPOINTMENT_LIST_PAGE_SIZES=[10,20,50,100];
const APPOINTMENT_LIST_MAX_PAGE=100;
const FOLLOW_UP_LIST_PAGE_SIZES=[10,20,50,100];
const FOLLOW_UP_STATE_LABELS=Object.freeze({pending:'待执行',in_progress:'进行中',waiting_customer:'等待客户',escalated:'风险升级',completed:'已完成',cancelled:'已取消'});
const CUSTOMER_LIFECYCLE_LABELS=Object.freeze({consulting:'咨询中',scheduled:'已预约',post_care:'术后关怀',repurchase_window:'复购窗口',silent_reactivation:'沉默唤醒'});
const CUSTOMER_PRIORITY_LABELS=Object.freeze({high:'高优先级',medium:'中优先级',observe:'持续观察'});
const CUSTOMER_GENDER_LABELS=Object.freeze({female:'女',male:'男'});
const CUSTOMER_AGE_BAND_LABELS=Object.freeze({under_20:'20岁以下','20_29':'20–29岁','30_39':'30–39岁','40_49':'40–49岁','50_59':'50–59岁','60_plus':'60岁以上'});
const CUSTOMER_QUICK_FILTERS=Object.freeze([
{key:'all',label:'全部客户',lifecycle:null,priority:null},
{key:'consulting',label:'咨询中',lifecycle:'consulting',priority:null},
{key:'scheduled',label:'已预约',lifecycle:'scheduled',priority:null},
{key:'post_care',label:'术后关怀',lifecycle:'post_care',priority:null},
{key:'repurchase_window',label:'复购窗口',lifecycle:'repurchase_window',priority:null},
{key:'silent_reactivation',label:'沉默唤醒',lifecycle:'silent_reactivation',priority:null},
{key:'high',label:'高优先级',lifecycle:null,priority:'high'},
]);
const CUSTOMER_SEGMENT_DEFINITIONS=Object.freeze([
{key:'lifecycle-consulting',label:'咨询中客户',lifecycle:'consulting',priority:null,rule:'客户主档生命周期 = 咨询中',tone:'blue',icon:'users'},
{key:'lifecycle-scheduled',label:'已预约客户',lifecycle:'scheduled',priority:null,rule:'客户主档生命周期 = 已预约',tone:'green',icon:'calendar'},
{key:'lifecycle-post-care',label:'术后关怀客户',lifecycle:'post_care',priority:null,rule:'客户主档生命周期 = 术后关怀',tone:'purple',icon:'heart'},
{key:'lifecycle-repurchase',label:'复购窗口客户',lifecycle:'repurchase_window',priority:null,rule:'客户主档生命周期 = 复购窗口',tone:'orange',icon:'spark'},
{key:'lifecycle-silent',label:'沉默唤醒客户',lifecycle:'silent_reactivation',priority:null,rule:'客户主档生命周期 = 沉默唤醒',tone:'red',icon:'warning'},
{key:'priority-high',label:'高优先级客户',lifecycle:null,priority:'high',rule:'客户主档优先级 = 高优先级',tone:'red',icon:'users'},
]);
const CUSTOMER_OPPORTUNITY_DEFINITIONS=Object.freeze([
{key:'revisit',label:'复诊机会',lifecycle:'post_care',basis:'客户主档生命周期 = 术后关怀'},
{key:'repurchase',label:'复购机会',lifecycle:'repurchase_window',basis:'客户主档生命周期 = 复购窗口'},
{key:'reactivation',label:'沉默唤醒',lifecycle:'silent_reactivation',basis:'客户主档生命周期 = 沉默唤醒'},
]);
const APPOINTMENT_STATUS_LABELS=Object.freeze({pending_confirmation:'待确认',confirmed:'已确认',arrived:'已到店',completed:'已完成',reschedule_requested:'申请改期',cancelled:'已取消'});
const localOnly='<div class="preview-action-note">当前为 Approved 交互预览：只更新本地页面状态，不写入数据库，不连接真实 HIS、微信或其他外部系统。</div>';
const textOf=element=>(element?.textContent||'').replace(/\s+/g,'').trim();
const setAction=(element,action)=>{if(element&&!element.dataset.action)element.dataset.action=action;return element};
const setTextIfChanged=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value};
const closeAndToast=message=>{closeAll();toast(message)};
const formatFileSize=bytes=>bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(1)+' MB';
const ensureCustomerImportInput=()=>{let input=document.querySelector('#institution-customer-import-file');if(input)return input;input=document.createElement('input');input.id='institution-customer-import-file';input.className='preview-import-file-input';input.type='file';input.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';input.setAttribute('aria-label','选择客户数据 Excel 文件');input.addEventListener('change',()=>{const file=input.files?.[0];if(file)void acceptCustomerImportFile(file)});document.body.appendChild(input);return input};
const validateCustomerImportFile=async file=>{if(!(file instanceof File))return'未读取到文件';if(!/\.xlsx$/i.test(file.name))return'仅支持 .xlsx 文件';if(file.size===0)return'文件为空';if(file.size>CUSTOMER_IMPORT_MAX_BYTES)return'文件超过 10 MB 上限';const signature=new Uint8Array(await file.slice(0,4).arrayBuffer());if(signature.length<4||signature[0]!==0x50||signature[1]!==0x4b||signature[2]!==0x03||signature[3]!==0x04)return'文件不是有效的 Excel 工作簿';return''};
const acceptCustomerImportFile=async file=>{const failure=await validateCustomerImportFile(file).catch(()=>'文件读取失败');if(failure){customerImportFile=null;state.importSelected=false;toast(failure);return}customerImportFile=file;state.importSelected=true;importWizard();requestAnimationFrame(decorate)};
const openCustomerImportFilePicker=()=>{const input=ensureCustomerImportInput();input.value='';input.click()};
const knowledgeUploadError=(payload,fallback)=>payload&&typeof payload==='object'&&(typeof payload.message==='string'||typeof payload.code==='string')?(payload.message||payload.code):fallback;
const knowledgeUploadSections=upload=>{const sections=Array.isArray(upload?.sections)?upload.sections:[];if(!sections.length)return'<div class="preview-knowledge-section"><span class="muted">未返回可预览章节，不能继续发布。</span></div>';return sections.map(section=>'<div class="preview-knowledge-section"><b>章节 '+(Number(section.index)+1)+'</b><span>'+esc(String(section.preview||''))+'</span></div>').join('')};
const knowledgeUploadBody=()=>{const upload=knowledgeUploadRuntime.upload;if(knowledgeUploadRuntime.busy)return'<div class="preview-knowledge-progress"><div><b>正在上传并解析文件</b><span class="muted">正在写入当前机构文件存储并提取可预览章节，请勿关闭窗口。</span></div></div>';if(knowledgeUploadRuntime.error&&!upload)return'<div class="preview-knowledge-progress"><div><b>文件处理失败</b><span class="muted">'+esc(knowledgeUploadRuntime.error)+'</span><br><br><button class="btn primary" data-action="preview-knowledge-reselect">重新选择文件</button></div></div>';if(!upload)return'<div class="preview-knowledge-dropzone" data-action="preview-knowledge-choose-file" role="button" tabindex="0" aria-label="选择知识库上传文件"><div><div style="font-size:38px">'+ico('upload')+'</div><h3>上传 PDF / Word / Excel / Markdown</h3><p class="sub">文件会写入当前机构存储并由服务端解析；解析结果需人工确认后才能发布。支持可复制文本 PDF、DOCX、XLSX、MD、TXT、CSV，最大 2 MB。</p><button class="btn primary" data-action="preview-knowledge-choose-file">选择文件</button><input id="institution-knowledge-upload-file" class="preview-knowledge-file-input" type="file" accept=".pdf,.docx,.xlsx,.md,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/markdown,text/plain,text/csv" aria-label="选择知识库上传文件"></div></div>';if(upload.state==='published')return'<div class="preview-knowledge-published"><b>知识已正式发布</b><span>《'+esc(upload.title)+'》已生成不可变版本 V'+esc(String(upload.publishedVersion||1))+'，并进入当前机构正式知识库。</span></div>';return'<div class="preview-knowledge-preview">'+(knowledgeUploadRuntime.error?'<div class="rule">'+esc(knowledgeUploadRuntime.error)+'</div>':'')+'<div class="preview-knowledge-file-summary"><span><b>'+esc(upload.fileName)+'</b><div class="meta">'+formatFileSize(Number(upload.fileSize)||0)+' · '+esc(String(upload.parserType||'parser'))+' · '+Number(upload.sectionCount||0)+' 个章节</div></span>'+tag(upload.state==='confirmed'?'已确认':'待确认',upload.state==='confirmed'?'green':'orange')+'</div><div class="preview-knowledge-form"><label class="filter"><span class="label">知识标题</span><input id="preview-knowledge-title" class="input" maxlength="200" value="'+esc(upload.title)+'" '+(upload.state==='confirmed'?'disabled':'')+'></label><label class="filter"><span class="label">知识分类</span><input id="preview-knowledge-category" class="input" maxlength="160" value="'+esc(upload.category)+'" '+(upload.state==='confirmed'?'disabled':'')+'></label></div><div><div class="section-title">章节预览 <span class="muted">仅显示前 20 个，共 '+Number(upload.sectionCount||0)+' 个</span></div><div class="preview-knowledge-sections">'+knowledgeUploadSections(upload)+'</div></div><div class="rule">发布后将生成不可变正式版本；未确认草稿不会进入 AI 可读取的正式知识清单。</div></div>'};
const knowledgeUploadFooter=()=>{const upload=knowledgeUploadRuntime.upload;if(knowledgeUploadRuntime.busy)return btn('关闭',{action:'close-overlays'});if(!upload)return btn('取消',{action:'close-overlays'});if(upload.state==='published')return btn('完成',{cls:'primary',action:'preview-knowledge-finish'});if(upload.state==='confirmed')return btn('取消',{action:'close-overlays'})+btn('发布知识',{cls:'primary',action:'preview-knowledge-publish'});return btn('取消',{action:'close-overlays'})+btn('确认解析内容',{cls:'primary',action:'preview-knowledge-confirm'})};
const bindKnowledgeUploadInput=()=>{const input=document.querySelector('#institution-knowledge-upload-file');if(!input||input.dataset.previewBound)return;input.dataset.previewBound='true';input.addEventListener('change',()=>{const file=input.files?.[0];if(file)void uploadKnowledgeFile(file)});const dropzone=document.querySelector('.preview-knowledge-dropzone');if(dropzone&&!dropzone.dataset.previewDropBound){dropzone.dataset.previewDropBound='true';dropzone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click()}});dropzone.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('is-dragging')});dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragging'));dropzone.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('is-dragging');const file=event.dataTransfer?.files?.[0];if(file)void uploadKnowledgeFile(file)})}};
const renderKnowledgeUploadModal=()=>{openModal('上传知识文件',knowledgeUploadBody(),knowledgeUploadFooter(),'large');requestAnimationFrame(bindKnowledgeUploadInput)};
const openKnowledgeUpload=()=>{knowledgeUploadRuntime={busy:false,upload:null,error:''};renderKnowledgeUploadModal()};
const chooseKnowledgeUploadFile=()=>{let input=document.querySelector('#institution-knowledge-upload-file');if(!input){renderKnowledgeUploadModal();input=document.querySelector('#institution-knowledge-upload-file')}if(input){input.value='';input.click()}};
const uploadKnowledgeFile=async file=>{if(!(file instanceof File)||file.size<=0||file.size>2*1024*1024||!/[.](pdf|docx|xlsx|md|txt|csv)$/i.test(file.name)){knowledgeUploadRuntime={busy:false,upload:null,error:'请选择 2 MB 以内的支持文件'};renderKnowledgeUploadModal();return}knowledgeUploadRuntime={busy:true,upload:null,error:''};renderKnowledgeUploadModal();try{const form=new FormData();form.set('file',file);const response=await fetch('/api/institution/knowledge-management/upload',{method:'POST',credentials:'same-origin',body:form});const payload=await response.json().catch(()=>null);if(!response.ok||payload?.kind!=='ready'||!payload.upload)throw new Error(knowledgeUploadError(payload,'文件上传或解析失败'));knowledgeUploadRuntime={busy:false,upload:payload.upload,error:''}}catch(error){knowledgeUploadRuntime={busy:false,upload:null,error:error instanceof Error?error.message:'文件上传或解析失败'}}renderKnowledgeUploadModal()};
const confirmKnowledgeUpload=async()=>{const upload=knowledgeUploadRuntime.upload;if(!upload||upload.state!=='parsed'||knowledgeUploadRuntime.busy)return;const title=document.querySelector('#preview-knowledge-title')?.value?.trim()||'';const category=document.querySelector('#preview-knowledge-category')?.value?.trim()||'';if(!title||!category){toast('请填写知识标题和分类');return}knowledgeUploadRuntime={...knowledgeUploadRuntime,busy:true,error:''};renderKnowledgeUploadModal();try{const response=await fetch('/api/institution/knowledge-management/upload',{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({uploadId:upload.uploadId,expectedRevision:upload.revision,title,category})});const payload=await response.json().catch(()=>null);if(!response.ok||payload?.kind!=='ready'||!payload.upload)throw new Error(knowledgeUploadError(payload,'知识确认失败'));knowledgeUploadRuntime={busy:false,upload:payload.upload,error:''}}catch(error){knowledgeUploadRuntime={busy:false,upload,error:error instanceof Error?error.message:'知识确认失败'}}renderKnowledgeUploadModal()};
const publishKnowledgeUpload=async()=>{const upload=knowledgeUploadRuntime.upload;if(!upload||upload.state!=='confirmed'||knowledgeUploadRuntime.busy)return;knowledgeUploadRuntime={...knowledgeUploadRuntime,busy:true,error:''};renderKnowledgeUploadModal();try{const response=await fetch('/api/institution/knowledge-management/upload',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({uploadId:upload.uploadId,expectedRevision:upload.revision})});const payload=await response.json().catch(()=>null);if(!response.ok||payload?.kind!=='ready'||payload.upload?.state!=='published')throw new Error(knowledgeUploadError(payload,'知识发布失败'));knowledgeUploadRuntime={busy:false,upload:payload.upload,error:''};knowledgeDocumentRuntime={loading:false,loaded:false,error:'',records:[]}}catch(error){knowledgeUploadRuntime={busy:false,upload,error:error instanceof Error?error.message:'知识发布失败'}}renderKnowledgeUploadModal()};
const knowledgeTableCard=()=>document.querySelector('#page .preview-knowledge-runtime-card')||[...document.querySelectorAll('#page .table-card')].find(card=>{const headers=[...card.querySelectorAll('thead th')].map(textOf);return headers[0]==='标题'&&headers.includes('版本')&&headers.includes('状态')});
const renderPublishedKnowledge=()=>{if(state.route!=='/knowledge')return;const card=knowledgeTableCard();if(!card)return;card.classList.add('preview-knowledge-runtime-card');if(knowledgeDocumentRuntime.loading){card.innerHTML='<div class="preview-knowledge-table-state"><div><b>正在读取正式知识</b><span>仅展示当前机构已发布的不可变版本。</span></div></div>';return}if(knowledgeDocumentRuntime.error){card.innerHTML='<div class="preview-knowledge-table-state"><div><b>正式知识暂不可用</b><span>'+esc(knowledgeDocumentRuntime.error)+'</span></div></div>';return}if(!knowledgeDocumentRuntime.loaded)return;const rows=knowledgeDocumentRuntime.records.length?knowledgeDocumentRuntime.records.map(record=>'<tr><td><button class="link">'+esc(record.title)+'</button></td><td>知识文档</td><td>'+esc(record.sourceLabel)+'</td><td><b>V'+Number(record.version)+'</b></td><td>'+tag('已发布','green')+'</td><td><span class="muted">待授权</span></td><td>'+tag('人工确认','orange')+'</td><td>—</td><td><span class="muted">'+new Date(record.publishedAt).toLocaleDateString('zh-CN')+'</span></td></tr>').join(''):'<tr><td colspan="9"><div class="preview-knowledge-table-state"><div><b>当前机构暂无已发布知识</b><span>上传并完成解析确认、发布后会显示在这里。</span></div></div></td></tr>';card.innerHTML='<table class="table"><thead><tr><th>标题</th><th>类型</th><th>分类</th><th>版本</th><th>状态</th><th>可调用AI</th><th>发布方式</th><th>引用</th><th>发布时间</th></tr></thead><tbody>'+rows+'</tbody></table><div class="table-foot">共 '+knowledgeDocumentRuntime.records.length+' 条正式知识</div>'};
const hydratePublishedKnowledge=()=>{if(state.route!=='/knowledge')return;if(knowledgeDocumentRuntime.loaded||knowledgeDocumentRuntime.loading){renderPublishedKnowledge();return}knowledgeDocumentRuntime={...knowledgeDocumentRuntime,loading:true,error:''};renderPublishedKnowledge();fetch('/api/v1/institution/knowledge-documents?page=1',{cache:'no-store',credentials:'same-origin'}).then(async response=>{const payload=await response.json().catch(()=>null);if(!response.ok||!Array.isArray(payload?.records))throw new Error('正式知识读取失败');knowledgeDocumentRuntime={loading:false,loaded:true,error:'',records:payload.records};renderPublishedKnowledge()}).catch(error=>{knowledgeDocumentRuntime={loading:false,loaded:true,error:error instanceof Error?error.message:'正式知识读取失败',records:[]};renderPublishedKnowledge()})};
const customerTableCard=()=>document.querySelector('#page .preview-customer-runtime-card')||[...document.querySelectorAll('#page .table-card')].find(card=>{const headers=[...card.querySelectorAll('thead th')].map(textOf);return headers.length===9&&headers[0]==='客户'&&headers[8]==='操作'});
const customerIdTail=value=>{const normalized=String(value||'').replace(/[^a-zA-Z0-9]/g,'');return normalized.slice(-4).padStart(4,'0')};
const customerUpdatedAt=value=>{const instant=new Date(value);return Number.isFinite(instant.getTime())?instant.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'时间不可用'};
const customerRowMarkup=record=>'<tr><td><div class="customer-cell"><span class="avatar">'+esc((record.displayName||'客').slice(0,1))+'</span><div><button class="link" data-action="preview-customer-record" data-customer-index="'+customerListRuntime.records.indexOf(record)+'">'+esc(record.displayName)+'</button><div class="meta">客户 · '+customerIdTail(record.customerId)+'</div></div></div></td><td>'+tag('未读取')+'</td><td>'+tag(CUSTOMER_PRIORITY_LABELS[record.priority]||'持续观察',record.priority==='high'?'red':record.priority==='medium'?'orange':'')+'</td><td>'+tag(CUSTOMER_LIFECYCLE_LABELS[record.lifecycle]||'状态未知','cyan')+'<div class="meta">更新 '+customerUpdatedAt(record.updatedAt)+'</div></td><td>'+tag('未接入投影')+'</td><td>—</td><td>'+tag('未读取')+'</td><td>未读取</td><td><button class="link" data-action="preview-customer-record" data-customer-index="'+customerListRuntime.records.indexOf(record)+'">查看</button></td></tr>';
const customerPageNumbers=(page,pageCount)=>{if(pageCount<=7)return Array.from({length:pageCount},(_,index)=>index+1);const values=[1,page-1,page,page+1,pageCount].filter(value=>value>=1&&value<=pageCount);return [...new Set(values)].sort((a,b)=>a-b)};
const customerPageButtons=(page,pageCount)=>{const numbers=customerPageNumbers(page,pageCount);let previous=0;let markup='';for(const value of numbers){if(previous&&value-previous>1)markup+='<span class="muted">…</span>';markup+='<button class="pagebtn preview-customer-pagebtn'+(value===page?' active':'')+'" data-action="preview-customer-page" data-page="'+value+'" aria-label="第 '+value+' 页" aria-current="'+(value===page?'page':'false')+'">'+value+'</button>';previous=value}return markup};
const customerPageSizeOptions=pageSize=>CUSTOMER_LIST_PAGE_SIZES.map(value=>'<option value="'+value+'"'+(value===pageSize?' selected':'')+'>'+value+' 条</option>').join('');
const customerListFilterKey=()=>[customerListRuntime.lifecycle||'',customerListRuntime.priority||'',customerListRuntime.keyword,customerListRuntime.gender||'',customerListRuntime.ageBand||'',customerListRuntime.createdFrom,customerListRuntime.createdTo].join(':');
const customerListRequestKey=(page,pageSize)=>[page,pageSize,customerListFilterKey()].join(':');
const customerListUrl=(page,pageSize,lifecycle=customerListRuntime.lifecycle,priority=customerListRuntime.priority,filters=customerListRuntime)=>{const activeFilters=state.route==='/customers/list'?filters:{};const query=new URLSearchParams({page:String(page),pageSize:String(pageSize)});if(lifecycle)query.set('lifecycle',lifecycle);if(priority)query.set('priority',priority);if(activeFilters.keyword)query.set('keyword',activeFilters.keyword);if(activeFilters.gender)query.set('gender',activeFilters.gender);if(activeFilters.ageBand)query.set('ageBand',activeFilters.ageBand);if(activeFilters.createdFrom)query.set('createdFrom',activeFilters.createdFrom);if(activeFilters.createdTo)query.set('createdTo',activeFilters.createdTo);return'/api/v1/institution/customers?'+query.toString()};
const renderCustomerListRuntime=()=>{if(state.route!=='/customers/list')return;const card=customerTableCard();if(!card)return;const info=customerListRuntime.pageInfo;const signature=[customerListRuntime.loading,customerListRuntime.error,customerListRuntime.page,customerListRuntime.pageSize,customerListRuntime.expanded,customerListFilterKey(),info?.total,info?.pageCount,customerListRuntime.records.map(record=>record.customerId).join('|')].join(':');if(card.dataset.customerRuntimeSignature===signature)return;card.dataset.customerRuntimeSignature=signature;card.classList.add('preview-customer-runtime-card');const toolbar=document.querySelector('#page .toolbar .muted');const scopeLabel=customerListRuntime.segmentLabel?'真实分群「'+customerListRuntime.segmentLabel+'」':customerHasAppliedFilters()?'当前机构筛选结果':'当前机构全部客户';if(customerListRuntime.loading&&!info){setTextIfChanged(toolbar,'正在读取'+scopeLabel+'…');card.innerHTML='<div class="preview-customer-table-state"><div><b>正在加载客户清单</b><span>读取当前登录账号有权访问的机构客户主档。</span></div></div>';return}if(customerListRuntime.error&&!info){setTextIfChanged(toolbar,'客户清单暂不可用');card.innerHTML='<div class="preview-customer-table-state"><div><b>客户清单加载失败</b><span>'+esc(customerListRuntime.error)+'</span><br><button class="btn primary" data-action="preview-customer-retry">重新加载</button></div></div>';return}if(!info)return;setTextIfChanged(toolbar,scopeLabel+' · 共 '+info.total+' 位客户；本页 '+customerListRuntime.records.length+' 条');const rows=customerListRuntime.records.length?customerListRuntime.records.map(customerRowMarkup).join(''):'<tr><td colspan="9"><div class="preview-customer-table-state"><div><b>当前筛选暂无客户</b><span>结果来自当前机构的正式客户主档，不补入原型演示记录。</span></div></div></td></tr>';const pageCount=Math.max(0,info.pageCount);const pages=pageCount?customerPageButtons(info.page,pageCount):'';const disabledPrevious=info.page<=1?' disabled':'';const disabledNext=info.page>=pageCount?' disabled':'';const clearSegment=customerListRuntime.segmentLabel?'<button class="btn small" data-action="preview-clear-customer-segment">查看全部客户</button>':'';card.innerHTML='<div class="preview-customer-table-scroll'+(customerListRuntime.expanded?' is-expanded':'')+'"><table class="table"><thead><tr><th>客户</th><th>来源</th><th>优先级</th><th>生命周期</th><th>任务状态</th><th>下一随访</th><th>微信身份</th><th>负责人</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-foot"><span class="preview-customer-page-status">共 '+info.total+' 条 · 第 '+(pageCount?info.page:0)+' / '+pageCount+' 页 · 本页 '+customerListRuntime.records.length+' 条</span><div class="preview-customer-page-tools">'+clearSegment+'<label class="preview-customer-page-size">每页显示<select data-customer-page-size aria-label="每页显示条数">'+customerPageSizeOptions(info.pageSize)+'</select></label><button class="btn small" data-action="preview-customer-card-toggle" aria-expanded="'+customerListRuntime.expanded+'">'+ico('arrow')+(customerListRuntime.expanded?' 收起表格':' 展开表格')+'</button><div class="pages"><button class="pagebtn preview-customer-pagebtn" data-action="preview-customer-page" data-page="'+(info.page-1)+'" aria-label="上一页"'+disabledPrevious+'>'+ico('back')+'</button>'+pages+'<button class="pagebtn preview-customer-pagebtn" data-action="preview-customer-page" data-page="'+(info.page+1)+'" aria-label="下一页"'+disabledNext+'>'+ico('arrow')+'</button></div></div></div>'};
const validCustomerRecord=record=>record&&record.contractVersion==='v1'&&typeof record.customerId==='string'&&typeof record.displayName==='string'&&typeof record.updatedAt==='string'&&Object.hasOwn(CUSTOMER_LIFECYCLE_LABELS,record.lifecycle)&&Object.hasOwn(CUSTOMER_PRIORITY_LABELS,record.priority);
const loadCustomerList=async(page=customerListRuntime.page,pageSize=customerListRuntime.pageSize)=>{if(state.route!=='/customers/list'||!CUSTOMER_LIST_PAGE_SIZES.includes(pageSize)||!Number.isInteger(page)||page<1)return;const requestToken=customerListRuntime.requestToken+1;const key=customerListRequestKey(page,pageSize);customerListRuntime={...customerListRuntime,page,pageSize,loading:true,error:'',requestKey:key,requestToken};renderCustomerListRuntime();try{const signal=globalThis.AbortSignal?.timeout?.(8000);const response=await fetch(customerListUrl(page,pageSize),{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}if(!response.ok||!Array.isArray(result?.records)||!result.records.every(validCustomerRecord))throw new Error('服务端未返回有效客户清单');const info=result.pageInfo;const expectedPageCount=info?.total===0?0:Math.min(100,Math.ceil(info?.total/pageSize));if(!info||info.page!==page||info.pageSize!==pageSize||!Number.isInteger(info.total)||info.total<0||!Number.isInteger(info.pageCount)||info.pageCount<0||typeof info.hasMore!=='boolean'||info.pageCount!==expectedPageCount)throw new Error('客户分页信息校验失败');if(requestToken!==customerListRuntime.requestToken)return;if(info.pageCount>0&&page>info.pageCount){void loadCustomerList(info.pageCount,pageSize);return}customerListRuntime={...customerListRuntime,page:info.page,pageSize:info.pageSize,records:result.records,pageInfo:info,loading:false,error:'',requestKey:key,requestToken};renderCustomerListRuntime()}catch{if(requestToken!==customerListRuntime.requestToken)return;customerListRuntime={...customerListRuntime,loading:false,error:'请刷新后重试；已有页面数据未被修改。',requestToken};renderCustomerListRuntime()}};
const hydrateCustomerListRuntime=()=>{if(state.route!=='/customers/list')return;renderCustomerListRuntime();const key=customerListRequestKey(customerListRuntime.page,customerListRuntime.pageSize);if(!customerListRuntime.loading&&(!customerListRuntime.pageInfo||customerListRuntime.requestKey!==key))void loadCustomerList(customerListRuntime.page,customerListRuntime.pageSize)};
const customerSegmentCardMarkup=item=>'<article class="card hover segment-card preview-real-segment-card"><div style="display:flex;align-items:center;gap:10px"><div class="kicon '+item.tone+'">'+ico(item.icon)+'</div><div><h3>'+esc(item.label)+'</h3><div class="count">'+item.total+'</div></div></div><p class="sub" style="min-height:30px">当前机构客户主档中的真实记录。</p><div class="rule">规则：'+esc(item.rule)+'</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="muted">服务端实时筛选</span><button class="preview-real-segment-link" data-action="preview-customer-segment" data-segment-key="'+esc(item.key)+'">查看客户 ›</button></div></article>';
const renderCustomerSegmentsRuntime=()=>{if(state.route!=='/customers/segments')return;const page=document.querySelector('#page');if(!page)return;const signature=[customerSegmentRuntime.loading,customerSegmentRuntime.error,customerSegmentRuntime.items.map(item=>item.key+':'+item.total).join('|')].join(':');if(page.dataset.customerSegmentsRuntimeSignature===signature&&page.querySelector('.preview-real-segment-source'))return;page.dataset.customerSegmentsRuntimeSignature=signature;let content='';if(customerSegmentRuntime.loading&&!customerSegmentRuntime.items.length)content='<div class="segment-grid"><section class="card preview-real-segment-state"><div><b>正在读取真实客户分群</b><span>按当前机构范围从正式客户 Reader 统计。</span></div></section></div>';else if(customerSegmentRuntime.error&&!customerSegmentRuntime.items.length)content='<div class="segment-grid"><section class="card preview-real-segment-state"><div><b>真实客户分群暂不可用</b><span>'+esc(customerSegmentRuntime.error)+'</span><br><button class="btn primary" data-action="preview-customer-segments-retry">重新加载</button></div></section></div>';else content='<div class="segment-grid">'+customerSegmentRuntime.items.map(customerSegmentCardMarkup).join('')+'</div>';page.innerHTML=ph('客户分群','按当前机构客户主档中可验证的生命周期和优先级生成；点击分群可查看对应真实客户。',btn('新建分群',{icon:'plus',cls:'primary',action:'new-segment'}))+'<div class="preview-real-segment-source">'+ico('database')+'<span><b>数据来源：正式客户 Reader</b><br>仅统计当前 tenantId + institutionId 范围内已授权记录；消费、到店、沟通和随访投影条件尚未完整接入，因此不展示任何原型演示人数。</span></div>'+content};
const readCustomerSegmentTotal=async definition=>{const signal=globalThis.AbortSignal?.timeout?.(8000);const response=await fetch(customerListUrl(1,10,definition.lifecycle,definition.priority,{}),{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}const info=result?.pageInfo;if(!response.ok||!Array.isArray(result?.records)||!result.records.every(validCustomerRecord)||!info||info.page!==1||info.pageSize!==10||!Number.isInteger(info.total)||info.total<0)throw new Error('服务端未返回有效分群统计');return{...definition,total:info.total}};
const loadCustomerSegments=async()=>{if(state.route!=='/customers/segments')return;const requestToken=customerSegmentRuntime.requestToken+1;customerSegmentRuntime={...customerSegmentRuntime,loading:true,error:'',requestKey:'current-institution',requestToken};renderCustomerSegmentsRuntime();try{const items=await Promise.all(CUSTOMER_SEGMENT_DEFINITIONS.map(readCustomerSegmentTotal));if(requestToken!==customerSegmentRuntime.requestToken)return;customerSegmentRuntime={items,loading:false,error:'',requestKey:'current-institution',requestToken};renderCustomerSegmentsRuntime()}catch{if(requestToken!==customerSegmentRuntime.requestToken)return;customerSegmentRuntime={...customerSegmentRuntime,loading:false,error:'请刷新后重试；未回退到原型演示人数。',requestToken};renderCustomerSegmentsRuntime()}};
const hydrateCustomerSegmentsRuntime=()=>{if(state.route!=='/customers/segments')return;renderCustomerSegmentsRuntime();if(!customerSegmentRuntime.loading&&(!customerSegmentRuntime.items.length||customerSegmentRuntime.requestKey!=='current-institution'))void loadCustomerSegments()};
const openCustomerSegment=element=>{const definition=CUSTOMER_SEGMENT_DEFINITIONS.find(item=>item.key===element.dataset.segmentKey);if(!definition)return;customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,loading:false,error:'',requestKey:'',lifecycle:definition.lifecycle,priority:definition.priority,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:definition.label};go('/customers/list')};
const clearCustomerSegment=()=>{customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,loading:false,error:'',requestKey:'',lifecycle:null,priority:null,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:''};decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const customerHasAppliedFilters=()=>Boolean(customerListRuntime.lifecycle||customerListRuntime.priority||customerListRuntime.keyword||customerListRuntime.gender||customerListRuntime.ageBand||customerListRuntime.createdFrom||customerListRuntime.createdTo);
const customerQuickIsActive=definition=>definition.lifecycle===customerListRuntime.lifecycle&&definition.priority===customerListRuntime.priority&&!customerListRuntime.keyword&&!customerListRuntime.gender&&!customerListRuntime.ageBand&&!customerListRuntime.createdFrom&&!customerListRuntime.createdTo;
const customerFilterChipMarkup=()=>[
['keyword','关键词',customerListRuntime.keyword],
['lifecycle','生命周期',customerListRuntime.lifecycle?CUSTOMER_LIFECYCLE_LABELS[customerListRuntime.lifecycle]:''],
['priority','优先级',customerListRuntime.priority?CUSTOMER_PRIORITY_LABELS[customerListRuntime.priority]:''],
['gender','性别',customerListRuntime.gender?CUSTOMER_GENDER_LABELS[customerListRuntime.gender]:''],
['ageBand','年龄',customerListRuntime.ageBand?CUSTOMER_AGE_BAND_LABELS[customerListRuntime.ageBand]:''],
['createdRange','创建时间',customerListRuntime.createdFrom?dateRangeLabel(customerListRuntime.createdFrom,customerListRuntime.createdTo):''],
].filter(item=>item[2]).map(item=>'<span class="filter-chip">'+esc(item[1])+'：'+esc(item[2])+'<button data-action="preview-remove-customer-filter" data-field="'+item[0]+'" aria-label="移除'+esc(item[1])+'筛选">'+ico('close')+'</button></span>').join('');
const decorateCustomerFilterRuntime=()=>{
if(state.route!=='/customers/list')return;
const page=document.querySelector('#page');
if(!page)return;
const description=page.querySelector('.pagehead .sub');
setTextIfChanged(description,'统一管理当前机构客户主档；快捷条件与高级条件均由正式 Customer Reader 在服务端执行。');
const filterSignature=customerListFilterKey();
const quick=page.querySelector('.saved-views');
if(quick&&quick.dataset.customerFilterSignature!==filterSignature){
quick.dataset.customerFilterSignature=filterSignature;
quick.classList.add('preview-customer-quick');
quick.innerHTML='<b style="font-size:12px">快捷筛选</b>'+CUSTOMER_QUICK_FILTERS.map(definition=>'<button class="view-chip'+(customerQuickIsActive(definition)?' active':'')+'" data-action="preview-customer-quick" data-key="'+definition.key+'">'+definition.label+'</button>').join('')+'<span class="preview-customer-filter-note">随访处理中、待人工和微信匹配需对应正式投影，本页不以客户主档字段冒充。</span>';
}
page.querySelectorAll('.filter-chips:not(.preview-customer-filter-chips)').forEach(element=>element.remove());
let chips=page.querySelector('.preview-customer-filter-chips');
if(!chips&&quick){chips=document.createElement('div');chips.className='filter-chips preview-customer-filter-chips';quick.insertAdjacentElement('afterend',chips)}
if(chips&&chips.dataset.customerFilterSignature!==filterSignature){chips.dataset.customerFilterSignature=filterSignature;chips.innerHTML=customerFilterChipMarkup()}
const filters=page.querySelector('section.card.filters');
if(filters&&!filters.dataset.customerRuntimeFilter){filters.dataset.customerRuntimeFilter='true';filters.className='card filters preview-customer-filter-bar';filters.innerHTML='<div class="filter grow"><label class="label">客户姓名</label><input class="input" data-customer-keyword maxlength="80" autocomplete="off" placeholder="输入客户姓名（不支持手机号等敏感标识）"></div><button class="btn" data-action="advanced-customer-filter">'+ico('filter')+' 更多筛选</button><button class="btn primary" data-action="preview-customer-query">查询</button>'}
const keyword=filters?.querySelector('[data-customer-keyword]');
if(keyword&&document.activeElement!==keyword&&keyword.value!==customerListRuntime.keyword)keyword.value=customerListRuntime.keyword;
};
const customerChoiceButtons=(field,options,value)=>'<div class="preview-customer-choice" data-customer-filter-group="'+field+'">'+options.map(option=>'<button'+(value===option[0]?' class="active"':'')+' data-action="preview-customer-filter-choice" data-field="'+field+'" data-value="'+option[0]+'" aria-pressed="'+(value===option[0]?'true':'false')+'">'+option[1]+'</button>').join('')+'<button class="link" data-action="preview-customer-filter-choice" data-field="'+field+'" data-value="">清除选择</button></div>';
const customerLifecycleOptions=()=>[['','全部生命周期'],...Object.entries(CUSTOMER_LIFECYCLE_LABELS)].map(option=>'<option value="'+option[0]+'"'+(customerListRuntime.lifecycle===option[0]?' selected':'')+'>'+option[1]+'</option>').join('');
const customerPriorityOptions=()=>[['','全部优先级'],...Object.entries(CUSTOMER_PRIORITY_LABELS)].map(option=>'<option value="'+option[0]+'"'+(customerListRuntime.priority===option[0]?' selected':'')+'>'+option[1]+'</option>').join('');
const openFormalCustomerAdvancedFilter=()=>{if(customerListRuntime.createdFrom)state.dateSelection['customer-created-range']=dateRangeLabel(customerListRuntime.createdFrom,customerListRuntime.createdTo);else delete state.dateSelection['customer-created-range'];const dateLabel=state.dateSelection['customer-created-range']||'选择日期范围';openDrawer('更多筛选','<div class="advanced-filter preview-customer-advanced"><section class="filter-group"><h3>基础资料</h3><div class="form-grid"><div><label class="label">性别</label>'+customerChoiceButtons('gender',[['female','女'],['male','男']],customerListRuntime.gender)+'</div><div><label class="label">年龄区间</label>'+customerChoiceButtons('ageBand',Object.entries(CUSTOMER_AGE_BAND_LABELS),customerListRuntime.ageBand)+'</div><div><label class="label">客户创建时间</label><button class="selectlike" data-action="date-picker" data-target="customer-created-range">'+ico('calendar')+' <span class="preview-date-trigger-label">'+esc(dateLabel)+'</span> '+ico('arrow')+'</button></div><div><label class="label">生命周期</label><select class="select" data-customer-advanced-lifecycle>'+customerLifecycleOptions()+'</select></div><div><label class="label">优先级</label><select class="select" data-customer-advanced-priority>'+customerPriorityOptions()+'</select></div></div></section><section class="filter-group"><h3>筛选边界</h3><div class="preview-customer-unavailable"><span>可用：客户姓名、性别、年龄段、创建时间、生命周期和优先级，全部在服务端按 tenantId + institutionId 执行。</span><span>暂不可用：院区、负责人、来源质量、预约/治疗/消费、随访状态、渠道身份、AI画像与经营推断；这些条件缺少当前页面的正式投影或授权目录。</span></div></section></div>',btn('重置筛选',{action:'preview-reset-customer-filters'})+btn('应用筛选',{cls:'primary',action:'apply-advanced-filter'}),true)};
const selectCustomerFilterChoice=element=>{const group=element.closest('[data-customer-filter-group]');if(!group)return;group.querySelectorAll('button[data-value]').forEach(button=>{const active=button===element&&Boolean(element.dataset.value);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})};
const resetCustomerFilters=()=>{delete state.dateSelection['customer-created-range'];customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',lifecycle:null,priority:null,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:''};closeAll();decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const applyCustomerQuickFilter=element=>{const definition=CUSTOMER_QUICK_FILTERS.find(item=>item.key===element.dataset.key);if(!definition)return;delete state.dateSelection['customer-created-range'];customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',lifecycle:definition.lifecycle,priority:definition.priority,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:definition.key==='all'?'':definition.label};decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const queryCustomerList=()=>{const input=document.querySelector('[data-customer-keyword]');const keyword=String(input?.value||'').trim();if(keyword.length>80||/(?:^|\D)1[3-9]\d{9}(?:$|\D)/.test(keyword)||/^\d{6,}$/.test(keyword)){toast('仅支持按低敏客户姓名查询');return}customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',keyword,segmentLabel:''};decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const applyCustomerAdvancedFilters=()=>{const drawer=document.querySelector('#drawer');const gender=drawer?.querySelector('[data-customer-filter-group="gender"] button.active')?.dataset.value||null;const ageBand=drawer?.querySelector('[data-customer-filter-group="ageBand"] button.active')?.dataset.value||null;const lifecycle=drawer?.querySelector('[data-customer-advanced-lifecycle]')?.value||null;const priority=drawer?.querySelector('[data-customer-advanced-priority]')?.value||null;const created=readStoredDateRange('customer-created-range');customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',gender,ageBand,lifecycle,priority,createdFrom:created.start,createdTo:created.end,segmentLabel:''};closeAll();decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const removeCustomerFilter=element=>{const field=element.dataset.field;if(field==='createdRange'){customerListRuntime={...customerListRuntime,createdFrom:'',createdTo:''};delete state.dateSelection['customer-created-range']}else if(['keyword','lifecycle','priority','gender','ageBand'].includes(field))customerListRuntime={...customerListRuntime,[field]:field==='keyword'?'':null};customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',segmentLabel:''};decorateCustomerFilterRuntime();void loadCustomerList(1,customerListRuntime.pageSize)};
const opportunityFilterKey=()=>[customerOpportunityRuntime.type,customerOpportunityRuntime.priority||''].join(':');
const opportunityRequestKey=(page,pageSize)=>[page,pageSize,opportunityFilterKey()].join(':');
const opportunityDefinitions=()=>customerOpportunityRuntime.type==='all'?CUSTOMER_OPPORTUNITY_DEFINITIONS:CUSTOMER_OPPORTUNITY_DEFINITIONS.filter(item=>item.key===customerOpportunityRuntime.type);
const opportunityPriorityLabel=value=>value==='high'?'高':value==='medium'?'中':'观察';
const opportunityPriorityTone=value=>value==='high'?'red':value==='medium'?'orange':'';
const opportunityTypeOptions=()=>[['all','全部类型'],...CUSTOMER_OPPORTUNITY_DEFINITIONS.map(item=>[item.key,item.label])].map(item=>'<option value="'+item[0]+'"'+(customerOpportunityRuntime.type===item[0]?' selected':'')+'>'+item[1]+'</option>').join('');
const opportunityPriorityOptions=()=>[['','全部优先级'],['high','高优先级'],['medium','中优先级'],['observe','持续观察']].map(item=>'<option value="'+item[0]+'"'+((customerOpportunityRuntime.priority||'')===item[0]?' selected':'')+'>'+item[1]+'</option>').join('');
const opportunityPageButtons=(page,pageCount)=>{const numbers=customerPageNumbers(page,pageCount);let previous=0;let markup='';for(const value of numbers){if(previous&&value-previous>1)markup+='<span class="muted">…</span>';markup+='<button class="pagebtn preview-opportunity-pagebtn'+(value===page?' active':'')+'" data-action="preview-opportunity-page" data-page="'+value+'" aria-label="第 '+value+' 页" aria-current="'+(value===page?'page':'false')+'">'+value+'</button>';previous=value}return markup};
const opportunityRowMarkup=(record,index)=>'<tr><td><button class="link" data-action="preview-opportunity-record" data-opportunity-index="'+index+'">'+esc(record.displayName)+'</button><div class="meta">客户 · '+customerIdTail(record.customerId)+'</div></td><td><b>'+esc(record.opportunityLabel)+'</b></td><td>'+esc(record.basis)+'</td><td>'+tag('客户主档','blue')+'</td><td>'+tag(opportunityPriorityLabel(record.priority),opportunityPriorityTone(record.priority))+'</td><td>'+tag('只读候选','orange')+'</td><td>未读取</td><td><button class="link" data-action="preview-opportunity-record" data-opportunity-index="'+index+'">查看客户</button></td></tr>';
const renderCustomerOpportunitiesRuntime=()=>{if(state.route!=='/customers/opportunities')return;const page=document.querySelector('#page');if(!page)return;const info=customerOpportunityRuntime.pageInfo;const signature=[customerOpportunityRuntime.loading,customerOpportunityRuntime.error,customerOpportunityRuntime.page,customerOpportunityRuntime.pageSize,customerOpportunityRuntime.expanded,opportunityFilterKey(),info?.total,info?.pageCount,customerOpportunityRuntime.records.map(record=>record.customerId).join('|')].join(':');if(page.dataset.customerOpportunityRuntimeSignature===signature&&page.querySelector('.preview-opportunity-runtime-card'))return;page.dataset.customerOpportunityRuntimeSignature=signature;const filters='<section class="card filters"><div class="filter grow"><label class="label">机会类型</label><select class="select" style="width:100%" data-opportunity-type>'+opportunityTypeOptions()+'</select></div><div class="filter grow"><label class="label">客户优先级</label><select class="select" style="width:100%" data-opportunity-priority>'+opportunityPriorityOptions()+'</select></div><div class="filter"><label class="label">来源</label><button class="selectlike" disabled>客户主档</button></div><div class="filter-actions"><button class="btn primary" data-action="preview-opportunity-query">查询</button></div></section><div class="preview-opportunity-filter-note">筛选由正式 Customer Reader 在服务端执行；当前未接入机会状态、负责人或关键词 Reader。</div>';let body='';if(customerOpportunityRuntime.loading&&!info)body='<section class="card preview-opportunity-runtime-card"><div class="preview-customer-table-state"><div><b>正在读取真实机会候选</b><span>按当前机构客户主档生命周期生成只读投影。</span></div></div></section>';else if(customerOpportunityRuntime.error&&!info)body='<section class="card preview-opportunity-runtime-card"><div class="preview-customer-table-state"><div><b>经营机会候选暂不可用</b><span>'+esc(customerOpportunityRuntime.error)+'</span><br><button class="btn primary" data-action="preview-opportunity-retry">重新加载</button></div></div></section>';else if(info){const rows=customerOpportunityRuntime.records.length?customerOpportunityRuntime.records.map(opportunityRowMarkup).join(''):'<tr><td colspan="8"><div class="preview-customer-table-state"><div><b>当前筛选暂无机会候选</b><span>未补入原型的 182 条 Demo 机会。</span></div></div></td></tr>';const pageCount=info.pageCount;const pages=pageCount?opportunityPageButtons(info.page,pageCount):'';const disabledPrevious=info.page<=1?' disabled':'';const disabledNext=info.page>=pageCount?' disabled':'';body='<section class="card table-card preview-opportunity-runtime-card"><div class="preview-customer-table-scroll'+(customerOpportunityRuntime.expanded?' is-expanded':'')+'"><table class="table"><thead><tr><th>客户</th><th>机会类型</th><th>判断依据</th><th>来源</th><th>优先级</th><th>状态</th><th>负责人</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-foot"><span class="preview-customer-page-status">共 '+info.total+' 条只读候选 · 第 '+(pageCount?info.page:0)+' / '+pageCount+' 页 · 本页 '+customerOpportunityRuntime.records.length+' 条</span><div class="preview-customer-page-tools"><label class="preview-customer-page-size">每页显示<select data-opportunity-page-size aria-label="经营机会每页显示条数">'+customerPageSizeOptions(info.pageSize)+'</select></label><button class="btn small" data-action="preview-opportunity-card-toggle" aria-expanded="'+customerOpportunityRuntime.expanded+'">'+ico('arrow')+(customerOpportunityRuntime.expanded?' 收起表格':' 展开表格')+'</button><div class="pages"><button class="pagebtn preview-opportunity-pagebtn" data-action="preview-opportunity-page" data-page="'+(info.page-1)+'" aria-label="上一页"'+disabledPrevious+'>'+ico('back')+'</button>'+pages+'<button class="pagebtn preview-opportunity-pagebtn" data-action="preview-opportunity-page" data-page="'+(info.page+1)+'" aria-label="下一页"'+disabledNext+'>'+ico('arrow')+'</button></div></div></div></section>'}page.innerHTML=ph('经营机会','根据当前机构客户主档生命周期生成可审计的只读机会候选；不创建正式 Opportunity，不启用旧机会池。','<button class="btn primary" disabled aria-disabled="true">'+ico('plus')+' 新建机会（未开放）</button>')+'<div class="preview-real-segment-source">'+ico('database')+'<span><b>数据来源：正式 Customer Reader</b><br>仅使用当前 tenantId + institutionId 的客户主档、生命周期与优先级；状态和负责人没有正式来源时明确显示，不使用原型 Demo。</span></div>'+filters+body};
const fetchOpportunityCustomerPage=async(definition,page,priority)=>{const signal=globalThis.AbortSignal?.timeout?.(8000);const response=await fetch(customerListUrl(page,100,definition.lifecycle,priority,{}),{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}const info=result?.pageInfo;if(!response.ok||!Array.isArray(result?.records)||!result.records.every(record=>validCustomerRecord(record)&&record.lifecycle===definition.lifecycle&&(!priority||record.priority===priority))||!info||info.page!==page||info.pageSize!==100||!Number.isInteger(info.total)||info.total<0||!Number.isInteger(info.pageCount)||info.pageCount<0||info.pageCount>100)throw new Error('服务端未返回有效机会候选');return{records:result.records,pageInfo:info}};
const readOpportunityDefinition=async(definition,desiredCount,priority)=>{const first=await fetchOpportunityCustomerPage(definition,1,priority);const target=Math.min(desiredCount,first.pageInfo.total);const pageCount=Math.ceil(target/100);const pages=[first];for(let page=2;page<=pageCount;page+=1)pages.push(await fetchOpportunityCustomerPage(definition,page,priority));return{definition,total:first.pageInfo.total,records:pages.flatMap(item=>item.records).slice(0,target)}};
const loadCustomerOpportunities=async(page=customerOpportunityRuntime.page,pageSize=customerOpportunityRuntime.pageSize)=>{if(state.route!=='/customers/opportunities'||!CUSTOMER_LIST_PAGE_SIZES.includes(pageSize)||!Number.isInteger(page)||page<1||page>100)return;const requestToken=customerOpportunityRuntime.requestToken+1;const key=opportunityRequestKey(page,pageSize);customerOpportunityRuntime={...customerOpportunityRuntime,page,pageSize,loading:true,error:'',requestKey:key,requestToken};renderCustomerOpportunitiesRuntime();try{const desiredCount=page*pageSize;const sources=await Promise.all(opportunityDefinitions().map(definition=>readOpportunityDefinition(definition,desiredCount,customerOpportunityRuntime.priority)));if(requestToken!==customerOpportunityRuntime.requestToken)return;const total=sources.reduce((sum,item)=>sum+item.total,0);const pageCount=total===0?0:Math.min(100,Math.ceil(total/pageSize));if(pageCount>0&&page>pageCount){void loadCustomerOpportunities(pageCount,pageSize);return}const offset=(page-1)*pageSize;const records=sources.flatMap(item=>item.records.map(record=>({...record,opportunityType:item.definition.key,opportunityLabel:item.definition.label,basis:item.definition.basis}))).sort((left,right)=>right.updatedAt.localeCompare(left.updatedAt)||left.customerId.localeCompare(right.customerId)).slice(offset,offset+pageSize);customerOpportunityRuntime={...customerOpportunityRuntime,page,pageSize,records,pageInfo:{page,pageSize,total,pageCount,hasMore:page<pageCount},loading:false,error:'',requestKey:key,requestToken};renderCustomerOpportunitiesRuntime()}catch{if(requestToken!==customerOpportunityRuntime.requestToken)return;customerOpportunityRuntime={...customerOpportunityRuntime,loading:false,error:'请刷新后重试；未回退到旧机会池或原型 Demo。',requestToken};renderCustomerOpportunitiesRuntime()}};
const hydrateCustomerOpportunitiesRuntime=()=>{if(state.route!=='/customers/opportunities')return;renderCustomerOpportunitiesRuntime();const key=opportunityRequestKey(customerOpportunityRuntime.page,customerOpportunityRuntime.pageSize);if(!customerOpportunityRuntime.loading&&(!customerOpportunityRuntime.pageInfo||customerOpportunityRuntime.requestKey!==key))void loadCustomerOpportunities(customerOpportunityRuntime.page,customerOpportunityRuntime.pageSize)};
const queryCustomerOpportunities=()=>{const type=document.querySelector('[data-opportunity-type]')?.value||'all';const priority=document.querySelector('[data-opportunity-priority]')?.value||null;if(type!=='all'&&!CUSTOMER_OPPORTUNITY_DEFINITIONS.some(item=>item.key===type))return;if(priority&&!Object.hasOwn(CUSTOMER_PRIORITY_LABELS,priority))return;customerOpportunityRuntime={...customerOpportunityRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',type,priority};void loadCustomerOpportunities(1,customerOpportunityRuntime.pageSize)};
const openCustomerOpportunityRecord=element=>{const record=customerOpportunityRuntime.records[Number(element.dataset.opportunityIndex)];if(!record)return;openDrawer(record.displayName,'<div class="detail"><div class="drow"><span class="dkey">对象标识</span><b>客户 · '+customerIdTail(record.customerId)+'</b></div><div class="drow"><span class="dkey">机会类型</span><b>'+esc(record.opportunityLabel)+'</b></div><div class="drow"><span class="dkey">判断依据</span><b>'+esc(record.basis)+'</b></div><div class="drow"><span class="dkey">客户优先级</span><b>'+esc(CUSTOMER_PRIORITY_LABELS[record.priority])+'</b></div><div class="drow"><span class="dkey">最近更新</span><b>'+esc(customerUpdatedAt(record.updatedAt))+'</b></div></div><div class="rule">这是由正式客户主档生成的只读候选，不是已持久化的 Opportunity；当前未启用机会 Writer、负责人分配或状态流转。</div>',btn('关闭',{action:'close-overlays'}),true)};
const appointmentListUrl=(page,pageSize=appointmentListRuntime.pageSize,status=appointmentListRuntime.status)=>{const query=new URLSearchParams({page:String(page),pageSize:String(pageSize)});if(status)query.set('status',status);if(appointmentListRuntime.keyword)query.set('q',appointmentListRuntime.keyword);if(appointmentListRuntime.startDate&&appointmentListRuntime.endDate){query.set('startDate',appointmentListRuntime.startDate);query.set('endDate',appointmentListRuntime.endDate)}return'/api/v1/institution/appointments?'+query.toString()};
const appointmentRequestKey=(page,pageSize=appointmentListRuntime.pageSize)=>[page,pageSize,appointmentListRuntime.status||'all',appointmentListRuntime.keyword||'all',appointmentListRuntime.startDate||'all',appointmentListRuntime.endDate||'all'].join(':');
const appointmentStatusTone=status=>status==='arrived'||status==='completed'?'green':status==='cancelled'?'red':status==='pending_confirmation'||status==='reschedule_requested'?'orange':'blue';
const appointmentDateTime=value=>{const instant=new Date(value);return Number.isFinite(instant.getTime())?instant.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'时间不可用'};
const appointmentDisplayCode=value=>{const input=String(value||'');let hash=2166136261;for(let index=0;index<input.length;index+=1){hash^=input.charCodeAt(index);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36).toUpperCase().padStart(7,'0').slice(-7)};
const appointmentStatusCount=status=>appointmentListRuntime.summary?(status?appointmentListRuntime.summary.statusCounts[status]:appointmentListRuntime.summary.total):0;
const appointmentStatusTabs=()=>[['', '全部'],...Object.entries(APPOINTMENT_STATUS_LABELS)].map(item=>'<button class="ctab'+((appointmentListRuntime.status||'')===item[0]?' active':'')+'" data-action="preview-appointment-status" data-status="'+item[0]+'">'+item[1]+' <span class="count">'+appointmentStatusCount(item[0])+'</span></button>').join('');
const appointmentPageButtons=info=>{const numbers=customerPageNumbers(info.page,info.pageCount);let previous=0;let markup='';for(const value of numbers){if(previous&&value-previous>1)markup+='<span class="muted">…</span>';markup+='<button class="pagebtn preview-appointment-pagebtn'+(value===info.page?' active':'')+'" data-action="preview-appointment-page" data-page="'+value+'" aria-label="第 '+value+' 页" aria-current="'+(value===info.page?'page':'false')+'">'+value+'</button>';previous=value}return markup};
const appointmentPageSizeOptions=pageSize=>APPOINTMENT_LIST_PAGE_SIZES.map(value=>'<option value="'+value+'"'+(value===pageSize?' selected':'')+'>'+value+' 条</option>').join('');
const appointmentSummaryMarkup=()=>{const summary=appointmentListRuntime.summary;if(!summary)return'';const counts=summary.statusCounts;return'<div class="preview-appointment-summary"><article class="card preview-appointment-summary-card"><div class="preview-appointment-summary-icon">'+ico('calendar')+'</div><div class="preview-appointment-summary-copy"><span>当前筛选预约</span><strong>'+summary.total+'</strong><small>正式预约主档实时汇总</small></div></article><article class="card preview-appointment-summary-card"><div class="preview-appointment-summary-icon orange">'+ico('clock')+'</div><div class="preview-appointment-summary-copy"><span>待确认</span><strong>'+counts.pending_confirmation+'</strong><small>需要机构人员确认</small></div></article><article class="card preview-appointment-summary-card"><div class="preview-appointment-summary-icon green">'+ico('check')+'</div><div class="preview-appointment-summary-copy"><span>已确认 / 已到店</span><strong>'+(counts.confirmed+counts.arrived)+'</strong><small>已确认 '+counts.confirmed+' · 已到店 '+counts.arrived+'</small></div></article><article class="card preview-appointment-summary-card"><div class="preview-appointment-summary-icon purple">'+ico('warning')+'</div><div class="preview-appointment-summary-copy"><span>已完成 / 已取消</span><strong>'+(counts.completed+counts.cancelled)+'</strong><small>已完成 '+counts.completed+' · 已取消 '+counts.cancelled+'</small></div></article></div>'};
const appointmentRowMarkup=(record,index)=>'<tr><td><div class="preview-appointment-customer"><span class="avatar">'+esc((record.customerDisplayName||'客').slice(0,1))+'</span><div class="preview-appointment-customer-main"><button class="link" data-action="preview-appointment-record" data-appointment-index="'+index+'">'+esc(record.customerDisplayName)+'</button><div class="meta preview-appointment-code">预约 · '+appointmentDisplayCode(record.appointmentId)+'</div></div></div></td><td><b>'+esc(appointmentDateTime(record.scheduledAt))+'</b></td><td><div class="preview-appointment-project" title="'+esc(record.project)+'">'+esc(record.project)+'</div></td><td>'+tag(APPOINTMENT_STATUS_LABELS[record.status],appointmentStatusTone(record.status))+'</td><td>'+esc(appointmentDateTime(record.updatedAt))+'</td><td><button class="link" data-action="preview-appointment-record" data-appointment-index="'+index+'">查看</button></td></tr>';
const renderAppointmentListRuntime=()=>{if(state.route!=='/appointments')return;const page=document.querySelector('#page');if(!page)return;const info=appointmentListRuntime.pageInfo;const signature=[appointmentListRuntime.loading,appointmentListRuntime.error,appointmentListRuntime.page,appointmentListRuntime.pageSize,appointmentListRuntime.expanded,appointmentListRuntime.status||'',appointmentListRuntime.keyword||'',appointmentListRuntime.startDate,appointmentListRuntime.endDate,info?.total,info?.pageCount,appointmentListRuntime.summary?.total,appointmentListRuntime.records.map(record=>[record.appointmentId,record.customerDisplayName,record.project,record.status,record.updatedAt].join('~')).join('|')].join(':');if(page.dataset.appointmentRuntimeSignature===signature&&page.querySelector('.preview-appointment-runtime-card'))return;page.dataset.appointmentRuntimeSignature=signature;let body='';if(appointmentListRuntime.loading&&!info)body='<section class="card preview-appointment-runtime-card"><div class="preview-customer-table-state"><div><b>正在读取真实预约</b><span>通过正式 Appointment Reader 读取当前机构预约主档。</span></div></div></section>';else if(appointmentListRuntime.error&&!info)body='<section class="card preview-appointment-runtime-card"><div class="preview-customer-table-state"><div><b>真实预约暂不可用</b><span>'+esc(appointmentListRuntime.error)+'</span><br><button class="btn primary" data-action="preview-appointment-retry">重新加载</button></div></div></section>';else if(info){const rows=appointmentListRuntime.records.length?appointmentListRuntime.records.map(appointmentRowMarkup).join(''):'<tr><td colspan="6"><div class="preview-customer-table-state"><div><b>当前筛选暂无预约记录</b><span>结果来自当前机构正式预约主档，不补入原型 Demo。</span></div></div></td></tr>';const previousDisabled=info.page<=1?' disabled':'';const nextDisabled=info.page>=info.pageCount?' disabled':'';body='<section class="card table-card preview-appointment-runtime-card"><div class="preview-customer-table-scroll'+(appointmentListRuntime.expanded?' is-expanded':'')+'"><table class="table"><thead><tr><th>客户 / 预约编号</th><th>预约时间</th><th>预约项目</th><th>业务状态</th><th>最近更新</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-foot"><span class="preview-customer-page-status">共 '+info.total+' 条 · 第 '+(info.pageCount?info.page:0)+' / '+info.pageCount+' 页 · 本页 '+appointmentListRuntime.records.length+' 条</span><div class="preview-customer-page-tools"><label class="preview-customer-page-size">每页显示<select data-appointment-page-size aria-label="预约每页显示条数">'+appointmentPageSizeOptions(info.pageSize)+'</select></label><button class="btn small" data-action="preview-appointment-card-toggle" aria-expanded="'+appointmentListRuntime.expanded+'">'+ico('arrow')+(appointmentListRuntime.expanded?' 收起表格':' 展开表格')+'</button><div class="pages"><button class="pagebtn preview-appointment-pagebtn" data-action="preview-appointment-page" data-page="'+(info.page-1)+'" aria-label="上一页"'+previousDisabled+'>'+ico('back')+'</button>'+appointmentPageButtons(info)+'<button class="pagebtn preview-appointment-pagebtn" data-action="preview-appointment-page" data-page="'+(info.page+1)+'" aria-label="下一页"'+nextDisabled+'>'+ico('arrow')+'</button></div></div></div></section>'}const statusLabel=appointmentListRuntime.status?APPOINTMENT_STATUS_LABELS[appointmentListRuntime.status]:'全部状态';const dateLabel=appointmentListRuntime.startDate&&appointmentListRuntime.endDate?dateRangeLabel(appointmentListRuntime.startDate,appointmentListRuntime.endDate):'选择已到日期';page.innerHTML=ph('预约管理','查看当前机构真实预约主档，支持按状态、日期、客户名称和预约项目筛选。','<button class="btn primary" disabled aria-disabled="true">'+ico('plus')+' 新建预约（请使用正式页面）</button>')+appointmentSummaryMarkup()+'<div class="preview-real-segment-source">'+ico('database')+'<span><b>数据来源：正式 Appointment Reader</b><br>客户名称、预约项目、状态、时间、汇总和分页均来自当前 tenantId + institutionId；手机号、病历号、备注和 HIS 载荷不进入列表。</span></div><div class="toolbar"><div class="views"><button class="active">列表</button><button disabled aria-disabled="true">日历（资源排班未接入）</button></div><span class="spacer"></span>'+tag('预约只读 Capability 已授权','green')+tag('HIS 写入未在此页执行','orange')+'</div><section class="card preview-appointment-status-tabs">'+appointmentStatusTabs()+'</section><section class="card filters preview-appointment-filters"><div class="filter"><label class="label">当前状态</label><button class="selectlike" disabled>'+esc(statusLabel)+'</button></div><div class="filter"><label class="label">日期范围</label><button class="selectlike" data-action="date-picker" data-target="appointment-range">'+ico('calendar')+' <span class="preview-date-trigger-label">'+esc(dateLabel)+'</span> '+ico('arrow')+'</button></div><div class="filter grow"><label class="label">客户 / 预约项目</label><input class="input" data-appointment-keyword maxlength="80" value="'+esc(appointmentListRuntime.keyword)+'" placeholder="输入客户名称或预约项目"></div><button class="btn primary preview-appointment-filter-action" data-action="preview-appointment-query">查询</button></section><div class="preview-appointment-filter-note">筛选在服务端执行；未来日期不可选。客户和项目来自正式预约主档，资源排班与 HIS 同步明细尚未结构化接入。</div>'+body};
const validAppointmentRecord=record=>record&&record.contractVersion==='v1'&&typeof record.appointmentId==='string'&&typeof record.customerDisplayName==='string'&&record.customerDisplayName.length>0&&record.customerDisplayName.length<=120&&typeof record.project==='string'&&record.project.length>0&&record.project.length<=160&&Object.hasOwn(APPOINTMENT_STATUS_LABELS,record.status)&&typeof record.scheduledAt==='string'&&Number.isFinite(Date.parse(record.scheduledAt))&&typeof record.updatedAt==='string'&&Number.isFinite(Date.parse(record.updatedAt));
const validAppointmentSummary=summary=>{if(!summary||!Number.isInteger(summary.total)||summary.total<0||!summary.statusCounts)return false;let total=0;for(const status of Object.keys(APPOINTMENT_STATUS_LABELS)){const count=summary.statusCounts[status];if(!Number.isInteger(count)||count<0)return false;total+=count}return total===summary.total};
const loadAppointmentList=async(page=appointmentListRuntime.page,pageSize=appointmentListRuntime.pageSize)=>{if(state.route!=='/appointments'||!APPOINTMENT_LIST_PAGE_SIZES.includes(pageSize)||!Number.isInteger(page)||page<1||page>APPOINTMENT_LIST_MAX_PAGE)return;const requestToken=appointmentListRuntime.requestToken+1;const key=appointmentRequestKey(page,pageSize);appointmentListRuntime={...appointmentListRuntime,page,pageSize,loading:true,error:'',requestKey:key,requestToken};renderAppointmentListRuntime();try{const signal=globalThis.AbortSignal?.timeout?.(8000);const response=await fetch(appointmentListUrl(page,pageSize),{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}const info=result?.pageInfo;const summary=result?.summary;const expectedPageCount=info?.total===0?0:Math.min(APPOINTMENT_LIST_MAX_PAGE,Math.ceil(info?.total/pageSize));const expectedFilteredTotal=appointmentListRuntime.status?summary?.statusCounts?.[appointmentListRuntime.status]:summary?.total;if(!response.ok||!Array.isArray(result?.records)||!result.records.every(validAppointmentRecord)||!validAppointmentSummary(summary)||!info||info.page!==page||info.pageSize!==pageSize||!Number.isInteger(info.total)||info.total<0||!Number.isInteger(info.pageCount)||info.pageCount<0||info.pageCount!==expectedPageCount||typeof info.hasMore!=='boolean'||info.total!==expectedFilteredTotal)throw new Error('服务端未返回有效预约列表');if(requestToken!==appointmentListRuntime.requestToken)return;if(info.pageCount>0&&page>info.pageCount){void loadAppointmentList(info.pageCount,pageSize);return}appointmentListRuntime={...appointmentListRuntime,page:info.page,pageSize:info.pageSize,records:result.records,pageInfo:info,summary,loading:false,error:'',requestKey:key,requestToken};renderAppointmentListRuntime()}catch{if(requestToken!==appointmentListRuntime.requestToken)return;appointmentListRuntime={...appointmentListRuntime,loading:false,error:'请刷新后重试；未回退到原型 Demo 预约。',requestToken};renderAppointmentListRuntime()}};
const hydrateAppointmentListRuntime=()=>{if(state.route!=='/appointments')return;const stored=readStoredDateRange('appointment-range');const today=toIsoDate(new Date());const startDate=stored.start&&stored.end&&stored.end<=today?stored.start:'';const endDate=stored.start&&stored.end&&stored.end<=today?stored.end:'';if(startDate!==appointmentListRuntime.startDate||endDate!==appointmentListRuntime.endDate)appointmentListRuntime={...appointmentListRuntime,page:1,records:[],pageInfo:null,summary:null,error:'',requestKey:'',startDate,endDate};renderAppointmentListRuntime();const key=appointmentRequestKey(appointmentListRuntime.page,appointmentListRuntime.pageSize);if(!appointmentListRuntime.loading&&(!appointmentListRuntime.pageInfo||appointmentListRuntime.requestKey!==key))void loadAppointmentList(appointmentListRuntime.page,appointmentListRuntime.pageSize)};
const decorateAppointmentDateClear=()=>{if(state.route!=='/appointments'||!appointmentListRuntime.startDate)return;const trigger=document.querySelector('button[data-target="appointment-range"]');if(!trigger||trigger.parentElement?.querySelector('[data-action="preview-appointment-date-clear"]'))return;const clear=document.createElement('button');clear.type='button';clear.className='btn small';clear.dataset.action='preview-appointment-date-clear';clear.textContent='清除日期';trigger.insertAdjacentElement('afterend',clear)};
const selectAppointmentStatus=element=>{const status=element.dataset.status||null;if(status&&!Object.hasOwn(APPOINTMENT_STATUS_LABELS,status))return;appointmentListRuntime={...appointmentListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',status};void loadAppointmentList(1,appointmentListRuntime.pageSize)};
const queryAppointments=()=>{const input=document.querySelector('[data-appointment-keyword]');const keyword=String(input?.value||'').trim();if(keyword.length>80){toast('客户或项目关键词不能超过 80 个字符');return}appointmentListRuntime={...appointmentListRuntime,page:1,records:[],pageInfo:null,summary:null,error:'',requestKey:'',keyword};void loadAppointmentList(1,appointmentListRuntime.pageSize)};
const openAppointmentRuntimeRecord=element=>{const record=appointmentListRuntime.records[Number(element.dataset.appointmentIndex)];if(!record)return;openDrawer(record.customerDisplayName,'<div class="detail"><div class="drow"><span class="dkey">预约编号</span><b>预约 · '+appointmentDisplayCode(record.appointmentId)+'</b></div><div class="drow"><span class="dkey">客户</span><b>'+esc(record.customerDisplayName)+'</b></div><div class="drow"><span class="dkey">预约项目</span><b>'+esc(record.project)+'</b></div><div class="drow"><span class="dkey">预约时间</span><b>'+esc(appointmentDateTime(record.scheduledAt))+'</b></div><div class="drow"><span class="dkey">业务状态</span><b>'+esc(APPOINTMENT_STATUS_LABELS[record.status])+'</b></div><div class="drow"><span class="dkey">最近更新</span><b>'+esc(appointmentDateTime(record.updatedAt))+'</b></div></div><div class="rule">数据来自当前机构正式预约主档；手机号、病历号、备注、资源排班和 HIS 载荷未进入此列表。修改或取消必须继续经过现有 Appointment 命令。</div>',btn('关闭',{action:'close-overlays'}),true)};
const validFollowUpRecord=record=>record&&typeof record.taskId==='string'&&record.customer&&typeof record.customer.displayName==='string'&&record.customer.displayName.length>0&&record.customer.displayName.length<=120&&(record.customer.maskedReference===null||typeof record.customer.maskedReference==='string')&&Object.hasOwn(FOLLOW_UP_STATE_LABELS,record.state)&&typeof record.dueAt==='string'&&Number.isFinite(Date.parse(record.dueAt))&&typeof record.updatedAt==='string'&&Number.isFinite(Date.parse(record.updatedAt))&&(record.riskLevel==='none'||record.riskLevel==='high')&&record.assignment&&(record.assignment.kind==='role_pool'&&typeof record.assignment.role==='string'||record.assignment.kind==='user'&&typeof record.assignment.displayName==='string');
const followUpMatchesKeyword=record=>{const keyword=followUpListRuntime.keyword.trim().toLocaleLowerCase('zh-CN');return!keyword||[record.customer.displayName,record.customer.maskedReference,FOLLOW_UP_STATE_LABELS[record.state]].some(value=>String(value||'').toLocaleLowerCase('zh-CN').includes(keyword))};
const followUpFilteredRecords=()=>followUpListRuntime.records.filter(record=>(!followUpListRuntime.state||record.state===followUpListRuntime.state)&&followUpMatchesKeyword(record));
const followUpStateCount=stateValue=>followUpListRuntime.records.filter(record=>(!stateValue||record.state===stateValue)&&followUpMatchesKeyword(record)).length;
const followUpStateTabs=()=>[['','全部'],...Object.entries(FOLLOW_UP_STATE_LABELS)].map(item=>'<button class="ctab'+((followUpListRuntime.state||'')===item[0]?' active':'')+'" data-action="preview-followup-state" data-state="'+item[0]+'">'+item[1]+' <span class="count">'+followUpStateCount(item[0])+'</span></button>').join('');
const followUpAssignmentLabel=assignment=>assignment.kind==='user'?assignment.displayName:({customer_service:'客服角色池',consultant:'咨询师角色池',tenant_operator:'运营角色池',tenant_admin:'管理员角色池'}[assignment.role]||'机构角色池');
const followUpStateTone=stateValue=>stateValue==='completed'?'green':stateValue==='cancelled'||stateValue==='escalated'?'red':stateValue==='pending'?'orange':'blue';
const followUpPageButtons=(page,pageCount)=>{const numbers=customerPageNumbers(page,pageCount);let previous=0;let markup='';for(const value of numbers){if(previous&&value-previous>1)markup+='<span class="muted">…</span>';markup+='<button class="pagebtn preview-followup-pagebtn'+(value===page?' active':'')+'" data-action="preview-followup-page" data-page="'+value+'" aria-label="随访第 '+value+' 页" aria-current="'+(value===page?'page':'false')+'">'+value+'</button>';previous=value}return markup};
const followUpPageSizeOptions=pageSize=>FOLLOW_UP_LIST_PAGE_SIZES.map(value=>'<option value="'+value+'"'+(value===pageSize?' selected':'')+'>'+value+' 条</option>').join('');
const followUpRowMarkup=(record,index)=>'<tr><td><div class="preview-followup-customer"><span class="avatar">'+esc(record.customer.displayName.slice(0,1))+'</span><div class="preview-followup-customer-main"><button class="link" data-action="preview-followup-record" data-followup-index="'+index+'">'+esc(record.customer.displayName)+'</button><div class="meta">'+esc(record.customer.maskedReference||('客户 · '+customerIdTail(record.customer.customerId)))+'</div></div></div></td><td><b>人工随访</b><div class="meta">人工联系</div></td><td>'+esc(appointmentDateTime(record.dueAt))+'</td><td>'+esc(followUpAssignmentLabel(record.assignment))+'</td><td>'+tag(FOLLOW_UP_STATE_LABELS[record.state],followUpStateTone(record.state))+'</td><td>'+tag('未接入消息投影')+'</td><td>'+tag(record.riskLevel==='high'?'高':'无',record.riskLevel==='high'?'red':'green')+'</td><td><button class="link" data-action="preview-followup-record" data-followup-index="'+index+'">查看</button></td></tr>';
const renderFollowUpListRuntime=()=>{if(state.route!=='/followups')return;const page=document.querySelector('#page');if(!page)return;const filtered=followUpFilteredRecords();const pageCount=filtered.length?Math.ceil(filtered.length/followUpListRuntime.pageSize):0;const safePage=pageCount?Math.min(followUpListRuntime.page,pageCount):1;const start=(safePage-1)*followUpListRuntime.pageSize;const visible=filtered.slice(start,start+followUpListRuntime.pageSize);const signature=[followUpListRuntime.loading,followUpListRuntime.error,safePage,followUpListRuntime.pageSize,followUpListRuntime.expanded,followUpListRuntime.state||'',followUpListRuntime.keyword,followUpListRuntime.hasMore,followUpListRuntime.records.map(record=>[record.taskId,record.state,record.updatedAt].join('~')).join('|')].join(':');if(page.dataset.followUpRuntimeSignature===signature&&page.querySelector('.preview-followup-runtime-card'))return;page.dataset.followUpRuntimeSignature=signature;let body='';if(followUpListRuntime.loading&&!followUpListRuntime.records.length)body='<section class="card preview-followup-runtime-card"><div class="preview-customer-table-state"><div><b>正在读取真实随访任务</b><span>通过正式 Follow-up API 读取当前机构可见任务。</span></div></div></section>';else if(followUpListRuntime.error&&!followUpListRuntime.records.length)body='<section class="card preview-followup-runtime-card"><div class="preview-customer-table-state"><div><b>真实随访任务暂不可用</b><span>'+esc(followUpListRuntime.error)+'</span><br><button class="btn primary" data-action="preview-followup-retry">重新加载</button></div></div></section>';else{const rows=visible.length?visible.map(record=>followUpRowMarkup(record,followUpListRuntime.records.indexOf(record))).join(''):'<tr><td colspan="8"><div class="preview-customer-table-state"><div><b>当前筛选暂无随访任务</b><span>未补入任何原型 Demo 任务。</span></div></div></td></tr>';const previousDisabled=safePage<=1?' disabled':'';const nextDisabled=safePage>=pageCount?' disabled':'';body='<section class="card table-card preview-followup-runtime-card"><div class="preview-customer-table-scroll'+(followUpListRuntime.expanded?' is-expanded':'')+'"><table class="table"><thead><tr><th>客户</th><th>任务类型</th><th>计划时间</th><th>分配</th><th>任务状态</th><th>消息状态</th><th>风险</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="table-foot"><span class="preview-customer-page-status">已读取 '+followUpListRuntime.records.length+(followUpListRuntime.hasMore?' 条以上':' 条')+' · 当前筛选 '+filtered.length+' 条 · 第 '+(pageCount?safePage:0)+' / '+pageCount+' 页</span><div class="preview-customer-page-tools"><label class="preview-customer-page-size">每页显示<select data-followup-page-size aria-label="随访每页显示条数">'+followUpPageSizeOptions(followUpListRuntime.pageSize)+'</select></label><button class="btn small" data-action="preview-followup-card-toggle" aria-expanded="'+followUpListRuntime.expanded+'">'+ico('arrow')+(followUpListRuntime.expanded?' 收起表格':' 展开表格')+'</button><div class="pages"><button class="pagebtn preview-followup-pagebtn" data-action="preview-followup-page" data-page="'+(safePage-1)+'" aria-label="上一页"'+previousDisabled+'>'+ico('back')+'</button>'+(pageCount?followUpPageButtons(safePage,pageCount):'')+'<button class="pagebtn preview-followup-pagebtn" data-action="preview-followup-page" data-page="'+(safePage+1)+'" aria-label="下一页"'+nextDisabled+'>'+ico('arrow')+'</button></div></div></div></section>'}const filters='<section class="card filters preview-followup-filters"><div class="filter grow"><label class="label">客户 / 状态</label><input class="input" data-followup-keyword value="'+esc(followUpListRuntime.keyword)+'" placeholder="客户名称、脱敏编号或任务状态"></div><div class="filter-actions"><button class="btn primary" data-action="preview-followup-query">查询</button></div></section><div class="preview-followup-read-limit">筛选在正式 Reader 已返回的当前机构任务中执行；消息状态、渠道、项目和随访方案未进入该 API，因此不使用原型 Demo 值。'+(followUpListRuntime.hasMore?' 当前 API 仍有更多记录，待正式游标分页开放后继续读取。':'')+'</div>';page.innerHTML=ph('随访管理','查看当前机构正式人工随访任务；任务状态与消息状态继续分离。','<button class="btn primary" disabled aria-disabled="true">'+ico('plus')+' 新建随访（请使用正式页面）</button>')+'<div class="preview-real-segment-source">'+ico('database')+'<span><b>数据来源：正式 Follow-up API</b><br>仅显示当前 tenantId + institutionId 与成员可见性规则允许的任务；不展示任何原型演示统计。</span></div><section class="card preview-followup-status-tabs"><div class="component-tabs">'+followUpStateTabs()+'</div></section>'+filters+body};
const loadFollowUpList=async()=>{if(state.route!=='/followups')return;const requestToken=followUpListRuntime.requestToken+1;followUpListRuntime={...followUpListRuntime,loading:true,error:'',requestKey:'current-institution',requestToken};renderFollowUpListRuntime();try{const signal=globalThis.AbortSignal?.timeout?.(8000);const response=await fetch('/api/v1/institution/followups',{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}if(!response.ok||result?.kind!=='ready'||!Array.isArray(result.records)||!result.records.every(validFollowUpRecord)||typeof result.hasMore!=='boolean')throw new Error('服务端未返回有效随访任务');if(requestToken!==followUpListRuntime.requestToken)return;followUpListRuntime={...followUpListRuntime,page:1,records:result.records,hasMore:result.hasMore,loading:false,error:'',requestKey:'current-institution',requestToken};renderFollowUpListRuntime()}catch{if(requestToken!==followUpListRuntime.requestToken)return;followUpListRuntime={...followUpListRuntime,loading:false,error:'请刷新后重试；未回退到原型 Demo 随访。',requestToken};renderFollowUpListRuntime()}};
const hydrateFollowUpListRuntime=()=>{if(state.route!=='/followups')return;renderFollowUpListRuntime();if(!followUpListRuntime.loading&&followUpListRuntime.requestKey!=='current-institution')void loadFollowUpList()};
const selectFollowUpState=element=>{const stateValue=element.dataset.state||null;if(stateValue&&!Object.hasOwn(FOLLOW_UP_STATE_LABELS,stateValue))return;followUpListRuntime={...followUpListRuntime,page:1,state:stateValue};renderFollowUpListRuntime()};
const queryFollowUps=()=>{const keyword=String(document.querySelector('[data-followup-keyword]')?.value||'').trim();if(keyword.length>80){toast('随访关键词不能超过 80 个字符');return}followUpListRuntime={...followUpListRuntime,page:1,keyword};renderFollowUpListRuntime()};
const openFollowUpRuntimeRecord=element=>{const record=followUpListRuntime.records[Number(element.dataset.followupIndex)];if(!record)return;openDrawer(record.customer.displayName,'<div class="detail"><div class="drow"><span class="dkey">客户</span><b>'+esc(record.customer.displayName)+'</b></div><div class="drow"><span class="dkey">对象标识</span><b>'+esc(record.customer.maskedReference||('客户 · '+customerIdTail(record.customer.customerId)))+'</b></div><div class="drow"><span class="dkey">任务类型</span><b>人工随访 · 人工联系</b></div><div class="drow"><span class="dkey">计划时间</span><b>'+esc(appointmentDateTime(record.dueAt))+'</b></div><div class="drow"><span class="dkey">任务状态</span><b>'+esc(FOLLOW_UP_STATE_LABELS[record.state])+'</b></div><div class="drow"><span class="dkey">分配</span><b>'+esc(followUpAssignmentLabel(record.assignment))+'</b></div><div class="drow"><span class="dkey">风险</span><b>'+(record.riskLevel==='high'?'高风险':'无已记录风险')+'</b></div><div class="drow"><span class="dkey">最近更新</span><b>'+esc(appointmentDateTime(record.updatedAt))+'</b></div></div><div class="rule">数据来自正式 Follow-up Domain；消息发送、微信渠道、项目和方案字段未进入此列表。执行状态变更必须继续经过现有受控命令。</div>',btn('关闭',{action:'close-overlays'}),true)};
const workbenchMetricMarkup=(label,value,detail,icon,tone='blue')=>'<article class="kpi"><div class="kicon '+tone+'">'+ico(icon)+'</div><div><div class="klabel">'+esc(label)+'</div><div class="kvalue">'+esc(String(value))+'</div><div class="kdelta">'+esc(detail)+'</div></div></article>';
const workbenchActionRows=()=>{const appointmentActions=workbenchRuntime.appointments.filter(record=>record.status==='pending_confirmation'||record.status==='reschedule_requested').slice(0,3).map(record=>({kind:'预约',tone:'orange',title:record.customerDisplayName+' · '+record.project,meta:APPOINTMENT_STATUS_LABELS[record.status]+' · '+appointmentDateTime(record.scheduledAt),route:'/appointments'}));const followUpActions=workbenchRuntime.followUps.filter(record=>record.state==='pending'||record.state==='in_progress'||record.state==='waiting_customer'||record.state==='escalated').slice(0,3).map(record=>({kind:'随访',tone:record.state==='escalated'?'red':'cyan',title:record.customer.displayName+' · '+FOLLOW_UP_STATE_LABELS[record.state],meta:'计划 '+appointmentDateTime(record.dueAt),route:'/followups'}));return[...followUpActions,...appointmentActions].sort((left,right)=>left.meta.localeCompare(right.meta)).slice(0,6)};
const workbenchActionMarkup=()=>{const rows=workbenchActionRows();return rows.length?rows.map(item=>'<div class="list-row"><span>'+tag(item.kind,item.tone)+'</span><div class="grow"><div class="list-title">'+esc(item.title)+'</div><div class="list-meta">'+esc(item.meta)+'</div></div><button class="link" data-route="'+item.route+'">查看</button></div>').join(''):'<div class="preview-workbench-unavailable"><div><b>当前没有需要处理的已授权记录</b><span>这是真实空状态，没有补入原型行动队列。</span></div></div>'};
const workbenchTodayMarkup=()=>{const today=toIsoDate(new Date());const rows=workbenchRuntime.appointments.filter(record=>toIsoDate(new Date(record.scheduledAt))===today).slice(0,6);return rows.length?rows.map(record=>'<div class="list-row" data-appt><span class="appointment-status-dot" data-status="'+esc(APPOINTMENT_STATUS_LABELS[record.status])+'"></span><b>'+esc(new Date(record.scheduledAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}))+'</b><span class="avatar">'+esc(record.customerDisplayName.slice(0,1))+'</span><div class="grow"><div class="list-title">'+esc(record.customerDisplayName+' · '+record.project)+'</div><div class="list-meta">'+esc(APPOINTMENT_STATUS_LABELS[record.status])+'</div></div></div>').join(''):'<div class="preview-workbench-unavailable"><div><b>今日没有已授权预约</b><span>预约数据来自正式 Appointment Reader。</span></div></div>'};
const workbenchCustomerDynamicsMarkup=()=>workbenchRuntime.customers.length?workbenchRuntime.customers.slice(0,6).map(record=>'<div class="list-row"><span class="avatar">'+esc(record.displayName.slice(0,1))+'</span><div class="grow"><div class="list-title">'+esc(record.displayName)+'</div><div class="list-meta">'+esc(CUSTOMER_LIFECYCLE_LABELS[record.lifecycle]||'状态未知')+' · 更新 '+esc(customerUpdatedAt(record.updatedAt))+'</div></div></div>').join(''):'<div class="preview-workbench-unavailable"><div><b>当前机构暂无客户记录</b><span>没有使用原型客户名单。</span></div></div>';
const renderWorkbenchRuntime=()=>{if(state.route!=='/workbench')return;const page=document.querySelector('#page');if(!page)return;const signature=[workbenchRuntime.loading,workbenchRuntime.error,workbenchRuntime.customerInfo?.total,workbenchRuntime.appointmentSummary?.total,workbenchRuntime.followUpHasMore,workbenchRuntime.highPriorityTotal,workbenchRuntime.customers.map(record=>record.customerId).join('|'),workbenchRuntime.appointments.map(record=>record.appointmentId).join('|'),workbenchRuntime.followUps.map(record=>[record.taskId,record.state,record.updatedAt].join('~')).join('|')].join(':');if(page.dataset.workbenchRuntimeSignature===signature&&page.querySelector('.preview-workbench-runtime'))return;page.dataset.workbenchRuntimeSignature=signature;if(workbenchRuntime.loading&&!workbenchRuntime.customerInfo){page.innerHTML=ph('工作台','正在读取当前机构正式业务数据。','')+'<section class="card preview-workbench-runtime"><div class="preview-customer-table-state"><div><b>正在加载真实工作台</b><span>组合正式 Customer、Appointment 与 Follow-up 只读结果。</span></div></div></section>';return}if(workbenchRuntime.error&&!workbenchRuntime.customerInfo){page.innerHTML=ph('工作台','正式数据暂不可用，未回退到原型 Demo。','')+'<section class="card preview-workbench-runtime"><div class="preview-customer-table-state"><div><b>真实工作台加载失败</b><span>'+esc(workbenchRuntime.error)+'</span><br><button class="btn primary" data-action="preview-workbench-retry">重新加载</button></div></div></section>';return}if(!workbenchRuntime.customerInfo||!workbenchRuntime.appointmentSummary)return;const appointmentCounts=workbenchRuntime.appointmentSummary.statusCounts;const activeFollowUps=workbenchRuntime.followUps.filter(record=>!['completed','cancelled'].includes(record.state)).length;const escalatedFollowUps=workbenchRuntime.followUps.filter(record=>record.state==='escalated').length;const metrics='<div class="kpis">'+workbenchMetricMarkup('客户总数',workbenchRuntime.customerInfo.total,'正式客户主档','users')+workbenchMetricMarkup('预约总数',workbenchRuntime.appointmentSummary.total,'正式预约主档','calendar','orange')+workbenchMetricMarkup('待确认预约',appointmentCounts.pending_confirmation,'需要机构人员确认','clock','orange')+workbenchMetricMarkup('活跃随访',activeFollowUps,workbenchRuntime.followUpHasMore?'已读取前 100 条':'正式任务范围','heart','purple')+workbenchMetricMarkup('高优先级客户',workbenchRuntime.highPriorityTotal,'客户主档优先级','users','red')+workbenchMetricMarkup('风险升级',escalatedFollowUps,'正式随访风险事件','warning','red')+'</div>';const riskRows='<div class="list-row"><div class="grow"><div class="list-title">高优先级客户</div><div class="list-meta">正式 Customer Reader</div></div><b>'+workbenchRuntime.highPriorityTotal+'</b></div><div class="list-row"><div class="grow"><div class="list-title">待确认预约</div><div class="list-meta">正式 Appointment Reader</div></div><b>'+appointmentCounts.pending_confirmation+'</b></div><div class="list-row"><div class="grow"><div class="list-title">风险升级随访</div><div class="list-meta">正式 Follow-up API</div></div><b>'+escalatedFollowUps+'</b></div>';page.innerHTML=ph('工作台','以下数据来自当前机构正式只读能力；无法验证的经营指标不会显示 Demo 数字。','<button class="btn" data-action="preview-workbench-retry">'+ico('refresh')+' 刷新数据</button>')+'<div class="preview-real-segment-source preview-workbench-source">'+ico('database')+'<span><b>真实数据范围</b><br>Customer、Appointment 与 Follow-up 均经过当前 tenantId + institutionId 和成员可见性校验；不使用任何原型固定数据。</span></div><div class="preview-workbench-runtime">'+metrics+'<div class="grid2"><section class="card preview-workbench-list"><div class="card-head"><h2>我的待处理</h2><button class="link" data-route="/followups">查看随访</button></div><div class="card-body">'+workbenchActionMarkup()+'</div></section><section class="card preview-workbench-list"><div class="card-head"><h2>今日安排</h2><button class="link" data-route="/appointments">查看预约</button></div><div class="card-body">'+workbenchTodayMarkup()+'</div></section></div><div class="grid3"><section class="card preview-workbench-list"><div class="card-head"><h2>风险与机会</h2></div><div class="card-body">'+riskRows+'</div></section><section class="card preview-workbench-list"><div class="card-head"><h2>客户动态</h2><button class="link" data-route="/customers/list">查看客户</button></div><div class="card-body">'+workbenchCustomerDynamicsMarkup()+'</div></section><section class="card"><div class="card-head"><h2>近期业务趋势</h2></div><div class="preview-workbench-unavailable"><div><b>正式 Analytics 聚合尚未开放</b><span>不使用原型折线与转化率；数据模型开放后再展示趋势。</span></div></div></section></div></div>'};
const loadWorkbenchRuntime=async()=>{if(state.route!=='/workbench')return;const requestToken=workbenchRuntime.requestToken+1;workbenchRuntime={...workbenchRuntime,loading:true,error:'',requestKey:'current-institution',requestToken};renderWorkbenchRuntime();try{const signal=globalThis.AbortSignal?.timeout?.(8000);const request=async url=>{const response=await fetch(url,{credentials:'same-origin',headers:{accept:'application/json'},...(signal?{signal}:{})});let result=null;try{result=await response.json()}catch{}if(!response.ok)throw new Error('reader_unavailable');return result};const[customers,appointments,followUps,highPriority]=await Promise.all([request(customerListUrl(1,10,null,null)),request('/api/v1/institution/appointments?page=1&pageSize=100'),request('/api/v1/institution/followups'),request(customerListUrl(1,10,null,'high'))]);const customerInfo=customers?.pageInfo;const highPriorityInfo=highPriority?.pageInfo;if(!Array.isArray(customers?.records)||!customers.records.every(validCustomerRecord)||!customerInfo||customerInfo.page!==1||customerInfo.pageSize!==10||!Number.isInteger(customerInfo.total)||customerInfo.total<0||!Array.isArray(appointments?.records)||!appointments.records.every(validAppointmentRecord)||!validAppointmentSummary(appointments.summary)||appointments?.pageInfo?.page!==1||appointments?.pageInfo?.pageSize!==100||followUps?.kind!=='ready'||!Array.isArray(followUps.records)||!followUps.records.every(validFollowUpRecord)||typeof followUps.hasMore!=='boolean'||!highPriorityInfo||!Number.isInteger(highPriorityInfo.total)||highPriorityInfo.total<0)throw new Error('invalid_reader_result');if(requestToken!==workbenchRuntime.requestToken)return;workbenchRuntime={customers:customers.records,customerInfo,appointments:appointments.records,appointmentSummary:appointments.summary,followUps:followUps.records,followUpHasMore:followUps.hasMore,highPriorityTotal:highPriorityInfo.total,loading:false,error:'',requestKey:'current-institution',requestToken};renderWorkbenchRuntime()}catch{if(requestToken!==workbenchRuntime.requestToken)return;workbenchRuntime={...workbenchRuntime,loading:false,error:'请刷新后重试；工作台没有回退到原型 Demo。',requestToken};renderWorkbenchRuntime()}};
const hydrateWorkbenchRuntime=()=>{if(state.route!=='/workbench')return;renderWorkbenchRuntime();if(!workbenchRuntime.loading&&workbenchRuntime.requestKey!=='current-institution')void loadWorkbenchRuntime()};
const clarifyCustomerListDataSource=()=>{if(state.route!=='/customers/list')return;const page=document.querySelector('#page');const status=page?.querySelector('.status-banner');if(status&&!status.dataset.customerRuntimeSource){status.dataset.customerRuntimeSource='true';status.innerHTML=ico('database')+'<span>客户表格、分页、快捷筛选与高级筛选来自当前本地开发数据库的正式 Customer Reader；不返回手机号等敏感字段。</span>'}const scope=status?.nextElementSibling;if(scope?.classList.contains('card')&&!scope.dataset.customerRuntimeScope){scope.dataset.customerRuntimeScope='true';scope.innerHTML=ico('shield')+'<span>当前仅显示登录账号有权访问的 tenantId + institutionId 客户主档；未接入正式投影的条件不会伪装成可用筛选。</span><span class="spacer"></span>'+tag('范围已校验','green')}decorateCustomerFilterRuntime()};
const openCustomerRuntimeRecord=element=>{const record=customerListRuntime.records[Number(element.dataset.customerIndex)];if(!record)return;openDrawer(record.displayName,'<div class="detail"><div class="drow"><span class="dkey">对象标识</span><b>客户 · '+customerIdTail(record.customerId)+'</b></div><div class="drow"><span class="dkey">客户阶段</span><b>'+esc(CUSTOMER_LIFECYCLE_LABELS[record.lifecycle])+'</b></div><div class="drow"><span class="dkey">优先级</span><b>'+esc(CUSTOMER_PRIORITY_LABELS[record.priority])+'</b></div><div class="drow"><span class="dkey">最近更新</span><b>'+esc(customerUpdatedAt(record.updatedAt))+'</b></div></div><div class="rule">当前仅展示正式 Reader 已授权返回的低敏字段；手机号、微信、负责人和业务载荷均未读取。</div>',btn('关闭',{action:'close-overlays'}),true)};
const customerImportSummaryMarkup=summary=>'<div class="validation"><div class="vbox"><div class="sub">客户</div><div class="v">'+summary.customers+'</div></div><div class="vbox"><div class="sub">预约记录</div><div class="v">'+summary.appointments+'</div></div><div class="vbox"><div class="sub">治疗记录</div><div class="v">'+summary.treatments+'</div></div><div class="vbox"><div class="sub">消费记录</div><div class="v">'+summary.consumptions+'</div></div></div>';
const customerImportErrorMessage=result=>({customer_import_local_only:'仅允许登录后的本地开发库执行导入',customer_import_unavailable:'本地导入服务暂不可用，请确认 Migration 与本地数据库状态',customer_import_file_already_completed:'该文件已经成功导入，不能重复写入',customer_import_transaction_rejected:'导入事务未完成：可能存在重复外部编号或客户主档冲突，数据库已整体回滚',csrf_validation_failed:'请求来源校验失败，请刷新页面后重试',invalid_customer_import_file:'请选择系统标准 .xlsx 模板'}[result?.code]||'导入校验失败，请检查文件后重试');
const customerDuplicateGuidanceMarkup='<div class="preview-import-boundary-list"><div class="preview-import-boundary-item"><span>'+ico('shield')+'</span><span><b>强匹配：外部客户编号、HIS 患者 ID 或身份证一致</b>不要作为新客户导入；先核对目标主档。</span></div><div class="preview-import-boundary-item"><span>'+ico('users')+'</span><span><b>疑似匹配：手机号一致，且姓名或出生日期一致</b>需要人工确认；手机号相同但姓名冲突时禁止自动合并。</span></div><div class="preview-import-boundary-item"><span>'+ico('database')+'</span><span><b>字段合并原则</b>身份字段只补缺失且冲突时人工选择；来源和备注追加保留证据；预约、治疗和消费按各自外部记录编号去重后追加。</span></div><div class="rule">当前导入器不会自动覆盖或合并已有客户；冲突会阻断并整体回滚。请不要为同一人临时编造新外部编号。</div></div>';
const openCustomerDuplicateGuidance=()=>openModal('重复客户处理规则',customerDuplicateGuidanceMarkup,btn('关闭',{action:'close-overlays'}),'large');
const customerImportFailureStage=result=>({transaction:'事务初始化',quota:'配额检查',batch:'导入批次',customers:'客户主档',appointments:'预约记录',treatments:'治疗记录',analytics:'消费记录',row_evidence:'导入审计行',audit_attribution:'审计归属校验',audit_event:'审计事件构建',audit_insert:'审计事件写入'}[result?.stage]||'');
const showCustomerImportFailure=result=>{const issues=Array.isArray(result?.issues)?result.issues:[];const rows=issues.length?'<section class="card table-card"><table class="table"><thead><tr><th>Sheet</th><th>行</th><th>字段</th><th>问题</th></tr></thead><tbody>'+issues.map(issue=>'<tr><td>'+esc(issue.sheet||'—')+'</td><td>'+esc(String(issue.row||'—'))+'</td><td>'+esc(issue.field||'—')+'</td><td>'+esc(issue.code||'validation_failed')+'</td></tr>').join('')+'</tbody></table></section>':'';const stage=customerImportFailureStage(result);const duplicateGuide=result?.code==='customer_import_transaction_rejected'?customerDuplicateGuidanceMarkup:'';openModal('Excel导入校验未通过','<div class="preview-import-boundary"><div>'+tag('未写入数据库','red')+'</div><h2>'+esc(customerImportErrorMessage(result))+'</h2>'+(stage?'<div class="rule">失败阶段：'+esc(stage)+'。数据库事务已整体回滚。</div>':'')+rows+duplicateGuide+'<div class="rule">校验或事务失败时不会产生部分客户、预约、治疗或消费记录。</div></div>',btn('关闭',{action:'close-overlays'})+btn('重新选择文件',{cls:'primary',action:'choose-import-file'}),'large')};
const customerImportHistoryTime=value=>{const instant=new Date(value);return Number.isFinite(instant.getTime())?instant.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'时间不可用'};
const openCustomerImportHistory=async()=>{openDrawer('Excel导入记录','<div class="empty"><div><h3>正在读取真实导入记录…</h3></div></div>');try{const response=await fetch('/api/institution/customers/import',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'}});const result=await response.json();if(!response.ok||result?.kind!=='ready')throw new Error('history_unavailable');const records=Array.isArray(result.records)?result.records:[];const content=records.length?records.map(record=>{const summary=record.summary||{};return '<div class="list-row"><div class="grow"><div class="list-title">客户数据导入 · '+esc(customerImportHistoryTime(record.completedAt))+'</div><div class="list-meta">客户 '+esc(String(summary.customers??0))+' · 预约 '+esc(String(summary.appointments??0))+' · 治疗 '+esc(String(summary.treatments??0))+' · 消费 '+esc(String(summary.consumptions??0))+'</div></div>'+tag('已完成','green')+'</div>'}).join(''):'<div class="empty"><div><h3>暂无真实导入记录</h3><p>成功完成数据库事务后，导入批次会显示在这里。</p></div></div>';openDrawer('Excel导入记录',content)}catch{openDrawer('Excel导入记录','<div class="empty"><div><h3>真实导入记录暂不可用</h3><p>未展示原型静态记录，请稍后重试。</p></div></div>')}};
const requestCustomerImport=async method=>{if(!customerImportFile||customerImportBusy)return null;customerImportBusy=true;try{const body=new FormData();body.append('file',customerImportFile,customerImportFile.name);const response=await fetch('/api/institution/customers/import',{method,body,credentials:'same-origin'});let result=null;try{result=await response.json()}catch{}if(!response.ok||result?.kind!=='ready'){showCustomerImportFailure(result);return null}return result}catch{showCustomerImportFailure({code:'customer_import_unavailable'});return null}finally{customerImportBusy=false}};
const previewCustomerImport=async()=>{const result=await requestCustomerImport('POST');if(!result)return;customerImportPreview=result;customerImportCompleted=null;state.importStep=3;importWizard();requestAnimationFrame(decorate)};
const executeCustomerImport=async trigger=>{if(trigger){trigger.disabled=true;trigger.textContent='正在导入…'}const result=await requestCustomerImport('PUT');if(!result){if(trigger?.isConnected){trigger.disabled=false;trigger.textContent='确认导入'}return}customerImportCompleted=result;state.importStep=6;importWizard();requestAnimationFrame(decorate)};
const decorateCustomerImportRuntime=()=>{const summary=customerImportCompleted?.summary||customerImportPreview?.summary;if(!summary||state.importStep<3)return;const body=document.querySelector('#modal .modal-body');const stepper=body?.querySelector('.stepper');if(!body||!stepper)return;const signature=[state.importStep,summary.customers,summary.appointments,summary.treatments,summary.consumptions,summary.totalRows].join(':');if(body.dataset.customerImportRuntimeSignature===signature)return;body.dataset.customerImportRuntimeSignature=signature;while(stepper.nextSibling)stepper.nextSibling.remove();let content='';if(state.importStep===3)content='<section class="card table-card"><table class="table"><thead><tr><th>Excel Sheet</th><th>系统对象</th><th>校验方式</th><th>状态</th></tr></thead><tbody>'+[['客户基本信息','Customer Master'],['预约记录','Appointment'],['治疗记录','Treatment Summary'],['消费记录','Analytics Consumption Fact']].map(item=>'<tr><td>'+item[0]+'</td><td>'+item[1]+'</td><td>标准模板精确映射</td><td>'+tag('已映射','green')+'</td></tr>').join('')+'</tbody></table></section><div class="rule">手机号、身份证号和外部患者 ID 采用服务端加密存储；客户主档只保存脱敏展示值。</div>';if(state.importStep===4)content=customerImportSummaryMarkup(summary)+'<section class="card" style="padding:16px"><div class="list-row"><div class="grow"><div class="list-title">模板、字段、日期、状态及跨 Sheet 关联</div><div class="list-meta">共 '+summary.totalRows+' 行，全部通过服务端校验</div></div>'+tag('通过','green')+'</div></section>';if(state.importStep===5)content=customerImportSummaryMarkup(summary)+'<div class="preview-import-boundary-list"><div class="preview-import-boundary-item"><span>'+ico('database')+'</span><span><b>写入本地开发库</b>确认后客户、预约、治疗和消费记录将在同一事务内写入。</span></div><div class="preview-import-boundary-item"><span>'+ico('shield')+'</span><span><b>重复不会自动合并</b>同一文件、外部编号或客户主档冲突会阻断导入并整体回滚。</span></div><button class="btn" data-action="preview-import-duplicate-guide">查看重复匹配与字段合并规则</button></div>';if(state.importStep===6)content='<div class="empty" style="min-height:300px"><div><div style="font-size:48px;color:var(--green)">'+ico('check')+'</div><h2>导入已完成</h2><p>本地开发库已写入 '+summary.customers+' 个客户、'+summary.appointments+' 条预约、'+summary.treatments+' 条治疗和 '+summary.consumptions+' 条消费记录。</p><div style="display:flex;gap:8px;justify-content:center"><button class="btn" data-action="import-log">查看导入记录</button><button class="btn primary" data-action="finish-import">返回客户列表</button></div></div></div>';body.insertAdjacentHTML('beforeend',content)};
const openBatchSegment=()=>openDrawer('批量加入客户分群','<div class="preview-choice-list"><label class="preview-choice"><input type="checkbox" checked><span><b>术后随访客户</b>当前筛选结果中满足随访条件的客户</span></label><label class="preview-choice"><input type="checkbox"><span><b>高价值复诊客户</b>最近 90 天有治疗记录且待复诊</span></label><label class="preview-choice"><input type="checkbox"><span><b>微信未匹配客户</b>渠道身份尚未完成确认</span></label></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('确认加入',{cls:'primary',action:'preview-confirm-batch-segment'}));
const openNewSegment=()=>openDrawer('新建客户分群','<div class="preview-form two-columns"><div><label class="label">分群名称</label><input class="input" style="width:100%" value="新建动态分群"></div><div><label class="label">更新方式</label><select class="select" style="width:100%"><option>每天自动更新</option><option>手动更新</option></select></div><div style="grid-column:1/-1"><label class="label">客户条件</label><div class="preview-check-grid"><label class="preview-choice"><input type="checkbox" checked><span><b>当前随访为进行中</b>统一 Follow-up Projection</span></label><label class="preview-choice"><input type="checkbox"><span><b>风险等级为高</b>客户主档可见事实</span></label><label class="preview-choice"><input type="checkbox"><span><b>微信身份已匹配</b>渠道身份映射结果</span></label><label class="preview-choice"><input type="checkbox"><span><b>最近 90 天未到店</b>授权范围内的到店记录</span></label></div></div></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('保存草稿',{cls:'primary',action:'preview-save-segment'}),true);
const openNewOpportunity=()=>openDrawer('新建经营机会','<div class="preview-form"><div><label class="label">客户</label><input class="input" style="width:100%" placeholder="搜索已授权客户"></div><div><label class="label">机会类型</label><select class="select" style="width:100%"><option>建议复诊</option><option>客户关怀</option><option>复购机会</option></select></div><div><label class="label">判断依据</label><textarea class="input" style="width:100%;min-height:92px" placeholder="填写可审计的业务事实"></textarea></div><div><label class="label">负责人</label><select class="select" style="width:100%"><option>admin</option><option>李小美</option><option>王玉</option></select></div></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('保存机会',{cls:'primary',action:'preview-save-opportunity'}));
const openNewMember=()=>openDrawer('新增机构成员','<div class="preview-form two-columns"><div><label class="label">登录账号</label><input class="input" style="width:100%" placeholder="输入账号"></div><div><label class="label">显示名称</label><input class="input" style="width:100%" placeholder="输入成员名称"></div><div><label class="label">机构角色</label><select class="select" style="width:100%"><option>客户顾问</option><option>随访专员</option><option>机构管理员</option></select></div><div><label class="label">数据范围</label><select class="select" style="width:100%"><option>本人客户</option><option>本人及团队客户</option><option>全部数据</option></select></div></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('保存成员',{cls:'primary',action:'preview-save-member'}));
const openConversationAttachment=kind=>openModal('添加'+kind,'<div class="dropzone"><div><div style="font-size:34px">'+ico(kind==='图片'?'image':'document')+'</div><h3>选择'+kind+'文件</h3><p class="sub">文件仅用于本地交互预览，不上传、不发送。</p><input id="preview-attachment-input" type="file" '+(kind==='图片'?'accept="image/*"':'')+'></div></div><div id="preview-attachment-name" class="preview-attachment-name">尚未选择文件</div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('加入输入区',{cls:'primary',action:'preview-insert-attachment'}),'large');
const openPhrases=()=>openSmall('<button class="pop-item" data-action="preview-insert-phrase" data-text="您好，已收到您的消息，我们会尽快为您处理。"><span class="grow"><b>通用确认</b><div class="meta">确认已收到客户消息</div></span></button><button class="pop-item" data-action="preview-insert-phrase" data-text="您好，请问您方便的到店日期和时间是？"><span class="grow"><b>预约时间</b><div class="meta">询问客户可到店时间</div></span></button><button class="pop-item" data-action="preview-insert-phrase" data-text="您好，想了解一下您目前的恢复情况，是否有红肿、疼痛或其他不适？"><span class="grow"><b>术后随访</b><div class="meta">标准恢复情况询问</div></span></button>','bottom:150px;left:43%');
const openPlanTrigger=()=>openDrawer('编辑触发与适用范围','<div class="preview-form"><div><label class="label">触发事件</label><select class="select" style="width:100%"><option>治疗完成</option><option>预约到店</option><option>人工创建</option></select></div><div><label class="label">适用项目</label><input class="input" style="width:100%" value="当前方案项目"></div><div><label class="label">终止条件</label><div class="preview-check-grid"><label class="preview-choice"><input type="checkbox" checked><span><b>客户拒绝联系</b></span></label><label class="preview-choice"><input type="checkbox" checked><span><b>人工终止</b></span></label><label class="preview-choice"><input type="checkbox" checked><span><b>严重投诉</b></span></label></div></div><div><label class="label">主动触达频控</label><select class="select" style="width:100%"><option>同一客户每天最多 1 次</option><option>同一客户每周最多 3 次</option></select></div></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('保存到草稿',{cls:'primary',action:'preview-save-plan-trigger'}),true);
const openCustomerEdit=()=>{const id=(state.route.split('/').pop()||'c001');const current=customer(id);openDrawer('编辑客户主档','<div class="preview-form two-columns"><div><label class="label">客户姓名</label><input class="input" style="width:100%" value="'+esc(current.name)+'"></div><div><label class="label">负责人</label><select class="select" style="width:100%"><option>'+esc(current.advisor)+'</option></select></div><div><label class="label">客户分层</label><select class="select" style="width:100%"><option>'+esc(current.level)+'</option><option>A 核心客户</option><option>B 重点客户</option><option>C 普通客户</option></select></div><div><label class="label">风险等级</label><select class="select" style="width:100%"><option>'+esc(current.risk)+'</option><option>低</option><option>中</option><option>高</option></select></div></div>'+localOnly,btn('取消',{action:'close-overlays'})+btn('保存修改',{cls:'primary',action:'preview-save-customer'}));};
const openCustomerEvidence=()=>{const id=(state.route.split('/').pop()||'c001');const current=customer(id);openDrawer('客户来源证据','<div class="detail"><div class="drow"><span class="dkey">Canonical ID</span><b>'+esc(current.id)+'</b></div><div class="drow"><span class="dkey">主数据来源</span><b>'+esc(current.source)+'</b></div><div class="drow"><span class="dkey">外部记录</span><b>'+esc(current.external)+'</b></div><div class="drow"><span class="dkey">微信匹配</span><b>'+(current.channel.matched?'已确认':'待确认')+'</b></div><div class="drow"><span class="dkey">最近同步</span><b>'+esc(DATA.institution.updated)+'</b></div></div><div class="rule">此处只展示原型内已脱敏的来源映射与证据摘要，不展示凭证、Token 或数据库连接信息。</div>',btn('关闭',{action:'close-overlays'}));};
const openCustomerMerge=()=>openModal('合并客户','<div class="rule">合并必须由 Customer Canonical Owner 执行并保留来源证据。当前预览只展示确认流程，不执行真实合并。</div><div class="preview-form" style="margin-top:12px"><div><label class="label">目标客户</label><input class="input" style="width:100%" placeholder="按脱敏 ID 搜索目标客户"></div><label class="preview-choice"><input type="checkbox"><span><b>我已核对两个主档的身份与来源证据</b>正式环境仍需服务端权限与租户校验</span></label></div>',btn('取消',{action:'close-overlays'})+btn('预览合并结果',{cls:'primary',action:'preview-confirm-customer-merge'}));
const showImportWarnings=()=>openDrawer('导入警告与重复边界','<div class="list-row"><div class="grow"><div class="list-title">非必填字段</div><div class="list-meta">仅以本次服务端预检实际返回的警告为准，不再显示原型固定数量。</div></div>'+tag('按实返回','orange')+'</div><div class="list-row"><div class="grow"><div class="list-title">重复客户</div><div class="list-meta">当前正式导入器不提供逐行候选或自动合并；同一文件、外部编号或主档冲突会阻断并整体回滚。</div></div>'+tag('需人工核对','orange')+'</div>'+customerDuplicateGuidanceMarkup+localOnly,btn('关闭',{action:'close-overlays'}));
const showImportErrors=()=>openDrawer('导入错误明细','<div class="list-row"><div class="grow"><div class="list-title">手机号格式错误</div><div class="list-meta">8 条 · 已脱敏</div></div>'+tag('错误','red')+'</div><div class="list-row"><div class="grow"><div class="list-title">找不到关联客户</div><div class="list-meta">4 条 · 已脱敏</div></div>'+tag('错误','red')+'</div>'+localOnly,btn('关闭',{action:'close-overlays'})+btn('下载脱敏明细',{cls:'primary',action:'preview-download-import-errors'}));
const downloadText=(name,content,type='text/plain;charset=utf-8')=>{const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const exportVisibleTable=()=>{const rows=[...document.querySelectorAll('.table tr')].filter(row=>row.offsetParent!==null).map(row=>[...row.children].map(cell=>'"'+(cell.textContent||'').replace(/\s+/g,' ').trim().replace(/"/g,'""')+'"').join(','));if(!rows.length){toast('当前页面没有可导出的表格');return}downloadText('institution-preview-export.csv','\ufeff'+rows.join('\n'),'text/csv;charset=utf-8');toast('已导出当前可见的脱敏预览数据')};
const applyLocalFilter=trigger=>{const filters=trigger.closest('.filters');if(!filters){toast('筛选条件已应用');return}const controls=[...filters.querySelectorAll('input,select')];const terms=controls.map(control=>(control.value||'').trim()).filter(value=>value&&!/^全部|^选择/.test(value));const rows=[...document.querySelectorAll('.table tbody tr')];let shown=0;rows.forEach(row=>{const hit=terms.every(term=>(row.textContent||'').toLowerCase().includes(term.toLowerCase()));row.hidden=!hit;if(hit)shown+=1});let status=filters.nextElementSibling;if(!status?.classList.contains('preview-filter-state')){status=document.createElement('div');status.className='preview-filter-state';filters.insertAdjacentElement('afterend',status)}status.innerHTML='<span>'+ico('filter')+'</span><span>已应用当前页面筛选：<b>'+(terms.length?terms.map(esc).join(' · '):'全部')+'</b>，当前显示 '+shown+' 条预览记录。</span>';};
const changePage=element=>{const pages=element.closest('.pages');if(!pages)return;pages.querySelectorAll('.pagebtn').forEach(button=>button.classList.toggle('active',button===element));const foot=pages.closest('.table-foot');let stateLabel=foot.querySelector('.preview-pagination-state');if(!stateLabel){stateLabel=document.createElement('span');stateLabel.className='preview-pagination-state';pages.before(stateLabel)}stateLabel.textContent='第 '+textOf(element)+' 页';toast('已切换到第 '+textOf(element)+' 页')};
const renderCalendar=delta=>{calendarCursor.month+=delta;while(calendarCursor.month<0){calendarCursor.month+=12;calendarCursor.year-=1}while(calendarCursor.month>11){calendarCursor.month-=12;calendarCursor.year+=1}const shell=document.querySelector('#modal .calendar-shell');if(!shell)return;const head=shell.querySelector('.calendar-head b');if(head)head.textContent=calendarCursor.year+'年'+(calendarCursor.month+1)+'月';const grid=shell.querySelector('.day-grid');if(!grid)return;const first=(new Date(calendarCursor.year,calendarCursor.month,1).getDay()+6)%7;const days=new Date(calendarCursor.year,calendarCursor.month+1,0).getDate();const today=toIsoDate(new Date());let html='';for(let i=0;i<42;i+=1){const day=i-first+1;if(day<1||day>days){html+='<button class="day muted-day" disabled></button>';continue}const date=calendarCursor.year+'-'+String(calendarCursor.month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');const future=date>today;html+='<button class="day'+(future?' future':'')+'"'+(future?' disabled aria-disabled="true"':' data-action="preview-choose-calendar-day" data-target="'+esc(shell.dataset.previewTarget||'generic')+'" data-date="'+date+'"')+' aria-label="'+date+(future?'，尚未到达，不可选择':'')+'">'+day+'</button>'}grid.innerHTML=html;};
const toIsoDate=value=>value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');
const fromIsoDate=value=>{const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):null};
const shiftDate=(value,days)=>{const next=new Date(value.getFullYear(),value.getMonth(),value.getDate());next.setDate(next.getDate()+days);return next};
const readStoredDateRange=target=>{const value=String(state.dateSelection[target]||'');const dates=value.match(/\d{4}-\d{2}-\d{2}/g)||[];return{start:dates[0]||'',end:dates[1]||dates[0]||''}};
const dateTargetFor=(action,element)=>action==='date-menu'?'workbench-period':action==='analytics-period'?'analytics-period':action==='strategy-calendar'?'strategy-month':element.dataset.target||'generic';
const dateRangeLabel=(start,end)=>!start?'选择日期范围':!end||start===end?start:start+' 至 '+end;
const monthPanel=(year,month,side)=>{const first=new Date(year,month,1);const offset=first.getDay();const gridStart=new Date(year,month,1-offset);const today=toIsoDate(new Date());let days='';for(let index=0;index<42;index+=1){const value=shiftDate(gridStart,index);const iso=toIsoDate(value);const outside=value.getMonth()!==month;const future=iso>today;const isStart=!outside&&!future&&iso===datePickerDraft.start;const isEnd=!outside&&!future&&iso===datePickerDraft.end;const inRange=!outside&&!future&&datePickerDraft.start&&datePickerDraft.end&&iso>datePickerDraft.start&&iso<datePickerDraft.end;days+='<button class="preview-date-day'+(outside?' outside':'')+(future?' future':'')+(isStart?' is-start':'')+(isEnd?' is-end':'')+(inRange?' in-range':'')+(!outside&&iso===today?' today':'')+'"'+(future?' disabled aria-disabled="true"':' data-action="preview-date-day" data-date="'+iso+'"')+' aria-label="'+year+'年'+(month+1)+'月'+value.getDate()+'日'+(future?'，尚未到达，不可选择':'')+'" aria-pressed="'+(isStart||isEnd?'true':'false')+'">'+value.getDate()+'</button>'}const back=ico('back'),next=ico('arrow');const before=side==='left'?'<div class="preview-month-nav"><button class="preview-date-nav double" data-action="preview-date-prev-year" aria-label="上一年">'+back+back+'</button><button class="preview-date-nav" data-action="preview-date-prev-month" aria-label="上个月">'+back+'</button></div>':'<div></div>';const after=side==='right'?'<div class="preview-month-nav end"><button class="preview-date-nav" data-action="preview-date-next-month" aria-label="下个月">'+next+'</button><button class="preview-date-nav double" data-action="preview-date-next-year" aria-label="下一年">'+next+next+'</button></div>':'<div></div>';return '<section class="preview-month-panel" data-preview-month="'+year+'-'+String(month+1).padStart(2,'0')+'"><div class="preview-month-head">'+before+'<div class="preview-month-title">'+year+' 年 '+(month+1)+' 月</div>'+after+'</div><div class="preview-weekdays">'+['日','一','二','三','四','五','六'].map(day=>'<span>'+day+'</span>').join('')+'</div><div class="preview-date-grid">'+days+'</div></section>'};
const datePickerMarkup=()=>{const nextMonth=new Date(datePickerDraft.year,datePickerDraft.month+1,1);const startClass=datePickerDraft.start?' has-value':'';const endClass=datePickerDraft.end?' has-value':'';return '<div class="preview-date-range-picker" role="dialog" aria-label="选择日期范围"><div class="preview-date-entry">'+ico('calendar')+'<span class="preview-date-entry-value'+startClass+'">'+(datePickerDraft.start||'开始日期')+'</span><span class="preview-date-entry-separator">至</span><span class="preview-date-entry-value'+endClass+'">'+(datePickerDraft.end||'结束日期')+'</span><div class="preview-date-quick"><button data-action="preview-date-quick" data-range="today">今天</button><button data-action="preview-date-quick" data-range="7">近7天</button><button data-action="preview-date-quick" data-range="30">近30天</button><button data-action="preview-date-quick" data-range="month">本月</button></div></div><div class="preview-calendar-panes">'+monthPanel(datePickerDraft.year,datePickerDraft.month,'left')+monthPanel(nextMonth.getFullYear(),nextMonth.getMonth(),'right')+'</div><div class="preview-date-foot"><div class="preview-date-status">'+(datePickerDraft.start?'<b>'+dateRangeLabel(datePickerDraft.start,datePickerDraft.end)+'</b>':datePickerDraft.phase==='end'?'请选择结束日期':'请选择开始日期')+'<span> · 尚未到达的日期已禁用</span></div>'+btn('取消',{action:'close-overlays'})+btn('应用',{cls:'primary',action:'preview-date-apply'})+'</div></div>'};
const renderUnifiedDatePicker=()=>{const picker=document.querySelector('.preview-date-range-picker');if(picker)picker.outerHTML=datePickerMarkup()};
const moveDatePickerMonth=delta=>{datePickerDraft.month+=delta;while(datePickerDraft.month<0){datePickerDraft.month+=12;datePickerDraft.year-=1}while(datePickerDraft.month>11){datePickerDraft.month-=12;datePickerDraft.year+=1}renderUnifiedDatePicker()};
const openUnifiedDatePicker=(element,target)=>{const stored=readStoredDateRange(target);const today=toIsoDate(new Date());const hasFutureDate=stored.start>today||stored.end>today;if(hasFutureDate){delete state.dateSelection[target];setDateTriggerLabel(element,target==='appointment-range'?'选择已到日期':'选择日期范围')}const safeStart=hasFutureDate?'':stored.start;const safeEnd=hasFutureDate?'':stored.end;const seed=fromIsoDate(safeStart)||new Date();datePickerDraft={target,start:safeStart,end:safeEnd,phase:safeStart&&!safeEnd?'end':'start',year:seed.getFullYear(),month:seed.getMonth()};const rect=element.getBoundingClientRect();const width=Math.min(840,Math.max(620,window.innerWidth-32));const left=Math.max(16,Math.min(rect.left,window.innerWidth-width-16));const top=Math.max(12,Math.min(rect.bottom+8,window.innerHeight-548));openSmall(datePickerMarkup(),'top:'+top+'px;left:'+left+'px;width:'+width+'px')};
const chooseDateDay=value=>{const today=toIsoDate(new Date());if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>today){toast('尚未到达的日期不可选择');return}if(datePickerDraft.phase==='start'||!datePickerDraft.start||datePickerDraft.end){datePickerDraft.start=value;datePickerDraft.end='';datePickerDraft.phase='end'}else{if(value<datePickerDraft.start){datePickerDraft.end=datePickerDraft.start;datePickerDraft.start=value}else datePickerDraft.end=value;datePickerDraft.phase='start'}renderUnifiedDatePicker()};
const chooseDateQuick=range=>{const today=new Date();let start=today,end=today;if(range==='7')start=shiftDate(today,-6);if(range==='30')start=shiftDate(today,-29);if(range==='month')start=new Date(today.getFullYear(),today.getMonth(),1);datePickerDraft.start=toIsoDate(start);datePickerDraft.end=toIsoDate(end);datePickerDraft.phase='start';datePickerDraft.year=start.getFullYear();datePickerDraft.month=start.getMonth();renderUnifiedDatePicker()};
const applyUnifiedDatePicker=()=>{const today=toIsoDate(new Date());if(!datePickerDraft.start){toast('请先选择开始日期');return}if(datePickerDraft.start>today||datePickerDraft.end>today){toast('尚未到达的日期不可选择');return}if(!datePickerDraft.end)datePickerDraft.end=datePickerDraft.start;state.dateSelection[datePickerDraft.target]=dateRangeLabel(datePickerDraft.start,datePickerDraft.end);if(datePickerDraft.target==='customer-created-range'){const popover=document.querySelector('#popover');if(popover)popover.innerHTML='';const trigger=document.querySelector('#drawer [data-target="customer-created-range"]');setDateTriggerLabel(trigger,state.dateSelection[datePickerDraft.target]);toast('客户创建时间已选择，应用筛选后查询');return}closeAll();toast('日期范围已应用：'+state.dateSelection[datePickerDraft.target]);if(datePickerDraft.target==='appointment-range'){appointmentListRuntime={...appointmentListRuntime,page:1,records:[],pageInfo:null,summary:null,error:'',requestKey:'',startDate:datePickerDraft.start,endDate:datePickerDraft.end};void loadAppointmentList(1,appointmentListRuntime.pageSize);return}render()};
const setDateTriggerLabel=(button,label)=>{if(!label)return;let holder=button.querySelector('.preview-date-trigger-label');if(!holder){const textNode=[...button.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());if(!textNode)return;holder=document.createElement('span');holder.className='preview-date-trigger-label';textNode.replaceWith(holder)}if(holder.textContent!==label)holder.textContent=label};
const applyNodeOffset=()=>{const modal=document.querySelector('#modal .modal');const range=modal?.querySelector('input[type="range"]');const unit=modal?.querySelector('select');const anchor=modal?.querySelector('select[data-preview-node-anchor]');if(!range||!unit)return;const planId=state.route.split('/').pop();const currentPlan=plan(planId);const nodeId=state.planNodes[planId]||currentPlan.nodes[0].id;const node=currentPlan.nodes.find(item=>item.id===nodeId);if(node)node.offset='+'+range.value+(unit.value==='小时'?'小时':unit.value==='周'?'周':'天');closeAll();toast((anchor?.value||'治疗完成后')+'的相对执行时间已更新');render();};
const connectorTest=element=>{const id=element.dataset.id;const item=DATA.connectors.find(connector=>connector.id===id);openModal((item?.name||'连接器')+'能力测试','<div class="preview-choice-list"><div class="preview-choice"><span><b>机构授权</b>已读取当前原型中的授权状态</span></div><div class="preview-choice"><span><b>配置完整性</b>只检查页面内低敏配置，不读取 Secret</span></div><div class="preview-choice"><span><b>外部连通性</b>未执行，真实外部连接保持关闭</span></div></div>'+localOnly,btn('关闭',{action:'close-overlays'}));};
const controlledSync=element=>openModal('受控同步确认','<p style="margin-top:0">将按当前 Connector 的授权状态创建一次同步意图预览。</p><div class="rule">当前不会连接数据库、HIS、企业微信或个人微信，也不会写入任何业务数据。</div>',btn('取消',{action:'close-overlays'})+btn('确认预览',{cls:'primary',action:'preview-confirm-sync',attrs:'data-id="'+esc(element.dataset.id||'')+'"'}));
const decorate=()=>{
document.querySelectorAll('.pagebtn:not(.preview-customer-pagebtn):not(.preview-opportunity-pagebtn):not(.preview-appointment-pagebtn):not(.preview-followup-pagebtn)').forEach(button=>{button.dataset.action='preview-page'});
document.querySelectorAll('[data-action="date-menu"],[data-action="date-picker"],[data-action="analytics-period"],[data-action="strategy-calendar"]').forEach(button=>{const target=dateTargetFor(button.dataset.action,button);const stored=readStoredDateRange(target);const today=toIsoDate(new Date());if(stored.start>today||stored.end>today)delete state.dateSelection[target];button.setAttribute('aria-haspopup','dialog');setDateTriggerLabel(button,state.dateSelection[target]||(target==='appointment-range'?'选择已到日期':''))});
document.querySelectorAll('.toolbar .btn').forEach(button=>{if(textOf(button)==='批量分群')setAction(button,'preview-batch-segment')});
document.querySelectorAll('.compose-tools .btn').forEach(button=>{const label=textOf(button);if(label==='图片')setAction(button,'preview-compose-image');if(label==='文件')setAction(button,'preview-compose-file');if(label==='话术')setAction(button,'preview-compose-phrase')});
document.querySelectorAll('.dpanel .dbody>.btn').forEach(button=>{if(textOf(button)==='编辑触发条件')setAction(button,'preview-edit-plan-trigger')});
document.querySelectorAll('#popover .pop-item').forEach(button=>{const label=textOf(button);if(label==='编辑客户')setAction(button,'preview-edit-customer');if(label==='查看来源证据')setAction(button,'preview-customer-evidence');if(label==='合并客户')setAction(button,'preview-merge-customer')});
document.querySelectorAll('#modal .calendar-shell').forEach(shell=>{if(!shell.dataset.previewTarget){const action=shell.querySelector('.day[data-target]');shell.dataset.previewTarget=action?.dataset.target||'generic';const title=shell.querySelector('.calendar-head b')?.textContent||'';const match=title.match(/(\d{4})年(\d{1,2})月/);if(match)calendarCursor={year:Number(match[1]),month:Number(match[2])-1}}const buttons=shell.querySelectorAll('.calendar-head button');if(buttons[0])buttons[0].dataset.action='preview-calendar-prev';if(buttons[1])buttons[1].dataset.action='preview-calendar-next'});
document.querySelectorAll('#modal .link').forEach(link=>{const label=textOf(link);if(label==='查看')setAction(link,'preview-import-warnings');if(label==='下载错误明细')setAction(link,'preview-import-errors')});
if(state.importStep===2){ensureCustomerImportInput();const dropzone=document.querySelector('#modal [data-action="choose-import-file"]');if(dropzone){dropzone.classList.add('preview-import-dropzone');dropzone.setAttribute('role','button');dropzone.setAttribute('tabindex','0');dropzone.setAttribute('aria-label','选择客户数据 Excel 文件');const heading=dropzone.querySelector('h3');const description=dropzone.querySelector('p.sub');const status=dropzone.querySelector('.tag');setTextIfChanged(heading,customerImportFile?customerImportFile.name:'点击选择或拖入 Excel 文件');setTextIfChanged(description,customerImportFile?'已选择 '+formatFileSize(customerImportFile.size)+'；文件仅保留在当前浏览器内存中。':'仅支持 Approved 模板 .xlsx，单文件最大 10 MB。');setTextIfChanged(status,'文件已选择，等待正式解析');if(!dropzone.dataset.previewImportBound){dropzone.dataset.previewImportBound='true';dropzone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCustomerImportFilePicker()}});dropzone.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('is-dragging')});dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragging'));dropzone.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('is-dragging');const file=event.dataTransfer?.files?.[0];if(file)void acceptCustomerImportFile(file)})}}}
decorateCustomerImportRuntime();
if(state.importStep===5)document.querySelectorAll('#modal button').forEach(button=>{const label=textOf(button);if(label==='合并到现有客户'||label==='作为新客户'||label==='暂不处理'){button.dataset.action='preview-import-duplicate-guide';button.disabled=true;button.setAttribute('aria-disabled','true');button.title='当前正式导入器未开放自动合并或覆盖写入'}});
document.querySelectorAll('#modal .range-row').forEach(row=>{const anchor=row.querySelector('button.selectlike');if(anchor){const select=document.createElement('select');select.className='select';select.dataset.previewNodeAnchor='true';select.innerHTML='<option>治疗完成后</option><option>预约到店后</option><option>随访任务创建后</option>';anchor.replaceWith(select)}const modal=row.closest('.modal');modal?.querySelectorAll('.modal-foot button').forEach(button=>{if(textOf(button)==='应用')button.dataset.action='preview-apply-node-offset'})});
const attachment=document.querySelector('#preview-attachment-input');if(attachment&&!attachment.dataset.previewBound){attachment.dataset.previewBound='true';attachment.addEventListener('change',()=>{pendingAttachment=attachment.files?.[0]?.name||'';const output=document.querySelector('#preview-attachment-name');if(output)output.textContent=pendingAttachment||'尚未选择文件'})}
clarifyCustomerListDataSource();
hydrateWorkbenchRuntime();
hydrateCustomerListRuntime();
hydrateCustomerSegmentsRuntime();
hydrateCustomerOpportunitiesRuntime();
hydrateAppointmentListRuntime();
hydrateFollowUpListRuntime();
hydratePublishedKnowledge();
document.querySelectorAll('[data-appointment-keyword]').forEach(input=>{if(input.dataset.previewAppointmentQueryBound)return;input.dataset.previewAppointmentQueryBound='true';input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();queryAppointments()}})});
document.querySelectorAll('[data-followup-keyword]').forEach(input=>{if(input.dataset.previewFollowUpQueryBound)return;input.dataset.previewFollowUpQueryBound='true';input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();queryFollowUps()}})});
document.querySelectorAll('[data-customer-keyword]').forEach(input=>{if(input.dataset.previewCustomerQueryBound)return;input.dataset.previewCustomerQueryBound='true';input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();queryCustomerList()}})});
decorateAppointmentDateClear();
};
document.addEventListener('change',event=>{const customerSize=event.target.closest?.('[data-customer-page-size]');if(customerSize){const pageSize=Number(customerSize.value);if(CUSTOMER_LIST_PAGE_SIZES.includes(pageSize))void loadCustomerList(1,pageSize);return}const opportunitySize=event.target.closest?.('[data-opportunity-page-size]');if(opportunitySize){const pageSize=Number(opportunitySize.value);if(CUSTOMER_LIST_PAGE_SIZES.includes(pageSize))void loadCustomerOpportunities(1,pageSize);return}const appointmentSize=event.target.closest?.('[data-appointment-page-size]');if(appointmentSize){const pageSize=Number(appointmentSize.value);if(APPOINTMENT_LIST_PAGE_SIZES.includes(pageSize))void loadAppointmentList(1,pageSize);return}const followUpSize=event.target.closest?.('[data-followup-page-size]');if(followUpSize){const pageSize=Number(followUpSize.value);if(FOLLOW_UP_LIST_PAGE_SIZES.includes(pageSize)){followUpListRuntime={...followUpListRuntime,page:1,pageSize};renderFollowUpListRuntime()}}});
globalThis.__institutionV11RefinementAction=(action,element)=>{
if(previousAction?.(action,element))return true;
if(action==='upload-knowledge'){openKnowledgeUpload();return true}
if(action==='preview-knowledge-choose-file'||action==='preview-knowledge-reselect'){chooseKnowledgeUploadFile();return true}
if(action==='preview-knowledge-confirm'){void confirmKnowledgeUpload();return true}
if(action==='preview-knowledge-publish'){void publishKnowledgeUpload();return true}
if(action==='preview-knowledge-finish'){closeAll();toast('知识已发布到当前机构正式知识库');knowledgeDocumentRuntime={loading:false,loaded:false,error:'',records:[]};go('/knowledge');return true}
if(action==='import-log'){void openCustomerImportHistory();return true}
if(action==='import-wizard'){customerImportFile=null;customerImportPreview=null;customerImportCompleted=null;state.importSelected=false;return false}
if(action==='choose-import-file'){openCustomerImportFilePicker();return true}
if(action==='import-next'&&state.importStep===2){if(!customerImportFile){toast('请先选择 Approved 模板 .xlsx 文件');return true}void previewCustomerImport();return true}
if(action==='import-next'&&state.importStep===5){void executeCustomerImport(element);return true}
if(action==='finish-import'&&customerImportCompleted){customerListRuntime={...customerListRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:'',lifecycle:null,priority:null,keyword:'',gender:null,ageBand:null,createdFrom:'',createdTo:'',segmentLabel:''};customerSegmentRuntime={...customerSegmentRuntime,items:[],error:'',requestKey:''};customerOpportunityRuntime={...customerOpportunityRuntime,page:1,records:[],pageInfo:null,error:'',requestKey:''};workbenchRuntime={...workbenchRuntime,customers:[],customerInfo:null,appointments:[],appointmentSummary:null,followUps:[],error:'',requestKey:''};closeAll();toast('本地开发库导入完成');go('/customers/list');return true}
if(action==='preview-batch-segment'){openBatchSegment();return true}
if(action==='preview-confirm-batch-segment'){closeAndToast('已更新本地批量分群预览');return true}
if(action==='new-segment'){openNewSegment();return true}
if(action==='preview-save-segment'){closeAndToast('分群草稿已保存到本地预览状态');return true}
if(action==='new-opportunity'){openNewOpportunity();return true}
if(action==='preview-save-opportunity'){closeAndToast('经营机会已保存到本地预览状态');return true}
if(action==='new-member'){openNewMember();return true}
if(action==='preview-save-member'){closeAndToast('成员配置已保存到本地预览状态');return true}
if(action==='conversation-settings'){state.managementTab='integration';go('/management');return true}
if(action==='preview-compose-image'){pendingAttachment='';openConversationAttachment('图片');return true}
if(action==='preview-compose-file'){pendingAttachment='';openConversationAttachment('文件');return true}
if(action==='preview-insert-attachment'){if(!pendingAttachment){toast('请先选择文件');return true}closeAndToast(pendingAttachment+' 已加入输入区（未上传、未发送）');return true}
if(action==='preview-compose-phrase'){openPhrases();return true}
if(action==='preview-insert-phrase'){closeAll();const input=document.querySelector('#chat-input');if(input){input.value=element.dataset.text||'';input.focus()}return true}
if(action==='preview-edit-plan-trigger'){openPlanTrigger();return true}
if(action==='preview-save-plan-trigger'){closeAndToast('触发条件已保存到方案草稿');return true}
if(action==='preview-edit-customer'){openCustomerEdit();return true}
if(action==='preview-save-customer'){closeAndToast('客户主档修改已保存到本地预览状态');return true}
if(action==='preview-customer-evidence'){openCustomerEvidence();return true}
if(action==='preview-merge-customer'){openCustomerMerge();return true}
if(action==='preview-confirm-customer-merge'){closeAndToast('已生成合并预览；未执行真实合并');return true}
if(action==='preview-import-warnings'){showImportWarnings();return true}
if(action==='preview-import-duplicate-guide'){openCustomerDuplicateGuidance();return true}
if(action==='preview-import-errors'){showImportErrors();return true}
if(action==='preview-download-import-errors'){downloadText('institution-import-errors-redacted.csv','\ufeff错误类型,数量\n手机号格式错误,8\n找不到关联客户,4','text/csv;charset=utf-8');toast('已下载脱敏错误明细');return true}
if(action==='preview-import-merge'||action==='preview-import-new'||action==='preview-import-defer'){openCustomerDuplicateGuidance();return true}
if(action==='advanced-customer-filter'){openFormalCustomerAdvancedFilter();return true}
if(action==='preview-customer-filter-choice'){selectCustomerFilterChoice(element);return true}
if(action==='preview-reset-customer-filters'){resetCustomerFilters();return true}
if(action==='preview-customer-quick'){applyCustomerQuickFilter(element);return true}
if(action==='preview-customer-query'){queryCustomerList();return true}
if(action==='apply-advanced-filter'){applyCustomerAdvancedFilters();return true}
if(action==='preview-remove-customer-filter'){removeCustomerFilter(element);return true}
if(action==='save-customer-view'||action==='confirm-save-customer-view'){toast('保存视图尚无正式持久化契约，本页未执行保存');return true}
if(action==='preview-customer-page'){if(element.disabled)return true;void loadCustomerList(Number(element.dataset.page),customerListRuntime.pageSize);return true}
if(action==='preview-customer-card-toggle'){customerListRuntime={...customerListRuntime,expanded:!customerListRuntime.expanded};renderCustomerListRuntime();return true}
if(action==='preview-customer-retry'){customerListRuntime={...customerListRuntime,pageInfo:null,error:'',requestKey:''};void loadCustomerList(customerListRuntime.page,customerListRuntime.pageSize);return true}
if(action==='preview-customer-record'){openCustomerRuntimeRecord(element);return true}
if(action==='preview-customer-segment'){openCustomerSegment(element);return true}
if(action==='preview-clear-customer-segment'){clearCustomerSegment();return true}
if(action==='preview-customer-segments-retry'){customerSegmentRuntime={...customerSegmentRuntime,items:[],error:'',requestKey:''};void loadCustomerSegments();return true}
if(action==='preview-opportunity-query'){queryCustomerOpportunities();return true}
if(action==='preview-opportunity-page'){if(element.disabled)return true;void loadCustomerOpportunities(Number(element.dataset.page),customerOpportunityRuntime.pageSize);return true}
if(action==='preview-opportunity-card-toggle'){customerOpportunityRuntime={...customerOpportunityRuntime,expanded:!customerOpportunityRuntime.expanded};renderCustomerOpportunitiesRuntime();return true}
if(action==='preview-opportunity-retry'){customerOpportunityRuntime={...customerOpportunityRuntime,records:[],pageInfo:null,error:'',requestKey:''};void loadCustomerOpportunities(customerOpportunityRuntime.page,customerOpportunityRuntime.pageSize);return true}
if(action==='preview-opportunity-record'){openCustomerOpportunityRecord(element);return true}
if(action==='preview-appointment-status'){selectAppointmentStatus(element);return true}
if(action==='preview-appointment-query'){queryAppointments();return true}
if(action==='preview-appointment-date-clear'){delete state.dateSelection['appointment-range'];appointmentListRuntime={...appointmentListRuntime,page:1,records:[],pageInfo:null,summary:null,error:'',requestKey:'',startDate:'',endDate:''};void loadAppointmentList(1,appointmentListRuntime.pageSize);return true}
if(action==='preview-appointment-page'){if(element.disabled)return true;void loadAppointmentList(Number(element.dataset.page),appointmentListRuntime.pageSize);return true}
if(action==='preview-appointment-card-toggle'){appointmentListRuntime={...appointmentListRuntime,expanded:!appointmentListRuntime.expanded};renderAppointmentListRuntime();return true}
if(action==='preview-appointment-retry'){appointmentListRuntime={...appointmentListRuntime,records:[],pageInfo:null,summary:null,error:'',requestKey:''};void loadAppointmentList(appointmentListRuntime.page,appointmentListRuntime.pageSize);return true}
if(action==='preview-appointment-record'){openAppointmentRuntimeRecord(element);return true}
if(action==='preview-followup-state'){selectFollowUpState(element);return true}
if(action==='preview-followup-query'){queryFollowUps();return true}
if(action==='preview-followup-page'){if(element.disabled)return true;const filtered=followUpFilteredRecords();const pageCount=filtered.length?Math.ceil(filtered.length/followUpListRuntime.pageSize):0;const page=Number(element.dataset.page);if(Number.isInteger(page)&&page>=1&&page<=pageCount){followUpListRuntime={...followUpListRuntime,page};renderFollowUpListRuntime()}return true}
if(action==='preview-followup-card-toggle'){followUpListRuntime={...followUpListRuntime,expanded:!followUpListRuntime.expanded};renderFollowUpListRuntime();return true}
if(action==='preview-followup-retry'){followUpListRuntime={...followUpListRuntime,records:[],error:'',requestKey:''};void loadFollowUpList();return true}
if(action==='preview-followup-record'){openFollowUpRuntimeRecord(element);return true}
if(action==='preview-workbench-retry'){workbenchRuntime={...workbenchRuntime,error:'',requestKey:''};void loadWorkbenchRuntime();return true}
if(action==='preview-page'){changePage(element);return true}
if(action==='mock-query'){applyLocalFilter(element);return true}
if(action==='export'){exportVisibleTable();return true}
if(action==='date-menu'||action==='date-picker'||action==='analytics-period'||action==='strategy-calendar'){openUnifiedDatePicker(element,dateTargetFor(action,element));return true}
if(action==='preview-date-prev-year'){moveDatePickerMonth(-12);return true}
if(action==='preview-date-prev-month'){moveDatePickerMonth(-1);return true}
if(action==='preview-date-next-month'){moveDatePickerMonth(1);return true}
if(action==='preview-date-next-year'){moveDatePickerMonth(12);return true}
if(action==='preview-date-day'){chooseDateDay(element.dataset.date||'');return true}
if(action==='preview-date-quick'){chooseDateQuick(element.dataset.range||'today');return true}
if(action==='preview-date-apply'){applyUnifiedDatePicker();return true}
if(action==='preview-calendar-prev'){renderCalendar(-1);return true}
if(action==='preview-calendar-next'){renderCalendar(1);return true}
if(action==='preview-choose-calendar-day'){const value=element.dataset.date||'';if(value>toIsoDate(new Date())){toast('尚未到达的日期不可选择');return true}state.dateSelection[element.dataset.target||'generic']=value;document.querySelectorAll('#modal .day').forEach(day=>day.classList.toggle('selected',day===element));const rule=document.querySelector('#modal .calendar-side .rule');if(rule)rule.textContent=value;return true}
if(action==='preview-apply-node-offset'){applyNodeOffset();return true}
if(action==='test-connector'){connectorTest(element);return true}
if(action==='sync-now'){controlledSync(element);return true}
if(action==='preview-confirm-sync'){closeAndToast('已完成受控同步流程预览；未连接外部系统');return true}
return false;
};
new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
decorate();
})();
</script>`;

export function prepareApprovedPrototypeHtml(
  html: string,
  runtimeContext: ApprovedPrototypeRuntimeContextV1 | null = null,
) {
  const bridgedHtml = html
    .replace(
      DOCUMENT_CLICK_DISPATCHER,
      `${PREVIEW_ACTION_PRIORITY_BRIDGE}${DOCUMENT_CLICK_DISPATCHER}`,
    )
    .replace(
      APPROVED_NAVIGATION_DISPATCHER,
      CANONICAL_PRIMARY_NAVIGATION_DISPATCHER,
    );

  const styledHtml = bridgedHtml.includes('</head>')
    ? bridgedHtml.replace(
        '</head>',
        `${APPROVED_PRESENTATION_REFINEMENT_STYLE}${APPROVED_TYPOGRAPHY_REFINEMENT_STYLE}</head>`,
      )
    : bridgedHtml;

  const presentationScript = APPROVED_PRESENTATION_REFINEMENT_SCRIPT.replace(
    APPROVED_RUNTIME_CONTEXT_TOKEN,
    serializeApprovedRuntimeContext(runtimeContext),
  );

  return styledHtml.includes('</body>')
    ? styledHtml.replace(
        '</body>',
        `${presentationScript}${APPROVED_INTERACTION_COMPLETION_STYLE}${APPROVED_INTERACTION_COMPLETION_SCRIPT}</body>`,
      )
    : styledHtml;
}

export function resolveApprovedPrototypeAssetPath(
  root: string,
  segments: readonly string[],
) {
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
    return null;
  }

  const resolvedRoot = path.resolve(root);
  const resolvedAsset = path.resolve(resolvedRoot, ...segments);
  if (!resolvedAsset.startsWith(`${resolvedRoot}${path.sep}`)) return null;

  return resolvedAsset;
}

export function getApprovedPrototypeContentType(assetPath: string) {
  return contentTypes[path.extname(assetPath).toLowerCase()] ?? 'application/octet-stream';
}

export async function findApprovedPrototypePackageRoot(
  candidates: readonly string[] = APPROVED_PROTOTYPE_ROOT_CANDIDATES,
) {
  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, 'institution.html'));
      return candidate;
    } catch {
      // Continue to the repository-owned read-only reference fallback.
    }
  }

  return null;
}

export async function readApprovedPrototypeAsset(
  segments: readonly string[],
  candidates: readonly string[] = APPROVED_PROTOTYPE_ROOT_CANDIDATES,
  runtimeContext: ApprovedPrototypeRuntimeContextV1 | null = null,
) {
  const root = await findApprovedPrototypePackageRoot(candidates);
  if (!root) return null;

  const assetPath = resolveApprovedPrototypeAssetPath(root, segments);
  if (!assetPath) return null;

  try {
    const sourceBytes = await readFile(assetPath);
    const isInstitutionHtml =
      segments.length === 1 && segments[0] === 'institution.html';

    return {
      bytes: isInstitutionHtml
        ? Buffer.from(
            prepareApprovedPrototypeHtml(
              sourceBytes.toString('utf8'),
              runtimeContext,
            ),
          )
        : sourceBytes,
      contentType: getApprovedPrototypeContentType(assetPath),
      assetPath,
      root,
    };
  } catch {
    return null;
  }
}
