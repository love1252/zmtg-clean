import { NextResponse } from 'next/server';

import { INSTITUTION_EXCEL_IMPORT_MAX_BYTES } from '@/modules/institution-import/server/institution-excel-workbook-parser';
import { validateSameOriginMutationRequest } from '@/modules/security/server/mutation-request-security';
import {
  executeCurrentInstitutionExcelImportV1,
  getCurrentInstitutionExcelImportDetailV1,
  INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES,
  listCurrentInstitutionExcelImportHistoryV1,
  previewCurrentInstitutionExcelImportV1,
  type InstitutionExcelImportDetailSheetV1,
  type InstitutionExcelImportResultV1,
} from '@/server/orchestration/institution-excel-import-runtime';

const NO_STORE_HEADERS = Object.freeze({ 'cache-control': 'no-store' } as const);
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

async function readWorkbook(request: Request): Promise<Readonly<{
  fileName: string;
  content: Uint8Array;
}> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  const contentLength = request.headers.get('content-length');
  if (
    !contentType.toLowerCase().startsWith('multipart/form-data;')
    || (contentLength !== null && (
      !/^\d+$/u.test(contentLength)
      || Number(contentLength) > INSTITUTION_EXCEL_IMPORT_MAX_BYTES + MULTIPART_OVERHEAD_BYTES
    ))
  ) {
    return null;
  }
  try {
    const formData = await request.formData();
    if ([...formData.keys()].some((key) => key !== 'file')) return null;
    const file = formData.get('file');
    if (
      !file
      || typeof file !== 'object'
      || typeof Reflect.get(file, 'name') !== 'string'
      || typeof Reflect.get(file, 'size') !== 'number'
      || typeof Reflect.get(file, 'arrayBuffer') !== 'function'
    ) return null;
    const fileName = Reflect.get(file, 'name') as string;
    const fileSize = Reflect.get(file, 'size') as number;
    if (
      !fileName.toLowerCase().endsWith('.xlsx')
      || fileSize < 4
      || fileSize > INSTITUTION_EXCEL_IMPORT_MAX_BYTES
    ) {
      return null;
    }
    const content = new Uint8Array(
      await (Reflect.get(file, 'arrayBuffer') as () => Promise<ArrayBuffer>).call(file),
    );
    if (content[0] !== 0x50 || content[1] !== 0x4b) return null;
    return Object.freeze({ fileName, content });
  } catch {
    return null;
  }
}

function response(result: InstitutionExcelImportResultV1) {
  const status = result.kind === 'ready'
    ? 200
    : result.kind === 'invalid'
      ? 400
      : result.kind === 'forbidden'
        ? 403
        : result.kind === 'conflict' || result.kind === 'quota_denied'
          ? 409
          : 503;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}

async function handle(
  request: Request,
  operation: typeof previewCurrentInstitutionExcelImportV1,
) {
  if (!validateSameOriginMutationRequest(request).ok) {
    return NextResponse.json(
      { kind: 'forbidden', code: 'csrf_validation_failed' },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  const workbook = await readWorkbook(request);
  if (!workbook) {
    return NextResponse.json(
      { kind: 'invalid', code: 'invalid_customer_import_file', issues: [] },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  return response(await operation(workbook));
}

export function POST(request: Request) {
  return handle(request, previewCurrentInstitutionExcelImportV1);
}

function readDetailQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].length === 0) return Object.freeze({ kind: 'history' as const });
  const allowedKeys = new Set(['batchId', 'sheet', 'page', 'pageSize']);
  if (
    [...query.keys()].some((key) => !allowedKeys.has(key) || query.getAll(key).length !== 1)
  ) {
    return Object.freeze({ kind: 'invalid' as const });
  }
  const batchId = query.get('batchId') ?? '';
  const sheet = query.get('sheet') ?? '';
  const pageText = query.get('page') ?? '1';
  const pageSizeText = query.get('pageSize') ?? '20';
  const page = Number(pageText);
  const pageSize = Number(pageSizeText);
  if (
    !/^imp-b-[0-9a-f]{48}$/u.test(batchId)
    || !(['customer', 'appointment', 'treatment', 'consumption'] as readonly string[]).includes(sheet)
    || !/^[1-9][0-9]*$/u.test(pageText)
    || !/^[1-9][0-9]*$/u.test(pageSizeText)
    || !Number.isSafeInteger(page)
    || page > 500
    || !INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES.includes(
      pageSize as (typeof INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES)[number],
    )
  ) {
    return Object.freeze({ kind: 'invalid' as const });
  }
  return Object.freeze({
    kind: 'detail' as const,
    batchId,
    sheet: sheet as InstitutionExcelImportDetailSheetV1,
    page,
    pageSize,
  });
}

export async function GET(request: Request) {
  const query = readDetailQuery(request);
  if (query.kind === 'invalid') {
    return NextResponse.json(
      { kind: 'invalid', code: 'invalid_customer_import_detail_query' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const result = query.kind === 'history'
    ? await listCurrentInstitutionExcelImportHistoryV1()
    : await getCurrentInstitutionExcelImportDetailV1({
        batchId: query.batchId,
        sheet: query.sheet,
        page: query.page,
        pageSize: query.pageSize,
      });
  const status = result.kind === 'ready'
    ? 200
    : result.kind === 'forbidden'
      ? 403
      : result.kind === 'not_found'
        ? 404
        : result.kind === 'invalid'
          ? 400
          : 503;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}

export function PUT(request: Request) {
  return handle(request, executeCurrentInstitutionExcelImportV1);
}
