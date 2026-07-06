# V0.6 知识库试点前准备与收尾目标 04C

## 1. 基线信息

- 日期 / 时区：2026-07-06 / Asia/Shanghai
- main commit：`7be061ef52b0515ad4f3ee9310500dff5e7b1fa5`
- 阶段：V0.6
- 结论：知识库主链路已达到受控演示 / 内部验收口径，但尚不等同于生产级上线。

## 2. V0.6 知识库开发终点

V0.6 知识库开发终点定义为：

`V0.6-KB-PILOT-READY-CLOSEOUT`

该终点表示：

1. 功能闭环完成：机构端知识库从文件上传、解析、chunk、索引、检索到 RAG answer 的主链路具备受控演示闭环。
2. 端到端验收完成：04A 已完成本地 5010 end-to-end acceptance，并形成可复核证据。
3. 演示脚本完成：试点前可按固定步骤演示平台端权益、机构端权益、上传、解析、索引、检索、RAG answer、OCR-ready 与 quota 边界。
4. 回归验收清单完成：明确测试、lint、build、Drizzle check、5010 本地验收和 `git diff --check` 的执行口径。
5. 风险边界完成：明确哪些能力可演示，哪些能力不能对外宣称，哪些场景需要人工兜底。
6. closeout 文档完成：04C 完成后进入 04D 最终 closeout 基线。
7. 之后不再追加知识库 V0.6 大功能，只做 bugfix 和收尾；新增生产级能力进入 V0.7 或独立审批任务。

## 3. 已完成能力清单

| 切片 | 已完成能力 | 试点前口径 |
| --- | --- | --- |
| 03A | RAG answer 最小闭环 | 可演示机构端知识库问答区域、sources 和低敏 no-answer / failure 状态。 |
| 03B | provider governance / quota / usage / audit | 可演示 provider 统一治理、quota 前置、usage 和 QA audit 低敏记录。 |
| 03C | embedding / vector / hybrid retrieval / rerank | 可演示 keyword / vector / hybrid 检索、deterministic rerank 和不返回 embedding array 的边界。 |
| 03D | indexing job pipeline | 可演示 DB-backed minimal job flow、parse / embedding / rebuild job 状态和 safeMessage。 |
| 03E | TXT / MD / PDF / DOCX / XLSX / CSV 解析 | 可演示多格式文本抽取和低敏失败原因；不宣称复杂生产解析质量。 |
| 03F | OCR-ready | 可演示 PNG / JPG / 扫描 PDF 的 OCR-ready 入口、`ocr_required` 状态和生产 OCR 未接入边界。 |
| 03G | entitlement / quota governance | 可演示平台端配置知识库权益、机构端查看权益摘要、超额低敏提示。 |
| 04A | end-to-end acceptance | 已完成本地 5010 端到端验收报告。 |
| 04B | docs taxonomy | 已将验收报告归档到 `docs/product/acceptance/` 并新增产品文档目录规范。 |

## 4. 可演示清单

试点前可以在受控演示中展示：

1. 平台端查看 / 配置知识库权益。
2. 机构端查看“我的知识库套餐权益”。
3. 上传 TXT / MD / CSV / PDF / DOCX / XLSX。
4. 查看解析状态、`chunkCount`、失败低敏原因。
5. 查看索引任务列表、任务类型、任务状态、进度和 safeMessage。
6. 触发 parse / embedding / rebuild job。
7. 执行 keyword / vector / hybrid 检索。
8. 展示 RAG answer 区域。
9. provider 未配置时展示低敏 `provider_disabled`。
10. 展示 OCR-ready 文案和 `ocr_required` 状态。
11. 展示 quota / 超额低敏提示。

## 5. 不可宣称清单

试点前不能对外宣称：

1. 生产级 OCR 已完成。
2. 扫描件识别质量已验证。
3. 真实外部 AI provider 回答质量已验证。
4. 已完成生产级 worker / queue / cron。
5. 已完成真实支付 / 账单 / 发票。
6. 已完成真实 HIS 对接。
7. 已完成生产环境压测。
8. 已完成真实客户数据试点。

## 6. 人工兜底场景

| 场景 | 人工兜底方式 |
| --- | --- |
| `provider_disabled` | 人工查看 sources、原始知识片段和文件名，不把回答失败解释为知识库不可用。 |
| OCR-ready 文件 | 人工确认是否后续进入真实 OCR provider 评估；当前只展示 `ocr_required` 边界。 |
| 文档解析失败 | 人工换格式、拆分文件、降低页数 / sheet / 行数，或转为 TXT / CSV 后再上传。 |
| 超额 / quota exceeded | 由平台端调整权益、套餐或用量；机构端只展示低敏不可用原因。 |
| RAG answer | 只做运营参考，需人工确认，不能自动触达客户，不能替代医生或咨询师判断。 |
| 解析 / 索引任务失败 | 按 job `safeMessage`、`failureReasonCode`、文件类型和任务类型排查，不输出堆栈或内部配置。 |

## 7. 演示脚本

建议按以下步骤演示：

