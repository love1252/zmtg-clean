# 机构知识库 MIG-03 技术设计与数据变更申请

> **任务：** `MIG-03-DESIGN`（docs-only）<br>
> **日期：** 2026-07-18<br>
> **设计基线：** `origin/main@4fa0706d74a400055a5259ac3a13eba91d41bd1a`<br>
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
6. 为后续 citation、回答快照、低敏审计、受限客户附件预留受控关联位；本轮不实现这些读取或写入流程。

### 2.2 明确不做

- 不修改 `src/**`、`drizzle/**`、schema、migration、API、路由、页面、测试、脚本、worker、scheduler 或配置。
- 不连接数据库，不执行 DDL/DML，不回填，不读取 `.env*`、凭证或对象存储。
- 不接 OCR、embedding、rerank、知识 AI、渠道、HIS 或其他外部 provider。
- 不声明或实现公共 `PublishedKnowledgeReferenceV1`、`ApprovedKnowledgeAssetReferenceV1`、`RestrictedCustomerKnowledgeAccessV1`；公共声明仍由总协调台所有。
- 不把 library 设为 canonical 身份。资料库只是页面/分组视图，`knowledgeId` 才是内容身份。

## 三、共同不变量

| 主题 | 强制规则 |
| --- | --- |
| 机构隔离 | 所有机构自有事实都带非空 `tenantId + institutionId`，复合外键和唯一索引必须保持该 scope；客户端 scope 只能是待校验引用。 |
| 所有权 | `ownershipSource` 精确为 `institution | platform`。机构侧写命令遇到 `platform` 一律 `platform_read_only`；平台可见关系不赋予机构修改权。 |
| 不可变性 | body/file revision、version manifest、publication 历史和批准决定均只 append；不得 update 覆盖内容、hash、actor、时间或撤回原因。 |
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
| publication history | `publicationId`、item/scope、`versionId`/version number/manifest hash、lifecycle、complete/safety/use-scope 快照、published actor/time、withdraw actor/time/reason | `(knowledgeId, publicationId)` 与 `(knowledgeId, versionId)` 唯一；`withdrawn` 必有受控 reason、actor、时间，非 withdrawn 三者必须为 `NULL`。 |
| current pointer | item 上的 nullable `currentPublicationId`，并有 publication lifecycle `current` | 对未 retired item，pointer 与唯一 `current` publication 必须双向一致；retired item 必须没有 current。用 partial unique index 或等价约束确保每 item 至多一个 `current`。 |
| publication asset approval | `publicationId`、`versionId`、`fileRevisionId`、approval status、safety result、渠道兼容、decided actor/time、withdraw actor/time | 复合外键必须证明 attachment 属于该 publication 的 version manifest；`approved` 不是发送能力，缺 current binding、撤回、阻断、未知 safety 或渠道不兼容均不可发送。 |
| parse/chunk/index revision | revision identity、file/body revision identity、parser/index version、content hash、受控状态/失败码、创建时间 | parse/chunk/index 产物与输入 revision 绑定，重跑 append 新 revision，不 delete-and-replace；原文与 preview 默认不进入低敏 read model。 |
| knowledge job / attempt | job identity、scope、目标 revision、job kind/status、idempotency key/fingerprint、attempt、lease token/until、受控失败码、创建/更新时间 | 活跃 job 的 `(scope, target revision, kind, fingerprint)` 去重；lease 只允许未领取或已过期 job 被领取，attempt 单调增加。 |

### 4.1 Publication 与 current pointer 的原子边界

发布、撤回、退役和未来 rollback 必须在同一数据库事务中锁定同一 item 行，校验 `expectedRevision`，再 append publication 历史并更新 current pointer/revision。建议采用 item 行锁加唯一 current 约束的双层保护：

1. 锁定 `(tenantId, institutionId, knowledgeId)`，验证 ownership、item lifecycle 与 `expectedRevision`。
2. 验证候选 version/manifest、parse/index/safety/use-scope 门禁；任一失败只记录受控结果，旧 current 不变。
3. 通过后才将旧 current 标为 `superseded`、插入新 `current` publication、更新 item pointer/revision/last decision actor/time。
4. 唯一约束冲突、revision 冲突或事务异常都回滚整笔变更，不能先下架旧版。

rollback 必须额外获得当前权威 safety-rule 的新鲜绑定证据；在该 server reader 与证据来源落地前，rollback command capability-off，固定返回 `rollback_current_safety_unavailable`，不得信任历史 safety snapshot。

### 4.2 幂等、并发与时间

- 写命令以 `(tenantId, institutionId, knowledgeId, actionKind, idempotencyKey)` 唯一；同 key 的 canonical payload fingerprint 不同固定冲突，不复制自由文本或 metadata 到幂等记录。
- `expectedRevision` 不相等固定冲突；接近 `MAX_SAFE_INTEGER` 前 fail-closed，不允许溢出。
- version number 必须从 1 连续，publication history 的 version number 也必须连续；published/withdrawn/last-decided 时间不得倒退。
- 所有 actor 都是受控 reference；`withdrawReasonCode` 只能取受控枚举，不能存自由文本。
- current pointer、publication history 和 asset approval 的外键均在相同 scope 下验证，杜绝跨 tenant、跨 institution、跨 item 拼接。

### 4.3 独立 DB 与 lease 边界

`MIG-03` 只持久化 job/attempt/lease 事实，不启动 worker。未来 worker 必须使用独立于 HTTP request 的数据库事务和连接生命周期：以短事务 claim、`leaseToken + leaseUntil` 和条件更新领取工作；长时间 parse/OCR/index 不得持有 item publication 锁。完成、失败、续租和取消都必须带 lease token/attempt 条件，失效 lease 不得覆盖后继 attempt。测试使用独立临时数据库，不能连接开发或生产数据库。

