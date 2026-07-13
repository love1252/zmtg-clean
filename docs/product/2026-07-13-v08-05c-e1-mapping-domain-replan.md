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
| `candidate` / `manual_review_required` / `conflict` / `needs_more_info` | `clear_candidate` | `cleared_locked` | candidate inactive；非冲突来源新建不可解除 lineage lock，冲突来源保留原 lock；禁止直接 approve |
| `rejected` / `needs_more_info` / `matched` | `reopen` | `manual_review_required` | 只重开人工复核并令旧 candidate inactive；除 `disable_mapping` 外必须先重新生成候选，旧 historical target 不得直接执行其他 review action；不得复活 stale/cleared candidate或解除 lock |
| `candidate` / `manual_review_required` / `needs_more_info` | `expire_candidate` | `stale` | candidate inactive；旧 digest 不得再次 approve；`conflict` 不得借此绕过 lock |
| 任一非 `disabled` 状态 | `disable_mapping` | `disabled` | 唯一 containment 安全例外；仍须通过 parser、tenant、时间与 audit preflight，但不依赖 authorization/provider/candidate guard；后续动作全部拒绝 |

未列出的状态—动作组合一律 `invalid_state_transition` 并 fail-closed。`reopen` 不能解除 conflict lock；`conflict` 与 `cleared_locked` 均不能复用原 candidate，也不能经 `reopen`、`expire_candidate` 或 `generate_candidate` 等路径进入 `matched`。`cleared_locked` 是当前 mapping aggregate 的匹配流程终态；若后续出现实质性新证据，只能按第 3.5 节创建新的 aggregate，并重新满足全部人工复核 guard。

### 3.4 状态机不变量

- `approve` 只能从 `candidate` 或 `manual_review_required` 进入，且必须同时满足 active candidate、无 unresolved conflict、授权有效、provider 允许、audit ready。
- high confidence 只能生成 `candidate`，不得自动变成 `matched`。
- 不允许批量自动 `approve`；每次 `approve` 必须绑定单一 candidate digest、单一租户和单次人工审计。
- `clear_candidate` 统一进入 `cleared_locked` 并创建或保留不可解除 lineage lock，不得回到可直接 approve 的普通 `unmatched`。
- `status` 与 `reasonCode` 使用固定映射；任何不一致输入均由 parser 拒绝。
- 状态转换只产生 mock/demo decision，不自动合并客户，不写真实客户关系。

成功状态与 reason 映射固定如下，不允许增加自由组合：

| 动作 / 场景 | `status` | `reasonCode` |
| --- | --- | --- |
| 初始 aggregate | `unmatched` | `not_generated` |
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

每个 lineage lock record 按 `{tenantId, sourceScopeReference, mappingReference, candidateDigest, candidatePairDigest, evidenceFingerprint}` 绑定到具体 mapping aggregate 与候选 lineage，一经创建即不可修改或解除；跨 aggregate 的稳定对照键固定为 `{candidatePairDigest, evidenceFingerprint}`。`candidatePairDigest` 独立绑定 tenant、稳定 source scope、external contact digest 与 system customer digest，不包含 aggregate / candidate version、mapping reference、timestamp 或完整 source snapshot digest。`conflict` 会创建 conflict 类型 lineage lock；任何 `clear_candidate` 都必须创建或保留 lineage lock，因此非冲突 clear 也不能复活旧 candidate。上述 digest / reference 均由 domain 从已验证 canonical mock/demo 数据内部生成；generation 调用方不得提供或覆盖。review 调用方只可把既有 `candidateDigest` 作为 opaque 目标引用提交，application 边界必须严格解析并与当前动作的可信 target candidate 做完全相等比对；该引用不能创建或覆盖 digest，也不能证明 lineage。target 是否必须 active 或允许引用 historical / locked lineage，由第 3.6 节按动作决定。当前设计不提供 `resolve_conflict` 或 unlock 动作。

- `clear_candidate` 是人工放弃当前候选，不是解除或绕过 lineage。它将旧 candidate 置为 inactive，进入 `cleared_locked`；普通候选新建 clearance lineage lock，冲突候选保留 conflict lineage lock，并为旧 digest 保留低敏 audit。
- `reopen`、`expire_candidate`、`generate_candidate` 与 `approve` 对 `conflict` 或 `cleared_locked` 的绕过组合均非法，不能复活旧 candidate，也不能改变旧 lock。
- `cleared_locked` 是当前 aggregate 的匹配流程终态。后续实质性新证据必须从新的 `unmatched` aggregate 开始；不得把“清除旧 candidate”伪装成同一 aggregate 的重新生成。
- 新 aggregate 的 source snapshot 必须由 domain/application 边界从同一租户、同一受控 mock/demo source scope 的完整输入内部构造；调用方不得提交 `mappingReference`、snapshot digest、version、sequence 或 timestamp 来自行证明 lineage 已变化。
- domain 必须对候选对身份与 material evidence 分别使用固定排序和 canonical 编码，内部计算 `candidatePairDigest` 与 `evidenceFingerprint`。删除旧冲突候选、改变输入顺序、只改 source metadata、source snapshot digest、aggregate / candidate version、timestamp、mapping reference，或提交不完整 snapshot，均不构成实质性新证据，也不会改变跨 aggregate 对照键。
- 创建新 aggregate 时，必须携带由可信内部流程产生的既有 lock 低敏索引并进行跨 aggregate 对照；遗漏、伪造或无法证明 snapshot 完整性时，以固定 reason code `locked_candidate_reuse_blocked` fail-closed，不得生成 candidate。
- 只有完整受控 snapshot 的 material evidence 已变化，或 candidate pair 已真正变化，并且新 aggregate 不再复用同一 `{candidatePairDigest, evidenceFingerprint}` 锁定组合时，才可生成新的 candidate；不同 candidate pair 即使 evidence fingerprint 相同也不得误命中旧 pair lock。若新证据仍产生多候选或冲突，目标状态仍为 `conflict` 并创建新的不可解除 lock。
- 旧 conflict lock 永远保留。新 aggregate 不继承旧状态，但必须通过跨 aggregate lock 对照；`approve` 仍需当前 aggregate 的 `unresolvedConflictCount === 0`、active candidate 与全部授权 guard。
- audit 通过旧 candidate 的 `mapping_candidate_cleared`、被阻断时的 `mapping_locked_candidate_reuse_blocked`，以及合格新 aggregate 的 `mapping_candidate_generated` 事件形成低敏可追溯链路；事件只记录已验证 digest，不增加原始 evidence 或自由文本字段。

因此，`conflict → clear_candidate → generate_candidate → approve` 在同一 aggregate 内始终非法；`conflict → expire_candidate → generate_candidate → approve` 同样非法。后续仅能以可信完整 snapshot 创建新 aggregate，且不能靠候选缺失、重排或元数据变化规避旧 lock。

### 3.6 全局 guard 与判定顺序

所有入口按以下固定顺序判定，并且只报告第一个失败，避免同一输入因实现顺序不同产生不同 audit：

1. plain-object shape、精确 key whitelist / forbidden nested container、全字符串统一敏感值扫描，三者按此顺序判定；
2. root / nested `tenantId`；
3. `occurredAt`；
4. 其余 scalar、enum、digest 与 reference 的类型 / grammar；boolean 在此只校验类型，不判定固定 literal 或 attestation 语义；
5. cross-field、tenant、`status` / `reasonCode`、candidate opaque reference；
6. snapshot 完整性与 lineage lock；
7. audit preflight；
8. 当前状态若已为 `disabled`，任何动作均按非法转换阻断；
9. `disable_mapping` containment 安全例外；
10. authorization / provider / sync gate；
11. 状态转换与 action-specific candidate / conflict guard，严格按下文 11a—11c 子顺序判定。

raw guard 1 的内部顺序固定为：1a root / discriminated command 必须是 plain object；1b exact keys 与 forbidden field name；1c whitelist 不允许的 nested object / array / raw container；1d 对每一个 string value 运行第 4.5 节同一个 sensitive scanner。字段遍历顺序固定为第 4.4 节 whitelist 的书写顺序；数组按 index 升序，nested object 按表内字段顺序。多个字符串、scalar 或数组项同时非法时只报告最先项，但 audit 仍不得包含字段原值。

guard 1—4 只处理 raw command，不加载 aggregate。第 5 步内部顺序固定为：5a 动作对应的可信 context、aggregate、lineage index，以及动作 / 当前状态需要的 target / evidence 的 exact-shape、统一 string sensitive scan、类型与 grammar 契约；5a 内每个对象都按 plain object → exact keys / nested container → 每个 string value 的统一 sensitive scan → 类型 / grammar 判定，且对象间固定按 context shell（非 containment 为 MappingReadinessContext + authorization，containment 为 DisableContainmentContext）→ MappingAggregateContext → LineageLockIndex / records → target / evidence 的顺序，只报告首个失败；5b 安全布尔固定值检查，内部顺序为任一 `containsRealCustomerData` → aggregate / target 的 `autoMergePerformed` → aggregate / target 的 `realCustomerRelationshipWritten`；5c 任一 `fieldWhitelistApplied` attestation 检查；5d `sourceKind` / `dataMode` / tenant namespace cross-field；5e 非 containment 动作的 fixture registry provenance 与完整 source snapshot 绑定；5f root 与可信 context / authorization / aggregate / lineage index，以及 target 存在时的 tenant 一致性；5g 非 containment 动作的 authorized tuple 人工复核与时间一致性；5h 可信 aggregate 的 status / reason 与 target flag 真值表；5i target 存在时校验 candidate pair / evidence fingerprint、candidate digest 及 aggregate / target 绑定完整性；5j 仅对 candidate-bound action 且 5h 证明 target present 时，在当前 tenant 与 aggregate scope 内查找 raw candidate digest 并比对 target。其他 tenant 或 aggregate 的 digest 与不存在的 digest 一律返回 `candidate_target_not_found`，不得通过全局查询泄露其归属。5h 为 target absent 的 `unmatched` / `disabled` 状态不执行 5i / 5j，分别交由 step 11a / step 8 固定阻断，不能被 `candidate_target_not_found` 抢先；`disable_mapping` 没有 candidateDigest 或 action target，因此不执行 5e、5g、5i 或 5j，但仍须验证 containment context、aggregate 与 lineage index。

