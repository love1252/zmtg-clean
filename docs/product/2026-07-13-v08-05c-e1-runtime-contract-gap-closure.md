# V0.8 05C-E1 mock customer mapping runtime 契约缺口收口

- 日期：2026-07-13
- 任务编号：`ZMTG-05C-E1-RUNTIME-CONTRACT-GAP-CLOSURE-DOC-20260713`
- 文档性质：docs-only 设计修订，不代表 runtime 已实现，不构成 05C-E2 开发授权
- 前置文档：PR #522《V0.8 05C-E1 客户匹配 mock domain 重新设计方案》

## 1. 结论摘要

05C-E1 继续限定为受控 mock / demo customer mapping domain。本修订只补齐实现前仍不确定的契约：候选准入、证据与评分、单次命令基数、可信 fixture registry、运行时状态与历史、事务返回、scanner、audit 和测试闭包。

本修订不实现代码，不调用企业微信，不真实同步外部联系人，不读取会话内容，不接入会话内容存档，不连接数据库，不写真实客户关系，不自动合并客户，也不进入 05C-E2。

本修订采用以下核心决定：

1. 候选准入只由不可变的 `CandidateManifest` 决定，不实现通用 fuzzy matcher。
2. 一次 `generate_candidate` 只处理 manifest 中一个受控 pair，始终对应一个 aggregate、一个 target 和一个 audit event。
3. generation 仍校验完整 source snapshot；pair selector 只是 registry 中的不透明引用，不能创建或覆盖 candidate identity。
4. `mappingReference` 升级为 material-lineage-stable 的 v2 算法，绑定 pair 与 evidence，而不绑定时间或可变 metadata。
5. 所有 command 都是 pure reducer：先构造完整 draft、derived output 与 audit，再一次性返回 committed state；失败时不返回任何 partial mutation。
6. scanner 对所有字符串统一执行，同时对 canonical hash 做窄范围 lexical masking，避免随机十六进制中的数字片段被误判为手机号或证件号。

## 2. 与 PR #522 契约的关系

PR #522 中未被本节明确修订的状态机、guard 顺序、tenant、timestamp、digest、lineage lock、domain output 和 fail-closed 规则继续有效。

以下条款由本文取代：

- generation、candidate-bound review 与 disable raw command 的 exact keys；
- `FixtureRegistryEntry` 的 exact keys 与 registry digest preimage；
- generation 的 candidate eligibility、evidence、score、cardinality 和空候选语义；
- `mappingReference` v1 算法；
- `MappingAggregateContext` 的 exact keys；
- runtime state、history、public API 和 result envelope；
- extra `rawResponse` / `webhookPayload` / `apiResponse` 的 unknown 分类；
- “canonical digest 内偶然出现手机号数字片段即阻断”的测试要求；
- audit stringify 与 serialized raw container 共用 scanner 时的 mode 规则。

本修订不放宽任何真实数据、授权、provider、tenant、audit 或 conflict lock 边界。

## 3. 候选准入权威

### 3.1 不实现通用 fuzzy matcher

05C-E1 不从任意合法 contact / customer 的笛卡尔积自动发现候选。名称、标签、日期、摘要或 score 都不能把 manifest 外的 pair 变成候选。

pair 当且仅当精确存在于已验证的 `CandidateManifest.entries` 时 eligible。即使 manifest 外 pair 的解释性 score 为 100，也不得生成 candidate。

该决定只服务受控 mock / demo 场景，不应被解释为真实客户匹配算法。未来若要真实匹配，必须另立产品、隐私、算法和数据治理任务。

### 3.2 CandidateManifest exact shape

`CandidateManifest` 的 exact allowed keys 固定为：

`tenantId`、`sourceScopeReference`、`sourceSnapshotDigest`、`sourceKind`、`dataMode`、`entries`、`containsRealCustomerData`、`fieldWhitelistApplied`、`candidateManifestDigest`。

- `entries` 为 0—100 项。
- `containsRealCustomerData` 必须严格为 `false`。
- `fieldWhitelistApplied` 必须严格为 `true`。
- tenant、source scope、snapshot、source kind、data mode 必须与 registry entry、readiness context 和完整 source snapshot 逐项相等。

`CandidateManifestEntry` 的 exact allowed keys 固定为：

`manifestEntryReference`、`externalContactDigest`、`systemCustomerDigest`、`mockCustomerNumberLinked`、`expectedEvidenceFingerprint`。

- `manifestEntryReference` 为 registry 生成的低敏 opaque reference，在 manifest 内唯一。
- pair `{externalContactDigest, systemCustomerDigest}` 在 manifest 内唯一。
- 两个 identity digest 必须各自在完整 source snapshot 中唯一解析到一条记录。
- 被引用 contact 必须满足 `syncStatus=mock_ready`、`sourceMappingStatus` 为 `unmatched` 或 `manual_review_required`、`manualReviewState` 为 `not_required` / `pending` / `needs_more_info`；被引用 customer 必须满足 `statusSummary=active`。违反时属于不可信 fixture provenance，不降级为 no-candidate。
- `mockCustomerNumberLinked` 是 registry-owned mock scenario boolean，raw command 和 source record 均不得提供或覆盖。
- `expectedEvidenceFingerprint` 必须与 domain 从 source record 和该 boolean 重算的结果完全相等。
- entries 按 `externalContactDigest`、`systemCustomerDigest`、`manifestEntryReference` 的 UTF-8 byte tuple 升序。

### 3.3 manifest 与 registry digest

`candidateManifestDigest` 使用 domain separator `zmtg:05c-e1:candidate-manifest:v1`，依次 canonical encode：

1. `tenantId`；
2. `sourceScopeReference`；
3. `sourceSnapshotDigest`；
4. `sourceKind`；
5. `dataMode`；
6. 排序后的完整 `entries`；
7. `containsRealCustomerData`；
8. `fieldWhitelistApplied`。

`FixtureRegistryEntry` 的 exact allowed keys 修订为：

`tenantId`、`fixtureRegistryDigest`、`sourceScopeReference`、`sourceKind`、`dataMode`、`externalContactsDigest`、`systemCustomersDigest`、`sourceSnapshotDigest`、`candidateManifestDigest`。

`fixtureRegistryDigest` 升级为 domain separator `zmtg:05c-e1:fixture-registry:v2`，在 PR #522 原 preimage 末尾增加 `candidateManifestDigest`。

factory 对 snapshot / bundle / manifest 的对象缺失、增删、排序后重复、digest 错配或 cross-field 不一致一律按第 8.1 节返回 `MappingDomainInitializationBlocked`，不能产生可调用 domain。只有 factory 成功后，domain method 对私有 frozen bundle 的 lookup 失败，或 raw command / readiness / runtime state 与该已验证 bundle 的 source、manifest、registry binding 不一致，才返回 `mapping_input_blocked / untrusted_fixture_provenance`。

## 4. generation command 与基数

### 4.1 exact keys

Generation command 顶层 exact allowed keys 修订为：

`tenantId`、`action`、`manifestEntryReference`、`externalContacts`、`systemCustomers`、`occurredAt`、`sourceKind`、`dataMode`、`containsRealCustomerData`。

- `action` 必须严格等于 `generate_candidate`。
- `manifestEntryReference` 只能是合法 reference 或 `null`。
- 非空 reference 必须在已验证 manifest 中唯一命中。
- `null` 仅在 manifest entries 为空时合法，用于产生固定的 no-candidate 结果。
- `externalContacts` / `systemCustomers` 仍必须等于 registry 返回的完整 canonical snapshot，分别为 1—100 项。
- selector 不允许调用方提交 pair digest、evidence、score、mapping reference、candidate digest、version、snapshot digest 或 conflict type。

### 4.2 一次命令只处理一个 pair

非空 selector 一次只生成一个 pair 的 aggregate / target。多个 manifest entries 由 versioned `SourceScopeRuntimeIndex.generationCursor` 强制按 manifest 固定顺序逐项调用；调用方不能跳项、重放或自行声称已完成。每次调用独立通过完整 parser、registry、scope index、lineage、audit 和 atomicity guard。

该模型不允许“只取排序第一项并忽略其他项”。是否为 conflict 必须基于完整 manifest 分组，因此只处理其中一个 entry 也不会隐藏同一 contact 或 customer 的其他受控候选。

每个 command 恰好产生一个成功或阻断 audit event，最多追加一个 lineage lock record，并原子更新 source-scope record；不存在 batch partial commit。

### 4.3 空 manifest

当 manifest entries 为空且 selector 为 `null` 时：

- 结果为 committed `no_candidate`；
- 不创建 aggregate、target、mapping review、decision、conflict 或 lock；
- 不消费 aggregate / candidate / lineage version；
- audit 固定为 `mapping_candidate_generation_empty / no_eligible_candidate`；
- audit candidate digest 使用零值，状态为 `unmatched → unmatched`；
- 返回完成态空 `SourceScopeRuntimeState`，其 indexVersion=1、generationCursor=0、generationComplete=true、records=[]、mappings=[]，不得丢弃 scope 或 lock 状态。

