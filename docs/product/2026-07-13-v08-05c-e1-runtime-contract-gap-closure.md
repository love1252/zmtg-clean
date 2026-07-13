# V0.8 05C-E1 mock customer mapping runtime 契约缺口收口

- 日期：2026-07-13
- 任务编号：`ZMTG-05C-E1-RUNTIME-CONTRACT-GAP-CLOSURE-DOC-20260713`
- PR #523 修订任务：`ZMTG-PR523-RUNTIME-CONTRACT-GAP-CLOSURE-FIX-20260713`
- 文档性质：docs-only 设计修订，不代表 runtime 已实现，不构成 05C-E2 开发授权
- 前置文档：PR #522《V0.8 05C-E1 客户匹配 mock domain 重新设计方案》

## 1. 结论摘要

05C-E1 继续限定为受控 mock / demo customer mapping domain。本修订只补齐实现前仍不确定的契约：候选准入、证据与评分、单次命令基数、可信 fixture registry、运行时状态与历史、事务返回、scanner、audit 和测试闭包。

本修订不实现代码，不调用企业微信，不真实同步外部联系人，不读取会话内容，不接入会话内容存档，不连接数据库，不写真实客户关系，不自动合并客户，也不进入 05C-E2。

本修订采用以下核心决定：

1. 候选准入只由不可变的 `CandidateManifest` 决定，不实现通用 fuzzy matcher。
2. 非空 manifest 的一次 `generate_candidate` 只处理其中一个受控 pair，并对应一个 aggregate、一个 target 和一个 audit event；empty manifest 走 committed `no_candidate`，只产生空 source-scope state 与一个 audit event，不产生 aggregate 或 target。
3. generation 仍校验完整 source snapshot；pair selector 只是 registry 中的不透明引用，不能创建或覆盖 candidate identity。
4. `mappingReference` 升级为 material-lineage-stable 的 v2 算法，绑定 pair 与 evidence，而不绑定时间或可变 metadata。
5. 所有 command 都是 pure reducer：先构造完整 draft、derived output 与 audit，再一次性返回 committed state；失败时不返回任何 partial mutation。
6. scanner 对所有字符串统一执行；phone / national-id 的窄 mask 只由 schema-owned semantic path开启：raw opaque selector先证明完整 anchored grammar，trusted / derived digest再证明 recomputation/integrity，ordinary field中的 hash-looking atom永不获得 lexical豁免。

## 2. 与 PR #522 契约的关系

PR #522 中未被本节明确修订的状态机、guard 顺序、tenant、timestamp、digest、lineage lock、domain output 和 fail-closed 规则继续有效。

以下条款由本文取代：

- generation、candidate-bound review 与 disable raw command 的 exact keys；
- `FixtureRegistryEntry` 的 exact keys 与 registry digest preimage；
- generation 的 candidate eligibility、evidence、score、cardinality 和空候选语义；
- `mappingReference` v1 算法；
- `candidateDigest` v1 preimage、known-answer vectors 与逐字段绑定测试；本文统一替换为 candidate v2；
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

factory 只对 module-owned snapshot / bundle / manifest 做验证；其对象缺失、增删、排序后重复、digest 错配或 cross-field 不一致一律按第 8.1 节返回 `MappingDomainInitializationBlocked`，不能产生可调用 domain。外部自签 snapshot 不进入这条验证链，而是在 public factory arity gate 直接阻断。只有 factory 成功后，package-private reducer 对私有 frozen bundle 的 lookup 失败，或 captured raw command / internal capability / runtime state 与该已验证 bundle 的 source、manifest、registry binding 不一致，才返回 `mapping_input_blocked / untrusted_fixture_provenance`。

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

manifest 自身出现重复 reference / pair 属 factory initialization failure，不进入 command reason 体系。domain 已成功初始化后，initial 或 generationComplete state 的 raw selector 与 frozen manifest expected reference 不一致、未命中或重放，固定按 `generation_cursor_mismatch` 阻断；incomplete state 只有 selector 等于当前 cursor entry 才作为 continuation，其余 selector 固定优先 `generation_incomplete`。no-candidate 只允许首次 empty scope command。

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

package-private preflight result `ValidatedDisableContainmentProjection` 的 exact allowed keys 修订为：

`tenantId`、`sourceScopeRuntimeState`、`auditReady`。

该projection只由第8.1节public wrapper内部的audit preflight生成，先供issuer签发opaque capability，随后即丢弃；它不是capability carrier，不与capability exact slots合并，也不作为package-private reducer参数。public caller只提交raw command与state。projection不含registry、readiness、authorization、provider或单独的target。domain以raw `mappingReference`在runtime state envelope中选择mapping；containment专用oracle不遍历、扫描或执行selected mapping的target value，即使该target缺失、损坏或带不安全getter，disable也只依赖被选aggregate、history、scope record与完整index。内部`auditReady`仍须严格为true。

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

low 进入 `manual_review_required / low_confidence`；medium / high 进入 `candidate / candidate_evidence_available`。该 status/reason 分流是 confidence 唯一允许的 persisted **提示投影**：两类使用完全相同的人工 review action allowlist、authorization/provider/sync guards与 audit要求，不改变 manifest eligibility，不允许自动 transition。任何等级都不能自动进入 `matched`。除排序、解释、人工提示及上述等价行为的展示状态外，confidence 不是自动匹配、auto-approve、action authorization 或写入真实客户关系的依据。

`confidenceScore` 与 `confidenceLevel` 只能由 module-owned evidence scorer 从已验证 evidence 重算，不能从 command、fixture target、runtime state 或 historical target 继承。target 中携带的 score / level 只是待验证的冗余投影；重算值与任一投影不一致时固定按 `mapping_input_blocked / trusted_target_integrity_invalid` fail-closed，不能选择信任输入或静默覆盖后继续 mutation。

本修订同时以 `candidateDigest` v2 取代 PR #522 的 candidate v1 preimage。domain separator 固定为 `zmtg:05c-e1:candidate:v2`，preimage 依次为：

1. `candidateVersion`；
2. `tenantId`；
3. `mappingReference`；
4. `candidatePairDigest`；
5. `evidenceFingerprint`；
6. 重算的 `confidenceScore`；
7. 重算的 `confidenceLevel`；
8. candidate 创建时由 score / conflict 规则唯一推导的 `mappingStatus`；
9. 与该创建状态唯一配对的 `reasonCode`；
10. `sourceKind`；
11. `dataMode`。

domain separator 使用 `LP`，其他字段使用 `CE`，结果为 `sha256:` 加 64 位小写 hex。preimage 第 8、9 项的正式派生名为 `candidateOriginMappingStatus` 与 `candidateOriginReasonCode`，来源是与 current `candidateVersion` 唯一对应、按 historySequence 最近的一条 `generate_candidate` history entry；同一 candidateVersion 缺少或出现多条 generation entry 均为 history invalid。origin pair 中 generation medium / high 为 `candidate / candidate_evidence_available`，low 为 `manual_review_required / low_confidence`，conflict 为 `conflict / mapping_conflict`。后续 review 改变的是 aggregate current state，并由 aggregate、完整 history 与 scope index 共同证明，不重写 candidate-origin pair 或 candidate digest；regeneration 才以增加后的 candidateVersion 和重新计算的 evidence / confidence / origin pair 产生新 digest。5i 必须同时重算 evidence、score、level、origin status / reason 与 v2 digest，再验证 target、对应 generation history entry 与 scope record 的绑定。格式合法的 v1 digest、保留 digest 但篡改 score / level、或 score / level band 自洽但与 evidence 不一致，都必须 fail-closed。

## 6. conflict 分组

conflict 只在已验证 manifest entries 上计算。

对当前 pair `p`：

- `E(p)`：与 `p` 具有相同 `externalContactDigest` 的 manifest entries；
- `S(p)`：与 `p` 具有相同 `systemCustomerDigest` 的 manifest entries。

当 `|E(p)| > 1` 或 `|S(p)| > 1` 时，当前 pair 为 conflict。

`unresolvedConflictCount` 固定为 `|(E(p) ∪ S(p)) - {p}|`。manifest 上限为 100，因此 generation conflict count 固定为 1—99。

本文以 1—99 取代 PR #522 对 target、`MappingConflict` 与 `ConflictLineageLockRecord` 的 1—100 上限：generation 永远不能产生 100，manual `mark_conflict` 固定从 1 开始，conflict clear 只能保留既有 1—99。任何 input/history/containment state 中 self-consistent 的 100仍为 contract invalid，不能因 hash 自洽而接受。

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

runtime public surface 固定为一个 zero-argument factory 返回三个 application wrapper method。wrapper 是唯一可调用入口；携带 trusted capability 的 reducer 留在 package-private 闭包内，不从 public barrel 导出：

```ts
declare function createWeComCustomerMappingDomain():
  | WeComCustomerMappingDomain
  | MappingDomainInitializationBlocked;

type MappingDomainInitializationBlocked = Readonly<{
  ok: false;
  reasonCode: "fixture_registry_initialization_blocked";
}>;

type WeComCustomerMappingDomain = Readonly<{
  generateCandidate(
    rawCommand: unknown,
    state: unknown,
  ): MappingCommandResult;
  reviewCandidate(
    rawCommand: unknown,
    state: unknown,
  ): MappingCommandResult;
  disableMapping(
    rawCommand: unknown,
    state: unknown,
  ): MappingCommandResult;
}>;
```

package-private reducer 的实际签名固定为三参数 `(capturedCommandCarrier, capturedStateCarrier, trustedCapability)`；generate、review、disable 三个内部 method 都使用同一签名。`capturedStateCarrier` 对 initial generation 只能是内部 `null` sentinel，其他路径是同一次 wrapper capture 产生的 state carrier；`trustedCapability` 只允许第 8.1 节固定 slots。`ValidatedDisableContainmentProjection` 只存在于 wrapper 的 audit-preflight → issuer 阶段，不传给 reducer，reducer 也不接受第四参数、public context 或调用方 object。

public factory 不接收 dependencies、snapshot、registry、authorityKind、manifest、records 或 digest。runtime 必须检查调用参数数量严格为 0；普通调用方即使绕过 TypeScript 类型并传入一份自洽的 `authorityKind + bundles + manifest + records + digest` object，也只能得到固定 `MappingDomainInitializationBlocked`，不能把该 object 提升为 trusted registry。三个 public method 的参数也只能是 raw command 与 state；调用方不能提交 readiness、authorization、provider、sync、auditReady 或 capability。不得注入 clock、logger、repository、provider、network client、audit sink、resolver callback 或 state writer。parser、scanner、hash、audit、history、source-scope index、conflict constructor 与 registry bootstrap 均由 module owning。

本修订选择 **module-owned registry**，不采用外部 composition-root snapshot 注入：完整 registry 只能由模块内部不可导出的 fixture literals 与封闭 constructor 生成，constructor、raw literals、snapshot replacement seam 和 registry mutation seam 都不属于 public surface。模块初始化时先从内部 literals 构造独立 null-prototype data carrier，再重算 manifest、records 与所有 digest；`authorityKind` 只是被验证的内部版本 discriminator，不是 provenance 证明。可信根来自 module ownership 与不可导出的 bootstrap identity，不能来自与待验证 payload 同源的字符串或 digest。外部调用方不能替换、扩展、重排或自行签署 snapshot；若未来改用 composition root，必须另立契约定义不可伪造 capability、唯一可信边界及进入 domain 前的 provenance 验证，不能在本 API 中顺手恢复 snapshot 参数。

