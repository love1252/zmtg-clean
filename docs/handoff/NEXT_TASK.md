# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 的 accepted 决策、仓库硬门、受控 Runner 治理基础、本地环境只读预检和本地就绪修复 Stage A 已分别通过独立 PR 完成：

- accepted 决策：PR #801；
- 治理 Stage A 仓库硬门：PR #804，handoff PR #805；
- 治理 Stage B Runner 基础：PR #807，handoff PR #808；
- 本地环境只读预检：PR #809，handoff PR #810；
- 本地就绪修复 Stage A 报告：PR #811；
- PR #811 Head：`50b007820b7fdb68ff35b6ef0e2a53b9e8e61880`；
- PR #811 Merge Commit：`fc08de343456a1f0d05092f1aedd389118b32b26`；
- PR #811 Required Check：Run `30514884226`／Job `90782386213`，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 当前 `main` 保护和“最小架构与质量门禁”Required Check 继续生效。

Stage A 只关闭固定 localhost-only 本地验收环境的 Journal、A1 Shape 与备份恢复点阻断。它没有创建真实 Manifest、只读 Repository Adapter、执行 Adapter 或 Lease，也没有运行真实 Runner dry-run 或启动 A2-P1／P2。

## 唯一下一任务

```text
V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B
MIG-01A2 只读 Repository Adapter 与 Context Policy
```

Stage B 当前尚未启动。只有用户对 Stage B 的冻结 Base、允许文件、测试、数据库只读边界和风险作出独立明确授权后，才能创建其工作分支或修改 Runtime／测试。

## 一、事实源与 accepted 边界

Stage B 必须遵守以下权威关系：

1. 最新 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库 `current` 事实；
2. 经独立授权取得的固定 localhost-only 本地验收环境证据，只决定该指定环境的 `current` 事实；
3. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
4. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
5. proposed 决策包、六类架构视图、模块映射、架构索引和 handoff 只负责解释、展开、核验与记录状态，不得独立改写事实所有权、Migration 顺序或发布门禁；
6. `docs/operations/mig01-a2-local-acceptance-stage-a-20260730.md` 是本地环境 Stage A 的 `current evidence`，不构成 Stage B 或 A2-P1 授权。

以下 accepted 结果不得在 Stage B 中静默重开：

- D01-A：Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
- D02-A：Access Control 通过版本化 Port／Reader 和低敏投影单向消费；
- D03-A：Manifest 使用严格版本、审批状态和低敏白名单；
- D04-A：固定位置 JSON 数组 canonicalization + SHA-256；
- D05-A：Context 字段显式提供，禁止隐式默认；
- D06-B／D07-B／D11-B：仓库外真实 Manifest、唯一一次性受控 Runner 和 Runner 文件集绑定；
- D08-C：Metadata 分阶段治理，继续禁止 `db:generate` 和 snapshot-diff Migration；
- D09-A：用户授权的任务级排他执行／Migration Lease；
- D10-B：`main` 保护和 Required Check 是 P1／P2 启动硬门；
- D12-A：只接受最小 Anchor Bridge 方向，精确实施细节继续后置。

如需改变 accepted 选择、`architecture-v2.md` 或既有 ADR，必须停止 Stage B 并创建独立决策／ADR 任务。

## 二、Stage A 已完成事实

- 容器：`zmtg-local-acceptance-pg`；
- 网络边界：只绑定 `127.0.0.1:55432`；
- 数据库：`zmtg_clean_local_acceptance`；
- 仓库与本地验收库 Journal：均为 39 项，最新项内部匹配 `0038_mig_01a1_institution_isolation_expand`；
- 本地验收环境只应用仓库既有 0038，未创建新 Migration；
- `tenants` 低敏计数：迁移前后均为 2；
- `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts`：Shape 与 0038／Schema 一致且均为空；
- 迁移前备份：`zmtg_clean_local_acceptance-pre-0038-20260730-124114`，完整性校验和隔离恢复验证通过；
- 迁移后备份：`zmtg_clean_local_acceptance-post-0038-20260730-124114`，完整性校验和隔离恢复验证通过；
- 两个恢复点继续保留，删除必须独立授权；
- `journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing` 已关闭；
- `real_manifest_missing`、`readonly_adapter_unavailable`、`real_environment_dry_run_unavailable` 仍未关闭；
- 未运行 `db:generate`、Seed、Reset、原数据库 Restore、Runner dry-run 或 `--execute`；
- 未创建、读取或批准真实 Manifest，未签发执行 Lease／Migration Lease；
- Stage A 报告 PR 的仓库 Runtime、Schema、Migration 修改均为 0。

## 三、Stage B 目标

通过未来独立代码 PR，为 MIG-01A2 Runner 的真实 dry-run 提供最小只读 Repository Adapter 和受控 Context Policy，同时保持 Tenancy 单一事实源、固定表白名单、低敏输出和 fail-closed。

Stage B 只建立“可安全读取并判定 Context”的能力，不执行 Provisioning，不写数据库，不生成或批准真实 Manifest，也不调用业务 API／UI。

## 四、Stage B 未来允许范围

未来独立 Stage B 任务只可在再次冻结路径后实现：

