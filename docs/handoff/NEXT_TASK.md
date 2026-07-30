# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 的 accepted 决策、仓库硬门、受控 Runner 治理基础、本地环境只读预检、本地就绪修复 Stage A、Stage B 和 Candidate Governance 已分别通过独立 PR 完成；本四文件 handoff 负责收口 Stage C-0：

- accepted 决策：PR #801；
- 治理 Stage A 仓库硬门：PR #804，handoff PR #805；
- 治理 Stage B Runner 基础：PR #807，handoff PR #808；
- 本地环境只读预检：PR #809，handoff PR #810；
- 本地就绪修复 Stage A：PR #811，handoff PR #812；
- 本地就绪修复 Stage B：PR #814；
- Candidate Governance／Stage C-0：PR #816；
- PR #816 Base：`0be5faf5b089fdf3b5e0c84f3dac09d1283368d2`；
- PR #816 Head：`4df7cac76887b5cc3336650911dfc7f0448516e5`；
- PR #816 Merge Commit：`eb7cde613c38e262aeb8519c53e7e3d21704b18f`；
- PR #816 Required Check：Run `30524750504`／Job `90813002538`，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 当前 `main` 保护和“最小架构与质量门禁”Required Check 继续生效。

Stage B 已建立固定本地验收 Context Policy 与可注入只读 PostgreSQL Adapter。PR #816 随后建立 `mig01-a2-candidate/v1` Candidate Contract、独立 canonicalization／digest、低敏 Source 契约和 `generated → review_pending` Reviewer 生命周期，关闭 `candidate_contract_missing`。当前 Source 只有 test-only `local_acceptance_fixture`，不能作为 Stage C 的真实来源；没有生成真实 Candidate、创建 Approved Manifest、运行 Runner dry-run／`--execute`、签发 Lease，也未启动 A2-P1／P2。`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断。

## 唯一下一任务

```text
V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-C
本地验收 Manifest Candidate 生成与审批包
```

Stage C 当前尚未启动。本文只冻结未来任务边界，不生成或读取真实 Candidate，不创建 Approved Manifest，不创建 Stage C 分支或临时文件，不运行 Runner，不签发 Lease，也不启动 Stage D。

## 一、事实源与 accepted 边界

Stage C 必须遵守以下权威关系：

1. 最新 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库 `current` 事实；
2. 经独立授权取得的固定 localhost-only 本地验收环境证据，只决定该指定环境的 `current` 事实；
3. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
4. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
5. 架构视图、模块映射、证据报告、索引和 handoff 只负责解释、展开、核验与记录状态，不得独立改写事实所有权、Migration 顺序或发布门禁。

以下 accepted 结果不得在 Stage C 中静默重开：

- Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
- Access Control 只通过版本化 Port／Reader 和低敏投影单向消费，不建立第二套事实源；
- Manifest 使用 `mig01-a2/v1`、严格审批状态、exact shape、固定低敏字段、`c14n-v1` 与 SHA-256；
- Context 字段必须显式提供，禁止从数据库现状、系统时区、执行时钟、Demo、Seed 或模型偏好推断；
- 真实 Manifest 只允许保存在仓库外受控路径；
- 审批人与未来 Operator 必须分离；
- `main` 保护和 Required Check 继续是后续 P1／P2 的硬门；
- Metadata 继续禁止 `db:generate` 和 snapshot-diff Migration。

如需改变 accepted 选择、`architecture-v2.md`、既有 ADR、Context Policy 或 Adapter 边界，必须停止 Stage C 并创建独立决策／ADR 或实现任务。

## 二、Stage A、Stage B 与 Stage C-0 已完成事实

### 2.1 固定本地验收环境

- 容器：`zmtg-local-acceptance-pg`；
- 网络边界：只绑定 `127.0.0.1:55432`；
- 数据库：`zmtg_clean_local_acceptance`；
- 仓库与本地验收库 Journal：均为 39 项，最新项内部匹配 `0038_mig_01a1_institution_isolation_expand`；
- `tenants` 低敏计数：2；
- `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts`：Shape 与 0038／Schema 一致且均为空；
- 迁移前与迁移后两个 Stage A 恢复点继续保留，完整性校验和隔离恢复验证均通过；
- `journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing` 已关闭。

### 2.2 Stage B Context Policy

- Policy version：`mig01-a2-local-acceptance-context-policy/v1`；
- target environment：`local_acceptance`；
- timezone：只允许 `Asia/Shanghai`；
- currency：只允许 `CNY`；
- Policy 使用 exact shape 与冻结集合，不从环境变量、数据库、系统 locale、系统时区或执行时钟补默认值。

### 2.3 Stage B 只读 Adapter

- 路径：`src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`；
- 业务读取白名单：
  - `public.tenants`
  - `public.institution_scopes`
  - `public.institution_operating_context_versions`
  - `public.institution_operating_contexts`
