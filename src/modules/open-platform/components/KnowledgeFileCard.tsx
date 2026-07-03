import { Download, FileText } from 'lucide-react';

import { cn } from '@/shared/utils/cn';

export type KnowledgeFileCardProps = {
  fileId: string;
  fileName: string;
  tenantName: string;
  statusLabel: string;
  statusClassName: string;
  fileType: string;
  fileSizeLabel: string;
  categoryLabel: string;
  folderLabel: string;
  textLengthLabel: string;
  chunkCountLabel: string;
  updatedAtLabel: string;
  errorMessageLabel: string;
  hasError: boolean;
  selected: boolean;
  canDownload: boolean;
  onToggle: (fileId: string) => void;
  onDownload: (fileId: string) => void;
};

export function KnowledgeFileCard({
  fileId,
  fileName,
  tenantName,
  statusLabel,
  statusClassName,
  fileType,
  fileSizeLabel,
  categoryLabel,
  folderLabel,
  textLengthLabel,
  chunkCountLabel,
  updatedAtLabel,
  errorMessageLabel,
  hasError,
  selected,
  canDownload,
  onToggle,
  onDownload,
}: KnowledgeFileCardProps) {
  return (
    <article className="rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-sm font-semibold tracking-normal text-slate-950">{fileName}</h3>
            <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', statusClassName)}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-500">{tenantName}</div>
        </div>
        <input
          type="checkbox"
          aria-label={`选择卡片文件 ${fileName}`}
          checked={selected}
          onChange={() => onToggle(fileId)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-semibold text-slate-500">类型 / 大小</dt>
          <dd className="mt-1 font-semibold text-slate-800">{fileType} · {fileSizeLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">解析字符数</dt>
          <dd className="mt-1 font-semibold text-slate-800">{textLengthLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">解析片段</dt>
          <dd className="mt-1 font-semibold text-slate-800">{chunkCountLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">保留原始文件</dt>
          <dd className="mt-1 font-semibold text-slate-800">是</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">分类</dt>
          <dd className="mt-1 font-semibold text-slate-800">{categoryLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">文件夹</dt>
          <dd className="mt-1 font-semibold text-slate-800">{folderLabel}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">更新时间</dt>
          <dd className="mt-1 font-semibold text-slate-800">{updatedAtLabel}</dd>
        </div>
      </dl>
      <div className={cn(
        'mt-3 rounded-lg border px-3 py-2 text-xs font-semibold leading-5',
        hasError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700',
      )}>
        错误信息：{errorMessageLabel}
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-[#e6edf5] bg-white px-3 py-2">
          <div className="font-semibold text-slate-500">下载能力</div>
          <div className="mt-1 font-semibold text-slate-800">{canDownload ? '可下载' : '缺少归属，受控禁用'}</div>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white px-3 py-2">
          <div className="font-semibold text-slate-500">操作状态</div>
          <div className="mt-1 font-semibold text-slate-800">批量解析请使用已选文件操作，本卡片不新增接口</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDownload(fileId)}
          disabled={!canDownload}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          下载
        </button>
        <button
          type="button"
          disabled
          title="批量解析请使用已选文件操作，本卡片不新增操作接口"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dbe5f0] bg-white px-3 text-xs font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          操作受控
        </button>
      </div>
    </article>
  );
}
