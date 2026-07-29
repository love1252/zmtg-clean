# MIG-01A2 Provisioning 已接受决策

> 任务编号：`V2-MIG01-A2-ACCEPTED-DECISIONS-HANDOFF-01`
>
> 状态：`accepted_for_mig01_a2_governance`
>
> 接受日期：2026-07-29
>
> 记录基线：`1438894dd07a68cf767b49207795388b0bc814a6`
>
> 决策材料：[`mig01-a2-provisioning-decision-pack.md`](./mig01-a2-provisioning-decision-pack.md)

## 1. 文档定位与权威边界

用户于 2026-07-29 在当前任务中明确接受本文记录的 D01～D12 组合。本文件负责把用户选择从 `proposed decision pack` 中分离出来，形成 MIG-01A2 治理阶段可引用的 `accepted` 记录。

本文件遵守以下边界：

- proposed decision pack 保持历史原文，不因接受决定而回填或改写；
- `docs/architecture/architecture-v2.md` 与已接受 ADR 继续决定最高级 `target` 约束；
- 本文件只在既有 `target` 内记录用户已经选择的方案、接受范围、绑定关系和仍未解除的硬门；
- proposed decision pack 中未被本次用户授权明确接受的精确字符串、对象名称、文件路径、测试向量或环境参数仍为 `proposed` 或待冻结；
- “已接受”只表示治理选择已经确定，不表示 Runtime、Runner、仓库硬门、Schema、Migration、数据库状态或正式发布已经完成。

本文件不构成 GitHub 仓库设置、Runner／Runbook、数据库、Migration、环境、真实 Manifest、执行 Lease、A2-P1 或 A2-P2 的执行授权。

## 2. 已接受决策总表

| 编号 | 接受选择 | 接受范围 | 后续硬门 | 明确非目标 |
|---|---|---|---|---|
| D01 | A | Tenancy 是 Institution Scope、Context Version、Context Head、Manifest、Scope Revision 和 Provisioning Provenance 原始事实的唯一语义 Owner | 治理基础阶段冻结物理边界、Port、Writer 与 Repository 责任 | 不重开 Identity／Access Control／Security 已接受所有权；共享数据库、Migration 或执行资产不得成为业务 Owner |
| D02 | A | Access Control 通过版本化 Port／Reader 和低敏投影单向消费 Tenancy 原始事实 | 冻结当前直接读共享表的退出条件和 BASE-02 接入边界 | 不建立第二套 Scope／Context、Membership 或 Authorization Provenance 事实源；不提前实现 BASE-02 |
| D03 | A | 严格版本化低敏 Manifest、仅接受 approved、审批人与执行者分离、字段白名单和整批 fail-closed | 治理基础阶段冻结精确 version、白名单、审批引用和撤销／替换协议 | 真实 Manifest、PII、Secret、Token、连接串或自由文本不得进入 Git、日志或执行资产 |
| D04 | A | 版本化固定位置 JSON 数组 canonicalization 与 SHA-256 | 冻结完整 preimage、格式细节、测试向量和协议升级测试 | 不静默规范化非法 Unicode；不覆盖旧 digest |
| D05 | A | Context 全字段显式提供，禁止隐式默认和环境推断 | 冻结获批 IANA／ISO 集合、source 枚举和校验资产 | 不从执行时钟、部署时区、Demo、Seed、Binding 或单机构现状推断 |
| D06 | B | A2-P1 通过受控 Runner 接收仓库外真实 Manifest | 先完成独立 Runner 治理／Runbook，再申请 P1 | 真实 Manifest 不进入 Git、argv 正文、环境变量正文、日志、PR 描述或测试 Fixture |
| D07 | B | A2-P1 只保留一次性受控 Runner 一个执行入口 | 冻结输入注入、权限、撤权、保留期、低敏错误、事务和计数 | 不并行保留手写 Data Migration 写入口；Runner 不演变为正式 Onboarding Runtime |
| D08 | C | 分阶段 Metadata 治理；Runner P1 不修改 journal／snapshot | 首个 journal-backed A2 切片前修正陈旧 current 口径；完整 snapshot baseline 后置独立治理 | 不在 P1／P2 夹带全量 metadata 重建；继续禁止 `db:generate` 和 snapshot-diff Migration |
| D09 | A | 用户授予任务级排他执行／Migration Lease | Runner P1 取得执行 Lease；P2 重新取得 Migration Lease 和届时分配的编号 | `0039` 不是已批准编号；不依赖 migrate guard 代替跨任务排他协调 |
| D10 | B | A2-P1／P2 前启用 `main` 保护和“最小架构与质量门禁”Required Check | 独立仓库设置任务配置、回退并用无害 PR 验证 | 本任务不修改仓库设置；不使用管理员绕过、`--admin`、直接 push、force push 或分支删除 |
| D11 | B | A2-P1 只允许 Runner 文件集 | 治理基础阶段在最新 `main` 上冻结精确路径、测试、Runbook 与 package 命令决定 | 不修改 `drizzle/**`、journal、snapshot、`schema.ts`、业务 API／UI 或 CI 规则；不建立双入口 |
| D12 | A（方向） | 接受最小 Anchor Bridge 方向：候选普通双键索引与指向 Scope 的 `NOT VALID` FK | P1 完成后的独立 handoff 重新冻结名称、列序、Catalog Shape、编号、锁／timeout 和环境 | 不回填、不 VALIDATE、不 SET NOT NULL、不放行 Reader、不收紧 Audit attribution／shape、不实施 MIG-01C |

