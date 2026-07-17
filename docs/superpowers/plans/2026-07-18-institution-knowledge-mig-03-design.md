# 机构知识库 MIG-03 技术设计与数据变更申请

> **任务：** `MIG-03-DESIGN`（docs-only）<br>
> **日期：** 2026-07-18<br>
> **设计基线：** `origin/main@3f11b944e7c1e6ac9a42dd3fdf7f598cb4425b89`；已复核主线的 `MIG-01` 与 `MIG-04` docs 申请<br>
> **状态：** 申请总协调台审批；本文不构成 schema、migration、数据库连接、runtime、worker、provider 或能力发布授权。

## 一、申请结论与排期

申请在唯一迁移序列中执行 `MIG-03`：

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

`MIG-03` 只能在 `MIG-01`、`MIG-02` 已合并、已验证且总协调台确认兼容窗口后开始。它为机构知识库建立真实、机构隔离、可追溯的持久化底座；不替代 `KB-02A` 已合并的纯领域门禁，也不把后续 `KB-02B–C`、`KB-03`、`KB-04`、检索、问答或页面工作夹带进迁移。

**前置复核：** `BASE-02B` 仍是正式来源证明与当前机构成员资格的独立 runtime 前置，不能以结构合法的 `AccessContext`、演示会话、缓存角色或客户端机构选择替代。`MIG-03` 可以完成数据设计和隔离数据库迁移，但任何新 repository、current reader、写命令或 capability-on 都必须等待 `BASE-02B` 已交付的服务端 guard；`MIG-01`、`MIG-02` 的已验证机构归属与既有串行约束也不得在本迁移中重造。

本申请的成功标准是：新事实可以在独立测试数据库中安全写入、回读、约束验证和回滚；生产读取仍保持 capability-off，直到服务端 scope guard、repository、current reader、公共契约和相应栏目 PR 分别获准。

## 二、范围与明确非范围

### 2.1 本次数据事实

1. 机构 canonical knowledge item，以及不可变结构化正文、附件和附件修订。
2. 不可变 version、canonical manifest 与版本附件清单。
3. publication 历史、唯一 current pointer、撤回原因/操作者和乐观 revision。
4. 当前 publication 下逐附件的批准、撤回、阻断与渠道兼容事实。
5. parse、chunk、index revision 及具备 lease/attempt 的可恢复 job 事实。
6. 受限客户资料/附件隔离实体：复合 scope 至少为 `tenantId + institutionId + customerId`，具有独立 content/index namespace、revision 与引用；`KB-07` 只能消费该事实，不能在后续再补造 `customerId` 隔离。
7. 为后续 citation、回答快照、低敏审计预留受控关联位；本轮不实现这些读取或写入流程。

### 2.2 明确不做

- 不修改 `src/**`、`drizzle/**`、schema、migration、API、路由、页面、测试、脚本、worker、scheduler 或配置。
- 不连接数据库，不执行 DDL/DML，不回填，不读取 `.env*`、凭证或对象存储。
- 不接 OCR、embedding、rerank、知识 AI、渠道、HIS 或其他外部 provider。
- 不声明或实现公共 `PublishedKnowledgeReferenceV1`、`ApprovedKnowledgeAssetReferenceV1`、`RestrictedCustomerKnowledgeAccessV1`；公共声明仍由总协调台所有。
- 不把 library 设为 canonical 身份。资料库只是页面/分组视图，`knowledgeId` 才是内容身份。

## 三、共同不变量

| 主题 | 强制规则 |
| --- | --- |
| 机构隔离 | 通用知识事实带非空 `tenantId + institutionId`；受限客户实体和索引引用必须再带唯一 `customerId`。复合外键和唯一索引必须保持完整 scope；客户端 scope 只能是待校验引用。 |
| 所有权 | `ownershipSource` 精确为 `institution` 或 `platform`。机构侧写命令遇到 `platform` 一律 `platform_read_only`；平台可见关系不赋予机构修改权。 |
| 不可变性 | body/file revision、version/manifest、publication fact、decision event、批准 fact 与低敏 audit reference 均只 append；不得 update 覆盖内容、hash、actor、时间或撤回原因。唯一允许更新的是有 revision 条件的 current projection。 |
| 状态分离 | item lifecycle、version lifecycle、safety status、asset approval status 和 job status 独立列/表表达，禁止合并为单一 `status`。 |
| 低敏边界 | `storageKey`、原始正文、parse 原文、chunk 原文、provider payload、凭证、prompt/completion 不能进入列表、公共引用、普通审计或迁移日志。 |
| 失败处理 | 未通过 safety、parse、index、用途或 attachment binding 时，旧 current 不变；未知 safety 与缺失 binding 均 fail-closed。 |

