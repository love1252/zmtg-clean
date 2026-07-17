# 机构端会话工作台：MIG-04 会话数据模型技术设计与迁移申请

> **状态：** `CONV-02-DESIGN` docs-only 申请。本文是总协调台的审批输入，不是 schema、Drizzle、SQL、migration、API、渠道或 runtime 授权。

## 一、结论、顺序与硬边界

申请 `MIG-04` 的唯一范围是：会话根、分段、不可变消息、逐消息结果、分配、风险、`ConversationCareDispositionV1` revision/失效事实和 `IdentityMatchReviewV1` 复核事实。

```text
MIG-01 → MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06
```

只有 `MIG-01`、`MIG-02`、`MIG-03` 已依次合并，且总协调台已冻结公共 v1、服务端 reader、数据库 lease 与独立测试库后，才可为 `MIG-04` 另行申请 schema/migration 授权。在此之前只能排队：不得创建表、索引、SQL、Drizzle 元数据、repository、API、UI 或 adapter。

本申请不含渠道凭证、Webhook 配置/原始回调、provider 私有 payload、OCR/ASR、embedding/rerank、AI 输出、真实发送、自动触达、外部临床结论、客户主档案或渠道连接。渠道类型、接入服务商和连接实例必须保持为三个独立字段。

fixture、内存 Map、React `useState`、demo session、`mock_sent`、`proofEligibleMock`、`mock_dry_run_completed`、dry-run、volatile mock mapping runtime、模拟渠道回执和随访 `MessageDelivery` 都不是生产事实；不得回填，也不得进入会话队列、SLA、分配、风险、身份决定、消息结果或审计真相。

## 二、scope、幂等与逻辑关系

所有逻辑关系均必须有 `tenantId + institutionId`。该二元 scope 是外键/关联验证、唯一约束、幂等键、版本比较、审计检索和服务端 authorizer 的前缀。禁止裸 ID 关联。scope 不明、跨机构、版本冲突或重复键载荷不一致时 fail-closed，不得借由对象存在性、计数、错误详情或历史快照泄露数据。

| 关系 | 最小事实 | 关键不变量和建议约束 |
| --- | --- | --- |
| 会话根 | `conversationId`、scope、`channelType`、`serviceProviderType`、`connectionInstanceId`、安全 `channelConversationRef`、身份投影、`activeSegmentId`、最新客户入站指针、时间 | 根只保存跨分段稳定事实；连接绑定按 `(scope, channelType, serviceProviderType, connectionInstanceId, channelConversationRef)` 去重；非 `matched` 清空当前客户引用。 |
| 分段 | `segmentId`、scope、`conversationId`、`sequenceNo`、五态、开段客户消息、时间锚点、当前处理人、`everHumanHandled`、关闭/解决、blocker | `(scope, conversationId, sequenceNo)` 唯一；每根最多一个未关闭活动分段；`closed` 不可重开，新客户入站只能创建新 sequence。 |
| 不可变消息 | `messageId`、scope、根/分段、方向、sender kind、`occurredAt`、`receivedAt`、授权内容引用、固定低敏摘要、`sourceMessageRef`、幂等键 | 创建后不更新或删除；入站幂等绑定 scope、连接实例、方向和受信任键；同键不同载荷拒绝。 |
| 逐消息结果/回复关联 | `resultId`、scope、`messageId`、stage/status、`attemptNo`、`dedupeKey`、服务端生成的不可逆回执引用、failure、时间；outbound—inbound link | `(scope, messageId, stage, attemptNo, dedupeKey)` 去重；provider 接受绝不推导渠道送达；回复是新入站消息。 |
| 分配事件/投影 | `assignmentId`、scope、根/分段、revision、`assigned|accepted|rejected|released`、受控原因、低敏 actor/assignee、时间、幂等键 | `(scope, assignmentId, revision)` 唯一；追加事件产生 0 或 1 活动分配，活动投影对 `(scope, conversationId, segmentId)` 局部唯一。 |
| 风险事件 | `riskId`、scope、根/分段/来源消息、风险域、受控 code、状态事件序号、低敏关闭引用、时间 | `(scope, riskId, eventSequence)` 唯一且只能 `unconfirmed → confirmed → resolved`；禁止回退、跳级、覆盖历史；分段关闭不解除风险。 |
| Care 处置 revision | `dispositionId`、scope、根/分段/来源消息、revision、分类/解决/关闭/风险/blocker 快照、时间、`invalidatedAt`、audit 引用 | `(scope, dispositionId, revision)` 唯一；每段最多一个当前未失效 revision。 |
| 身份复核 revision | `reviewId`、scope、根/分段/连接、不可逆身份引用、revision、候选版本/digest、状态、决定、低敏 actor/reason/audit、客户引用、时间 | `(scope, reviewId, revision)` 唯一；同连接和不可逆身份引用最多一个活动 review。 |

