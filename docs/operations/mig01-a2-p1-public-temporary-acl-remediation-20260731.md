# MIG-01A2 A2-P1 `PUBLIC TEMPORARY` ACL 调整低敏证据

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-P1-PUBLIC-TEMPORARY-ACL-REMEDIATION-01`
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 执行 Base：`8afcc301bae4e4ad7eac03917b906b0ca9d18c0c`
- 状态：`current low-sensitive ACL remediation evidence`
- 交付范围：docs-only；仓库内只新增本报告
- 数据库范围：固定 localhost-only `local_acceptance` 环境中的唯一目标数据库

本报告记录一次经用户明确授权的数据库级 `PUBLIC TEMPORARY` 权限收敛、变更前后固定
只读探针、独立持久状态复核和零越界结果。它不是专用角色创建、表级授权、Execution
Lease、Runner、`--execute`、A2-P1、A2-P2 或其他数据库操作的授权。

本报告不记录数据库标识符、角色引用、连接参数、私有路径、SQL 原始结果、ACL 原始行、
Manifest 正文、双引用、digest、Secret、Token、凭证或 PII。

## 2. 前置决策与 GitHub 冻结

| 项目 | 结果 |
|---|---|
| 权限决策 PR | #833 |
| PR #833 Head | `ab5762bf0ce2442ed021b638164fb258874e0d48` |
| PR #833 Merge Commit | `8afcc301bae4e4ad7eac03917b906b0ca9d18c0c` |
| PR #833 Required Check | Run `30598201520`／Job `91055097125`，成功 |
| PR #833 文件范围 | 1 个 proposed decision Markdown |
| 合并方式 | Merge Commit |
| 执行时 main／origin/main | 与执行 Base 一致 |
| 工作树与 Git 操作 | 干净；未发现进行中的操作或锁 |
| 并发写入 Agent | `0` |
| 当前任务选择 | 方案 A |

PR #833 只把 proposed 决策纳入仓库。实际 ACL 调整由当前任务单独授权，范围仅为一次
数据库级 `REVOKE TEMPORARY ... FROM PUBLIC`，以及验证失败且已确认撤权生效时的一次
条件化恢复。本次未命中恢复条件。

## 3. 证据来源与职责分离

本次证据来自四个相互区分的来源：

| 来源 | 职责 |
|---|---|
| 冻结仓库与 GitHub | Base、决策、分支保护、Required Check 和文件范围 |
| 变更前固定只读探针 | 目标身份、角色／连接／临时对象计数、规范化 ACL、Journal、Shape 与固定四表计数 |
| 单次 ACL 调整事务 | 只执行获授权的数据库级 `PUBLIC TEMPORARY` 撤销 |
| 变更后固定只读探针与独立第二次只读连接 | 比较规范化权限、对象、Journal、Shape、计数并确认持久最终状态 |

变更前后探针均使用：

- `REPEATABLE READ + READ ONLY`；
- 固定 SELECT-only 白名单；
- 有限 statement／lock timeout；
- 禁用交互式 psql 配置与命令回显；
- 只向本报告提供布尔值和低敏计数。

ACL 调整不通过 Runner、ReadOnly Adapter 或 Write Adapter 执行。仓库外一次性会话没有
形成通用 SQL 入口，没有进入仓库，结束后没有 Helper 文件残留。

## 4. 变更前硬门

| 硬门 | 结果 |
|---|---:|
| 固定 localhost-only 目标 | `true` |
| 目标身份与冻结环境一致 | `true` |
| 当前管理员具备数据库 ACL 调整权限 | `true` |
| 非超级用户登录角色 | `0` |
| 当前会话之外的目标数据库 client | `0` |
| Prepared Transaction | `0` |
| 临时 Schema | `0` |
| 临时对象 | `0` |
| `PUBLIC TEMPORARY` | `true` |
| `PUBLIC TEMPORARY WITH GRANT OPTION` | `false` |
| `PUBLIC CONNECT` | `true` |
| `PUBLIC CREATE` | `false` |
| 需要保留 `TEMPORARY` 的直接授权 allowlist | `0` |
| Applied Migration | `39` |
| 目标表存在性 | `true` |

固定四表低敏计数：

| 表类别 | 变更前 |
|---|---:|
| tenant 父表 | `2` |
| Scope | `0` |
| Context Version | `0` |
| Context Head | `0` |

变更前已冻结下列规范化语义快照，但未输出原始 ACL、对象名以外的私有引用或 digest：

- 除目标 `PUBLIC TEMPORARY` 外的数据库 ACL；
- Schema、表、序列和 Default Privileges；
- 角色属性、成员关系和对象 Owner；
- Applied Migration Journal；
- A1 Schema Shape；
- 固定四表低敏计数。

所有硬门均满足后才进入唯一调整事务。

## 5. 单次 ACL 调整

| 动作 | 计数／结果 |
|---|---:|
| 获授权的数据库级 `REVOKE TEMPORARY ... FROM PUBLIC` | `1` |
| 直接角色 `GRANT TEMPORARY` | `0` |
| 条件化 `GRANT TEMPORARY ... TO PUBLIC` 回退 | `0` |
| 其他数据库 ACL 调整 | `0` |
| Schema／表／序列／Default Privileges 调整 | `0` |

调整在独立短事务内完成。事务在执行前再次确认目标身份、ACL Owner 权限、零普通登录
角色、零其他 client、零 Prepared Transaction、零临时 Schema／对象、空 allowlist
以及 `PUBLIC TEMPORARY=true`、`PUBLIC CONNECT=true`、`PUBLIC CREATE=false`。

没有使用 `CASCADE`、`ALL`、系统 Catalog 更新或现场扩权。

## 6. 变更后验证

| 项目 | 变更前 | 变更后 | 结论 |
|---|---:|---:|---|
| `PUBLIC TEMPORARY` | `true` | `false` | 通过 |
| `PUBLIC CONNECT` | `true` | `true` | 未变化 |
| `PUBLIC CREATE` | `false` | `false` | 未变化 |
| `TEMPORARY` 直接授权 allowlist | `0` | `0` | 未变化 |
| 非超级用户登录角色 | `0` | `0` | 未变化 |
| 其他 client | `0` | `0` | 未变化 |
| Prepared Transaction | `0` | `0` | 未变化 |
| 临时 Schema | `0` | `0` | 未变化 |
| 临时对象 | `0` | `0` | 未变化 |
| Applied Migration | `39` | `39` | 未变化 |
| tenant 父表 | `2` | `2` | 未变化 |
| Scope | `0` | `0` | 未变化 |
| Context Version | `0` | `0` | 未变化 |
| Context Head | `0` | `0` | 未变化 |

规范化比较结果：

| 比较项 | 结果 |
|---|---|
| 除目标 `PUBLIC TEMPORARY` 外的数据库 ACL | 未变化 |
| Schema ACL | 未变化 |
| 表 ACL | 未变化 |
| 序列 ACL | 未变化 |
| Default Privileges | 未变化 |
| 角色属性与角色目录 | 未变化 |
| 角色成员关系 | 未变化 |
| Journal | 未变化 |
| A1 Schema Shape | 未变化 |

独立第二次只读连接再次确认：

```text
public_temporary=false
public_connect=true
temporary_allowlist_count=0
login_role_count=0
other_client_count=0
temp_schema_count=0
temp_object_count=0
journal_count=39
fixed_table_counts=2/0/0/0
```

“数据未变化”在本报告中的精确含义是：固定四表低敏计数前后一致，Journal 与 A1 Shape
一致，且唯一写语句属于数据库 ACL 调整；本次业务 DML 为 `0`。本报告不把这些证据
扩大为全库逐行 bit-for-bit 证明。

## 7. 回退状态

- 验证失败：`false`；
- 回退条件命中：`false`；
- 回退执行次数：`0`；
- 最终 `PUBLIC TEMPORARY=false`；
- 最终 `PUBLIC CONNECT=true`。

如果后续发现权限或兼容性事实漂移，必须创建新的明确授权任务；不得复用本任务授权
自行恢复、再次撤销或扩大角色权限。

## 8. 零越界证据

| 类别 | 数量／结果 |
|---|---:|
| 数据库角色创建、修改或删除 | `0` |
| 表级 `SELECT`／`INSERT` 授权 | `0` |
| Execution Lease 签发、读取、claim、消费或 release | `0` |
| Runner 调用 | `0` |
| dry-run | `0` |
| `--execute` | `0` |
| Migration／Seed | `0` |
| 业务 DDL／DML | `0` |
| Runtime／Schema／Migration 修改 | `0` |
| scripts／tests／CI／package／lock 修改 | `0` |
| 非 localhost 环境连接 | `0` |
| 私有引用或凭证输出 | `0` |
| 持久 Helper 残留 | `0` |

## 9. 结论与后续边界

```text
public_temporary_acl_remediation=passed
ready_for_public_temporary_acl_independent_review=true
eligible_for_dedicated_role_provisioning=false
eligible_for_a2_p1=false
```

本报告只允许进入独立 ACL 证据审查。独立审查必须以本报告合并后的 main 为事实源，不得
重新连接数据库、重复 ACL 调整或补写执行事实。

专用角色预置、表级权限、Authority、Lease、Runner、`--execute` 和 A2-P1 仍未执行，
也未获得本报告的任何自动授权。
