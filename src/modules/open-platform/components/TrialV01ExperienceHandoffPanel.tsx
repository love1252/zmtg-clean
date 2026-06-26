'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Info,
  LayoutDashboard,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react';

type DeploymentVersion = {
  commit: string;
  buildAt: string;
  source: string;
};

type VersionState =
  | { status: 'loading' }
  | { status: 'loaded'; version: DeploymentVersion }
  | { status: 'error' };

const demoAccounts = [
  { platform: '平台端', username: 'platform', role: 'platform_admin', hint: '使用平台管理员账号登录后创建租户和机构账号' },
  { platform: '机构端', username: 'chengxing_admin', role: 'tenant_admin', hint: '澄星医疗美容（含演示数据），可直接体验客户运营闭环' },
] as const;

type DemoStep = {
  title: string;
  detail: string;
  action: string;
};

const platformDemoSteps: DemoStep[] = [
  { title: '登录平台端', detail: '在平台端登录页面输入平台管理员账号和密码。', action: '打开 /platform-login' },
  { title: '查看体验版操作说明', detail: '左侧导航栏点击「体验版操作说明」，了解 V0.2 完整功能清单和演示路径。', action: '体验版操作说明' },
  { title: '新建正式机构', detail: '进入「租户管理」，点击「新建租户」按钮，填写机构名称、选择套餐、设置配额并创建。', action: '租户管理 → 新建租户' },
  { title: '创建机构管理员账号', detail: '在租户详情中点击「管理账号」，设置用户名和密码，为机构创建初始管理员账号。', action: '管理账号' },
  { title: '绑定套餐', detail: '新建机构后系统自动绑定所选套餐，可在租户详情中查看当前套餐和授权快照。', action: '租户详情' },
  { title: '查看商业记录', detail: '在租户详情「商业记录」区域查看自动生成的 tenant_opening、account_opening、plan_binding 三条记录。', action: '商业记录' },
  { title: '执行套餐变更', detail: '在租户详情中点击「套餐变更」，预览变更差异后提交应用，自动生成 plan_change 商业记录。', action: '套餐变更' },
  { title: '管理机构账号', detail: '在租户详情「管理账号」区域可执行停用、启用、重置密码操作，每次操作自动生成 account_status_change 商业记录。', action: '停用 / 启用 / 重置密码' },
  { title: '查看审计日志', detail: '进入「平台审计日志」页面查看平台端所有操作审计记录，支持按资源、操作、结果筛选。', action: '平台审计日志' },
  { title: '体验数据重置', detail: '进入「体验数据重置」页面查看当前数据概览，二次确认后执行数据清理重置，恢复测试服到可演示状态。', action: '体验数据重置' },
];

const institutionDemoSteps: DemoStep[] = [
  { title: '登录机构端', detail: '使用机构管理员账号和密码登录机构工作台。', action: '打开 /login' },
  { title: '进入机构工作台', detail: '登录成功后自动跳转至 /hospital，进入机构运营工作台。', action: '/hospital' },
  { title: '查看工作台看板', detail: '首页看板展示客户总数、高优先级客户、待确认预约、待处理随访、已完成随访、机会池客户等指标。', action: '工作台' },
  { title: '查看客户列表', detail: '点击「客户中心」查看当前机构的所有客户，支持搜索、筛选、新建和编辑。', action: '客户中心' },
  { title: '新建客户', detail: '点击「新建客户」按钮，填写客户基本信息（姓名、手机号、项目兴趣等）并提交。', action: '新建客户' },
  { title: '编辑客户', detail: '点击客户卡片进入详情，支持修改客户基本信息和标签。', action: '编辑客户' },
  { title: '查看客户详情', detail: '点击客户卡片的「查看详情」按钮，侧边栏展示客户基础资料、标签、预约记录、治疗摘要、随访任务和时间线。', action: '查看详情' },
  { title: '完成一条随访任务', detail: '进入「智能随访」，找到状态为「待处理」的随访任务，依次点击流转按钮将其推进至「已完成」。刷新页面后状态保持。', action: '智能随访' },
  { title: '查看机会池', detail: '点击「机会池」查看基于客户旅程自动分类的复诊机会、复购机会和沉睡客户机会。', action: '机会池' },
  { title: '验证安全边界', detail: '登录机构账号后，尝试在浏览器中直接访问 /open-platform，确认看到 403 拒绝页面。', action: '验证机构端无法访问平台端' },
];

