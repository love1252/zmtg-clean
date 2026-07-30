# 智美天工唯一下一任务

## 当前交接状态

A2-P1 受控执行计划与 Runtime Write Adapter 已完成独立合并：

- 受控执行计划 PR #828 Head：`77be8e4ac835ce76e77a6bf5c7026c63d83b58fc`；
- PR #828 Merge Commit：`184b0320be1bedaace5d72ff0b0e453f343ad52e`；
- PR #828 Required Check：Run `30565599037`／Job `90949208935` 成功；
- Runtime PR #829 Head：`aa465a64aa146a43f766413caa53dfc88a1bd39b`；
- PR #829 Merge Commit：`bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`；
- PR #829 Required Check：Run `30568943508`／Job `90960419070` 成功；
- Write Adapter、Write 合成事务测试、ReadOnly／Write parity 测试与 Runbook 已进入 `main`；
- 定向 Write／Parity／ReadOnly／Kernel 为 4 个文件、109 个测试通过；
- 完整 Provisioning 契约为 14 个文件、510 个测试通过；
- 完整质量基线为 422 个测试文件、6190 个测试通过，build 101／101；
- 本阶段未连接数据库、未读取真实 Manifest、未签发或消费真实 Lease、未运行 Runner dry-run／`--execute`，数据库写入为 0；
- Write Adapter 进入 `main` 不表示 A2-P1 已执行或完成。

## 唯一下一阶段

```text
Authority／组合根无写准备
```

该名称逐字沿用 `docs/operations/mig01-a2-provisioning-runbook.md`。仓库尚未冻结正式任务编号，本 handoff 不自行创建编号。阶段内的验证动作名称沿用受控执行计划：`Authority／组合根无写验证`。

本 handoff 中该阶段尚未启动。当前总任务 `V2-MIG01-A2-P1-MANIFEST-PROVISIONING-END-TO-END-01` 已明确授权在本 handoff 合并后串行执行；此处只冻结边界，不能被解释为数据库执行、真实 Lease、权限授予或 `--execute` 已获准开始。

## 一、权威边界与目标

下一阶段只允许关闭 Authority 与仓库外一次性组合根的准备阻断：

1. 冻结真实 Authority 的信任根、实现方式、签发者、撤销者、释放者与审计责任；
2. 证明 Authority 对 task、Base、目标环境、Manifest、Operator、时间窗、撤销、释放和未知授权全部 fail-closed；
3. 证明无条件返回 `true` 只存在于合成测试，不进入真实组合；
4. 冻结仓库外、权限受控、一次性组合根的完整性、Owner、权限、保留和删除规则；
5. 使用合成资产完成正常与负向无写验证；
6. 形成独立低敏证据 PR，并在其合并后完成独立 Authority／组合根 handoff。

Authority／组合根准备不是 accepted ADR，也不得改写现有 Contract、Kernel、Port、Runner、ReadOnly Adapter、Write Adapter、Schema 或 Migration。

## 二、一次性组合根严格职责

仓库外一次性组合根只能：

- 调用既有 `runProvisioningCli`，不得成为第二 Runner；
- 在未来真实执行中负责创建并关闭数据库 client；本阶段只使用不可连接数据库的合成 client 验证生命周期；
- 注入当前 Context Policy、已合并 Write Adapter、Lease payload 与 Authority；
- 编排低敏生命周期和 `finally` 清理；
- 使用 `0600` 私有资产和不回显 Helper；
- 在任务结束后删除临时 Helper、输入目录和临时副本。

它不得：

- 直接执行 SQL；
- 解析、规范化、改写或复制 Manifest；
- 复制 Kernel、Repository 映射、Lease Contract 或业务分类；
- 绕过 Runner、Authority 或 Write Adapter；
- 读取环境变量值后回显；
- 持久化 Manifest、Lease、连接、角色或双键敏感值；
- 保留窗口外可复用的写入口、权限或 client。

本阶段的仓库交付只允许创建单一低敏证据文档 `docs/operations/mig01-a2-p1-authority-composition-root-no-write-validation-20260731.md`。如 Authority 或组合根实现需要进入 Git，或需要修改该证据文档以外的 Runtime、脚本、测试、配置、package、lock、Schema、Migration、Runbook 或 handoff，必须停止并取得新的精确 allowlist。

## 三、无写验证矩阵

只使用合成、低敏、不可用于真实执行的资产，至少验证：

- 正确 task／Base／环境／Manifest／Operator／时间窗且未撤销、未释放时，Authority 仅通过授权判断；
- task、Base、环境、Manifest、Operator 任一不匹配时拒绝；
- 未生效、过期、撤销、释放或未知授权时拒绝；
- 正常路径和所有可捕获失败路径均关闭 client；
- 正常路径和失败路径均触发撤权与 Lease release 生命周期；
- 不可捕获终止依赖的短 TTL、外部撤销／回收和重试前失效核验已冻结；
- 组合根不直接执行 SQL，不复制 Runner／Kernel／Manifest 解析；
- 日志与交付只含固定低敏结果，不泄漏原始输入或环境信息。

这些合成验证不得连接数据库，不得读取真实 Approved Manifest，不得签发、读取、消费或释放真实 Lease，也不得授予或撤销真实数据库权限。

## 四、硬停止条件

以下任一情况必须停止：

- Authority 信任根、唯一责任人或撤销／释放语义无法证明；
- 需要无条件 `true`、测试 fake 或固定成功结果才能继续；
- 组合根需要直接 SQL、复制 Kernel／Manifest 解析或形成第二 Runner；
- 需要连接数据库、读取真实 Manifest、签发真实 Lease、授予真实权限或使用 `--execute`；
- 需要修改当前未授权的仓库文件；
- client 关闭、撤权、Lease release 或临时资产删除无法在合成路径证明；
- 日志、Helper 或证据可能暴露私有路径、双键、digest、角色引用、连接参数、凭证、PII 或原始错误；
- Base、Required Check、Runtime 资产或当前 handoff 发生漂移。

停止时只允许报告固定低敏阻断类别和工作树状态，不得通过扩大权限或连接环境补证。

## 五、完成与后续顺序

```text
受控执行计划（已完成，PR #828）
→ Write Adapter Runtime（已完成，PR #829）
→ Runtime handoff（本次收口）
→ Authority／组合根无写准备
→ Authority／组合根无写验证
→ Authority／组合根低敏证据 PR
→ 独立 Authority／组合根 handoff
→ 一次受控 local_acceptance execute
→ 低敏执行证据
→ 独立审查
→ A2-P1 最终 handoff
→ A2-P2
```

Authority／组合根 handoff 合并前，禁止启动真实数据库执行。下一阶段完成也不自动接受任何非 localhost 目标，不自动签发 Lease，不自动运行第二次 `--execute`，不自动启动 A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。
