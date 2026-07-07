# 智美天工 V0.6 Pilot Ready 系统总收口

## 1. 基线信息

- 日期 / 时区：2026-07-07 / Asia/Shanghai
- main commit：b7972eae7a98187116b6cf6c6fe8b577f8728beb
- 阶段：V0.6
- 任务：V0.6-PILOT-READY-SYSTEM-CLOSEOUT
- 总结论：智美天工 V0.6 达到受控演示 / 内部验收 / 试点准备完成口径

本系统总收口只统一知识库 V0.6 与智能随访 V0.6 两条已完成主线的试点准备口径，不开发新功能，不代表生产级 SaaS、真实 HIS 集成系统、真实渠道发送系统、自动营销系统或生产级 AI 医疗建议系统已经完成。

## 2. 已完成主线

### 知识库 V0.6

知识库 V0.6 已完成：

1. RAG 问答最小闭环，支持机构端知识库问答区域、引用 sources、no-answer 和低敏失败态。
2. provider / quota / usage / audit，具备 provider 统一治理、额度前置、usage 记录和 QA audit 低敏记录。
3. embedding / hybrid retrieval / rerank，支持 embedding、vector search、keyword / vector / hybrid retrieval 和 deterministic rerank。
4. indexing job pipeline，覆盖 parse、embedding、rebuild 等 DB-backed minimal indexing job flow。
5. 复杂文档解析，覆盖常见文件解析、chunk 和安全失败边界。
6. OCR-ready，具备图片 / 扫描件边界、`ocr_required` 状态和后续真实 OCR provider 预留。
7. 套餐权益与额度治理，覆盖知识库条目、文件、容量、解析、向量、OCR、RAG answer 和索引重建等资源口径。
8. 端到端验收，已有本地 5010 end-to-end acceptance 和可复核证据。
9. pilot readiness / closeout，已形成 04C 试点前准备与 04D 最终 closeout 基线。

### 智能随访 V0.6

智能随访 V0.6 已完成：

1. 00：智能随访基线，定义开发终点、模块联动、风险边界和收尾方式。
2. 01A：治疗事件 → 路径纳入 → 阶段任务，支持路径匹配、path enrollment、D1 / D3 / D7 等阶段任务、重复纳入阻断和 cancel enrollment。
3. 01B：消息模板 / 草稿 / 人工确认，支持 message template、低敏 draft、编辑、确认、拒绝和标记已人工发送。
4. 01C：客户时间线 / 随访轨迹，沉淀路径纳入、阶段任务、草稿处理和人工低敏反馈。
5. 01D：运营看板 / 路径效果，只读聚合今日待随访、逾期、高风险、路径执行、草稿处理和角色工作量。
6. 01E：Pilot Ready Closeout，明确智能随访 V0.6 达到受控演示 / 内部验收 / 试点准备完成口径。

## 3. 系统级主链路

智美天工 V0.6 当前系统级主链路为：

知识库 SOP / 话术依据
+
治疗事件 / 治疗摘要
→ 路径匹配
→ 客户纳入随访路径
→ 阶段任务生成
→ 消息草稿
→ 人工确认 / 拒绝 / 标记已人工发送
→ 客户时间线沉淀
→ 运营看板汇总
→ 内部复盘与试点演示

知识库在该链路中只作为内部 SOP、话术依据和运营参考来源；智能随访将治疗后事件转为人工可执行、可追踪、可复盘的运营任务。系统不自动联系客户，不替代医疗判断，不做自动营销。

## 4. 当前可演示能力

1. 知识库问答与检索能力。
2. 文档解析、索引、检索、rerank。
3. 套餐权益与额度治理口径。
4. 水光 / 光子 / 双眼皮 / 皮肤管理路径匹配。
5. path enrollment 创建、展示与取消。
6. D1 / D3 / D7 阶段任务。
7. 任务状态流转和来源追踪。
8. message draft 草稿生成、编辑、确认、拒绝、标记已人工发送。
9. 客户随访轨迹。
10. 人工低敏反馈。
11. 智能随访运营看板。
12. 5010 页面/API 空数据验收口径：空库无业务数据时展示低敏空态或 0 值结构，不 seed、不阻断。

## 5. 不可宣称能力

1. 生产级正式上线。
2. 真实 HIS 接入。
3. 真实企业微信发送。
4. 真实短信发送。
5. 电话外呼。
6. 客户自动回复。
7. 自动营销群发。
8. AI 自动生成并直接发送客户可见医疗建议。
9. 真实渠道 delivery / reply 回流。
10. 真实支付账单。
11. 真实收入归因 / 完整 BI。
12. 生产环境压测完成。

