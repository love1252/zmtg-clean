# BASE-02 Membership Revision M5 本地验收 Migration 执行独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：`804444789d135903a737bc0721c452bcc74511b5`
>
> 被审查 PR：#895
>
> 被审查 Head：`53e7f1c0ad257fdff935d3ce1234be0054a19b34`
>
> Required Check：Run `30729433131`／Job `91446923309`，成功
>
> 被审查 Merge Commit：`804444789d135903a737bc0721c452bcc74511b5`

## 1. 审查定位

本审查独立核对 Membership Revision M5 `0042` 的单次目标执行、零候选成功分支、Journal、完整
Catalog、数据不变量、恢复点、Execution Lease、清理和低敏边界，判断 M5 是否具备进入最终
handoff 的条件。

审查只读取已合并仓库证据、Git／GitHub 证据、`0042` 与 Migration Guard 静态控制流，以及既有
低敏终态记录；不连接数据库，不运行 Migration、Restore 或新探针，不创建或消费 Lease，也不启动
M6。

本文不记录数据库真实标识符、连接参数、容器标识、Lease 标识、Holder、恢复点路径或摘要、原始
Catalog／SQL 行、tenant／institution 双引用、Membership／角色引用、凭证、Secret、Token、密码、
私钥或 PII。

## 2. 被审查交付冻结

PR #895 相对 Base `33c52ee41e20385e8541594fa92b4c5c6ce21cf9` 精确为 1 个提交、1 个文件：

`docs/operations/base02-membership-revision-m5-local-acceptance-migration-validation-20260802.md`

| 项目 | 结果 |
|---|---|
| PR #895 最终 Head | `53e7f1c0ad257fdff935d3ce1234be0054a19b34` |
| 提交／文件 | `1／1` |
| Required Check | Run `30729433131`／Job `91446923309`，成功 |
| 评论／Review／未解决 thread | `0／0／0` |
| Merge Commit | `804444789d135903a737bc0721c452bcc74511b5` |
| Merge 父提交 | 被审查 Base 与被审查 Head |
| Merge tree | 与被审查 Head tree 完全一致 |

PR #895 只纳入低敏执行证据；Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、
package 与 lock 修改均为 0。环境核对、依赖安装、架构检查器自测、增量架构检查、lint、typecheck、
完整测试和 build 均在冻结 Head 上实际执行并成功，build 未跳过。

## 3. 证据来源与归因限制

| 证据 | 可证明 | 不得扩大为 |
|---|---|---|
| `0042`、Schema 与测试 | accepted 高水位语义、DML allowlist、前后硬门与禁止项 | 单独证明环境终态 |
| PR #893／#894 | 实施、静态验证、实施独立审查与执行 Base | `0042` 已消费 |
| PR #895 低敏证据 | 执行编排器记录的 Journal、恢复点、Lease、计数和清理终态 | 全库逐行等价 |
| 执行前后只读探针 | 完整 Catalog、Membership、A2 资产、orphan 与并发状态 | 公开数据库身份 |
| 私有稳定指纹 | 八张关键业务表执行前后相同 | 公开行值或摘要 |
| 恢复点隔离恢复 | 最终执行前后恢复资产可恢复，原目标 Restore 为 0 | 字节级 Catalog OID 恒等 |
| Guard 静态控制流 | 唯一入口、子进程 `stdio` 隔离和单次 spawn 边界 | 任意其他命令均已获授权 |
| Git／GitHub | 文件范围、Head、Run、Merge 父提交和 tree | 数据库业务事实 |

## 4. 实施、审查与执行证据链

| 阶段 | PR／Head | Run／Job | Merge Commit |
|---|---|---|---|
| M5 实施 | #893／`43440e3f38c3c6ba3576dba1788b3fad586cfb5a` | `30727616873`／`91442118293` | `72c7568df3fd1078b813733eda472c01b0f8672d` |
| 实施独立审查 | #894／`14c7e6e4419203dacd5d20b3bec2b3d8bc43c285` | `30728269902`／`91443866416` | `33c52ee41e20385e8541594fa92b4c5c6ce21cf9` |
| 执行低敏证据 | #895／`53e7f1c0ad257fdff935d3ce1234be0054a19b34` | `30729433131`／`91446923309` | `804444789d135903a737bc0721c452bcc74511b5` |

三次 Required Check 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 均成功。

## 5. 唯一目标调用与零候选分支

审查确认执行顺序为：

```text
最新 main 与唯一 pending 冻结
→ 全新执行前恢复点
→ 隔离恢复验证
→ 全新唯一不可续期 Execution Lease claim
→ consume 前完整只读重检
→ 一次 guarded pnpm db:migrate
→ 精确只读终态
→ release Lease
→ 全新执行后恢复点
→ 隔离恢复验证
→ terminal evidence
```

目标执行终态：

```text
target_guarded_migration_call_current=1
target_guarded_migration_calls_cumulative=1
direct_sql_execution=0
second_target_call=0
automatic_retry_count=0
outcome_known=true
```

执行前 `all-null=0`，因此 `0042` 的合法零候选结果为：

```text
planned=0
created=0
reused=0
conflict=0
unexpected=0
planned=created+reused
membership_update_rows=0
transition_insert_rows=0
```

零候选不是跳过 Migration：`0042` 仍在单一事务内执行完整 Catalog、Shape、parent、identity、
duplicate、orphan 与 journal 前后检查，随后只由 Drizzle 推进环境 Migration metadata。