`unmatched / not_generated` 在本文中只作为 generation 的 conceptual before state 与 audit 状态，不持久化为 `MappingAggregateContext`。因此 empty scope 没有可 review 或 per-aggregate disable 的对象；保持空 `SourceScopeRuntimeState` 即为 fail-closed。PR #522 中“持久化 unmatched aggregate 可直接 disable”的路径由本条取代。

manifest 自身出现重复 reference / pair 属 factory initialization failure，不进入 command reason 体系。domain 已成功初始化后，无论首次或 existing state，raw selector 为 null / 非 null 的形态与 frozen manifest 的 cursor expected reference 不一致、未命中或重放，均固定按 `generation_cursor_mismatch` 阻断；no-candidate 只允许首次 empty scope command。

### 4.4 review 与 disable selector

Candidate-bound review command 的 exact allowed keys 修订为：

`tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`occurredAt`。

- `mappingReference` 只作为 source-scope 内的 opaque aggregate selector；它必须在当前完整 runtime state 中唯一命中一个 record 与 mapping state，不能创建或覆盖 mapping identity。
- `candidateDigest` 只作为当前 target 的 opaque selector。selected aggregate 为 target-present 状态时，它必须与可信 target 完全相等；selected aggregate 已为 `disabled` 时跳过 candidate lookup，直接由 disabled / state-transition guard 阻断，不能被 `candidate_target_not_found` 抢先。
- 本条明确取代 PR #522 对 review raw `mappingReference` 的禁止。增加该 selector 的目的仅是让完整 source-scope state 能确定唯一 aggregate，并不赋予调用方任何 lineage 权威。

Disable command exact allowed keys 修订为：

`tenantId`、`mappingReference`、`action`、`reviewerRole`、`occurredAt`。

- `action` 必须为 `disable_mapping`。
- `mappingReference` 只作为 opaque containment selector，必须在 source-scope index 中唯一定位一个 aggregate record；它不能创建、覆盖或改写 mapping identity。
- disable 仍不接受 candidateDigest、readiness、authorization、provider、sync 或 target。

`DisableContainmentContext` exact allowed keys 修订为：

`tenantId`、`sourceScopeRuntimeState`、`auditReady`。

context 不含 registry、readiness、authorization、provider 或单独的 target。domain 以 raw `mappingReference` 在 runtime state envelope 中选择 mapping；containment 专用 oracle 不读取 selected mapping 的 target value，即使该 target 缺失、损坏或带不安全 getter，disable 也只依赖被选 aggregate、history、scope record 与完整 index。`auditReady` 仍须严格为 true。

## 5. source identity 与 evidence

### 5.1 digest 映射

- `externalContactDigest` 必须直接等于对应 contact 的 `externalUserIdDigest`。
- `systemCustomerDigest` 必须直接等于对应 customer 的 `customerDigest`。
- 不二次 hash、不截断，不得用 reference、mock customer number 或 snapshot digest 替代。
- 两类 identity digest 在各自完整数组中必须唯一；重复时在 candidate 构造前阻断。

### 5.2 evidence 唯一推导

所有 source string 必须先通过统一 scanner 和字段 grammar。比较使用 parser 输出的原始 validated value，不 trim、不进行业务 normalize、不做 locale-sensitive casefold。

| evidence 字段 | 唯一推导规则 |
| --- | --- |
| `displayNameSimilarity` | contact `displayName` 与 customer `displayNameSummary` 的 Unicode code point Levenshtein 分数 |
| `remarkSummaryMatched` | 两侧 `remarkSummary` UTF-8 byte 完全相等 |
| `tagNames` | contact 中 `tagStatus=active` 的 `tagName` 与 customer `tagNames` 的 byte-exact 交集；去重后按 UTF-8 byte 升序 |
| `sourceTypeMatched` | 两侧 `sourceType` enum 完全相等 |
| `addedAtDateMatched` | 两侧 canonical `YYYY-MM-DD` 完全相等 |
| `ownerSummaryMatched` | customer `ownerSummary` 与任一 `ownershipStatus=active` follow user 的 `displayName` 或 `institutionSummary` byte-exact 相等 |
| `digestMatched` | `externalUserIdDigest === customerDigest`；仅表示受控 fixture signal |
| `mockCustomerNumberMatched` | 等于 manifest entry 的 `mockCustomerNumberLinked` |
| `systemCustomerSummaryMatched` | contact `displayName` 与 customer `displayNameSummary` byte-exact 相等 |

禁止通过 remark substring、reference suffix、任意 token 猜测 `mockCustomerNumberMatched`。

### 5.3 displayNameSimilarity

1. 使用 `Array.from` 等价的 Unicode code point 序列，不使用 UTF-16 code unit 长度。
2. Levenshtein insertion / deletion / substitution cost 均为 1。
3. `maxLen = max(a.length, b.length)`；两个字段依契约均非空。
4. `score = floor(100 * (maxLen - distance) / maxLen)`。
5. 不做 NFKC、大小写折叠、标点删除、拼音转换、token 重排或 locale 处理。

### 5.4 confidence score

score 只解释 manifest 内候选，不参与候选准入。

| signal | 分值 |
| --- | ---: |
| `displayNameSimilarity` | `floor(value * 25 / 100)` |
| `remarkSummaryMatched` | 10 |
| `tagNames.length > 0` | 10 |
| `sourceTypeMatched` | 5 |
| `addedAtDateMatched` | 5 |
| `ownerSummaryMatched` | 10 |
| `digestMatched` | 20 |
| `mockCustomerNumberMatched` | 10 |
| `systemCustomerSummaryMatched` | 5 |

总分为 0—100 的整数：

- 0—49：`low`；
- 50—79：`medium`；
- 80—100：`high`。

low 进入 `manual_review_required / low_confidence`；medium / high 进入 `candidate / candidate_evidence_available`。任何等级都不能自动进入 `matched`。

## 6. conflict 分组

conflict 只在已验证 manifest entries 上计算。

对当前 pair `p`：

- `E(p)`：与 `p` 具有相同 `externalContactDigest` 的 manifest entries；
- `S(p)`：与 `p` 具有相同 `systemCustomerDigest` 的 manifest entries。

当 `|E(p)| > 1` 或 `|S(p)| > 1` 时，当前 pair 为 conflict。

`unresolvedConflictCount` 固定为 `|(E(p) ∪ S(p)) - {p}|`。manifest 上限为 100，因此 generation conflict count 固定为 1—99。

origin / type 固定优先级：

1. `|E(p)| > 1`：`generation_multiple_system_customers → multiple_system_customers_for_external_contact`；
2. 否则 `|S(p)| > 1`：`generation_multiple_external_contacts → multiple_external_contacts_for_system_customer`。

两类同时命中时仍采用第 1 项。score 和 confidence 不得覆盖 conflict 状态。

## 7. mappingReference v2

PR #522 的 `mapping-reference:v1` 不进入 runtime 实现。

v2 domain separator 固定为 `zmtg:05c-e1:mapping-reference:v2`，preimage 顺序固定为：

1. `tenantId`；
2. `sourceScopeReference`；
3. `candidatePairDigest`；
4. `evidenceFingerprint`。

domain separator 使用 `LP`，其余字段使用 `CE`。SHA-256 结果取前 48 个小写 hex，形成 `ref-${dataMode}-<48hex>`。

v2 不包含 aggregateVersion、candidateVersion、timestamp 或 sourceSnapshotDigest。它因此绑定 material pair / evidence，不会因顺序、时间或 metadata 变化产生新的 aggregate identity。

- 同 pair / 同 evidence 的 stale 或 reopened regeneration 保持 mappingReference 不变，并增加 candidateVersion。
- 同一 domain instance 的 registry / manifest / source snapshot 不可变，因此 existing state 出现不同 evidence fingerprint 一律按 provenance / lineage mismatch 阻断，不能原地改写 reference。
- 05C-E1 不实现跨 registry revision 的物质新证据迁移；携带旧 runtime state 时，`cleared_locked` 的同 pair / 同 evidence 始终由 lineage lock 阻断。未来若允许新 evidence，必须先另立文档定义旧 scope lock 向新 revision 的可信迁移，不能仅换 metadata；调用方删除全部 state 后重建 instance 属第 9.3 节明确的 application trust boundary，不伪称 pure domain 可检测。

## 8. runtime public API 与权威 fixture snapshot

### 8.1 domain factory

runtime public surface 固定为一个 factory 返回三个 pure reducer method：

```ts
type WeComCustomerMappingDependencies = Readonly<{
  fixtureRegistrySnapshot: unknown;
}>;

declare function createWeComCustomerMappingDomain(
  dependencies: unknown,
): WeComCustomerMappingDomain | MappingDomainInitializationBlocked;

type MappingDomainInitializationBlocked = Readonly<{
  ok: false;
  reasonCode: "fixture_registry_initialization_blocked";
}>;

