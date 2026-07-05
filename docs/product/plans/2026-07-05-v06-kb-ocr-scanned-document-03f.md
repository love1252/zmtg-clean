# V0.6-KB-OCR-SCANNED-DOCUMENT-03F：OCR-ready 扫描件与图片文字识别最小闭环

## 1. 目标

在 03E 文档解析链路基础上补齐扫描 PDF / 图片文字识别的 OCR-ready 最小闭环：新增 OCR contract、dry-run/mock provider、图片白名单、扫描 PDF ocr_required 识别、OCR 成功文本进入 parse -> chunk -> embedding -> hybrid retrieval，并接入 03D indexing job。

## 2. 范围

- 解析输入：既有 TXT / MD / PDF / DOCX / XLSX / CSV 保持不回归。
- OCR-ready 输入：PNG、JPG/JPEG；平台解析层同时识别 WEBP。
- 扫描 PDF：无法抽取可复制文本时返回低敏 OCR-needed 状态。
- 任务类型：新增 `ocr_file`，复用现有 indexing job 运行与状态模型。
- 机构端 UI：展示 OCR 状态、低敏失败原因和边界说明。

## 3. 非目标

- 不接外部云 OCR。
- 不真实出网。
- 不下载 OCR 模型。
- 不引入依赖系统安装的 tesseract / imagemagick / poppler。
- 不新增生产级 worker / queue / cron。
- 不做生产级批量 OCR 或成本计费。
- 不修改平台端租户、套餐、权益管理。

## 4. 数据库与 migration

优先复用现有 parse / job 字段：`parseStatus`、`failureReasonCode`、`safeFailureMessage`、`metadataJson`、job counts。

本次仅为 job type 最小扩展新增 migration：

- `drizzle/0029_v06_kb_ocr_file_job_type.sql`
- `knowledge_indexing_job_type` 增加 `ocr_file`

未新增 OCR parse 表、未删除或重命名既有字段。

## 5. OCR provider contract

新增 `platform-knowledge-ocr-provider.ts`：

- input 包含 `fileName`、`mimeType`、`buffer`、`tenantId`、`institutionId`、`knowledgeId`、`fileId`、`maxChars`、`maxPages`。
- output 包含 `status`、`text`、`pageCount`、`imageCount`、`warningCodes`、`failureReasonCode`、`safeMessage`。
- 默认 provider 为 dry-run，只返回 `ocr_required` 低敏状态。
- mock provider 用于测试 OCR 成功 / 失败闭环。
- disabled provider 用于验证未启用时失败路径。

## 6. OCR 状态与失败码

OCR 失败码统一低敏：

- `ocr_unsupported_file_type`
- `ocr_required`
- `ocr_empty_text`
- `ocr_file_too_large`
- `ocr_page_limit_exceeded`
- `ocr_image_too_large`
- `ocr_low_confidence`
- `ocr_provider_disabled`
- `ocr_service_failed`

机构端状态派生：

- `pending`
- `succeeded`
- `failed`
- `unsupported`
- `ocr_required`

## 7. 解析链路

- 图片文件进入 OCR-ready 流程，不把二进制内容当文本切片。
- 扫描 PDF / 空文本 PDF 返回 `ocr_required`。
- 默认 dry-run 不生成 chunk，避免脏片段进入检索。
- mock OCR 成功后清洗文本并复用现有 chunk 机制。
- OCR 文本成功保存后可进入 embedding 与 hybrid retrieval。

## 8. indexing job 接入

- 新增 `ocr_file` job type。
- `ocr_file` 复用 parse-like job runner。
- `rebuild_knowledge_index` 重新解析文件时可处理 OCR-ready 文件。
- 任务返回 DTO 仅包含 jobId、jobType、status、knowledgeId、fileId、counts、低敏失败码和安全消息。

## 9. API 安全边界

API response 禁止暴露：

- `storageKey`
- bucket
- signedUrl
- raw image buffer
- full OCR text
- embedding array
- provider / model / token / cost / vendor
- stack trace
- API key / baseUrl / secret

允许暴露：

- `fileId`
- `fileName` / `originalFilename`
- `mimeType`
- `parseStatus`
- `ocrStatus`
- `chunkCount`
- `warningCodes`
- `failureReasonCode`
- `safeMessage`
- job 低敏状态和 counts

## 10. 机构端 UI

机构端展示：

- 上传说明：TXT / MD / PDF / DOCX / XLSX / CSV / PNG / JPG，最大 2MB。
- 普通 PDF 文本抽取，扫描 PDF / 图片文字需要 OCR。
- OCR-ready 最小闭环边界。
- 不接外部云 OCR。
- 不做生产级批量 OCR、worker、queue、cron。
- 文件列表展示 parse status、OCR status、chunk count。
- 文件操作提供 `执行 OCR / 重建 OCR 索引`。

## 11. 测试覆盖

计划覆盖并保持：

1. TXT 解析不回归。
2. MD 解析不回归。
3. PDF 可复制文本解析不回归。
4. DOCX 解析不回归。
5. XLSX 解析不回归。
6. CSV 解析不回归。
7. PNG / JPG 进入 OCR-ready。
8. WEBP 在平台解析层可识别为 OCR-ready。
9. unsupported image 低敏失败。
10. 扫描 PDF 返回 `ocr_required`。
11. disabled OCR 低敏失败。
12. mock OCR success 生成 chunk。
13. mock OCR failed 不生成脏 chunk。
14. `ocr_file` job 成功。
15. `ocr_file` job failed 低敏记录。
16. `rebuild_knowledge_index` 处理 OCR-ready 文件不崩溃。
17. 机构隔离不回归。
18. 跨机构不可触发 OCR。
19. 上传 / API / UI 不暴露敏感字段。
20. UI 展示 OCR 状态、失败原因和边界说明。

## 12. 验证命令

必须运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests
node scripts/run-vitest.mjs run src/modules/open-platform/tests
node scripts/run-vitest.mjs run src/modules/knowledge-base/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/eslint .
node scripts/run-next.mjs build --webpack
git diff --check
```

## 13. 风险与后续

- 当前 OCR 为 ready contract，不是生产 OCR 服务。
- 生产化前需要补充 provider 凭据治理、质量评估、成本限额、重试/补偿、人工复核、灰度开关和回滚方案。
- 若未来接入真实 OCR，仍需保持低敏 API response 与机构隔离边界。
