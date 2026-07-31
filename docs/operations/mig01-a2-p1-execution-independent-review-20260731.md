# MIG-01A2 A2-P1 Manifest Provisioning 执行独立审查

## 1. 文档定位

- 当前任务：`V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01`
- 阶段：A2-P1 执行低敏证据独立审查
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 审查 Base：`6c0839a4dc38f51f11449f03548142fa5653a80c`
- 审查方式：docs-only、独立只读复核
- 审查结论：`passed`

本审查只核对已经合并的 A2-P1 执行低敏证据、仓库公开 Runner／Kernel／Adapter 契约、
GitHub 交付事实以及执行状态机的内部一致性。审查没有重新连接数据库，没有读取私有
Manifest、凭证或 Lease 状态，也没有运行 Runner、dry-run、`--execute` 或任何 SQL。

本文不记录数据库标识符、连接参数、角色名、密码、私有路径、tenant／institution 双引用、
digest、Manifest 正文、审批／职责引用、签名、私钥、SQL 原始结果、Secret、Token、凭证或
PII。

## 2. 冻结审查对象

| 项目 | 冻结值 |
|---|---|
| 证据 PR | #840 |
| PR Base | `e102f72ab393c2579b2e222627720f60ce0eaa9a` |
| Head | `9a6fb23f1e6a34346cc91e56eacbd6c8c14c6295` |
| Merge Commit | `6c0839a4dc38f51f11449f03548142fa5653a80c` |
| Required Check | Run `30628614371`／Job `91149548637`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |
| 证据文件 | `docs/operations/mig01-a2-p1-execution-validation-20260731.md` |
| 证据 blob | `6f871bc6f45e4a0a3147f462145b13fd6575cee1` |

Merge Commit 的两个父提交分别为冻结 PR Base 与 PR Head，Merge tree 与 PR Head tree 一致。
PR #840 合并前没有评论、Review 或未解决 thread；环境核对、依赖安装、架构检查器自测、
增量架构检查、lint、typecheck、完整测试和 build 均实际成功，build 未跳过。

## 3. 审查方法与边界

独立审查分为四层：

1. 读取合并后的低敏证据，逐项核对执行前硬门、职责分离、恢复点、专用角色、权限、
   dry-run、Lease、唯一 execute、数据净影响和清理；
2. 静态核对仓库公开 Runner、Kernel、ReadOnly Adapter 与 Write Adapter 契约，确认计数状态机、
   单一事务、固定写入顺序、affected rows 和提交前重检语义；
3. 核对 PR #840 的 Base、Head、提交／文件范围、Required Check、Merge Commit 双父和 tree；
4. 对低敏证据中的计数、不变量、时间顺序和异常处置进行独立一致性复核。

本审查没有把低敏报告提升为原始 SQL 结果、全库逐行 bit-for-bit 证明或长期环境事实。
数据库终态只按已合并证据的来源归因、完整性和内部一致性进行审查。

## 4. 发现项

```text
blocking_findings=0
non_blocking_findings=0
A2P1-F01=closed
```

首轮复核唯一需要裁决的事项是仓库外一次性 Helper 在执行完成后返回
`fixed_table_count_drift`。第 8 节说明该固定码的时点、原因、独立只读复核和关闭理由。
没有发现需要回滚已提交事务、修改仓库、前向修复、重试 Runner 或执行第二次 `--execute` 的
证据。

## 5. 执行前硬门审查

| 硬门 | 冻结证据 | 审查 |
|---|---:|---|
| `main`／`origin/main` 与 Required Check | 无漂移 | 通过 |
| localhost-only `local_acceptance` | `true` | 通过 |
| 并发写入 Agent／其他数据库 client／Prepared Transaction | `0／0／0` | 通过 |
| `PUBLIC TEMPORARY`／`PUBLIC CONNECT` | `false／true` | 通过 |
| Candidate v2／Approved Manifest | `1／1` | 通过 |
| Approved Contract／approvalStatus／canonicalization | `mig01-a2/v1`／`approved`／`c14n-v1` | 通过 |
| exact shape／digest／Candidate 映射 | 通过 | 通过 |
| Context Policy | 有效 | 通过 |
| Operator 与 Approver／Reviewer／Authority | 分离 | 通过 |
| tenant 父表 | `2` | 通过 |
| 三张 A1 表 | `0／0／0` | 通过 |
| Applied Migration／最新 Journal | `39`／仓库 `0038` | 通过 |
| A1 Shape／约束／索引／enum | 无漂移 | 通过 |