第 4 步对 raw / trusted boolean 只接受严格 `boolean` 类型；`true` / `false` 的契约语义不属于 scalar grammar。类型正确但 `containsRealCustomerData=true`、`autoMergePerformed=true` 或 `realCustomerRelationshipWritten=true` 的首个失败按上述 5b 内部顺序固定；类型正确但 `fieldWhitelistApplied=false` 的首个失败固定在 5c。source/mode 与 fixture provenance 同时失败时依次采用 5d、5e；后续 tenant、authorization tuple、aggregate truth table、target integrity 与 candidate lookup 不得抢先改变 event / reason。

非 containment 动作的 5h 使用第 4.4 节完整 aggregate / target 真值表。`disable_mapping` 的 5h 使用 containment 专用 aggregate-only oracle：只校验 aggregate `mappingStatus` / `reasonCode` 命中第 3.4 节唯一 pair；target-absent 状态的 `candidateDigest` 必须为 null，其他状态只校验该字段为非零合法 digest；`conflict` / `cleared_locked` 必须能通过 MappingAggregateContext 与完整 LineageLockIndex 的 mappingReference / candidateDigest / lockType 关联证明 lock 一致。containment 不要求或加载 target presence、flags、evidence 或 candidate pair；因此任一非 `disabled` 合法 aggregate 都能继续到第 9 步。

除 `disable_mapping` 外，所有动作都必须同时满足：`authorizationStatus === authorized`、`providerState === mock_only`、可信 `syncStatus === mock_ready`、`sourceKind` / `dataMode` 为受控且互相匹配的 mock/demo 组合、全部 tenant 一致，并且 audit 可安全构造。authorization 的 `not_configured`、`revoked`、`expired`、`disabled`、`external_disabled`、`manual_review_required`，provider 的 `disabled` / `external_disabled`，以及 sync 的 `not_started`、`preflight_ready`、`syncing_disabled`、`sync_failed`、`manual_review_required` 均不可执行；`preflight_ready` 不等于 mapping action ready。

当且仅当 `authorizationStatus=authorized` 时，可信 authorization tuple 还必须满足：`manualReviewState` 为 `not_required` 或 `approved`；`authorizedAtDate` 非 null 且不晚于 `occurredAt` 的 UTC 日期；`expiresAtDate` 为 null 或不早于该日期；`lastPreflightAt` 为 null 或不晚于 `occurredAt`。不一致固定在 guard 5g 以 `authorization_state_inconsistent` 阻断。非 authorized 状态不使用这些字段覆盖状态语义，统一在 guard 10a 按 authorization status 阻断。

第 10 步内部优先级固定为：10a `authorizationStatus`、10b `providerState`、10c `syncStatus`。三者同时失败时只报告最前一项；任何实现不得根据对象遍历顺序改变 reason。

`disable_mapping` 是唯一安全例外：它仍须通过第 1—7 步，但以独立 DisableContainmentContext 代替 MappingReadinessContext，并跳过 authorization、fixture provenance、provider、sync、candidate 与 conflict guard；authorization / readiness 缺失、撤销、损坏或不可用不能阻止 containment disable。它只允许可信当前状态从任一非 `disabled` 状态进入 `disabled`。已处于 `disabled` 时再次调用固定为 `mapping_already_disabled` 的非法转换。该例外仅改变本地 mock/demo mapping 状态，不查询 provider、不调用外部服务。

第 11 步的内部优先级固定为：11a 先检查第 3.3 节状态—动作 allowlist；11b 再检查 target present 状态下由 candidateDigest 已定位的可信 target 是否满足该动作条件；11c 最后检查该动作要求的 unresolved conflict guard。只有 11a 通过后才可报告 candidate guard，只有 11b 通过后才可报告 unresolved conflict，避免同一输入在 `invalid_state_transition`、`candidate_not_active` 与 `unresolved_conflict` 之间漂移。

| 动作 | 可信 target candidate 条件 |
| --- | --- |
| `approve` | 必须是当前 lineage 的 active target，未 cleared / rejected / stale / locked，`unresolvedConflictCount=0` |
| `reject` | 必须是当前 lineage 的 active target，不能 stale / cleared / locked；`manual_review_required + review_reopened` 必须先重新生成候选 |
| `request_more_info` | 必须是当前 lineage 的 active target，不能 stale / cleared / conflict-locked；`manual_review_required + review_reopened` 必须先重新生成候选 |
| `mark_conflict` | 必须是 active target，不能 already locked |
| `clear_candidate` | 必须属于当前 lineage；普通 active target 或 `conflict` 状态下的 conflict-locked target 均可，不能 stale / already cleared / rejected |
| `reopen` | 必须是 `rejected` / `matched` 的 historical/inactive target，或 `needs_more_info` 的当前 active target；均须属于当前 lineage，且不能 stale / cleared / locked；成功后仅允许 `generate_candidate` 或 `disable_mapping` |
| `expire_candidate` | 必须属于第 3.3 节允许状态的当前 active lineage，不能 stale / cleared / rejected / locked；`manual_review_required + review_reopened` 必须先重新生成候选 |
| `disable_mapping` | 不需要 candidate target，使用独立 command shape |

`conflict → clear_candidate` 因此允许引用 conflict-locked target；`rejected → reopen` 允许引用可信 historical target，但成功进入 `manual_review_required + review_reopened` 后，除 `disable_mapping` 外必须先 `generate_candidate`，不能直接 reject / clear / expire 或执行其他 candidate-bound action。historical target 只服务于 `reopen` 身份校验，不能成为后续 review 绕过路径。

## 4. strict parser / whitelist 设计

### 4.1 总体规则

- generation 与 review 的所有入口 payload 必须先经过 parser，成功产生不可变的 validated DTO 后，才能进入 domain。
- raw command、可信 context / aggregate / lineage / target / evidence、domain 派生的 `mappingReview` / `mappingDecision` / `mappingConflict` 与 audit event 中，每一个 string value 都必须先经过第 4.5 节同一个无副作用 sensitive scanner，再执行该字段的类型、exact grammar、枚举或 cross-field 校验。该规则没有字段类别例外：tenant、reference、digest、timestamp、enum、action、reviewer role 与 reason code 都必须扫描。
- raw command 中允许出现的 root / nested `tenantId`、digest、reference、`action`、`sourceKind`、`dataMode`、`occurredAt` 与 reviewer role 全部严格校验。`status` 与 `reasonCode` 只能由 domain 按固定映射生成，并在 domain gate 再次做 pair 校验；raw command 出现二者必须作为 unknown field 阻断。generation raw payload 出现 `candidateDigest` 或 `candidatePairDigest` 同样阻断。
- 字符串校验必须证明全字符串匹配，例如同时校验匹配结果长度和 `match[0] === value`；不得把 JavaScript `$` 作为唯一结尾保证。
- 标识、枚举、digest 和 timestamp 不接受前后空白，不允许 `trim()` 后继续使用原值。若未来确需规范化，必须生成独立 canonical 值，并禁止原始值进入 domain 或 audit。
- 所有入口统一拒绝 LF、CRLF、U+2028、U+2029；不允许先去除行分隔符再使用原值。
- unknown field 一律 fail-closed；禁止“忽略后继续解析”。
- whitelist 之外的 nested raw payload、原始第三方响应、未脱敏 webhook payload 和任意未知容器一律 fail-closed；第 4.4 节列出的 exact-shape nested object 不属于 raw blob。
- parser 失败只能返回固定低敏 reason code 与安全占位值，不得携带原 payload 片段。

### 4.2 分层 parser

1. **Shape parser**：输入必须是 plain object，并且字段集合与对应 whitelist 完全一致。
2. **Scalar parser**：逐字段校验类型、长度、枚举、全字符串格式和行分隔符。
3. **Nested parser**：递归校验 authorization、contact、candidate、evidence 与 customer；unknown nested field 同样阻断。
4. **Cross-field parser**：校验 tenant 一致性、data mode 一致性、status / reasonCode 对应关系、candidate active / lock 标志组合。
5. **Domain gate**：只有 validated DTO 才能调用状态机；原始 payload 不得被 domain 或 audit 工厂引用。

### 4.3 canonical snapshot 完整性

