# 智美天工唯一下一任务

## 当前交接状态

数据库级 `PUBLIC TEMPORARY` 权限调整已经完成低敏证据和独立审查，并依次合并：

- 权限决策 PR #833：Head `ab5762bf0ce2442ed021b638164fb258874e0d48`，Merge Commit `8afcc301bae4e4ad7eac03917b906b0ca9d18c0c`，Run `30598201520`／Job `91055097125` 成功；
- ACL 低敏证据 PR #834：Head `eb6e76b23afd03a4447e082b1e735c59ca3d4990`，Merge Commit `2cf55056ad1182297fb9cc1d2c5c22d4e2ee20c0`，Run `30599333356`／Job `91058440874` 成功；
- 独立审查 PR #835：Head `00d460f05e8f639738a28b78d4f35d1f38d5cc94`，Merge Commit `66953dfc5086a5d5209b34f709886b0a245f7192`，Run `30599838548`／Job `91059915905` 成功；
- `PUBLIC TEMPORARY` 已由 `true` 变为 `false`，`PUBLIC CONNECT` 保持 `true`，TEMPORARY allowlist 为 `0`；
- 撤销执行 `1` 次，条件化回退未命中，回退执行 `0` 次；
- 其他数据库 ACL、Schema／表／序列／Default Privileges、角色目录与成员关系、Journal、A1 Shape 和固定四表低敏计数均未变化；
- 固定四表低敏计数前后均为 `2／0／0／0`；
- 未创建、修改或删除数据库角色，未授予表级 SELECT／INSERT，未签发或消费 Lease，未运行 Runner、dry-run 或 `--execute`；
- Migration、Seed 和业务 DDL／DML 为 `0`；
- 独立审查已通过，但专用角色预置与 A2-P1 准入仍为 `false`。

## 唯一下一任务

```text
V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01
专用角色预置与 A2-P1 恢复执行
```

该任务名称来自现有 accepted decisions、A2-P1 专项预检、执行计划和 Runbook 的既定边界。本 handoff 只冻结唯一下一任务，不构成专用角色创建、权限授予、Lease 或 A2-P1 执行授权；下一任务尚未启动。

## 一、启动前冻结

未来任务必须先获得用户对任务、数据库权限操作、角色生命周期、Lease 和一次受控执行的明确授权，并按顺序重新证明：

1. 最新 `main`、执行分支、Base／Head、工作树、Required Check 和受保护分支状态均无漂移；
2. 目标仍精确为固定 localhost-only 本地验收数据库，任何非本地目标立即停止；
3. `PUBLIC TEMPORARY=false`、`PUBLIC CONNECT=true`，其他数据库 ACL、Schema／表／序列／Default Privileges 与已合并证据一致；
4. 非超级用户登录角色、活动非管理员连接、临时 Schema、临时对象和 TEMPORARY allowlist 仍为 `0`；
5. Approved Manifest、Candidate 隔离、Context Policy、Journal、A1 Shape、固定四表低敏计数和最新已验证恢复点均有效；
6. 独立 Authority、Execution Lease、Operator 职责分离和受信时间边界可以实时证明；
7. 既有 Runner、ReadOnly Adapter 与 Write Adapter 契约均未漂移，A2-P1 仍只有一个写入口。

本次 ACL 调整后的状态不得作为永久事实继承。任一实时事实不满足时，未来任务必须保持零角色变更、零权限授予、零 Lease 和零 A2-P1 执行并停止。

## 二、专用角色与权限边界

只有未来任务取得精确授权且启动硬门全部满足后，才允许：

- 创建单个短生命周期专用执行角色；
- 只授予数据库连接、目标 Schema 使用、精确表级 SELECT／INSERT 及现有契约证明必需的最小权限；
- 执行正向允许探针和负向拒绝探针；
- 在所有可捕获路径撤销临时权限并删除专用角色；
- 用独立只读探针确认撤权、删除和权限回归。

不得授予数据库 TEMPORARY、Schema CREATE、全库表权限、UPDATE、UPSERT、DELETE、TRUNCATE、REFERENCES、TRIGGER、sequence、长期继承或未审计权限。若现有 Runtime 需要额外权限，必须停止并形成独立决策，不得现场扩大 allowlist。

## 三、A2-P1 恢复执行边界

专用角色完成最小权限验证不等于 A2-P1 自动获准。恢复执行前仍须重新确认：

- 有效 Approved Manifest、独立 Authority、最长 10 分钟且不可续期的 Execution Lease、新 Operator 和最新恢复点；
- 执行前预分类五项计数精确为 `1／1／0／0／0`；
- 不存在并发 Writer、未审计 trigger／rule／RLS 副作用或对象漂移；
- 既有 Runner 只调用一次 `--execute`，重试为 `0`；
- outcome-unknown、撤权、Lease release、角色删除和前向修复路径均可证明。

只有以上事实全部通过且用户对未来任务作出明确执行授权，才可恢复一次 A2-P1。任何失败均不得通过调整 Manifest、放宽权限、重复执行或旁路写入追求绿灯。

## 四、低敏证据与停止条件

后续证据只允许记录状态、布尔值、固定版本、计数、Run／Job 和零越界结论；不得记录私有路径、连接参数、双键、digest、角色引用、Manifest 正文、SQL、原始行、签名、私钥、Secret、Token、凭证、PII 或原始异常。

出现以下任一情况立即停止：

- 目标、Manifest、Context Policy、Journal、Shape、计数、恢复点或权限状态漂移；
- 需要修改 Contract、Kernel、Port、Runner、Adapter、Schema 或 Migration；
- 权限超出 allowlist，或角色撤权／删除、Lease release、client close 无法证明；
- 需要第二次 `--execute`、自动重试、目标库 Restore 或未授权 DDL／DML；
- 存在并发写入、未知 COMMIT 结果或无法证明的前向修复路径；
- 暴露 Secret、Token、密码、私钥、PII、私有路径、连接参数、双键、digest、角色引用或 Manifest 正文。

## 五、后续顺序

```text
PUBLIC TEMPORARY 权限决策（已完成，PR #833）
→ ACL 调整低敏证据（已完成，PR #834）
→ ACL 独立审查（已完成，PR #835）
→ ACL handoff（本次收口）
→ 专用角色预置与 A2-P1 恢复执行（唯一下一任务，未启动、未授权）
→ A2-P1 低敏执行证据
→ A2-P1 独立审查
→ A2-P1 最终 handoff
→ A2-P2
```

未来任务不得自动启动 A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。
