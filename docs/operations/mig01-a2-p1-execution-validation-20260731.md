# MIG-01A2 A2-P1 Manifest Provisioning 执行低敏证据

## 1. 文档定位

- 任务：`V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01`
- 日期与时区：2026-07-31，`Asia/Shanghai`
- 执行 Base：`e102f72ab393c2579b2e222627720f60ce0eaa9a`
- 执行分支：`codex/v2-mig01-a2-p1-execution-evidence-20260731`
- 状态：`current low-sensitive execution evidence`
- 当前结论：`a2_p1_execution_validation=passed`
- 后续准入：`eligible_for_a2_p1_independent_review=true`

本文记录固定 localhost-only `local_acceptance` 环境的一次受控 A2-P1 执行。本文不是
A2-P2、BASE-02、Writer、Reader、Schema、Migration、Seed 或其他环境的授权；A2-P1 只有
在本证据、独立审查和最终 handoff 依次合并后才能标记完成。

本文不记录数据库标识符、连接参数、角色名、密码、私有路径、tenant／institution 双引用、
digest、Manifest 正文、审批／职责引用、签名、私钥、SQL 原始结果、Secret、Token、凭证或
PII。

## 2. Git、仓库与环境冻结

| 项目 | 结果 |
|---|---|
| `main`／`origin/main` | `e102f72ab393c2579b2e222627720f60ce0eaa9a` |
| 工作树 | 干净 |
| `main` 保护 | 已启用 |
| Required Check | “最小架构与质量门禁”，enforcement 为 everyone |
| 前置 handoff | PR #839 已使用 Merge Commit 合并；Run `30626414250` 成功 |
| 目标 | 固定 localhost-only `local_acceptance`，身份与受控容器标签匹配 |
| 并发写入 Agent | `0` |
| 其他数据库 client／Prepared Transaction | `0／0` |

执行前、执行后和角色清理后均重新核对 Git 与固定数据库身份。本次没有连接非 localhost
环境，也没有修改仓库设置或绕过 Required Check。

## 3. Manifest、Context 与职责硬门

| 硬门 | 结果 |
|---|---:|
| 私有治理根权限 | `0700`，通过 |
| Candidate v2 数量 | `1` |
| Approved Manifest 数量 | `1` |
| Candidate／Approved 文件 | regular、单硬链接、`0600`，相互隔离 |
| Approved Contract | `mig01-a2/v1` |
| `approvalStatus` | `approved` |
| canonicalization | `c14n-v1` |
| exact shape／digest／Candidate 映射 | 全部通过 |
| Candidate／Approved digest 复用 | `false` |
| Context Policy | `mig01-a2-local-acceptance-context-policy/v1` |
| target／timezone／currency | `local_acceptance`／`Asia/Shanghai`／`CNY` |
| Source Authority／Generator／Reviewer／Approver | 已分离 |
| 新 Operator／Approver／Reviewer／Authority | 已分离 |

执行前和执行后均比较原 Candidate 与原 Approved Manifest 的文件身份和内容完整性。两项原始
资产没有被修改、移动、替换或删除；Runner 只读取一个仓库外 `0400` 临时副本，该副本已删除。

## 4. 数据库与恢复点硬门

| 项目 | 执行前 | 最终 |
|---|---:|---:|
| `PUBLIC TEMPORARY` | `false` | `false` |
| `PUBLIC CONNECT` | `true` | `true` |
| 非超级用户登录角色 | `0` | `0` |
| tenant 父表 | `2` | `2` |
| Scope | `0` | `1` |
| Context Version | `0` | `1` |
| Context Head | `0` | `1` |
| Applied Migration | `39` | `39` |
| 最新 Journal | 仓库 `0038`，完整匹配 | 未变化 |
| A1 Shape／约束／索引／enum | 通过 | 未变化 |
| A1 未审计 trigger／rule／RLS | `0／0／0` | `0／0／0` |

执行前重新验证了两份 Stage A 隔离恢复证据及其本地 hash，并创建一份当前执行前 PostgreSQL
custom-format 恢复点：目录 `0700`、文件 `0600`、非空、archive parse 与 SHA-256 完整性均
通过。当前恢复点没有执行 Restore 或新建隔离数据库；本轮权限只允许恢复点创建／归档验证、
临时角色生命周期和三张目标表 INSERT，不允许通过额外数据库 DDL 扩大范围。恢复点没有被执行、
覆盖或删除。

## 5. 临时专用角色与权限

专用角色使用随机私有标识，最长有效窗口小于 30 分钟，属性精确为：

- `LOGIN`、`NOSUPERUSER`、`NOCREATEDB`、`NOCREATEROLE`；
- `NOREPLICATION`、`NOBYPASSRLS`、`NOINHERIT`；
- `CONNECTION LIMIT 1`；
- 无 membership、对象 ownership、`TEMPORARY`、Schema `CREATE` 或 sequence 权限。

直接授权 allowlist 精确为：

- 数据库 `CONNECT`；
- `public` Schema `USAGE`；
- tenant 父表与三张 A1 表 `SELECT`；
- 三张 A1 表 `INSERT`。

正向和负向权限矩阵确认：其他公开业务表没有 `SELECT`／`INSERT`，所有公开业务表均没有
`UPDATE`、`DELETE`、`TRUNCATE`、`REFERENCES` 或 `TRIGGER`；必要 enum/type 和既有
`pg_catalog` 函数可执行，未现场增加额外授权。Runner client 内
`session_user=current_user=专用角色`，没有 `SET ROLE`，活动连接未超过 1。