- 外部 generation payload 的 whitelist 不包含 `mappingReference`、`candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、snapshot digest、version、sequence 或用于证明先后关系的 timestamp；这些值只能由 domain/application 边界内部生成。
- 外部 review payload 可包含严格校验的 `candidateDigest`，但只作为 opaque 目标引用。application 边界必须从可信内部状态取得当前 action target candidate 并做完全相等比对，再把内部 target 写入 validated DTO；调用方提交值不得写回状态、替代内部 digest，或作为 lineage 变化证明。target eligibility 由第 3.6 节按动作判断。review payload 同样不得包含 `mappingReference`、`evidenceFingerprint`、snapshot digest、version、sequence 或 lineage timestamp。
- snapshot builder 只接收经过 strict parser 的完整受控 mock/demo source scope，并以固定字段集、固定排序与 canonical 编码构造 material evidence；调用方提供的预计算 digest 或版本一律作为 unknown field 阻断。
- 完整性校验必须证明 source scope 中的记录没有被省略。删除冲突候选、只提交局部 records、调整顺序或只改元数据不得生成新的 fingerprint。
- 新 aggregate 必须使用可信内部 lock index 对照旧冲突组合；lock index 缺失、来源不可验证或对照无法完成时 fail-closed。
- `fixtureRegistryDigest` 不是调用约定或单纯“已注册”标记。可信 registry lookup 必须以该 digest 唯一解析到一个不可变 FixtureRegistryEntry；domain 再从本次完整 `externalContacts` / `systemCustomers` 重算 `sourceSnapshotDigest`，并与 entry 完全相等。删除、添加、替换任一对象或 nested 值必须改变 digest；只重排集合不得改变 digest。格式合法但不存在的 registry digest、复用其他 entry 的 digest、entry 与 tenant / source / mode / scope 不一致，或重算值不一致，均固定以 `untrusted_fixture_provenance` 阻断。
- `mappingReference` 必须在 candidate 生成前由可信 aggregate factory 独立确定。它使用 domain separator `zmtg:05c-e1:mapping-reference:v1`，依次按第 4.6 节 canonical encoding 编码 `tenantId`、registry 提供的 `sourceScopeReference`、`aggregateVersion`、`sourceSnapshotDigest`，对完整 byte 做 SHA-256，并取前 48 个小写 hex 作为 `ref-${dataMode}-` 后缀。调用方、target 或旧 WIP 均不得提供、覆盖或事后改写该值。

### 4.4 raw command 与 nested object 精确 whitelist

字段名区分大小写；下表列出的字段全部必填，未列字段一律阻断。可为空的业务值必须显式使用契约允许的 `null` 或空数组，不能通过省略字段表达。

**Generation command** 的 raw 顶层字段集合必须完全等于：

`tenantId`、`action`、`externalContacts`、`systemCustomers`、`occurredAt`、`sourceKind`、`dataMode`、`containsRealCustomerData`。

- `action` 必须等于 `generate_candidate`。
- `sourceKind` / `dataMode` 只允许 `controlled_mock_fixture → mock` 或 `controlled_demo_fixture → demo` 两个固定组合。
- `containsRealCustomerData` 必须严格等于 `false`；该布尔值只是交叉校验项，不能替代 fixture provenance、字段扫描或 digest 校验。
- `externalContacts` 与 `systemCustomers` 均为 1—100 项；数组顺序不参与 fingerprint，builder 必须先按受控 digest 排序。
- 完整 raw command 只能由 application boundary 从注册且不可变的本地 fixture builder 取得，不允许 API、UI 或任意外部调用方提交数据对象；`sourceKind`、`dataMode` 与布尔标记都不能自行证明 provenance。

对 generation 与 candidate-bound review，application boundary 还必须独立注入可信 **MappingReadinessContext**；它不是 raw command，仍须在 domain gate 前 exact-shape 校验。字段集合完全等于：`tenantId`、`authorization`、`syncStatus`、`auditReady`、`sourceKind`、`dataMode`、`fixtureRegistryDigest`。`auditReady` 必须是严格 boolean，并在 guard 7 要求为 `true`；`fixtureRegistryDigest` 必须满足 digest grammar 且能在注册 fixture registry 中验证。raw generation / candidate-bound review command 出现 `authorization`、`mappingReadinessContext`、`syncStatus`、`auditReady` 或 `fixtureRegistryDigest` 均按 unknown field 阻断。`disable_mapping` 不加载该 context，而使用下文独立的 DisableContainmentContext。

| nested object | 精确字段集合 |
| --- | --- |
| `MappingReadinessContext.authorization` | `tenantId`、`authorizationReference`、`corpIdDigest`、`authorizationStatus`、`providerState`、`authorizedAtDate`、`expiresAtDate`、`manualReviewState`、`lastPreflightAt`、`dataMode`、`containsRealCustomerData` |
| `externalContacts[]` | `tenantId`、`externalContactReference`、`displayName`、`externalUserIdDigest`、`followUsers`、`tags`、`sourceType`、`addedAtDate`、`remarkSummary`、`sourceMappingStatus`、`lastSyncedAt`、`syncStatus`、`manualReviewState`、`dataMode`、`containsRealCustomerData`、`fieldWhitelistApplied` |
| `followUsers[]` | `tenantId`、`followUserReference`、`displayName`、`followUserIdDigest`、`ownershipStatus`、`institutionSummary`、`dataMode`、`containsRealCustomerData` |
| `tags[]` | `tenantId`、`tagReference`、`tagIdDigest`、`tagName`、`sourceType`、`tagStatus`、`dataMode`、`containsRealCustomerData` |
| `systemCustomers[]` | `tenantId`、`customerReference`、`mockCustomerNumber`、`displayNameSummary`、`remarkSummary`、`tagNames`、`sourceType`、`addedAtDate`、`ownerSummary`、`customerDigest`、`statusSummary`、`dataMode`、`containsRealCustomerData`、`fieldWhitelistApplied` |

`followUsers` 限 0—20 项，`tags` 与 `tagNames` 限 0—50 项。MappingReadinessContext、authorization 与所有 source nested object 的 `tenantId` / `dataMode` 必须先独立解析，再与 raw root 完全相等；readiness 的 `sourceKind` 也必须与 raw root 完全相等。所有 `containsRealCustomerData` 必须为 `false`，所有 `fieldWhitelistApplied` 必须为 `true`。这些标记均不能替代内容扫描，任何标记与实际内容不一致都 fail-closed。

`authorizedAtDate`、`expiresAtDate`、`lastPreflightAt` 与 `lastSyncedAt` 是仅有允许 `null` 的 scalar；其他 scalar 均不得为 `null`。空数组仅允许用于 `followUsers`、`tags` 与 `tagNames`。

授权与枚举固定为：

- `authorizationStatus`：`not_configured` / `authorized` / `revoked` / `expired` / `disabled` / `external_disabled` / `manual_review_required`；
- `providerState`：`mock_only` / `disabled` / `external_disabled`；
- `manualReviewState`：`not_required` / `pending` / `approved` / `rejected` / `needs_more_info`；
- `sourceMappingStatus`：`unmatched` / `candidate` / `matched` / `conflict` / `rejected` / `manual_review_required`，仅表示 05C-B readonly source 状态；
- aggregate `mappingStatus`：本文件第 3.1 节十态枚举，只出现在可信 05C-E1 MappingAggregateContext；
- `syncStatus`：`not_started` / `mock_ready` / `preflight_ready` / `syncing_disabled` / `sync_failed` / `manual_review_required`；
- `ownershipStatus`、`tagStatus`：`active` / `inactive`；
- contact 与 customer `sourceType`：`qr_code` / `employee_share` / `group_chat` / `other_mock`；tag `sourceType`：`mock_enterprise` / `demo_enterprise`；fixture provenance 只使用 root `sourceKind`，不得塞入业务 `sourceType`；
- `statusSummary`：`active` / `inactive` / `manual_review_required`。

`sourceMappingStatus` 是 application boundary 对既有 05C-B readonly contact `mappingStatus` 的显式别名映射，不要求修改原对象；MappingReadinessContext 的 `syncStatus` 来自权威 snapshot/readiness 状态，不向既有 `WeComTenantAuthorization` 增加字段。contact 自身的 `syncStatus` 只是 source record 字段，不能覆盖 readiness guard。05C-E1 aggregate 的十态 `mappingStatus` 也不能反向覆盖 source contact。

`providerState=mock_only` 与 `syncStatus=mock_ready` 是两个独立 guard：前者约束 provider 类型，后者约束本地 fixture readiness。`mock_ready` 同时覆盖上文两个受控 mock/demo fixture 组合；它不表示真实 provider 可调用，也不授权任何外联。

**Candidate-bound review command** 的顶层字段集合必须完全等于：

`tenantId`、`candidateDigest`、`action`、`reviewerRole`、`occurredAt`。

- `action` 只允许 `approve`、`reject`、`request_more_info`、`mark_conflict`、`clear_candidate`、`reopen`、`expire_candidate`；
- `reviewerRole` 只允许 `institution_operator` 或 `platform_governance`；
- candidate-bound review 所需的 MappingReadinessContext、action target candidate、aggregate 与 lineage locks 只能由 application boundary 从可信 mock/demo 状态注入，review 调用方不得声明；`disable_mapping` 改用独立 containment context；
- review raw command 出现 `candidate`、`evidence`、`authorization`、`mappingReadinessContext`、`mappingReference`、`candidatePairDigest`、`evidenceFingerprint`、`candidateVersion`、`snapshotDigest`、`snapshotVersion`、`snapshotSequence`、`lineageTimestamp`、`sourceKind`、`dataMode`、`syncStatus`、`fixtureRegistryDigest`、`status`、`reasonCode`、`auditReady`、`mappingReview`、`mappingDecision`、`mappingConflict` 中任一字段，均按 unknown field 阻断。后三者是 domain-only output，调用方不得注入或覆盖。

**Disable command** 使用独立的 exact shape，字段集合必须完全等于 `tenantId`、`action`、`reviewerRole`、`occurredAt`，且 `action` 只能等于 `disable_mapping`。它不接受 `candidateDigest`；若提交该字段同样按 unknown field 阻断。application boundary 必须注入独立的 **DisableContainmentContext**，字段集合完全等于 `tenantId`、`aggregate`、`lineageLockIndex`、`auditReady`。`auditReady` 在 5a 只校验严格 boolean 类型，并在 guard 7 要求为 `true`；`false` 固定映射为 `mapping_audit_not_ready_blocked / audit_not_ready`。该 context 不包含 authorization、provider、sync、fixture registry entry 或 action target，且不依赖 MappingReadinessContext 是否存在或有效。raw command 不得提交 DisableContainmentContext 中任一派生对象。

非 containment 动作与 DisableContainmentContext 共用同一份可信 **MappingAggregateContext**，其 exact shape 固定为：

`tenantId`、`sourceScopeReference`、`mappingReference`、`aggregateVersion`、`mappingStatus`、`reasonCode`、`candidateDigest`、`sourceSnapshotDigest`、`fixtureRegistryDigest`、`lineageLockIndexDigest`、`sourceKind`、`dataMode`、`containsRealCustomerData`、`autoMergePerformed`、`realCustomerRelationshipWritten`、`updatedAt`。

- `aggregateVersion` 为 1—2,147,483,647 的整数；`candidateDigest` 仅在真值表 target absent 行允许 `null`，其余状态必须是 target 的完全相等 digest；其他 digest 均不得为 null；
- `mappingStatus` / `reasonCode` 只存放在 aggregate，不存放在 target；无 target 的 `unmatched` / `disabled` 也因此具有唯一可信状态载体；
- `mappingReference` 必须先按第 4.3 节从 aggregate factory 产生，再用于第 4.6 节 candidate digest；`sourceScopeReference` 必须与 registry entry 完全相等；
- `lineageLockIndexDigest` 必须与下述 LineageLockIndex 的 `indexDigest` 完全相等；`updatedAt` 使用第 6 节 canonical timestamp；三个安全布尔均必须严格为 `false`。

可信 **FixtureRegistryEntry** 的 exact shape 固定为：`tenantId`、`fixtureRegistryDigest`、`sourceScopeReference`、`sourceKind`、`dataMode`、`externalContactsDigest`、`systemCustomersDigest`、`sourceSnapshotDigest`。它只存在于注册且不可变的本地 mock/demo fixture registry，不接受 raw command 创建或修改；同一 registry lookup 必须同时返回该 entry 与完整 canonical fixture records。lookup 后必须从这些完整 records 重算三个 source digest，并与 entry、MappingReadinessContext、aggregate 的对应值交叉绑定。

可信 **LineageLockRecord** 的 exact shape 固定为：`tenantId`、`sourceScopeReference`、`mappingReference`、`candidateDigest`、`externalContactDigest`、`systemCustomerDigest`、`candidatePairDigest`、`evidenceFingerprint`、`sourceSnapshotDigest`、`lockType`、`unresolvedConflictCount`、`createdAt`、`sourceKind`、`dataMode`。`lockType` 只允许 `conflict` / `clearance`；count 为 0—100 的整数，`conflict` 必须为 1—100，`clearance` 保留来源 count；所有 digest / reference / timestamp 分别通过第 4.5、5、6 节规则。record 的 candidatePairDigest 必须由同一 record 的 tenant、source scope 与两个 source digest 重算，不能由 candidateDigest 或 sourceSnapshotDigest 代替。

可信 **LineageLockIndex** 的 exact shape 固定为：`tenantId`、`sourceScopeReference`、`indexVersion`、`indexDigest`、`complete`、`records`、`sourceKind`、`dataMode`。`indexVersion` 为 1—2,147,483,647 的整数，`complete` 必须严格等于 `true`，`records` 为 0—1000 个 exact-shape LineageLockRecord。records 按 `candidatePairDigest`、`evidenceFingerprint`、`mappingReference`、`candidateDigest` 的 UTF-8 byte tuple 升序；重复 `{candidatePairDigest, evidenceFingerprint}` 对照键阻断，不能用新 aggregate 的 reference/version 制造第二条等价 lock。以 domain separator `zmtg:05c-e1:lineage-index:v1` 对 tenant、source scope、version 及排序后的完整 records 做第 4.6 节 canonical encoding 并重算 `indexDigest`。index 必须覆盖该 source scope 的全部既有 lock；缺项、多项、摘要不一致、`complete=false` 或 aggregate/index digest 不一致均 fail-closed。

aggregate、registry entry、lineage index、每个 lock record 与 target（存在时）对各自实际持有的 tenant、source scope、mapping reference、source kind、data mode、snapshot / candidate / evidence digest 必须逐项交叉绑定；没有直接字段的对象必须经 aggregate / registry 关联验证，不能补入调用方自报值。locked target 必须在完整 index 中有唯一对应 record；未 locked target 不得伪造当前 lineage 的 lock record。任何不一致在 action guard 前按第 7.2 节唯一映射阻断。

可信 action target candidate 不是 raw review command。application boundary 注入后仍须 exact-shape 校验，其字段集合固定为：

`tenantId`、`mappingReference`、`candidateVersion`、`candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、`externalContactDigest`、`systemCustomerDigest`、`mockCustomerNumber`、`systemCustomerSummary`、`candidateSourceStatus`、`evidence`、`confidenceScore`、`confidenceLevel`、`candidateActive`、`candidateCleared`、`candidateRejected`、`candidateStale`、`lineageLocked`、`unresolvedConflictCount`、`createdAt`、`sourceKind`、`dataMode`、`containsRealCustomerData`、`autoMergePerformed`、`realCustomerRelationshipWritten`。