原 Candidate 与原 Approved Manifest 在执行前后均保持文件身份和内容不变。Runner 只读取一个
仓库外 `0400` 临时副本，该副本在清理阶段删除；原始稳定资产持续保留。

## 6. dry-run、Lease 与唯一 execute 状态机

### 6.1 dry-run

```text
input=1
insertedCandidate=1
reusedCandidate=0
conflict=0
unexpected=0
```

- Runner dry-run 调用 `1` 次，重试 `0`；
- 计数守恒；
- dry-run 前后 Journal、Shape 和公开表低敏计数未变化；
- Lease 在 dry-run 精确通过后才签发。

### 6.2 Execution Lease

| 生命周期 | 次数／结果 |
|---|---:|
| issue | `1` |
| claim | `1` |
| 签名、scope、任务、分支、Base 与环境验证 | 通过 |
| Manifest／entry-key digest 与 entry count 绑定 | 通过 |
| 最大 TTL | 小于 10 分钟 |
| renewal | `0` |
| Kernel／Runner 消费 | `1` |
| release | `1` |
| release 后重放 | 拒绝 |

### 6.3 唯一 execute

```text
execute_attempt=1
execute_retry=0

input=1
insertedCandidate=1
reusedCandidate=0
conflict=0
unexpected=0
```

不可覆盖 attempt marker 在 Runner 调用前建立。证据没有第二次 Runner execute、自动重试、
savepoint 补写或 Runner 外 SQL 旁路。

## 7. 原子事务与数据净影响审查

公开 Write Adapter 契约与低敏证据一致：同一 `SERIALIZABLE READ WRITE` 事务按固定顺序执行：

```text
完整批次重读与分类
→ Scope INSERT（affected rows = 1）
→ Context Version 1 INSERT（affected rows = 1）
→ Context Head 1 INSERT（affected rows = 1）
→ 提交前完整重检为严格一致 reusedCandidate
→ commit
```

提交后只读分类为：

```text
input=1
insertedCandidate=0
reusedCandidate=1
conflict=0
unexpected=0
```

| 影响 | 净变化 | 审查 |
|---|---:|---|
| Institution Scope | `+1` | 与 execute 一致 |
| Context Version 1 | `+1` | 与 execute 一致 |
| Context Head 1 | `+1` | 与 execute 一致 |
| tenant 父表 | `0` | 无漂移 |
| 其他公开业务表计数 | `0` | 无额外写入证据 |
| Journal／Schema Shape | `0` | 无漂移 |
| conflict／unexpected | `0／0` | 通过 |

“其他公开业务表写入为 0”由角色权限 allowlist、Write Adapter 静态写入面和执行前后全公开表
低敏计数三层相互支持；报告没有把该结论扩大为全库逐行等价证明。

## 8. `fixed_table_count_drift` 裁决

### 8.1 事实时序

仓库外一次性 Helper 在以下步骤全部完成后返回非零退出码和固定码：

1. execute 返回精确 `1／1／0／0／0`；
2. 数据库事务已经 commit；
3. 提交后严格复用分类返回 `1／0／1／0／0`；
4. Lease 已 release 且重放被拒绝；
5. Runner client 已关闭；
6. 角色已 NOLOGIN、撤权并删除；
7. 私有临时状态已清理。

触发原因是通用收尾快照继续复用“执行前三张目标表必须为空”的断言。成功 execute 的目标终态
本应为 `1／1／1`，因此该零行断言已经过时。

### 8.2 独立只读复核

没有恢复权限、重新签发 Lease、调用 Runner 或执行第二次 dry-run／`--execute`。独立新连接只读
复核确认：

