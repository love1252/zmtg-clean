# 智美天工唯一下一任务

## 当前交接状态

Authority／组合根无写准备、验证与低敏证据已经完成独立合并：

- Runtime handoff PR #830 Head：`1d28b6a91bf3b7076f66478861a3a7cc46fdcb18`；
- PR #830 Merge Commit：`2ca100af132adf6676c09073f5d527c1b608d3ed`；
- PR #830 Required Check：Run `30570185023`／Job `90964638309` 成功；
- Authority／组合根低敏证据 PR #831 Head：`e427b57cdf810c9021d6beb1738a69f365bd7218`；
- PR #831 Merge Commit：`2da175330a4e15601c9806f75184df303e8cf2f9`；
- PR #831 Required Check：Run `30571861343`／Job `90970298323` 成功；
- Authority 合成矩阵为 1 个完整匹配允许、22 个负向用例拒绝；生命周期 12 个场景和静态边界 6 项均通过；
- 合成 Runner `--dry-run` 五项计数为 `1／1／0／0／0`；
- 数据库连接／写入、真实 Manifest 读取、真实 Authority／Lease 操作、真实权限变更和 `--execute` 均为 0；
- 临时 Helper、合成输入和私有临时目录已删除；
- Authority／组合根无写准备完成不表示 A2-P1 已执行或完成。

## 唯一下一阶段

```text
一次受控 local_acceptance execute
```

该名称沿用上一 handoff 与架构索引已经冻结的项目级名称。仓库尚未冻结正式任务编号，本 handoff 不自行创建编号。

本 handoff 中该阶段尚未启动。当前总任务 `V2-MIG01-A2-P1-MANIFEST-PROVISIONING-END-TO-END-01` 已明确授权在本 handoff 合并后串行执行，但只有下列实时硬门全部满足时才允许进入唯一执行窗口。

## 一、执行前冻结

必须按顺序重新证明：

1. 最新 `main`、执行分支、Base／Head、工作树、Required Check 和受保护分支状态均无漂移；
2. 目标精确为固定 localhost-only `local_acceptance`，任何非本地目标立即停止；
3. Approved Manifest 数量为 1，version、审批状态、canonicalization、exact shape、digest 和条目数量有效，且未撤销、未替换；
4. Candidate 与 Approved Manifest 的文件、目录、协议和 digest 继续隔离；
5. Context Policy 仍只允许 `local_acceptance`、`Asia/Shanghai` 和 `CNY`；
6. 独立固定 SELECT-only 探针确认 Journal 为 39、最新项内部匹配仓库 0038、A1 Shape 与仓库一致、`tenants` 为 2、三张目标表均为 0；
7. 三张目标表不存在未审计的 trigger、rule、RLS 副作用，也不存在无法确认的并发 Writer；
8. 最新执行前恢复点已创建，archive、hash、metadata 均有效，并已在隔离临时数据库完成恢复验证；不得 Restore 目标库；
9. 使用既有 ReadOnly Adapter 完成一次实时预分类 dry-run，五项计数精确为 `1／1／0／0／0`。

任一事实不满足时不得调整 Manifest、数据或权限追求绿灯。

## 二、Authority、Lease 与职责分离

- 新 Operator 必须与 Approver、Reviewer、Lease Authority 和审计责任人分离；
- Operator 与一次性组合根不得取得 Authority 私钥，只能使用冻结的验证公钥；
- 活动 Authority 记录必须由独立信任锚验证，并精确绑定当前 task、branch、Base、0038、Operator、`local_acceptance`、Manifest、条目数量与时间窗；
- 未知、签名错误、未生效、过期、撤销、释放、字段漂移或 Authority 不可用必须 fail-closed；
- Execution Lease 使用既有 `mig01-a2-execution-lease/v1`，最长 10 分钟，不得续期或在执行中更换；
- Lease 必须由独立 Lease Authority 签发，精确绑定当前 task、Base、环境、Operator、Manifest 与条目数量；
- 写入前 Lease 必须已 claim，且 Authority 必须使用受信主机时间再次核验；
- 执行结束必须 release，并证明 release 后原 payload 也无法重放。

职责分离、信任锚、活动记录、Lease 当前状态或最短剩余时间任一无法证明时立即停止。

## 三、精确最小权限

执行角色只允许：

- 数据库连接和 `public` schema 使用；
- 对 `tenants` 与三张 A1 表的精确 `SELECT`；
- 对三张 A1 表的精确 `INSERT`；

