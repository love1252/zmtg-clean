# 真实 HIS adapter 前置评估设计

> 日期：2026-06-03
> 状态：Plan Mode 前置评估文档。本 PR 只做文档规划，不写代码、不改测试、不新增 API、不改数据库 schema / migration、不接真实 HIS / 机构系统 / 企微 / AI，也不做自动摘要、自动任务或自动触达。

## 0. 本次结论

本 PR 是 **真实 HIS adapter 的前置评估**，不是 HIS adapter 实现。

当前只规划如果未来要接入真实 HIS / 机构系统，在进入任何实现前必须先评估哪些边界、输入、凭证、安全、租户绑定、幂等、审计和 raw payload 处理策略。

本 PR 明确不做：

- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不连接任何真实 HIS。
- 不连接任何机构系统。
- 不保存任何真实 HIS payload。
- 不导入真实客户数据。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不做自动触达。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现必须改代码、改 schema、加 API、接外部系统或处理真实数据，必须停止当前 docs-only 范围并单独进入对应 Plan Mode。

## 1. 与 Phase 22 mapper 的关系

Phase 22 已完成 domain-only mapper 最小闭环：

```text
标准治疗事件契约
-> recoveryStage / rawSourceType / mappingWarnings 缺口字段
-> mapper parser 安全边界
-> smoke / 文档收尾
```

真实 HIS adapter 和 Phase 22 mapper 的职责必须分开：

- HIS adapter 的职责是读取未来外部系统输入，并把它转换为 mapper 可接受的安全输入。
- mapper 的职责是输出标准治疗事件。
- adapter 不应该绕过 mapper 直接写治疗摘要、随访任务或运营分析。
- adapter 不应该把 raw HIS payload、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文传给业务下游。
- adapter 不应该自行认定患者身份匹配成功。
- adapter 不应该自动创建治疗摘要、自动创建随访任务或自动触达客户。

建议未来链路保持为：

```text
可信租户绑定 / 同步上下文
+ 外部系统瞬时输入
-> adapter 字段白名单读取
-> adapter 输出 mapper 安全输入
-> Phase 22 mapper 输出标准治疗事件
-> 后续人工复核 / 预览 / 摘要来源治理（另行 Plan Mode）
```

因此真实 HIS adapter 的前置评估重点不是“怎么把数据接进来”，而是先确认哪些数据绝不能进入、哪些上下文必须可信、哪些行为必须保留人工确认边界。

## 2. 需要先评估的边界

### 2.1 租户绑定

未来真实 HIS 连接配置必须绑定到单一机构租户，`tenantId` 只能来自服务端可信连接上下文或受控同步上下文。

必须先评估：

- 连接配置如何绑定 `tenantId`。
- 外部 payload 中的租户号、门店号、机构号是否只作为外部引用，不作为智美天工授权依据。
- 同一外部系统是否允许多个租户分别配置，若允许，如何避免跨租户连接串、事件或幂等键混淆。
- adapter 输出给 mapper 时，`tenantId` 是否永远由服务端注入。
- 审计事件是否记录安全的连接引用，而不是凭证明文或 raw payload。

当前不新增连接配置，也不修改租户隔离实现。

### 2.2 外部系统连接配置

未来连接配置至少需要单独评估：

- 连接名称和连接状态。
- 来源系统类别，例如 HIS、机构系统、导入或其他。
- 外部厂商 / 系统标识是否只作为安全短文本或枚举。
- 启用 / 禁用 / 暂停同步的状态机。
- 最小连接元数据如何展示给机构和平台人员。
- 配置变更是否写审计。
- 配置删除、停用和凭证撤销如何处理。

当前不新增连接配置 UI、API、schema 或 seed。

### 2.3 凭证安全

真实凭证必须先单独进入安全设计，不应混入 adapter 业务实现。

必须先评估：

