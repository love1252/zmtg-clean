# MIG-01A2 A2-P1 `PUBLIC TEMPORARY` 权限边界决策

> 任务编号：`V2-MIG01-A2-P1-DATABASE-PRIVILEGE-BOUNDARY-DECISION-01`
>
> 状态：`proposed decision record`
>
> 审计基线：`6d9197dad390c5f087aed6eb078de501ee972fed`
>
> 审计日期与时区：2026-07-31，Asia/Shanghai
>
> 交付性质：单文件 docs-only；不是 ADR、`accepted decision`、数据库权限变更、环境创建或 A2-P1 执行授权。

## 1. 文档定位

本文只处理固定 localhost-only `local_acceptance` PostgreSQL 数据库通过
`PUBLIC` 向所有角色授予 `TEMPORARY`，导致 A2-P1 专用执行角色无法满足精确最小
权限门禁的问题。

本文提供：

- 当前低敏事实与 PostgreSQL 权限语义；
- 方案 A／B／C 的安全、影响、回退和验证比较；
- 推荐顺序及采用推荐方案所需的后续明确授权；
- A2-P1 恢复执行前必须关闭的权限硬门。

本文不重新决定 D01～D12，不修改既有 Manifest、Runner、Authority、Lease、事务或
职责分离结论，也不表示任何数据库 ACL 已经改变。推荐仍为 `proposed`；用户尚未
选择方案。

当前结论固定为：

```text
A2-P1 = blocked
专用执行角色创建 = 0
Execution Lease 签发／读取／消费 = 0
Runner dry-run／--execute = 0
数据库业务写入 = 0
```

## 2. 权威关系与证据边界

本决策记录遵循以下事实与约束层级：

1. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 决定已接受的
   A2 治理边界；
2. 当前 `main` 的 Contract、Kernel、Runner、Context Policy、ReadOnly／Write
   Adapter 决定 `current` 实现事实；
3. `docs/operations/mig01-a2-provisioning-runbook.md` 提供当前治理基础和
   proposed 执行程序；
4. `docs/operations/mig01-a2-p1-execution-plan-20260731.md` 冻结 A2-P1 分层
   授权和精确最小权限要求；
5. `docs/handoff/NEXT_TASK.md` 冻结当前一次受控执行的实时硬门；
6. 本文只处理尚未关闭的数据库级 `PUBLIC TEMPORARY` 选择，不得独立改写上述
   Owner、Manifest、Runner、Migration 或发布门禁。

PR #828～#832 的 GitHub 合并状态已在本任务启动时只读核对：

| PR | 当前合并结论 |
|---|---|
| #828 | A2-P1 受控执行计划已使用 Merge Commit 合并 |
| #829 | Write Adapter Runtime 已使用 Merge Commit 合并 |
| #830 | Runtime handoff 已使用 Merge Commit 合并 |
| #831 | Authority／组合根无写证据已使用 Merge Commit 合并 |
| #832 | Authority／组合根 handoff 已使用 Merge Commit 合并 |

上一轮受控执行尝试在角色创建前通过固定只读 catalog 预检得到以下低敏证据：

- 目标被核对为固定 localhost-only `local_acceptance`；
- 非超级用户登录角色数量为 `0`；
- 目标数据库通过 `PUBLIC` 提供 `TEMPORARY`；
- 无法只对未来专用角色撤销由 `PUBLIC` 提供的该权限；
- 检测到该权限边界后立即停止，未创建角色、未签发 Lease、未运行 dry-run 或
  `--execute`，数据库写入为 `0`；
- 临时 Helper、私有状态和空工作分支已清理。

上述内容是 2026-07-31 已取得的低敏执行前证据，不是数据库状态的永久事实。
本任务按要求没有连接数据库；任何后续权限变更或 A2-P1 恢复任务都必须先以
SELECT-only catalog 探针重新实时核验，不得只依赖本文。

## 3. PostgreSQL 权限模型

### 3.1 数据库、Schema 与表权限是不同层次