## 6. 试点演示口径

建议演示顺序：

1. 先演示知识库：上传 / 解析 / 索引 / 检索 / 内部问答。
2. 再演示智能随访：治疗事件触发路径。
3. 演示水光路径生成 D1 / D3 / D7 任务。
4. 演示消息草稿和人工确认。
5. 演示客户时间线沉淀。
6. 演示运营看板汇总。
7. 全程强调：不自动联系客户，不替代医疗判断。

演示时应优先使用低敏样本数据和本地 / 受控环境。若无真实业务数据，页面和 API 空态仍可作为试点准备口径的一部分。

## 7. 安全边界

1. 不自动触达客户。
2. 所有客户可见内容必须人工确认。
3. 标记已发送仅代表人工记录。
4. 不替代医疗判断。
5. 不保存或返回手机号原文 / 身份证 / 病历号 / HIS payload。
6. 不保存 provider / model / token / cost / vendor。
7. 不调用真实 AI provider。
8. 不真实出网。
9. tenant / institution 隔离。
10. 关键动作有 audit / timeline 记录。

## 8. 试点前仍需人工准备

1. 演示租户。
2. 演示机构。
3. 低敏客户样本。
4. 低敏治疗摘要样本。
5. 水光 / 光子 / 双眼皮路径样本。
6. 知识库 SOP 文档样本。
7. 演示账号和权限。
8. 演示脚本。
9. 风险提示话术。
10. 不可宣称清单。

这些准备项是试点演示质量和安全边界的一部分，不应通过临时接入真实生产系统、真实渠道或真实敏感数据来替代。

## 9. V0.6 功能冻结规则

V0.6 closeout 后只允许：

1. bugfix。
2. 验收补缺。
3. 文档纠错。
4. 低风险 UI 文案修正。
5. 演示数据准备。

禁止继续塞入：

1. 渠道发送。
2. HIS 接入。
3. 客户回复接入。
4. 自动营销。
5. AI 自动客户触达。
6. 复杂 BI。
7. 支付账单。

## 10. V0.7 优先级建议

V0.7 建议按以下顺序推进：

1. 先做演示数据与试点脚本。
2. 再做企业微信 / 短信 channel contract。
3. 再做 MessageDelivery。
4. 再做客户回复回流。
5. 再做 HIS 标准事件接入。
6. 再做 consent / opt-out / frequency cap。
7. 再做套餐 quota 绑定。
8. 最后做真实试点灰度和生产压测。

该顺序优先把试点演示和安全边界做扎实，再逐步进入真实渠道、客户回复、HIS 和生产级治理。

## 11. 验收记录

本轮 closeout 已执行以下命令：

- `node scripts/run-vitest.mjs run src/modules/institution/tests`：通过，80 files / 1127 tests。
- `node scripts/run-vitest.mjs run src/modules/open-platform/tests`：通过，94 files / 650 tests。
- `node scripts/run-vitest.mjs run src/modules/knowledge-base/tests`：通过，11 files / 80 tests。
- `node scripts/run-vitest.mjs run`：通过，221 files / 2211 tests。
- `./node_modules/.bin/eslint .`：通过，0 errors / 4 existing warnings。
- `node scripts/run-next.mjs build --webpack`：通过。
- `./node_modules/.bin/drizzle-kit check`：通过，Everything's fine。
- `git diff --check`：通过。

额外边界确认：

- `git diff -- drizzle`：无 diff。
- `git diff -- src/server/db/schema.ts`：无 diff。
- `git diff -- package.json pnpm-lock.yaml package-lock.json yarn.lock`：无 diff。

5010 本地验收按任务要求在当前 PR head 上执行，结果记录于 PR body 和最终回报。验收必须只使用 localhost / 127.0.0.1，不连接疑似生产 DATABASE_URL，不输出旧 DATABASE_URL，不 seed，不 reset，不删除非本任务创建的 DB / container。

## 12. 最终结论

智美天工 V0.6 已完成“知识库 + 智能随访”两条主线的内部闭环，具备受控演示、内部验收、试点准备条件。

后续进入 V0.7 前，应先完成演示数据和试点脚本，不建议立刻进入真实渠道发送或 HIS 集成。任何真实 HIS、企业微信 / 短信、客户回复回流、真实 AI provider、支付账单、复杂 BI、生产压测和真实试点灰度，都必须作为 V0.7 或独立审批任务重新定义范围、风险、验收和回滚策略。
