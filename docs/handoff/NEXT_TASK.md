# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 Stage D 已完成并收口：

- PR #825 Head：`151b6316e42bd6f9b0d5d6efcf96afe568675a4d`；
- PR #825 Merge Commit：`e6bfd470fb521fcd18e8093024efcdf0a56ab63c`；
- PR #825 Required Check：Run `30558783297`／Job `90926083649` 成功；
- PR #826 重放后 Head：`3e364afb7e1880c4b06ad92788cfb1a8d3972839`；
- PR #826 Merge Commit：`b514ee04c35c7ddb830787e0ad579f3b0469379c`；
- PR #826 Required Check：Run `30561620736`／Job `90935814730` 成功；
- Stage D 五项低敏计数为 `1／1／0／0／0`，计数守恒；
- F01 已关闭，独立审查结论为 `passed`；
- Stage D handoff 准入为 `true`，A2-P1 准入仍为 `false`；
- 数据库写入、Lease、`--execute`、Migration、Seed、DDL 和 DML 均为 `0`。

## 唯一下一任务

```text
A2-P1 manifest 驱动 provisioning
```

该名称直接沿用 `docs/architecture/v2-mig01-a2-provisioning-preflight.md` 的既有切片名称。仓库尚未冻结正式任务编号；测试示例编号不得复用，本 handoff 也不自行创建编号。

该任务尚未启动、尚未获得执行授权。当前 handoff 只将它冻结为唯一下一任务，不授权连接数据库、读取仓库外 Manifest、签发 Lease、运行 Runner 或执行任何写入。

## 一、权威边界与目标

未来 A2-P1 必须继续遵守：

1. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 的已接受边界；
2. `docs/architecture/v2-mig01-a2-provisioning-preflight.md` 的 P1／P2 严格拆分；
3. `docs/operations/mig01-a2-provisioning-runbook.md` 的受控执行、职责分离、Lease、事务和 forward-fix 门禁。

A2-P1 只允许通过一次性受控 Runner 处理仓库外 Approved Manifest。进入写事务前必须完成 Manifest 校验、执行授权校验与 Authority Port 验证；只有验证成功后才能进入写事务。

写事务内必须重新读取并分类完整批次，只允许：

- Institution Scope、Context Version 1、Context Head 1 的确定性原子创建或严格一致复用；
- `input／insertedCandidate／reusedCandidate／conflict／unexpected` 五项分类与计数守恒；
- 提交前重新核验完整批次；
- 任一冲突、部分存在或并发漂移时整批回滚。

Runner 是 A2-P1 唯一写入口，不得并行建立手写 Data Migration、脚本或业务 Runtime 写入口。

## 二、启动前必须独立冻结

未来任务只有获得新的用户明确授权后，才能冻结并核对：

1. 最新 `main`／`origin/main`、工作分支和冻结 Base；
2. 精确任务编号、文件范围、目标环境与停止条件；
3. Approved Manifest 的当前有效性、权限、Contract 与完整性；
4. Context Policy、环境 Journal、A1 Shape 和 tenant 父记录；
5. 已验证备份与恢复点；
6. Operator／Reviewer 职责分离；
7. 有效且未撤销、未释放、未过期的真实执行 Lease；
8. Lease Authority 与 Repository／Transaction Adapter；
9. 冻结 Head 对应的绿色 Required Check；
10. pre／post 低敏计数、事务回滚和 forward-fix 交付要求。
11. grant／revoke owner、最小数据库权限、异常与 `finally` 撤权；
12. Manifest 的获批保留期限、执行后删除条件和低敏删除证据。

任一项未冻结或发生漂移时必须停止，不得使用 Stage D 的只读授权代替 A2-P1 写入授权。

## 三、A2-P1 严格范围

未来获授权的 A2-P1 候选范围仅包括：

- Approved Manifest 受控输入和低敏校验；
- Scope、Context Version 1、Context Head 1 的原子创建或严格一致复用；
- 幂等重放、冲突封堵、稳定分类与计数守恒；
- 单事务回滚、低敏审计和执行后的独立 handoff。

输出只允许五项低敏计数和冻结的低敏错误码；不得输出私有路径、双键值、digest 值、Manifest 正文、连接信息、数据库原始异常或堆栈。

A2-P1 不得夹带：

- A2-P2 复合键、索引、FK／CHECK；
- journal／snapshot 或 Migration metadata 变更；
- 回填、`VALIDATE`、`SET NOT NULL` 或 Reader 放行；
- Membership／Binding、Guard、Action Policy、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C；
- 正式 Onboarding Runtime、平台切片或机构端旧任务。

## 四、停止与前向修复

出现以下任一情况必须保持零写入并停止：

- Manifest、权限、审批状态或完整性不合法；
- tenant 父记录缺失，三元组部分存在，或任一持久化字段冲突；
- 额外／重复 Scope、Version 或 Head 行；
- 数量不守恒；
- Required Check、执行 Lease、Authority、Repository 或事务能力不可用；
- 环境与冻结 Base、Journal、Shape 或恢复点不一致；
- 需要扩大当次授权文件、环境或任务范围。

提交后的数据库事实不能依赖 Git revert。失败后必须停止重复执行，保留低敏分类与授权记录，并由独立批准的 forward-fix 或已验证恢复任务处理。

## 五、项目级顺序

```text
Stage D 本地只读 dry-run（已完成，PR #825）
→ Stage D 独立审查（已完成，PR #826）
→ Stage D handoff（本次收口）
→ A2-P1 manifest 驱动 provisioning（唯一下一任务，尚未启动、尚未获得执行授权）
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不改变 MIG-01～MIG-06 的相对顺序。Stage D、handoff 或质量门禁通过均不自动授权 A2-P1。
