# V0.8 05C-E1 客户匹配 mock domain 重新设计方案

- 日期：2026-07-13
- 任务编号：`ZMTG-05C-E1-MAPPING-DOMAIN-REPLAN-DOC-20260713`
- 文档性质：docs-only 设计方案，不代表运行时能力已经实现，也不构成 05C-E2 开发授权
- 前置记录：PR #521《V0.8 05C-E1 客户匹配 mock domain 安全阻塞收口》

## 1. 结论摘要

原 05C-E1 代码 WIP 不直接提交、不直接创建 PR，仅作为缺陷复盘与设计参考。后续实现必须在本重新设计文档合并后，从最新 `main` 新建干净代码分支，不复用未经审查的旧实现。

本轮重新设计先固化四项契约：状态机、strict parser / whitelist、低敏 audit、完整测试矩阵。在这些契约完成审查前，不开始代码实现。

05C-E1 仍限定在 mock/demo customer mapping domain：不进入真实同步，不自动合并客户，不写真实客户关系，不调用企业微信，也不进入 05C-E2。

## 2. 原 WIP 阻塞复盘

PR #521 已记录原 WIP 的以下阻塞类型：

1. 授权与 provider 的 fail-closed 不完整，授权关闭、撤销、过期或外部能力禁用后仍可能确认匹配。
2. `conflict` 曾可通过 `clear_candidate` / `reopen` 绕过 `approve` 前置条件。
3. 禁止内容可能藏在允许字段值中，并进入人工复核结果或其他输出。
4. 被阻断路径未稳定生成只含固定低敏字段的 audit event。
5. candidate 的 `reasonCode` 与 `status` 曾出现语义不一致。
6. 未验证的 root `tenantId` 可能在 fail-closed audit 中回显敏感原文。
7. `occurredAt` 曾可借助非规范但可解析的字符串进入 audit `timestamp`。
8. `tenantId` 与 `occurredAt` 的正则校验曾存在尾随换行绕过风险。
9. review 路径缺少 root `tenantId` + LF + 敏感内容的完整测试矩阵，尤其缺少手机号场景。

这些问题同时涉及状态完整性、输入边界、审计泄露和验证证据，不应继续在原 WIP 上补丁式推进。

## 3. 新状态机设计

### 3.1 合法状态

| 状态 | 含义 | 是否允许 `approve` |
| --- | --- | --- |
| `unmatched` | 尚无候选关系 | 否 |
| `candidate` | 已生成可人工复核的 active candidate | 满足全部 guard 时允许 |
| `manual_review_required` | 低置信度或治理规则要求人工复核 | 仅 active candidate 且无未解决冲突时允许 |
| `conflict` | 存在未解决冲突并持有 conflict lock | 否 |
| `matched` | 已由单次明确人工动作确认的 mock/demo 匹配 | 否 |
| `rejected` | 候选已被人工拒绝 | 否 |
| `needs_more_info` | 需要补充低敏依据 | 否 |
| `stale` | 候选已过期或依据失效 | 否 |
| `disabled` | mapping domain 被禁用 | 否 |
| `cleared_locked` | 候选已清除且保持锁定；当前 aggregate 的匹配流程终止 | 否 |

### 3.2 合法动作

合法动作固定为：

- `generate_candidate`
- `approve`
- `reject`
- `request_more_info`
- `mark_conflict`
- `clear_candidate`
- `reopen`
- `expire_candidate`
- `disable_mapping`

### 3.3 转换表

| 当前状态 | 动作 | 目标状态 | 必要 guard / 说明 |
| --- | --- | --- | --- |
| `unmatched` / `stale`，或无 active candidate 的 `manual_review_required` | `generate_candidate` | `candidate` / `manual_review_required` / `conflict` | 使用新的 evidence snapshot 生成 candidate digest 与版本；不得复活旧 candidate |
| `candidate` / `manual_review_required` | `approve` | `matched` | candidate active；无 unresolved conflict；授权有效；provider 为允许的 mock/demo 状态；audit ready；单次人工确认 |
| `candidate` / `manual_review_required` / `needs_more_info` | `reject` | `rejected` | 仅人工动作；保留源记录 |
| `candidate` / `manual_review_required` | `request_more_info` | `needs_more_info` | 不改变为 matched，不写客户关系 |
| `candidate` / `manual_review_required` | `mark_conflict` | `conflict` | 设置不可自动解除的 conflict lock |
| `candidate` / `manual_review_required` / `conflict` / `needs_more_info` | `clear_candidate` | `cleared_locked` | candidate inactive；保留 conflict lock；禁止直接 approve |
| `rejected` / `needs_more_info` / `matched` | `reopen` | `manual_review_required` | 只重开人工复核并令旧 candidate inactive；必须重新生成候选；不得复活 stale/cleared candidate；不得解除 conflict lock |
| `candidate` / `manual_review_required` / `needs_more_info` | `expire_candidate` | `stale` | candidate inactive；旧 digest 不得再次 approve；`conflict` 不得借此绕过 lock |
| 任一非 `disabled` 状态 | `disable_mapping` | `disabled` | 立即 fail-closed；后续动作全部拒绝 |