## 3. 各项接受范围

### 3.1 D01-A：原始事实唯一 Owner

接受 Tenancy 作为以下原始事实的唯一语义 Owner：

- Institution Scope；
- Context Version；
- Context Head；
- Manifest；
- Scope Revision；
- Provisioning Provenance。

继续保持既有所有权：

- Identity：用户、账号和正式 Session；
- Access Control：Membership、Authorization Provenance、Fresh Membership、短生命周期 Anchor 授权证据、机构／对象 Guard 和 Action Policy；
- Security：密钥、低敏输出、安全开关和通用安全能力。

D01-C 继续为 `target-incompatible／排除`。共享数据库、Migration、Runner 或其他执行资产只承担托管或执行职责，不得成为业务事实 Owner。

### 3.2 D02-A：Tenancy 与 Access Control 单向边界

接受 Access Control 通过版本化 Port／Reader 和低敏投影单向消费 Tenancy 原始事实。当前直接读共享表只允许作为限期兼容，不构成第二 Owner，退出条件必须在后续治理基础阶段冻结。

A2 只负责 Scope／Context／Manifest Provisioning。Membership／Binding 生命周期、Fresh Membership、Guard 和 Action Policy 继续留给 BASE-02。

### 3.3 D03-A：严格版本化低敏 Manifest

接受以下原则：

- Manifest version 必须显式；
- 审批状态只接受 `approved`；
- 审批人与执行者必须分离；
- 只允许获批低敏字段白名单；
- 未知版本、未批准、字段越界或完整性失败时整批 fail-closed；
- PII、Secret、Token、连接串和自由文本不得进入 Git、日志或执行资产。

精确 version 字符串、完整白名单、审批引用表示及撤销／替换协议仍需在治理基础阶段冻结。

### 3.4 D04-A：固定位置数组与 SHA-256

接受版本化固定位置 JSON 数组 canonicalization 和 SHA-256，边界为：

- 条目按 `tenantId`、`institutionId` 稳定排序；
- 所有位置显式出现，nullable 使用显式 `null`；
- 非法 Unicode 或非 NFC 字符串拒绝，不静默修改；
- 日期、时间、数字和枚举采用冻结格式；
- 序列化结果使用 UTF-8；
- 外部表示为 `sha256:<64 位小写 hex>`；
- 数据库字段保存 64 位小写 hex；
- 协议升级必须使用新版本、新 digest 和新审批。

完整 preimage、位置表、精确格式和测试向量仍需在治理基础阶段冻结。

### 3.5 D05-A：Context 全字段显式

接受以下政策：

