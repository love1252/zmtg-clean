# MIG-01A2 A2-P1 `PUBLIC TEMPORARY` ACL 独立审查

## 1. 文档定位

- 当前任务：`V2-MIG01-A2-P1-PUBLIC-TEMPORARY-ACL-REMEDIATION-01`
- 阶段：ACL 调整低敏证据独立审查
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 审查 Base：`2cf55056ad1182297fb9cc1d2c5c22d4e2ee20c0`
- 审查方式：docs-only、独立只读复核
- 审查结论：`passed`

本审查只核对已经合并的决策、ACL 低敏证据、GitHub 交付事实、证据来源归因和后续授权
边界。审查未重新连接数据库、未重复 ACL 调整，也未运行任何 Runner、dry-run 或
`--execute`。

本审查不把低敏证据扩大为原始 ACL、SQL 原始结果、数据库标识符、角色引用、连接参数、
私有路径、Manifest、双引用、digest、凭证或业务正文的公开记录。

## 2. 冻结审查对象

### 2.1 权限决策

| 项目 | 冻结值 |
|---|---|
| PR | #833 |
| Head | `ab5762bf0ce2442ed021b638164fb258874e0d48` |
| Merge Commit | `8afcc301bae4e4ad7eac03917b906b0ca9d18c0c` |
| Required Check | Run `30598201520`／Job `91055097125`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |

### 2.2 ACL 调整低敏证据

| 项目 | 冻结值 |
|---|---|
| PR | #834 |
| Head | `eb6e76b23afd03a4447e082b1e735c59ca3d4990` |
| Merge Commit | `2cf55056ad1182297fb9cc1d2c5c22d4e2ee20c0` |
| Required Check | Run `30599333356`／Job `91058440874`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |
| 证据文件 | `docs/operations/mig01-a2-p1-public-temporary-acl-remediation-20260731.md` |
| 证据 blob | `69867f7af9335f6d8d5175bd5aea8aa1a065c757` |

两个 Merge Commit 均有冻结 Base 与 PR Head 两个父提交，Merge tree 与对应 PR Head
tree 一致。两个 PR 均无评论、Review 或未解决 thread。

## 3. 审查方法与边界

独立审查逐项比较：

1. PR #833 方案 A 的允许动作、硬门、验证、回退和禁止范围；
2. PR #834 低敏证据的变更前硬门、单次动作、变更后比较与零越界记录；
3. GitHub 上的 Head、Base、提交数、文件数、Required Check、Merge Commit 和合并方式；
4. 仓库静态 Migration Journal 的 39 项记录与末项 `0038`；
5. A2-P1 执行计划、Runbook 与 canonical handoff 中的角色、Lease、Runner 和执行门禁。

审查不使用数据库实时状态作为第二事实源。执行后的数据库状态只按已经合并的低敏证据
审查其来源、完整性和内部一致性；未来任务仍必须重新执行获授权的实时只读核验。

## 4. 发现项

```text
blocking_findings=0
non_blocking_findings=0
```

未发现需要修正 ACL 证据或阻断 handoff 的事实、归因、数量或授权边界问题。

## 5. 证据来源归因审查

| 证据来源 | 记录职责 | 审查结论 |
|---|---|---|
| 冻结仓库与 GitHub | Base、PR、Required Check 与文件范围 | 一致 |
| 变更前固定只读探针 | 目标、ACL、角色／连接／临时对象、Journal、Shape 与计数 | 边界明确 |
| 单次 ACL 调整事务 | 唯一获授权的 `PUBLIC TEMPORARY` 撤销 | 边界明确 |
| 变更后固定只读探针 | 规范化 pre／post 比较 | 边界明确 |
| 独立第二次只读连接 | 持久最终状态低敏复核 | 边界明确 |

证据没有把 ACL、Journal、Catalog、Shape 或全表计数错误归因给 Runner、ReadOnly
Adapter 或 Write Adapter。报告明确说明：

- ACL 调整不经过任何 Adapter；
- 固定只读探针与唯一调整事务相互分离；
- 没有通用 SQL 入口；
- 仓库外会话没有形成持久 Helper。