未列出的状态—动作组合一律 `invalid_state_transition` 并 fail-closed。`reopen` 不能解除 conflict lock；`conflict` 与 `cleared_locked` 均不能复用原 candidate，也不能经 `reopen`、`expire_candidate` 或 `generate_candidate` 等路径进入 `matched`。`cleared_locked` 是当前 mapping aggregate 的匹配流程终态；若后续出现实质性新证据，只能按第 3.5 节创建新的 aggregate，并重新满足全部人工复核 guard。

### 3.4 状态机不变量

- `approve` 只能从 `candidate` 或 `manual_review_required` 进入，且必须同时满足 active candidate、无 unresolved conflict、授权有效、provider 允许、audit ready。
- high confidence 只能生成 `candidate`，不得自动变成 `matched`。
- 不允许批量自动 `approve`；每次 `approve` 必须绑定单一 candidate digest、单一租户和单次人工审计。
- `clear_candidate` 统一进入 `cleared_locked`，不得回到可直接 approve 的普通 `unmatched`。
- `status` 与 `reasonCode` 使用固定映射；任何不一致输入均由 parser 拒绝。
- 状态转换只产生 mock/demo decision，不自动合并客户，不写真实客户关系。

建议的成功映射至少包括：

| 动作 / 场景 | `status` | `reasonCode` |
| --- | --- | --- |
| 高/中置信度候选生成 | `candidate` | `candidate_evidence_available` |
| 低置信度候选生成 | `manual_review_required` | `low_confidence` |
| 冲突发现 | `conflict` | `mapping_conflict` |
| `approve` | `matched` | `approved_by_manual_review` |
| `reject` | `rejected` | `rejected_by_manual_review` |
| `request_more_info` | `needs_more_info` | `more_info_requested` |
| `clear_candidate` | `cleared_locked` | `candidate_cleared_locked` |
| `reopen` | `manual_review_required` | `review_reopened` |
| `expire_candidate` | `stale` | `candidate_expired` |
| `disable_mapping` | `disabled` | `mapping_disabled` |

### 3.5 conflict lock 生命周期与新候选 lineage

conflict lock 按 `{tenantId, mappingReference, candidateDigest, evidenceFingerprint}` 绑定到具体 mapping aggregate 与候选 lineage，一经创建即不可修改或解除。`mappingReference`、`candidateDigest` 与 `evidenceFingerprint` 均由 domain 从已验证 canonical mock/demo 数据内部生成；generation 调用方不得提供或覆盖。review 调用方只可把既有 `candidateDigest` 作为 opaque 目标引用提交，application 边界必须严格解析并与可信 active candidate 做完全相等比对；该引用不能创建或覆盖 digest，也不能证明 lineage。当前设计不提供 `resolve_conflict` 或 unlock 动作。

- `clear_candidate` 是人工放弃当前冲突候选，不是解除冲突。它将旧 candidate 置为 inactive，进入 `cleared_locked`，并为旧 digest 保留 conflict lock 与低敏 audit。
- `reopen`、`expire_candidate`、`generate_candidate` 与 `approve` 对 `conflict` 或 `cleared_locked` 的绕过组合均非法，不能复活旧 candidate，也不能改变旧 lock。
- `cleared_locked` 是当前 aggregate 的匹配流程终态。后续实质性新证据必须从新的 `unmatched` aggregate 开始；不得把“清除旧 candidate”伪装成同一 aggregate 的重新生成。
- 新 aggregate 的 source snapshot 必须由 domain/application 边界从同一租户、同一受控 mock/demo source scope 的完整输入内部构造；调用方不得提交 `mappingReference`、snapshot digest、version、sequence 或 timestamp 来自行证明 lineage 已变化。
- domain 必须对 material evidence 使用固定排序和 canonical 编码，内部计算 `evidenceFingerprint`。删除旧冲突候选、改变输入顺序、只改 digest/version/timestamp/reference，或提交不完整 snapshot，均不构成实质性新证据。
- 创建新 aggregate 时，必须携带由可信内部流程产生的既有 lock 低敏索引并进行跨 aggregate 对照；遗漏、伪造或无法证明 snapshot 完整性时，以固定 reason code `locked_candidate_reuse_blocked` fail-closed，不得生成 candidate。
- 只有完整受控 snapshot 的 material evidence 已变化，且新 aggregate 不再包含旧冲突组合时，才可生成新的 candidate；若再次产生多候选或冲突，目标状态仍为 `conflict` 并创建新的不可解除 lock。
- 旧 conflict lock 永远保留。新 aggregate 不继承旧状态，但必须通过跨 aggregate lock 对照；`approve` 仍需当前 aggregate 的 `unresolvedConflictCount === 0`、active candidate 与全部授权 guard。
- audit 通过旧 candidate 的 `mapping_candidate_cleared`、被阻断时的 `mapping_locked_candidate_reuse_blocked`，以及合格新 aggregate 的 `mapping_candidate_generated` 事件形成低敏可追溯链路；事件只记录已验证 digest，不增加原始 evidence 或自由文本字段。