消息结果必须保持发送/接收、provider 接受、渠道送达、客户回复和业务完成五类事实分离。消息级一旦存在权威 `channel_delivered`，迟到 `unknown`、失败或新 attempt 不得降级它或伪造重试。出站幂等另绑定已授权命令和目标分段，不得复用浏览器草稿 ID。

本文出现的“安全”“低敏”内容/回执/关闭/audit 引用均指服务端生成或验证的不可逆对象引用，只可用于同 scope 授权解析；它们不是 provider payload、凭证、原始外部账号、手机号、展示名称、完整正文或其可逆编码。任何无法满足该定义的引用不得写入 `MIG-04` 或低敏 audit。

## 三、`ConversationCareDispositionV1` revision 与失效

会话内部保留追加式分类、解决、风险、关闭和失效事实；跨线唯一有效读模型是当前 revision 的 `ConversationCareDispositionV1` 快照。冻结字段为：

```text
contractVersion: 'v1'
dispositionId, revision
scope: { tenantId, institutionId }
conversationId, segmentId, sourceMessageId
confirmedCustomer | null
identityState: matched | pending_review | unmatched | conflict
classification: simple_confirmation | substantive_consultation | ambiguous | risk | null
resolutionState: open | resolved | invalidated
segmentCloseKind: open | normal | forced
riskState: none | unconfirmed | confirmed | resolved
riskDomain: clinical | non_clinical | null
riskClosureReference | null
blockingReasonCodes
sourceMessageOccurredAt, classifiedAt, lastCustomerMessageAt
resolvedAt | null, segmentClosedAt | null, snapshotCreatedAt, invalidatedAt | null
auditReference
```

`blockingReasonCodes` 仅允许 `clinical_risk`、`complaint`、`refund_dispute`、`opt_out`、`privacy_request`、`unresolved_consultation`、`identity_unconfirmed`、`forced_close_unresolved`。分类仅允许 `simple_confirmation`、`substantive_consultation`、`ambiguous`、`risk`；投诉等 blocker 不得扩张分类。

新客户消息、旧 revision invalidation 和新 revision 创建必须同一事务：旧 revision 固定 `resolutionState=invalidated` 且填 `invalidatedAt`，不能再驱动 Care。新 revision 未完成分类时，provider 固定顶层 `readiness=partial, data=null`，不能沿用旧分类或解决状态。强制结束固定 `segmentCloseKind=forced`、`resolutionState=open`、`resolvedAt=null`，追加 `forced_close_unresolved`，不解除风险。临床关闭引用只存低敏受控引用，后续 reader 必须验证同 scope、有效、未撤销。

## 四、`IdentityMatchReviewV1` 复核事实

复核保存 `reviewId`、`revision`、scope、根/分段、`connectionInstanceId`、`irreversibleIdentityReference`、`candidateSnapshotVersion`、`candidateSetDigest`、state、`lastDecision`、低敏 reason/actor/audit、`resolvedCustomer` 及提交、分配、决定、过期时间。

状态精确为 `pending_review`、`awaiting_customer_creation`、`matched`、`rejected`、`conflict`、`withdrawn`、`expired`、`revoked`。转换仅为：

```text
pending_review → matched | awaiting_customer_creation | rejected | conflict | withdrawn | expired
awaiting_customer_creation → matched | pending_review | conflict | withdrawn | expired
conflict → pending_review（仅有新候选）
matched → revoked
```

`lastDecision` 仅允许 `confirm_existing`、`delegate_create_customer`、`reject`、`withdraw`、`revoke` 或 `null`；冲突和过期只是状态事实，不新增 decision 值。新枚举值必须进入 V2。

提交/决定命令必须以 `(scope, reviewId, expectedRevision, candidateSnapshotVersion, idempotencyKey)` 去重；同键只允许相同载荷重试。不同载荷、候选版本变化、过期、终态或跨 scope 一律拒绝。`candidateReference`、原始外部身份和候选详情只允许服务端 reader 同 scope 解析，不进入跨线响应、URL 或 audit。`revoked` 后重新匹配必须新建 review。