其中内部 `evidence` 的字段集合完全等于：`displayNameSimilarity`、`remarkSummaryMatched`、`tagNames`、`sourceTypeMatched`、`addedAtDateMatched`、`ownerSummaryMatched`、`digestMatched`、`mockCustomerNumberMatched`、`systemCustomerSummaryMatched`。`containsRealCustomerData`、`autoMergePerformed`、`realCustomerRelationshipWritten` 必须为 `false`；review 的 `candidateDigest` 只用于查找并比对该可信对象，不能覆盖其任何字段。

`sourceTypeMatched` 只比较 external contact 与 system customer 的同名业务 `sourceType` 枚举；root `sourceKind` 仅表示 fixture provenance，不参与该 boolean 的相等判断。

三个 domain-only output object 都必须由封闭 factory 在 mutation commit 前生成。它们不是 raw command，也不接受任意扩展字段；每个字段全部必填且不允许 `null`。factory 固定执行 plain object → exact allowed keys → 所有 string value 统一 sensitive scan → 类型 / grammar / enum → cross-field 绑定。缺键、多键、unknown / nested raw container、任一字符串扫描或绑定失败时不得返回部分对象，不得提交状态变更，并按第 7.2 节 fail-closed。

| domain output object | exact allowed keys |
| --- | --- |
| `mappingReview` | `tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`mappingStatusBefore`、`occurredAt`、`sourceKind`、`dataMode` |
| `mappingDecision` | `tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`mappingStatusBefore`、`mappingStatusAfter`、`reasonCode`、`occurredAt`、`sourceKind`、`dataMode` |
| `mappingConflict` | `tenantId`、`mappingReference`、`candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、`conflictType`、`conflictStatus`、`unresolvedConflictCount`、`manualReviewRequired`、`createdAt`、`sourceKind`、`dataMode` |

- `mappingReview` 与 `mappingDecision` 只在七个 candidate-bound action 成功且 mutation audit preflight 通过后成对产生；`generate_candidate` 与 `disable_mapping` 不产生这两个对象。两者的 `tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`mappingStatusBefore`、`occurredAt`、`sourceKind`、`dataMode` 必须逐项完全相等，并与已通过 5i 的可信 target、当前 aggregate 和 validated command 绑定。
- `mappingDecision.mappingStatusAfter` / `reasonCode` 必须命中第 3.4 节及对应 action 的唯一转换；阻断路径不产生 `mappingReview` 或 `mappingDecision`，不能把 fail-closed audit 当作 decision。
- `mappingConflict` 只投影 conflict-origin lineage，是只读摘要而不是解锁命令；普通 candidate 的 `clear_candidate` 会创建 clearance lock，但不产生 `mappingConflict`。`conflictType` 只允许 `multiple_system_customers_for_external_contact`、`multiple_external_contacts_for_system_customer`、`evidence_inconsistent`、`manual_marked`；`conflictStatus` 只允许 `unresolved_locked` / `cleared_locked`。前者必须对应 aggregate `conflict / mapping_conflict`、唯一 `lockType=conflict` record、locked active target、`unresolvedConflictCount=1—100` 与 `manualReviewRequired=true`；后者只表示该 conflict-origin lineage 已执行 clear，必须对应 `cleared_locked / candidate_cleared_locked`、仍保留的同一原始 conflict record、cleared inactive locked target、保留原 conflict count 与 `manualReviewRequired=false`。conflict-origin clear 不创建第二条 clearance record，避免重复 `{candidatePairDigest, evidenceFingerprint}` 对照键。
- `mappingConflict` 的三个 digest 必须逐项绑定同一可信 target 和原始 `lockType=conflict` record，`createdAt` 始终等于该 conflict record 的 canonical timestamp；`cleared_locked` 由 aggregate、target 与成功 audit / history 证明 clear 已发生，不改变或替代原 conflict record。多个冲突使用多个单-lineage 投影，不得用可变数组合并身份，也不得借该投影删除、替换或解除永久 lock。

内部 candidate scalar 规则固定为：`candidateVersion` 是 1—2,147,483,647 的整数；`candidateSourceStatus` 只允许 `active` / `inactive` / `stale` / `cleared` / `rejected` / `conflict_locked`；`unresolvedConflictCount` 是 0—100 的整数；所有 `*Matched` 字段与 candidate flag 都是严格 boolean；`displayNameSimilarity` 是 0—100 的整数；`tagNames` 仍受 0—50 项与逐项敏感扫描约束。aggregate 的 `mappingStatus` / `reasonCode` 必须命中第 3.4 节唯一 pair，并与 target presence / flags 命中下表唯一行。

aggregate 状态、reason 与 target candidate flags 只允许下表组合；`—` 表示运行时 target 不存在，历史 candidate 只保留在不可变 audit/history 中：

| `mappingStatus` / `reasonCode` | target | `candidateSourceStatus` | active | cleared | rejected | stale | locked | unresolved count |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `unmatched` / `not_generated` | absent | — | — | — | — | — | — | — |
| `candidate` / `candidate_evidence_available` | present | `active` | true | false | false | false | false | 0 |
| `manual_review_required` / `low_confidence` | present | `active` | true | false | false | false | false | 0 |
| `manual_review_required` / `review_reopened` | present historical | `inactive` | false | false | false | false | false | 0 |
| `conflict` / `mapping_conflict` | present | `conflict_locked` | true | false | false | false | true | 1—100 |
| `matched` / `approved_by_manual_review` | present historical | `inactive` | false | false | false | false | false | 0 |
| `rejected` / `rejected_by_manual_review` | present historical | `rejected` | false | false | true | false | false | 0 |
| `needs_more_info` / `more_info_requested` | present | `active` | true | false | false | false | false | 0 |
| `stale` / `candidate_expired` | present historical | `stale` | false | false | false | true | false | 0 |
| `disabled` / `mapping_disabled` | absent | — | — | — | — | — | — | — |
| `cleared_locked` / `candidate_cleared_locked` | present historical | `cleared` | false | true | false | false | true | 0—100（保留原 unresolved count） |

任何其他组合、互斥 flag 同时为 true、count 与 lock 不一致、target presence 与状态不一致，均固定为 `mapping_input_blocked / status_reason_mismatch`，不得进入第 3.6 节 action guard。

### 4.5 scalar grammar 与全字符串敏感值扫描