## 6. Journal、数据 Shape 与不变量

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `42／0041` | `43／0042` | `+1` metadata |
| Membership total／all-null／partial／complete | `1／0／0／1` | `1／0／0／1` | `0／0／0／0` |
| transition／exact current-head／M4 baseline | `1／1／1` | `1／1／1` | `0／0／0` |
| duplicate command／revision | `0／0` | `0／0` | `0／0` |
| identity mismatch／parent missing | `0／0` | `0／0` | `0／0` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` | `1／1／1／1` | `0／0／0／0` |
| active historical orphan／Scope relation orphan | `1／1` | `1／1` | `0／0` |
| Scope FK | `NOT VALID` | `NOT VALID` | 未 `VALIDATE` |

八张关键业务表的私有稳定指纹前后相同；结合 `0042` 静态 DML allowlist，业务 DML 为 `0`。
snapshot 继续停在 `0026`，`0041` 未改写，仓库 Catalog 和执行环境原目标 Catalog 均保持精确指纹。

## 7. 恢复点 round-trip 审查

最终执行前和执行后恢复点各完成 `1／1` 次非空、parse、完整性和随机隔离恢复；原目标 Restore 为
`0`，隔离数据库终态残留为 `0`。

隔离恢复只出现一项 PostgreSQL deparser 文本差异：公开
`tenant_membership_transitions_revision_shape_check` 去掉一对冗余括号。审查确认接受该差异的条件没有
被泛化：

- 标识符和操作符 token 顺序完全一致；
- 长度差精确为 `-2`，只对应一对括号；
- constraint 名称、类型和 validated 状态不变；
- 其余列、enum、约束、索引、trigger、函数、FK、relation envelope 和数据 Shape 全部精确一致；
- 原目标执行前与执行后仍要求并通过静态精确 Catalog 指纹。

执行前 helper 校准的 `9` 次未通过隔离验证均发生在 Lease claim 和目标调用前，未 Restore 原目标，
临时隔离库全部删除；它们不属于 Migration attempt，也没有放宽最终恢复点门禁。

## 8. Lease、清理与低敏终态

```text
allocation_lease_consumed=false
allocation_lease_active=false
execution_lease_claim=1
execution_lease_consume=1
execution_lease_renewal=0
execution_lease_release=1
execution_lease_active=0
```

- Execution Lease 绑定当前任务、执行 Base、前驱、`0042`、目标、恢复点和唯一 attempt；
- 首次编排器权限拒绝发生在读取目标、连接数据库和 Lease claim 前，目标调用为 `0`；
- Migration client、进程组、Lease lock、run lock、attempt marker、Helper、私有配置副本和隔离数据库
  活动残留均为 `0`；
- 不可覆盖 terminal record 保留 `1`；
- 当前执行窗口自动运维元数据回显为 `0`；历史本地运维元数据回显只保留事件计数 `1`；
- 当前主动私有参数披露、真正敏感信息披露和非 localhost 连接均为 `0`。

## 9. 发现项与处置

- `F01`：恢复 helper 初版未区分原目标精确 Catalog 与 dump／restore deparser round-trip 表达；通过
  严格限定单一约束、一对括号、token 序列、validated 状态和其余 Catalog 精确一致后关闭，结论
  `closed`；
- `F02`：执行编排器初次因可执行配置文件不满足私有状态权限门禁而拒绝；该次目标调用、Lease、
  数据库连接和数据库变化均为 `0`，改用仓库外 `0600` 私有副本并从头重检后关闭，结论 `closed`；
- 没有发现 Journal、Membership、A2 资产、orphan、Scope FK、恢复点、Lease 或清理终态矛盾；
- `0042` 已被获授权环境消费，后续不得改写 SQL 或 journal，只允许独立 forward-fix。

## 10. 零越界与资格边界

| 边界 | 结果 |
|---|---:|
| Runtime／Schema／Migration／journal／snapshot 仓库修改 | `0` |
| scripts／tests／CI／package／lock 修改 | `0` |
| `db:generate`／Seed／额外 DDL／业务 DML | `0` |
| FK `VALIDATE`／`SET NOT NULL`／historical orphan 修复 | `0` |
| M6／M7／BASE-B1～B6 | 未启动 |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

`eligible_for_m5_handoff=true` 只准入 M5 handoff；在 handoff 完成前不得把 M6 写成已启动。既有 Auth
Reader 在 M6 前仍使用兼容读取，本文没有切换 Reader。

## 11. 独立审查结论

```text
base02_membership_revision_m5_execution_review=passed
m5_execution_complete=true
m5_handoff_complete=false
m5_migration=0042
m5_outcome_known=true
m5_environment_journal_entries=43
m5_zero_candidate_branch=true
m5_planned=0
m5_created=0
m5_reused=0
m5_conflict=0
m5_unexpected=0
m5_target_guarded_migration_calls_cumulative=1
m5_automatic_retry_count=0
m5_allocation_lease_released=true
m5_execution_lease_active=false
m5_current_envelope_complete=1
m5_transition_count=1
m5_active_historical_orphan=1
m5_scope_relation_orphan=1
m5_scope_fk_validated=false
eligible_for_m5_handoff=true
eligible_for_m6=false
eligible_for_base_b1_runtime=false
eligible_for_reader=false
```

PR #895 的低敏证据与仓库、GitHub、静态实现、恢复点、Lease 和 terminal 记录相互一致，能够证明
M5 `0042` 已在唯一允许环境完成一次授权 guarded Migration，零候选成功语义成立，并保持 A2 资产、
orphan、未验证外键和后续阶段边界不变。M5 可以进入最终 handoff；M6 尚未由本审查启动。