## 6. 唯一 dry-run

使用专用角色、原 Approved Manifest 的 `0400` 临时副本、当前 Context Policy、既有唯一
Runner 与 ReadOnly Adapter 执行一次 dry-run：

```text
input=1
insertedCandidate=1
reusedCandidate=0
conflict=0
unexpected=0
```

- Runner dry-run 调用：`1`；
- dry-run 重试：`0`；
- 计数守恒：`true`；
- dry-run 前后 Journal、Shape 和全部公开表低敏计数：未变化；
- Lease 签发发生在 dry-run 通过之后。

## 7. Execution Lease

仓库外一次性 Authority 使用独立签名记录完成：

| 生命周期 | 次数／结果 |
|---|---:|
| issue | `1` |
| claim | `1` |
| 签名、scope、任务、分支、Base、环境验证 | 通过 |
| Manifest／entry-key digest 与 entry count 绑定 | 通过 |
| 最大 TTL | 小于 10 分钟 |
| renewal | `0`，不可续期 |
| Kernel／Runner 消费 | `1` |
| release | `1` |
| release 后重放 | 拒绝 |

Authority 每次从当前 `0600` 状态读取并验证签名、活动状态、受信主机时间和完整 scope；没有
使用无条件返回 `true` 的 verifier。签名私钥、活动记录和 Lease 临时状态已在 release 与复核后
删除。

## 8. 唯一 `--execute`

在调用 Runner 前创建不可覆盖的私有 attempt marker。执行次数和结果：

```text
execute_attempt=1
execute_retry=0

input=1
insertedCandidate=1
reusedCandidate=0
conflict=0
unexpected=0
```

既有 Write Adapter 在单一 `SERIALIZABLE READ WRITE` 事务中完成：

```text
完整批次重读与分类
→ Scope INSERT（affected rows = 1）
→ Context Version 1 INSERT（affected rows = 1）
→ Context Head 1 INSERT（affected rows = 1）
→ 提交前完整重检为严格一致 reusedCandidate
→ commit
```

没有 UPDATE、UPSERT、DELETE、TRUNCATE、DDL、自动重试、第二次 `--execute`、savepoint
补写或 Runner 外 SQL 旁路。提交后由独立 ReadOnly Adapter 重新分类：

```text
input=1
insertedCandidate=0
reusedCandidate=1
conflict=0
unexpected=0
```

## 9. 写入影响与终态核验

| 影响 | 净变化 |
|---|---:|
| Institution Scope | `+1` |
| Context Version 1 | `+1` |
| Context Head 1 | `+1` |
| tenant 父表 | `0` |
| 其他公开业务表计数 | `0` |
| Journal／Schema Shape | `0` |
| conflict／unexpected | `0／0` |

“其他公开业务表写入为 0”的证据由三层组成：专用角色没有其他表写权限；Write Adapter
只有三张 A1 表的静态 INSERT；独立只读探针比较全部公开表执行前后计数，只有三张目标表发生
预期净变化。本报告不把低敏计数扩大为全库逐行 bit-for-bit 证明。

## 10. 验证断言修正记录

主执行进程在成功 commit、提交后严格复用分类、Lease release、client 关闭、撤权和角色删除
之后，复用了“执行前三表必须为空”的通用快照断言，因此返回固定码
`fixed_table_count_drift`。该固定码对应过时的收尾预期，不是 conflict、unexpected、事务失败
或数据库漂移。

处理方式严格保持只读：

- 没有重新调用 Runner；
- 没有第二次 dry-run 或第二次 `--execute`；
- 没有重新签发 Lease或恢复权限；
- 独立新连接只读确认三表为 `1／1／1`、tenant 为 `2`、Journal 为 `39`；
- Shape、数据库／Schema／表／序列／Default Privileges、角色目录和 membership 均与执行前
  规范化快照一致；
- 原 Candidate／Approved Manifest 身份和内容一致；
- 只读修正探针的 Runner／execute 调用均为 `0`。

该运维断言问题只存在于仓库外一次性 Helper；Helper 未进入 Git，已删除，不需要修改 Runtime、
Runner、Kernel、Adapter、Schema、Migration 或测试。

## 11. 清理结果

固定顺序和结果：

1. Lease release 并验证重放拒绝：完成；
2. Runner client 关闭：完成；
3. `ALTER ROLE NOLOGIN`：完成；
4. 精确撤销本任务直接授权：完成；
5. 活动连接、direct ACL、membership、ownership 与 sequence 权限均为 `0`：通过；
6. `DROP ROLE`：完成，未使用 `DROP OWNED CASCADE`；
7. 凭证、Authority／Lease 状态、输入副本、Helper 和临时目录：已删除，残留 `0`；
8. 原 Candidate 与原 Approved Manifest：继续保留且未修改。

最终 `PUBLIC TEMPORARY=false`、`PUBLIC CONNECT=true`；数据库、Schema、表、序列和 Default
Privileges 除已经提交的三张 A1 数据行外均回归执行前语义快照。

## 12. 零越界与结论

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

```text
a2_p1_execution_validation=passed
eligible_for_a2_p1_independent_review=true
eligible_for_a2_p1_handoff=false
eligible_for_a2_p2=false
```

下一步只能由独立审查 PR 核对本报告、执行状态机、恢复点边界、唯一 attempt、角色／Lease 清理、
过时终态断言的处置和零敏感输出。独立审查通过前，不得把 A2-P1 标记完成；A2-P2 仍未启动、
未授权。