- sensitive scanner 是所有 string value 的第一道内容校验。raw command 按第 3.6 节 guard 1d 扫描；每个可信对象和 domain output 按其 exact allowed keys 的书写顺序递归扫描，数组按 index 升序。digest、timestamp、enum、reference、tenant、action、reviewer role、reason code 与人类可读字段都没有豁免，扫描通过后才执行各自 exact grammar / enum / cross-field 校验。
- digest 统一为 `sha256:` 加 64 个小写十六进制字符，总长度 71；大写、空白、行分隔符和长度偏差均阻断。全零 digest 仅可作 fail-closed audit 占位，raw command 禁止提交。
- reference 统一为 `ref-(mock|demo)-` 加 3—48 个小写字母、数字或单连字符；首尾必须为字母或数字，不允许连续连字符，并以完整匹配长度校验。reference 后缀还必须执行与 human-readable 字段相同的敏感值扫描，不能把结构匹配当作低敏证明。
- `YYYY-MM-DD` 字段必须是 canonical 真实日期；timestamp 字段遵守第 6 节。
- `confidenceScore` 仅允许 0—100 的有限整数；`confidenceLevel` 固定对应 `low=0—49`、`medium=50—79`、`high=80—100`。
- human-readable 字符串长度固定：名称与摘要 1—160 个 Unicode code point，`mockCustomerNumber` 3—32 个 ASCII 字符；空白-only、NUL、控制字符或行分隔符全部阻断。

对任一对象中的每一个字符串逐项扫描，不能只扫描 root、人类可读字段或拼接后的摘要；`displayName`、`remarkSummary`、`institutionSummary`、`tagName`、`tagNames[]`、`mockCustomerNumber`、`displayNameSummary`、`ownerSummary`、`systemCustomerSummary` 只是其中一部分。scanner 对独立扫描副本执行 Unicode NFKC 与大小写折叠，但不得把规范化结果当作修正后的业务值继续使用；命中即阻断原值。

扫描必须覆盖：手机号、身份证号、邮箱、原始 `wm_` / `wo_` 标识；原始外部联系人或员工标识键及其 camelCase / snake_case 赋值变体；凭证类字段或值形态；`rawResponse`、`webhookPayload`、`apiResponse`、序列化 raw object / array、URL query 中的敏感键；聊天内容、会话内容与会话存档标记。结构合法但包含这些内容的值仍 fail-closed。

scanner 必须检查完整字符串，包括 LF、CRLF、U+2028 或 U+2029 之后的全部内容，不能遇到行分隔符就提前结束。若分隔符后的内容命中 phone、secret / credential 或原始 externalUserId 等模式，首个结果固定为 `sensitive_value_blocked`；若只存在行分隔符而未命中敏感模式，才由后续 tenant、timestamp、digest 或其他字段 grammar 返回其固定非法值 reason。

命中只返回布尔结果与固定 reason code `sensitive_value_blocked`；audit、错误与返回值不得包含命中片段、原始字符串或自由文本诊断。digest、timestamp、enum、reference 及其他字符串均先运行该 scanner，再运行各自 exact grammar；禁止因字符串“看起来像 digest / timestamp / enum”而跳过扫描。所有类别仍须拒绝 unknown key/value 与全部行分隔符。

`candidateDigest` 的确定算法见第 4.6 节。review 只接受格式合法、非全零且与当前动作的可信 target candidate 完全相等的 digest；格式正确但不存在、跨 tenant / aggregate，或 target 不满足第 3.6 节 action-specific 条件时 fail-closed。

### 4.6 evidence fingerprint 与 candidate digest 确定算法

所有字符串先通过 parser，但 hash preimage 使用 parser 输出的原始 validated value，不执行 trim 或业务值重写。基础编码函数 `LP(v)` 固定为：先把 `v` 编码为 UTF-8 byte，再写入 4-byte unsigned big-endian byte length，随后写入该 byte 序列。typed canonical encoding `CE(v)` 固定为：string=`LP("s") || LP(v)`，integer=`LP("i") || LP(无前导零十进制 ASCII)`，boolean=`LP("b") || LP("true"|"false")`，null=`LP("null")`，array=`LP("a") || LP(元素数) || CE(各元素)`，object=`LP("o") || LP(字段数) || [LP(字段名) || CE(字段值)]`。object 字段严格按契约列出的顺序，字段之间不使用可歧义分隔符；浮点数、undefined 与未定义类型没有 canonical encoding，必须在 parser 阶段阻断。

完整 source scope 的 digest 固定如下：

1. `followUsers` 先按 `followUserIdDigest`、`followUserReference` 的 UTF-8 byte tuple 排序；`tags` 先按 `tagIdDigest`、`tagReference` 排序；重复身份 digest 阻断；
2. `externalContacts` 先按 `externalUserIdDigest`、`externalContactReference` 排序，按第 4.4 节字段顺序组成完整 array 并做 `CE(array)`，使用 domain separator `zmtg:05c-e1:external-contacts:v1` 得到 `externalContactsDigest`；
3. `systemCustomers[].tagNames` 禁止重复并按 UTF-8 byte 排序；`systemCustomers` 再按 `customerDigest`、`customerReference` 排序，按第 4.4 节字段顺序组成完整 array 并做 `CE(array)`，使用 domain separator `zmtg:05c-e1:system-customers:v1` 得到 `systemCustomersDigest`；
4. 使用 domain separator `zmtg:05c-e1:source-snapshot:v1`，依次 `CE` 编码 `tenantId`、`sourceKind`、`dataMode`、`externalContactsDigest`、`systemCustomersDigest`，得到 `sourceSnapshotDigest`；
5. FixtureRegistryEntry 的 `fixtureRegistryDigest` 使用 domain separator `zmtg:05c-e1:fixture-registry:v1`，依次 `CE` 编码 `tenantId`、`sourceScopeReference`、`sourceKind`、`dataMode`、上述三个 source digest 并重算。只有 entry 自身 digest、lookup key 与本次 source 重算结果全部相等，provenance 才成立。

上述每个 hash 都对 domain separator 的 `LP` byte 与随后 `CE` byte 的完整拼接做 SHA-256，输出 `sha256:` 加 64 位小写 hex。集合顺序变化不会改变结果；对象增删替换、nested 值改变、重复身份或 registry digest 复用均不能通过。

`candidatePairDigest` 的 domain separator 固定为 `zmtg:05c-e1:candidate-pair:v1`，preimage 字段按以下顺序且不得增删：`tenantId`、`sourceScopeReference`、`externalContactDigest`、`systemCustomerDigest`。domain separator 使用 `LP`，其余字段使用 `CE`；对完整 byte 做 SHA-256 并输出 `sha256:` 加 64 位小写 hex。该 digest 专门作为跨 aggregate 稳定候选对身份，不得包含或替换为 aggregateVersion、candidateVersion、mappingReference、timestamp、sourceSnapshotDigest 或 evidenceFingerprint。

`evidenceFingerprint` 的 domain separator 固定为 `zmtg:05c-e1:evidence:v1`，preimage 字段按以下顺序且不得增删：

1. domain separator；
2. `displayNameSimilarity`；
3. `remarkSummaryMatched`；
4. `tagNames`：先去重，再按 UTF-8 byte 升序排序，并按 `CE(array)` 编码；
5. `sourceTypeMatched`；
6. `addedAtDateMatched`；
7. `ownerSummaryMatched`；
8. `digestMatched`；
9. `mockCustomerNumberMatched`；
10. `systemCustomerSummaryMatched`。

domain separator 使用 `LP`，其余字段按上文 `CE` 编码；对完整 preimage byte 做 SHA-256，输出 `sha256:` 加 64 位小写 hex，得到 `evidenceFingerprint`。

`candidateDigest` 的 domain separator 固定为 `zmtg:05c-e1:candidate:v1`，preimage 字段按以下顺序且不得增删：domain separator、`candidateVersion`、`tenantId`、`mappingReference`、`externalContactDigest`、`systemCustomerDigest`、`evidenceFingerprint`、`sourceKind`、`dataMode`。domain separator 使用 `LP`，其余字段使用 `CE`，对完整 byte 做 SHA-256，并输出 `sha256:` 加 64 位小写 hex。

`candidateVersion` 必须在 hash 前由 domain 内部确定；同一 aggregate 首个 candidate 为 1，后续合格新 lineage 严格加 1，不接受调用方提供。禁止截取、拼接 source digest 或复用未经本算法生成的旧 candidate digest；算法版本变化必须使用新的 domain separator 并先更新本契约。

每次 review 在 action guard 前都必须从 aggregate 的稳定 source scope 与 target 两个 source digest 重算 `candidatePairDigest`，从可信 target evidence 重算 `evidenceFingerprint`，再以 aggregate 已确定的 `mappingReference` 重算 `candidateDigest`；三个结果必须分别与 target、aggregate 及适用的 lock record 完全相等，且 target 的两个 source digest 必须唯一命中本 aggregate 的完整 source snapshot。保留旧 digest 但篡改任一 evidence、tenant、source scope、version、mapping reference、source digest、source kind 或 data mode，固定在 guard 5i 以 `trusted_target_integrity_invalid` 阻断。

## 5. tenantId 规则

`tenantId` 始终视为 untrusted input。唯一 grammar 为：

```text
tenantId = "tenant-" data-mode "-" suffix
data-mode = "mock" / "demo"
suffix = 3—32 个小写 ASCII 字母、数字或单连字符
```

suffix 首尾必须是字母或数字，禁止连续连字符。等价 matcher 为 `/^tenant-(?:mock|demo)-[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,30}[a-z0-9]$/u`，但不得只依赖 `$`；还必须断言匹配结果长度与 `match[0] === value`。总长度固定为 15—44 个 ASCII byte。允许示例为 `tenant-mock-001`、`tenant-demo-001`。

规则如下：

- root 与所有 nested `tenantId` 必须先通过第 4.5 节统一 sensitive scanner，再独立执行 ASCII、长度与 tenant grammar parser；通过后再比较是否完全相等。
- `tenant-mock-*` 必须对应 `dataMode=mock` 与 `sourceKind=controlled_mock_fixture`；`tenant-demo-*` 必须对应 `dataMode=demo` 与 `sourceKind=controlled_demo_fixture`。
- external review command 只能提交 root `tenantId`；authorization、action target candidate 与 aggregate tenant 由可信内部状态注入，各自独立解析后再与 root 完全相等比较。
- 非法 root `tenantId` 不得进入返回 payload 或 audit，统一使用固定低敏占位，例如 `tenant_blocked`。
- tenant mismatch audit 不回显 root、authorization、candidate、contact、customer 或其他 nested `tenantId` 原文。
- fail-closed 只能使用固定 reason code，例如 `unsafe_tenant_id_blocked` 或 `tenant_mismatch`。
- 不记录原值片段，不通过字符串拼接构造错误信息，不将原值写入日志。
- 禁止 `trim()`、Unicode normalize 或其他“修正后接受”；结构合法的 tenant 仍须执行第 4.5 节整值敏感内容扫描。

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