## 五、旧数据预检、回填与隔离

### 5.1 预检清单

在任何 DDL 前，由总协调台在离线、受控环境生成仅含计数和受控 failure code 的预检报告：

| 检查 | 通过条件 | 失败处置 |
| --- | --- | --- |
| scope 完整性 | 候选 item 都能确认唯一 tenant 与 institution | 不进入回填；记录 `scope_unverified`。 |
| identity/文件完整性 | 引用、hash、MIME、大小和归属可核验 | 不创建 attachment revision；隔离等待人工处理。 |
| 正文与 preview 分类 | 原文、parse text、chunk preview 已完成内容分级、保留期和安全处置批准 | 未批准不回填，不进入普通审计或 read model。 |
| publication 可解释性 | 版本、actor、时间、安全、用途、current 关系可完全重建 | 仅建立隔离迁移候选，不赋 current。 |
| 平台可见关系 | 平台 owner 与机构 visibility 能被单独证明 | 只作为平台迁移输入，绝不转为机构可写 item。 |

预检输出不得含正文、客户姓名、消息、storage key、凭证、provider payload 或向量值。

### 5.2 Expand → Backfill → Enforce

1. **Expand**：仅新增 tables/columns/indexes/外键和受控枚举；不删除旧表，不改旧请求内 job 行为，不切换任何 read path。
2. **Backfill**：只处理经预检批准、来源可解释的候选。每批有迁移批次 identity、scope、计数、低敏失败码与可重跑幂等键；先写 revision/version/history，再在完整性校验成功后写 current pointer。
3. **Verify**：对每个 scope 验证 version 连续性、manifest binding、publication/current 一致性、actor/reason 完整性、附件 manifest/approval 绑定和无跨 scope 引用。
4. **Enforce**：在全部已批准回填完成且旧写路径停用后，启用非空、复合外键、unique、check、partial unique current 和 append-only 权限/trigger（如总协调台选择）。reader 仍由 capability gate 控制，不以 migration 成功替代发布验收。

### 5.3 明确禁止自动回填的旧数据

下列记录不属于正式 `MIG-03` backfill 输入：

- `knowledge_sources`、`knowledge_documents`、`knowledge_chunks`、`knowledge_index_jobs` 中 `mock | seed | demo` 来源；
- `mock_demo_embedding`、固定 8 维 SHA-256 embedding、内存余弦、deterministic rerank 的产物；
- 旧同步 request job 及其可覆盖 parse/embedding 结果；
- 未经内容分类/保留期审批的 parse 原文、chunk preview、旧 QA question、answer preview；
- 将 `platform_knowledge_institution_visibility` 直接伪装成机构 item/version/current 的记录。

这些数据可以保留在旧隔离命名空间，供预检、人工审查或清理决策使用；不得进入正式列表、publication、检索、问答、任务指标或额度。

## 六、平台与跨线边界

- 平台内容的版本与 current pointer 由平台知识管理所有者写入；机构迁移只保存经过授权的可见/引用关系，不复制平台内容为机构可写副本。
- 平台强制安全规则优先于任何 institution publication snapshot；规则版本、provider 与冲突治理由平台/总协调台另行冻结。
- 会话、AI 和其他消费者不得读本迁移的 repository/table。它们只能消费总协调台声明、知识模块 provider 提供的当前 publication/approved asset 引用。
- `ApprovedKnowledgeAssetReferenceV1` 依赖 `KB-03C` 的批准 provider；迁移存在 approval 表不等于可发送，能力在该 provider 验收前固定关闭。
- 受限客户附件与单客户 AI 的隔离实体虽可保留 `MIG-03` 申请位，但其 `customerId`、角色、分配范围和敏感 AI 授权由 `KB-07` 与公共组合 reader 另行审批。

## 七、回滚、故障与运维边界

`MIG-03` 采用可逆的 expand-first 策略。回滚顺序为：

1. 先关闭新 repository/current reader、发布和 job capability，阻断新写入与新读取。
2. 保留 append-only 新表和迁移批次证据，不删除历史、不重置 version number、不把 current 回退为旧可变行。
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

## 九、迁移验收与后续解锁条件

### 9.1 MIG-03 自身验收

- 独立测试数据库可重复执行 expand、受控 backfill、verify；重复执行不产生重复 version/publication/job。
- 同一 item 并发 publication 至多一个 current；门禁失败或冲突后旧 current 仍可读。
- 跨 tenant/institution/item 的 body、file、version、publication、approval、job 引用被数据库约束拒绝。
- version/publication 连续性、revision、时间、actor、withdraw reason、manifest hash 与附件 ordinal 的破坏样例全部拒绝。
- `approved` 未绑定同一 current publication/file revision、已撤回/阻断或安全未知时，不产生可发送引用。
- mock/seed/demo、旧同步 job、旧原文/preview 未进入正式回填批次。
- 迁移日志、失败记录和验收输出均为低敏。

### 9.2 后续栏目解锁

`MIG-03` 通过不自动开启知识能力。仅当以下条件分别获批后，才可启动对应 runtime：

1. `KB-02B`：基于新表实现 scope-bound 只读 repository 和 current reader；`ready | empty | partial | stale | unavailable | denied | disabled` 语义完整，未就绪保持 `disabled`。
2. `KB-02C1–C3`：分别实现 revision/version 写入、原子 publication、rollback/withdraw/retire 与机构审计。
3. `KB-03C`：实现并验收逐附件批准 provider，才可能解除 attachment sending 的固定 false。
4. 外部集成串行队列：OCR、embedding、rerank、知识 AI 分别交付获批 adapter 后，知识线才可消费；本迁移不得提前宣称解析、索引、检索或问答生产可用。