- 三张目标表为 `1／1／1`；
- tenant 父表为 `2`，Applied Migration 为 `39`；
- Journal、Shape、ACL、角色目录与执行后预期一致；
- 非超级用户登录角色、其他 client 和临时资产残留均为 `0`；
- 原 Candidate 与原 Approved Manifest 持续保留且未变化；
- 只读复核自身 Runner 调用与 execute attempt 均为 `0`。

### 8.3 裁决

```text
A2P1-F01=closed
```

`fixed_table_count_drift` 是 commit 后的过时收尾断言，不是 conflict、unexpected、事务失败、
数据库漂移或清理失败。主进程非零退出事实继续保留，不能改写为命令正常退出；但已有证据足以
证明业务事务和清理终态，无需回滚、前向修复、重试或第二次 `--execute`。一次性 Helper 未进入
仓库且已删除，因此也不存在需要提交的 Runtime、Runner、Kernel、Adapter 或测试改动。

## 9. 恢复点边界审查

- 执行前重新验证两份 Stage A 隔离恢复证据及其本地 hash；
- 创建一份当前执行前 PostgreSQL custom-format 恢复点；
- 恢复点目录 `0700`、文件 `0600`、非空，archive parse 与 SHA-256 完整性通过；
- 本轮没有 Restore，也没有新建隔离数据库；
- 恢复点没有被执行、覆盖或删除。

“恢复点可用”在本次证据中限定为当前归档可解析且完整性可验证，并由既有 Stage A 隔离恢复
证据补充恢复能力；没有把“本轮未实际 Restore”误写为新一轮 restore drill 已通过。

## 10. 角色、权限、Lease、client 与临时资产清理

| 清理项 | 最终结果 |
|---|---:|
| Lease release／重放拒绝 | 完成／通过 |
| Runner client 关闭 | 完成 |
| `ALTER ROLE NOLOGIN` | 完成 |
| 本任务直接权限撤销 | 完成 |
| 活动连接／direct ACL／membership／ownership／sequence 权限 | `0` |
| 临时角色删除 | 完成 |
| `DROP OWNED CASCADE` | 未使用 |
| 凭证／Authority／Lease 状态／输入副本／Helper／临时目录残留 | `0` |
| 原 Candidate／原 Approved Manifest | 保留且未修改 |

最终数据库、Schema、表、序列与 Default Privileges 除已提交的三张 A1 数据行外回归执行前语义
快照；`PUBLIC TEMPORARY=false`，`PUBLIC CONNECT=true`。

## 11. 低敏披露与零越界审查

| 类别 | 数量／结果 |
|---|---:|
| Schema／Migration／Seed | `0` |
| 新 Migration／`db:generate` | `0` |
| UPDATE／UPSERT／DELETE／TRUNCATE | `0` |
| Runtime／Runner／Kernel／Adapter 修改 | `0` |
| scripts／tests／CI／package／lock 修改 | `0` |
| 非 localhost 连接 | `0` |
| 私有或敏感输出 | `0` |
| A2-P2／BASE-02／Writer／Reader | 未启动 |

证据与 PR 没有公开数据库标识符、角色名、连接参数、私有路径、双引用、digest、审批／职责引用、
Manifest 正文、签名材料或凭证。

## 12. 审查限制

- 本审查没有重新连接数据库，不能把执行时点低敏终态写成永久环境事实；
- 审查只确认合并低敏证据、公开代码契约和 GitHub 交付事实，不能替代原始 SQL 审计记录；
- 全公开表计数和权限矩阵支持“无额外写入”的限定结论，但不等于全库逐行 bit-for-bit 证明；
- 独立审查通过只允许进入最终 handoff，不构成 A2-P2、Migration Lease、Schema 或 Migration
  授权。

## 13. 结论与 handoff 边界

```text
A2P1-F01=closed
a2_p1_independent_review=passed
eligible_for_a2_p1_handoff=true
eligible_for_a2_p2=false
```

PR #840 的低敏证据、公开代码契约、执行状态机、角色／权限／Lease 清理和 GitHub 交付事实在
审查范围内一致，足以进入 A2-P1 最终 handoff。只有最终 handoff 合并后才能把 A2-P1 标记为
完成；A2-P2 仍未启动、未授权。