- Scope revision、Context version、Head revision 和 latestVersion 首次均显式为 `1`；
- Scope source 与 Context source 必须显式提供；
- timezone 必须来自获批 IANA 时区；
- currency 必须来自获批 ISO 4217 集合；
- `effectiveFromBusinessDate` 和 `effectiveAt` 均显式；
- `effectiveAt` 转换到机构时区后必须落在对应业务日期；
- 不强制 `effectiveAt` 为机构本地零点；
- 不得从执行时钟、部署时区、Demo、Seed、Binding 或单机构现状推断。

获批 IANA／ISO 集合、source 枚举和校验资产仍需在治理基础阶段冻结。

### 3.6 D06-B、D07-B 与 D11-B：唯一 Runner 路径

三项决定绑定接受：

```text
仓库外真实 Manifest
→ 一次性受控 Runner
→ Runner 文件集
```

真实 Manifest 不进入 Git、argv 正文、环境变量正文、日志、PR 描述或测试 Fixture。必须先完成独立 Runner 治理／Runbook，之后才能申请 P1。

Runner 是 A2-P1 的唯一写入口；手写 Data Migration 不再是并行入口或备用写入口。Runner 不得演变为正式 Onboarding Runtime。

精确文件路径、输入注入、权限、撤权、保留期、低敏错误、dry-run、事务、计数、测试、Runbook 以及是否新增稳定 package 命令，均由下一治理基础任务在最新 `main` 上冻结。

### 3.7 D08-C 与 D09-A：Metadata 与 Lease

接受分阶段 Metadata 治理：

- Runner P1 不修改 journal 或 snapshot；
- 仓库 journal 当前到 `0038`；
- snapshot 当前到 `0026`，且不覆盖 A1；
- 继续禁止 `db:generate` 和 snapshot-diff Migration；
- 在首个 journal-backed A2 切片前，独立修正陈旧策略文档和测试中的 current 口径；
- 完整 snapshot baseline 校准作为后置独立治理任务；
- P1／P2 不夹带全量 metadata 重建。

接受用户授予的任务级排他执行／Migration Lease。Lease 至少绑定任务编号、分支、冻结 Base、Journal、Holder／Operator、目标环境、精确作用域、开始时间、有效期、续期、失效条件、释放和交接。

Runner P1 不占 Migration 编号，但必须取得独立执行 Lease；P2 必须重新取得 Migration Lease 和届时重新分配的编号。`0039` 仍只是静态候选，不是已批准编号。

### 3.8 D10-B：P1／P2 前置仓库硬门

接受在 A2-P1／P2 前完成以下仓库硬门：

- 只允许通过 PR；
- 冻结 Head 对应的“最小架构与质量门禁”必须成功；
- 分支必须基于最新 `main`；
- 禁止直接 push、force push 和分支删除；
- 管理员不得绕过，不使用 `--admin`；
- A2 数据／Migration PR 使用 Merge Commit，不启用线性历史；
- 当前不强制外部 Reviewer，避免单维护者仓库无法正常收口。

配置、验证和回退必须由独立仓库设置任务执行，并以无害验证 PR 证明硬门实际生效。本文件只记录接受结果，不表示设置已经配置。

### 3.9 D12-A（方向）：只接受最小 Anchor Bridge

接受方向仅为：

- `auth_account_institution_bindings(tenant_id, institution_id)` 普通索引候选；
- 对 `institution_scopes(tenant_id, institution_id)` 的 `NOT VALID` FK 候选。

本次不接受或授权精确对象名称、列序、Catalog Shape、Migration 编号、锁／timeout 或目标环境。这些细节必须在 P1 完成后的独立 handoff 中重新冻结。

D12 不阻断 P1，但在上述细节冻结前持续阻断 P2。明确排除数据回填、`VALIDATE CONSTRAINT`、`SET NOT NULL`、Reader 放行、Audit attribution／shape 收紧、MIG-01C 和更广业务关系预铺。

## 4. 决策绑定关系