`readinessContext`、authorization/provider/sync attestation 与 containment `auditReady` 也不能因普通 object 或 canonical JSON parse 成功而变成 trusted。它们只能由 module-private trusted-context issuer 根据内部 preflight / audit factory 结果生成 frozen capability carrier；issuer、package-private reducer 与 capability identity registry 都不属于 public API。普通调用方不能取得 reducer reference，不能提交 context，也不能请求指定 authorized/provider/sync/auditReady 值。issuer 构造新 carrier 时原子登记到 domain-instance-lifetime 的 module-private `WeakSet`，登记后永不删除、consume、revoke 或替换；同一 carrier identity 在 domain instance 生命周期内的 membership 恒定，reducer只有只读 membership 权限。因此相同 captured carrier、capability 与 immutable registry 总是产生相同结果，不依赖“注册前/释放后”状态。内部测试 seam 收到未登记 carrier时固定 `trusted_readiness_contract_invalid` / `trusted_disable_context_invalid`，且不得读取其自报值。structural validity 本身不授予 authority。

该identity registry只记录不可伪造provenance，不是persisted business state，也不参与result、digest、version、history或audit projection；public wrapper每次调用构造一枚新carrier，输出不得依赖registry大小、调用历史或其他carrier是否存在。故observable command transition仍由相同captured command/state与immutable module registry唯一决定，package-private reducer本身不写issuer registry。

合法调用路径固定为：public application wrapper 对 raw command / state 各做且只做一次第 12.2 节 capture，得到 parser-owned carrier；同一 captured Proxy oracle、alias set、node/string/work counter 与 canonical transport cursor贯穿 preflight、issuer、package-private reducer、prospective output 和 audit，任何阶段都不得二次读取原对象或重置预算。wrapper把同一 captured carrier交给 module-owned mock preflight或 audit preflight；issuer只从这些内部结果派生 tenant、source/mode、authorization/provider/sync或 auditReady，不接受 HTTP/UI caller提交对应布尔，并在同一调用栈把 opaque capability与 carrier交给 reducer。

capability 内部绑定固定使用 `zmtg:05c-e1:trusted-invocation:v1`：依次 `CE` 编码 method name、tenantId、sourceScopeReference、occurredAt、按该 action exact-key 顺序编码的完整 captured raw command、以及 captured state 的 `indexDigest`；initial `state=null` 使用固定零值 digest。结果记作 `commandBindingDigest`。carrier 的固定内部 slots 为 `capabilityKind,method,tenantId,sourceScopeReference,occurredAt,commandBindingDigest,stateIndexDigest,readinessState`；`readinessState` 对 generate/review 是内部 authorization/provider/sync enum tuple，对 disable 只有 audit preflight enum，不是调用方 boolean。reducer先检查不可伪造 identity，再用同一 captured carrier重算绑定；任一 field、method、state或顺序不一致固定按对应 trusted-context reason阻断。generation/review/disable positive tests必须通过 public wrapper取得合法路径；internal seam 还必须证明普通 object、JSON round-trip、自建 null-prototype或字段完全自洽的 forged carrier均不可签发 authority。

factory 的 zero-argument gate、module-owned bootstrap provenance、resource budget、scanner、fixture exact-shape、canonical digest 或 cross-binding 任一失败时，不抛出带 input / path / cause / stack 的动态错误，也不返回半初始化 instance；只返回 recursive-frozen、exact keys 为 `ok,reasonCode` 的固定 `MappingDomainInitializationBlocked`。factory 尚未产生 command invocation，因此该结果不伪造 mapping audit event，也不得回显外部伪造 payload。固定 blocked object 必须在 module 初始化时自检；自检失败则 module 不暴露 factory。

方法与 raw action 不一致时固定返回 `mapping_input_blocked / invalid_action`。

### 8.2 FixtureRegistrySnapshot

不接受带回调的 structural resolver，也不接受调用方 snapshot。factory 只读取 module-owned bootstrap 产生的一份完整、可枚举的本地 snapshot，并在返回 domain instance 前完成全量 provenance、exact-shape、scanner、digest、cross-binding、deep clone 与 recursive freeze。验证期间使用的 raw bootstrap graph 不导出；成功 instance 只闭包持有验证后的私有 clone。

`FixtureRegistrySnapshot` exact allowed keys：

`authorityKind`、`bundles`。

- `authorityKind` 必须严格为 `controlled_fixture_registry_v2`，但该值本身不授予任何 authority；只有 module-owned bootstrap identity 才能建立 provenance。
- `bundles` 为 1—100 个 `FixtureRegistryBundle`。

`FixtureRegistryBundle` exact allowed keys：

`entry`、`externalContacts`、`systemCustomers`、`candidateManifest`。

factory 必须对所有 bundle 重算 source、manifest 与 registry digest，并全局证明：

- `fixtureRegistryDigest` 唯一；
- `sourceScopeReference` 唯一；
- tenant / source scope / source kind / data mode / snapshot / manifest 全量交叉绑定；
- 同一 domain instance 中不存在 default tenant、最近 entry 或 global fallback。

snapshot 没有 register / set / update / delete，也不连接 provider、数据库、文件外 registry 或网络。package-private reducer 只在其私有 frozen map 中按已验证 digest 唯一查找；`disable_mapping` 永远不读取该 map。

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
| generate | runtime state + `generationComplete=false` + selector 等于 `entries[generationCursor]` | 合法 continuation；只追加该项 |
| generate | runtime state + `generationComplete=false` + selector 不等于当前 cursor entry | 固定 `generation_incomplete`；不得先报告 cursor、target 或 candidate 错误 |
| generate | runtime state + `generationComplete=true` | 只允许选择 `stale / candidate_expired` 或 `manual_review_required / review_reopened` 的 existing mapping 做同 material lineage regeneration |
| generate | initial 或 `generationComplete=true` 时 selector 跳项、重放、不存在或 null + non-empty manifest | `generation_cursor_mismatch` |
| review | `state=null`、空 object、malformed state 或非 `SourceScopeRuntimeState` | `source_scope_state_invalid` |
| review | exact-valid runtime state + `mappings=[]` | mappingReference 0 命中，固定 `aggregate_lineage_mismatch` |
| review | runtime state + `generationComplete=false` | `generation_incomplete` |
| review | runtime state + `generationComplete=true` | mappingReference 先唯一选择 mapping；disabled mapping 跳过 candidate lookup并由 `invalid_state_transition` 阻断，其他 target-present 状态再校验 candidateDigest |
| disable | context 缺失完整 runtime state 或 shape / intrinsic binding 失败 | `source_scope_state_invalid` |
| disable | runtime state + `generationComplete=false` | 允许 containment，只能选择 processed prefix 中已经存在的 mapping |
| disable | 前置 parser / context / state / tenant / selector / auditReady 全通过，selected mapping 已 disabled | `mapping_already_disabled`，优先于 non-monotonic 与 capacity |
| disable | 空 scope 或 selector 未命中 processed record | `aggregate_lineage_mismatch` |

任意旧的 `SourceScopeOnlyState`、`NewAggregateState`、`ExistingMappingRuntimeState` 或其他 object shape 都不再属于 public state union，统一按 `source_scope_state_invalid` 阻断。Existing regeneration 不改变 generationCursor，只替换同位置 mapping / record；新 evidence fingerprint 不允许写回 existing aggregate，本 snapshot 又不可变，因此 05C-E1 不提供跨 revision new-evidence migration。Incomplete scope 中唯一可成功的 generation 是当前 cursor continuation；任何选择 processed、future、missing 或 null entry 的尝试都先按 `generation_incomplete` 阻断，不能被重新解释成 existing regeneration 或 cursor mismatch。

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
- 非 disabled current state 中，aggregate candidate / pair / evidence digest 必须与最后适用的 target snapshot 和 scope record 绑定。
- disabled current state 使用专用双层绑定：当前 aggregate 与同位置 scope record 的 `candidateDigest` 都必须严格为 `null`（记作 derived `disabledCurrentDigest=null`）；最后一个非 disable history entry 的 immutable target 保存非空 `historicalCandidateDigest`，其 pair / evidence / mapping reference 必须与当前 aggregate、record 及全部历史逐项一致。`historicalCandidateDigest` 只从 history 的最后可信 target 推导，不新增可由调用方填写的字段，也不得复制回 current aggregate / record。disable entry 固定 `targetSnapshot=null`，historyDigest 继续覆盖此前 immutable target 和 disable entry，从而同时证明 historical digest 与 current null。

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

PR #522 的 step 5 扩展并重排为：