- 每次读取使用 `REPEATABLE READ + READ ONLY`，核验事务只读状态与隔离级别；
- timeout：statement `5s`、lock `1s`、idle transaction `5s`；connect `5s` 由调用方 client 负责；
- 三个 Repository insert 与 Transaction Port write 永久拒绝；
- 固定低敏错误、事务生命周期失效保护、完整 Version 排序和时间 canonicalization 已通过测试；
- localhost-only smoke：`local_readonly_adapter_smoke=pass`；
- smoke 前后 Journal 39、`tenants` 2、三个 A1 表 0 的低敏计数不变；
- `readonly_adapter_unavailable` 已关闭。

Stage B 只建立可注入只读资产。当前 Runner CLI 尚未组合真实 Context Policy 与 Adapter；`real_manifest_missing` 和 `real_environment_dry_run_unavailable` 仍为阻断。

### 2.4 Candidate Governance／Stage C-0

- Candidate Contract：`mig01-a2-candidate/v1`；
- Candidate domain：`zmtg.mig01-a2.provisioning-candidate-manifest`；
- Candidate Source Contract：`mig01-a2-candidate-source/v1`；
- 当前唯一 Source type `local_acceptance_fixture` 明确为 test-only，不是 Stage C 的真实来源；
- Candidate canonicalization、digest preimage 与 `mig01-a2/v1` Approved Manifest 完全分离；
- Reviewer 生命周期只实现 `generated → review_pending`，没有 Candidate `approved` 状态；
- Candidate digest 不得写入或复用为 Approved Manifest digest；
- 空白审批模板只定义未来仓库外低敏审批包结构，未回填真实 Candidate、digest、审批引用、路径或业务数据；
- `candidate_contract_missing` 已关闭；`real_manifest_missing` 未关闭。

## 三、Stage C 唯一目标

未来 Stage C 只有在用户对当次任务、真实 Source 合约与来源、低敏字段、受控临时路径、Reviewer、保留期限和风险作出独立明确授权后，才允许：

1. 从用户明确批准的真实 Source 合约与来源生成 Candidate；不得复用 test-only `local_acceptance_fixture` 作为真实来源；
2. 使用已冻结的 `mig01-a2-local-acceptance-context-policy/v1`，timezone 只允许 `Asia/Shanghai`，currency 只允许 `CNY`；
3. 逐字段记录来源，禁止对缺失值使用数据库现状、系统默认、执行时钟、Demo、Seed 或模型偏好补全；
4. 将 Candidate 正文只保存在受控的仓库外临时路径；
5. 将“Candidate 已生成”“Candidate 契约验证通过”“用户已完成审核”作为独立证据；
6. Reviewer 生命周期最多从 `generated` 单向进入 `review_pending`，不得产生或伪造 Candidate `approved` 状态；
7. 只输出 Candidate 数量、版本、布尔验证结果和低敏审核摘要，不输出正文、双键、digest、审核引用或业务行；
8. 将 Candidate 与低敏审核摘要交由用户审核；用户审核不等于创建或批准 `mig01-a2/v1` Approved Manifest。

推荐、Candidate 生成、契约通过或用户审核均不等于 Approved Manifest 已创建。Stage C 不负责 Candidate→Approved 转换，不能复用 Candidate digest，也不能关闭 `real_manifest_missing`；该阻断只有在未来独立授权任务创建并校验新的 `mig01-a2/v1` Approved Manifest 后才能重新核验。

## 四、Candidate 与审核安全边界

- Candidate 正文不得进入 Git、PR、Issue、文档、日志、环境变量、argv、测试 fixture 或聊天；
- Candidate 文件必须位于本轮独立授权的受控临时路径，不得使用仓库目录或共享公共路径；
- Candidate 正文、双键、digest、审核引用和原始验证异常不得出现在 handoff 或普通输出中；
- 低敏输出只允许 Candidate 数量、Candidate／Policy version、固定布尔结果、固定状态码和审核摘要；
- Candidate 必须绑定冻结 Base、目标环境、Policy version、Candidate version、Reviewer 职责和失效／撤销条件；
- Stage C 不授予未来 Operator、Runner、数据库写入或 Lease 权限；
- Stage C 结束时必须按独立批准的保留期限处理临时正文，并只记录低敏删除结果；
- 用户审核完成后仍不得把 `review_pending` 写成 `approved`，不得把 Candidate 或其 digest 当作 Approved Manifest。

## 五、Stage C 启动硬门

未来 Stage C 启动前必须重新确认：

