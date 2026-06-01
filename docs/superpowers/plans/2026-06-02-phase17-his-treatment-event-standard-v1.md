# Phase 17 HIS 接入标准模型 / 治疗事件标准化 v1 Implementation Plan

> 状态：Phase 17 PR 1 文档阶段。本计划用于后续执行 Agent 按 PR 分步推进。当前 PR 只新增 spec / plan 文档，不改业务代码、页面、测试、API、数据库、权限、认证或租户隔离。

**目标：** 固化 HIS 接入标准模型 / 治疗事件标准化 v1 的范围、字段、边界、风险和后续 PR 拆分，为后续不同 HIS adapter、治疗项目路径引擎、客户身份匹配、随访路径运营分析、业务事件埋点和经营智能中心提供统一标准。

**架构方案：** Phase 17 v1 先以文档定义智美天工内部标准治疗事件模型。后续如需要，可选 PR 2 只做 domain-only TypeScript 类型和测试；默认不新增 HTTP API、不新增数据库 schema / migration、不接真实 HIS、不保存 raw payload、不进入 Webhook / OAuth / 企微 / AI / RAG / Agent / 自动触达。

**技术栈：** 当前 PR 只涉及 Markdown。后续可选 domain-only PR 如执行，才涉及 TypeScript、Vitest 和现有领域模块。

## 1. 当前上下文

当前已完成：

- Phase 12：治疗记录结构化摘要 v1。
- Phase 13：治疗摘要人工录入 v1。
- Phase 14：治疗摘要管理能力 v1。
- Phase 15：治疗后护理 / 随访联动 v1。
- Phase 16：随访任务来源治理 v1。

现有关键能力：

- `treatment_summaries` 是机构端可查看、可录入、可管理的结构化治疗摘要。
- 治疗摘要可生成确定性随访建议。
- 机构人员人工确认后可创建内部随访任务。
- `follow_up_tasks` 已具备治疗摘要来源字段。
- 智能随访可展示治疗摘要来源和来源筛选。

当前缺口：

- 没有内部标准治疗事件模型。
- 没有 HIS 字段映射原则。
- 没有标准项目分类与后续路径模板的正式衔接文档。
- 没有标准治疗事件与身份匹配、业务事件、经营智能之间的边界说明。

## 2. Phase 17 总边界

Phase 17 可以做：

- 标准治疗事件字段定义。
- HIS 字段映射原则。
- 数据白名单。
- 禁止字段。
- 标准化状态枚举。
- 与现有 `treatment_summaries` 的关系。
- 与预约、客户、随访任务、客户时间线的关系。
- 与后续路径引擎、身份匹配、业务事件、经营智能的衔接。
- 后续 PR 拆分建议。
- 可选 domain-only TypeScript 类型与测试。

Phase 17 不做：

- 真实 HIS 接入。
- HIS adapter 实现。
- Webhook。
- 文件导入。
- 外部系统同步。
- 外部系统账号配置。
- raw payload 存储。
- 数据库 schema / migration。
- API route。
- UI。
- 微信 / 企微触达。
- 个人微信自动发送。
- AI provider。
- RAG。
- Agent。
- API Key。
- OAuth。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 自动触达客户。
- 随访路径运营分析实现。
- 业务事件埋点实现。
- 经营智能中心实现。
- 大规模 UI 重构。

## 3. 文件职责规划

### PR 1 新增文档

新增：

- `docs/superpowers/specs/2026-06-02-phase17-his-treatment-event-standard-v1-design.md`
- `docs/superpowers/plans/2026-06-02-phase17-his-treatment-event-standard-v1.md`

不修改：

- `README.md`
- roadmap
- devlog
- TypeScript 代码
- React 页面
- 测试
- API route
- 数据库 schema
- migration
- 权限、认证、租户隔离

### PR 2 可选文件

如果执行 domain-only PR，可考虑新增：

- `src/modules/institution/domain/standard-treatment-events.ts`
- `src/modules/institution/tests/StandardTreatmentEventsDomain.test.ts`

