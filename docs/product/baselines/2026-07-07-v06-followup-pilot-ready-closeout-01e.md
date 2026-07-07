# V0.6 智能随访 Pilot Ready Closeout 01E

## 1. 基线信息

- 日期 / 时区：2026-07-07 / Asia/Shanghai
- main commit：7c13b90690a64cd2572f205d89a77cc778f04bec
- 阶段：V0.6
- closeout 任务：FOLLOWUP-PILOT-READY-CLOSEOUT-01E
- 结论：智能随访 V0.6 达到受控演示 / 内部验收 / 试点准备完成口径

本 closeout 只做文档收口和验收复核，不开发新功能，不代表生产级自动随访系统、真实渠道发送系统、真实 HIS 集成系统或自动营销系统已经完成。

## 2. 已完成 PR / 阶段清单

- #458：FOLLOWUP-BASELINE-00。完成智能随访 V0.6 现状基线、开发终点、阶段路线、模块联动、风险边界和 closeout 方式定义。
- #459：FOLLOWUP-PATH-ENROLLMENT-FIRST-SLICE-01A。完成从治疗摘要识别标准化治疗事件、匹配路径模板、创建 path enrollment、生成 D1 / D3 / D7 等阶段任务、重复纳入阻断、cancel enrollment 和智能随访页面路径实例展示。
- #460：FOLLOWUP-MESSAGE-DRAFT-01B。完成 message template / draft 数据闭环，支持基于 follow-up task 生成低敏草稿、编辑、人工确认、拒绝、标记已人工发送，并保持无真实渠道发送边界。
- #461：FOLLOWUP-TIMELINE-01C。完成客户随访时间线沉淀，记录路径纳入、阶段任务、草稿处理、人工低敏反馈和客户详情中的随访轨迹展示。
- #462：FOLLOWUP-OPERATIONS-DASHBOARD-01D。完成智能随访运营看板，只读聚合今日待随访、逾期、高风险、路径执行、草稿处理、人工反馈和角色工作量。

## 3. 当前完整主链路

智能随访 V0.6 当前主链路为：

治疗事件
→ 路径纳入
→ 阶段任务生成
→ 消息草稿
→ 人工确认 / 拒绝 / 标记已人工发送
→ 客户时间线沉淀
→ 运营看板汇总

这条链路的目标是把治疗后运营动作变成可执行、可追踪、可复盘的内部工作流。它不直接触达客户，不替代医生判断，不做自动营销群发。

## 4. 可演示能力

1. 水光 / 光子 / 双眼皮 / 皮肤管理路径匹配。
2. path enrollment 创建与展示。
3. D1 / D3 / D7 等阶段任务生成。
4. 重复纳入阻断，避免同一治疗事件重复创建路径实例。
5. cancel enrollment，支持人工取消路径实例。
6. message template / draft，支持内置模板和低敏 fallback 草稿。
7. 草稿生成、编辑、确认、拒绝、标记已人工发送。
8. 客户随访时间线，展示路径、任务、草稿和反馈的低敏轨迹。
9. 人工低敏反馈，支持记录内部运营备注和风险提示。
10. 智能随访运营看板，聚合路径执行、今日待办、逾期、高风险、草稿处理和角色工作量。
11. 5010 页面/API 空数据验收口径：空库无真实业务数据时，页面和 API 应展示低敏空态或 0 值结构，不 seed、不阻断。

## 5. 不可宣称能力

1. 生产级自动随访系统。
2. 真实企业微信发送。
3. 真实短信发送。
4. 电话外呼。
5. 真实 HIS 接入。
6. 客户自动回复。
7. 自动营销群发。
8. AI 自动生成并直接发送客户可见医疗建议。
9. 真实渠道 delivery / reply 回流。
10. 真实收入归因 / 完整 BI。
11. 生产环境压测完成。

## 6. 安全边界

1. 不自动触达客户。
2. 所有客户可见内容必须人工确认。
3. 标记已发送仅代表人工记录。
4. 不替代医疗判断。
5. 不保存或返回手机号原文 / 身份证 / 病历号 / HIS payload。
6. 不保存 provider / model / token / cost / vendor。
7. 不调用真实 AI provider。
8. 不真实出网。
9. tenant / institution 隔离：所有路径、任务、草稿、客户时间线和运营看板数据均按当前访问上下文过滤。
10. 关键动作有 audit / timeline 记录，包括路径纳入、任务生成、草稿确认、拒绝、标记已人工发送和人工反馈。