- `main` 与 `origin/main` 一致，工作树干净；
- `main` 保护和 Required Check 继续启用；
- PR #816 与本 handoff 已合并；
- 固定本地验收容器身份、localhost-only 端口、Journal 39、A1 Shape 和低敏计数未漂移；
- 两个 Stage A 恢复点仍存在且本地完整性校验通过；
- Stage B Context Policy 与只读 Adapter 的路径、版本、白名单和测试证据未漂移；
- Candidate Contract、Source Contract、canonicalization、digest 与 Reviewer 生命周期未漂移；
- 用户已经明确批准真实 Source 合约与来源、低敏字段、受控临时路径、Reviewer、保留期限和允许的只读环境范围；
- 真实 Source 不得使用或伪装为 test-only `local_acceptance_fixture`；
- 不存在其他 Agent 对同一工作树、Git 索引或受控临时路径的并发写入。

任一硬门不满足时停止，不创建候选，不读取环境补值，不扩大文件或数据范围。

## 六、Stage C 严格禁止

Stage C 不得：

- 创建 Approved Manifest，或把 Candidate、Candidate digest、用户审核结果当作 Approved Manifest；
- 自动产生 Candidate `approved` 状态，或把 `review_pending` 标记为 `approved`；
- 将 Candidate 正文写入 Git、PR、Issue、日志、环境变量、argv、fixture 或聊天；
- 从未知来源、真实业务数据、系统默认、数据库现状或执行时钟推断字段；
- 将 test-only `local_acceptance_fixture` 用作真实 Source；
- 静默扩展 timezone 或 currency 批准集合；
- 连接非 localhost 数据库、测试服务器、生产数据库、HIS、企业微信或业务外部环境；
- 运行 Runner，包括 synthetic／真实 dry-run 和 `--execute`；
- 签发、伪造、读取、验证或消费执行 Lease／Migration Lease；
- 修改 Context Policy、只读 Adapter、Runner、Schema、Migration、journal、snapshot、CI、package、lock、业务 API／UI、正式 Reader 或 Capability；
- 运行 `db:generate`、Migration、Seed、Reset、Restore、DDL、DML 或 Provisioning；
- 启动 Stage D、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

## 七、Stage C 停止条件

出现以下任一情况必须停止：

- 真实 Source 合约与来源、字段 provenance、Reviewer、临时路径、保留期限或审核状态无法明确；
- 需要读取未获授权的数据库对象、真实业务行、凭证、环境变量、Secret、Token 或 PII；
- 需要从环境现状或模型偏好推断缺失字段；
- Candidate 出现额外字段、未知版本、未批准 timezone／currency 或非低敏内容；
- 必须扩大到第二事实源、Runtime、Schema、Migration、Runner、Adapter、Policy、CI、package 或 lock；
- 要求产生 `approved` 状态、将 Candidate 转换为 Approved Manifest、复用 Candidate digest 或关闭 `real_manifest_missing`；
- 需要运行 Runner、签发 Lease、写数据库或自动启动 Stage D；
- 出现无法确认的环境、Git 或 Agent 并发写入。

## 八、交付与完成定义

本 handoff 只把 Stage C 冻结为唯一下一任务，不创建 Stage C 分支、仓库文件或仓库外候选。

未来 Stage C 的完成证据最多记录：

- 冻结 Base 与任务引用；
- Candidate 数量；
- Candidate／Source／Policy version；
- 来源、exact shape、canonicalization、批准集合和安全属性的布尔验证；
- Reviewer 生命周期与用户低敏审核摘要；
- 正文保管和删除的低敏结果；
- `real_manifest_missing` 继续阻断，且未因 Candidate 生成、契约通过或用户审核而关闭。

即使 Stage C 完成并经过用户审核，`real_manifest_missing` 仍需未来独立授权的 Approved Manifest 创建与校验任务处理，`real_environment_dry_run_unavailable` 仍必须由 Stage D 独立关闭。Stage C 不运行 Runner、不签发 Lease、不执行 Provisioning，合并后仍须独立 handoff，不能自动启动 Stage D。

## 九、项目级顺序

```text
就绪修复 Stage A：本地验收数据库安全恢复点与 A1 基线（已完成）
→ 就绪修复 Stage B：只读 Repository Adapter 与 Context Policy（已完成）
→ Candidate Governance：Candidate Contract、Source 与 Reviewer 生命周期（已完成，PR #816）
→ Stage C-0 独立 handoff（本任务）
→ 就绪修复 Stage C：本地验收 Manifest Candidate 生成与审批包（唯一下一任务，尚未启动）
→ 独立 handoff（重新冻结 Approved Manifest 创建／校验与 Stage D 前置；Approved Manifest 缺失时不得启动 Stage D）
→ 就绪修复 Stage D：真实本地 Runner dry-run
→ 独立 handoff
→ A2-P1 受控执行
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不改变 MIG-01～MIG-06 的相对顺序：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

Stage C 尚未启动；必须等待本 handoff 合并并取得用户对当次 Stage C 任务的独立明确授权。