type WeComCustomerMappingDomain = Readonly<{
  generateCandidate(
    rawCommand: unknown,
    readinessContext: unknown,
    state: unknown,
  ): MappingCommandResult;
  reviewCandidate(
    rawCommand: unknown,
    readinessContext: unknown,
    state: unknown,
  ): MappingCommandResult;
  disableMapping(
    rawCommand: unknown,
    containmentContext: unknown,
  ): MappingCommandResult;
}>;
```

dependencies 必须先按 exact keys 解析，唯一 allowed key 为 `fixtureRegistrySnapshot`。不得注入 clock、logger、repository、provider、network client、audit sink、resolver callback 或 state writer。parser、scanner、hash、audit、history、source-scope index 与 conflict constructor 均由 module owning。

factory initialization 的 dependency shape、resource budget、scanner、fixture exact-shape、canonical digest 或 cross-binding 任一失败时，不抛出带 input / path / cause / stack 的动态错误，也不返回半初始化 instance；只返回 recursive-frozen、exact keys 为 `ok,reasonCode` 的固定 `MappingDomainInitializationBlocked`。factory 尚未产生 command invocation，因此该结果不伪造 mapping audit event。固定 blocked object 必须在 module 初始化时自检；自检失败则 module 不暴露 factory。

方法与 raw action 不一致时固定返回 `mapping_input_blocked / invalid_action`。

### 8.2 FixtureRegistrySnapshot

不接受带回调的 structural resolver。factory 只接受一份完整、可枚举的本地 snapshot，并在返回 domain instance 前完成全量验证、deep clone 与 recursive freeze。

`FixtureRegistrySnapshot` exact allowed keys：

`authorityKind`、`bundles`。

- `authorityKind` 必须严格为 `controlled_fixture_registry_v2`。
- `bundles` 为 1—100 个 `FixtureRegistryBundle`。

`FixtureRegistryBundle` exact allowed keys：

`entry`、`externalContacts`、`systemCustomers`、`candidateManifest`。

factory 必须对所有 bundle 重算 source、manifest 与 registry digest，并全局证明：

- `fixtureRegistryDigest` 唯一；
- `sourceScopeReference` 唯一；
- tenant / source scope / source kind / data mode / snapshot / manifest 全量交叉绑定；
- 同一 domain instance 中不存在 default tenant、最近 entry 或 global fallback。

snapshot 没有 register / set / update / delete，也不连接 provider、数据库、文件外 registry 或网络。domain method 只在其私有 frozen map 中按已验证 digest 唯一查找；`disable_mapping` 永远不读取该 map。

同一 `sourceScopeReference` 在一个 domain instance 的生命周期内只对应一个 registry / manifest revision。05C-E1 不迁移 existing state 到新 registry revision；任何 source、manifest 或 registry digest 变化都固定按 `untrusted_fixture_provenance` 阻断。物质新证据跨 revision 的迁移继续作为后续 docs 任务，不得在本轮实现中猜测。

## 9. source-scope runtime index、aggregate 与 history

### 9.1 SourceScopeRuntimeIndex

所有 pair aggregate 共享的 scope-level 排序、selector 与 lock 权威只存在于一个 versioned source-scope index。aggregate 不再复制全局 lineage index digest，避免任一 pair 追加 lock 后使其他 aggregate 立即陈旧。index 本身不保存完整 aggregate / target / history，完整可执行状态由第 9.2 节 `SourceScopeRuntimeState` 持有。

`SourceScopeRuntimeIndex` exact allowed keys：

`tenantId`、`sourceScopeReference`、`fixtureRegistryDigest`、`candidateManifestDigest`、`indexVersion`、`indexDigest`、`indexSnapshotComplete`、`generationCursor`、`generationComplete`、`records`、`lineageLockIndex`、`sourceKind`、`dataMode`。

- `indexSnapshotComplete` 必须严格为 `true`，只表示本 index snapshot 覆盖当前 `generationCursor` 已处理 prefix 的全部 record 与当前 source scope 的全部 lock；它不表示 manifest 已全部 materialize。
- `generationCursor` 为 0—manifest entries.length 的整数。
- `generationComplete === (generationCursor === manifest entries.length)`。
- `records` 数量严格等于 `generationCursor`，并与 manifest 的已处理 prefix 一一对应；不得跳项、重排、漏项或重复。
- `lineageLockIndex` 是 PR #522 定义的完整 append-only index；初始固定为 version 1、complete=true、records=[]，并按原 canonical 算法重算 digest。
- source-scope `indexVersion` 初始内部 seed 为 0；每个 committed mapping command 严格加 1，最大为 2,147,483,647。

`SourceScopeAggregateRecord` exact allowed keys：

`manifestEntryReference`、`candidatePairDigest`、`evidenceFingerprint`、`mappingReference`、`mappingStatus`、`aggregateVersion`、`candidateDigest`、`historyDigest`。

- records 只允许由 generation 按 manifest prefix 追加；后续 action 只能替换被选中的同一 record，不能增删或移动其他 record。
- record 必须与 manifest entry、aggregate、target presence 和 history 完全绑定。
- `candidateDigest` 只在 selected aggregate 为 disabled 时允许 `null`，其他已生成状态必须为非零合法 digest。
- `manifestEntryReference`、`candidatePairDigest` 与 `mappingReference` 在 records 中必须分别唯一；所有非 null `candidateDigest` 也必须唯一。现有 snapshot、prospective append 与 prospective replacement 任一集合重复，统一 `mapping_input_blocked / source_scope_state_invalid`，不得尝试按首项解析碰撞。

`indexDigest` 使用 domain separator `zmtg:05c-e1:source-scope-runtime-index:v2`，依次 `CE` 编码 tenantId、sourceScopeReference、fixtureRegistryDigest、candidateManifestDigest、indexVersion、indexSnapshotComplete、generationCursor、generationComplete、按 manifest 顺序的 records、完整 lineageLockIndex、sourceKind、dataMode。

### 9.2 完整 SourceScopeRuntimeState

所有 committed action 的唯一 persisted state type 固定为 `SourceScopeRuntimeState`，exact allowed keys 为：

`stateKind`、`sourceScopeRuntimeIndex`、`mappings`。

- `stateKind` 必须严格为 `source_scope_runtime`。
- `mappings` 为 0—100 个 `SourceScopeMappingState`，数量严格等于 index `records.length` 与 `generationCursor`，顺序严格等于 records / manifest 已处理 prefix。
- `SourceScopeMappingState` exact allowed keys 为 `aggregate`、`target`、`history`。每一项必须与同位置 record 逐项绑定；`target` 只在 aggregate 为 disabled 时允许 `null`，其他 committed aggregate 必须保存完整 target。
- 所有 mappings 的 `history.entries.length` 合计最多 2,000；input 超限为 `source_scope_state_invalid`，prospective committed mutation 首次越过上限为 `source_scope_history_capacity_exceeded`。
- state 必须覆盖当前已处理 prefix 的全部 aggregate、target 与 history。不能只返回本次 selected mapping，也不能从 index 摘要重建 target 或 history；任何 mapping state 丢失、增加、重排或 cross-bind 失败均固定为 `source_scope_state_invalid` / `aggregate_lineage_mismatch`。

因此多 entry scope 的第 N 次 committed result 仍携带第 0—N 项完整 mapping state。review / disable 只选择其中一项并原子替换，其他项必须 deep-equal 且按 exact field order `CE` byte-equal。application 只持有并一次性替换这一份完整 state，不维护契约外的平行 aggregate store。

empty manifest 的合法首次 command 也返回 `SourceScopeRuntimeState`：indexVersion=1、generationCursor=0、generationComplete=true、records=[]、mappings=[]、lineage index 保持初始 version 1。它不创建 aggregate / candidate / history，也不消费这些对象的 version。

### 9.3 method / state admissibility

`state=null` 是 application state boundary 对“该 source scope 从未初始化”的权威声明，只能出现一次。已有 state 后丢弃它并再次提交 null，等价于替换全部 module-owned state，属于明确禁止的 application boundary 违规；pure domain 不声称在调用方删除全部 state 或以新 instance 隐瞒旧 state 后恢复历史真值。

只要调用方继续携带旧 `SourceScopeRuntimeState`，factory snapshot / registry / manifest revision 任一变化都必须阻断；“重建 instance 且删除旧 state 仍能由 pure domain 识别”不属于 05C-E1 威胁模型，也不得写成可证明测试。若未来要求跨 instance 防回滚，必须先批准外部持久 state authority。

固定 method / state matrix：

| method | state / context | 唯一结果 |
| --- | --- | --- |
| generate | `state=null` + empty manifest + null selector | committed no-candidate，产生完整空 `SourceScopeRuntimeState` |
| generate | `state=null` + non-empty manifest | selector 必须等于 manifest 第 0 项 reference |
| generate | runtime state + `generationComplete=false` | selector 必须等于 `entries[generationCursor]`；只追加该项 |
| generate | runtime state + `generationComplete=true` | 只允许选择 `stale / candidate_expired` 或 `manual_review_required / review_reopened` 的 existing mapping 做同 material lineage regeneration |
| generate | selector 跳项、重放、已存在 record 或 null + existing state | `generation_cursor_mismatch` |
| review | `state=null`、空 object、malformed state 或非 `SourceScopeRuntimeState` | `source_scope_state_invalid` |
| review | exact-valid runtime state + `mappings=[]` | mappingReference 0 命中，固定 `aggregate_lineage_mismatch` |
| review | runtime state + `generationComplete=false` | `generation_incomplete` |
| review | runtime state + `generationComplete=true` | mappingReference 先唯一选择 mapping；disabled mapping 跳过 candidate lookup并由 `invalid_state_transition` 阻断，其他 target-present 状态再校验 candidateDigest |
| disable | context 缺失完整 runtime state 或 shape / intrinsic binding 失败 | `source_scope_state_invalid` |
| disable | runtime state + `generationComplete=false` | 允许 containment，只能选择 processed prefix 中已经存在的 mapping |
| disable | 前置 parser / context / state / tenant / selector / auditReady 全通过，selected mapping 已 disabled | `mapping_already_disabled`，优先于 non-monotonic 与 capacity |
| disable | 空 scope 或 selector 未命中 processed record | `aggregate_lineage_mismatch` |

任意旧的 `SourceScopeOnlyState`、`NewAggregateState`、`ExistingMappingRuntimeState` 或其他 object shape 都不再属于 public state union，统一按 `source_scope_state_invalid` 阻断。Existing regeneration 不改变 generationCursor，只替换同位置 mapping / record；新 evidence fingerprint 不允许写回 existing aggregate，本 snapshot 又不可变，因此 05C-E1 不提供跨 revision new-evidence migration。

### 9.4 MappingAggregateContext 修订

exact allowed keys 固定为：

`tenantId`、`sourceScopeReference`、`mappingReference`、`aggregateVersion`、`mappingStatus`、`reasonCode`、`candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、`sourceSnapshotDigest`、`fixtureRegistryDigest`、`historyDigest`、`sourceKind`、`dataMode`、`containsRealCustomerData`、`autoMergePerformed`、`realCustomerRelationshipWritten`、`updatedAt`。

