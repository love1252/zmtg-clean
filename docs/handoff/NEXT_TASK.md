# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 A2-P1 已完成一次受控执行、低敏证据与独立审查：

- 执行低敏证据 PR #840：Head `9a6fb23f1e6a34346cc91e56eacbd6c8c14c6295`，Merge Commit `6c0839a4dc38f51f11449f03548142fa5653a80c`，Run `30628614371`／Job `91149548637` 成功；
- 独立审查 PR #841：Head `c93b9a0235f799c913bf41dae849a02a0d805867`，Merge Commit `3d18054b10eab741b4f0fd6a0d70249a6d36ca97`，Run `30629405987`／Job `91152028768` 成功；
- dry-run 与 execute 五项计数均为 `1／1／0／0／0`，execute attempt 为 `1`、retry 为 `0`；
- 提交后严格复用分类为 `1／0／1／0／0`；
- Institution Scope、Context Version 1、Context Head 1 各净新增 `1`；
- tenant 父表、Journal、Schema Shape 和其他公开业务表计数未发生额外变化；
- `A2P1-F01=closed`，`a2_p1_independent_review=passed`；
- Execution Lease 已释放，client 已关闭，临时角色已 NOLOGIN、撤权并删除；
- 活动连接、direct ACL、membership、ownership、sequence 权限、凭证和临时资产残留均为 `0`；
- 原 Candidate 与原 Approved Manifest 持续保留且未修改；
- Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package 和 lock 修改均为 `0`。

A2-P1 已完成。该结果不自动授权 A2-P2，不表示 MIG-01A2 或 MIG-01 已关闭，也不放行
BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader。

## 唯一下一任务

```text
A2-P2 复合键／索引／NOT VALID 关系
```

该名称来自 `docs/architecture/v2-mig01-a2-provisioning-preflight.md` 的既有 A2-P1／A2-P2
严格拆分与候选实施切片。仓库当前没有 `V2-MIG01-A2-P2-*` 正式任务编号，本 handoff 不自行
创造编号。

当前状态为：未启动、未授权。

本文件只冻结唯一下一任务、D12-A 已接受方向、未接受细节、启动硬门和停止边界，不构成
Schema、Migration、环境、Migration Lease、DDL、数据库连接、Ready 或 Merge 授权。

## 一、D12-A 已接受方向

当前 accepted 决策只接受最小 Anchor Bridge 方向：

- 复用 `institution_scopes` 当前复合主键方向，不新建第二套 Scope 事实源；
- 为 `auth_account_institution_bindings` 的 tenant／institution 双键关系建立普通索引候选；
- 建立指向 `institution_scopes` tenant／institution 关系的 `NOT VALID` FK 候选；
- 只创建获批关系，不提前验证历史行；
- 不把更广业务关系、Audit attribution／shape 或 MIG-01C 职责并入 A2-P2。

以上只是方向，不是 exact allowlist 或实施授权。

## 二、仍未接受和必须重新冻结的细节

以下事项仍为阻断，不得从 proposed decision pack、历史设计或文件名推断为已接受：

1. 精确对象名称；
2. 精确列序；
3. 当前 Catalog Shape 与依赖关系；
4. 精确普通索引定义及 predicate；
5. 精确 `NOT VALID` FK 定义、引用目标和 validation 状态；
6. 是否存在同名异定义、部分对象或可安全复用对象；
7. Migration 编号；
8. Migration Lease 的任务、Holder、分支、Base、Journal、环境、开始、失效、释放和交接；
9. journal／snapshot metadata 处理方式；
10. DDL 锁窗口、`lock_timeout`、`statement_timeout` 和事务边界；
11. 目标环境、恢复点和前向修复窗口；
12. 最终文件 allowlist、测试 allowlist 和独立用户授权。

`0039` 不是已批准编号。A2-P2 必须在未来任务中取得新的 Migration Lease 和届时重新分配的
编号。

## 三、启动前硬门

未来任务只有在用户对任务、Schema、Migration、环境、锁窗口、风险和 Migration Lease 作出
新的明确授权后，才可开始。开始前必须逐项实时证明：

1. 最新 `main`、`origin/main`、分支、Base／Head、工作树、受保护分支和 Required Check 无漂移；
2. PR #840、PR #841 和本最终 handoff 已合并，A2-P1 低敏计数、独立审查和清理证据完整；
3. A2-P1 三张目标表仍保持获批终态，`conflict=0`、`unexpected=0`，不存在未解释的额外行或部分 triplet；
4. tenant 父表、Journal、Schema Shape、enum、约束和索引无漂移；
5. 对候选对象完成只读 Catalog inventory，能够区分全缺、全一致、部分存在和同名异定义；
6. 当前数据 shape 能支持获批 `NOT VALID` 关系，且不会把 P1 之外的关系静默纳入；
7. 首个 journal-backed A2 切片前所需的 metadata current 口径处理已经明确；继续禁止 `db:generate` 和 snapshot-diff Migration；
8. 新 Migration 编号和 Migration Lease 唯一，作用域、环境、持有者、失效、释放和交接可证明；
9. DDL 事务、锁、timeout、失败回滚和共享环境 forward-fix 路径已冻结；
10. 当前恢复点、环境并发、Migration 执行者和部署基线均已获授权核验；
11. 精确文件列表、约束 allowlist、测试和停止条件获得用户批准。