边界测试必须覆盖 suffix 长度 3 / 32 的接受值，以及长度 2 / 33、总长度 14 / 45、大小写、首尾或连续连字符、下划线、点、斜杠、空白、NUL、非 ASCII 和全部行分隔符的拒绝值；结构匹配但含敏感内容、tenant mode 与 `dataMode` / `sourceKind` 不一致时同样拒绝。

## 6. occurredAt 规则

`occurredAt` 始终视为 untrusted input，只允许 canonical UTC ISO：`YYYY-MM-DDTHH:mm:ss.SSSZ`。

- 必须先通过第 4.5 节统一 sensitive scanner，再进行 ASCII、固定长度、全字符串格式和真实日历日期校验。
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
- `reviewerRole`：`institution_operator` / `platform_governance`，或 parser 前失败专用的 audit sentinel `domain_system`；
- `action`：第 3.2 节动作枚举，或无法可信识别动作时专用的 audit sentinel `input_blocked`；
- `reasonCode`：固定枚举；
- `mappingStatusBefore` / `mappingStatusAfter`：第 3.1 节状态枚举；parser 前无法取得可信 aggregate 时只能使用 audit sentinel `not_evaluated`；
- `candidateDigest`：已验证 digest，或固定 `sha256:` 加 64 个 `0` 的 audit-only 零值 digest；
- `timestamp`：已验证 canonical UTC ISO 或固定安全 timestamp；
- `sourceKind`：`controlled_mock_fixture` / `controlled_demo_fixture`，或 parser 前失败专用的 `input_blocked`；
- `dataMode`：`mock` / `demo`，或 parser 前失败专用的 `input_blocked`。

audit 禁止包含 root 原文、原始 payload、原始第三方响应、敏感字段值、自由文本错误信息或任意 unknown field。audit factory 必须先按固定字段顺序对每一个 string value 运行第 4.5 节同一个 scanner，再执行字段 enum / grammar；通过后还要对完整 event stringify 做整体敏感内容扫描作为 defense in depth。normal mutation event 任一步失败都不得提交 mutation，而应进入 compile-time-safe blocked constructor；blocked constructor 自检失败则按第 7.2 节停止 domain 初始化。

audit `candidateDigest` 的来源按路径固定，不得因为 aggregate、lineage record 或 raw command 中碰巧存在格式合法 digest 而改变：

| 路径 / 判定阶段 | audit `candidateDigest` |
| --- | --- |
| guard 1—4、5a—5h，或 5i target integrity 校验自身失败 | audit-only 零值 digest |
| candidate-bound review 已通过 5i 且 target 唯一可信；包括后续 5j、step 6—11 的成功或阻断 | 只使用该可信 target 的 `candidateDigest`；若当前合法状态无 target，则仍用零值 |
| generation 在新 candidate 产生前的任何阻断 | 零值 digest |
| generation 成功生成 `candidate` / `manual_review_required` / `conflict` | 只使用新 aggregate 当前 target 的 domain-generated `candidateDigest` |
| `disable_mapping` 的所有成功或阻断 | 固定零值 digest；不得从 aggregate 或 lineage index 取值 |
| blocked audit constructor 无可信 target 的其他路径 | 固定零值 digest |

raw `candidateDigest` 永不进入 audit。5i 之前，即使 MappingAggregateContext 或 LineageLockRecord 的 digest 已通过 grammar，也没有通过完整 target identity / integrity 证明，必须使用零值；5i 之后也只能使用本次 action 的唯一可信 target，不得改用其他 historical record。

### 7.2 事件与 reason code

事件类型固定为以下封闭枚举，未经契约更新不得扩展：

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
- `mapping_input_blocked`
- `mapping_tenant_mismatch_blocked`
- `mapping_invalid_transition_blocked`
- `mapping_candidate_guard_blocked`
- `mapping_audit_not_ready_blocked`
- `forbidden_field_blocked`
- `mapping_provider_disabled`
- `unsafe_tenant_id_blocked`
- `unsafe_occurred_at_blocked`

`reasonCode` 必须来自固定枚举，并与事件类型、状态前后值保持一致。禁止把异常消息、parser 原值或自由文本作为 reason code。所有 fail-closed 分支至少生成一个低敏 audit event；即使输入无法解析，也只能使用安全占位值。

动作与成功事件映射固定如下；目标状态与 reason 必须同时命中第 3.4 节固定 pair：

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

fail-closed 映射固定如下；不得由实现自行选择事件或 reason。表格排版顺序不覆盖第 3.6 节 guard / 子步骤优先级；同一命令命中多行时只采用该优先级下的首行语义：

| 首个失败场景 | `eventType` | `reasonCode` | `mappingStatusBefore → mappingStatusAfter` |
| --- | --- | --- | --- |
| 非 plain object、缺少必填键或错误容器类型 | `mapping_input_blocked` | `invalid_payload_shape` | `not_evaluated → not_evaluated` |
| 非法 scalar / enum / action | `mapping_input_blocked` | `invalid_scalar_value` / `invalid_enum_value` / `invalid_action` | `not_evaluated → not_evaluated` |
| 可信 MappingReadinessContext / authorization exact-shape 或 scalar 契约失败 | `mapping_input_blocked` | `trusted_readiness_contract_invalid` | `not_evaluated → not_evaluated` |
| 可信 DisableContainmentContext shell exact-shape / scalar 契约失败 | `mapping_input_blocked` | `trusted_disable_context_invalid` | `not_evaluated → not_evaluated` |
| 可信 MappingAggregateContext exact-shape / scalar 契约失败 | `mapping_input_blocked` | `trusted_aggregate_contract_invalid` | `not_evaluated → not_evaluated` |
| 可信 action target / evidence exact-shape / scalar 契约失败 | `mapping_input_blocked` | `trusted_target_contract_invalid` | 可信当前状态保持不变 |
| `mappingReview` / `mappingDecision` / `mappingConflict` 的 exact-shape、wrong type、grammar、enum 或 cross-field 契约失败（不含 string scanner 命中） | `mapping_input_blocked` | `derived_output_contract_invalid` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| 可信内部 `status` / `reasonCode` pair 不一致 | `mapping_input_blocked` | `status_reason_mismatch` | 可信当前状态保持不变 |
| 重算 candidate pair / evidence fingerprint / candidate digest 不一致，或 aggregate / target / lock digest 绑定不一致 | `mapping_input_blocked` | `trusted_target_integrity_invalid` | 可信当前状态保持不变 |
| `sourceKind` / `dataMode` / tenant namespace 组合不一致 | `mapping_input_blocked` | `source_mode_mismatch` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| 任一 `containsRealCustomerData` 不为 false | `forbidden_field_blocked` | `real_data_indicator_blocked` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| aggregate / target 的 `autoMergePerformed` 或 `realCustomerRelationshipWritten` 不为 false | `forbidden_field_blocked` | `prohibited_side_effect_indicator_blocked` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| 任一 `fieldWhitelistApplied` 不为 true | `mapping_input_blocked` | `whitelist_attestation_failed` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| fixture registry provenance 无法验证，或本次完整 source snapshot 重算值与 entry 不一致 | `mapping_input_blocked` | `untrusted_fixture_provenance` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| authorized tuple 的人工复核或时间字段不一致 | `mapping_input_blocked` | `authorization_state_inconsistent` | 可信当前状态保持不变；generation 为 `unmatched → unmatched` |
| raw command 出现 unknown field | `forbidden_field_blocked` | `unknown_field_blocked` | `not_evaluated → not_evaluated` |
| raw command 出现 forbidden field | `forbidden_field_blocked` | `forbidden_field_blocked` | `not_evaluated → not_evaluated` |
| raw command 的 allowed key 承载 nested raw object / array / container | `forbidden_field_blocked` | `nested_raw_payload_blocked` | `not_evaluated → not_evaluated` |
| raw command 任一 string value 命中统一 sensitive scanner | `forbidden_field_blocked` | `sensitive_value_blocked` | `not_evaluated → not_evaluated` |
| 可信 context / aggregate / target 或 domain output 任一 string value 命中统一 sensitive scanner | `forbidden_field_blocked` | `sensitive_value_blocked` | aggregate 尚未验证时 `not_evaluated → not_evaluated`；验证后保持可信当前状态；generation 为 `unmatched → unmatched` |
| 非法 root / nested tenant | `unsafe_tenant_id_blocked` | `unsafe_tenant_id_blocked` | `not_evaluated → not_evaluated` |
| tenant mismatch | `mapping_tenant_mismatch_blocked` | `tenant_mismatch` | 可信当前状态保持不变 |
| 非法 `occurredAt` | `unsafe_occurred_at_blocked` | `unsafe_occurred_at_blocked` | `not_evaluated → not_evaluated` |
| LineageLockIndex / record exact-shape、完整性、index digest 或 aggregate 绑定失败 | `mapping_locked_candidate_reuse_blocked` | `lineage_index_invalid` | 可信当前状态保持不变 |
| lineage 复用、遗漏旧冲突、partial snapshot 或仅元数据变化 | `mapping_locked_candidate_reuse_blocked` | `locked_candidate_reuse_blocked` | 可信当前状态保持不变 |
| 非法状态—动作组合 | `mapping_invalid_transition_blocked` | `invalid_state_transition` | 可信当前状态保持不变 |
| 已为 `disabled` 时再次 `disable_mapping` | `mapping_invalid_transition_blocked` | `mapping_already_disabled` | `disabled → disabled` |
| action 要求 active 但 target 缺失 / inactive | `mapping_candidate_guard_blocked` | `active_candidate_required` / `candidate_not_active` | 可信当前状态保持不变 |
| candidate digest 不存在或不匹配可信 target | `mapping_candidate_guard_blocked` | `candidate_target_not_found` / `candidate_digest_mismatch` | 可信当前状态保持不变 |
| target 不满足 action-specific 条件 | `mapping_candidate_guard_blocked` | `candidate_target_ineligible` | 可信当前状态保持不变 |
| unresolved conflict | `mapping_candidate_guard_blocked` | `unresolved_conflict` | 可信当前状态保持不变 |
| mutation audit preflight context 不完整或 mutation event 校验失败 | `mapping_audit_not_ready_blocked` | `audit_not_ready` | 可信当前状态保持不变 |