- 5a outer/index capture：internal capability shell → `SourceScopeRuntimeState` outer shell → `SourceScopeRuntimeIndex` / nested LineageLockIndex → records → mappings array container。这里只完成证明`generationComplete`可信所必需的exact shape、scanner、scalar、index/hash、records/mappings cardinality、selector uniqueness与generationCursor binding；不读取任一mapping element、aggregate、history、target或evidence。outer/index中ordinary string完成全部scanner；digest/reference slot完成非phone/national-id分类、anchored grammar与shell-local hash，并把数字run结果保存为第12.5节`deferred_trusted_shell` pending bit，不mask、不提升material integrity、不回显。outer/index failure为`source_scope_state_invalid`。
- 5e：非 containment 动作在 module-owned registry provenance 通过后，把 scope index 的 registry / manifest / source scope、generationCursor、generationComplete 与 frozen bundle 及完整 manifest prefix 绑定。
- 5f.0：只绑定 root、module-issued readiness 与 scope index 的 tenant、source kind 与 data mode。raw `tenantId` / `occurredAt` 的 sensitive scan 与 grammar 已在 guard 1—4 完成；这些失败不能被 completeness、selector 或 candidate reason 覆盖。mapping / target cross-binding 尚不执行。
- 5g.0 completeness gate：review 在 `generationComplete=false` 时固定 `mapping_input_blocked / generation_incomplete`，不读取 raw mappingReference 对应 target，不执行 target integrity 或 candidate lookup。generate 在 incomplete state 且 selector 正好等于 `entries[generationCursor]` 时被分类为合法 continuation；只要 selector 不是当前 cursor entry，无论它指向 processed entry、future entry、missing entry、null 或同时构成 cursor mismatch，都固定 `generation_incomplete`。existing regeneration 只有 `generationComplete=true` 才可分类。disable 跳过 completeness gate。
- 5g.1 generation selector：该步只使用 frozen manifest 与 5a 已验证 records，不读取 mappings element。initial non-empty generation 必须选择第 0 项；incomplete continuation 已由 5g.0 证明等于当前 cursor；complete existing regeneration 必须先在 manifest 与 records 中唯一选择同位置 existing record。只有 initial 或 complete state 的 selector 跳项、重放、不存在或 null 才返回 `generation_cursor_mismatch`，且必须早于 mapping / target capture。record 0 命中或位置不一致为 `aggregate_lineage_mismatch`，records 重复已在 5a 固定为 `source_scope_state_invalid`。manifest 重复属于 factory initialization failure，成功创建的 domain 中不可达。
- 5h method-specific record selection：review 仅在 completeness gate 通过后，以 raw `mappingReference` 在已验证 records 中唯一选择 record 与 mapping index，但仍不读取同位置 mapping shell；0 命中固定 `aggregate_lineage_mismatch`，多命中已在 5a 固定为 `source_scope_state_invalid`。existing regeneration 沿用 5g.1 选中的 record/index；initial / incomplete continuation 没有 existing mapping，只使用 conceptual `unmatched` before state。
- 5h.1 post-selector mapping capture：只有5g.1 / 5h的selector reason已唯一确定后，才按mappings顺序捕获并验证aggregate → history → target / evidence的exact shape、scanner、hash与intrinsic binding，再完成每个mapping的tenant / source / mode cross-binding，并把selected record与同位置mapping绑定。此时必须逐个resolve 5a的`deferred_trusted_shell` pending bit：grammar与material recomputation/cross-binding成功才允许整值mask，失败固定对应trusted integrity/lineage reason；任何pending未resolve都禁止commit、output或audit提升。incomplete blocked、initial/complete generation wrong selector、review 0-hit path则丢弃pending carrier并使用零值audit，不触碰mapping element；因此target corruption、candidate mismatch、target tenant漂移或digest中偶然数字run都不能覆盖`generation_incomplete` / `generation_cursor_mismatch` / `aggregate_lineage_mismatch`。随后才绑定aggregate current status / reason、history、record与target-presence真值表。
- 5i：existing selected mapping 为 target-present 状态时，必须从可信 source 与 target evidence 重算 pair、evidence fingerprint、confidenceScore、confidenceLevel、与 current candidateVersion 唯一对应的最近 generation history entry 所证明的 candidate-origin status / reason、candidateDigest v2 与 mappingReference，并验证 target、scope record和适用 lock 的完整绑定；任一 score / level、origin 或 digest 漂移固定 `trusted_target_integrity_invalid`。disabled 状态跳过 current target 重算并使用第 9.5 节 current-null / historical-non-null 绑定；其 history shape/hash/chain failure 为 `source_scope_state_invalid`，shape-valid cross-bind failure 为 `aggregate_lineage_mismatch`。initial / incomplete continuation 只有在 5g.1 通过后才构造 prospective pair / evidence / confidence / target / mappingReference。
- 5j：只对 candidate-bound review 且 selected mapping 为 target-present 状态，用 raw candidate digest 与 5i 的可信 target 完全相等比较；不相等固定 `candidate_target_not_found`。disabled 状态跳过 5j，再由 state-transition guard返回 `invalid_state_transition`。

确定性 precedence 固定如下；同一 invocation 命中多项时只能报告表中首项：

| 优先级 | 条件 | 固定结果 |
| ---: | --- | --- |
| 1 | public carrier / parser / exact-key / sensitive scan / scalar grammar 失败，包括不安全 tenantId 或 occurredAt | 对应既有 parser / forbidden / invalid scalar reason |
| 2 | runtime outer/index、registry provenance、root/readiness/index tenant / source / mode binding 失败 | 对应 `source_scope_state_invalid`、`untrusted_fixture_provenance` 或既有 binding reason；不含 mapping/target integrity |
| 3 | review 的 generation incomplete；或 incomplete generation selector 不是当前 cursor entry | `generation_incomplete` |
| 4 | initial / complete generation selector mismatch | `generation_cursor_mismatch` |
| 5 | mapping / record selector 0 命中或 lineage 不一致 | `aggregate_lineage_mismatch` |
| 6 | target / evidence / confidence / digest integrity 失败 | `trusted_target_integrity_invalid` |
| 7 | raw candidate digest 未命中 5i 可信 target | `candidate_target_not_found` |

随后 step 6 子序固定为：

1. 6a：existing occurredAt 单调性；失败为 `non_monotonic_occurred_at`。
2. 6b：selected history capacity → scope-wide history capacity → source-scope index capacity → lineage record capacity → lineage version capacity；只报告首个失败。
3. 6c：PR #522 原 lineage reuse 判定。

step 7 audit preflight、step 10 authorization/provider/sync 均晚于上述子序。generation incomplete / cursor / out-of-order selector 都在 prospective target 构造前阻断，audit candidate digest 始终为零值；其他路径在 5i 尚未通过时也只能使用零值。状态只有在 5h 完成后才可提升。`candidate_target_not_found` 永远不能覆盖 `generation_incomplete`。

### 9.8 containment 专用 scope oracle

`disable_mapping` 不读取 frozen registry / manifest，因此不重新证明 record 等于 manifest prefix，也不重新推导 `generationComplete === cursor === manifest.length`。它只执行下列封闭 intrinsic oracle：

1. ingress先只解析raw command的scalar / scanner / grammar，取得validated mappingReference；同时验证module-issued trustedCapability identity，并以captured `isProxy`对public state outer container建立Proxy-free proof，但不读取mappings element；generic accessor不会进入普通carrier；
2. schema-directed parser只捕获并验证runtime state outer shell、index、records、lineage index与mappings array container，不对任一mapping element或target做value traversal；先证明`indexSnapshotComplete=true`、records.length=mappings.length=generationCursor、indexVersion / cursor范围和record selector unique sets。index/record/lineage digest/reference的phone/national-id命中只保存`deferred_trusted_shell` pending bit；
3. 仅以validated mappingReference在captured processed records中唯一选择record，并取得同位置mapping index；0命中为`aggregate_lineage_mismatch`，重复为`source_scope_state_invalid`，两者都丢弃pending且使用零值audit。在该选择完成前不得读取selected mapping shell或任何target descriptor；
4. 选择 index 后，ingress parser 才对同位置 selected mapping container先做 captured `isProxy`，再读取 shell own descriptors。shell 只允许 `aggregate`、`history` 与可选 `target` 三个 string keys；`aggregate` / `history` 必须是 enumerable data descriptor并进入严格 carrier。selected `target` 无论 missing、data 或 accessor都统一标记为 `selected_target_quarantined`。parser可从 intrinsic 返回的 descriptor record 一次性捕获 `value` identity，或 `get` / `set` function identity，写入 module-private identity-only sentinel；这不是对 target graph 的 traversal、property read、scan、hash、serialize或调用。该例外先于普通 mapping exact-shape 拒绝，因此可达；getter / setter / Proxy trap 调用次数必须为 0；
5. 对所有 non-selected mappings 执行完整 plain-data、descriptor、exact-key、scanner、hash、history 与 cross-binding 校验；任一 non-selected accessor、missing target 或 contract-invalid target 立即 `source_scope_state_invalid`，不得套用 selected exception；
6. 对 selected mapping 只读取并全量验证 aggregate、history、record 与 lineage，自洽并通过 status / reason、history chain、hash、tenant / namespace binding。selected target 无论 missing、data descriptor、accessor 或 contract-invalid 都只保留 descriptor kind与第4项已捕获的 value/get/set identity；绝不解引用、traverse、scan、hash、validate、serialize或调用该 identity；
7. root、internal capability、index、record、selected aggregate / history与全部non-selected mappings的tenant / namespace binding失败固定为既有`tenant_mismatch` / `source_mode_mismatch`；全部binding成功后必须resolve所有`deferred_trusted_shell` pending，任何未resolve pending禁止进入auditReady或commit；
8. `auditReady` 必须为 true；false 固定 `mapping_audit_not_ready_blocked / audit_not_ready`；
9. selected aggregate 已 disabled 时固定 `mapping_invalid_transition_blocked / mapping_already_disabled`；该 guard 先于时间与所有 capacity；
10. existing occurredAt 单调性；失败为 `non_monotonic_occurred_at`；
11. selected history → scope-wide history → source-scope index capacity；只报告首个失败；
12. prospective state 无条件以新的 enumerable data property 写入规范 `target=null`，并固定进入 `disabled / mapping_disabled`；随后完整 state / audit / result exact-shape 与 atomic commit。该 exception 永远不能产生 `matched`、保留 active target 或改变非 selected mapping。

第 4—6 项共同构成 containment-only 的 one-way recovery exception：它只允许已由 record 唯一选择的 target slot 从损坏或缺失收敛到规范 `null`，不能用于 generate / review，也不能放宽 aggregate、history、record、index 或任何非 selected mapping。generic public parser 仍拒绝 accessor；containment quarantine 只保存 descriptor 分类与 identity 供零调用断言，不把 getter、setter或返回值放入 data carrier。committed nextState 必须重新通过普通 `SourceScopeRuntimeState` exact-shape 校验。上述 1—12 是唯一 precedence；例如 auditReady=false + already-disabled 返回 audit_not_ready，auditReady=true + already-disabled + non-monotonic / full history 固定返回 mapping_already_disabled。

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

三个 output 必须由 module-owned factory 以固定 key 顺序生成，缺键、多键、unknown / nested raw container、wrong type、grammar、enum 或 cross-field 不一致均不得产生 partial output。每一个 string value 都必须执行第 12 节同一 sensitive scanner；ordinary path 在 grammar 前完成全部分类，digest/reference path 仅按第 12.5 节为 phone/national-id 使用 grammar + integrity 后的窄范围整值 mask，其余敏感分类仍先执行且没有豁免。timestamp 与 enum 永远属于 ordinary。

### 10.3 blocked result

exact allowed keys 只能是：

`ok`、`auditEvent`。

`ok` 必须严格为 `false`。blocked result 不得包含 error、message、details、path、scanner category、raw input、aggregate、target、index、partial output 或 mutation draft。

阻断时，输入 aggregate、target、history、source-scope index 与 lineage index 必须同时 deep-equal 且按 exact field order CE byte-equal；不产生 review / decision / conflict。唯一例外是 containment selected target slot 已缺失、contract-invalid 或为 accessor时，该 value 没有合法 CE 表示且绝不遍历：ingress quarantine parser只在首次安全 descriptor capture时保存 before descriptor kind与 value/get/set identity；测试 harness在调用外预先保存同类 identity并在返回后比较，domain不得为“after”证明再次对 public object调用 `Reflect.getOwnPropertyDescriptor`。断言 identity不变、getter / setter / Proxy trap调用次数均为0、整个input object未 mutate。非 selected mapping与selected aggregate / history / record / index仍执行普通 deep / CE equality。blocked result 与 auditEvent 也必须 recursive deep-freeze。

### 10.4 pure reducer commit

固定流水：

1. raw parser 与 guard；
2. non-containment 执行完整 runtime state、所有 mappings、history、source-scope index 和 lineage index 校验；`disable_mapping` 不走该全量分支，只执行第 9.8 节先选 record、再拆分 selected shell / non-selected mappings 的 containment oracle；
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
- current aggregate 与同位置 scope record 的 candidateDigest 都严格为 null，target=null；
- 最后一个非 disable history target 的 `historicalCandidateDigest` 保持非空、immutable 且由 historyDigest 覆盖；它只用于证明 disable 前 candidate lineage，不复制为 current candidateDigest，也不作为后续 command target；
- mappingReference、pair digest、evidence fingerprint、source scope、snapshot、registry、source kind、data mode 保留；
- history 旧 entries byte-equal，只追加 disable entry；
- source-scope 只替换被选 mapping 与对应 record 并令 indexVersion +1；其他 mappings / records byte-equal；
- nested lineage records / version / digest byte-equal；
- historyDigest 与 source-scope indexDigest 更新；nested lineage index 不变；
- 不解析 registry，不加载 target，不检查 authorization、provider 或 sync；
- disable audit 与后续 disabled-state blocked audit 都把 current state 表达为 `disabled` 并使用 audit-only 零值 candidate digest；不得把 historicalCandidateDigest 放入 audit。后续所有动作按 disabled guard 阻断。