任一项不能证明时，未来任务保持零 Schema、零 Migration、零 DDL 并停止。

## 四、未来获授权后的候选文件边界

以下只是既有专项预检中的候选文件类型，不是当前授权：

- `drizzle/<届时获批编号>_*.sql`；
- `src/server/db/schema.ts`；
- `drizzle/meta/_journal.json`；
- 经独立 metadata 决策明确允许的必要 metadata；
- 精确相关的 Schema／Migration／升级回退测试；
- 必要的低敏执行和独立 handoff 文档。

未来任务必须重新列出精确路径。不得把候选类型解释为通配写权限，也不得顺带修改 API、UI、
Runner、Kernel、Adapter、package、lock、CI、BASE-02、Writer、Audit、MIG-01B／C 或 Reader。

## 五、A2-P2 实施边界

获得独立授权后，A2-P2 只能：

- 创建 exact allowlist 中的普通索引和 `NOT VALID` 关系；
- 对全缺且数据 shape、锁窗口满足的对象执行获批创建；
- 对全量定义一致的既有对象执行只读复用；
- 在事务和 Catalog 证据中记录 `planned／created／reused／conflict／unexpected`；
- 保持 `conflict=0`、`unexpected=0`；
- 保持约束为未验证状态；
- 在失败时证明事务回滚或按获批前向修复路径停止。

A2-P2 不得：

- 回填任何数据；
- 执行 `VALIDATE CONSTRAINT`；
- 执行 `SET NOT NULL`；
- 删除或替换 tenant-only 历史约束；
- 预铺未列入 exact allowlist 的业务关系；
- 收紧 Audit attribution／shape；
- 修改模板正式版本；
- 放行 Reader；
- 启动 BASE-02、Writer、MIG-01B、MIG-01C 或其他后续任务；
- 使用 `db:generate`、snapshot-diff Migration、管理员绕过、直接 push、force push、Squash 或 Rebase Merge。

## 六、必要验证

未来获授权任务至少必须验证：

1. Schema、SQL、journal 和获批 metadata 一致；
2. 对象类型、名称、列序、引用目标、predicate 和 validation 状态精确匹配；
3. 全缺、全一致、部分存在和同名异定义四类 Catalog 场景；
4. `NOT VALID` 关系保持未验证；
5. 没有数据回填、数据重写、`VALIDATE` 或 `NOT NULL`；
6. DDL 事务失败时净对象变化为 `0`；
7. `planned = created + reused`，且 `conflict=unexpected=0`；
8. 锁与 timeout 行为符合获批窗口；
9. `git diff --check`、架构检查器自测、增量架构检查、lint、typecheck、完整测试和 build 全部实际成功；
10. 新 Head 对应真实 Required Check，build 不得跳过；
11. 独立审查与后续 handoff 完成前，不得把 A2-P2 标记完成。

## 七、停止与前向修复

出现以下任一情况立即停止：

- A2-P1 handoff 或计数证据不完整；
- 最新 Base、Journal、Catalog、数据 shape、恢复点、编号或 Migration Lease 漂移；
- exact allowlist、对象名称、列序、引用目标、predicate 或 validation 状态不唯一；
- 出现部分对象、同名异定义、未知依赖或未解释的历史关系；
- 要求提前回填、`VALIDATE`、`SET NOT NULL`、Reader 放行或扩大到更广业务关系；
- 需要修改未授权文件、运行 `db:generate` 或建立第二套事实源；
- 需要绕过 Required Check、分支保护或管理员限制；
- 无法证明事务回滚、锁窗口、timeout 或共享环境前向修复；
- 需要读取未授权凭证、连接参数、数据库或业务外部环境。

未共享的事务失败必须整体回滚。已在共享环境执行后不得修改旧 SQL／journal、破坏性删除已消费
关系或伪造成功；必须取得新编号、新 Migration Lease 和新授权，以独立 forward-fix 修复。

## 八、低敏与交付边界

未来文档和 PR 只允许记录必要状态、布尔值、对象类型、获批名称、固定版本、计数、Run／Job 和
零越界结论。不得记录凭证、连接参数、私有路径、Manifest 正文、双引用、digest、角色引用、
原始 SQL 结果、Secret、Token、私钥或 PII。

A2-P2 必须使用独立分支、独立单主题 PR 和 Merge Commit。进入 Ready、Merge、环境连接、
Schema／Migration 变更、Migration Lease 和 DDL 均需要用户对未来任务的明确授权；本 handoff
不授予这些权限。

## 九、后续顺序

```text
A2-P1 最终 handoff（已完成）
→ A2-P2 复合键／索引／NOT VALID 关系（唯一下一任务，未启动、未授权）
→ A2-P2 独立审查与 handoff
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

未来任务不得自动启动 A2-P2 或任何后续任务。