## 四、目标数据模型

下表是申请的逻辑实体和约束，不是 DDL。具体表名、列类型、枚举名、索引名、分区策略和 SQL 由总协调台 migration 任务评审后冻结。

| 逻辑实体 | 必要字段 | 不可变与关联约束 |
| --- | --- | --- |
| knowledge item | `knowledgeId`、`tenantId`、`institutionId`、`ownershipSource`、item lifecycle、`revision`、`lastDecidedAt`、`lastDecidedByActorId` | `(tenantId, institutionId, knowledgeId)` 唯一；`revision` 为正安全整数；`platform` 记录不接受机构写入。 |
| body revision | `bodyRevisionId`、item/scope、结构化正文、规范化 content hash、schema/template version、创建 actor/time | `(knowledgeId, bodyRevisionId)` 唯一；相同 hash 不代表可跨 item 复用；正文不可覆盖。 |
| attachment revision | `fileRevisionId`、item/scope、文件 content hash、MIME、大小、安全状态、受控显示名、创建 actor/time | `(knowledgeId, fileRevisionId)` 唯一；不可使用可变 file 当前行替代 revision；`storageKey` 如存在仅服务端私有。 |
| immutable version / manifest | `versionId`、`knowledgeId`、单调 `versionNumber`、metadata snapshot、`bodyRevisionId`、manifest hash、created actor/time | `(knowledgeId, versionNumber)`、`(knowledgeId, versionId)` 唯一；version manifest 通过版本附件清单精确冻结附件顺序与 revision。 |
| version attachment manifest | `versionId`、`fileRevisionId`、ordinal、附件安全快照 | `(versionId, ordinal)`、`(versionId, fileRevisionId)` 唯一；ordinal 连续、不可变，不能从可变 file 查询补齐。 |
| immutable publication fact | `publicationId`、item/scope、`versionId`/version number/manifest hash、complete/safety/use-scope 快照、published actor/time | `(knowledgeId, publicationId)` 与 `(knowledgeId, versionId)` 唯一；该行从不改写为 superseded/withdrawn。 |
| publication decision event / lineage | `eventId`、`publicationId`、前一 current publication、`publish`、`supersede`、`withdraw`、`retire` 或 `correction`、受控 reason、actor/time、command/result/audit reference、supersedes/corrects reference | `(publicationId, eventSequence)` 连续唯一；withdraw/correction 都是新 event，且 correction 必须指向被更正的不可变 fact/event。 |
| current projection | item 的 nullable `currentPublicationId`、projection revision、as-of event | 仅通过 `expectedRevision` 的 CAS 更新；同事务追加 decision event 和低敏 audit reference。未 retired item 的 pointer 必须指向唯一有效 fact；retired item 必须为 `NULL`。 |
| asset approval fact / projection | `approvalFactId`、publication/version/file revision、safety/渠道证据、decided actor/time；当前 approval projection | 复合外键证明 file 属于 version manifest；批准、撤回、阻断均追加 decision fact，projection 仅 CAS 更新。`approved` 不是发送能力，缺 current binding、撤回、阻断、未知 safety 或渠道不兼容均不可发送。 |
| parse/OCR/chunk/index evidence | 输入 body/file revision、`ocr_required`、`unavailable` 或 `succeeded`、processor/config version、artifact hash、completedAt、受控失败码 | 四类 evidence 分别追加并通过 revision/hash 绑定；job 成功、mock 结果或旧 preview 绝不等于 index 完成。 |
| knowledge command result | action、完整 scope、target revision、永久 idempotency key、payload fingerprint、首次结果 reference、actor/time | `(scope, action, idempotencyKey)` 永久唯一；同 key 任一 fingerprint/target revision 不同固定冲突，重放只返回既有结果。 |
| active work / attempt | job identity、scope、目标 revision、kind、dedupe fingerprint、attempt、lease token/until、受控失败码 | active-work dedupe 只在活跃窗口生效，独立于永久 command idempotency；完成/失败不删除 attempt 事实。 |
| restricted customer knowledge | `customerKnowledgeId`、`tenantId`、`institutionId`、`customerId`、body/file revision、独立 parse/chunk/index namespace reference | 三元 scope 是所有唯一键、外键和索引前缀；不得与通用 knowledge item、通用 chunk 或索引 namespace 混用。 |
| migration batch / audit reference | batch identity、来源证明 digest、scope、阶段、计数、lineage/correction reference、低敏 audit reference | batch 只追加；不存正文、客户资料、provider payload 或凭证，且能追溯每个 backfill/correction 的受控结果。 |

