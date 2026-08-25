'use client';

import Link from 'next/link';
import { BookOpenText, FileUp, ListFilter, Plus, Search, Sparkles } from 'lucide-react';

import {
  KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1,
  type KnowledgeDocumentMetadataReaderResultV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-pagination-contract';
import {
  InstitutionV11Button,
  InstitutionV11PageHeader,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

type ReadyResultV1 = Extract<
  KnowledgeDocumentMetadataReaderResultV1,
  { kind: 'ready' }
>;

function pageHref(page: number) {
  return `/hospital/knowledge?page=${page}`;
}

export function KnowledgeDocumentMetadataReadonlyShell({
  result,
}: Readonly<{
  result: ReadyResultV1;
}>) {
  return (
    <section
      className="space-y-5"
      aria-labelledby="knowledge-library-title"
    >
      <div id="knowledge-library-title">
        <InstitutionV11PageHeader
          eyebrow="KNOWLEDGE BASE"
          title="知识库资料"
          description="仅展示当前机构已正式发布的低敏资料元数据；草稿、正文、上传与发布 Writer 均不会在本页推断开放。"
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '知识库' }, { label: '资料库' }]}
          state="READ_ONLY"
          actions={<><InstitutionV11Button icon={FileUp} disabled disabledReason="知识上传 Writer 未开放">上传文件</InstitutionV11Button><InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="Knowledge Writer 未开放">新建知识</InstitutionV11Button></>}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-max items-center gap-1 border-b border-slate-200 px-3">{['知识文档', 'SOP', 'FAQ', '话术与模板'].map((label, position) => <span key={label} className={`relative px-3 py-3 text-sm ${position === 0 ? 'font-semibold text-blue-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-blue-600' : 'text-slate-500'}`}>{label}</span>)}</div>
        <div className="grid min-h-20 gap-3 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><BookOpenText aria-hidden="true" className="h-4 w-4" />知识空间</h2><div className="mt-3 space-y-1">{['全部知识', '项目知识', '服务 SOP', '常见问题', '话术模板'].map((label, position) => <div key={label} className={`rounded-lg px-3 py-2 text-xs ${position === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>{label}</div>)}</div><p className="mt-4 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-400">分类、标签与权限筛选需要正式 Reader。</p></aside>
          <div className="flex flex-col justify-center gap-3"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[240px] flex-1"><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input disabled placeholder="搜索标题、标签或正文" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm" /></div><InstitutionV11Button icon={ListFilter} disabled disabledReason="正式筛选 Reader 未开放">筛选</InstitutionV11Button><InstitutionV11Button icon={Sparkles} disabled disabledReason="AI Provider 未配置">AI 检索测试</InstitutionV11Button></div><p className="text-[11px] text-slate-500">状态、版本、权限、AI 使用范围与引用关系仅在正式契约可用时展示。</p></div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {result.records.length === 0 ? (
          <div data-knowledge-state="empty" className="border border-dashed border-transparent px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-slate-900">暂无正式知识库资料</h2>
            <p className="mt-2 text-sm text-slate-600">当前机构尚未发布可供查看的正式知识库资料。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left" aria-label="正式知识库资料列表">
              <thead className="bg-slate-50/80 text-[11px] font-medium text-slate-500">
                <tr><th className="px-4 py-3">知识文档</th><th className="px-3 py-3">来源</th><th className="px-3 py-3">版本</th><th className="px-3 py-3">状态</th><th className="px-4 py-3">发布时间</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {result.records.map((record) => (
                  <tr key={record.documentId} className="transition-colors hover:bg-blue-50/30">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><BookOpenText className="h-4 w-4" /></span><h2 className="font-semibold text-slate-900">{record.title}</h2></div></td>
                    <td className="px-3 py-3 text-xs text-slate-600">来源：{record.sourceLabel} · 版本 {record.version}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">V{record.version}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已发布</span></td>
                    <td className="px-4 py-3"><time className="text-xs text-slate-500" dateTime={record.publishedAt}>发布于 {record.publishedAt}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav
        aria-label="知识库资料分页"
        className="flex items-center justify-between gap-3"
      >
        {result.pageInfo.page > 1 ? (
          <Link
            href={pageHref(result.pageInfo.page - 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            上一页
          </Link>
        ) : (
          <span />
        )}

        <span className="text-sm text-slate-500">
          第 {result.pageInfo.page} 页
        </span>

        {result.pageInfo.hasMore
        && result.pageInfo.page
          < KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1 ? (
          <Link
            href={pageHref(result.pageInfo.page + 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            下一页
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}