咨询师/客服只能提交本人已分配活动分段的复核；管理员/运营才可决定。建客必须委派客户中心冻结的 `CreateCustomerFromIdentityReviewV1`；只有成功返回同 scope `CustomerReferenceV1` 后，身份服务才可在本地事务中匹配，失败不得留下部分匹配。

## 五、内容保留、审计和删除语义

消息正文只在受权限、保留期和访问日志控制的授权内容视图中保存；主关系只存安全内容引用、固定低敏摘要和时间。附件只存安全引用、权限状态和清理关联，不复制文件内容。

保留期、合法留置、清理审批和最终清理时点由隐私/审计权威策略决定，本申请不猜测天数。到期清理应撤销正文/附件内容引用或执行已批准的不可逆清理，同时保留最小低敏事实骨架（对象 ID、scope、受控状态、时间、audit 引用）；不得从 audit 恢复正文。

会话、分配、风险、复核、强制结束、失效、发送尝试和内容清理写入机构级低敏 audit：受控 action/reason、不可逆对象引用、scope、actor reference、时间和结果。audit 禁止正文、自由摘要、候选原文、敏感客户资料、原始外部账号、provider/channel payload、凭证、令牌、内部错误堆栈和临床结论。默认不级联物理删除会话事实。

## 六、`expand → backfill → enforce` 与回滚

| 阶段 | 获批后的动作 | 必经门禁 | 回滚边界 |
| --- | --- | --- | --- |
| Expand | 新增隔离关系、受控枚举、可空过渡关联、索引和 audit 引用；不接渠道、不启生产读写 | `MIG-01→03` 已合并，lease、独立数据库和数据破坏评审通过 | 删除未写入生产事实的新增对象，或关闭 capability；不影响既有业务表。 |
| Backfill | 只处理总协调台验证的权威、同 scope、可追溯事实；逐批校验 digest、计数、重复和 audit | 权威来源、归属完整率、冲突隔离和窗口明确；fixture/mock/dry-run/useState/`mock_sent` 全部排除 | 保留批次清单和前像/audit；只回滚该批可信写入，不伪造历史状态。 |
| Enforce | 回填为零或异常已隔离后，启用非空、外键、唯一/局部唯一、revision 和幂等约束 | 双读、一致性、写冲突、重复回调、权限/audit 和回滚演练通过 | 先关闭写 capability、恢复兼容读；破坏性约束仅允许获批 forward-fix 或受控恢复。 |

scope 不明、归属冲突、重复载荷不一致、audit 不可写、内容策略未知、关闭引用失效或 migration lease 缺失时，停止并保持 capability 关闭。backfill 绝不触发发送、分配、风险解除、Care 完成或客户匹配。

## 七、跨线影响、审批与非范围

| 边界 | MIG-04 后可申请的影响 | 本申请不授权 |
| --- | --- | --- |
| `ConversationCareDispositionV1` | 会话 provider 读取当前 revision；未分类新消息输出 `partial + data:null` | Care 自动完成、恢复或写入。 |
| `IdentityMatchReviewV1` | 管理中心读取低敏复核状态；客户中心消费冻结建客命令 | UI、客户创建、action token、候选解析或跨库事务。 |
| `ConversationActionSourceV1` | 工作台经服务端 reader 消费真实持久化行动项 | 页面、计数、路由、provider 或 API。 |
| 权限/audit | 接入 `BASE-02`、`BASE-04` 的正式 scope、角色、本人分配和低敏 audit | demo session、浏览器 scope、自由文本 audit 或旁路。 |
| `INT-CHAN-*` | 未来只消费已交付的真实入站/人工出站事实 | adapter、凭证、Webhook、真实发送、AIBOTK runtime 或自动营销。 |

总协调台审批前必须确认物理 schema/命名、外键目标、受控 enum 落库方式、索引、内容保留策略、audit 事件字典、数据库 lease、历史权威来源、backfill 批次和 rollback 责任人。任一未确认项使对应 production capability 保持 `hidden` 或 `disabled`。

本轮不改 `src/**`、`drizzle/**`、schema、SQL、migration、数据库、API、测试、配置、脚本、渠道、Webhook、凭证、外部网络、真实发送、AI/AIBOTK runtime 或自动触达。本文不能作为任何上述动作的授权。