| 绑定组 | 绑定结果 | 不得拆开的原因 |
|---|---|---|
| D01 + D02 | Tenancy 唯一 Owner；Access Control 单向消费 | Owner 与消费边界必须保持单一事实源和单向依赖 |
| D03 + D04 + D05 | Manifest shape、digest preimage 与 Context 字段政策同版冻结 | 任一部分漂移都会使审批输入、digest 和落库事实失去等价性 |
| D06 + D07 + D11 | 仓库外 Manifest + 唯一一次性 Runner + Runner 文件集 | 防止双写入口、旁路执行和不可审计重放 |
| D08 + D09 | Metadata 阶段边界与任务级排他 Lease | Runner P1 不占编号并使用独立执行 Lease；journal-backed P2 另取编号、文件范围和 Migration Lease |
| D10 + D11 | 仓库硬门先完成；Runner 文件边界随后冻结 | 阶段 A 未验证前不得开始阶段 B 的正式交付 |
| D12 后置 | 只接受方向，实施细节在 P1 handoff 后冻结 | 不阻断 P1，但必须阻断未经核验的 P2 |

## 5. 仍待冻结的治理与契约细节

以下事项没有因本文件成为 `accepted`：

- D03 的精确 manifest version、完整低敏字段白名单、审批引用表示和撤销／替换协议；
- D04 的完整 preimage、位置表、精确日期／时间／数字格式和正负测试向量；
- D05 的获批 IANA／ISO 集合、Context source 枚举和校验资产；
- Runner 的精确路径、输入注入、Parser、事务、计数、dry-run、低敏错误、权限、撤权、保留期和 Runbook；
- 是否新增稳定 package 命令；
- 当前直接读共享表的退出条件；
- Lease 的具体 Holder／Operator、目标环境、时限和交接记录；
- D12 的对象名称、列序、Catalog Shape、编号、锁／timeout 和环境窗口。

这些细节由后续明确任务冻结，不得从 decision pack 的推荐文字直接推断为已接受实施合同。

## 6. 尚未解除的环境与执行阻断

- `main` 保护和 Required Check 尚未配置或验证；
- Runner、Parser、Runbook 和低敏输入通道尚未创建；
- 执行 Lease／Migration Lease 均未签发；
- 真实 Manifest、环境 journal、目标数据库、tenant 父记录、Scope／Context／Head 实际 Shape、备份／恢复点均未授权核验；
- Operator／Reviewer、目标环境、权限授予和撤销规则尚未冻结；
- P1 的 inserted／reused／conflict／unexpected 计数、冲突、幂等、回滚和 forward-fix 证据均不存在；
- P2 的 Catalog Shape、编号、锁窗口、timeout 和环境窗口尚未冻结；
- A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 和 Reader 均未启动；
- 七条机构业务线正式发布继续为 `0/7`。

已接受治理决定只关闭“选择什么”的决策歧义，不关闭“是否已配置、实现、验证或执行”的交付门禁。

## 7. 下一治理基础大目标

唯一下一任务为：

```text
V2-MIG01-A2-GOVERNANCE-FOUNDATION-01
MIG-01A2 仓库硬门与受控 Runner 治理基础
```

该 Ultra 大目标包含两个必须串行、不得混成一个 PR 的原子阶段：

1. 阶段 A：独立修改和验证 GitHub 仓库硬门，不修改业务代码；
2. 阶段 B：仅在阶段 A 完成并有证据后，独立设计和实现受控 Runner 治理基础。

阶段 A 是 GitHub 外部状态修改，阶段 B 是仓库代码修改，二者必须分别保留验证与回退证据。阶段 B 不连接真实数据库、不读取真实 Manifest、不执行 P1；阶段 A、B 完成后必须通过独立 handoff 冻结后续唯一任务。

## 8. 明确非授权范围

本文件及其合并不会：

- 配置或回退 GitHub 分支保护、Required Check 或合并策略；
- 创建 Runner、Parser、命令、测试、Runbook、Manifest 或低敏投影；
- 修改 Schema、Migration、journal、snapshot、Runtime、API、UI、CI、package 或 lock；
- 读取真实 Manifest、`.env.local`、`DATABASE_URL`、凭证、PII 或环境变量值；
- 连接数据库、测试服务器、生产环境或业务外部系统；
- 签发执行 Lease、Migration Lease 或 Migration 编号；
- 启动阶段 A、阶段 B、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务；
- 把质量门禁通过、文档合并或 accepted 治理选择解释为正式发布。