1. 最小只读 Repository Adapter；
2. 数据读取白名单精确为：
   - `tenants`
   - `institution_scopes`
   - `institution_operating_context_versions`
   - `institution_operating_contexts`
3. 复用已接受的 Repository／Transaction Port 和五项低敏守恒计数，不建立第二套事实源或事务语义；
4. 每次数据库读取使用显式 `READ ONLY` 事务；
5. 设置并验证有限的连接、语句和锁等待超时；
6. 只暴露固定低敏状态码，不返回连接串、SQL、数据库原始异常、双键、digest、审批引用或业务行；
7. 实现由任务明确批准的 IANA timezone 子集；
8. 实现由任务明确批准的 ISO 4217 currency 子集；
9. 对缺失、冲突、陈旧 Context、越过白名单和未知枚举值保持 fail-closed；
10. 增加必要的合成测试、Adapter 定向测试、Context Policy 测试和架构门禁验证。

批准的 timezone／currency 子集必须在 Stage B 任务中根据仓库证据和用户授权精确冻结；不得从真实 Manifest、业务数据、环境默认值或模型偏好推断。

## 五、Stage B 禁止范围

Stage B 不得：

- 实现或接入 execute Adapter；
- 提供 INSERT、UPDATE、DELETE、UPSERT、DDL、Migration 或提交写事务的能力；
- 创建新 Migration、修改 Schema／journal／snapshot，或运行 `db:generate`；
- 运行 Seed、Reset、原数据库 Restore 或数据修复；
- 签发、伪造或消费执行 Lease／Migration Lease；
- 创建、读取、批准或提交真实 Manifest；
- 运行 synthetic 或真实 Runner dry-run／execute；
- 修改业务 API、UI、正式 Reader、Capability 或发布状态；
- 连接测试服务器、生产数据库、HIS、企业微信或业务外部环境；
- 读取 `.env.local`、非 localhost `DATABASE_URL`、Secret、Token、PII 或真实业务数据；
- 启动 Stage C、Stage D、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

## 六、Stage B 启动硬门

未来 Stage B 任务启动前必须重新确认：

- `main` 与 `origin/main` 一致，工作树干净；
- `main` 保护和 Required Check 继续启用；
- Stage A 报告与本 handoff 已合并；
- 固定本地验收容器身份、localhost-only 端口、数据库名称和 Journal 0038 状态未漂移；
- 两个 Stage A 备份仍存在且本地完整性校验通过；
- 允许的 Runtime／测试文件精确冻结，且与其他 Agent 没有写入冲突；
- 四表白名单、`READ ONLY` 事务、timeout、低敏错误和 Context Policy 测试可以在授权范围内完成。

任一硬门不满足时停止，不扩大文件范围，不以写操作或环境默认值绕过。

## 七、Stage B 停止条件

出现以下任一情况必须停止：

- 需要读取四表以外的数据库对象或业务行才能实现；
- 无法证明事务为 `READ ONLY`，或 Adapter 可能提交写入；
- 无法冻结有限 timeout 或固定低敏错误；
- timezone／currency 子集没有仓库证据和用户批准；
- 需要修改 Schema、Migration、业务 API／UI、正式 Reader、Capability、CI、package 或 lock；
- 需要真实 Manifest、Lease、Runner dry-run／execute 或外部环境；
- 出现数据库、Git 或 Agent 并发写入；
- 需要自动启动 Stage C 或任何下游任务。

## 八、验证与交付边界

未来 Stage B PR 至少必须验证：

- Adapter 只可读取四个白名单表；
- 数据库事务显式为 `READ ONLY`；
- 连接、语句和锁等待 timeout 生效；
- 所有错误输出满足低敏白名单；
- timezone 与 currency 只接受批准子集；
- 缺失、冲突、陈旧和未知输入均 fail-closed；
- 合成测试、Adapter 定向测试和 Context Policy 测试通过；
- `git diff --check`、增量架构检查、lint、typecheck、完整测试和 build 通过；
- Required Check 真实运行并通过；
- Schema、Migration、journal、snapshot、CI、package、lock 和业务 API／UI 修改为 0；
- Stage C、真实 Manifest、真实 Runner dry-run、Lease 和 A2-P1 均未启动。

进入正式审查、合并和 handoff 均需用户对当次任务明确授权。Stage B 合并不自动启动 Stage C。

## 九、项目级顺序

```text
就绪修复 Stage A：本地验收数据库安全恢复点与 A1 基线（已完成）
→ 就绪修复 Stage B：只读 Repository Adapter 与 Context Policy（唯一下一任务，尚未启动）
→ 独立 handoff
→ 就绪修复 Stage C：本地验收 Manifest 候选与审批包
→ 独立 handoff
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

这里的“就绪修复 Stage B”与已完成的“治理 Stage B Runner 基础”不是同一任务。前者只补齐真实 dry-run 所需的只读 Adapter 和 Context Policy；后者只建立了 Runner、Port、Lease 低敏契约、合成测试和 Runbook。

该顺序不改变 MIG-01～MIG-06 的相对顺序：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

本 handoff 只收口 Stage A 并冻结唯一下一任务，不自动授权或启动 Stage B。