## 12. deterministic sensitive scanner

### 12.1 内部 mode

scanner 只允许两个 module-owned mode：

- `field_value`：raw、trusted 与 domain output 的所有 string；
- `canonical_audit_envelope`：仅用于已经 exact-shape 校验并按固定 key 顺序序列化的 audit JSON。

后者只豁免“外层 canonical audit JSON 是 object”这一 raw-container 判定，其余模式全部相同。该 mode 只能由 audit factory 在 audit object 已通过 exact 11-key 校验、逐字段扫描与 grammar 后，调用固定 serializer 时进入；其他 call site 在类型与 runtime 分支上均不可达，command 不得选择 mode。

### 12.2 前置结构资源预算

domain 不得对任意 public `unknown` 直接调用 `Object.getPrototypeOf`、`Reflect.ownKeys`、`Object.getOwnPropertyDescriptor` 或其他可能触发 Proxy trap 的反射。05C-E1 runtime 明确限定为 Node.js server-only；module initialization 必须捕获并自检不可被调用方替换的 `node:util.types.isProxy` intrinsic。每个 public 参数在任何其他 reflection、property read 或 graph traversal 前必须先通过该 oracle；Proxy / revoked Proxy 固定拒绝且任何 ownKeys、getPrototypeOf、descriptor、get、getter trap 调用数为 0。若该 intrinsic 不存在、自检失败或无法证明当前 runtime 的调用不触发 trap，factory initialization blocked，不降级成普通 reflection。

module-owned ingress parser 在 Proxy-free proof 后才能按 schema 读取 own descriptors，并把值复制为 null-prototype、own enumerable data-property-only carrier：

1. primitive、canonical JSON text 与 module 自己登记的 frozen carrier 可直接进入对应 scalar / identity path；
2. ordinary object / array 必须逐 container 先执行 captured `isProxy`，再读取 prototype、own keys 与 own descriptor；只从 data descriptor 的 `value` 捕获一次，之后所有 scanner、grammar、hash 与 clone 只消费 captured carrier，不再读取原对象；
3. function、class instance、custom prototype、symbol、generic accessor、inherited enumerable、non-enumerable、sparse array、cycle 或 alias 都拒绝；
4. containment 使用 schema-directed parser：先解析 raw command 得到 mappingReference，再只捕获 context/state outer shell、index 与 records并唯一选择 mapping index；随后才读取该 selected mapping shell 的 descriptor。selected target 无论 missing、data 或 accessor都只把 descriptor kind与intrinsic descriptor record中的 value/get/set identity复制为不可调用 quarantine sentinel；不得解引用、遍历、扫描、序列化或调用该 identity。non-selected mapping仍走 generic strict parser。普通 call site 不能选择 quarantine branch。

因此 descriptor-only 只描述 **captured `isProxy` 已证明 Proxy 不可达之后** 的 schema-directed结构捕获，不是直接遍历 arbitrary object。domain reducer只接受 ingress parser 产生的 null-prototype carrier / quarantine sentinel；原始对象永远不进入业务 parser。canonical JSON text 是可选的 JavaScript `string` transport，不接受 `Buffer`、`Uint8Array`、`ArrayBuffer` 或其他 byte container；它不受单个业务 field 的4,096上限，而受对应 invocation 的 aggregate UTF-8 byte / work-unit budget。byte length只在输入已证明为well-formed Unicode scalar sequence后按其最短UTF-8编码计算，因此“invalid UTF-8 byte sequence”对该接口不可达；lone surrogate仍固定拒绝。解析后每个业务 string仍执行单 field上限。

canonical JSON transport 使用 module-owned streaming parser、无 reviver/callback。factory 的 16,000,000 UTF-8 byte cap只适用于 module-private bootstrap serialization/self-test seam，不是 public factory参数，外部仍无法注入 snapshot；单次 public wrapper invocation 的 transport最多4,000,000 bytes。两者与同一 node/depth/string/work counter共享预算，每个 transport byte固定 precharge 1 unit。读取期间即执行 depth 64、node与 array cardinality gate，超限不继续 materialize。object key必须按 owning schema exact key order出现，duplicate key一律拒绝；unknown / forbidden key在完整 key token后按第13节precedence处理，其 value只做语法完整且计transport work的bounded span skip，不生成业务carrier、不做字段scanner，也不绕过随后应到达的guard。对completeness/selector之前必须延迟的mapping或target，streaming parser同样只证明JSON语法并保存opaque source span；selector reason确定后才在同一cursor/counter下materialize对应阶段需要的span。number token只接受 `0` 或 `-?[1-9][0-9]*`，禁止 `-0`、fraction、exponent、NaN与 Infinity，再由字段 grammar检查 safe integer range。string必须是 well-formed Unicode scalar；key/value unescape 与 projection expansion由下述 fixed precharge覆盖。`__proto__`、`constructor` 等只作为 own string key进入 whitelist分类，复制一律用 `defineProperty`，不会改变 prototype。

任何 NFKC、percent decode、JSON 内容检测、hash 或 string 内容扫描前，module 必须对**当前 guard阶段已经captured且契约允许打开的完整子图**做structural preflight；不得借“完整graph preflight”提前读取第9.7/9.8节明确延迟的mapping element或selected target。遍历使用整次public wrapper invocation共享的module-owned identity set与累计counter：container第一次出现时登记，第二次出现无论形成cycle还是acyclic alias都固定拒绝；不得重访或按路径重复计数。后续selector reason确定并打开下一子图时，先沿用同一identity set/counter完成该子图preflight，再执行其scanner/hash；任何阶段都不能重置预算。root depth=1，最大depth=64；object container自身计1 node，每个own string key计1 scalar node且每个property value按其类型计node；array container自身计1 node，每个element计其value node，array index不另计key node。generic parser不接受hole、symbol、accessor、non-enumerable或inherited property。该gate只检查当前已打开container、own data descriptor、array length与资源数量，不解释字符串内容，也不构成敏感内容豁免：超限输入直接fail-closed，不进入state或audit。

固定预算为：

- 每个 parser-owned null-prototype carrier 最多 64 个 own keys；仅在 Proxy-free / identity proof 后以 captured `Reflect.ownKeys` 计数，超限时不再取得后续 value；
- 每个已知 array 先检查其 contract cardinality，再访问任一 element；
- 单次 factory initialization 最多访问 2,000,000 个 container + scalar nodes，全部业务 source string 合计最多 8,000,000 个 UTF-16 code units；
- 单次 public wrapper invocation（raw、state、internal capability、private reducer、prospective output 与 audit 合计）最多访问 500,000 个 container + scalar nodes，全部业务 source string 合计最多 2,000,000 个 UTF-16 code units；
- 每个 string 最多 4,096 个 UTF-16 code units；
- 单次 factory initialization 最多 640,000,000 个 contract work units，单次 public wrapper invocation 最多 160,000,000 个 work units。work采用实现无关 precharge：每个业务 source UTF-16 code unit在任何 NFKC/decode/matcher前一次性 charge 64，覆盖最多16倍 projection与全部 fixed matcher阶段；不按实现内部 DFA数量、regex engine transition或NFKC内部步骤计费。canonical encoder / hash每个输出 byte另charge 1，JSON transport每个 source byte charge 1；
- matcher 只能使用单向、无回溯的固定 automaton 或等价线性实现，不允许 catastrophic-backtracking regex；每个 projection 只允许一次主扫描，最多产出与 projection code units 等量的 token，不允许按每个 `@`、separator 或 marker重新向两侧扩展；所有 NFKC / percent / JSON-string decoded projection 的累计 code units 最多为原 value 的16倍。8,000,000 / 2,000,000上限只累计原始captured scalar与module新构造的业务string各一次，不重复累计projection；projection由独立16× expansion gate与每个source code unit的64-unit precharge覆盖，首次超过任一gate即停止；
- object width 固定 64，depth 固定 64；array 除各 owning contract 上限外仍受总 node / work budget，任一维度首次超限立即停止。

factory initialization与每个public wrapper invocation使用独立计数器，不跨调用累计；wrapper内部capture、preflight、issuer、private reducer、output与audit必须共用同一个计数器。各字段 / array的局部contract上限与对应public graph的aggregate budget必须同时满足；局部上限不承诺所有维度可以同时取最大值。故“最大合法graph”定义为同时满足local cardinality与aggregate budget的graph，而不是所有local维度同时取最大值。cycle、alias、depth、width、node、string、array或operation任一超限都不能通过缩短另一维度抵消。

factory initialization 任一 owning-contract 或 resource failure 无条件折叠为第 8.1 节固定 `MappingDomainInitializationBlocked`，不进入以下 command reason 体系。以下 collapse 只适用于单次 public wrapper invocation：unissued object / Proxy / function / class / accessor / symbol / inherited / cycle / alias / object、array、node、depth、width budget 超限=`mapping_input_blocked / invalid_payload_shape`，raw 单 string、累计 string 或 work budget超限=`mapping_input_blocked / invalid_scalar_value`；private reducer 内 registry / manifest / source fixture=`untrusted_fixture_provenance`，readiness / authorization=`trusted_readiness_contract_invalid`，disable capability / preflight projection=`trusted_disable_context_invalid`，runtime state / scope index / mapping array / history=`source_scope_state_invalid`，aggregate=`trusted_aggregate_contract_invalid`，target / evidence=`trusted_target_contract_invalid`，lineage index / record=`lineage_index_invalid`，domain output=`derived_output_contract_invalid`，audit candidate=`audit_not_ready`。任何结果都不能回显长度、path、descriptor 或内容。正好等于上限必须继续，首次超过上限立即停止；structural/node/string preflight 超限时内容 scan / hash 为 0，work counter 在处理中首次超限时只保证后续 stage 与剩余 token不再访问，已发生的 deterministic charge 不能伪称为 0；任何 rejected payload都不得进入 audit原始内容。

### 12.3 扫描投影