## 6. 变更前硬门审查

| 硬门 | 冻结证据 | 审查 |
|---|---:|---|
| localhost-only 与目标身份 | `true` | 通过 |
| ACL Owner 权限 | `true` | 通过 |
| 非超级用户登录角色 | `0` | 通过 |
| 其他 client | `0` | 通过 |
| Prepared Transaction | `0` | 通过 |
| 临时 Schema／对象 | `0／0` | 通过 |
| `PUBLIC TEMPORARY` | `true` | 通过 |
| `PUBLIC CONNECT` | `true` | 通过 |
| `PUBLIC CREATE` | `false` | 通过 |
| 直接 `TEMPORARY` allowlist | `0` | 通过 |
| Applied Migration | `39` | 通过 |
| 固定四表计数 | `2／0／0／0` | 通过 |

除目标 `PUBLIC TEMPORARY` 外的数据库 ACL、Schema／表／序列 ACL、Default
Privileges、角色属性、成员关系、Owner、Journal、A1 Shape 与固定四表计数均在变更前
冻结为规范化语义快照。

## 7. 唯一动作与变更后审查

| 项目 | 结果 | 审查 |
|---|---:|---|
| 获授权 `REVOKE` | `1` | 精确 |
| 直接角色 `GRANT TEMPORARY` | `0` | 未扩权 |
| 条件化回退 | `0` | 未命中 |
| 其他 ACL 调整 | `0` | 未越界 |
| `CASCADE`／`ALL`／Catalog update | `0` | 未使用 |

变更后：

```text
public_temporary=false
public_connect=true
public_create=false
temporary_allowlist_count=0
login_role_count=0
other_client_count=0
prepared_transaction_count=0
temp_schema_count=0
temp_object_count=0
journal_count=39
fixed_table_counts=2/0/0/0
```

规范化比较确认其他数据库 ACL、Schema／表／序列 ACL、Default Privileges、角色目录、
成员关系、Journal 与 A1 Shape 未变化。独立第二次只读连接的低敏结果与变更后探针
一致。

报告将“数据未变化”限定为固定四表计数、Journal、Shape 前后一致和业务 DML 为 `0`，
没有不当声称全库逐行 bit-for-bit 一致。

## 8. 回退与零越界审查

| 类别 | 数量／结果 |
|---|---:|
| 回退条件命中 | `false` |
| 回退执行 | `0` |
| 最终 `PUBLIC TEMPORARY` | `false` |
| 最终 `PUBLIC CONNECT` | `true` |
| 角色创建、修改或删除 | `0` |
| 表级 `SELECT`／`INSERT` 授权 | `0` |
| Lease 操作 | `0` |
| Runner／dry-run／`--execute` | `0／0／0` |
| Migration／Seed／业务 DDL／DML | `0` |
| Runtime／Schema／Migration／scripts／tests／CI／package／lock 修改 | `0` |

当前授权已经消费完毕，不得复用为后续角色创建、权限授予、ACL 恢复或 A2-P1 执行许可。

## 9. 审查限制

本次独立审查按任务边界没有连接数据库，只能确认合并证据的来源归因、完整性、GitHub
交付事实和内部一致性。因此：

- `2026-07-31` 的执行后状态不能被写成永久环境事实；
- handoff 必须要求后续任务重新核验 `PUBLIC TEMPORARY=false`、`PUBLIC CONNECT=true`
  和完整有效权限矩阵；
- 低敏证据不保留原始 ACL、角色名或 SQL 行，属于明确的最小披露边界；
- 上述限制不阻断本次 ACL handoff，但继续阻断专用角色预置和 A2-P1。

## 10. 结论与后续边界

```text
public_temporary_acl_independent_review=passed
eligible_for_public_temporary_acl_handoff=true
eligible_for_dedicated_role_provisioning=false
eligible_for_a2_p1=false
```

ACL 调整证据足以进入独立 handoff。handoff 只能记录决策、调整和审查已经完成，并冻结
唯一下一任务；不得创建专用角色、授予表级权限、签发 Lease、运行 Runner 或启动
A2-P1。