const availableFeatures = {
  platform: [
    '平台端正式机构开通',
    '初始管理员账号创建',
    '套餐绑定（自动生成 plan_binding 商业记录）',
    '套餐变更预览与执行（自动生成 plan_change 商业记录）',
    '商业记录自动生成 — tenant_opening、account_opening、plan_binding、plan_change、account_status_change',
    '机构账号停用、启用、重置密码',
    '平台审计日志查看',
    '体验数据重置 / 清理机制（二次确认 + 审计写入）',
    '平台总览看板（租户数、套餐覆盖率、配额风险）',
    '首页品牌配置',
    'AI 模型配置入口（只读）',
    '知识库管理入口（只读）',
    '体验版 V0.2 操作说明（本页面）',
  ],
  institution: [
    '机构端正式账号登录',
    '工作台看板（客户数、待随访数、已完成随访数、机会数）',
    '客户列表（搜索、过滤、新建、编辑）',
    '客户详情时间线（基础资料、标签、预约、治疗摘要、随访、审计）',
    '客户新增与编辑',
    '智能随访（随访任务列表、状态流转、来源筛选）',
    '随访任务完成（流转持久化，刷新后不丢）',
    '复诊、复购、沉睡客户机会池',
    '租户数据隔离',
    '预约中心（预约列表、新建预约）',
    '治疗摘要管理（列表、新增、编辑、作废）',
    '审计日志查看',
    '体验版数据自动供给（首次正式登录 provision 5 客户 + 随访 + 治疗摘要）',
  ],
};

const notAvailableFeatures = [
  { icon: XCircle, title: '不宣称真实 HIS 接入', description: '当前不连接任何医院信息系统，不拉取真实诊疗数据。' },
  { icon: XCircle, title: '不宣称短信 / 企微 / 电话自动触达', description: '随访任务仅支持在系统内状态流转，不会自动向客户发送手机短信、企微消息或拨打电话。' },
  { icon: XCircle, title: '不宣称真实 AI 大模型调用', description: 'AI 模型配置为只读入口，不触发真实模型调用、不消耗 Token、不产生费用。' },
  { icon: XCircle, title: '不宣称知识库真实上传解析', description: '知识库管理入口为只读预览，不支持文件上传、解析或向量化。' },
  { icon: XCircle, title: '不宣称正式支付、合同、发票、收款、退款', description: '商业记录为演示数据，不代表真实合同签署、发票开具或资金流转。套餐价格仅展示，不接入真实支付。' },
  { icon: XCircle, title: '不宣称自动计费扣费', description: '当前版本不处理自动计费、不消耗额度、不生成账单。' },
  { icon: XCircle, title: '不宣称正式生产监控', description: '当前版本不含正式告警、性能监控或 SLA 保障。' },
  { icon: XCircle, title: '不宣称正式商用交付已完成', description: '体验版用于功能演示和内部验收，不代表产品已具备正式商用条件。' },
  { icon: XCircle, title: '不宣称数据重置功能可用于生产环境', description: '数据重置为测试服/体验版专用能力，全量不可逆，严禁用于正式生产环境。' },
];

const faqItems = [
  {
    question: '体验版需要什么浏览器？',
    answer: '推荐使用最新版 Chrome、Edge 或 Safari。不支持 IE。',
  },
  {
    question: '演示账号的密码是什么？',
    answer: '请联系管理员获取演示密码。出于安全考虑，密码不在页面上直接展示。',
  },
  {
    question: '新建的租户没有数据怎么办？',
    answer: '新建的正式机构账号首次登录时，系统会自动创建一批体验数据（客户、治疗摘要、随访任务、预约）。如果已经登录过但没有看到数据，请联系管理员确认 provisioning 是否成功。',
  },
  {
    question: '机构端能访问平台端吗？',
    answer: '不能。机构账号登录后只能访问 /hospital，尝试访问 /open-platform 会返回 403 权限拒绝。同样，平台端管理员也无法使用机构账号的身份查看客户数据。',
  },
  {
    question: '不同机构的客户数据会串吗？',
    answer: '不会。所有客户、随访、机会池数据都按租户（tenantId）严格隔离。机构 A 的管理员无法看到机构 B 的客户数据。',
  },
  {
    question: '随访任务完成之后还能改回去吗？',
    answer: '已完成（completed）和已取消（cancelled）状态的随访任务在系统中属于终态，不可逆转。这是业务设计，保证数据一致性。',
  },
  {
    question: '机会池的数据从哪里来？',
    answer: '机会池基于客户的生命周期阶段（术后关怀 → 复诊机会、复购窗口 → 复购机会、沉睡客户 → 唤醒机会）自动派生，不依赖外部数据。',
  },
  {
    question: '体验版有数据量上限吗？',
    answer: '体验版受套餐配额限制。演示租户使用试用版套餐，有各自的配额上限。正式环境由平台管理员在套餐中配置。',
  },
  {
    question: '数据重置会删除什么？',
    answer: '数据重置会清空所有机构及关联数据（客户、随访、商业记录等），但 platform 平台账号、套餐目录和版本不受影响。重置后可以重新新建机构继续体验。',
  },
  {
    question: '如何恢复预置的演示机构？',
    answer: '数据重置不会自动恢复预置的演示机构（如澄星医疗美容等）。如需恢复 seed 演示机构，请联系管理员运行 pnpm seed。',
  },
];