因此，`conflict → clear_candidate → generate_candidate → approve` 在同一 aggregate 内始终非法；`conflict → expire_candidate → generate_candidate → approve` 同样非法。后续仅能以可信完整 snapshot 创建新 aggregate，且不能靠候选缺失、重排或元数据变化规避旧 lock。

## 4. strict parser / whitelist 设计

### 4.1 总体规则

- generation 与 review 的所有入口 payload 必须先经过 parser，成功产生不可变的 validated DTO 后，才能进入 domain。
- root `tenantId`、nested `tenantId`、`customerDigest`、`reasonCode`、`status`、`action`、`sourceKind`、`dataMode`、`occurredAt`，以及 review whitelist 中用于定位既有 active candidate 的 `candidateDigest`，全部严格校验。generation raw payload 出现 `candidateDigest` 必须作为 unknown field 阻断。
- 字符串校验必须证明全字符串匹配，例如同时校验匹配结果长度和 `match[0] === value`；不得把 JavaScript `$` 作为唯一结尾保证。
- 标识、枚举、digest 和 timestamp 不接受前后空白，不允许 `trim()` 后继续使用原值。若未来确需规范化，必须生成独立 canonical 值，并禁止原始值进入 domain 或 audit。
- 所有入口统一拒绝 LF、CRLF、U+2028、U+2029；不允许先去除行分隔符再使用原值。
- unknown field 一律 fail-closed；禁止“忽略后继续解析”。
- nested raw payload、原始第三方响应、未脱敏 webhook payload 和任意未知容器一律 fail-closed。
- parser 失败只能返回固定低敏 reason code 与安全占位值，不得携带原 payload 片段。

### 4.2 分层 parser

1. **Shape parser**：输入必须是 plain object，并且字段集合与对应 whitelist 完全一致。
2. **Scalar parser**：逐字段校验类型、长度、枚举、全字符串格式和行分隔符。
3. **Nested parser**：递归校验 authorization、contact、candidate、evidence 与 customer；unknown nested field 同样阻断。
4. **Cross-field parser**：校验 tenant 一致性、data mode 一致性、status / reasonCode 对应关系、candidate active / lock 标志组合。
5. **Domain gate**：只有 validated DTO 才能调用状态机；原始 payload 不得被 domain 或 audit 工厂引用。

### 4.3 canonical snapshot 完整性

- 外部 generation payload 的 whitelist 不包含 `mappingReference`、`candidateDigest`、`evidenceFingerprint`、snapshot digest、version、sequence 或用于证明先后关系的 timestamp；这些值只能由 domain/application 边界内部生成。
- 外部 review payload 可包含严格校验的 `candidateDigest`，但只作为 opaque 目标引用。application 边界必须从可信内部状态取得 active candidate 并做完全相等比对，再把内部 candidate 写入 validated DTO；调用方提交值不得写回状态、替代内部 digest，或作为 lineage 变化证明。review payload 同样不得包含 `mappingReference`、`evidenceFingerprint`、snapshot digest、version、sequence 或 lineage timestamp。
- snapshot builder 只接收经过 strict parser 的完整受控 mock/demo source scope，并以固定字段集、固定排序与 canonical 编码构造 material evidence；调用方提供的预计算 digest 或版本一律作为 unknown field 阻断。
- 完整性校验必须证明 source scope 中的记录没有被省略。删除冲突候选、只提交局部 records、调整顺序或只改元数据不得生成新的 fingerprint。
- 新 aggregate 必须使用可信内部 lock index 对照旧冲突组合；lock index 缺失、来源不可验证或对照无法完成时 fail-closed。