- 数据库 `CONNECT` 允许建立到指定数据库的连接；
- 数据库 `TEMPORARY` 允许在该数据库中创建临时表；
- 数据库 `CREATE` 允许创建 Schema、Publication，并可安装受信扩展；
- Schema `USAGE` 允许解析该 Schema 中的对象；
- Schema `CREATE` 允许在该 Schema 中创建对象；
- 表级 `SELECT`／`INSERT` 只控制相应表的数据读取和新增。

因此，撤销 Schema `CREATE` 或不给普通表 DDL 权限，不能抵消数据库级
`TEMPORARY`。具有 `TEMPORARY` 的会话仍可在其临时 Schema 中创建临时对象。

### 3.2 `PUBLIC` 是所有角色共同的隐式权限来源

PostgreSQL 把 `PUBLIC` 视为所有当前和未来角色都隐式属于的集合。一个角色的有效
权限是直接授权、角色成员关系和 `PUBLIC` 授权的并集；`NOINHERIT` 不会取消
`PUBLIC` 权限，PostgreSQL 也没有可用于单角色覆盖该授权的 `DENY`。

因此：

```text
PUBLIC 拥有数据库 TEMPORARY
→ 所有非超级用户登录角色有效 TEMPORARY=true
→ 对某个专用角色执行 REVOKE TEMPORARY 不会抵消 PUBLIC 来源
```

PostgreSQL 16 默认会在数据库创建时向 `PUBLIC` 授予 `CONNECT` 和
`TEMPORARY`；表、列和序列默认不向 `PUBLIC` 授权。官方依据：