禁止授予通用 query、全库表权限、CREATE、UPDATE、UPSERT、DELETE、TRUNCATE、REFERENCES、TRIGGER、sequence 或长期继承权限。

不得以笼统“系统能力”作为额外权限兜底。运行时依赖的 advisory lock、hash、时间和约束函数必须在静态与实时核验中证明不需要额外 grant；若发现额外权限依赖，必须停止，不得现场扩大授权。

独立权限 Controller 激活后必须先完成允许项正向探针和禁止项负向探针；任一权限超出或依赖不明时先撤权并停止。结束时撤销全部临时授权，再以负向探针确认 SELECT／INSERT 不再可用。

## 四、唯一 Runner 调用

一次性组合根必须满足：

- 只调用既有 `runProvisioningCli`；
- 注入当前 Context Policy、已合并 Write Adapter、真实 Lease payload／expectation 与真实 Authority；
- 不含 SQL、Kernel、Manifest parser、Repository 映射、第二 Runner 或环境变量回显；
- Manifest 私有路径只允许由受控 Helper 传给既有 Runner 的 `--manifest-file`，不得进入日志、交付、shell history 或低敏证据；
- client 创建一次并在所有可捕获路径关闭；
- `--execute` 调用计数精确为 1，重试为 0。

事务继续固定为：

```text
SERIALIZABLE READ WRITE
→ 双键事务级 advisory lock
→ 重读 tenant 与完整 triplet
→ Scope INSERT
→ Context Version 1 INSERT
→ Context Head 1 INSERT
→ affected rows 各为 1
→ 提交前全批重读为严格一致 reusedCandidate
→ commit
```

任何 serialization、deadlock、timeout、constraint、affected rows 非 1、提交前漂移或连接在提交确认阶段中断都必须停止。禁止自动重试或第二次 `--execute`；outcome-unknown 只能先独立只读核验，不能再次执行。

## 五、执行后核验与清理

独立固定只读探针必须确认：

- 三张 A1 表分别由 0 变 1，净变化各为 `+1`；
- `tenants` 仍为 2；
- Journal 仍为 39，最新项仍内部匹配 0038；
- Schema Shape 不变；
- `conflict=0`、`unexpected=0`；
- 无其他表写入。

随后创建执行后恢复点并完成隔离恢复验证，不得 Restore 目标库。

所有可捕获路径必须分别尝试：

1. client close；
2. 权限 revoke；
3. 撤权负向探针；
4. Lease release；
5. release 后 Authority 拒绝复核；
6. Manifest 临时副本、Helper 与临时目录删除。

某一项清理失败不得跳过其余清理，整体结果固定为 `composition_cleanup_incomplete` 并停止。

## 六、真正硬停止

出现以下任一情况立即停止并只报告低敏固定类别：

- 发现 Secret、Token、密码、私钥、PII 或非本地连接暴露；
- 目标不是固定 localhost-only `local_acceptance`；
- Approved Manifest、Candidate 隔离、Journal、Shape、tenant、恢复点或 Context Policy 异常；
- Authority、Lease、职责分离或最小权限无法证明；
- 执行前五项计数不是精确 `1／1／0／0／0`；
- `conflict` 或 `unexpected` 非零；
- 需要修改 Contract、Kernel、Port、Runner、ReadOnly Adapter、Write Adapter、Schema 或 Migration；
- 需要目标库 DDL、UPDATE、UPSERT、DELETE、Drop、Restore 或第二次 `--execute`；
- 存在无法确认的并发写入；
- COMMIT 结果未知、Git 状态无法安全恢复，或回退／forward-fix 路径无法证明。

## 七、低敏交付与后续顺序

执行证据只允许记录状态、布尔值、固定版本、计数、Run／Job 和零越界结论。不得记录实际私有路径、连接参数、双键、digest 值、角色引用、Manifest 正文、SQL、原始行、签名、私钥、Secret、Token、凭证、PII 或原始异常。

```text
受控执行计划（已完成，PR #828）
→ Write Adapter Runtime（已完成，PR #829）
→ Runtime handoff（已完成，PR #830）
→ Authority／组合根无写准备与验证（已完成）
→ Authority／组合根低敏证据 PR（已完成，PR #831）
→ 独立 Authority／组合根 handoff（本次收口）
→ 一次受控 local_acceptance execute（唯一下一阶段）
→ 低敏执行证据
→ 独立审查
→ A2-P1 最终 handoff
→ A2-P2
```

唯一执行窗口完成后必须先创建独立低敏执行证据 PR 与独立审查 PR。不得自动把 A2-P1 标记为完成，不得自动启动 A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。