### 4.1 Publication 与 current pointer 的原子边界

发布、撤回、退役和未来 rollback 必须在同一数据库事务中锁定同一 item 行，校验 `expectedRevision`，追加不可变 publication/decision event，再以 CAS 更新 current projection/revision。publication fact 绝不原地从 `current` 改成 `superseded` 或 `withdrawn`；这些是投影从追加事件得出的状态。建议采用 item 行锁加唯一 current projection 约束的双层保护：

1. 锁定 `(tenantId, institutionId, knowledgeId)`，验证 ownership、item lifecycle 与 `expectedRevision`。
2. 验证候选 version/manifest、parse/index/safety/use-scope 门禁；任一失败只记录受控结果，旧 current 不变。
3. 通过后才插入新 publication fact，追加旧 current 的 supersede event 与新 current event，并以 CAS 更新 item pointer/revision/last decision actor/time。
4. 唯一约束冲突、revision 冲突或事务异常都回滚整笔变更，不能先下架旧版。

rollback 必须额外获得当前权威 safety-rule 的新鲜绑定证据；在该 server reader 与证据来源落地前，rollback command capability-off，固定返回 `rollback_current_safety_unavailable`，不得信任历史 safety snapshot。

### 4.2 永久命令幂等、活跃工作去重与时间

- 永久 command idempotency 以 `(tenantId, institutionId, knowledgeId, actionKind, idempotencyKey)` 唯一，首次持久化完整 payload fingerprint、target revision 与既有结果 reference；同 key 任一项不同固定冲突，绝不恢复为“新 command”。
- active-work dedupe 以 `(scope, target revision, job kind, dedupe fingerprint, active lease window)` 判断，只防止并行重复工作；它不替代永久 command 结果、也不在完成后抹去 attempt/结果谱系。
- `expectedRevision` 不相等固定冲突；接近 `MAX_SAFE_INTEGER` 前 fail-closed，不允许溢出。
- version number 必须从 1 连续，publication history 的 version number 也必须连续；published/withdrawn/last-decided 时间不得倒退。
- 所有 actor 都是受控 reference；`withdrawReasonCode` 只能取受控枚举，不能存自由文本。
- current pointer、publication history 和 asset approval 的外键均在相同 scope 下验证，杜绝跨 tenant、跨 institution、跨 item 拼接。

### 4.3 Parse、OCR、chunk 与 index 的真实证据

每个处理阶段独立追加 evidence，不能由 job status 代替：

| 阶段 | 必须绑定的输入与证据 | 不得据此宣称 |
| --- | --- | --- |
| parse | input body/file revision、processor/config version、artifact hash、`completedAt`、受控结果 | 旧 parse 文本或 request job success 是当前 revision 成功。 |
| OCR | input file revision、`ocr_required`、`unavailable` 或 `succeeded`、processor/config version、artifact hash（仅 `succeeded`）、`completedAt` | `ocr_required`、provider 未接入或 mock/dry-run 是 OCR succeeded。 |
| chunk | parse/OCR artifact hash、chunk revision、ordinal/offset、chunk artifact hash、processor/config version、`completedAt` | 覆盖式旧 chunk 或 preview 是可检索 revision。 |
| index | chunk revision/hash、index config/version、真实 index artifact/evidence hash、`completedAt`、safety/readiness | job completed、mock embedding、内存索引或 deterministic rerank 是真实 index 完成。 |

只有 input revision、processor/config、artifact hash 与 completion evidence 全部可验证，且安全/用途满足门禁时，后续 current reader 才可能把 index 视为完成；否则保持 `unavailable` 或 `disabled`。