authorization / provider / sync 不可用时统一使用 `mapping_provider_disabled`，状态到 reason 的映射固定如下：

| 可信 guard 状态 | `reasonCode` |
| --- | --- |
| `authorizationStatus=not_configured` | `authorization_not_configured` |
| `authorizationStatus=revoked` | `authorization_revoked` |
| `authorizationStatus=expired` | `authorization_expired` |
| `authorizationStatus=disabled` | `authorization_disabled` |
| `authorizationStatus=external_disabled` | `external_provider_disabled` |
| `authorizationStatus=manual_review_required` | `authorization_manual_review_required` |
| `providerState=disabled` | `provider_disabled` |
| `providerState=external_disabled` | `external_provider_disabled` |
| `syncStatus=not_started` | `provider_not_started` |
| `syncStatus=preflight_ready` | `provider_preflight_only` |
| `syncStatus=syncing_disabled` | `provider_syncing_disabled` |
| `syncStatus=sync_failed` | `provider_sync_failed` |
| `syncStatus=manual_review_required` | `provider_manual_review_required` |

authorization / provider / sync guard 阻断的状态前后值均为可信当前状态且保持不变。第 3.6 节 guard 1—4 的任何失败固定为 `not_evaluated → not_evaluated`，不得预先加载或回显 aggregate；5a 中 context shell、readiness / authorization 或 aggregate 尚未验证时同样使用 `not_evaluated → not_evaluated`。只有 MappingAggregateContext 已独立验证后，后续失败才使用其可信当前状态并保持不变；generation 新 aggregate 固定为 `unmatched → unmatched`。parser 前失败时 `action=input_blocked`、`reviewerRole=domain_system`，非法 tenant、时间、digest、source 或 mode 分别使用本节固定安全占位；绝不使用 raw payload 声称的 action、status 或上下文。

单一 audit factory 必须同时提供 normal mutation constructor 与不依赖失败 mutation context 的 compile-time-safe blocked constructor。后者只使用 sentinel 和固定枚举生成 `mapping_audit_not_ready_blocked / audit_not_ready`；若 blocked constructor 的启动自检也失败，则整个 domain 初始化失败并拒绝接受任何 command，该情况不属于运行时 action 路径。所有 fail-closed audit 必须先通过本节固定映射，再由该 factory 生成。

## 8. 测试矩阵

测试先于实现编写。每一行至少断言：是否 fail-closed、目标状态、固定 reason code、audit 固定字段、无敏感原文、无外部调用、不自动合并、不写真实客户关系。

### A. generation path

| 维度 | 必测输入 / 场景 |
| --- | --- |
| root `tenantId` | 正常、phone、secret、accessToken、credential、externalUserId、userid、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| `occurredAt` | 正常 canonical ISO、非 ISO、非法日期、phone、secret、accessToken、credential、externalUserId、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| payload shape / whitelist | `null`、array、primitive、class instance、缺失必填键、额外 root / nested 键；generation 注入 `authorization`、`mappingReadinessContext`、`syncStatus`、`fixtureRegistryDigest`、`candidateDigest`、`candidatePairDigest`、`status`、`reasonCode`、`mappingReference`、`evidenceFingerprint`、snapshot digest/version/sequence/timestamp、`auditReady` 均阻断 |
| payload 内容 | forbidden field；第 4.5 节每个人类可读字段逐一注入敏感值；unknown field；nested raw payload；伪造 `containsRealCustomerData=false` 或 `fieldWhitelistApplied=true` 不能绕过扫描 |
| nested whitelist | MappingReadinessContext、authorization、contact、follow user、tag、customer 各自测试缺键、多键、wrong type、数组 0 / 上限 / 超上限、nested tenant / mode mismatch |
| readiness / provenance | MappingReadinessContext 非 plain object、缺键、多键、wrong type；`auditReady=false`；fixtureRegistryDigest 格式合法但未注册；raw source 与 readiness source/mode 不一致 |
| registry / source 绑定 | FixtureRegistryEntry exact-shape、entry digest 重算与 lookup key；对 contact/customer/nested object 分别删除、添加、替换、重复身份、复用其他 entry digest 均固定 `untrusted_fixture_provenance`；仅重排 root / nested 集合保持 source digest 不变 |
| authorization tuple | authorized 搭配 pending / rejected / needs_more_info；authorizedAtDate null / 晚于 occurredAt；expiresAtDate 早于 occurredAt；lastPreflightAt 晚于 occurredAt；均固定 `authorization_state_inconsistent` |
| cross-field attestation | tenant namespace / sourceKind / dataMode 任一不一致；任一 real-data flag、aggregate/target `autoMergePerformed`、`realCustomerRelationshipWritten` 分别为 true；任一 whitelist attestation 为 false；按 5b / 5c 内部顺序断言第 7.2 节固定映射 |
| digest / reference | digest 大小写、63 / 65 hex、空白、全零、行分隔符；reference 长度、字符集、首尾 / 连续连字符边界，并逐个注入结构合法的手机号、证件号、凭证或原始标识内容验证 restricted scanner 阻断 |
| canonical hash vectors | 为 `LP` / `CE`、externalContactsDigest、systemCustomersDigest、sourceSnapshotDigest、fixtureRegistryDigest、mappingReference、candidatePairDigest、evidenceFingerprint、candidateDigest 固定至少一组跨实现 known-answer vector；包含多字节 UTF-8 byte length、null / boolean / integer / array/object type tag 与每个 domain separator |
| fingerprint 字段绑定 | `tagNames` 去重与 UTF-8 byte 排序不改变 fingerprint；逐一翻转 displayNameSimilarity 与其余每个 evidence preimage 字段都必须改变 fingerprint |
| candidate pair 字段绑定 | 逐一改变 tenantId、sourceScopeReference、externalContactDigest、systemCustomerDigest 都必须改变 candidatePairDigest；只改变 aggregateVersion、candidateVersion、mappingReference、timestamp、sourceSnapshotDigest 或其他 metadata 必须保持 pair digest 不变 |
| candidate digest 字段绑定 | 逐一改变 candidateVersion、tenantId、mappingReference、externalContactDigest、systemCustomerDigest、evidenceFingerprint、sourceKind、dataMode 都必须改变 candidateDigest；旧 WIP 拼接 / 截断算法的格式合法结果也必须拒绝 |
| provider / authorization / sync | `authorized + mock_only + mock_ready` 可继续；authorization 的 not_configured、revoked、expired、disabled、external_disabled、manual_review_required，provider 的 disabled / external_disabled，以及 sync 的 not_started、preflight_ready、syncing_disabled、sync_failed、manual_review_required 均 fail-closed |
| guard priority | 同一 command 同时触发多个 raw/scalar/cross-field/authorization/provider/sync 失败时，按第 3.6 节字段顺序及 10a→10b→10c 只断言首个 event/reason |
| tenant | root / authorization / contact / follow user / tag / customer mismatch |
| candidate | 高置信度仍为 `candidate`、低置信度为 `manual_review_required`、多候选为 `conflict` |

### B. review path