## 7. 数据与模块联动

1. 与治疗摘要 / 治疗事件联动：治疗摘要提炼出的标准化治疗事件用于触发路径匹配和随访任务编排。
2. 与路径模板联动：水光、光电、术后修复、皮肤管理等模板定义路径节点、阶段任务、角色和风险提示。
3. 与 follow-up task 联动：路径阶段生成任务，任务保持人工处理边界，并作为草稿和看板聚合的核心对象。
4. 与 message draft 联动：草稿绑定 follow-up task / enrollment / stage，只返回低敏预览和人工处理状态。
5. 与 customer timeline 联动：路径纳入、任务流转、草稿处理和人工反馈进入客户随访轨迹。
6. 与 operations dashboard 联动：dashboard 聚合路径、任务、草稿和 timeline 事件，输出运营只读指标。
7. 与知识库联动边界：知识库只作为内部 SOP / 话术依据，不自动回复客户，不把 RAG 输出直接发送给客户。
8. 与套餐权益联动后续预留：路径数量、任务数量、草稿数量、渠道发送数量可在 V0.7 或后续权益治理中纳入 quota。

## 8. 验收命令记录

本轮 closeout 已执行以下验证命令：

- `node scripts/run-vitest.mjs run src/modules/institution/tests`：通过，80 files / 1127 tests。
- `node scripts/run-vitest.mjs run src/modules/open-platform/tests`：通过，94 files / 650 tests。
- `node scripts/run-vitest.mjs run src/modules/knowledge-base/tests`：通过，11 files / 80 tests。
- `node scripts/run-vitest.mjs run`：通过，221 files / 2211 tests。
- `./node_modules/.bin/eslint .`：通过，0 errors / 4 existing warnings。
- `node scripts/run-next.mjs build --webpack`：通过。
- `./node_modules/.bin/drizzle-kit check`：通过，Everything's fine。
- `git diff --check`：通过。

## 9. 5010 验收口径

本 closeout 的 5010 本地验收必须满足：

1. `/api/version` 200。
2. `/hospital` 200。
3. 智能随访页面可打开。
4. 路径实例区域可见或空态合理。
5. 消息草稿区域可见或空态合理。
6. 客户随访轨迹区域可见或空态合理。
7. 运营看板区域可见或空态合理。
8. fake API 返回低敏 404 / not_found。
9. 空库无业务数据时不 seed，不阻断。
10. 未发现敏感字段泄露。
11. 未真实发送消息。
12. 未真实出网。

验收只能使用 localhost / 127.0.0.1，不连接疑似生产 DATABASE_URL，不输出旧 DATABASE_URL，不 seed，不 reset，不删除非本任务创建的 DB / container。

## 10. V0.6 功能冻结规则

智能随访 V0.6 closeout 后，只允许：

1. bugfix。
2. 验收补缺。
3. 文档纠错。
4. 低风险 UI 文案修正。

禁止继续塞入：

1. 渠道发送。
2. HIS 接入。
3. 客户回复接入。
4. 自动营销。
5. AI 自动客户触达。
6. 复杂 BI。

## 11. V0.7 backlog

1. 企业微信 / 短信渠道接入。
2. MessageDelivery。
3. 客户回复回流。
4. consent / opt-out / frequency cap。
5. HIS 标准事件接入。
6. 渠道失败重试和发送审计。
7. 套餐权益 / quota 绑定。
8. 路径模板平台端可视化管理增强。
9. 真实试点机构灰度。
10. 生产压测和安全审计。

## 12. 最终结论

智能随访 V0.6 已完成从“治疗事件”到“运营看板”的内部闭环，达到受控演示 / 内部验收 / 试点准备完成口径。

该结论只适用于当前仓库 main commit `7c13b90690a64cd2572f205d89a77cc778f04bec` 的 V0.6 受控演示范围。对外或生产口径必须继续保留人工确认、低敏字段、无真实渠道发送、无真实 HIS 接入、无真实 AI provider 调用和无自动营销边界。