### 4.4 独立 DB 与 lease 边界

`MIG-03` 只持久化 job/attempt/lease 事实，不启动 worker。未来 worker 必须使用独立于 HTTP request 的数据库事务和连接生命周期：以短事务 claim、`leaseToken + leaseUntil` 和条件更新领取工作；长时间 parse/OCR/index 不得持有 item publication 锁。完成、失败、续租和取消都必须带 lease token/attempt 条件，失效 lease 不得覆盖后继 attempt。测试使用独立临时数据库，不能连接开发或生产数据库。

### 4.5 所有操作的 BASE-02B 授权链

所有 reader、writer、job claim/complete、asset approval 和受限客户资料操作都必须逐次经过同一完整链：`verified source provenance → fresh active membership → institution guard → authoritative object scope reader → object guard`。其中：

1. provenance 证明当前来源可作为正式服务端输入；演示会话、缓存角色、客户端 scope、manifest 或 URL 参数均不构成证明。
2. membership 必须是当前、有效、未撤销的机构成员资格；过期或未知一律 fail-closed。
3. institution guard 只确认该成员可进入 `tenantId + institutionId` 分区；随后 object scope reader 必须以同一完整 scope 找到权威对象。
4. object guard 再针对具体 action、版本、publication、file、job 或 `customerId` 检查角色、用途、分配/隐私授权和当前状态。
5. `institution_scopes`、manifest、version hash 和外键只锚定归属/完整性，**不授予**成员、对象或发送权限；任何链节缺失均不得返回业务数据或执行写入。

## 五、旧数据预检、回填与隔离

### 5.1 预检清单

在任何 DDL 前，由总协调台在离线、受控环境生成仅含计数和受控 failure code 的预检报告：

| 检查 | 通过条件 | 失败处置 |
| --- | --- | --- |
| scope 完整性 | 候选 item 都能确认唯一 tenant 与 institution | 不进入回填；记录 `scope_unverified`。 |
| identity/文件完整性 | 引用、hash、MIME、大小和归属可核验 | 不创建 attachment revision；隔离等待人工处理。 |
| 正文与 preview 分类 | 原文、parse text、chunk preview 已完成内容分级、保留期和安全处置批准 | 未批准不回填，不进入普通审计或 read model。 |
| publication 可解释性 | 版本、actor、时间、安全、用途、current 关系可完全重建 | 仅建立隔离迁移候选，不赋 current。 |
| 受限客户隔离 | 每个候选都有唯一 `tenantId + institutionId + customerId`，且 body/file、chunk/index 引用均在独立 namespace | 不回填、不降级为通用机构知识；记录 `customer_scope_unverified`。 |
| 事件、投影与谱系 | immutable fact、decision event、current/approval projection、correction/supersession lineage 与 migration batch 均可重建 | 不创建 projection；记录 `lineage_unverified`。 |
| 平台可见关系 | 平台 owner 与机构 visibility 能被单独证明 | 只作为平台迁移输入，绝不转为机构可写 item。 |

预检输出不得含正文、客户姓名、消息、storage key、凭证、provider payload 或向量值。

### 5.2 Expand → Backfill → Enforce

1. **Expand**：仅新增 tables/columns/indexes/外键和受控枚举：immutable revision/version/publication/approval facts、append-only decision event、带 `projectionRevision` 的 current/approval projection、correction/supersession lineage、migration batch/低敏 audit reference，以及受限客户三元 scope 的独立 content/index namespace。不得删除旧表，不改旧 request job 行为，不切换任何 read path。
2. **Backfill**：只处理经预检批准、来源可解释的候选。每批有 migration batch identity、来源证明 digest、完整 scope、计数、低敏失败码与可重跑控制；永久 command idempotency 必须绑定 payload fingerprint、target revision 与既有 result reference，active-work dedupe 则仅绑定活跃 lease 窗口，二者不得混用。先追加 revision/version/publication fact 与 decision event，完整性校验成功后才以 CAS 写 current projection。没有精确 `customerId` 及独立 namespace 的受限客户资料绝不回填。
3. **Verify**：对每个 scope 验证 version 连续性、manifest binding、publication fact/event/current projection 一致性、actor/reason 完整性、附件 manifest/approval 绑定、correction/supersession lineage、batch/audit reference 和无跨 scope 引用；同时按输入 revision、processor/config version、artifact hash、`completedAt` 分别验证 parse、OCR、chunk 与真实 index evidence。
4. **Enforce**：在全部已批准回填完成且旧写路径停用后，启用非空、复合外键、unique、check、partial unique current、append-only 权限/trigger（如总协调台选择）及 current/approval projection 的 `expectedRevision` CAS。不得通过更新 immutable fact 表达 superseded/withdrawn；reader 仍由 capability gate 控制，不以 migration 成功替代发布验收。