1. `n0 = NFKC(value)`，保留 ASCII case，供 JWT / base64url 等 case-sensitive matcher 使用。NFKC normalization data与算法版本固定为Unicode 15.1，必须由module-owned version-pinned table/implementation提供；不得直接依赖宿主Node/ICU版本漂移的ambient `String.prototype.normalize`，除非module initialization先以Unicode 15.1 NormalizationTest known-answer set证明byte-identical，否则factory initialization blocked；
2. `n1 = percentDecodeAsciiOnce(n0)`，decode 只接受 `%` 加两个 ASCII hex 且 byte 为 0x00—0x7F；非法或非 ASCII escape 原样保留；
3. `p0 = asciiFold(n0)`、`p1 = asciiFold(n1)`；`asciiFold` 仅把 ASCII `A-Z` 映射为 `a-z`，其他 code point 不变；不递归 percent decode，不把 `+` 当空格；
4. 对完整 JSON scalar string 最多执行两层标准 JSON string decode，并把每层 decoded string 重新生成 n/p projection 后扫描。两层后仍是包含 assignment-like separator 的 JSON string，或 quote / backslash 结构无法安全完成有限 decode 时，固定 fail-closed；不能把二次包装当普通文本；
5. assignment matcher 另使用同一 operation counter 的 bounded escape view：只识别 JSON string 允许的 quote、backslash 与 `\u0022` / `\u0027` 等价 escape，最多两层；prefixed log 中的 backslash-escaped quote 也必须进入该 view。未知、截断或第三层 assignment-like escape 不尝试猜测，直接 fail-closed；
6. 所有 projection 全长扫描，不 trim，不在任一行分隔符处停止；projection 长度与每次 decode / automaton 转移全部计入第 12.2 节 work budget；
7. 投影只用于扫描，不替换业务值。

内部分类优先级固定为：serialized raw container、raw payload marker、conversation/archive marker、credential marker、raw identifier marker、national identifier、phone number、email address。对外只返回 `forbidden_field_blocked / sensitive_value_blocked`，不得返回分类、offset 或命中片段。

### 12.4 固定 matcher

除 JWT 外，matcher 分别对 p0、p1 及最多两层安全 decoded view 执行；JWT 对 case-preserving n0、n1 与对应 decoded view 执行。ASCII marker 的 token boundary 固定为字符串边界或非 `[a-z0-9_]`。所有 tokenization 共用一次单向主扫描，不按命中位置回扫。

- serialized raw container：仅 `field_value` mode；对投影只移除外围 ASCII whitespace 后执行标准 JSON parse，root 为 non-null object 或 array即命中。root 为 JSON string 时按第 12.3 节继续展开最多两层并对每层执行完整 scanner，因此 JSON-string 包装、二次包装和 escaped assignment 不能绕过；其他 scalar 不命中本类。业务值不因 detection trim 而被接受。
- raw marker：token-bound `raw[._-]?(response|payload)`、`webhook[._-]?payload`、`api[._-]?response`、`provider[._-]?response`、`original[._-]?response`。
- conversation/archive marker：token-bound `chat[._-]?content`、`conversation[._-]?content`、`message[._-]?content`、`session[._-]?archive`、`chat[._-]?data`、`msg[._-]?data`，以及任意位置的“聊天内容”“会话内容”“会话内容存档”“会话存档”。
- credential marker：token-bound `access[._-]?token`、`corp[._-]?secret`、`encoding[._-]?aes[._-]?key`、`webhook[._-]?(secret|key)`、`archive[._-]?(secret|key)`、`session[._-]?(secret|key)`、`secret`、`credential`、`password`、`cookie`、`authorization`；以及 token-bound `bearer[ \t]+[a-z0-9._~+/-]{8,}` 和 `(sk|pk)-[a-z0-9_-]{8,}` credential-prefix shape。
- JWT / JWS / JWE conservative marker：在 case-preserving projection 上以 `[A-Za-z0-9_-]` 与 `.` 组成的 maximal atom做一次前向切分，不从带额外前缀、后缀或更多段的 atom截取 substring。三段 JWS/JWT恰有两个dot：header必须非空且为2—4,096 code units，payload与signature各允许0—4,096，但二者不能同时为空；因此普通JWT、unsecured JWT的空signature与detached JWS的空payload都阻断。五段compact JWE恰有四个dot：protected header、IV与authentication tag必须非空且各2—4,096，encrypted-key与ciphertext各允许0—4,096；因此direct key agreement的空encrypted-key与空plaintext的空ciphertext都阻断。任一形态一律疑似credential forbidden，不依赖`eyJ` / `eyj`前缀，也不解码后才决定保护。因此`abc.def.ghi`也按conservative policy阻断，本文明确取代PR #522普通三段dotted near-miss。两段、四段、六段、三段中payload/signature同时为空，或含非base64url字符的dotted identifier不命中本类，但仍接受其他marker扫描。
- raw identifier marker：token-bound `external[._-]?user[._-]?id`、`follow[._-]?user[._-]?id`、`corp[._-]?user[._-]?id`、`user[._-]?id`；以及 token-bound `(wm_|wo_)[a-z0-9._:@-]{3,128}`。
- national identifier：左右均不是 ASCII digit 的 15 位数字，或 17 位数字加 `[0-9x]`。
- phone：左右均不是 ASCII digit 的 `(?:\+?86[ -]?)?1[3-9](?:[ -]?[0-9]){9}`；每两个数字间最多一个 ASCII space 或 hyphen。
- email / contact identifier：Unicode分类固定为15.1的General_Category `L*`、`M*`、`N*`，并使用第12.3节同一Unicode 15.1 NFKC实现归一fullwidth punctuation。一次前向automaton以`L/M/N`或ASCII `.!#$%&'*+/=?^_\x60{|}~@-`组成的maximal token切分，不对每个`@`左右扩展。token恰有一个`@`且左右非空，或含多个`@`但第一个与最后一个两侧均非空时，一律conservative forbidden；不要求domain含dot，因此`a@b`、`用户@example.com`、`a@例子.公司`、`a@xn--fiqs8s`、首尾hyphen label与fullwidth/mixed变体都阻断。单独`@`、`@a`、`a@`、emoji-only side因左右grammar不完整不命中email类，但仍受其他scalar/marker规则。超过254 code units的overlength rule只适用于**含至少一个`@`且第一个/最后一个`@`外侧各有至少一个合法contact atom code point**的maximal token；不含`@`的254/255位普通displayName atom不因本规则阻断，但仍受字段4,096与其他scanner规则。contact-like token不从其中截取substring。

另外在 raw marker / conversation / credential / raw identifier 的固定 pattern 后，对 p0、p1 各执行一次 forbidden assignment / query matcher：

1. candidate 左边界只能是字符串起点或 `[?&#;, \t\r\n\f{[(]`；
2. unquoted branch 在边界后直接读取 key；quoted branch 在边界后读取一个 ASCII 单引号或双引号，并要求 key 后出现同一种 closing quote；
3. key lexeme 在 NFKC + ASCII casefold 后必须完整匹配 `[a-z][a-z0-9._-]{0,63}`；唯一 canonicalizer 删除全部 `.`, `_`, `-`，剩余 non-empty token 与 forbidden registry exact match；extra object key 与 assignment key 必须调用同一函数；
4. key 或 closing quote 后只允许 0 个或多个 ASCII space / tab，再紧跟 `:` 或 `=`；
5. quoted、escaped quoted、JSON-string 一层 / 二层与 backslash escaped quote 都必须先按第 12.3 节 bounded view 还原 key 边界，再调用同一 canonicalizer；只有 token 精确位于 forbidden registry 才命中；
6. token 所属 raw provider / conversation / credential / raw identity 分类决定内部优先级，对外仍只返回 `sensitive_value_blocked`。

`assignment-like` 不是任意包含 `:` / `=` 的字符串。固定 automaton 只有依次到达以下状态才成立：合法左边界 → 可选 direct/escaped quote → 解码后的首字符为 ASCII letter → 1—64 个 key lexeme code units → 与 opening 匹配的可选 closing quote → 仅 ASCII space/tab → `:` 或 `=`。URL scheme、timestamp、普通 JSON scalar、首字符为 digit 或没有合法左边界的 colon 不进入本分支。只要 automaton 已从合法左边界和 ASCII letter进入 key 状态，但在 separator 前遇到截断 escape、第三层 wrapper、mismatched quote、超过 64 或 canonicalizer 不可判定，就按“无法安全 canonicalize”fail-closed；尚未进入 key 状态的普通 colon / equals 不因此误杀。

该 matcher 因此覆盖 `private_key=`、`private.key=`、`access.token=`、`api.key=`、`authorization_header:`、`payload=`、`archive_content=`、`mobile=`，以及 prefixed log / JSON fragment、quoted assignment、escaped quote、backslash escaped quote、完整 JSON-string 包装与二次包装中的 registry-owned spelling；一次 ASCII percent encoding 后的 quote、dot、underscore 与 separator 由 p1 命中。只要已出现 assignment-like 左边界与 `:` / `=`，但 key、quote 或 escape 无法在 64-code-unit 与两层预算内安全 canonicalize，就固定 `sensitive_value_blocked`，不得降级为 ordinary text。registry 外且结构完整的普通 key不命中。pure JSON root 仍由优先级更高的 serialized raw container matcher 命中；canonical audit envelope 的 11 个 allowed keys 均不在 forbidden registry，因此 quoted branch 不误杀合法 audit。

不得使用“高熵”“长字符串”或“长 hex”作为 credential 启发式。所有 string 还必须在 scalar parser 阶段证明是 well-formed Unicode scalar sequence；lone surrogate 固定按 `invalid_scalar_value` 阻断，不能依赖 UTF-8 replacement character。

### 12.5 canonical hash 低误报

scanner 仍运行于所有 digest、reference、timestamp、enum、display name、summary、remark、label、tag 与 free text。masking 不能由 value 中出现的 lexical atom 自动开启；scanner call site 必须传入 module-owned `semanticPath`，该 path 由 exact schema 硬编码，调用方和值本身都不能选择或推断。

semantic 分为：

- `ordinary`：永不 mask。所有 displayName、summary、remark、label、tag、tenantId、timestamp、enum、reason、status 与 reviewer field 都属于此类；
- `raw_opaque_sha256_selector`：只分配给 raw review `candidateDigest`。未遮蔽 projection 先执行 credential、marker、identifier、email 与 assignment scanner；随后整个值必须 anchored 匹配 `^sha256:[0-9a-f]{64}$`，才可仅为 phone / national identifier 遮蔽完整值。该 grammar proof 不是 target integrity；5i / 5j 仍在 completeness 后执行 equality / lineage lookup，因此合法 opaque selector 能在 guard 1完成 scanner而不会抢先覆盖 `generation_incomplete`；
- `trusted_sha256_digest`：分配给 target/state/output 中的 `candidateDigest`、`candidatePairDigest`、`evidenceFingerprint`、`externalContactDigest`、`systemCustomerDigest` 及 source / registry / manifest / history / index 类 digest。只有整个 projection anchored 匹配 `^sha256:[0-9a-f]{64}$` 且该 slot 的 module-owned recomputation / cross-field integrity 已通过，才可为 phone / national identifier遮蔽完整值；
- `raw_mapping_reference_selector`：只分配给 raw review / disable 的 v2 `mappingReference`，完整值必须 anchored 匹配 `^ref-(mock|demo)-[0-9a-f]{48}$` 后才可做 phone / national-id 整值 mask；后续 record lookup 仍不因 grammar proof而获得 authority；
- `deferred_trusted_shell`：只分配给第9.7节5a与第9.8节selector前必须读取的persisted index / record / lineage digest/reference slot。统一scanner在未遮蔽值上立即完成raw marker、credential、identifier、email与assignment分类，并检查该slot的anchored grammar；phone / national identifier automaton同样执行，但只把命中记为parser-owned pending bit，不mask、不返回success、不建立material integrity。该semantic不能由raw command、output、audit、普通field或任意mapping/target选择；
- `trusted_mapping_reference`：只分配给 derived / trusted v2 `mappingReference`，除同一 anchored grammar 外还必须通过 pair/evidence recomputation。`manifestEntryReference` 与 `sourceScopeReference` 使用各自在 PR #522 保留的独立 anchored grammar和 registry lookup，不得套用 v2 48-hex regex，也不得仅因字段名含 reference 自动获得 mask；如其 grammar 内允许数字 run，只能定义各自 exact semantic 后另行注册；
- `canonical_audit_candidate_digest`：只允许 serializer 已验证的 audit `candidateDigest` value span使用，不能遮蔽 envelope 其他字段。`tenantIdDigest`、`auditDigest` 当前不是 exact keys；未来即使采用这些名称，也必须经契约修订注册 exact semantic path，名称后缀本身不授予 mask。

