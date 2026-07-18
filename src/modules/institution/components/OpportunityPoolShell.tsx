'use client';

/**
 * The tenant/demo opportunity pool has been retired. It must not reconnect to
 * the disabled legacy API or present unavailable data as customer counts.
 */
export function OpportunityPoolShell() {
  return (
    <section
      aria-labelledby="legacy-opportunity-pool-title"
      data-legacy-opportunity-pool-state="migrated"
      className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-6 text-slate-700 shadow-sm"
    >
      <h2
        id="legacy-opportunity-pool-title"
        className="text-lg font-semibold text-slate-950"
      >
        旧机会池功能已迁移
      </h2>
      <p className="mt-2 text-sm leading-6">
        此处不会加载或展示旧机会池数据。
      </p>
      <p className="mt-2 text-sm leading-6">
        新的正式入口为经营分析的“客户与机会”页面；该页面仍需完成机构能力和数据范围校验。
      </p>
    </section>
  );
}