PR #522 的 `lineageLockIndexDigest` 从 aggregate 移除，改由 source-scope index 唯一持有和绑定。`candidatePairDigest` / `evidenceFingerprint` 在 disabled state 中仍保留；candidateDigest 在 disabled state 为 `null`。本文不产生 committed unmatched aggregate，因此不存在 pair / evidence 为 null 的 aggregate。

target 的 `mockCustomerNumber` 必须 byte-equal customer `mockCustomerNumber`；`systemCustomerSummary` 必须 byte-equal customer `displayNameSummary`。不得 normalize、替换为 remark / status，或从 reference 推导。

### 9.5 MappingHistory

exact allowed keys：

`tenantId`、`sourceScopeReference`、`mappingReference`、`historyVersion`、`historyDigest`、`complete`、`entries`、`sourceKind`、`dataMode`。

- `complete` 必须严格为 `true`。
- entries 为 1—1000 项；initial committed generation 即产生第 1 项。
- `historyVersion === entries.length`，当前 aggregate 必须满足 `aggregateVersion === historyVersion`。
- entries 按 `historySequence` 升序，旧 entries 同时 deep-equal 且按 exact field order `CE` byte-equal；成功动作只能追加一项。

`MappingHistoryEntry` exact allowed keys：

`tenantId`、`sourceScopeReference`、`mappingReference`、`historySequence`、`aggregateVersionBefore`、`aggregateVersionAfter`、`action`、`reviewerRole`、`mappingStatusBefore`、`mappingStatusAfter`、`reasonCode`、`targetSnapshotPhase`、`targetSnapshot`、`occurredAt`、`sourceKind`、`dataMode`。

- sequence 从 1 连续递增；entry n 的 status/version before 必须等于 entry n-1 的 after。
- initial generation 唯一允许 `aggregateVersionBefore=0`，after=1；其他 before / after 均为 1—2,147,483,647 且严格 +1。
- occurredAt 严格递增；tenant、scope、reference、source kind 与 mode 全链一致。
- generation reviewer role 固定为 `domain_system`；该 role 同时合法用于 parser 前 audit sentinel。
- 非 disable 成功项使用 `targetSnapshotPhase=after`，保存成功后的完整 target；最后一项 target snapshot 必须与 runtime target deep-equal / CE byte-equal。
- disable 使用 `targetSnapshotPhase=none`、targetSnapshot=null；倒数第 1 个非 disable entry 已保存最后可信 target。
- 最后一项 after status / reason、aggregateVersionAfter、occurredAt 必须分别等于 aggregate status / reason、version、updatedAt。
- aggregate candidate / pair / evidence digest 必须与最后适用的 target snapshot 和 scope record 绑定。

`historyDigest` 使用 domain separator `zmtg:05c-e1:mapping-history:v1`，依次 `CE` 编码 tenantId、sourceScopeReference、mappingReference、historyVersion、complete、按 historySequence 升序的完整 entries、sourceKind、dataMode。每个 entry 与 nested target snapshot 均严格使用各自 exact key 书写顺序。必须固定至少一组含 initial generation、review 和 disable 的 known-answer vector。

history 已有 1000 项或 version 达上限时，任何 mutation固定返回 `mapping_input_blocked / history_capacity_exceeded`，aggregate、target、history、scope index 与 lock index 不变。

### 9.6 version 与时间

- initial committed generation：scope indexVersion 0→1、aggregateVersion=1、candidateVersion=1、historyVersion=1。
- 继续处理下一个 manifest entry：scope indexVersion +1，新 aggregate / candidate / history 各从 1 开始。
- existing regeneration：scope indexVersion +1、aggregateVersion +1、candidateVersion +1、historyVersion +1。
- review / disable：scope indexVersion +1、aggregateVersion +1、candidateVersion 不变、historyVersion +1。
- existing action 的 occurredAt 必须严格晚于 aggregate updatedAt；否则 `mapping_input_blocked / non_monotonic_occurred_at`。
- 成功后 aggregate updatedAt=occurredAt；target createdAt 只在 candidate generation 时设置；review 不修改。
- 新 lock createdAt=occurredAt；conflict clear 保留原 record 时间。

### 9.7 guard 插入点

PR #522 的 step 5 扩展为：

- 5a object order：context shell → `SourceScopeRuntimeState` → `SourceScopeRuntimeIndex` / nested LineageLockIndex → ordered mappings → aggregate → history → target / evidence。scope state / index 在此完成 exact shape、string scan、scalar、canonical digest、records / mappings cardinality、selector uniqueness 与 intrinsic completeness；失败为 `source_scope_state_invalid`。
- 5e：非 containment 动作在 registry provenance 通过后，把 scope index 的 registry / manifest / source scope、generationCursor、generationComplete 与 frozen bundle 及完整 manifest prefix 绑定。
- 5e.1 generation selector 路径：initial / incomplete-scope generation 只使用 raw `manifestEntryReference`，必须等于 `entries[generationCursor]` 且尚无对应 record；失败为 `generation_cursor_mismatch`，在任何 pair / target / mappingReference 构造前阻断。generationComplete existing regeneration 也只使用 `manifestEntryReference`，先要求 generationComplete=true，再在 manifest、records 与 mappings 中唯一选择同位置 existing mapping；record / mapping 缺失或位置不一致为 `aggregate_lineage_mismatch`，records 重复已在 5a 固定为 `source_scope_state_invalid`。manifest 重复属于 factory initialization failure，成功创建的 domain 中不可达。generation 永不读取不存在的 raw `mappingReference`。
- 5f：root、readiness、scope index、每个 mapping 的 aggregate / history / target tenant 全量绑定。
- 5h method-specific selection：review 以 raw `mappingReference` 在已验证 records 中唯一选择 record 与同位置 mapping；0 命中固定 `aggregate_lineage_mismatch`，多命中已在 5a 固定为 `source_scope_state_invalid`。existing regeneration 沿用 5e.1 选中的 mapping；initial / incomplete generation 没有 existing mapping，只使用 conceptual `unmatched` before state。随后对存在的 selected mapping 绑定 aggregate status / reason、history current-state、record 与 target-presence 真值表。
- 5i：existing selected mapping 为 target-present 状态时重算 pair / evidence / candidate / mapping reference 并验证 target integrity；disabled 状态跳过。initial / incomplete generation 只有在 5e.1 cursor 通过后才从 manifest entry 与可信 source 构造 prospective pair / evidence / target / mappingReference。
- 5j：只对 candidate-bound review 且 selected mapping 为 target-present 状态，用 raw candidate digest 与可信 target 完全相等比较；不相等固定 `candidate_target_not_found`。disabled 状态跳过 5j，再由 state-transition guard 返回 `invalid_state_transition`。

随后 step 6 子序固定为：

1. 6a：review generationComplete；失败为 `generation_incomplete`。generation 的 cursor / complete 已在 5e.1 完成，disable 不执行 complete guard。
2. 6b：existing occurredAt 单调性；失败为 `non_monotonic_occurred_at`。
3. 6c：selected history capacity → scope-wide history capacity → source-scope index capacity → lineage record capacity → lineage version capacity；只报告首个失败。
4. 6d：PR #522 原 lineage reuse 判定。

step 7 audit preflight、step 10 authorization/provider/sync 均晚于上述子序。generation cursor / out-of-order selector 在 5e.1、prospective target 构造前阻断，audit candidate digest 始终为零值；其他路径在 5i 尚未通过时也只能使用零值。状态只有在 5h 完成后才可提升。

### 9.8 containment 专用 scope oracle

`disable_mapping` 不读取 frozen registry / manifest，因此不重新证明 record 等于 manifest prefix，也不重新推导 `generationComplete === cursor === manifest.length`。它只执行下列封闭 intrinsic oracle：

