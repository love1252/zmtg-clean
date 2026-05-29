import { Bot, MessageSquareText, Workflow } from 'lucide-react';
import {
  followUpJourneys,
  followUpMessageSuggestions,
  followUpTasks,
} from '@/modules/institution/domain/followups';

const riskToneClasses = {
  普通: 'bg-slate-100 text-slate-600',
  关注: 'bg-amber-50 text-amber-700',
  优先: 'bg-rose-50 text-rose-700',
};

export function SmartFollowUpShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <p className="text-sm font-semibold text-violet-600">智能随访旅程</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">智能随访</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          展示术后关怀、复购召回和沉默激活的演示旅程。当前不执行真实自动触达。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {followUpJourneys.map((journey) => (
          <article key={journey.id} className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600">
              <Workflow className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">{journey.name}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-2xl font-semibold text-slate-950">{journey.stageCount}</div>
                <div className="text-xs text-slate-500">旅程节点</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-2xl font-semibold text-slate-950">{journey.activeCustomers}</div>
                <div className="text-xs text-slate-500">运行客户</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{journey.conversionHint}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <article className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold">今日随访任务</h3>
          </div>
          <div className="mt-4 space-y-3">
            {followUpTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{task.customerName}</div>
                    <div className="mt-1 text-sm text-slate-300">{task.stage}</div>
                    <div className="mt-1 text-xs text-slate-500">{task.dueLabel}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskToneClasses[task.riskLevel]}`}>{task.riskLevel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{task.suggestedAction}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-950">演示话术建议</h3>
          </div>
          <div className="mt-4 space-y-3">
            {followUpMessageSuggestions.map((suggestion) => (
              <div key={suggestion.title} className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">{suggestion.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{suggestion.content}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