执行顺序采用窄范围两阶段：所有path先在未遮蔽projection上运行raw marker、credential、identifier、email与assignment matcher；ordinary path随后仍在未遮蔽值上运行phone / national identifier。raw opaque selector先运行phone / national identifier探测并暂存结果，再做anchored grammar：grammar成功时整值mask并丢弃暂存命中、继续authority lookup；grammar失败时不得mask，若暂存命中则固定`sensitive_value_blocked`，否则返回grammar reason。`deferred_trusted_shell`在同一次scanner调用中执行phone / national identifier automaton并返回pending而非accepted；若completeness/selector在mapping capture前阻断，pending carrier直接丢弃且audit使用零值；若继续，5h.1 / containment selected-binding必须先以mapping/history/target material integrity把该slot升级为对应trusted semantic，再resolve pending。trusted / derived digest/reference的grammar或integrity失败固定返回该slot的trusted contract / integrity reason；只有两者都成功才整值mask，且任何未resolve pending禁止commit。由此，一个格式合法但integrity错误且hex中恰有phone/id run的trusted candidateDigest固定`trusted_target_integrity_invalid`，不会漂移成`sensitive_value_blocked`；incomplete / wrong-selector state的同类record值也不会覆盖既定precedence；相同裸值放在raw selector或ordinary field仍按各自规则阻断。这样每个string都实际执行同一scanner与phone/id automaton，只把“是否可mask”的裁决延迟到semantic authority，且reason唯一，不存在任意自由文本借digest-looking atom获得豁免。

displayName / summary / remark / label / freeText 中出现 `sha256:` 或 `ref-` 外观时始终视为 ordinary；其中的手机号、证件号、原始 id、credential 或 secret 必须 fail-closed。digest/reference 前后任何字符、换行、63 / 65 hex、错误 prefix 或只在字符串中间出现的 atom都不能获得 mask。全零 digest仍只允许 audit sentinel，raw input 固定阻断。

## 13. forbidden key 与 unknown key

extra key 与 assignment key 共用唯一 canonicalizer：先执行 NFKC 与 ASCII casefold，完整 lexeme 必须为 1—64 个 `[a-z0-9._-]` 且首字符为 ASCII letter，再删除全部 `.`, `_`, `-` 得到 non-empty canonical token。出现 assignment-like separator 但 lexeme / escape 无法安全 canonicalize 时 fail-closed。该分类只用于 exact whitelist 之外的 key；allowed key 不因名字含 `authorization` 或 `externalUserIdDigest` 被误杀。

forbidden registry 是以下 canonical token 的封闭集合：

| 分类 | exact canonical tokens |
| --- | --- |
| credential | `accesstoken`、`accesskey`、`refreshtoken`、`token`、`secret`、`corpsecret`、`credential`、`password`、`cookie`、`authorizationheader`、`sessionkey`、`sessionsecret`、`webhookkey`、`webhooksecret`、`encodingaeskey`、`archivekey`、`archivesecret`、`apikey`、`privatekey` |
| raw identity | `externaluserid`、`userid`、`followuserid`、`corpuserid`、`mobile`、`mobilenumber`、`phone`、`phonenumber`、`tel`、`idcard`、`identitynumber`、`email` |
| raw provider | `rawresponse`、`rawpayload`、`webhookpayload`、`apiresponse`、`providerresponse`、`originalresponse`、`payload` |
| conversation | `chatcontent`、`conversationcontent`、`messagecontent`、`sessionarchive`、`chatdata`、`messagedata`、`msgdata`、`archivecontent`、`conversationarchive` |

对象判定顺序固定为：

1. 第 12.2 节 ingress 先证明 module-issued / parser-owned、Proxy 不可达；未取得 proof 的 object 不执行任何 reflection；
2. 对 null-prototype captured carrier 的完整 own data-key set计数并执行 node / array / string / operation budget；property-name code units 同时计入 string budget；
3. 对通过预算的完整 key set 分类；generic carrier 不可能包含 symbol、accessor或 non-enumerable key，containment quarantine metadata 只按第 9.8 节处理；
4. forbidden extra，按 UTF-8 byte 排序只决定内部首项；
5. required key 缺失，按 whitelist 顺序；
6. remaining unknown extra，按 UTF-8 byte 排序；
7. allowed value container 与 string scanner。

business parser 内部 carrier 的 prototype 必须严格为 `null`。public ordinary plain object / array 可以作为 ingress source，但必须先通过 captured `isProxy`、prototype、own-data descriptor 与 graph capture，业务逻辑永远只看其 null-prototype copy；class instance、custom prototype 与调用方直接提交的未登记 null-prototype object 都拒绝。symbol own key、accessor / getter / setter、任一 non-enumerable own key、sparse array、named array extra、cycle 或 alias均视为 shape failure，且 getter与 Proxy trap调用次数必须为 0。committed result、nextState、domain output 与 audit DTO 由 module 构造为 registered、frozen null-prototype data carrier；application 可以把原 nextState identity 直接传回，或 JSON round-trip 为 ordinary plain object后由 ingress重新捕获，不能把未登记 null-prototype object伪装成 module output。

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

raw object 的 class/custom prototype、unregistered null-prototype、symbol、accessor 或 non-enumerable failure固定为 `mapping_input_blocked / invalid_payload_shape`；通过 ingress 的 ordinary plain object是正例，不属于 failure。trusted object 与 domain output 分别 collapse 到其对应 trusted-contract / derived-output reason。

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
- candidate digest 使用本文 candidate v2 的 5i frontier；disable 与任何 current disabled-state audit 永远使用零值，不能从最后 immutable history target 提升 historicalCandidateDigest。

任一 blocked path 在可信状态已提升后固定 `mappingStatusAfter=mappingStatusBefore`。tenant、source / mode、status 与 digest 只能从各自已通过的 frontier 取值，不能从另一个尚未验证的 trusted object 补值。

normal audit 失败时 mutation 不提交，统一返回 `mapping_audit_not_ready_blocked / audit_not_ready`，并使用进入 normal factory 前的 last-safe projection。若该 dynamic projection 自检仍失败，必须退回完整初始 sentinel，只把 event / reason 设置为 `mapping_audit_not_ready_blocked / audit_not_ready`。compile-time-safe blocked event 在 domain 初始化时自检；自检失败则 factory 不返回可调用 domain instance，也不返回 partial result。

canonical audit serializer 不得把普通对象直接交给 `JSON.stringify`，因为普通对象可能继承 `Object.prototype.toJSON`、污染的 setter 或其他 prototype hook。serializer 只接受 audit factory 已逐字段完成 scanner、grammar 与 cross-binding 的 11 个 primitive slot；不接受调用方 string/object、Proxy、custom `toJSON`、getter、accessor 或任意 JSON document。

固定序列化步骤为：

1. 创建私有 `Object.create(null)` shadow，以 `Object.defineProperty` 按第 14 节 11-key 顺序写入 enumerable、non-writable、non-configurable data property；不使用赋值语法，不触发 inherited setter；
2. module-owned serializer 只遍历 fixed key table 与 shadow 的已捕获 primitive values；通用 helper 即使处理 array / nested carrier，也只接受 parser-owned null-prototype data carrier 与 primitive，不读取动态属性；
3. string 使用 byte-unique scalar escaper：quote 固定 `\"`，backslash 固定 `\\`；全部 U+0000—U+001F 一律使用六字节小写 `\u00xx`，不使用 `\b` / `\f` / `\n` / `\r` / `\t` short escape；U+2028 / U+2029 固定 `\u2028` / `\u2029`；solidus `/` 永不转义；其他 well-formed Unicode scalar一律输出其最短 UTF-8 bytes，不转成 `\uXXXX`，lone surrogate不可达。null / boolean / finite integer 使用 lowercase fixed token，integer无 leading zero。不得调用 global / captured `JSON.stringify`、value.toJSON、replacer 或 callback；
4. 输出 key 顺序、separator 与 whitespace 唯一，随后用 `canonical_audit_envelope` 扫描；只有 serializer 同步标记并验证的 candidateDigest value span 可使用第 12.5 节 digest semantic，其他 audit string 全部 ordinary；
5. audit candidate 自身出现 `toJSON` own key、custom prototype、getter / accessor、unsupported value、serializer exception、非唯一顺序或 envelope scan 失败时，normal mutation 全部丢弃并固定 `audit_not_ready`。仅污染 `Object.prototype.toJSON` 或同名 setter不影响 null-prototype carrier，固定忽略并产生与未污染环境 byte-identical 的 envelope；不得调用污染 hook，也不得仅因无关 inherited pollution回退。

完整初始 sentinel 与 `audit_not_ready` fallback envelope 必须在 module initialization 时以同一 serializer 预构造、known-answer 自检并 recursive freeze；自检失败则 factory initialization blocked。public audit DTO 与 serialization shadow 分离：两者都使用独立 null-prototype carrier，前者以 fixed data descriptors 构造、登记并 freeze，后者永不导出。污染 `Object.prototype.toJSON` 或 11 个字段名的 prototype setter、payload / nested object 自带 `toJSON`、以及 getter 返回敏感值，都不得被执行；执行计数必须为 0。

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
| initial / generationComplete selector 跳项 / 重放 | `mapping_input_blocked` | `generation_cursor_mismatch` | 当前可信状态不变；首次为 `unmatched → unmatched` |
| manifest 尚未完整生成却 review，或 incomplete generation selector 不是当前 cursor entry | `mapping_input_blocked` | `generation_incomplete` | 当前可信状态不变，优先于 cursor / target / candidate reason |
| selected record 与 aggregate / target / history material lineage 不一致 | `mapping_input_blocked` | `aggregate_lineage_mismatch` | 当前可信状态不变 |
| disabled history shape / hash / chain 不合法 | `mapping_input_blocked` | `source_scope_state_invalid` | 当前可信状态不变 |
| disabled history exact-valid，但 current null 与 last historical target lineage cross-binding 不一致 | `mapping_input_blocked` | `aggregate_lineage_mismatch` | 当前可信状态不变；不得返回 current-target integrity reason |

## 16. 验收测试矩阵替换与补充

PR #522 测试矩阵中未与本文冲突的 strict parser / whitelist、tenantId、occurredAt、provider guard、disable semantics、状态机、audit 低敏和非目标用例继续保留。以下表格就是规范 crosswalk；其中替换/删除行不得继续作为并列 expected，未列出的旧行按前句保留。