- 凭证类型：API key、basic auth、OAuth token、签名密钥、专线配置或其他。
- 凭证加密、轮换、撤销、过期和最小权限。
- 凭证明文是否永不返回前端、永不写审计、永不进入日志、永不进入错误信息。
- 回调签名密钥与出站请求凭证是否分离。
- 凭证测试连接失败时如何返回稳定错误，不暴露连接串、token、secret 或 `DATABASE_URL`。
- 平台人员与机构人员对连接状态、失败原因和凭证元数据的可见边界。

当前不保存外部系统凭证，也不创建任何凭证字段。

### 2.4 输入方式

未来真实 HIS adapter 至少需要分别评估三种输入方式，不能在一个 PR 里混合实现：

| 输入方式 | 需要评估的重点 | 当前状态 |
| --- | --- | --- |
| Webhook | 验签、重放保护、幂等、请求体大小限制、错误响应、审计和 raw payload 不入库。 | 当前不新增 Webhook。 |
| 定时同步 | 分页游标、时间窗口、重试、断点续跑、限流、外部 API 错误降级和幂等。 | 当前不新增同步任务。 |
| 手动导入 | 文件类型、大小限制、解析边界、人工上传权限、导入预览、拒绝敏感原文和删除策略。 | 当前不新增导入能力。 |

三种输入方式的共同边界：

- 进入 mapper 前必须经过 adapter 字段白名单。
- 不接受前端或外部 payload 传入的 `tenantId` 作为可信值。
- 不保存完整请求体、响应体或原始文件内容。
- 不自动创建摘要、任务或触达。

### 2.5 幂等键

未来幂等键应基于安全稳定字段，不基于 raw payload hash 原文外泄。

候选口径：

```text
tenantId + connectionId + sourceSystem + sourceEventId
```

如果外部事件 ID 缺失，必须先评估降级策略：

- 是否拒绝进入自动处理。
- 是否进入人工复核队列。
- 是否使用有限字段组合生成临时幂等候选。
- 是否要求外部系统补充事件 ID。

幂等键不得包含手机号原文、身份证号、病历号原文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、token、secret、连接串或 raw payload。

当前不新增幂等表、幂等 API 或同步状态。

### 2.6 重试策略

未来重试策略必须和幂等、审计、错误降级一起设计。

需要评估：

- 哪些错误可重试，哪些错误必须 fail closed。
- Webhook 收到后是否异步处理。
- 定时同步失败是否按连接、租户和游标维度重试。
- 重试次数、退避间隔、死信 / 暂停连接条件。
- 重试是否会重复写标准事件、摘要或任务。
- 重试审计是否只记录安全原因 code。

当前不新增队列、任务调度、重试或死信能力。

### 2.7 错误降级

错误降级必须把外部系统异常、字段映射失败和安全拒绝分开。

建议未来分类：

- 连接错误：凭证失效、网络不可达、外部系统超时。
- 验签错误：签名缺失、签名错误、时间窗过期、重放。
- 输入错误：字段缺失、字段类型错误、时间不可解析。
- 安全拒绝：出现 raw payload、PII、完整正文、token、secret、SQL、stack 或连接串。
- 映射警告：类别未知、恢复阶段缺失、外部状态需要人工复核。

降级原则：

- 安全拒绝必须 fail closed。
- 映射 warning 只能是安全 code，不应包含外部字段原文。
- 连接错误不应泄露凭证明文、连接串或外部响应体。
- 需要人工判断的事件不得自动创建摘要、任务或触达。

### 2.8 审计事件

未来 adapter 审计必须只记录安全元数据，不记录 raw payload。

建议评估的审计事件：

- 连接配置创建、启用、禁用、凭证轮换和删除。
- Webhook 验签成功 / 失败。
- 同步任务开始、完成、失败、暂停和恢复。
- 外部事件被接受、拒绝、去重、进入人工复核。
- mapper 成功输出标准事件。
- mapper 因安全字段或必填字段失败。
- 后续人工复核确认、拒绝或忽略。

审计 payload 只能包含：

- `tenantId` 可信上下文。
- 安全 connection reference。
- 安全 source system code。
- 安全 source event id 或其脱敏 / hash 版本。
- 安全 reason code。
- 时间、操作者或系统 actor。