## 5. tenantId 规则

`tenantId` 始终视为 untrusted input。仅允许受控 mock/demo 格式，例如 `tenant-mock-001` 或 `tenant-demo-001`，并同时满足 ASCII、长度上限、全字符串匹配和无行分隔符。

规则如下：

- root 与所有 nested `tenantId` 必须独立通过 parser；通过后再比较是否完全相等。
- 非法 root `tenantId` 不得进入返回 payload 或 audit，统一使用固定低敏占位，例如 `tenant_blocked`。
- tenant mismatch audit 不回显 root、authorization、candidate、contact、customer 或其他 nested `tenantId` 原文。
- fail-closed 只能使用固定 reason code，例如 `unsafe_tenant_id_blocked` 或 `tenant_mismatch`。
- 不记录原值片段，不通过字符串拼接构造错误信息，不将原值写入日志。

parser 与测试必须覆盖以下内容及其大小写、snake_case / camelCase 变体：

- phone；
- externalUserId / external_userid；
- userid / userId；
- secret；
- accessToken / access_token；
- credential；
- rawResponse；
- webhookPayload；
- apiResponse；
- LF / CRLF / U+2028 / U+2029 以及行分隔符后的拼接内容。

## 6. occurredAt 规则

`occurredAt` 始终视为 untrusted input，只允许 canonical UTC ISO：`YYYY-MM-DDTHH:mm:ss.SSSZ`。

- 必须先进行 ASCII 与固定长度检查，再进行全字符串格式和真实日历日期校验。
- 不使用 `Date.parse` 或 `new Date(string)` 宽松解析用户输入。
- 非 ISO、非法日期、尾随换行、Unicode 行分隔符、时区偏移形式、缺少毫秒，以及带敏感附注的 timestamp 全部 fail-closed。
- 非法值不得进入 candidate、review、decision、返回 payload 或 audit。
- fail-closed audit 使用固定安全 timestamp，例如 `1970-01-01T00:00:00.000Z`，并使用固定 reason code `unsafe_occurred_at_blocked`。
- audit 和错误信息均不得回显原始 `occurredAt`。

## 7. audit 低敏契约

### 7.1 固定字段

所有成功与 fail-closed 路径都必须通过单一 audit factory 生成低敏事件。audit event 只允许以下固定字段：

- `tenantId`：仅已验证受控值或 `tenant_blocked`；
- `eventType`：固定枚举；
- `reviewerRole`：固定枚举；
- `action`：固定枚举；
- `reasonCode`：固定枚举；
- `mappingStatusBefore` / `mappingStatusAfter`：固定枚举；
- `candidateDigest`：已验证 digest 或固定零值 digest；
- `timestamp`：已验证 canonical UTC ISO 或固定安全 timestamp；
- `sourceKind`：固定 mock/demo 枚举；
- `dataMode`：`mock` 或 `demo`。

audit 禁止包含 root 原文、原始 payload、原始第三方响应、敏感字段值、自由文本错误信息或任意 unknown field。所有 audit event stringify 后必须进行整体敏感内容扫描。

### 7.2 事件与 reason code

事件类型至少覆盖：

- `mapping_candidate_generated`
- `mapping_conflict_detected`
- `mapping_manual_review_requested`
- `mapping_approved`
- `mapping_rejected`
- `mapping_more_info_requested`
- `mapping_reopened`
- `mapping_candidate_cleared`
- `mapping_candidate_expired`
- `mapping_disabled`
- `mapping_locked_candidate_reuse_blocked`
- `forbidden_field_blocked`
- `mapping_provider_disabled`
- `unsafe_tenant_id_blocked`
- `unsafe_occurred_at_blocked`

`reasonCode` 必须来自固定枚举，并与事件类型、状态前后值保持一致。禁止把异常消息、parser 原值或自由文本作为 reason code。所有 fail-closed 分支至少生成一个低敏 audit event；即使输入无法解析，也只能使用安全占位值。

动作与成功事件的最小映射固定如下：

| 动作 | 成功 eventType |
| --- | --- |
| `generate_candidate` | `mapping_candidate_generated` / `mapping_conflict_detected` / `mapping_manual_review_requested` |
| `approve` | `mapping_approved` |
| `reject` | `mapping_rejected` |
| `request_more_info` | `mapping_more_info_requested` |
| `mark_conflict` | `mapping_conflict_detected` |
| `clear_candidate` | `mapping_candidate_cleared` |
| `reopen` | `mapping_reopened` |
| `expire_candidate` | `mapping_candidate_expired` |
| `disable_mapping` | `mapping_disabled` |

