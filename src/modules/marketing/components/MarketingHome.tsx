import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { brandAssets } from '@/modules/branding/brand-assets';
import { Button } from '@/shared/ui/button';

const metrics = [
  { value: '37%', label: '咨询转化提升' },
  { value: '2.4h', label: '响应时间缩短' },
  { value: '89%', label: '重点客户覆盖' },
  { value: '24/7', label: 'AI在线协作' },
];

const capabilities = [
  { icon: UsersRound, title: '客户经营中台', desc: '统一客户档案、标签、消费、预约、治疗和随访时间线。' },
  { icon: CalendarCheck, title: '治疗后运营闭环', desc: '治疗完成自动触发术后关怀、复诊提醒和流失预警。' },
  { icon: MessageCircle, title: '客服协同工作台', desc: 'AI 建议与人工接管并行，减少咨询和随访断点。' },
  { icon: Bot, title: 'AI 智能体能力', desc: '按机构知识和业务目标生成回复建议、标签建议和运营动作。' },
  { icon: BarChart3, title: '增长分析看板', desc: '跟踪触达率、回复率、预约转化、复购和客户分层。' },
  { icon: ShieldCheck, title: '租户与审计底座', desc: '为商业化交付准备租户隔离、角色权限和审计记录。' },
];

export function MarketingHome() {
  return (
    <main className="min-h-screen bg-[#fbf7f0] text-slate-950">
      <section className="relative min-h-screen overflow-hidden">
        <Image
          src={brandAssets.homepageBackground}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(251,247,240,0.98)_0%,rgba(251,247,240,0.88)_42%,rgba(251,247,240,0.38)_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-6 md:px-12 lg:px-16">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="智美天工首页" className="inline-flex items-center">
              <Image
                src={brandAssets.logoHorizontalLuxury}
                alt="智美天工"
                width={960}
                height={306}
                priority
                className="h-14 w-auto object-contain"
              />
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
              <a href="#capabilities">功能介绍</a>
              <a href="#workflow">运营闭环</a>
              <a href="#security">安全底座</a>
            </nav>
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary">
                <Link href="/platform-login">平台登录</Link>
              </Button>
              <Button asChild>
                <Link href="/login">立即试用</Link>
              </Button>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.7fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6c49a] bg-white/68 px-4 py-2 text-sm font-bold text-[#7a5f2b] shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                AI 驱动的医美智能运营中台
              </div>
              <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-[1.06] tracking-normal text-slate-950 md:text-7xl">
                让医美经营拥有智能体驱动
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
                从客户档案、咨询沟通、预约治疗到术后关怀，把医美机构最重要的增长动作放进同一套 AI 运营系统。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild className="h-12 px-6">
                  <Link href="/login">
                    立即试用
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-12 px-6">
                  <a href="#capabilities">了解更多</a>
                </Button>
              </div>
            </div>

            <aside className="rounded-[32px] border border-white/80 bg-white/72 p-6 shadow-[0_30px_90px_rgba(37,55,70,0.16)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0a8079]">增长驾驶舱</p>
                  <h2 className="mt-2 text-2xl font-semibold">今日运营建议</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">AI 可信度 92%</span>
              </div>
              <div className="mt-6 grid gap-3">
                {['高意向客户优先回访', '术后 D7 关怀自动触达', '沉默客户进入复购旅程'].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-100 bg-white/78 p-4 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-slate-950 p-4 text-white">
                    <div className="text-2xl font-semibold">{metric.value}</div>
                    <div className="mt-1 text-xs text-slate-300">{metric.label}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="capabilities" className="bg-white px-6 py-20 md:px-12 lg:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-3xl">
            <p className="text-sm font-bold tracking-[0.16em] text-[#c79b4a]">CORE MODULES</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-normal">先把医美运营主链路做干净</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              新项目优先保留能形成商业闭环的能力，复杂开放平台和深度 Agent 编排在基础稳定后逐步进入。
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-[28px] border border-slate-100 bg-[#fbfdff] p-6 shadow-sm">
                <item.icon className="h-8 w-8 text-[#1f5fe5]" />
                <h3 className="mt-8 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