或选择更贴近后续 HIS adapter 的模块名：

- `src/modules/institution/domain/treatment-events.ts`
- `src/modules/institution/tests/TreatmentEventsDomain.test.ts`

PR 2 不应新增：

- API route。
- server adapter。
- repository。
- schema。
- migration。
- UI。
- 外部系统配置。

### PR 3 文档收尾文件

如果 Phase 17 完成，PR 3 可更新：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-02.md`
- Phase 17 spec / plan 完成状态。

PR 3 只做收尾文档，不进入真实 HIS 或业务代码。

## 4. 标准治疗事件模型约定

PR 1 文档中定义的标准治疗事件模型是建议模型，不是数据库 schema。

字段建议：

- `eventId`
- `tenantId`
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
- `treatmentStatus`
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
- `occurredAt`
- `receivedAt`

核心解释：

- `sourceSystem` 用于区分 HIS / 手工录入 / 导入 / 其他系统。
- `sourceEventId` 只做外部事件追踪，不应暴露给普通机构端用户。
- `customerMatchKey` 只用于身份匹配，不应保存原始敏感信息。
- `amount` / `currency` 只定义语义，不进入支付、合同、发票或收入归因实现。
- `summary` / `nextCareAction` 只能是结构化短摘要字段，不允许完整治疗正文、完整病历正文或咨询全文。

## 5. HIS 映射原则

后续 HIS 接入必须遵守：

```text
外部 HIS 字段
↓
适配层映射
↓
智美天工标准治疗事件模型
↓
治疗摘要 / 路径引擎 / 随访任务 / 经营分析
```

原则：

- 不同 HIS 需要不同 adapter。
- adapter 后续单独 Plan。
- adapter 可以读取外部 payload，但 raw payload 不直接入库。
- adapter 输出必须是标准治疗事件白名单。
- 不同 HIS 的项目名称需要映射到标准项目类型。
- 同一项目可能有不同机构命名，后续应支持租户级别名或配置。
- 标准项目分类应支持后续路径模板匹配。
- 外部系统 ID 不能作为租户授权依据。

## 6. 与现有模型的关系

### 6.1 与 `treatment_summaries`

- `treatment_summaries` 是机构端可查看和运营使用的结构化摘要。
- 标准治疗事件是未来 HIS 接入后的原始业务事件标准化结果。
- 标准治疗事件未来可以作为生成治疗摘要的来源。
- 当前阶段不自动从标准治疗事件生成治疗摘要。
- 当前阶段不修改现有治疗摘要逻辑。

### 6.2 与客户

- 标准治疗事件必须绑定租户。
- 未来如果匹配到内部客户，可关联内部 customer。
- 未匹配事件必须进入后续待匹配或人工确认设计。
- 当前阶段不实现身份匹配。

### 6.3 与预约

- `appointmentRef` 只表达引用关系。
- 当前阶段不修改预约 API、预约 schema 或预约状态。
- 当前阶段不把 HIS 治疗事件自动关联到预约。

### 6.4 与随访任务

- 未来路径引擎可以基于标准治疗事件生成随访建议。
- 当前阶段不创建随访任务。
- 当前阶段不修改 Phase 15 / Phase 16 的随访来源治理。

### 6.5 与客户时间线

- 未来客户时间线可展示标准治疗事件或其生成的治疗摘要。
- v1 建议优先展示机构端可理解的 `treatment_summaries`。
- 当前阶段不改 timeline API。

## 7. PR 1：Phase 17 spec / plan 文档

**范围：**

- 新增 Phase 17 design spec。
- 新增 Phase 17 implementation plan。
- 说明为什么优先做 HIS 标准治疗事件。
- 说明为什么治疗摘要编辑、作废、路径分析、业务事件、经营智能后置。
- 定义标准治疗事件字段。
- 定义 HIS 映射原则。
- 定义字段白名单和禁止字段。
- 定义租户隔离与隐私边界。
- 定义与现有治疗摘要、客户、预约、随访任务、客户时间线的关系。
- 定义与后续路径引擎、身份匹配、业务事件、经营智能的关系。
- 给出 PR 2 / PR 3 拆分建议。

**不做：**

- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接 Webhook。
- 不保存 raw payload。
- 不进入 AI / RAG / Agent / 企微 / 自动触达。

**步骤：**

- [ ] 创建分支 `docs/phase17-his-treatment-event-standard-plan`。
- [ ] 新增设计文档。
- [ ] 新增实施计划文档。
- [ ] 人工检查文档是否覆盖字段、边界、风险、PR 拆分。
- [ ] 运行 `git diff --check`。
- [ ] 提交并推送。
- [ ] 创建 Draft PR。

**风险：**

- 文档范围过大，误导后续直接进入真实 HIS 接入。
- 字段定义过像数据库 schema，导致后续过早建表。
- 未明确 raw payload 禁止，导致 adapter 阶段保存外部原文。
- 未明确 `sourceEventId` 和 `customerMatchKey` 的隐私边界。

**验证：**

```bash
git diff --check
```

本 PR 只改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、API route、数据库 schema / migration、权限、认证或租户隔离。

## 8. PR 2：可选 domain-only 标准治疗事件类型与测试

PR 2 是否执行需要在 PR 1 合并后再次确认。

**执行 PR 2 的理由：**

- 需要用 TypeScript 锁定标准字段和枚举。
- 需要为后续 HIS adapter 提供编译期契约。
- 需要用测试扫描禁止字段，防止 raw payload、PII 或完整正文进入模型。

**不执行 PR 2 的理由：**

- Phase 17 的目标可能只需要产品和架构对齐。
- 尚未确定真实 HIS adapter 输入差异，过早写类型可能需要反复修改。
- 不落库、不接 API 时，文档标准已经足够支撑下一阶段 Plan Mode。

**范围：**

- 新增标准治疗事件 TypeScript 类型。
- 新增 `sourceSystem`、`treatmentStatus` 等枚举或 union。
- 新增字段白名单常量。
- 新增禁止字段检测测试。
- 定义 mapper 输入输出契约，但不实现具体 HIS adapter。

**不做：**

- 不新增 API。
- 不新增 schema / migration。
- 不新增 repository。
- 不新增 UI。
- 不接真实 HIS。
- 不保存 raw payload。
- 不新增 Webhook、OAuth、API Key 或外部系统配置。

**风险：**

- 类型变成事实 schema，后续被直接落库。
- mapper 契约接受 raw payload 并把它传进内部模型。
- 字段过宽，包含 PII 或完整正文。
- `customerName`、`maskedPhone`、`customerMatchKey` 边界不清。

**建议测试：**

- 字段白名单稳定。
- 禁止字段不在类型或 mapper 输出中出现。
- `sourceEventId` 不进入普通机构端 DTO。
- `customerMatchKey` 不允许原始手机号、身份证号、病历号。
- `summary` / `nextCareAction` 不允许完整治疗正文、病历正文、咨询全文。
- 不包含 `rawPayload`、`requestBody`、`token`、`secret`、`sql`、`stack`。

**验证：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/StandardTreatmentEventsDomain.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

## 9. PR 3：Phase 17 文档收尾

PR 3 在 PR 1 合并后执行。如果 PR 2 被跳过，PR 3 可以直接标记 Phase 17 为 docs-only 完成。

**范围：**

- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 17 spec / plan 完成状态。
- 明确 Phase 17 已完成标准治疗事件模型文档。
- 明确未进入真实 HIS、Webhook、同步、AI、RAG、企微、自动触达。
- 给出 Phase 18 建议。

**Phase 18 建议候选：**

1. 治疗摘要编辑能力 v1。
2. 治疗摘要作废能力 v1。
3. 标准治疗事件 domain-only 类型与测试。
4. 业务事件埋点体系 v1 设计。
5. 随访路径运营分析 v1 设计。

**风险：**

- README / roadmap 宣称完成真实 HIS 接入。
- 收尾文档遗漏 raw payload、完整病历正文、外部系统同步等未做边界。
- devlog 没有说明 PR 2 是否执行。

**验证：**

如果 PR 3 只改 Markdown：

```bash
git diff --check
```

如果 PR 2 执行过且 PR 3 同时更新代码状态，应运行：

```bash
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
git diff --check
```

## 10. 禁止字段清单

Phase 17 全阶段禁止新增、保存或返回：

- HIS raw payload。
- HIS 原始响应体。
- request body 原文。
- 完整病历正文。
- 完整治疗记录正文。
- 诊疗原文。
- 咨询对话全文。
- 身份证号。
- 手机号原文。
- 病历号原文。
- 图片 / 文件原文。
- 术前术后照片原文。
- AI 生成内容。
- AI prompt。
- AI completion。
- embedding。
- 外部系统 token。
- 外部系统 secret。
- API Key。
- OAuth token。
- Webhook secret。
- 数据库连接串。
- SQL。
- stack。

PR 2 如执行，必须把这些词纳入测试扫描。

## 11. 租户隔离要求

后续任何标准治疗事件实现都必须满足：

- `tenantId` 只来自服务端可信上下文。
- 外部系统连接必须绑定租户。
- adapter 输出必须带可信 `tenantId`。
- 前端不能传入或切换 `tenantId`。
- `sourceCustomerId` 和 `sourceEventId` 不能作为授权依据。
- 同一 HIS customer id 在不同租户中必须隔离。
- 平台端不得下钻机构治疗敏感详情。
- 错误文案不得泄露其他租户是否存在某个事件或客户。

PR 1 只在文档中定义这些要求，不实现。

## 12. PII / 医疗隐私要求

后续任何实现都必须遵守：

- 字段白名单。
- 数据最小化。
- 客户授权。
- 租户隔离。
- 审计日志。
- 敏感字段脱敏、哈希或不采集。
- raw payload 不直接入库。
- 外部系统接入单独 Plan Mode。

允许优先保留：

- 脱敏手机号 `maskedPhone`。
- hash / match key。
- 标准项目分类。
- 结构化短摘要。
- 下一步护理动作。
- 安全标签。

禁止保留：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。
- HIS raw payload。

## 13. Phase 17 完成判断

Phase 17 可以有两种完成方式。

### 方式 A：docs-only 完成

适用条件：

- PR 1 明确并完整固化标准模型和边界。
- 暂不需要 TypeScript 类型约束。
- 下一阶段优先做治疗摘要编辑或作废。

完成标准：

- PR 1 合并。
- PR 3 更新 README / roadmap / devlog 并标记 Phase 17 文档完成。
- 未执行 PR 2。

### 方式 B：docs + domain-only 完成

适用条件：

- 后续要进入 HIS adapter 之前，需要编译期契约。
- 团队希望用测试锁定字段白名单和禁止字段。

完成标准：

- PR 1 合并。
- PR 2 domain-only 类型与测试合并。
- PR 3 收尾文档合并。

两种方式都不代表真实 HIS 接入完成。

## 14. PR 描述要求

Phase 17 每个 PR 描述必须明确：

- 本 PR 属于 Phase 17 的哪一段。
- 本 PR 做了什么。
- 本 PR 没有做什么。
- 是否改代码。
- 是否改 API。
- 是否改数据库。
- 是否改权限、认证、租户隔离。
- 是否进入真实 HIS / Webhook / 外部系统同步。
- 是否进入 AI / RAG / 企微 / 自动触达。

PR 1 描述必须明确：

- 只新增 spec / plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入真实 HIS / Webhook / 外部系统同步。
- 不进入 AI / RAG / 企微 / 自动触达实现。

## 15. 当前 PR 1 验证命令

当前 PR 只运行：

```bash
git diff --check
```

不运行完整 test / typecheck / build。原因：当前 PR 只新增 Markdown 文档，没有修改 TypeScript、React 页面、API route、数据库 schema / migration、权限、认证或租户隔离。