- [PostgreSQL 16：Privileges](https://www.postgresql.org/docs/16/ddl-priv.html)
- [PostgreSQL 16：GRANT](https://www.postgresql.org/docs/16/sql-grant.html)
- [PostgreSQL 16：REVOKE](https://www.postgresql.org/docs/16/sql-revoke.html)

### 3.3 A2-P1 的精确有效权限

当前 A2-P1 门禁要求专用执行角色最终有效权限精确为：

| 对象层次 | 允许 | 必须为否 |
|---|---|---|
| 固定目标数据库 | `CONNECT` | `CREATE`、`TEMPORARY` |
| `public` Schema | `USAGE` | `CREATE` |
| `tenants` | `SELECT` | `INSERT`、`UPDATE`、`DELETE`、`TRUNCATE`、`REFERENCES`、`TRIGGER` |
| 三张 A1 表 | `SELECT`、`INSERT` | `UPDATE`、`DELETE`、`TRUNCATE`、`REFERENCES`、`TRIGGER` |
| 其他用户表 | 无 | 全部表级权限 |
| 用户序列 | 无 | `USAGE`、`SELECT`、`UPDATE` |
| 角色成员关系、对象所有权 | 无 | 任意继承权限或所有权 |

三张 A1 表继续精确为：

- `institution_scopes`
- `institution_operating_context_versions`
- `institution_operating_contexts`

系统函数的既有可执行能力只允许满足当前 Adapter 已冻结的 catalog、格式化、
timeout 和 advisory lock 调用，不得借本决策增加用户自定义函数、通用 SQL 或
第二执行入口。

## 4. 决策总表

| 方案 | 核心做法 | 是否满足当前 A2-P1 最小权限 | 主要代价 | 当前建议 |
|---|---|---|---|---|
| A | 在现有固定 `local_acceptance` 数据库撤销 `PUBLIC TEMPORARY`；仅向有证据证明需要的既有受控角色直接授予 | 是，前提是实时 ACL 与角色影响验证全部通过 | 改变该数据库所有当前和未来普通角色的默认临时对象能力 | 首选 |
| B | 保留 `PUBLIC TEMPORARY`，把它记录为本地验收环境风险例外并放宽 A2-P1 准入 | 否；只有先修改当前权限规则后才能声称满足新规则 | 专用 Operator 继续拥有 Runner 不需要的临时 DDL／存储能力 | 最后考虑 |
| C | 新建独立 localhost-only 验收数据库，初始化时收敛 `PUBLIC TEMPORARY`，再在新环境执行 A2-P1 | 可以，但必须重新完成环境、Migration、数据和恢复证据 | 新数据库生命周期、环境漂移与第二验收环境治理成本 | 次选 |

未选择并完成任一满足条件的方案前，`A2-P1=blocked`。

## 5. 方案 A：收敛现有目标数据库的 `PUBLIC TEMPORARY`

### 5.1 精确范围

只针对当前已冻结的 localhost-only `local_acceptance` 目标数据库：

```sql
REVOKE TEMPORARY
ON DATABASE <固定 local_acceptance 数据库标识符>
FROM PUBLIC;
```

这是一项数据库对象 ACL 变更，不是 Schema／表结构 Migration；但它是对该数据库
所有普通角色的共享权限政策变更，必须获得独立、明确的数据库权限操作授权。

只有只读审计证明某个既有受控角色确实依赖临时表，且用户逐项批准后，才允许：

```sql
GRANT TEMPORARY
ON DATABASE <固定 local_acceptance 数据库标识符>
TO <逐项批准的既有受控角色>;
```

不得：

- 向 A2-P1 专用 Operator 授予 `TEMPORARY`；
- 修改 `PUBLIC CONNECT`、数据库 `CREATE`、Schema ACL 或 Default Privileges；
- 使用 `GRANT ALL`／`REVOKE ALL`；
- 改变其他数据库、现有角色属性、角色成员关系或对象所有权；
- 把该权限任务与 Runner `--execute` 放在同一个未经独立验证的步骤中。

上一轮低敏证据显示非超级用户登录角色数量为 `0`，因此当前预期的既有直接
`TEMPORARY` 受控角色 allowlist 为空；后续任务仍必须实时枚举，不能把历史计数当作
免检依据。

### 5.2 安全收益

- 新建专用 Operator 不再自动获得临时对象创建能力；
- Operator 的有效权限可以收敛到固定四表读取、三表插入；
- 当前 Runner 静态写路径与数据库实际授权边界一致；
- 未来新普通角色不会因为 `PUBLIC` 自动取得该数据库的临时存储／DDL 能力。

### 5.3 影响范围与风险

- 影响目标数据库内所有当前和未来非超级用户角色，而不只影响 A2-P1；
- 依赖临时表的本地测试、Migration 工具、维护脚本或连接池可能失败；
- 数据库 owner／superuser 的实际能力不能用于证明普通 Operator 已最小化；
- 若原 ACL 使用 PostgreSQL 内建默认表示，`REVOKE` 后再 `GRANT` 可恢复权限语义，
  但 raw catalog 可能从隐式默认变为显式 ACL；验证应比较规范化权限语义，而不是
  要求 raw `datacl` 字节完全相同；
- 变更前若存在活动普通会话或临时对象，不能据此推断执行窗口已经隔离。

### 5.4 变更前验证

后续独立权限任务至少必须以固定 SELECT-only catalog 探针证明：

1. 目标仍为唯一固定 localhost-only `local_acceptance`；
2. `PUBLIC` 的有效数据库权限精确包含 `CONNECT`、`TEMPORARY`，不包含
   `CREATE`；
3. `public` Schema 的 `USAGE=true`、`CREATE=false`；
4. 当前和未来执行角色没有直接 `TEMPORARY` grant；
5. 全部可登录普通角色、角色成员关系和对象所有权完成低敏枚举；
6. 需要临时表的既有受控角色 allowlist 已由用户逐项批准；无证据时为空；
7. 非管理员活动会话、活跃事务和临时 Schema／对象均为 `0`；
8. 变更前规范化数据库 ACL 语义与逐角色有效权限布尔矩阵已冻结在仓库外私有状态。

公开证据只记录状态、布尔值和数量，不记录数据库标识、角色名、raw ACL、连接参数
或原始 catalog 行。

### 5.5 变更后验证

必须证明：

- `PUBLIC TEMPORARY=false`；
- `PUBLIC CONNECT=true`；
- 数据库 `PUBLIC CREATE=false`；
- A2-P1 Operator `TEMPORARY=false`；
- 仅逐项批准的既有角色可以有直接 `TEMPORARY=true`；
- `public` Schema ACL、表 ACL、序列 ACL、角色成员关系和对象所有权未发生意外
  变化；
- 本地依赖检查通过，且没有为追求通过而向 `PUBLIC` 或 Operator 扩权；
- 变更证据经独立审查与 handoff 合并后，才允许提出新的 A2-P1 恢复授权。

### 5.6 回退

仅在预先冻结的本地兼容性失败或 ACL 验证失败条件命中时，由独立权限 Owner 执行：

```sql
GRANT TEMPORARY
ON DATABASE <固定 local_acceptance 数据库标识符>
TO PUBLIC;
```

若方案 A 期间向获批既有角色增加了直接 grant，回退前后都必须逐项核对并按冻结
计划撤销不再需要的直接 grant。回退完成后必须证明规范化权限语义与变更前一致。

一旦恢复 `PUBLIC TEMPORARY`，A2-P1 立即重新变为 `blocked`；不得在回退状态下创建
专用 Operator 或运行 Runner。

### 5.7 文档影响

- 不需要重新打开 D01～D12，也不需要修改架构 Owner 或 Schema／Migration 决策；
- 方案被用户接受并实际验证后，应由独立 handoff 把 ACL 当前事实回填到 Runbook、
  执行计划或 canonical handoff；
- 本决策 PR 不提前修改这些来源，也不把 proposed 方案写成 current。

## 6. 方案 B：保留 `PUBLIC TEMPORARY` 并接受风险

### 6.1 做法

保持数据库 ACL 不变，在 A2-P1 权限规则中明确：

- local_acceptance Operator 可通过 `PUBLIC` 继承 `TEMPORARY`；
- 该能力不属于 Runner 业务需要，只是经用户接受的环境风险例外；
- 静态 Runner allowlist、单连接、短 TTL、NOINHERIT、无对象所有权和执行后删角色
  只能降低风险，不能把 `TEMPORARY` 变成不存在。

### 6.2 安全风险

- Operator 可以在数据库临时 Schema 中创建临时表，拥有超出固定三表 `INSERT`
  之外的写入和临时 DDL 能力；
- 权限核验不再是“有效权限精确等于 allowlist”，而变成“allowlist + 环境例外”；
- Runner 代码目前不调用临时表，只能证明当前代码路径未使用该能力，不能证明数据库
  主体没有该能力；
- 该例外可能被后续本地任务复制，逐步削弱精确最小权限门禁。

### 6.3 影响、回退与验证

- 数据库状态不变，对现有本地账号影响最小；
- 无数据库 ACL 回退动作；若撤销风险接受，必须回退相关 accepted 记录、Runbook 和
  执行计划，并重新选择方案 A 或 C；
- 验证必须如实报告 `Operator TEMPORARY=true`，不得写成最小权限通过；
- 即使采用 B，仍需验证数据库 `CREATE=false`、Schema `CREATE=false`、无角色成员
  关系、无对象所有权、无序列或范围外表权限。

### 6.4 是否满足 A2-P1

方案 B 不满足当前已冻结的 A2-P1 精确最小权限规则。若用户确实要求采用，必须先
通过独立 accepted 权限例外任务：

1. 明确修改最小权限定义；
2. 记录风险所有者、适用范围、失效条件和禁止复制范围；
3. 同步 Runbook、执行计划和 handoff；
4. 经独立安全审查和 Required Check 合并；
5. 再重新授权 A2-P1。

本决策包不能自行完成上述接受，也不能把 B 当作默认执行许可。

## 7. 方案 C：新建独立 localhost-only 验收数据库

### 7.1 做法

建立一个与当前目标分离的 localhost-only 验收数据库，并在任何普通角色接入前撤销
该新数据库的 `PUBLIC TEMPORARY`。新数据库必须独立冻结：

- 环境身份、owner、连接边界和生命周期；
- 从空库到仓库 0038 的 Migration 序列与 journal；
- tenant 父记录和三张 A1 表执行前状态；
- Approved Manifest、Context Policy、Recovery Point 与职责分离；
- 专用 Operator 的精确 ACL 和清理；
- 环境废弃、保留或删除授权。

### 7.2 安全收益

- 不改变现有 `local_acceptance` 数据库中其他普通角色的临时表能力；
- 可以从环境创建开始收敛 ACL，并隔离 A2-P1 执行窗口；
- 若新环境生命周期严格受控，专用 Operator 可以满足当前最小权限。

### 7.3 影响与风险

- 需要 `CREATE DATABASE`、初始化 Migration、必要的低敏父记录准备、备份／恢复验证
  和最终环境生命周期操作；
- 新数据库创建时 PostgreSQL 仍可能默认向 `PUBLIC` 提供 `TEMPORARY`，必须在普通
  登录开放前明确撤销并验证；
- 新环境可能与既有 `local_acceptance` 的 journal、Schema Shape、配置、父记录或
  Approved Manifest 证据漂移；
- 会增加第二个验收数据库的 owner、端口、恢复点、清理与事实记录成本；
- 不得把复制生产数据、真实 PII、Seed 或未审批 Restore 当作环境初始化捷径。

### 7.4 回退

环境创建或验证失败时：

- 不在原目标数据库执行 A2-P1；
- 禁止自动 Restore、覆盖或切换现有环境；
- 将新环境设为不可连接并保留低敏失败证据；
- `DROP DATABASE` 属于破坏性环境生命周期动作，必须获得独立明确授权后执行；
- 删除前必须确认无所需恢复／审计证据和活动连接。

### 7.5 是否满足 A2-P1 与文档影响

只有新环境完成 journal、Shape、tenant、Recovery Point、ACL、Authority／Lease 和
dry-run 的全部实时验证后，方案 C 才满足 A2-P1。它需要：

- 独立环境创建与数据库生命周期授权；
- Migration 执行授权；
- 新环境就绪预检和独立 handoff；
- 更新 Runbook、执行计划和 canonical handoff 的目标环境事实；
- 如改变已接受的“固定 local_acceptance”环境语义或形成长期第二验收环境，先形成
  独立 accepted 环境决策。

方案 C 不得作为绕过现有数据库 ACL 审计的快速路径。

## 8. 推荐结论

推荐顺序：

```text
方案 A
→ 方案 C
→ 方案 B
```

### 8.1 首选方案 A

方案 A 与当前精确最小权限、单一 Runner、临时角色和 fail-closed 门禁一致。上一轮
低敏证据显示普通登录角色为 `0`，意味着当前已知影响面小于存在多个普通服务账号的
共享数据库；但该计数仍须实时复核。

方案 A 的核心不是“为了 A2-P1 临时绕过一次”，而是对固定本地验收数据库建立清晰
的默认权限边界：

- `PUBLIC` 保留 `CONNECT`；
- `PUBLIC` 不再拥有 `TEMPORARY`；
- 仅确有证据且经逐项批准的既有受控角色直接取得 `TEMPORARY`；
- A2-P1 Operator 永不取得 `TEMPORARY`。

### 8.2 方案 C 次选

只有方案 A 的本地依赖影响无法安全收敛，且用户愿意承担新数据库生命周期和重新
验证成本时，才选择 C。

### 8.3 方案 B 最后考虑

B 不满足当前最小权限门禁。选择 B 不是普通环境兼容决定，而是接受 Operator 拥有
额外临时 DDL／存储能力，必须先修改 accepted 权限边界，不能在执行窗口临场放宽。

## 9. 推荐方案 A 的下一轮明确授权

方案 A 只有经用户明确选择后，才能创建独立数据库权限变更任务。该任务的正式编号
与分支必须由后续授权冻结，不由本文自行创建。

下一轮授权至少必须精确允许：

1. 不读取业务行的 SELECT-only catalog 探针：
   - 数据库、Schema、表、序列、函数和 Default Privileges ACL；
   - `PUBLIC` 授权来源；
   - 普通登录角色、成员关系、所有权、活动会话和临时对象低敏计数；
2. 对唯一固定 localhost-only `local_acceptance` 数据库执行一次：
   - `REVOKE TEMPORARY ... FROM PUBLIC`；
3. 仅在用户预先逐项批准且证据证明需要时，对冻结 allowlist 中的既有受控角色执行
   直接 `GRANT TEMPORARY`；默认 allowlist 为空；
4. 运行固定权限正向／负向验证和必要的本地非业务兼容性检查；
5. 在预定义回退条件命中时执行一次 `GRANT TEMPORARY ... TO PUBLIC`，并恢复变更前
   的规范化权限语义；
6. 记录低敏变更证据并创建独立 Draft PR／独立审查／handoff。

下一轮必须继续禁止：

- 连接非 localhost 环境；
- 修改 `PUBLIC CONNECT`、数据库 `CREATE`、Schema ACL、表 ACL、Default
  Privileges 或其他数据库；
- `GRANT ALL`、`REVOKE ALL`、`CASCADE`、catalog UPDATE；
- 修改现有角色属性、成员关系或对象所有权；
- 创建 A2-P1 Operator、签发 Lease、运行 Runner、dry-run 或 `--execute`；
- Migration、Seed、Schema DDL、业务 DML、Restore；
- 修改 Runtime、Schema、Migration、脚本、测试、CI、package 或 lock。

权限变更与独立 handoff 通过后，仍需用户另行授权新的 A2-P1 恢复执行任务。该恢复
任务必须重新核对 `PUBLIC TEMPORARY=false` 和专用 Operator 的完整有效权限矩阵，
不得沿用旧尝试或本文作为实时数据库证明。

## 10. 停止与失效条件

后续任一任务出现以下情况必须保持 `A2-P1=blocked`：

- 目标不再是唯一固定 localhost-only `local_acceptance`；
- `PUBLIC TEMPORARY` 来源、ACL owner 或 grant option 无法解释；
- 发现未盘点的普通登录角色、活动会话、临时对象或本地依赖；
- 方案 A 需要修改 `PUBLIC CONNECT`、Schema ACL、Default Privileges 或其他数据库；
- 方案 C 需要未授权数据复制、Seed、Restore、Migration 或环境删除；
- 方案 B 未先完成 accepted 风险例外；
- 变更后 Operator 仍具有 `TEMPORARY`、数据库／Schema `CREATE`、范围外表或序列
  权限；
- 规范化 ACL 或逐角色有效权限未通过独立复核；
- 为追求绿灯需要创建角色、签发 Lease、运行 Runner 或扩大本次文件范围。

## 11. 本任务验证与禁止范围

本任务只新增本文，不修改执行计划、Runbook、accepted decisions 或 canonical
handoff。原因是方案尚未由用户选择，提前修改这些来源会把 proposed 建议错误写成
current／accepted。

本任务没有：

- 连接数据库或读取 `.env.local`、连接参数、凭证、Manifest 或 PII；
- 执行 `CREATE ROLE`、`ALTER ROLE`、`GRANT`、`REVOKE` 或 `DROP ROLE`；
- 修改 `PUBLIC`、数据库、Schema、表、序列、函数或 Default Privileges；
- 运行 Runner、dry-run、`--execute`、Migration、Seed、DDL、DML 或部署；
- 签发、读取或消费 Lease；
- 修改 Runtime、Schema、Migration、脚本、测试、CI、package 或 lock；
- 启动 A2-P1、A2-P2、BASE-02、Writer 或 Reader。

本文合并也不自动启动下一任务。用户必须先明确选择 A／B／C，并对相应后续数据库
操作、环境影响和回退范围重新授权。