审计 payload 禁止包含完整请求体、响应体、原始病历正文、治疗正文、咨询全文、图片 / 文件原文、凭证明文、token、secret、SQL、stack、`DATABASE_URL` 或连接串。

### 2.9 raw payload 处理策略

默认不保存 raw HIS payload。

当前和未来默认禁止保存：

- 完整请求体。
- 完整响应体。
- 原始病历正文。
- 原始治疗正文。
- 诊疗原文。
- 咨询全文。
- 图片 / 文件原文。
- 外部系统字段全集。
- 外部系统错误响应全文。

adapter 可以在未来实现中短暂读取外部输入，但持久化、审计、日志、前端 DTO 和 mapper 输出都不应保存 raw payload。

如果未来确需保留排障片段，必须单独评估：

- 脱敏规则。
- 保留时间。
- 可见权限。
- 审计记录。
- 删除策略。
- 客户数据和医疗隐私风险。
- 是否需要租户级开关和平台审批。

当前不做排障片段保留能力。

### 2.10 字段白名单

adapter 输出给 mapper 前必须使用字段白名单。

建议输出仍优先对齐 Phase 22 已完成的核心命名：

- `sourceSystem`
- `sourceEventId`
- `sourceCustomerId`
- `customerMatchKey`
- `customerName`
- `maskedPhone`
- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `treatmentStatus`
- `rawSourceType`
- `appointmentRef`
- `doctorRef`
- `operatorRef`
- `departmentRef`
- `amount`
- `currency`
- `riskLevel`
- `summary`
- `nextCareAction`
- `tags`
- `mappingWarnings`
- `occurredAt`

`externalEventId`、`externalSource`、`customerExternalId` 和 `appointmentExternalId` 如未来存在，只能作为 adapter 输入层别名或文档映射，进入核心 mapper 前应转换为 `sourceEventId`、`sourceSystem`、`sourceCustomerId` 和 `appointmentRef`。

### 2.11 敏感字段拒绝

adapter、mapper、审计、日志和未来预览 DTO 必须继续禁止：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。
- AI prompt / completion。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。
- 外部系统凭证明文。

这些内容不得通过“排障”“预览”“审计”“mapping warning”“手动导入备注”或“错误详情”绕过边界。

### 2.12 患者身份匹配边界

adapter 不做患者身份自动匹配。

未来可评估的输入只应是安全辅助字段：

- `sourceCustomerId`。
- `customerMatchKey`。
- `customerName` 安全短文本。
- `maskedPhone` 脱敏展示值。

必须先单独评估：

- match key 生成规则。
- 置信度。
- 多候选冲突。
- 人工确认。
- 跨租户隔离。
- 审计。
- 拒绝手机号原文、身份证号和病历号原文的策略。

外部客户 ID 不能作为授权依据，也不能直接等同于内部客户 ID。

当前不做患者身份匹配。

### 2.13 人工复核边界

真实 HIS adapter 进入业务链路前，应优先规划人工复核 / 标准事件预览，而不是自动写业务表。

人工复核需要单独评估：

- 预览 DTO 字段白名单。
- mapping warning 展示方式。
- 复核通过、拒绝、忽略和重试。
- 复核操作审计。
- 复核后是否创建治疗摘要。
- 复核后是否允许生成随访建议。
- 复核人员权限和租户范围。

预览不应展示 raw payload、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文或凭证明文。

当前不新增人工复核 UI、API 或队列。

### 2.14 自动摘要 / 自动任务禁止边界

真实 HIS adapter 不得自动创建治疗摘要或随访任务。

未来如果要从标准事件创建治疗摘要，必须单独进入 Plan Mode，至少评估：

- 标准事件到摘要的字段白名单。
- 人工确认。
- 来源追溯。
- 幂等和重复治理。
- 摘要编辑 / 作废后的来源关系。
- 审计。

未来如果要从标准事件或摘要生成随访任务，必须继续保留人工确认边界，不能由 adapter 自动创建。

当前不自动创建治疗摘要，也不自动创建随访任务。

### 2.15 自动触达禁止边界

真实 HIS adapter 不得自动触达客户。

禁止范围包括：

