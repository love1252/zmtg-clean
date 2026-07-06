# V0.6 知识库最终收口基线 04D

## 1. 基线信息

- 日期 / 时区：2026-07-06 / Asia/Shanghai
- main commit：`14d94886d294a1698df6b6daaff8b9ee4edfdd99`
- 阶段：V0.6
- closeout 标识：`V0.6-KB-PILOT-READY-CLOSEOUT`

## 2. 最终结论

知识库主链路已达到受控演示 / 内部验收 / 试点准备完成口径。

该结论表示 V0.6 已形成从机构端知识文件、解析、chunk、索引、检索、RAG answer、OCR-ready 边界、quota / entitlement 治理到验收与试点准备文档的闭环。

该结论不等同于：

1. 生产级 OCR 已完成。
2. 生产级 AI provider 回答质量已验证。
3. 生产级 worker / queue / cron 已完成。
4. 真实支付、账单或发票链路已完成。
5. 真实 HIS 集成已完成。
6. 生产环境压测已完成。
7. 真实客户数据试点已完成。

## 3. 已完成能力基线

| 切片 | 能力 | 基线说明 |
| --- | --- | --- |
| 03A | RAG 问答最小闭环 | 机构端具备知识库问答区域、sources、no-answer 和低敏失败态。 |
| 03B | provider governance / quota / usage / audit | 已补充 provider 统一治理、quota 前置、usage 记录和 QA audit 低敏记录。 |
| 03C | embedding / vector / hybrid retrieval / rerank | 已具备 embedding、vector search、keyword / vector / hybrid retrieval 和 deterministic rerank。 |
| 03D | indexing job pipeline | 已具备 DB-backed minimal indexing job flow，覆盖 parse、embedding 和 rebuild 类任务。 |
| 03E | TXT / MD / PDF / DOCX / XLSX / CSV 解析 | 已支持常见文档格式的文本抽取和低敏失败原因。 |
| 03F | OCR-ready | 已具备 OCR-ready contract、图片 / 扫描件边界和 `ocr_required` 状态。 |
| 03G | entitlement / quota governance | 已补齐知识库条目、文件、容量、解析、向量、OCR、RAG answer、索引重建等资源治理。 |
| 04A | 端到端验收 | 已完成本地 5010 end-to-end acceptance，并归档到 `docs/product/acceptance/`。 |
| 04B | 产品文档目录规范 | 已新增 `docs/product/README.md` 并将 04A 验收报告迁入 acceptance 目录。 |
| 04C | 试点前准备与收尾目标 | 已明确可演示清单、不可宣称清单、人工兜底、演示脚本和 bugfix / V0.7 判断。 |

## 4. 功能冻结规则

04D 合并后，知识库 V0.6 不再追加大功能。

允许继续进行：

1. bugfix。
2. 验收补缺。
3. 文档纠错。

不允许继续作为 V0.6 追加：

1. 新能力开发。
2. 新 schema / migration。
3. 大范围 UI 改造。
4. 新 worker / queue / cron。
5. 新 provider 接入。
6. 新支付、账单、HIS、真实客户数据试点。

新能力必须进入 V0.7 backlog 或独立审批任务。任何新增 schema / migration / UI 大改都必须以 V0.7 任务立项，并重新定义范围、风险、验收和回滚策略。

## 5. V0.6 bugfix 范围

以下问题仍属于 V0.6 bugfix 范围：

1. 页面白屏。
2. API 500。
3. 跨机构隔离失败。
4. quota 未拦截。
5. 低敏字段泄漏。
6. 已有按钮不可用。
7. 已有测试回归。
8. 文档路径或验收记录错误。

V0.6 bugfix 应保持小范围、可审查、可回滚，不夹带 V0.7 新能力。

## 6. V0.7 backlog

以下能力进入 V0.7 backlog 或独立审批任务：

1. 真实 OCR provider。
2. 真实 AI provider 回答质量评测。
3. 生产级 worker / queue / cron。
4. 生产级文件存储治理。
5. 真实支付账单。
6. HIS 集成。
7. 生产压测。
8. 真实客户数据试点。
9. 多租户生产安全审计。

## 7. 回归验收基准

知识库 V0.6 后续 bugfix 或 release closeout 的回归验收基准如下：

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

docs-only 纠错不要求每次运行全部命令；一旦涉及 runtime、测试、schema、migration、配置或依赖，应重新执行相关命令并记录结果。

## 8. 5010 验收基准

5010 本地验收参考：

1. `docs/dev/local-acceptance-env.md`
2. `scripts/dev/local-acceptance-db.sh`
3. `docs/product/acceptance/2026-07-06-v06-kb-end-to-end-acceptance-04a.md`
4. `docs/product/acceptance/2026-07-06-v06-kb-pilot-readiness-04c.md`

5010 验收基准：

1. 只使用 localhost / `127.0.0.1` 本地验收 DB。
2. 不连接生产库。
3. 不输出 secret、API key、provider config 或 `DATABASE_URL` 原值。
4. 不 seed / reset / drop 既有数据库。
5. 检查 `GET /api/version`，确认命中目标 commit。
6. 检查 `/hospital`，确认机构端页面可打开。
7. 检查知识库页面，确认文件、解析、chunk、检索、问答、索引任务区域可见。
8. 检查平台端权益页面，确认知识库权益配置和用量口径可见。
9. 检查机构端权益摘要，确认知识库额度、已用量、剩余量和状态可见。
10. 检查 hybrid retrieval / RAG answer / indexing jobs / OCR-ready 文案。

## 9. 可演示最终清单

知识库 V0.6 最终可演示能力：

1. 平台端查看 / 配置知识库权益。
2. 机构端查看“我的知识库套餐权益”。
3. 上传 TXT / MD / CSV / PDF / DOCX / XLSX。
4. 查看解析状态、`chunkCount`、失败低敏原因。
5. 查看索引任务列表、任务类型、状态、进度和 safeMessage。
6. 触发 parse / embedding / rebuild job。
7. 执行 keyword / vector / hybrid 检索。
8. 展示 deterministic rerank 说明。
9. 展示 RAG answer 区域和 sources。
10. provider 未配置时展示低敏 `provider_disabled`。
11. 展示 OCR-ready 文案和 `ocr_required` 状态。
12. 展示 quota / 超额低敏提示。
13. 查看 usage / quota / QA audit 的低敏记录。

## 10. 不可宣称最终清单

知识库 V0.6 最终不可宣称：

1. 生产级 OCR 已完成。
2. 扫描件识别质量已验证。
3. 真实外部 AI provider 回答质量已验证。
4. 已完成生产级 worker / queue / cron。
5. 已完成真实支付 / 账单 / 发票。
6. 已完成真实 HIS 对接。
7. 已完成生产环境压测。
8. 已完成真实客户数据试点。
9. 已完成生产级多租户安全审计。

## 11. 交接说明

后续接手者应从以下文档开始：

1. `docs/product/README.md`
2. `docs/product/acceptance/2026-07-06-v06-kb-end-to-end-acceptance-04a.md`
3. `docs/product/acceptance/2026-07-06-v06-kb-pilot-readiness-04c.md`
4. `docs/product/baselines/2026-07-06-v06-kb-closeout-baseline-04d.md`

接手原则：

1. V0.6 只处理 bugfix、验收补缺和文档纠错。
2. 新功能、新 schema / migration、新 provider、新 worker / queue / cron、真实 OCR、真实 HIS、真实支付账单、生产压测和真实客户数据试点均进入 V0.7 或独立审批任务。
3. 所有后续改动都应先确认当前 `main`、工作树状态、任务编号和允许修改范围。
