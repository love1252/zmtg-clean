# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 Approved Manifest 的独立创建、低敏校验、用户最终复核和报告合并已经完成：

- PR #823 Base：`5c3e65f3757de8ee0322ea7c262e55e2b5548f96`；
- PR #823 Head：`78eff467a158baf4d70995cb59bd774c35327785`；
- PR #823 Merge Commit：`3f042172734c0dc9cc583a09f347e38df7db1e02`；
- Required Check：Run `30548606044`／Job `90891106206` 成功，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 均实际执行；
- 低敏报告：`docs/operations/mig01-a2-approved-manifest-validation-20260730.md`；
- Approved Manifest 数量为 1，version 为 `mig01-a2/v1`，`approvalStatus=approved`，`c14n-v1`、exact shape 和独立 digest 校验均通过；
- Candidate 与 Approved Manifest 继续作为独立资产保留，Candidate digest 未被复用；
- Future Operator 尚未分配，后续必须与 Approver 保持职责分离；
- `real_manifest_missing`、`approved_manifest_validation_missing` 与 `approved_manifest_independent_review_pending` 已关闭；
- `real_environment_dry_run_unavailable` 继续阻断；
- Runner、dry-run、`--execute`、Lease、数据库写入、Stage D、A2-P1 与 A2-P2 均未启动。

## 唯一下一任务

```text
V2-MIG01-A2-STAGE-D-LOCAL-DRY-RUN-VALIDATION-01
基于已审核 Approved Manifest 的本地只读 dry-run 验证
```

该任务尚未启动。当前 handoff 只冻结 Stage D 的目标、重检项和安全边界，不授权运行 Runner、读取仓库外资产、连接数据库或执行任何后续步骤。

## 一、启动前必须重新冻结

未来任务获得独立用户授权后，必须在执行任何 Runner 命令前重新确认：

1. 最新 `main` 与 `origin/main`，以及本 handoff 的最终 Merge Commit；
2. Approved Manifest 仍存在、未失效、未撤销，权限和文件身份未漂移；
3. Approved Manifest 的 Contract、exact shape、`c14n-v1` 与 digest 仍有效；
4. Candidate 仍存在、未过期且有效，Candidate／Approved 文件与 digest 继续分离；
5. Candidate 的 Source、Context Policy 与人工审核依据均未漂移；
6. Context Policy 仍为当前本地验收政策；
7. 只读 Adapter 仍保持 localhost-only、`REPEATABLE READ + READ ONLY` 和永久拒绝写方法；
8. 本地验收数据库 Shape 与 A1 预期一致；
9. Journal 仍保持 39 项且最新项内部匹配仓库 0038；
10. 两个既有 Recovery Point 仍存在且验证状态未漂移；
11. 执行 Lease／Migration Lease 仍未签发、未读取、未验证、未消费；
12. Future Operator 已由独立任务分配，私有引用与 Approver 不同，Approved Manifest 的临时只读权限授予／撤销时窗已冻结；
13. 本次 Stage D 的环境、命令、输出范围、报告范围和停止条件已经获得明确授权。

任一项无法确认时必须停止。不得用默认值、历史日志、旧摘要或推断代替当前证据。

## 二、Stage D 唯一允许范围

获得独立授权后，Stage D 只允许：

- 连接固定的 localhost-only 本地验收数据库；
- 使用已审核且重新校验通过的 Approved Manifest；
- 组合现有 Context Policy、只读 Adapter 与 Runner 的 `--dry-run` 路径；
- 数据库事务保持 `READ ONLY`，不提交业务事务；
- 只输出 `input`、`insertedCandidate`、`reusedCandidate`、`conflict`、`unexpected` 五项低敏守恒计数；
- 核对 dry-run 前后 Journal、关键表计数与数据库 Shape 无变化；
- 只记录不含双键、digest、审批引用、私有路径、连接信息或业务正文的低敏证据；
- 在任务允许的精确文件范围内提交独立验证结果，并等待 Required Check。

Stage D 的成功只表示本地只读 dry-run 证据成立，不表示 A2-P1、A2-P2、Provisioning 写入或正式发布获准。

## 三、严格禁止

未来任务不得：

- 使用 `--execute`；
- 签发、读取、验证或消费执行 Lease／Migration Lease；
- 运行 Migration、Seed、Reset、Restore、DDL、DML 或 Provisioning 写入；
- 修改 Approved Manifest、Candidate、Source、Review State、Context Policy、Runner、Adapter、Schema 或 Migration；
- 连接非 localhost 数据库、测试服务器、生产环境或业务外部系统；
- 读取 `.env.local`、未授权 `DATABASE_URL`、Secret、Token、PII 或真实业务数据；
- 输出 Manifest／Candidate 正文、tenant／institution 双引用、任何 digest、审批引用、私有路径或连接信息；
- 将五项计数以外的业务数据写入日志、PR、Issue、报告或聊天；
- 启动 A2-P1、A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务；
- 自动进入正式审查（Ready）或自动合并。

## 四、停止条件

出现以下任一情况必须立即停止：

- Approved Manifest 或 Candidate 缺失、过期、撤销、权限漂移或校验失败；
- Candidate／Approved 文件或 digest 隔离失效；
- Context Policy、Adapter、数据库 Shape、Journal 或 Recovery Point 与冻结事实不一致；
- 发现已签发或已消费的 Lease，或需要 Lease 才能继续；
- 只读事务、localhost-only 或五项计数边界无法证明；
- Runner 尝试写入、生成非低敏输出或需要 `--execute`；
- 需要修改本任务未授权的仓库文件；
- 需要读取凭证、私有值或连接未授权环境；
- 出现并发写入、Git 基线漂移或 Required Check 阻断。

停止后只报告低敏错误类别、首个有效阻断与工作树状态，不自动修复或扩大范围。

## 五、项目级顺序

```text
Source／Candidate v2 Governance（已完成，PR #818）
→ Source v2 handoff（已完成，PR #819）
→ Stage C Candidate 生成、重新签发与人工审核（已完成，PR #820）
→ Approved Manifest 创建与校验（已完成，PR #823）
→ Approved Manifest handoff（本次收口）
→ V2-MIG01-A2-STAGE-D-LOCAL-DRY-RUN-VALIDATION-01（唯一下一任务，尚未启动）
→ 独立 handoff
→ A2-P1
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不改变 MIG-01～MIG-06 的相对顺序。Approved Manifest 的存在、`approvalStatus=approved`、静态校验或本 handoff 合并均不自动启动 Stage D；Stage D 必须获得下一次任务的明确授权。
