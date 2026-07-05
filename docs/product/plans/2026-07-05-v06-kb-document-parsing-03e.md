# V0.6-KB-DOCUMENT-PARSING-03E 知识库复杂文档解析最小闭环

日期：2026-07-05  
范围：`love1252/zmtg-clean` / `feat/kb-document-parsing-03e`

## 目标

- 支持 TXT / MD / PDF / DOCX / XLSX / CSV 文件解析。
- 将解析结果接入既有 `parse_file`、`rebuild_knowledge_index` job。
- 解析文本继续进入现有 chunk、embedding、hybrid retrieval 链路。
- 机构端 UI 展示支持格式、解析状态、片段数量和低敏失败原因。
- 不新增生产级 worker、queue、cron；不真实出网。

## 支持格式与边界

| 格式 | 支持内容 | 明确不支持 |
| --- | --- | --- |
| TXT | UTF-8 文本抽取 | 二进制或不可读内容 |
| MD | Markdown 原文文本抽取 | Markdown 渲染执行 |
| CSV | 行 / 单元格文本拼接 | 公式执行、外部资源读取 |
| PDF | 嵌入的可复制文本抽取 | OCR、扫描件、图片内文字 |
| DOCX | `word/document.xml` 正文 `<w:t>` 文本抽取 | 图片、批注、修订、页眉页脚、宏 |
| XLSX | sheet 名称、shared strings、行 / 单元格显示文本 | 公式执行、宏、外部链接、图片文字 |

PDF 空文本按扫描件或图片文字处理，返回低敏失败原因；Excel 仅抽取表格文本，不执行公式。

## Parser contract

服务端新增统一入口：

- `parseKnowledgeDocumentFile(input)`

输入包含：

- `fileName`
- `mimeType`
- `buffer`
- `tenantId`
- `institutionId`
- `knowledgeId`
- `fileId`
- 可选 `maxChars` / `maxRows` / `maxSheets` / `maxPages`

成功输出包含：

- `status: 'succeeded'`
- `text`
- `parserType: text | markdown | csv | pdf | docx | xlsx`
- 可选 `pageCount` / `sheetCount` / `rowCount`
- `warningCodes`

失败输出包含：

- `status: 'failed' | 'unsupported'`
- `text: ''`
- `parserType`
- `failureReasonCode`
- `safeMessage`
- `warningCodes`

## 低敏失败原因

本轮统一使用以下 failure reason code：

- `unsupported_file_type`
- `parse_empty_text`
- `parse_file_too_large`
- `parse_page_limit_exceeded`
- `parse_sheet_limit_exceeded`
- `parse_malformed_document`
- `parse_scanned_pdf_unsupported`
- `parse_service_failed`

warning code：

- `parse_text_truncated`
- `parse_row_limit_exceeded`

## Job 接入

### parse_file

`parse_file` job 调用统一 parser：

1. 从既有 storage 读取文件 buffer。
2. 根据文件名和 MIME 白名单选择 parser。
3. 解析成功后写入 parse record。
4. 使用现有 chunk 切分机制生成 parse chunks。
5. 解析失败时写入低敏失败状态，并清空旧 chunks。
6. job metadata 仅记录低敏 counts / parserType / warningCodes。

### rebuild_knowledge_index

`rebuild_knowledge_index` job 本轮变更为：

1. 列出当前 knowledge 下 active files。
2. 逐个重新执行 parse。
3. 若解析存在失败文件，则 job 返回低敏失败提示。
4. 全部解析成功后继续调用既有 embedding 生成服务。
5. 后续 hybrid retrieval 复用已生成 chunk 和 embedding。

不新增 worker / queue / cron。

## API / UI 白名单

机构端和平台端响应可展示：

- `fileId`
- `fileName` / `originalFilename`
- `mimeType`
- `parseStatus`
- `parserVersion` / 低敏 parser 信息
- `chunkCount`
- `failureReasonCode`
- `safeFailureMessage`
- `jobId`
- `job status`
- `counts`

禁止展示：

- `storageKey`
- `bucket`
- `signedUrl`
- raw file buffer
- extracted full text
- embedding array
- provider / model / token / cost / vendor
- stack trace
- API key / baseUrl / secret

## 资源与安全限制

- 复用上传大小限制：机构端最大 2MB。
- 解析文本长度复用既有 `v1KnowledgeBaseUploadParseChunkRuntimeMaxChars`。
- ZIP 单 entry inflated 限制：5MB。
- ZIP total inflated 限制：12MB。
- PDF Flate inflated 限制：8MB。
- PDF 页数默认限制：200。
- XLSX sheet 默认限制：20。
- CSV / XLSX 行数默认限制：5000。
- 不下载远程资源。
- 不读取外部链接。
- 不执行 Excel 公式。
- 不解析宏。
- 不 OCR。

## Schema / migration / dependency

- 未新增 schema。
- 未新增 migration。
- 未新增 npm 依赖。
- 未引入云服务 SDK。
- 未引入 OCR / 图像识别依赖。
- 未引入需要系统二进制的重依赖。

## 测试覆盖

已补充或更新以下方向：

- TXT / MD / CSV 解析不回归。
- PDF 嵌入文本解析。
- PDF 扫描件 / 空文本低敏失败。
- DOCX 正文文本解析。
- XLSX 表格文本解析。
- unsupported file type。
- malformed document。
- maxRows / maxSheets / maxPages / maxChars 限制。
- ZIP / PDF 解压安全限制。
- parse_file job 低敏 metadata。
- rebuild_knowledge_index 重新解析后进入 embedding。
- 机构端上传支持格式更新。
- JSON 从机构上传白名单移除。
- UI 支持格式、OCR 边界、Excel 公式边界文案。
- API / DTO 不暴露全文、storage key、embedding array、provider、model、token、cost、secret。

## 未包含内容

- OCR。
- 扫描件识别。
- 图片内文字识别。
- 生产级 worker / queue / cron。
- 真实第三方服务调用。
- schema / migration。
- 新解析依赖。
