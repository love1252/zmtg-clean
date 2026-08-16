import Link from 'next/link';

import {
  KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1,
  type KnowledgeDocumentMetadataReaderResultV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-reader';

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
      <header className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-6 shadow-xl shadow-slate-200/50">
        <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700">
          READ ONLY
        </p>
        <h1
          id="knowledge-library-title"
          className="mt-2 text-2xl font-bold text-slate-950"
        >
          知识库资料
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          仅展示当前机构已正式发布的低敏资料元数据。
        </p>
      </header>

      {result.records.length === 0 ? (
        <div
          data-knowledge-state="empty"
          className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center"
        >
          <h2 className="text-base font-semibold text-slate-900">
            暂无正式知识库资料
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            当前机构尚未发布可供查看的正式知识库资料。
          </p>
        </div>
      ) : (
        <ul
          className="grid gap-3"
          aria-label="正式知识库资料列表"
        >
          {result.records.map((record) => (
            <li
              key={record.documentId}
              className="rounded-[24px] border border-white/90 bg-white/90 px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    {record.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    来源：{record.sourceLabel} · 版本 {record.version}
                  </p>
                </div>
                <time
                  className="text-xs text-slate-500"
                  dateTime={record.publishedAt}
                >
                  发布于 {record.publishedAt}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}

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