1. raw command 与 containment context shell exact shape / scanner / scalar；
2. runtime state、index、records、lineage index、mappings 的 plain-object / descriptor / exact-key / cardinality / canonical digest；
3. `indexSnapshotComplete=true`、records.length=mappings.length=generationCursor、indexVersion / cursor 范围和所有 selector unique sets；
4. root、context、index 与 mappings 的 tenant / namespace binding；失败固定为既有 `tenant_mismatch` / `source_mode_mismatch`；
5. raw mappingReference 在 processed records 中唯一命中；0 命中为 `aggregate_lineage_mismatch`，重复在第 3 步为 `source_scope_state_invalid`；
6. 非 selected mappings 全量验证且原样保留；selected mapping 的 aggregate / history / record / lineage 自洽并通过 status / reason、history chain 与 hash；
7. selected mapping shell 只允许 `aggregate`、`history` 与可选 `target` 三个 string keys；`aggregate` / `history` 必须是 enumerable data descriptor。`target` 缺失或存在均可，存在时无论 data 或 accessor descriptor 都不得读取、调用、扫描或解析其 value，prospective state 直接创建规范 `target=null` data property；任何其他 key / symbol 仍拒绝，getter / setter 调用次数必须为 0；
8. `auditReady` 必须为 true；false 固定 `mapping_audit_not_ready_blocked / audit_not_ready`；
9. selected aggregate 已 disabled 时固定 `mapping_invalid_transition_blocked / mapping_already_disabled`；该 guard 先于时间与所有 capacity；
10. existing occurredAt 单调性；失败为 `non_monotonic_occurred_at`；
11. selected history → scope-wide history → source-scope index capacity；只报告首个失败；
12. prospective full state / audit / result exact-shape 与 atomic commit。

第 7 项是 containment-only 的 one-way recovery exception：它只允许 selected target slot 从损坏或缺失收敛到规范 `null`，不能用于 generate / review，也不能放宽 aggregate、history、record、index 或任何非 selected mapping。committed nextState 必须重新通过普通 `SourceScopeRuntimeState` exact-shape 校验。上述 1—12 是唯一 precedence；例如 auditReady=false + already-disabled 返回 audit_not_ready，auditReady=true + already-disabled + non-monotonic / full history 固定返回 mapping_already_disabled。

`indexSnapshotComplete=true` 且 `generationComplete=false` 是合法 partial-scope 状态；前者只承诺 processed prefix / lock snapshot 完整，后者只记录 manifest 尚未全部生成。disable selected mapping 时 generationCursor、generationComplete、其他 mappings / records 与 lineage index全部 byte-equal，只替换 selected mapping / record 并增加 indexVersion。

## 10. result envelope 与 atomicity

### 10.1 committed result

exact allowed keys 固定为：

`ok`、`action`、`resultKind`、`nextState`、`mappingReview`、`mappingDecision`、`mappingConflict`、`auditEvent`。

- `ok` 必须严格为 `true`。
- `resultKind` 只允许 `candidate_generated`、`manual_review_requested`、`conflict_detected`、`no_candidate`、`review_committed`、`mapping_disabled`。
- `nextState` 在所有 committed result（包括 `no_candidate`）中都必须是完整 `SourceScopeRuntimeState`。任何 path 都不得只返回 selected mapping 或丢弃其他 scope mappings / index。
- 三个 domain output 按第 11 节矩阵为完整对象或 `null`。

### 10.2 domain output exact keys

`mappingReview` exact allowed keys：

`tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`mappingStatusBefore`、`occurredAt`、`sourceKind`、`dataMode`。

`mappingDecision` exact allowed keys：

`tenantId`、`mappingReference`、`candidateDigest`、`action`、`reviewerRole`、`mappingStatusBefore`、`mappingStatusAfter`、`reasonCode`、`occurredAt`、`sourceKind`、`dataMode`。

`mappingConflict` exact allowed keys：

`tenantId`、`mappingReference`、`candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、`conflictType`、`conflictStatus`、`unresolvedConflictCount`、`manualReviewRequired`、`createdAt`、`sourceKind`、`dataMode`。

三个 output 必须由 module-owned factory 以固定 key 顺序生成，缺键、多键、unknown / nested raw container、wrong type、grammar、enum 或 cross-field 不一致均不得产生 partial output。每一个 string value 都必须先执行同一 sensitive scanner，再执行 digest、timestamp、enum、reference 或其他 grammar；digest、timestamp 与 enum 没有豁免。

### 10.3 blocked result

exact allowed keys 只能是：

`ok`、`auditEvent`。

`ok` 必须严格为 `false`。blocked result 不得包含 error、message、details、path、scanner category、raw input、aggregate、target、index、partial output 或 mutation draft。

阻断时，输入 aggregate、target、history、source-scope index 与 lineage index 必须同时 deep-equal 且按 exact field order CE byte-equal；不产生 review / decision / conflict。唯一例外是 containment selected target slot 已缺失、contract-invalid 或为 accessor 时，该 value 没有合法 CE 表示且绝不读取：只允许用 `Reflect.getOwnPropertyDescriptor` 在调用前后比较 property 是否仍缺失，或比较 descriptor 的 configurable / enumerable / writable / value / get / set identity 全部未变，并断言 getter / setter 调用次数为 0、整个 input object 未 mutate。非 selected mapping 与 selected aggregate / history / record / index 仍执行普通 deep / CE equality。blocked result 与 auditEvent 也必须 recursive deep-freeze。

### 10.4 pure reducer commit

固定流水：

1. raw parser 与 guard；
2. 完整 runtime state、所有 mappings、history、source-scope index 和 lineage index 校验；
3. 非 containment registry resolution；
4. isolated immutable draft；
5. prospective selected target、index、history、aggregate 与完整 source-scope state；
6. derived output factories；
7. normal audit factory；
8. 完整 nextState exact-shape、scanner、hash 与 cross-binding；
9. recursive deep-freeze committed 或 blocked result。

禁止原地修改。任一步失败都丢弃完整 draft，只返回 blocked result。application boundary 只能在 `ok=true` 时一次性替换状态引用；本 domain 不写 storage、日志或外部系统。

## 11. 逐动作 lifecycle 与 output 发射

### 11.1 target 变化

| 成功动作 | target after |
| --- | --- |
| generation candidate / low | 新 target `active`；cleared/rejected/stale/locked 均 false，count=0 |
| generation conflict | 新 target `conflict_locked`；active=true、locked=true，count=1—99 |
| `approve` | `inactive`；active=false，其他 flags=false，count=0 |
| `reject` | `rejected`；active=false、rejected=true，count=0 |
| `request_more_info` | 保持 `active`，全部终态 flags=false，count=0 |
| `mark_conflict` | `conflict_locked`；active=true、locked=true，count 从 0 变为 1 |
| ordinary `clear_candidate` | `cleared`；active=false、cleared=true、locked=true，count=0，并追加 clearance lock |
| conflict `clear_candidate` | `cleared`；active=false、cleared=true、locked=true，保留原 conflict count 与 record，index 不变 |
| `reopen` | `inactive`；active=false，全部终态 flags=false，count=0 |
| `expire_candidate` | `stale`；active=false、stale=true，count=0 |
| `disable_mapping` | target=null；不加载或改写原 target |

### 11.2 result / output / audit 唯一矩阵

| 场景 | resultKind | status / reason after | mappingReview | mappingDecision | mappingConflict | audit event |
| --- | --- | --- | --- | --- | --- | --- |
| generation medium / high | `candidate_generated` | `candidate / candidate_evidence_available` | null | null | null | `mapping_candidate_generated` |
| generation low | `manual_review_requested` | `manual_review_required / low_confidence` | null | null | null | `mapping_manual_review_requested` |
| generation conflict | `conflict_detected` | `conflict / mapping_conflict` | null | null | `unresolved_locked` | `mapping_conflict_detected` |
| empty manifest | `no_candidate` | 无 aggregate；audit `unmatched → unmatched` | null | null | null | `mapping_candidate_generation_empty` |
| approve | `review_committed` | `matched / approved_by_manual_review` | 产生 | 产生 | null | `mapping_approved` |
| reject | `review_committed` | `rejected / rejected_by_manual_review` | 产生 | 产生 | null | `mapping_rejected` |
| request_more_info | `review_committed` | `needs_more_info / more_info_requested` | 产生 | 产生 | null | `mapping_more_info_requested` |
| reopen | `review_committed` | `manual_review_required / review_reopened` | 产生 | 产生 | null | `mapping_reopened` |
| expire | `review_committed` | `stale / candidate_expired` | 产生 | 产生 | null | `mapping_candidate_expired` |
| mark_conflict | `conflict_detected` | `conflict / mapping_conflict` | 产生 | 产生 | `unresolved_locked` | `mapping_conflict_detected` |
| ordinary clear | `review_committed` | `cleared_locked / candidate_cleared_locked` | 产生 | 产生 | null | `mapping_candidate_cleared` |
| conflict-origin clear | `review_committed` | `cleared_locked / candidate_cleared_locked` | 产生 | 产生 | `cleared_locked`，复用原 type / createdAt / record | `mapping_candidate_cleared` |
| disable | `mapping_disabled` | `disabled / mapping_disabled` | null | null | null | `mapping_disabled` |