| 维度 | 必测输入 / 场景 |
| --- | --- |
| 动作 | `approve`、`reject`、`request_more_info`、`mark_conflict`、`clear_candidate`、`reopen`、`expire_candidate`、`disable_mapping` |
| payload shape | `null`、array、primitive、class instance、非 plain object、缺少对应 discriminated shape 的任一必填键、额外 root 键；candidate-bound 与 disable 两种 shape 不得混用 |
| forbidden / unknown | snake/camel/case 别名；任意 forbidden field；`candidate`、`evidence`、`authorization`、`mappingReadinessContext`、`mappingReference`、`candidatePairDigest`、`evidenceFingerprint`、`candidateVersion`、`snapshotDigest`、`snapshotVersion`、`snapshotSequence`、`lineageTimestamp`、`sourceKind`、`dataMode`、`syncStatus`、`fixtureRegistryDigest`、`status`、`reasonCode`、`auditReady`、`mappingReview`、`mappingDecision`、`mappingConflict` 等所有非 whitelist 字段 |
| nested raw：`rawResponse` | 保持 candidate-bound review root keys 完整，但令 `candidateDigest={rawResponse: <受控占位内容>}`；必须在 guard 1c 以 `forbidden_field_blocked / nested_raw_payload_blocked` 阻断，不能降级成 digest wrong type，也不能回显 nested 内容；额外 root `rawResponse` 仍单独断言 `unknown_field_blocked` |
| nested raw：`webhookPayload` | 保持 candidate-bound review root keys 完整，但令 `candidateDigest={webhookPayload: <受控占位内容>}`；必须在 guard 1c 以 `forbidden_field_blocked / nested_raw_payload_blocked` 阻断，不能降级成 digest wrong type，也不能回显 nested 内容；额外 root `webhookPayload` 仍单独断言 `unknown_field_blocked` |
| nested raw：`apiResponse` | 保持 candidate-bound review root keys 完整，但令 `candidateDigest={apiResponse: <受控占位内容>}`；必须在 guard 1c 以 `forbidden_field_blocked / nested_raw_payload_blocked` 阻断，不能降级成 digest wrong type，也不能回显 nested 内容；额外 root `apiResponse` 仍单独断言 `unknown_field_blocked` |
| `candidateDigest` 敏感值：phone | `candidateDigest=<受控手机号模式 fixture>`，并覆盖结构合法 digest 中出现手机号模式的样本；必须在 guard 1d、digest grammar / target lookup 之前以 `forbidden_field_blocked / sensitive_value_blocked` 阻断，audit 使用零值 digest |
| `candidateDigest` 敏感值：secret | `candidateDigest=<受控 secret / credential 赋值模式 fixture>`；必须在 guard 1d、digest grammar / target lookup 之前以 `forbidden_field_blocked / sensitive_value_blocked` 阻断，audit 使用零值 digest |
| `candidateDigest` 敏感值：externalUserId | `candidateDigest=<受控 wm_ / wo_ 原始 externalUserId 模式 fixture>`；必须在 guard 1d、digest grammar / target lookup 之前以 `forbidden_field_blocked / sensitive_value_blocked` 阻断，audit 使用零值 digest |
| `tenantId + LF + phone` | `<canonical tenantId> + LF + <受控手机号模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_tenant_id_blocked` |
| `tenantId + LF + secret` | `<canonical tenantId> + LF + <受控 secret / credential 模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_tenant_id_blocked` |
| `tenantId + LF + externalUserId` | `<canonical tenantId> + LF + <受控 wm_ / wo_ 原始 externalUserId 模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_tenant_id_blocked` |
| `occurredAt + LF + phone` | `<canonical occurredAt> + LF + <受控手机号模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_occurred_at_blocked` |
| `occurredAt + LF + secret` | `<canonical occurredAt> + LF + <受控 secret / credential 模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_occurred_at_blocked` |
| `occurredAt + LF + externalUserId` | `<canonical occurredAt> + LF + <受控 wm_ / wo_ 原始 externalUserId 模式 fixture>`；完整字符串扫描必须命中 `forbidden_field_blocked / sensitive_value_blocked`，不得返回 `unsafe_occurred_at_blocked` |
| allowed-field taint 扩展 | `tenantId`、`candidateDigest`、`action`、`reviewerRole`、`occurredAt` 分别注入 NUL、仅 LF / CRLF / U+2028 / U+2029，以及上述三类敏感内容与 CRLF / U+2028 / U+2029 的组合；敏感模式命中优先 `sensitive_value_blocked`，仅行分隔符按字段 grammar 固定 reason，audit 均不回显输入 |
| `candidateDigest` grammar | candidate-bound action 下测试缺失、wrong type、空值、错误前缀、63 / 65 hex、大写 / 非 hex、前后空白、LF / CRLF / U+2028 / U+2029、全零 digest；`disable_mapping` 提交该字段必须按 unknown field 阻断 |
| `candidateDigest` reference | target-present 状态下测试格式合法但不存在、与可信 action target 不等、跨 tenant / aggregate，以及每个 action 不满足第 3.6 节 target 条件的组合；target-absent 的 `unmatched` / `disabled` 分别由 step 11a / step 8 阻断，不得抢先返回 candidate not found；显式断言 `conflict → clear_candidate` 可引用 locked target、`rejected → reopen` 可引用 historical target，而 approve 阻断 inactive / rejected / stale / cleared / locked target；伪造 candidate / lineage 字段不能覆盖内部状态 |
| trusted readiness | MappingReadinessContext / authorization 非 plain object、逐字段缺失/额外、wrong type、tenant/source/mode mismatch、fixtureRegistryDigest 未注册、auditReady false；在 action guard 前按第 7.2 节阻断 |
| trusted target shape | target / evidence 非 plain object、逐字段缺失或额外；所有 digest/reference 格式；human-readable/reference 敏感值；target tenant/sourceKind/dataMode mismatch |
| domain output exact shape | 对 `mappingReview`、`mappingDecision`、`mappingConflict` 分别逐字段测试缺键、多键、unknown key、nested raw container、wrong type、grammar / enum / cross-field 不一致，固定断言 `mapping_input_blocked / derived_output_contract_invalid`；再对每个 string field（包括 digest、timestamp、enum）逐项注入 phone / secret / externalUserId 模式，固定断言 `forbidden_field_blocked / sensitive_value_blocked`。两类均要求统一 scanner 先于 grammar、factory 不返回部分对象且 mutation 不提交 |
| `mappingConflict` 来源边界 | conflict-origin lineage 分别覆盖 `unresolved_locked` 与 clear 后 `cleared_locked` 对同一原始 `lockType=conflict` record、aggregate / target 状态与 audit / history 的绑定，并断言 clear 不新增重复 clearance record；普通 candidate clearance 明确断言只产生 clearance lock、不产生 `mappingConflict`，不得为其伪造 `conflictType` |
| trusted target scalar | candidateVersion 的 0、负数、小数、NaN、Infinity、2,147,483,648；confidenceScore 越界/小数/NaN/Infinity 与 level band mismatch；evidence boolean wrong type；tagNames 非数组、元素 wrong type、51 项 |
| trusted aggregate | MappingAggregateContext 非 plain object、逐字段缺失/额外、wrong type/null 规则；aggregateVersion 边界；mappingReference 在 candidate 之前确定；candidateDigest target absent/present 规则；source snapshot、fixture registry 与 lineage index digest 绑定 |
| lineage index | LineageLockIndex / record 非 plain object、逐字段缺失/额外、wrong type；indexVersion/count 边界；`complete=false`；records 缺项、多项、重复、乱序、digest 重算不等；tenant/source scope/mapping/source mode 或 aggregate index digest 不一致均固定 `lineage_index_invalid` |
| trusted target integrity | review 前按第 4.6 节重算 candidate pair、fingerprint 与 candidate digest；保留旧 digest 并逐一篡改 evidence、candidateVersion、tenant、sourceScopeReference、mappingReference、任一 source digest、sourceKind、dataMode 时，均在 action guard 前固定 `mapping_input_blocked / trusted_target_integrity_invalid`，aggregate / lineage 不变 |
| `action` / `reviewerRole` | 缺失、未知值、大小写 / 空白 / 换行变体、敏感字符串；外部 `domain_system` role 阻断；合法 action 与非法源状态组合阻断 |
| derived context 篡改 | raw review 出现 `status`、`reasonCode`、`sourceKind`、`dataMode`、`auditReady` 一律按 unknown field 阻断；可信内部值不一致则按第 7.2 节固定映射阻断 |
| root `tenantId` | 正常、phone、secret、accessToken、credential、externalUserId、userid、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接；每种均验证 audit 不回显 |
| `occurredAt` | 正常 canonical ISO、非 ISO、phone、secret、accessToken、credential、externalUserId、rawResponse、webhookPayload、apiResponse、LF / CRLF / U+2028 / U+2029 拼接 |
| provider / authorization / sync | 除 `disable_mapping` 安全例外外，authorization 非 authorized、provider 非 mock_only 或 sync 非 mock_ready 时全部动作 fail-closed；`disable_mapping` 仍须通过 parser、tenant、时间与 audit preflight，且断言零外部调用 |
| disable containment | DisableContainmentContext exact-shape、缺键/多键/wrong type、`auditReady=false`、aggregate/index 损坏均固定阻断；对九个非 disabled 状态逐一验证 aggregate-only 5h oracle，不提供 target 仍可 disable；MappingReadinessContext / authorization 缺失、撤销、损坏或 provider/sync 不可用时仍可 disable；不加载 candidate、不查 registry、不外联 |
| tenant 关联 | 非 containment 动作下 root tenant 与可信 readiness、authorization、aggregate、lineage index、存在的 action target 任一不一致即阻断；`disable_mapping` 无 target，仅比较 root、DisableContainmentContext、aggregate、lineage index tenant，任一不一致同样阻断 |
| conflict | `conflict → clear_candidate → approve`、`conflict → clear_candidate → reopen → approve`、`conflict → clear_candidate → generate_candidate → approve`、`conflict → expire_candidate → generate_candidate → approve` 全部阻断；删除旧冲突候选、只改 source metadata / sourceSnapshotDigest / aggregateVersion / candidateVersion / timestamp / mappingReference、重排 evidence、提交 partial snapshot 均仍以相同 candidatePairDigest + evidenceFingerprint 命中旧 lock；不同候选对即使 fingerprint 相同也不误命中；真正改变 external/system pair 或 material evidence 后才进入新证据判定，若仍冲突则创建新 lock并永久保留旧 lock |
| 非活动候选 | `unmatched`、`rejected`、`stale`、`disabled`、`cleared_locked` 的 `approve` 全部阻断 |
| 状态—动作全集 | 10 个状态 × 8 个 review action 表驱动覆盖；第 3.3 节列出的组合只代表具备转换资格，仍须通过全部 guard；未列组合固定 `invalid_state_transition`；已 disabled 再 disable 固定 `mapping_already_disabled` |
| candidate flag 真值表 | 第 4.4 节每个 status/reason/target/flag/count 合法行逐一接受；每个单 flag 翻转、互斥 flag、target presence、lock/count 或 reason mismatch 均固定 `status_reason_mismatch` |
| reopened 子状态 | `manual_review_required + review_reopened` 只允许 `generate_candidate` 或 `disable_mapping`；直接 approve/reject/request_more_info/mark_conflict/clear/expire 全部按 action-specific guard 阻断 |
| guard precedence | 同一命令同时触发多项失败时，逐级断言第 3.6 节优先级：boolean type 在 guard 4；5b 内固定 real-data → auto-merge → real-relationship，随后 5c whitelist；source-mode、registry binding、tenant、authorization tuple、aggregate truth table、target integrity、target lookup 依次采用 5d→5j；仅 target-present 状态的 raw candidate reference mismatch 优先于第 11 步，target-absent 状态跳过 5i/5j；第 11 步内部固定 `invalid_state_transition` → action-specific candidate guard → `unresolved_conflict`；authorization/provider/sync 多重失败固定 10a→10b→10c |
| 一致性 | 每个成功与负向用例逐项断言第 7.2 节固定 `eventType`、`reasonCode`、status before/after、audit sentinel；按第 7.1 节逐路径断言 candidateDigest 只取零值、5i 后可信 target 或 generation 新 target 三种固定来源；原 aggregate、candidate 与 lineage lock 在阻断后完全不变 |

### C. audit scan

对 generation、review、provider disabled、tenant mismatch、parser failure、candidate guard、audit preflight、conflict blocked、illegal transition 等全部事件执行 stringify 后整体扫描，结果不得包含：

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

同时断言 audit 字段集合完全等于 whitelist，所有缺失或多余字段均视为失败。每个 fail-closed 用例还必须断言：非法 tenant 使用 `tenant_blocked`，非法时间使用固定安全 timestamp，不可信 digest 使用固定零值 digest，parser 前失败使用 `input_blocked` / `not_evaluated` sentinel；audit 不包含任何输入片段，且无外部调用、不自动 approve、不自动合并、不写真实客户关系。

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
