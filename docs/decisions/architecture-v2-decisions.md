# 架构 V2 决策记录

- 日期：2026-07-27
- 基线：`035c4516f448ca3bfcd95ba835c32ac367e0d964`
- 状态：`accepted_for_v2_phase1`

## ADR-V2-001：采用垂直切片迁移

不执行全仓一次性搬迁。每次迁移必须同时服务于一个可验收业务切片。

## ADR-V2-002：七线是规范业务边界

最终七线模块为 `workbench`、`customers`、`conversations`、`care`、`knowledge`、`analytics`、`institution-system`。

## ADR-V2-003：旧 `institution` 模块冻结新增业务

`src/modules/institution/` 进入兼容层模式，只允许修复、兼容和迁出。

## ADR-V2-004：开放平台按领域拆分

`src/modules/open-platform/` 按 tenancy、entitlements、branding、AI integration 和 platform-system 垂直迁出。

## ADR-V2-005：外部适配器独立

HIS、企业微信、AI、Excel 和 webhook 的 provider/adapter 放入 `src/integrations/`。

## ADR-V2-006：Route Group 不改变公开 URL

机构端和平台端进入 `(institution)`、`(platform)` Route Group，但公开 URL 保持。

## ADR-V2-007：保留现有数据库资产目录

继续使用 `drizzle/`、`src/server/db/` 和 `scripts/db/`。

## ADR-V2-008：测试采用混合布局

模块测试继续共置；跨模块契约、安全、集成和 E2E 才进入根 `tests/`。

## ADR-V2-009：Migration 严格串行

`MIG-01A1` 只是 expand。完整关闭链为：

```text
MIG-01A1
→ MIG-01A2
→ BASE-02／writer 双写与 Guard 门禁
→ MIG-01B
→ MIG-01C
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

MIG-01C 与当前成员双键上下文完成前，不启动真实机构级 reader。每个 Migration 分别设计、授权、实施、升级验证和回退。

## ADR-V2-010：capability 与授权分离

`hidden/read_only/operational` 不证明当前用户、机构、对象或 action 已授权。

## ADR-V2-011：工作台最后发布

工作台只聚合正式 provider，不复制上游业务事实。

## ADR-V2-012：旧实现退出必须有证据

新所有者已发布、调用方归零、兼容观测完成、回退存在、测试环境验收通过后才允许删除。

## ADR-V2-013：不创建空目录

目标目录是所有权模型，只有首个获批文件进入时才创建。

## ADR-V2-014：架构完成度与业务发布分开

固定使用目录治理、架构物理落位、七线业务闭环和正式发布四个指标。

## ADR-V2-015：Security 与 Access Control 分离

`access-control` 只拥有 provenance、成员资格、机构／对象 guard 和 action policy。

密钥加密、低敏输出保护、安全开关及其他通用安全能力继续由 `security` 所有。现有 `src/modules/security/` 必须按职责垂直拆分，不得整体改名或整体搬入 `access-control`。

## ADR-V2-016：MIG-06 是双域共享迁移

`MIG-06` 同时承载：

- Analytics 的 snapshot、报告输入／输出、版本、归档和来源变化状态；
- Institution System 的持久化渠道安全状态。

共享只表示 schema/migration 统一串行编排，不改变领域所有权。System 不拥有 Analytics 报告事实，Analytics 不拥有渠道控制语义；两者均不得把 provider 凭证、外部 payload、消息正文或生产放行放入 MIG-06。

## ADR-V2-017：MIG-02 是 Customers 与 Care 共享迁移

`MIG-02` 必须保留客户稳定引用、责任归属、认领、随访任务、结构化结果和线性路径最小持久化。

Customers 解释客户引用与责任事实，Care 解释随访任务／路径事实；总协调台拥有唯一 migration 编排。任一模块都不能复制另一模块的 repository 或内部 DTO。

## ADR-V2-018：Knowledge 正式 Reader 等待 MIG-03

MIG-01C 只解决机构归属和基础隔离，不提供 Knowledge 的正式 current/version/publication 事实。

Knowledge 的 scope-bound repository、current reader 和正式机构页面必须等待 MIG-03。此前 mock／seed／demo、旧可覆盖 parse/index、mock embedding、内存索引和旧 preview 只能留在隔离命名空间，不能作为正式能力来源。

## ADR-V2-019：旧七线 API 路径采用逐路由薄兼容例外

旧七线计划中列出的 `src/app/api/institution/**` 继续证明业务路由族归属，但新实现默认进入 `src/app/api/v1/institution/**`。

旧非版本化端点只有进入 V2-02 白名单后，才可作为薄兼容 Route 保留。兼容 Route 只做服务端转发、输入兼容和安全响应映射，必须绑定 v1 owner、测试、调用方、观测、回退和删除门禁，不得承载第二套业务逻辑、repository 或 DTO。

## ADR-V2-020：Analytics 五页等待 MIG-06

`MIG-05` 只拥有消费事实、有效纠正链和确定性聚合，不包含 snapshot 或报告。

Analytics 的 snapshot repository/API、`AnalyticsCustomerConsumptionV1`、`AnalyticsDataGovernanceSummaryV1`、基础四页、报告页和最终五页发布申请必须等待 `MIG-06` 与 `AN-03C`。任何页面或 Workbench provider 都不得在 MIG-05 后绕过统一 snapshot 直接读取事实。