1. 打开平台端。
2. 查看套餐 / 权益配置，说明知识库条目、文件、容量、解析、向量、OCR、问答和索引重建额度。
3. 打开机构端。
4. 查看“我的知识库套餐权益”摘要，确认已用量、剩余额度和状态。
5. 上传一份低敏 TXT 或 CSV 文件。
6. 查看 parse job 状态，确认成功或低敏失败原因。
7. 查看文件 chunk，确认 `chunkCount` 和片段预览。
8. 生成 / 重建向量索引。
9. 查看 indexing jobs，确认 `generate_embeddings` 或 `rebuild_embeddings` 状态。
10. 执行 hybrid retrieval，查看 keyword / vector / hybrid 命中和 deterministic rerank 说明。
11. 提问 RAG answer。
12. 查看真实 answer 或本地未配置 provider 时的 `provider_disabled`，同时查看 sources。
13. 查看 usage / quota / QA audit 的低敏记录。
14. 上传或展示 OCR-ready 文件，说明 `ocr_required` 和生产 OCR 未接入边界。
15. 展示不可宣称边界，明确当前是受控演示 / 内部验收，不等同于生产级上线。

## 8. 回归验收命令

回归验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests
node scripts/run-vitest.mjs run src/modules/open-platform/tests
node scripts/run-vitest.mjs run src/modules/knowledge-base/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/eslint .
node scripts/run-next.mjs build --webpack
./node_modules/.bin/drizzle-kit check
git diff --check
```

docs-only 改动不要求每次都运行全部命令；若进入 runtime bugfix 或 release closeout，应按上方命令执行并记录结果。

## 9. 5010 验收步骤

本地 5010 验收必须参考：

1. `docs/dev/local-acceptance-env.md`
2. `scripts/dev/local-acceptance-db.sh`

执行原则：

1. 只使用 localhost / `127.0.0.1` 本地验收 DB。
2. 不连接生产库。
3. 不输出 secret、API key、provider config 或 `DATABASE_URL` 原值。
4. 不 seed / reset / drop 既有数据库。
5. 检查 `GET /api/version`，确认命中当前 commit。
6. 检查 `/hospital`，确认机构端页面可打开。
7. 检查知识库页面，确认文件、解析、chunk、检索、问答、索引任务区域可见。
8. 检查平台端权益页面，确认知识库权益配置和用量口径可见。
9. 检查机构端权益摘要，确认知识库额度、已用量、剩余量和状态可见。
10. 检查 hybrid retrieval / RAG answer / indexing jobs / OCR-ready 文案。

## 10. 失败定位

| 失败项 | 定位方式 | V0.6 处理口径 |
| --- | --- | --- |
| 5010 启动失败 | 检查端口占用、Next dev 日志、本地 DB 是否 ready。 | 若是已有入口不可用，按 bugfix；若是环境问题，记录验收阻塞。 |
| migration 缺失 | 使用本地验收 DB 执行 migration，并检查关键表 / 字段 / enum。 | 已合并 migration 缺失属于 V0.6 bugfix。 |
| `next-env.d.ts` dirty | 确认是否为 Next dev 自动声明路径变化。 | 只允许按授权恢复该文件，不提交。 |
| `provider_disabled` | 检查 provider 配置是否缺失或未启用。 | 本地无真实 provider 时属于预期低敏状态；生产配置异常按 bugfix。 |
| `quota_exceeded` | 检查 tenant 权益、用量和资源键。 | quota 应挡住写入或调用；未挡住属于 V0.6 bugfix。 |
| `parse_failed` | 检查文件类型、大小、页数、sheet、行数、是否 malformed。 | 已支持格式异常 500 属于 bugfix；复杂解析质量提升进入 V0.7。 |
| `ocr_required` | 检查文件是否扫描 PDF / 图片文字。 | 当前为预期 OCR-ready 边界；真实 OCR 进入 V0.7。 |
| embedding failed | 检查 chunk 是否存在、文件是否 active、parse 是否 succeeded、provider 是否可用。 | 已有按钮或 API 失败属于 bugfix；生产级向量基础设施进入 V0.7。 |
| job failed | 查看 job type、`failureReasonCode`、`safeMessage`、counts。 | 已有任务异常 500 或卡死属于 bugfix；生产级 worker 进入 V0.7。 |
| build failed | 查看 TypeScript / Next build 输出。 | 由 V0.6 改动导致的失败必须修复。 |
| test failed | 定位失败测试、涉及模块和最近 diff。 | 既有测试回归属于 V0.6 bugfix；新增大能力测试进入 V0.7。 |

## 11. V0.6 bugfix vs V0.7 backlog 判断

### V0.6 bugfix

以下问题应作为 V0.6 bugfix：

1. 已有按钮报错。
2. 已有 API 500。
3. 低敏字段泄漏。
4. quota 没挡住。
5. 跨机构隔离失败。
6. 页面白屏。
7. 已有测试回归。

### V0.7 backlog

以下问题应进入 V0.7 backlog 或独立审批任务：

1. 真实 OCR provider。
2. 真实 AI provider 质量评测。
3. worker / queue / cron。
4. 生产级文件存储治理。
5. 真实支付账单。
6. HIS 集成。
7. 生产压测。
8. 真实客户数据试点。

## 12. 最终收尾路线

1. 04C：试点前准备文档。
2. 04D：知识库 V0.6 最终 closeout 基线。
3. 04D 完成后，知识库 V0.6 功能开发冻结。
4. 后续只允许 bugfix 或进入 V0.7。
