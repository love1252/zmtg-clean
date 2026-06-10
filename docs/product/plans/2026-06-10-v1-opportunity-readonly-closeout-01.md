# V1-OPPORTUNITY-READONLY-CLOSEOUT-01：opportunity readonly 阶段总结

## 0. 文档元信息

- 任务编号：V1-OPPORTUNITY-READONLY-CLOSEOUT-01。
- 日期与时区：2026-06-10 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前阶段：V1 opportunity readonly 阶段 closeout。
- 当前基线：`main` / `origin/main` 为 `1662241449efed3fac85f94b12e3b4dd75ae06fc`。
- 最新已合并 PR：#245。
- 任务性质：docs-only / closeout-only / no runtime / no API / no UI / Draft PR only。

本文档只整理 V1 opportunity readonly 当前阶段已完成内容、未实现边界、后续授权门槛和暂停项。本文档不是开发许可，不是下一阶段开发计划，也不授权任何 runtime、API、UI、audit、dashboard 或字段白名单 enforcement 实现。

本文档中的后续候选任务只用于人工决策参考，不得自动执行，不得因为 closeout 完成就进入下一阶段。

## 1. 当前已完成内容

当前 V1 opportunity readonly 阶段已经完成以下主线内容：

- PR #240：V1 opportunity readonly domain slice。
- PR #241：feature flag / tenant / RBAC guard plan。
- PR #242：domain 边界测试补充。
- PR #243：UI guard plan。
- PR #244：API guard plan。
- PR #245：字段白名单 enforcement plan。

这些内容共同形成了 V1 opportunity readonly 的低敏只读 domain 基线、测试覆盖和接入前边界计划，但尚未进入 UI、API 或 runtime 接入。

## 2. 当前已具备能力

当前已具备的能力只限于：

- domain readonly view model：在 domain 层构造 V1 opportunity readonly 低敏只读摘要。
- 测试覆盖：覆盖 feature disabled、tenant mismatch、RBAC denied、empty、source missing、低敏字段输出、forbidden fields 缺席、blocked 状态无可执行动作等边界。
- guard / UI / API / whitelist 的计划文档：提前明确 feature flag、tenant、RBAC、UI 展示、API 响应和字段白名单 enforcement 的候选边界。

当前 domain readonly 能力仍只处理低敏摘要和安全状态，不读取数据库，不调用外部系统，不写状态，不创建任务、预约、成交，不发送消息。

## 3. 当前尚未实现

当前阶段尚未实现以下内容：

- UI。
- API。
- route。
- service / repository / DTO。
- runtime。
- feature flag runtime。
- RBAC runtime。
- tenant guard runtime。
- dashboard aggregation。
- audit runtime。
- 字段白名单 enforcement runtime。
- parser / mask / redact / sanitizer / middleware。
- schema / migration / SQL。
- 真实 HIS。
- credential。
- 真实客户数据。
- 自动营销 / 自动触达。

上述任何内容都不因本 closeout 文档而获得开发授权。

## 4. 后续建议不是开发许可

已有计划文档中出现的后续建议、候选拆分、验收项和风险提示，都只是人工决策参考，不是开发许可。

以下候选任务不得自动执行：

- audit input plan。
- dashboard guard plan。
- field whitelist enforcement runtime。
- API readonly route。
- UI readonly card。
- dashboard readonly entry。

如果未来要进入其中任一任务，必须重新由用户明确授权，并重新执行项目治理启动检查，声明任务编号、当前基线、允许文件、禁止文件、验证命令和停止条件。

## 5. Runtime 前授权门槛

如果后续进入任何 runtime，必须满足以下前置条件：

- 用户在当前任务中明确授权 runtime 范围。
- 单独 PR，且不得与 UI、API、dashboard、audit、schema / migration 混在同一 PR。
- 先写测试边界，再实现 runtime。
- feature flag 默认关闭。
- tenant guard 明确生效。
- RBAC guard 明确生效。
- 低敏 response 明确稳定。
- 字段白名单明确且受状态边界约束。
- blocked / ready 均无 mutation。
- rollback 明确回到不可用 / 空态 / 低敏拒绝态。
- 测试保持单文件或小范围，便于审查和回滚。

任何需要 schema、migration、SQL、真实 HIS、credential、真实客户数据、外部系统调用、自动营销或自动触达的任务，都必须另行审批，不能附带在 V1 opportunity readonly runtime 接入中。

## 6. 当前建议暂停项

当前建议在 closeout 后暂停继续添加计划文档，避免文档过度开发。

暂停原因：

- feature flag / tenant / RBAC、UI guard、API guard、字段白名单 enforcement 的主要边界已经形成。
- audit input 和 dashboard guard 的低敏原则已经在现有计划中被提及，继续扩展计划文档容易扩大范围。
- 当前更重要的是等待人工决定下一阶段，而不是继续生成候选计划或 backlog。

因此，本阶段建议停止在 closeout 后，不继续自动展开 audit、dashboard、API、UI、runtime 或字段白名单 enforcement。

## 7. 下一阶段人工决策点

closeout 后，人工可以选择继续暂停，也可以单独授权一个更小任务。可供人工选择的方向仅作为候选：

- 只读复核：继续只读检查主线状态，不改文件。
- docs-only 小任务：在明确必要时补一个 audit input plan 或 dashboard guard plan，但不建议连续扩张。
- test-only 小任务：只在明确授权时补充单文件测试边界。
- runtime 小任务：只在明确授权、先写测试边界、严格限制文件范围时考虑。

以上不是 backlog 扩张项，不构成自动开发队列，也不允许 Codex 在没有当前任务授权时主动开始。

## 8. Closeout 验收口径

本 closeout 完成后，应该满足：

- 只新增或修改 `docs/product/**`。
- 未修改 `src/**`。
- 未修改 tests。
- 未修改 schema / migration / SQL。
- 未修改 package 或 lockfile。
- 未实现 UI。
- 未实现 API。
- 未新增 route。
- 未修改 service / repository / DTO。
- 未实现 runtime。
- 未实现字段白名单 enforcement runtime。
- 未实现 parser / mask / redact / sanitizer / middleware。
- 未实现 feature flag / RBAC / tenant guard runtime。
- 未实现 dashboard aggregation 或 audit runtime。
- 未接真实 HIS。
- 未读取 credential。
- 未处理真实客户数据。
- 未自动营销或自动触达。
- 未新增 backlog 扩张项。

如任一项不成立，必须停止并拆分，不得继续推进 PR。

## 9. 阶段结论

V1 opportunity readonly 当前阶段已经完成低敏只读 domain 基线、必要测试覆盖和关键接入前计划。当前阶段不应继续自动扩张到 runtime、API、UI、audit、dashboard 或字段白名单 enforcement 实现。

建议本阶段在 closeout 后暂停，等待人工决定下一阶段是否继续、继续哪个最小任务、以及是否允许 runtime。