committed result 的 action、resultKind、nextState 中 selected mapping 的 status / reason、三个 output 的 nullability 与 audit event 必须逐行完全匹配；empty manifest 行无 selected mapping。blocked result 不含上述 output keys。

### 11.3 disable 保存规则

disable 后：

- aggregate 进入 `disabled / mapping_disabled`；
- candidateDigest=null、target=null；
- mappingReference、pair digest、evidence fingerprint、source scope、snapshot、registry、source kind、data mode 保留；
- history 旧 entries byte-equal，只追加 disable entry；
- source-scope 只替换被选 mapping 与对应 record 并令 indexVersion +1；其他 mappings / records byte-equal；
- nested lineage records / version / digest byte-equal；
- historyDigest 与 source-scope indexDigest 更新；nested lineage index 不变；
- 不解析 registry，不加载 target，不检查 authorization、provider 或 sync；
- 后续所有动作按 disabled guard 阻断。

## 12. deterministic sensitive scanner

### 12.1 内部 mode

scanner 只允许两个 module-owned mode：

- `field_value`：raw、trusted 与 domain output 的所有 string；
- `canonical_audit_envelope`：仅用于已经 exact-shape 校验并按固定 key 顺序序列化的 audit JSON。

后者只豁免“外层 canonical audit JSON 是 object”这一 raw-container 判定，其余模式全部相同。该 mode 只能由 audit factory 在 audit object 已通过 exact 11-key 校验、逐字段扫描与 grammar 后，调用固定 serializer 时进入；其他 call site 在类型与 runtime 分支上均不可达，command 不得选择 mode。

### 12.2 前置结构资源预算

任何 NFKC、percent decode、JSON parse、regex、hash 或 string 内容扫描前，module 必须先以 descriptor-only structural preflight 验证完整待解析 graph。该 gate 只检查 container 类型、own property descriptor、array length 与资源数量，不读取 getter、不解释字符串内容，也不构成敏感内容豁免：超限输入直接 fail-closed，不进入 state 或 audit。

固定预算为：

- 每个 plain object 最多 64 个 own keys；先 `Reflect.ownKeys` 计数，超限时不再取得后续 value；
- 每个已知 array 先检查其 contract cardinality，再访问任一 element；
- 单次 factory initialization 最多访问 2,000,000 个 container + scalar nodes，全部 string 合计最多 32,000,000 个 UTF-16 code units；
- 单次 domain method invocation（raw、context、state、prospective output 与 audit 合计）最多访问 500,000 个 container + scalar nodes，全部 string 合计最多 8,000,000 个 UTF-16 code units；
- 每个 string 最多 4,096 个 UTF-16 code units；

factory 与每个 domain method 使用独立计数器，不跨调用累计。各字段 / array 的局部 contract 上限与对应 public graph 的 aggregate budget 必须同时满足；局部上限不承诺所有维度可以同时取最大值。故“最大合法 graph”定义为同时满足 local cardinality 与 aggregate budget 的 graph，而不是所有 local 维度同时取最大值。

factory initialization 任一 owning-contract 或 resource failure 无条件折叠为第 8.1 节固定 `MappingDomainInitializationBlocked`，不进入以下 command reason 体系。以下 collapse 只适用于 domain method invocation：raw object / array / node budget 超限=`mapping_input_blocked / invalid_payload_shape`，raw 单 string 或累计 string budget 超限=`mapping_input_blocked / invalid_scalar_value`；method 内 registry / manifest / source fixture=`untrusted_fixture_provenance`，readiness / authorization=`trusted_readiness_contract_invalid`，disable context shell=`trusted_disable_context_invalid`，runtime state / scope index / mapping array / history=`source_scope_state_invalid`，aggregate=`trusted_aggregate_contract_invalid`，target / evidence=`trusted_target_contract_invalid`，lineage index / record=`lineage_index_invalid`，domain output=`derived_output_contract_invalid`，audit candidate=`audit_not_ready`。任何结果都不能回显长度、path 或内容。正好等于上限必须继续，首次超过上限立即停止；被拒 value 不执行 NFKC、decode、JSON parse、regex 或子元素 traversal。

### 12.3 扫描投影

1. `p0 = asciiFold(NFKC(value))`；`asciiFold` 仅把 ASCII `A-Z` 映射为 `a-z`，其他 code point 不变；
2. `p1 = asciiFold(percentDecodeAsciiOnce(p0))`；decode 只接受 `%` 加两个 ASCII hex 且 byte 为 0x00—0x7F；非法或非 ASCII escape 原样保留；
3. 不递归 decode，不把 `+` 当空格；decode 后必须再次 ASCII casefold，避免 encoded uppercase 绕过；
4. 两份投影均全长扫描，不 trim，不在任一行分隔符处停止；
5. 投影只用于扫描，不替换业务值。

内部分类优先级固定为：serialized raw container、raw payload marker、conversation/archive marker、credential marker、raw identifier marker、national identifier、phone number、email address。对外只返回 `forbidden_field_blocked / sensitive_value_blocked`，不得返回分类、offset 或命中片段。

### 12.4 固定 matcher

所有 matcher 分别对 p0、p1 执行。ASCII marker 的 token boundary 固定为字符串边界或非 `[a-z0-9_]`。

- serialized raw container：仅 `field_value` mode；对投影只移除外围 ASCII whitespace 后执行标准 JSON parse，root 为 non-null object 或 array 即命中。scalar JSON 不命中本类；业务值不因 detection trim 而被接受。
- raw marker：token-bound `raw[._-]?(response|payload)`、`webhook[._-]?payload`、`api[._-]?response`、`provider[._-]?response`、`original[._-]?response`。
- conversation/archive marker：token-bound `chat[._-]?content`、`conversation[._-]?content`、`message[._-]?content`、`session[._-]?archive`、`chat[._-]?data`、`msg[._-]?data`，以及任意位置的“聊天内容”“会话内容”“会话内容存档”“会话存档”。
- credential marker：token-bound `access[._-]?token`、`corp[._-]?secret`、`encoding[._-]?aes[._-]?key`、`webhook[._-]?(secret|key)`、`archive[._-]?(secret|key)`、`session[._-]?(secret|key)`、`secret`、`credential`、`cookie`、`authorization`；以及 token-bound `bearer[ \t]+[a-z0-9._~+/-]{8,}`、`eyj[a-z0-9_-]{5,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}` JWT shape、`(sk|pk)-[a-z0-9_-]{8,}` credential-prefix shape。普通 `key-*` 与普通三段 dotted identifier 不属于 credential。
- raw identifier marker：token-bound `external[._-]?user[._-]?id`、`follow[._-]?user[._-]?id`、`corp[._-]?user[._-]?id`、`user[._-]?id`；以及 token-bound `(wm_|wo_)[a-z0-9._:@-]{3,128}`。
- national identifier：左右均不是 ASCII digit 的 15 位数字，或 17 位数字加 `[0-9x]`。
- phone：左右均不是 ASCII digit 的 `(?:\+?86[ -]?)?1[3-9](?:[ -]?[0-9]){9}`；每两个数字间最多一个 ASCII space 或 hyphen。
- email：先以固定 alphabet `[a-z0-9.!#$%&'*+/=?^_\x60{|}~@-]` 在每个 `@` 左右扩展并提取 maximal contiguous token；左右边界必须为字符串边界或 alphabet 外字符，不得从更长非法 token 截取合法 substring。完整 token 必须恰有一个 `@`；总长 3—254，local 长 1—64，只含 ASCII alnum 与 `.!#$%&'*+/=?^_\x60{|}~-`，且 dot 不在首尾、不连续；domain 至少两段，每段 1—63，只含 ASCII alnum / hyphen且首尾为 alnum；最终 label 为 2—63 个 ASCII letter。

另外在 raw marker / conversation / credential / raw identifier 的固定 pattern 后，对 p0、p1 各执行一次 forbidden assignment / query matcher：

1. candidate 左边界只能是字符串起点或 `[?&#;, \t\r\n\f{[(]`；
2. unquoted branch 在边界后直接读取 key；quoted branch 在边界后读取一个 ASCII 单引号或双引号，并要求 key 后出现同一种 closing quote；
3. key lexeme 必须完整匹配 `[a-z][a-z0-9._-]{0,63}`；
4. key 或 closing quote 后只允许 0 个或多个 ASCII space / tab，再紧跟 `:` 或 `=`；
5. lexeme 使用第 13 节同一 NFKC 后 canonical token 算法；只有 token 精确位于 forbidden registry 才命中；
6. token 所属 raw provider / conversation / credential / raw identity 分类决定内部优先级，对外仍只返回 `sensitive_value_blocked`。

该 matcher 因此覆盖 `private_key=`、`authorization_header:`、`payload=`、`archive_content=`、`mobile=`，以及 prefixed log / JSON fragment 中的 `{"private_key":...}`、`{'payload':...}` 等 registry-owned spelling；一次 ASCII percent encoding 后的 quote、underscore 与 separator 由 p1 命中。普通 key、引号不配对、缺少 separator、过长 key 或 registry 外 token 不命中。pure JSON root 仍由优先级更高的 serialized raw container matcher 命中；canonical audit envelope 的 11 个 allowed keys 均不在 forbidden registry，因此 quoted branch 不误杀合法 audit。