### 5.3 明确禁止自动回填的旧数据

下列记录不属于正式 `MIG-03` backfill 输入：

- `knowledge_sources`、`knowledge_documents`、`knowledge_chunks`、`knowledge_index_jobs` 中 `mock | seed | demo` 来源；
- `mock_demo_embedding`、固定 8 维 SHA-256 embedding、内存余弦、deterministic rerank 的产物；
- 旧同步 request job 及其可覆盖 parse/embedding 结果；
- 未经内容分类/保留期审批的 parse 原文、chunk preview、旧 QA question、answer preview；
- 缺少精确 `customerId`、独立 content/index namespace 或受限客户来源证明的旧客户附件、会话/任务副本；
- 将 `platform_knowledge_institution_visibility` 直接伪装成机构 item/version/current 的记录。

这些数据可以保留在旧隔离命名空间，供预检、人工审查或清理决策使用；不得进入正式列表、publication、检索、问答、任务指标或额度。

## 六、平台与跨线边界

- 平台内容的版本与 current pointer 由平台知识管理所有者写入；机构迁移只保存经过授权的可见/引用关系，不复制平台内容为机构可写副本。
- 平台强制安全规则优先于任何 institution publication snapshot；规则版本、provider 与冲突治理由平台/总协调台另行冻结。
- 会话、AI 和其他消费者不得读本迁移的 repository/table。它们只能消费总协调台声明、知识模块 provider 提供的当前 publication/approved asset 引用。
- `ApprovedKnowledgeAssetReferenceV1` 依赖 `KB-03C` 的批准 provider；迁移存在 approval 表不等于可发送，能力在该 provider 验收前固定关闭。
- `MIG-03` 本身定义受限客户资料/附件的三元 `tenantId + institutionId + customerId` scope、独立 revision 与独立 content/index namespace；`KB-07` 只能消费经权威 reader/object guard 放行的该事实，不得延后补造或推断 `customerId` 隔离。角色、分配范围和独立敏感 AI 授权仍须由总协调台冻结，并由 `BASE-02B` 链逐次验证。

## 七、回滚、故障与运维边界

`MIG-03` 采用可逆的 expand-first 策略。回滚顺序为：

1. 先关闭新 repository/current reader、发布和 job capability，阻断新写入与新读取。
2. 保留 append-only 新表和迁移批次证据，不删除历史、不重置 version number、不把 current 回退为旧可变行。若需改变 current/approval，只能追加 correction、supersession、withdraw 或 retire decision event，并以 CAS 更新 projection；不得改写 immutable fact。
3. 若需恢复旧应用，仅恢复旧隔离 read path；不得把新 publication/approval 事实同步回 mock/seed/demo 或旧同步 job。
4. 仅在数据保留期、审计和 downstream reader 都确认无依赖后，另行申请清理 migration；本申请不包含 destructive down migration。

数据库锁等待、唯一冲突、外键失败、lease 过期、预检失败和回填不完整都必须产生受控低敏失败码与批次级计数。不得记录正文、附件 bytes、客户数据、provider 错误全文或凭证。

## 八、审批前需冻结的决策

| 决策 | 所有者 | 未决时的行为 |
| --- | --- | --- |
| 最终 DDL、索引、复合外键、partial unique 与 append-only 执行方式 | 总协调台 / 数据库所有者 | 不执行 MIG-03。 |
| 旧正文、preview、QA 文本的分类、保留期、回填或清理规则 | 隐私治理 / 数据所有者 | 相关旧数据隔离，不回填。 |
| 平台 current publication 与强制安全规则 provider/version | 平台知识管理 / 总协调台 | 平台冲突按 fail-closed，机构不自行推断。 |
| 当前 publication 与 approved asset 公共契约声明、failure-code 白名单 | 总协调台 | repository/reader 保持 capability-off。 |
| job lease 时长、续租上限、取消与重试策略 | 总协调台 / 运行时所有者 | 仅建事实模型，不启 worker。 |
| 受限客户角色/分配范围、敏感 AI 授权与 retention | 总协调台 / 隐私治理 | 三元 scope 实体保持不可消费；不以机构成员资格替代 customer scope。 |