规范 crosswalk 固定如下，本文列出的旧行不得继续作为并列 expected：

| PR #522 旧契约 / 测试行 | 处理 | 本文唯一 expected |
| --- | --- | --- |
| caller-injected `fixtureRegistrySnapshot` / dependency shape | 替换 | zero-argument factory、module-owned bootstrap；任意额外 snapshot argument initialization blocked |
| fixtureRegistryDigest v1 KAT | 替换 | fixtureRegistryDigest v2，preimage 追加 candidateManifestDigest并使用本文 KAT |
| candidateDigest v1 KAT / 字段 flip | 替换 | candidateDigest v2，绑定 evidence、confidence 与 candidate-origin pair |
| aggregate `lineageLockIndexDigest` | 删除 | 仅 source-scope index 持有并绑定完整 lineage index |
| generation raw 禁止 mappingReference、review 无 mappingReference | 替换 | generation仍禁止；review / disable 把 raw mappingReference作为 opaque selector |
| `DisableContainmentContext` 单 aggregate / target | 替换 | 完整 SourceScopeRuntimeState + 先选 record + selected target quarantine |
| persisted `unmatched / not_generated` aggregate | 删除 | state=null conceptual before；empty manifest返回完整空 scope state且无 aggregate |
| 10-state matrix 的 unmatched row | 替换 | 第 16.3 节十个 persisted status/reason rows + null / empty-scope scenarios |
| conflict count 1—100 | 替换 | target / output / lock 全部统一 1—99，100 invalid |
| rawResponse/webhookPayload/apiResponse ordinary unknown | 替换 | forbidden registry / forbidden_field_blocked |
| ordinary plain object直接进入业务 parser | 替换 | captured Node Proxy oracle → schema capture → null-prototype carrier |
| arbitrary lexical hash mask、candidateDigest phone 一律阻断 | 替换 | 第 12.5 节 semantic path；bare/malformed phone阻断，完整合法 opaque digest数字 run窄 mask后继续 lookup |
| output digest 与其他 output string 分散 scanner | 替换 | mappingReview / mappingDecision / mappingConflict 每个 string统一 scanner，digest/reference走各自 semantic path |
| `eyj...` 与普通三段 dotted near-miss | 替换 | maximal 三段 base64url atom conservative forbidden，不依赖 `eyJ` |
| ordinary object + `JSON.stringify` audit | 替换 | null-prototype shadow + byte-unique fixed serializer |

### 16.1 manifest / generation

- empty manifest + null selector；非空 manifest + null selector；空 manifest + 非空 selector；不存在 / 重复 selector；
- module-owned bootstrap manifest 0 / 1 / 100 / 101 项，pair / reference 重复、排序不稳定、expected fingerprint 错配；intrinsic failure 全部只返回 initialization blocked；
- internal registry bootstrap 的 bundle 缺键 / 多键、digest / source scope 重复、同 scope 多 revision、factory deep-freeze 与无 callback / side effect；这些 seam 仅供 module self-test，不导出给调用方；
- public factory zero argument 成功；任意额外 argument 都在读取其 property 前 fixed initialization blocked。专门构造 authorityKind、manifest、records 与全部 digest 内部自洽的伪 snapshot 作为额外参数，断言零 property / getter / Proxy trap、无 trusted registry、无 dynamic error / partial instance / mapping audit，blocked result 不回显 payload；
- internal bootstrap 的 resource、scanner、digest、cross-binding 任一失败只返回 exact frozen `MappingDomainInitializationBlocked`；`authorityKind` 单独正确不能建立 provenance；
- public wrapper正向覆盖generation、review、disable，且public方法只接受raw command/state；package-private issuer/reducer seam中registered capability成功，普通object、canonical JSON、自建null-prototype、复制全部slots且内部自洽的forged carrier均在读取授权值前失败。逐项翻转method、tenant/scope、exact-order command、occurredAt、state index与`commandBindingDigest`；domain-instance-lifetime membership只读、永不consume/revoke，同一合法carrier重复调用结果一致。整个wrapper调用共享一次capture与总budget，raw object/Proxy只探测一次，preflight/reducer不得二次读取，所有trap/getter/callback计数为0；
- candidateManifestDigest v1 提供独立 KAT，并逐项翻转 tenantId、sourceScopeReference、sourceSnapshotDigest、sourceKind、dataMode、ordered entries、containsRealCustomerData、fieldWhitelistApplied；fixtureRegistryDigest v2 提供独立 KAT，并证明旧 v1 vector拒绝、candidateManifestDigest及其他既有 preimage字段任一翻转都会改变结果；
- manifest 外 score=100 仍不生成；manifest 内 low / medium / high 均不自动 matched；
- contact sync / source mapping / manual review admissible state 与 customer active state 的逐项正负矩阵；
- 完整 source 删除、添加、替换、重排，验证 snapshot 与 manifest binding；
- cursor 0→N、initial / complete 跳项与重放、stale scope state、generationComplete=false 时 review / regeneration 阻断但 current cursor continuation 与 processed mapping disable 成功；多 entry 逐项调用仍基于完整 manifest 识别双向 conflict；
- incomplete review + parser-valid但未命中target的candidateDigest固定`generation_incomplete`，不得被`candidate_target_not_found`覆盖；incomplete generation + wrong cursor / processed selector双失败也固定`generation_incomplete`。另以complete regeneration wrong selector + selected/non-selected target corruption证明只返回`generation_cursor_mismatch`，以review mappingReference 0命中 + 任一mapping/target corruption证明只返回`aggregate_lineage_mismatch`；为四组state的record/index/lineage合法digest/reference分别植入phone/national-id数字run，统一scanner只保存`deferred_trusted_shell` pending，仍返回同一precedence reason、audit零值且不打开mapping element；
- 同 pair / evidence、同 pair / 新 evidence、不同 pair / 同 evidence 的 mappingReference v2 vectors；
- 携带旧 runtime state 时 new evidence / registry revision 固定阻断；另行断言“删除全部 state 后 pure domain 无法证明旧历史”是明确 threat-model boundary，不编写虚假的跨 instance 防回滚测试；
- selector 不能覆盖 pair digest、evidence、score、origin、type 或 version。

### 16.2 evidence / score

- Levenshtein 的 ASCII、中文、多字节、组合字符、emoji、大小写和标点 known-answer vectors；lone surrogate 固定阻断；
- 九个 evidence 逐项 true / false，tag intersection 去重与 UTF-8 排序；
- manifest-owned mock customer boolean 不能由 source substring 或 reference 推导；
- score 49 / 50 / 79 / 80 边界；score 只影响 level 与 fixed low/manual-review vs candidate 提示状态，两种提示状态的 action allowlist / authorization完全相同，不影响 manifest eligibility、matched 或 auto-approve；
- expected fingerprint 与重算值不一致时 provenance fail-closed；
- generation / manual / target / MappingConflict / ConflictLineageLockRecord 的 unresolvedConflictCount 覆盖 0 / 1 / 99 / 100：1与99按对应路径合法，0或100在 conflict-present state固定 contract invalid；containment 不得接受 hash 自洽的100；
- low evidence + 输入 / existing target 篡改 high score/level、high evidence + 篡改 low、band 内自洽但与 evidence 总分不一致、格式合法 candidate digest 保持不变但 score/level 被修改，全部固定 `trusted_target_integrity_invalid`，不得继承或静默覆盖后继续 mutation；
- generation raw 注入 score / level 按 unknown field 阻断；manifest 内 high 仍不自动 matched，confidence 不改变 eligibility、authorization 或人工 review 要求；
- candidateDigest v2 对 candidate、low-confidence、conflict 三个 candidate-origin pair各提供至少一组跨实现 known-answer vector，并逐项翻转 candidateVersion、tenant、mappingReference、pair、evidence、recomputed score、level、candidateOriginMappingStatus、candidateOriginReasonCode、sourceKind、dataMode，均必须改变 digest；PR #522 candidate v1 known-answer 一律拒绝；
- initial generation → review → regeneration → review 完整 vector：review 不改变 current candidate digest，regeneration 增加 candidateVersion并产生新 digest；每个 candidateVersion 必须唯一绑定其最近 generation history entry 的 origin pair，缺失 / 重复 entry fail-closed。

### 16.3 state / history / atomicity

完整 persisted status/reason × action matrix 以本表为唯一 allowlist；每行未列动作固定 `mapping_invalid_transition_blocked / invalid_state_transition`，成功动作仍须通过各自 target、authorization/provider/sync、audit、time与capacity guards：

| persisted status / reason | 唯一可继续判定的动作 |
| --- | --- |
| `candidate / candidate_evidence_available` | `approve`、`reject`、`request_more_info`、`mark_conflict`、`clear_candidate`、`expire_candidate`、`disable_mapping` |
| `manual_review_required / low_confidence` | 与 candidate 行相同；low 只改变提示投影，不改变 action allowlist |
| `manual_review_required / review_reopened` | `generate_candidate`、`disable_mapping`；旧 target inactive，其他 review action非法 |
| `matched / approved_by_manual_review` | `reopen`、`disable_mapping` |
| `rejected / rejected_by_manual_review` | `reopen`、`disable_mapping` |
| `needs_more_info / more_info_requested` | `reject`、`clear_candidate`、`reopen`、`expire_candidate`、`disable_mapping` |
| `conflict / mapping_conflict` | `clear_candidate`、`disable_mapping` |
| `cleared_locked / candidate_cleared_locked` | 仅 `disable_mapping` |
| `stale / candidate_expired` | `generate_candidate`、`disable_mapping` |
| `disabled / mapping_disabled` | 无成功动作；再次 `disable_mapping` 固定 `mapping_already_disabled`，其余为 `invalid_state_transition` |

state=null 与 empty scope 不属于 persisted status row：只有符合第 4.3 / 9.3 节的 initial generation/no-candidate path可成功；review / per-aggregate disable 固定按 source-scope / lineage reason阻断。