provider 或 authorization 不可用时统一生成 `mapping_provider_disabled`；locked lineage 复用、旧冲突候选被省略、snapshot 不完整或仅元数据变化时统一生成 `mapping_locked_candidate_reuse_blocked`，reason code 为 `locked_candidate_reuse_blocked`。其他 parser、敏感内容与非法状态转换阻断路径使用各自固定低敏事件与 reason code。

## 8. 测试矩阵

测试先于实现编写。每一行至少断言：是否 fail-closed、目标状态、固定 reason code、audit 固定字段、无敏感原文、无外部调用、不自动合并、不写真实客户关系。

### A. generation path

| 维度 | 必测输入 / 场景 |
| --- | --- |
| root `tenantId` | 正常、phone、secret、accessToken、credential、externalUserId、userid、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| `occurredAt` | 正常 canonical ISO、非 ISO、非法日期、phone、secret、accessToken、credential、externalUserId、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| payload | forbidden field、允许字段中藏敏感值、unknown field、nested raw payload |
| provider / authorization | authorized mock、not_configured、revoked、expired、disabled、external_disabled |
| tenant | root / authorization / contact / follow user / tag / customer mismatch |
| candidate | 高置信度仍为 `candidate`、低置信度为 `manual_review_required`、多候选为 `conflict` |

### B. review path

| 维度 | 必测输入 / 场景 |
| --- | --- |
| 动作 | `approve`、`reject`、`request_more_info`、`mark_conflict`、`clear_candidate`、`reopen`、`expire_candidate`、`disable_mapping` |
| root `tenantId` | 正常、phone、secret、accessToken、credential、externalUserId、userid、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接；每种均验证 audit 不回显 |
| `occurredAt` | 正常 canonical ISO、非 ISO、phone、secret、accessToken、credential、externalUserId、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| provider / authorization | revoked、expired、disabled、external_disabled、tenant mismatch 下所有动作 fail-closed |
| conflict | `conflict → clear_candidate → approve`、`conflict → clear_candidate → reopen → approve`、`conflict → clear_candidate → generate_candidate → approve`、`conflict → expire_candidate → generate_candidate → approve` 全部阻断；删除旧冲突候选、只改 digest/version/timestamp/reference、重排 evidence、提交 partial snapshot 均阻断并产生 `mapping_locked_candidate_reuse_blocked`；可信完整 snapshot 的 material evidence 实质变化时从全新 `unmatched` aggregate 重新检测冲突，并断言旧 lock 永久保留 |
| 非活动候选 | `unmatched`、`rejected`、`stale`、`disabled`、`cleared_locked` 的 `approve` 全部阻断 |
| 一致性 | 每个合法动作的 `status`、`reasonCode`、audit event 完全一致；非法组合由 parser 阻断 |

### C. audit scan

对 generation、review、provider disabled、tenant mismatch、parser failure、conflict blocked、illegal transition 等全部事件执行 stringify 后整体扫描，结果不得包含：

- phone；
- `wm_` / `wo_` 原始标识；
- token；
- secret；
- credential；
- rawResponse；
- webhookPayload；
- apiResponse；
- 聊天内容；
- 会话存档；
- 原始 payload 或任何输入片段。

同时断言 audit 字段集合完全等于 whitelist，所有缺失或多余字段均视为失败。

## 9. 后续代码开发前置条件

1. 先合并本 replan 文档并完成人工审查。
2. 从届时最新 `main` 新建干净代码分支；原 WIP 仅作问题参考。
3. 不复制、不 cherry-pick、不复用未经逐行审查的旧 WIP 代码。
4. 先按第 8 节编写完整测试矩阵，再编写最小实现。
5. 每次安全复核失败后，最多允许一次基于明确根因的修正；不得继续多轮补丁式推进。
6. 同一代码方案累计两次安全复核失败时，立即停止代码推进并回到 docs 设计，重新审查状态机、parser、audit 和测试矩阵。
7. 只有 typecheck、定向测试、边界审查和低敏 audit 扫描全部通过后，才允许创建 Draft 代码 PR；该许可必须由后续任务明确给出。

## 10. 非目标

本重新设计文档不实现、也不授权以下内容：

- API；
- UI；
- 数据库连接、repository、schema、migration 或 seed；
- 企业微信调用或真实 provider runtime；
- 外部联系人真实同步；
- 会话内容读取或会话内容存档接入；
- 真实客户关系写入；
- 自动合并客户或批量自动 approve；
- 05C-E2 或 05D。

本阶段只固化 05C-E1 mock/demo domain 的重新设计契约。任何后续代码工作均需新的明确授权。
