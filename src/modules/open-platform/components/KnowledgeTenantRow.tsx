import { cn } from '@/shared/utils/cn';

export type KnowledgeTenantRowProps = {
  tenantId: string;
  tenantName: string;
  knowledgeLabel: string;
  hitLabel: string;
  coverageLabel: string;
  statusLabel: string;
  isActive: boolean;
  onSelect: (tenantId: string) => void;
};

export function KnowledgeTenantRow({
  tenantId,
  tenantName,
  knowledgeLabel,
  hitLabel,
  coverageLabel,
  statusLabel,
  isActive,
  onSelect,
}: KnowledgeTenantRowProps) {
  const statusTone =
    statusLabel === '待优化'
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : statusLabel === '待接入'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-emerald-100 bg-emerald-50 text-emerald-700';

  return (
    <button
      type="button"
      aria-label={`机构运营卡 ${tenantName}`}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(tenantId)}
      className={cn(
        'w-full rounded-xl border px-3 py-3 text-left transition',
        isActive ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-[#e6edf5] bg-white hover:bg-[#f8fafc]',
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn('truncate text-sm font-semibold', isActive ? 'text-blue-700' : 'text-slate-950')}>
              {tenantName}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">运营状态</div>
          </div>
          <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold', statusTone)}>
            {statusLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-[#edf2f7] bg-white px-2 py-2">
            <div className="font-semibold text-slate-500">知识数</div>
            <div className="mt-1 font-semibold text-slate-900">{knowledgeLabel}</div>
          </div>
          <div className="rounded-lg border border-[#edf2f7] bg-white px-2 py-2">
            <div className="font-semibold text-slate-500">命中数</div>
            <div className="mt-1 font-semibold text-slate-900">{hitLabel}</div>
          </div>
          <div className="rounded-lg border border-[#edf2f7] bg-white px-2 py-2">
            <div className="font-semibold text-slate-500">覆盖率</div>
            <div className="mt-1 font-semibold text-slate-900">{coverageLabel}</div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full rounded-full bg-blue-500" style={{ width: coverageLabel === '暂无可用数据' ? '0%' : coverageLabel }} />
        </div>
      </div>
    </button>
  );
}