不得使用“高熵”“长字符串”或“长 hex”作为 credential 启发式。所有 string 还必须在 scalar parser 阶段证明是 well-formed Unicode scalar sequence；lone surrogate 固定按 `invalid_scalar_value` 阻断，不能依赖 UTF-8 replacement character。

### 12.5 canonical hash 低误报

scanner 仍运行于 digest、reference、timestamp 和 enum。

仅在 phone / national identifier 两类扫描前，为 p0、p1 分别复制临时 projection，并把以下完整 lexical atom 替换为等长非数字占位：

- `sha256:[0-9a-f]{64}`；
- `ref-(mock|demo)-[0-9a-f]{48}`。

atom 左右 boundary 固定为字符串边界或非 `[a-z0-9:_-]`。masking 只作用于 phone / national identifier 的临时副本；raw marker、credential、identifier、email 继续扫描未遮蔽的 p0 / p1，也不影响后续 grammar / integrity 校验。atom 后的行分隔符或其他 tail 不属于 atom。

因此 canonical hash 内偶然出现 11 位数字不会被误拦截；hash 后追加行分隔符与手机号、credential 或 external id 仍必须阻断。全零 digest 仍由 audit-only sentinel 规则阻断 raw input。

## 13. forbidden key 与 unknown key

extra key 先执行 NFKC、ASCII casefold，并在只含 `[a-z0-9_-]` 时移除 `_` / `-` 得到 canonical token。该分类只用于 exact whitelist 之外的 key；allowed key 不因名字含 `authorization` 或 `externalUserIdDigest` 被误杀。

forbidden registry 是以下 canonical token 的封闭集合：

| 分类 | exact canonical tokens |
| --- | --- |
| credential | `accesstoken`、`refreshtoken`、`token`、`secret`、`corpsecret`、`credential`、`cookie`、`authorizationheader`、`sessionkey`、`sessionsecret`、`webhookkey`、`webhooksecret`、`encodingaeskey`、`archivekey`、`archivesecret`、`apikey`、`privatekey` |
| raw identity | `externaluserid`、`userid`、`followuserid`、`corpuserid`、`mobile`、`mobilenumber`、`phone`、`phonenumber`、`idcard`、`identitynumber`、`email` |
| raw provider | `rawresponse`、`rawpayload`、`webhookpayload`、`apiresponse`、`providerresponse`、`originalresponse`、`payload` |
| conversation | `chatcontent`、`conversationcontent`、`messagecontent`、`sessionarchive`、`chatdata`、`messagedata`、`msgdata`、`archivecontent`、`conversationarchive` |

对象判定顺序固定为：

1. 第 12.2 节 descriptor-only resource preflight：prototype / plain object → `Reflect.ownKeys` 计数 → node / array / string-length budget；
2. 逐 key own descriptor、symbol、accessor / getter / setter 与 enumerable；
3. 对通过预算的完整 key set 分类，包括 non-enumerable key；
4. forbidden extra，按 UTF-8 byte 排序只决定内部首项；
5. required key 缺失，按 whitelist 顺序；
6. remaining unknown extra，按 UTF-8 byte 排序；
7. allowed value container 与 string scanner。

plain object 的 prototype 必须严格等于 `Object.prototype`；class instance 与 null-prototype object 都拒绝。symbol own key、accessor / getter / setter 或任一 non-enumerable own key均视为 shape failure，且 getter 调用次数必须为 0。

固定映射：

| 场景 | 结果 |
| --- | --- |
| raw extra forbidden key | `forbidden_field_blocked / forbidden_field_blocked` |
| raw ordinary extra key | `forbidden_field_blocked / unknown_field_blocked` |
| allowed scalar 承载 object / array | `forbidden_field_blocked / nested_raw_payload_blocked` |
| allowed string 承载 serialized object / array | `forbidden_field_blocked / sensitive_value_blocked` |
| trusted object forbidden extra | `forbidden_field_blocked / forbidden_field_blocked` |
| trusted ordinary shape / missing / extra | 对应 `trusted_*_contract_invalid` |
| domain output forbidden extra | `forbidden_field_blocked / forbidden_field_blocked` |
| domain output ordinary shape / type | `mapping_input_blocked / derived_output_contract_invalid` |
| audit candidate 任一失败 | `mapping_audit_not_ready_blocked / audit_not_ready` |

raw object 的 class / null-prototype / symbol / accessor / non-enumerable failure 固定为 `mapping_input_blocked / invalid_payload_shape`；trusted object 与 domain output 分别 collapse 到其对应 trusted-contract / derived-output reason。

组合 precedence 固定为：forbidden extra + missing required 返回 forbidden；ordinary unknown + missing required 返回 invalid payload shape；ordinary unknown key + allowed field 敏感值返回 unknown；allowed scalar key 承载 object / array 返回 nested raw。不得扫描 unknown key 的 value 后改变 key-level 首错。

因此 extra root `rawResponse`、`webhookPayload`、`apiResponse` 属于 forbidden，不再映射为 ordinary unknown。

## 14. audit trust frontier

audit exact key 顺序仍为：

`tenantId`、`eventType`、`reviewerRole`、`action`、`reasonCode`、`mappingStatusBefore`、`mappingStatusAfter`、`candidateDigest`、`timestamp`、`sourceKind`、`dataMode`。

初始安全投影固定为：

- tenantId=`tenant_blocked`；
- reviewerRole=`domain_system`；
- action=`input_blocked`；
- before / after=`not_evaluated`；
- candidateDigest=零值 digest；
- timestamp=`1970-01-01T00:00:00.000Z`；
- sourceKind / dataMode=`input_blocked`。

字段只能在对应 trust frontier 后提升：

- guard 1—4 全通过后，才可提升 action、occurredAt 和 review / disable reviewer role；generation reviewer 始终为 `domain_system`；
- guard 5d 后提升 source / mode；
- guard 5f 全 tenant binding 后提升 tenant；tenant mismatch 继续使用 sentinel；
- aggregate status / reason 唯一 pair 与 history current-state binding 全部通过后，才可使用当前状态；pair mismatch 仍使用 `not_evaluated`，不能只取格式合法 status；
- candidate digest 严格沿用 PR #522 的 5i frontier；disable 永远使用零值。

任一 blocked path 在可信状态已提升后固定 `mappingStatusAfter=mappingStatusBefore`。tenant、source / mode、status 与 digest 只能从各自已通过的 frontier 取值，不能从另一个尚未验证的 trusted object 补值。

normal audit 失败时 mutation 不提交，统一返回 `mapping_audit_not_ready_blocked / audit_not_ready`，并使用进入 normal factory 前的 last-safe projection。若该 dynamic projection 自检仍失败，必须退回完整初始 sentinel，只把 event / reason 设置为 `mapping_audit_not_ready_blocked / audit_not_ready`。compile-time-safe blocked event 在 domain 初始化时自检；自检失败则 factory 不返回可调用 domain instance，也不返回 partial result。

canonical audit serializer 必须先创建一个按第 14 节 11-key 顺序插入 data property 的新 plain object，再使用 ECMAScript `JSON.stringify(object)`、无 replacer、无 indentation 产生唯一 envelope；不得接受调用方字符串或任意 JSON 进入 audit mode。随后使用 `canonical_audit_envelope` 扫描，避免把安全 audit 外层 JSON 本身误判为 raw payload；其中任一字段的敏感内容仍会阻断。

## 15. 新增固定 event / reason

本修订增加：

- event `mapping_candidate_generation_empty`，reason `no_eligible_candidate`；
- reason `history_capacity_exceeded`；
- reason `source_scope_history_capacity_exceeded`；
- reason `non_monotonic_occurred_at`；
- reason `source_scope_state_invalid`、`source_scope_index_capacity_exceeded`；
- reason `generation_cursor_mismatch`、`generation_incomplete`、`aggregate_lineage_mismatch`。

对应固定映射：

| 场景 | event | reason | 状态 |
| --- | --- | --- | --- |
| manifest 为空的合法 generation | `mapping_candidate_generation_empty` | `no_eligible_candidate` | `unmatched → unmatched` |
| history 容量 / version 达上限 | `mapping_input_blocked` | `history_capacity_exceeded` | 当前可信状态不变 |
| scope-wide history entries 2,000→2,001 | `mapping_input_blocked` | `source_scope_history_capacity_exceeded` | 当前可信状态不变 |
| existing state 时间不单调 | `mapping_input_blocked` | `non_monotonic_occurred_at` | 当前可信状态不变 |
| scope index shape / digest / completeness 失败 | `mapping_input_blocked` | `source_scope_state_invalid` | 未可信时 `not_evaluated`，否则当前状态不变 |
| scope index version 达上限 | `mapping_input_blocked` | `source_scope_index_capacity_exceeded` | 当前可信状态不变 |
| generation selector 跳项 / 重放 | `mapping_input_blocked` | `generation_cursor_mismatch` | 当前可信状态不变；首次为 `unmatched → unmatched` |
| manifest 尚未完整生成却推进 review / regeneration | `mapping_input_blocked` | `generation_incomplete` | 当前可信状态不变 |
| selected record 与 aggregate / target / history material lineage 不一致 | `mapping_input_blocked` | `aggregate_lineage_mismatch` | 当前可信状态不变 |

## 16. 验收测试矩阵补充

### 16.1 manifest / generation