## 九、迁移验收与后续解锁条件

### 9.1 MIG-03 自身验收

| 验收主题 | 必须通过的证据 | 不通过时的行为 |
| --- | --- | --- |
| 可重复迁移与谱系 | 独立测试数据库可重复执行 expand、受控 backfill、verify；每个 batch 有来源证明 digest、计数、低敏 audit reference，且 correction/supersession lineage 可重建 | 不产生新的 current projection；批次以受控失败码结束。 |
| 不可变事实与投影 | 重复执行不产生重复 version/publication/job；publication/approval fact 与 decision event 不可更新，只有携带 `expectedRevision` 的 projection 可 CAS 变更 | 拒绝更新 immutable fact；旧 current 保持可解释。 |
| 原子 current | 同一 item 并发 publication 至多一个 current；门禁失败、CAS 冲突或事务异常后旧 current 仍可读 | 不先下架旧版，不产生半写入。 |
| 完整授权链 | reader、writer、job、asset 操作均有 `verified source provenance → fresh active membership → institution guard → authoritative object scope reader → object guard` 的服务端证据；`institution_scopes`/manifest 仅作锚点 | 任一环缺失返回受控 denied/disabled，不返回业务数据或执行写入。 |
| scope 与受限客户隔离 | 跨 tenant/institution/item 的 body、file、version、publication、approval、job 引用被约束拒绝；受限客户资料必须精确绑定 `tenantId + institutionId + customerId` 和独立 content/index namespace | 缺 customer scope、namespace 或来源证明不回填、不读取、不索引。 |
| version/history 完整性 | version/publication 连续性、revision、时间、actor、withdraw reason、manifest hash、附件 ordinal、decision event sequence 和 correction lineage 的破坏样例全部拒绝 | 拒绝该 command/backfill 记录，不修补或覆盖历史。 |
| 附件发送门禁 | `approved` 未绑定同一 current publication/file revision、已撤回/阻断或安全未知时，不产生可发送引用 | 固定 fail-closed。 |
| 处理与索引真实证据 | parse、OCR（`ocr_required`、`unavailable` 或 `succeeded`）、chunk、index 分别有 input revision、processor/config version、artifact hash、`completedAt`；仅真实 index evidence 可声明完成 | job success、mock embedding、内存索引、旧 preview 一律不解除 `unavailable`/`disabled`。 |
| 幂等与活跃去重 | 永久 command idempotency 固定 payload fingerprint、target revision、既有 result reference；active-work dedupe 仅限制活跃 lease 窗口且保留 attempt | fingerprint/revision 不同固定冲突；不得将去重结果伪作 command 重放。 |
| 旧数据与低敏输出 | mock/seed/demo、旧同步 job、旧原文/preview 及无 customer scope 的客户副本未进入正式 batch；迁移日志、失败记录和验收输出均为低敏 | 留在旧隔离 namespace，等待人工处理。 |

### 9.2 后续栏目解锁

`MIG-03` 通过不自动开启知识能力。仅当以下条件分别获批后，才可启动对应 runtime：

1. `KB-02B`：基于新表实现 scope-bound 只读 repository 和 current reader；`ready | empty | partial | stale | unavailable | denied | disabled` 语义完整，未就绪保持 `disabled`。
2. `KB-02C1–C3`：分别实现 revision/version 写入、原子 publication、rollback/withdraw/retire 与机构审计。
3. `KB-03C`：实现并验收逐附件批准 provider，才可能解除 attachment sending 的固定 false。
4. 外部集成串行队列：OCR、embedding、rerank、知识 AI 分别交付获批 adapter 后，知识线才可消费；本迁移不得提前宣称解析、索引、检索或问答生产可用。
5. `KB-07`：只能在总协调台冻结 `RestrictedCustomerKnowledgeAccessV1`、三元 scope 的权威 reader 和敏感 AI 授权组合后，消费受限客户资料/附件；不得读知识表或另行创建客户隔离模型。