- initial generation 的 scope version 0→1、aggregate / candidate / history version 1；empty manifest 也固定 scope version=1、cursor=0、records/mappings=[]；后续 cursor、existing generation 与 review 的严格 +1；
- 2—100 entry 的每次 nextState 都保留全部既有 aggregate / target / history；source-scope mapping / record append 或 selected replacement时，其他 mappings / records deep / CE byte equal，并覆盖 scope index digest known-answer；
- `manifestEntryReference`、`candidatePairDigest`、`mappingReference`、非 null `candidateDigest` 的现有、prospective append / replacement uniqueness；重复固定 `source_scope_state_invalid`；
- review mappingReference 的 wrong grammar / 0 命中 / duplicate state / cross-scope 与 target-present candidateDigest mismatch；disabled mapping 必须跳过 candidate lookup并稳定返回 `invalid_state_transition`；
- non-monotonic occurredAt、history 999→1000 接受、1000→1001 阻断；
- history chain before=previous after、严格时间、last snapshot / aggregate / record binding，以及含 initial / review / disable 的 history digest known-answer；history shape/hash/chain 失败固定 `source_scope_state_invalid`；
- mappingReference 在同 material lineage 内不变，target createdAt 仅 generation 改变；
- 每个动作的 target flags、resultKind / output / audit 唯一矩阵、history snapshot 与 aggregate / scope record binding；
- disable在generationComplete=false可选择processed prefix；containment oracle不解析registry / manifest、不遍历selected target。分别覆盖selected target missing、selected target accessor、selected target contract-invalid data、non-selected mapping accessor：前三类必须在先选record后进入selected quarantine exception并统一写null，最后一类直接fail-closed；test harness在调用前后比较descriptor kind与value/get/set identity，domain只从首次intrinsic descriptor record捕获identity且不二次reflection；所有getter / setter / Proxy trap为0，其他mappings原样保留；
- selected target 无论 data / accessor / missing 都不 traverse；恶意 target + auditReady=false / non-monotonic / capacity blocked 时用 module-owned quarantine descriptor identity证明零调用、零 mutation，不要求非法 target CE 编码。selector 不存在、selector 重复、跨 tenant与 already disabled 仍按第 9.8 节固定 precedence；
- generate / review → disable 完整矩阵：current aggregate 与 record candidateDigest=null、current target=null、最后 non-disable history target 的 historicalCandidateDigest 非空且 byte-equal、disable entry targetSnapshot=null、audit digest 为零值。分别篡改 current null、historical digest、pair/evidence cross-bind；shape-valid cross-bind 错固定 `aggregate_lineage_mismatch`，不得落入 current-target integrity；
- containment 双重失败 precedence：auditReady=false 优先 already-disabled，already-disabled 优先 non-monotonic 与 history / scope / index capacity，其余按第 9.8 节 1—12 顺序；
- method/state 全矩阵覆盖 null、完整 runtime state、旧 SourceScopeOnly / NewAggregate / ExistingMapping state 及 arbitrary object；
- 以上十个 persisted status/reason rows逐项交叉九个 action `generate_candidate`、`approve`、`reject`、`request_more_info`、`mark_conflict`、`clear_candidate`、`reopen`、`expire_candidate`、`disable_mapping`，断言唯一成功转换、`invalid_state_transition`或 disabled重复动作的 `mapping_already_disabled`；PR #522 的 persisted `unmatched` row删除，改由 state=null、empty scope与 no-candidate三组单独覆盖；
- derived output、audit、history 或 nextState 任一 factory 失败均零 partial mutation；
- blocked result keys 恰为 `ok,auditEvent`；普通输入 state 深等 / CE byte equal，containment 非法 selected target slot 按第 10.3 节 descriptor identity 例外断言，committed 与 blocked result 均 recursive frozen。

### 16.4 scanner / key taxonomy / audit

- NFKC、ASCII casefold、一次 percent decode 后再次 casefold、encoded uppercase / separator / mixed plain near-miss；
- ingress / structural budget 以 ordinary plain object / array成功捕获为正例；function、class、custom prototype、unregistered null-prototype object、root / nested / revoked Proxy、Proxy ownKeys / getPrototypeOf / descriptor trap、object 64 / 65 keys、depth 64 / 65、known array 上限 / +1、sparse / named-extra array、self / parent cycle、acyclic alias、scope history 2,000 / 2,001、单 field string 4,096 / 4,097 做负向与边界测试；所有 trap / getter 为 0；
- canonical JSON string transport覆盖module-private bootstrap self-test seam 16,000,000 bytes / +1（证明不暴露为factory参数）、public wrapper 4,000,000 / +1、duplicate key、schema key order错误、unknown / forbidden value bounded-skip、selector前mapping/target opaque-span延迟materialize、depth/node/array early gate、`-0` / fraction / exponent / NaN / Infinity、lone surrogate、escaped key/value与`__proto__` data key；`Buffer`、`Uint8Array`、`ArrayBuffer`固定`invalid_payload_shape`，不声称测试JS string接口不可表达的invalid UTF-8 bytes。超限或首错后不继续materialize且callback=0；完整persisted state JSON round-trip后重新捕获并保持canonical digest / history binding；
- factory graph覆盖node 2,000,000 / +1、business source string 8,000,000 / +1、fixed precharge 640,000,000 / +1；完整public wrapper graph覆盖node 500,000 / +1、business source string 2,000,000 / +1、precharge 160,000,000 / +1，并证明capture/preflight/issuer/private reducer/output/audit共用累计counter。projection不重复计source-string cap，另覆盖恰好16× / 超过16×；边界通过synthetic precharge seam验证，不实际运行亿级transition；每类提供恰好满足全部local + aggregate contract的最大合法graph，structural/string/precharge超限时后续content stage为0且audit不含raw payload；
- dense `@`、dot、percent、escaped quote 与组合字符 adversarial input 断言 single-pass operation counter 线性，不使用 wall-clock；禁止逐 `@` 双向扩展或 backtracking regex；
- LF / CRLF / U+2028 / U+2029 后的 phone、credential、external id 全长扫描；
- serialized raw object / array及 percent-encoded object / array在 field mode 阻断；普通 scalar 不误判，但一层 / 二层 JSON-string 包装、backslash escaped quote、prefixed escaped JSON fragment 内的 forbidden assignment 均阻断；第三层或无法安全 canonicalize 的 assignment-like escape fail-closed；canonical audit envelope 不因外层 JSON 误杀；
- 多重命中按固定分类优先级，但 public result 不含 category、offset 或片段；
- 10,000 个固定 seed canonical SHA-256 / mapping reference 只在 schema-registered digest/reference semantic path 验证数字 run 低误报；同一值放入 ordinary path 不获得 mask；
- canonical digest/reference semantic slot 内含手机号 / 15或18位证件号数字 run且完整 grammar/integrity正确时允许窄 mask；displayName、summary、remark、label、freeText分别放入 `sha256` / `ref` looking atom + phone / national id / secret 必须 `sensitive_value_blocked`。prefix/suffix、换行、uppercase、63 / 65 hex、错误 prefix与全零不获得 mask；
- `deferred_trusted_shell`逐项覆盖index / record / lineage中的digest/reference：scanner立即产出pending；selector成功后material integrity正确则resolve并mask，integrity错误则对应trusted/lineage reason，pending未resolve时commit/output/audit factory不可达；completeness、wrong selector或0-hit提前阻断时pending被丢弃且audit不回显原值；
- forbidden registry 每类 key 的 camel / snake / hyphen / dot / repeated separator / fullwidth / mixed-case 变体；extra object key 与 assignment string 对同一 spelling 必须得到相同 canonical token；
- forbidden registry 每个 canonical token 的 assignment / query plain、camel、snake、hyphen、dot 与一次 percent-encoded separator；逐项覆盖 `private.key`、`access.token`、`api.key`、`password`、`external.user.id`、`phone`、`mobile`、`tel`，并断言 registry 外 key、无 separator、左边界不合法、64 / 65 字符 near-miss；
- quoted assignment 覆盖 prefixed / suffixed 双引号、单引号、array / object log fragment、percent-encoded quote / dot / underscore / separator、escaped quote、backslash escaped quote、JSON-string 一层 / 二层、引号不配对与 registry 外 quoted key；canonical audit envelope 必须保持通过；
- Unicode 15.1 NFKC NormalizationTest known-answer与至少一组版本边缘vector固定expected UTF-8 bytes；宿主Node/ICU normalize结果漂移时factory initialization blocked，email General_Category与NFKC使用同一15.1 data version；
- credential positive / near-miss覆盖`sk-`、`pk-`、bearer，以及maximal base64url atom的2 / 3 / 4 / 5 / 6段、JWS空payload、JWS空signature、payload/signature同时为空near-miss、JWE空encrypted-key、JWE空ciphertext、大小写、前后`-` / `_` / `.`、一次percent-encoded dot；exact三段JWT/JWS与五段JWE conservative forbidden，不从四段、六段或更长atom截取；
- email/contact单次maximal token覆盖ASCII、Unicode local、Unicode domain、`xn--` punycode、fullwidth NFKC与混合场景；`a@b`、`用户@example.com`、`a@例子.公司`、punycode TLD、首尾hyphen与左右非空的多个`@`固定阻断；单独`@`、`@a`、`a@`、emoji-only side固定不命中email分类。补含contact骨架的254 / 255 code-unit边界，以及不含`@`的254 / 255位ordinary atom near-miss，后者不因email overlength阻断；不得因Unicode绕过或从更长token截取；
- exact allowed `authorization`、`externalUserIdDigest` 不被 key registry 误杀；
- forbidden + missing、ordinary unknown + missing、unknown + sensitive value、allowed scalar + nested container 的固定 precedence；
- symbol、getter / setter、non-enumerable extra、class instance、custom prototype、unregistered null prototype、cycle、alias 与 Proxy 均阻断；ordinary plain object必须先捕获为 parser-issued null-prototype carrier才进入业务逻辑，且不得执行 getter / trap；
- candidate-bound review逐项覆盖 allowed scalar承载 nested `rawResponse` / `webhookPayload` / `apiResponse` object；raw candidateDigest 为 bare/malformed phone、secret assignment或 raw externalUserId时在 grammar / target lookup前 `sensitive_value_blocked`且 audit digest为零；
- raw candidateDigest为完整`sha256:<64hex>`且hex内偶然形成phone / national-id run时，按opaque-selector semantic完成scanner后再进入completeness / target lookup：相等则继续，格式合法但不存在固定`candidate_target_not_found`。raw mappingReference同样覆盖完整v2 reference数字run、record相等与grammar-valid 0命中`aggregate_lineage_mismatch`；不得把anchored grammar/mask当authority。trusted target candidateDigest另覆盖“grammar合法、含phone/id run、recomputation错误”并固定`trusted_target_integrity_invalid`，不得漂移成`sensitive_value_blocked`；
- candidate-bound review 对 `tenantId` 与 `occurredAt` 分别覆盖 `LF + phone`、`LF + secret`、`LF + wm_/wo_ externalUserId`，并对 CRLF / U+2028 / U+2029 做同类矩阵；sensitive scan 必须先于 tenant / timestamp grammar，audit 不回显 input；
- mappingReview / mappingDecision / mappingConflict 每个 string 字段的 scanner 注入；
- 每个 event / reason 的 safe canonical envelope sweep，以及每个 audit string 字段逐项敏感注入；
- normal audit shape / scanner / grammar / fixed serializer 失败统一 audit_not_ready，dynamic projection 失败使用预构造全 sentinel；blocked constructor 自检失败时 factory 不返回实例；
- normal、blocked、full-sentinel 各提供 exact JSON bytes / key order known-answer；污染 `Object.prototype.toJSON` 与 11 个字段名 prototype setter、payload / nested `toJSON`、getter 返回敏感值时调用计数为 0；serializer throw、unsupported type、顺序错误均零 mutation并 fallback；
- blocked audit 的 11 keys、完整 fallback values、trust frontier、null-prototype shadow、fixed serializer、candidateDigest semantic span和单事件规则；raw command不能选择 `canonical_audit_envelope` mode。

## 17. 实现前置条件

只有本文通过独立人工审查并合并后，才可重新授权 05C-E1 runtime 实现。实现仍须：

1. 从最新 main 新建干净分支；
2. 原 WIP 不直接提交或创建 PR；不复制、不 cherry-pick、不复用其中未审查代码；
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