- empty manifest + null selector；非空 manifest + null selector；空 manifest + 非空 selector；不存在 / 重复 selector；
- factory manifest 0 / 1 / 100 / 101 项，pair / reference 重复、排序不稳定、expected fingerprint 错配；intrinsic failure 全部只返回 initialization blocked；
- registry snapshot 非 plain object、bundle 缺键 / 多键、digest / source scope 重复、同 scope 多 revision、factory deep-freeze 与无 callback / side effect；
- factory dependency / snapshot shape、resource、scanner、digest、cross-binding 任一失败只返回 exact frozen `MappingDomainInitializationBlocked`，无 dynamic error / partial instance / mapping audit；
- manifest 外 score=100 仍不生成；manifest 内 low / medium / high 均不自动 matched；
- contact sync / source mapping / manual review admissible state 与 customer active state 的逐项正负矩阵；
- 完整 source 删除、添加、替换、重排，验证 snapshot 与 manifest binding；
- cursor 0→N、跳项、重放、stale scope state、generationComplete=false 时 review / regeneration 阻断但 processed mapping disable 成功；多 entry 逐项调用仍基于完整 manifest 识别双向 conflict；
- 同 pair / evidence、同 pair / 新 evidence、不同 pair / 同 evidence 的 mappingReference v2 vectors；
- 携带旧 runtime state 时 new evidence / registry revision 固定阻断；另行断言“删除全部 state 后 pure domain 无法证明旧历史”是明确 threat-model boundary，不编写虚假的跨 instance 防回滚测试；
- selector 不能覆盖 pair digest、evidence、score、origin、type 或 version。

### 16.2 evidence / score

- Levenshtein 的 ASCII、中文、多字节、组合字符、emoji、大小写和标点 known-answer vectors；lone surrogate 固定阻断；
- 九个 evidence 逐项 true / false，tag intersection 去重与 UTF-8 排序；
- manifest-owned mock customer boolean 不能由 source substring 或 reference 推导；
- score 49 / 50 / 79 / 80 边界；score 只影响 level，不影响 manifest eligibility；
- expected fingerprint 与重算值不一致时 provenance fail-closed。

### 16.3 state / history / atomicity

- initial generation 的 scope version 0→1、aggregate / candidate / history version 1；empty manifest 也固定 scope version=1、cursor=0、records/mappings=[]；后续 cursor、existing generation 与 review 的严格 +1；
- 2—100 entry 的每次 nextState 都保留全部既有 aggregate / target / history；source-scope mapping / record append 或 selected replacement时，其他 mappings / records deep / CE byte equal，并覆盖 scope index digest known-answer；
- `manifestEntryReference`、`candidatePairDigest`、`mappingReference`、非 null `candidateDigest` 的现有、prospective append / replacement uniqueness；重复固定 `source_scope_state_invalid`；
- review mappingReference 的 wrong grammar / 0 命中 / duplicate state / cross-scope 与 target-present candidateDigest mismatch；disabled mapping 必须跳过 candidate lookup并稳定返回 `invalid_state_transition`；
- non-monotonic occurredAt、history 999→1000 接受、1000→1001 阻断；
- history chain before=previous after、严格时间、last snapshot / aggregate / record binding，以及含 initial / review / disable 的 history digest known-answer；
- mappingReference 在同 material lineage 内不变，target createdAt 仅 generation 改变；
- 每个动作的 target flags、resultKind / output / audit 唯一矩阵、history snapshot 与 aggregate / scope record binding；
- disable 在 generationComplete=false 可选择 processed prefix；containment oracle 不解析 registry / manifest、不读取 selected target，并覆盖 target getter / 损坏值、selector 不存在、selector 重复、跨 tenant、already disabled 与其他 mappings 原样保留；恶意 target getter + auditReady=false / non-monotonic / capacity blocked 时用 descriptor identity 证明零调用、零 mutation，不要求非法 target CE 编码；
- containment 双重失败 precedence：auditReady=false 优先 already-disabled，already-disabled 优先 non-monotonic 与 history / scope / index capacity，其余按第 9.8 节 1—12 顺序；
- method/state 全矩阵覆盖 null、完整 runtime state、旧 SourceScopeOnly / NewAggregate / ExistingMapping state 及 arbitrary object；
- derived output、audit、history 或 nextState 任一 factory 失败均零 partial mutation；
- blocked result keys 恰为 `ok,auditEvent`；普通输入 state 深等 / CE byte equal，containment 非法 selected target slot 按第 10.3 节 descriptor identity 例外断言，committed 与 blocked result 均 recursive frozen。

### 16.4 scanner / key taxonomy / audit

- NFKC、ASCII casefold、一次 percent decode 后再次 casefold、encoded uppercase / separator / mixed plain near-miss；
- structural budget 对 object 64 / 65 keys、known array 上限 / +1、scope history 2,000 / 2,001、单 string 4,096 / 4,097 做边界测试；factory graph 覆盖 node 2,000,000 / +1 与 string 32,000,000 / +1，method graph 覆盖 node 500,000 / +1 与 string 8,000,000 / +1；每类同时提供恰好满足全部 local + aggregate contract 的最大合法 graph 接受样本，超限后 NFKC / decode / JSON / regex / getter / 后续 element 访问次数均为 0；
- LF / CRLF / U+2028 / U+2029 后的 phone、credential、external id 全长扫描；
- serialized raw object / array 及 percent-encoded object / array 在 field mode 阻断，JSON scalar 不误判，canonical audit envelope 不因外层 JSON 误杀；
- 多重命中按固定分类优先级，但 public result 不含 category、offset 或片段；
- 10,000 个固定 seed canonical SHA-256 / mapping reference 不因随机数字 run 误杀；
- 显式构造内含手机号与证件号数字 run 的 canonical hash known-answer；hash 后追加敏感内容仍阻断；uppercase、63 / 65 hex、全零由 grammar 独立阻断；
- forbidden registry 每类 key 的 camel / snake / hyphen / fullwidth / mixed-case 变体；
- forbidden registry 每个 canonical token 的 assignment / query plain、camel、snake、hyphen 与一次 percent-encoded separator；逐项断言 registry 外 key、无 separator、左边界不合法、64 / 65 字符 key near-miss；
- quoted assignment 覆盖 prefixed / suffixed 双引号、单引号、array / object log fragment、percent-encoded quote / underscore / separator、引号不配对与 registry 外 quoted key；canonical audit JSON 必须保持通过；
- credential positive / near-miss 覆盖 `sk-`、`pk-`、`eyj...` JWT、普通 `key-*` 与普通三段 dotted identifier；
- email 按 maximal token 覆盖前后 ASCII letter、dot、plus、underscore、中文与标点边界，禁止从更长非法 token 截取合法 substring；
- exact allowed `authorization`、`externalUserIdDigest` 不被 key registry 误杀；
- forbidden + missing、ordinary unknown + missing、unknown + sensitive value、allowed scalar + nested container 的固定 precedence；
- symbol、getter / setter、non-enumerable extra、class instance、null prototype，且不得执行 getter；
- candidate-bound review 逐项覆盖 allowed scalar 承载 nested `rawResponse` / `webhookPayload` / `apiResponse` object，以及 `candidateDigest` 承载 phone / secret / raw externalUserId；均在 grammar / target lookup 前阻断且 audit digest 为零值；
- candidate-bound review 对 `tenantId` 与 `occurredAt` 分别覆盖 `LF + phone`、`LF + secret`、`LF + wm_/wo_ externalUserId`，并对 CRLF / U+2028 / U+2029 做同类矩阵；sensitive scan 必须先于 tenant / timestamp grammar，audit 不回显 input；
- mappingReview / mappingDecision / mappingConflict 每个 string 字段的 scanner 注入；
- 每个 event / reason 的 safe canonical envelope sweep，以及每个 audit string 字段逐项敏感注入；
- normal audit shape / scanner / grammar 失败统一 audit_not_ready，dynamic projection 失败使用全 sentinel；blocked constructor 自检失败时 factory 不返回实例；
- blocked audit 的 11 keys、完整 fallback values、trust frontier、canonical stringify 和单事件规则。

## 17. 实现前置条件

只有本文通过独立人工审查并合并后，才可重新授权 05C-E1 runtime 实现。实现仍须：

1. 从最新 main 新建干净分支；
2. 不复制、不 cherry-pick、不复用原 WIP；
3. 测试先于实现；
4. 仅新增隔离的 mock mapping domain 与测试；
5. 不修改 API、UI、repository、schema、migration、seed、package 或 lock；
6. 在排除 `.env*` 的 `/tmp` 镜像执行 typecheck、定向测试与 audit scan；
7. 未获得后续明确授权前，不 commit、不 push、不创建代码 PR；
8. 不进入 05C-E2。

## 18. 非目标

- 真实企业微信 provider 或任何外部调用；
- 外部联系人真实同步；
- 真实客户匹配算法、机器学习、拼音或模糊搜索服务；
- 数据库、repository、schema、migration、seed；
- API、UI、平台治理页面；
- 会话内容或会话内容存档；
- 自动合并、批量 approve、真实客户关系写入；
- 05C-E2 或 05D。

本文仅完成 05C-E1 runtime 契约缺口收口，不代表上述能力已经实现。