export function TrialV01ExperienceHandoffPanel() {
  const [version, setVersion] = useState<VersionState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    async function loadVersion() {
      try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (!response.ok) throw new Error('version_unavailable');
        const data: unknown = await response.json();
        if (isActive) {
          setVersion({ status: 'loaded', version: data as DeploymentVersion });
        }
      } catch {
        if (isActive) setVersion({ status: 'error' });
      }
    }

    void loadVersion();
    return () => { isActive = false; };
  }, []);

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_24px_80px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-blue-600">只读 · 平台端受控可见</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950 lg:text-5xl">
              智美天工 Clean 体验版 V0.2
            </h1>
            <p className="mt-3 text-lg leading-7 text-slate-600">
              本页面为平台端受控入口，仅平台管理员登录后可查看。页面不暴露账号密码，不对外公开。
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">测试服版本</span>
            {version.status === 'loaded' ? (
              <>
                <code className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-emerald-300">
                  {version.version.commit}
                </code>
                <span className="text-xs text-slate-400">
                  构建时间：{new Date(version.version.buildAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </span>
              </>
            ) : version.status === 'loading' ? (
              <span className="text-sm text-slate-400">加载中...</span>
            ) : (
              <span className="text-sm text-amber-600">版本信息加载失败</span>
            )}
          </div>
        </div>
      </header>

      {/* Quick Links */}
      <section className="grid gap-4 md:grid-cols-2">
        <a
          href="/platform-login"
          className="group rounded-[22px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-950">平台端登录入口</h3>
              <p className="mt-1 text-sm text-slate-500">平台管理员在此登录</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-blue-400 transition group-hover:translate-x-0.5" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            管理租户、套餐、配额、账号、审计。建议先用 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">platform</code>{' '}
            账号登录平台端，在此创建新的试用机构和机构管理员账号。
          </p>
        </a>

        <a
          href="/login"
          className="group rounded-[22px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-950">机构端登录入口</h3>
              <p className="mt-1 text-sm text-slate-500">机构管理员在此登录</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-emerald-400 transition group-hover:translate-x-0.5" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            进入机构工作台后，可以体验客户管理、随访任务、机会池等运营闭环功能。
            新建的正式机构账号首次登录会<strong>自动创建体验数据</strong>。
          </p>
        </a>
      </section>

      {/* Demo Accounts (no passwords exposed) */}
      <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">演示环境账号</h2>
            <p className="mt-1 text-sm text-slate-500">以下为演示环境预置账号的用户名。密码请向管理员获取，不在页面上展示。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {demoAccounts.map((account) => (
            <div
              key={account.username}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-950">{account.platform}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {account.role}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-slate-400">用户名</span>
                <code className="ml-2 rounded bg-slate-950 px-2 py-1 text-sm font-mono text-emerald-300">
                  {account.username}
                </code>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{account.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo Path - Platform */}
      <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">平台端演示路径</h2>
            <p className="mt-1 text-sm text-slate-500">按以下步骤体验平台端租户管理与商业化配置流程。</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {platformDemoSteps.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {step.title}
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                    {step.action}
                  </span>
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo Path - Institution */}
      <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">机构端演示路径</h2>
            <p className="mt-1 text-sm text-slate-500">按以下步骤体验机构端客户运营闭环。建议先完成平台端演示路径，确保已有一个正式机构账号。</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {institutionDemoSteps.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {step.title}
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {step.action}
                  </span>
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available Features */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">可体验功能清单</h2>
              <p className="mt-1 text-sm text-slate-500">以下功能均可在当前版本中实际操作和体验。</p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Building2 className="h-4 w-4" />
                平台端功能
              </h3>
              <ul className="mt-3 space-y-2">
                {availableFeatures.platform.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Users className="h-4 w-4" />
                机构端功能
              </h3>
              <ul className="mt-3 space-y-2">
                {availableFeatures.institution.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">不可宣称功能清单</h2>
              <p className="mt-1 text-sm text-slate-500">以下功能当前版本<strong>尚未实现</strong>，请勿对外宣称支持。</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {notAvailableFeatures.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-amber-800">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FAQ */}
      <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm backdrop-blur-xl lg:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">常见问题与边界说明</h2>
            <p className="mt-1 text-sm text-slate-500">初次体验时的常见疑问和重要边界的说明。</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-slate-200 bg-white p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-950 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
                  {item.question}
                </div>
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600 pl-6">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Safety Notice */}
      <section className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-5 shadow-sm lg:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-lg font-semibold text-rose-900">安全提醒</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800">
              本页面为平台端受控入口，仅限平台管理员登录后查看。页面内容（包括账号用户名）不得在未登录公开页面暴露。
              演示账号密码需通过安全渠道单独传递，禁止在任何页面、文档或公开渠道中直接展示。
              体验数据重置为全量不可逆操作，仅限测试服/体验版环境，严禁用于正式生产。
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