- 企微消息。
- 个人微信消息。
- 短信。
- 电话外呼。
- 邮件。
- 小程序通知。
- 任何第三方触达通道。

未来如需触达，必须单独进入触达、凭证、模板、退订、频控、审计和人工确认 Plan Mode，不得混入 HIS adapter。

当前不接企微，不接 AI，不做自动触达。

## 3. 后续 PR 拆分建议

建议后续拆成独立 PR，避免一次性跨越安全边界：

### PR A：真实 HIS adapter spec / plan

范围：

- 承接本前置评估，形成真实 HIS adapter 的完整 spec / plan。
- 固化 adapter 和 mapper 的接口边界。
- 继续不接真实 HIS，不写代码或只写后续实现计划。

### PR B：连接配置与凭证边界 Plan Mode

范围：

- 规划连接配置 schema / API / UI 的候选方案。
- 规划凭证加密、轮换、撤销、权限和审计。
- 不保存凭证明文。
- 不接真实外部系统。

### PR C：Webhook / 同步任务 Plan Mode

范围：

- 分别规划 Webhook、定时同步和手动导入。
- 覆盖验签、重放保护、幂等、重试、错误降级和审计。
- 不处理真实 payload。

### PR D：患者身份匹配 Plan Mode

范围：

- 规划 `sourceCustomerId`、match key、候选匹配、置信度和人工确认。
- 保持跨租户隔离。
- 不保存手机号原文、身份证号或病历号原文。

### PR E：人工复核 / 标准事件预览 Plan Mode

范围：

- 规划标准事件候选预览。
- 规划人工确认、拒绝、忽略和审计。
- 不展示 raw payload 或完整正文。
- 不自动创建摘要或任务。

### PR F：adapter domain-only 输入 DTO / parser

范围：

- 在不接真实 HIS 的前提下，新增 domain-only adapter 输入 DTO / parser。
- 只接受安全字段白名单。
- 输出 mapper 可接受输入。
- 覆盖敏感字段拒绝、未知字段拒绝、`external*` 到 `source*` 文档映射。
- 不新增 API、schema、真实连接或任务调度。

### PR G：真实外部系统接入 PoC

范围：

- 只有在 PR A-F 和额外安全评审完成后，才允许另行批准。
- 必须明确具体 HIS / 机构系统、测试租户、测试数据、凭证管理和回滚策略。
- 必须明确不使用真实客户敏感数据，或在经过单独批准后按合规策略处理。
- 不得默认自动摘要、自动任务或自动触达。

## 4. 验收标准

当前 docs-only PR 的验收标准：

- 文档明确本 PR 是真实 HIS adapter 前置评估，不是实现。
- 文档明确不连接任何真实 HIS，不保存任何真实 HIS payload，不导入真实客户数据。
- 文档说明与 Phase 22 mapper 的关系和职责分界。
- 文档覆盖租户绑定、外部系统连接配置、凭证安全、Webhook / 定时同步 / 手动导入、幂等键、重试策略、错误降级、审计事件、raw payload、字段白名单、敏感字段拒绝、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止。
- 文档明确 raw payload 默认不保存。
- 文档明确如未来确需保留排障片段，必须单独评估脱敏、保留时间、权限、审计和删除策略。
- 文档列出后续 PR A-G 拆分建议。
- 只改 Markdown。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 5. 前置评估结论

真实 HIS adapter 可以作为 Phase 22 mapper 之后的后续方向，但不能直接进入实现。

当前结论：

- Phase 22 mapper 最小闭环已经足够作为后续 adapter 的标准化目标。
- adapter 的首要风险不是字段映射，而是租户绑定、凭证安全、raw payload、幂等、审计和人工复核边界。
- 当前不应接真实 HIS，不应保存 raw payload，不应导入真实客户数据。
- 后续必须先拆分连接配置、凭证、输入方式、患者身份匹配和人工复核，再考虑 domain-only parser 或真实 PoC。

越界风险当前可控，因为本 PR 只做文档规划；真正风险会出现在后续任何试图同时接真实 HIS、保存 payload、做身份匹配或自动创建业务对象的 PR。
