# Phase 14 治疗摘要管理能力 v1 设计

> 日期：2026-05-31
> 状态：Phase 14 PR 1 文档规划。本文只固化设计和后续 PR 拆分，不包含业务代码、页面、测试、API route、数据库 schema、migration、权限、认证或租户隔离修改。

## 1. Phase 14 目标

Phase 14 默认选择“治疗摘要管理能力 v1”。目标是在 Phase 12 已完成治疗结构化摘要读路径、Phase 13 已完成治疗摘要人工录入闭环之后，为机构端提供跨客户的治疗摘要只读管理能力。

本阶段 v1 目标：

- 提供机构端治疗摘要只读列表。
- 支持按客户、治疗项目、风险等级和时间范围筛选。
- 支持分页读取。
- 支持查看治疗摘要安全详情。
- 服务端从 session / access context 推导 `tenantId`。
- 机构端只能查看当前租户治疗摘要。
- API DTO 不返回 `tenantId`。
- 不返回客户、预约、随访明细。
- 不返回完整治疗记录正文、完整病历正文、诊疗原文或咨询对话全文。
- 不做新增、编辑、删除、AI、RAG、外部系统或自动触达。

Phase 14 v1 延续当前项目的核心安全原则：机构端租户编号只能来自服务端访问上下文；前端不能通过 URL、query、header、body、localStorage 或任意浏览器状态切换租户；治疗摘要只能以结构化短摘要形式展示，不能扩大为完整病历或治疗正文。

## 2. 为什么优先做治疗摘要管理能力 v1

Phase 13 已经完成治疗摘要人工录入 v1：

- `treatment_summaries` 数据底座来自 Phase 12。
- `GET /api/institution/customers/[customerId]/timeline` 已能读取治疗摘要。
- `POST /api/institution/customers/[customerId]/treatment-summaries` 已能在客户详情上下文新增结构化治疗摘要。
- 客户详情抽屉已能新增治疗摘要并刷新 timeline。
- `treatment_summary` access resource 已存在，`tenant_admin` 具备必要 create / read 权限。
- payload parser、repository create、DTO 白名单和敏感字段拒绝已完成。

当前缺口是“录入之后如何管理”。如果治疗摘要只能在单个客户详情抽屉里查看，机构运营人员无法快速检索近期高风险摘要、某个治疗项目的恢复反馈、某个时间范围内的护理建议，也难以做日常复核和运营排班。

优先做治疗摘要管理 v1 的理由：

- 业务承接最自然：它直接承接 Phase 13 的真实录入闭环。
- 工程准备度高：复用现有 `treatment_summaries`、DTO mapper、RBAC resource、timeline 展示字段和页面状态组件。
- 风险可控：只读列表和详情比编辑、删除、随访联动、RAG、AI 或外部系统集成更稳。
- 商业演示价值高：机构端可以从“单客户治疗节点”升级到“治疗摘要运营视图”。
- 后续扩展清晰：治疗后护理 / 随访联动可在列表筛选和详情复核之后继续推进。

## 3. 为什么后置治疗后护理 / 随访联动、RAG 和平台商业化增强

### 3.1 治疗后护理 / 随访联动后置

治疗后护理 / 随访联动的业务价值很高，但它会把治疗摘要从只读信息推进到任务生成或任务建议。即使不接 AI、不自动触达客户，也需要单独设计：

- 随访任务创建 API 或建议 DTO。
- 建议去重和幂等策略。
- 任务来源字段或审计语义。
- 治疗摘要到随访任务的引用关系。
- 是否影响现有随访任务配额。
- 人工确认、失败回滚和重复任务提示。

当前 `follow_up_tasks` 已有读取和状态流转能力，但没有面向治疗摘要的创建能力。Phase 14 先建立治疗摘要列表、筛选和安全详情，后续再基于已筛出的摘要做护理 / 随访联动，会更符合小步交付。

### 3.2 知识库 / RAG 基础准备后置

知识库 / RAG 有长期价值，但当前不适合作为 Phase 14 默认实现方向。即使只做基础准备，也容易涉及：

- 文件来源和文件上传。
- 正文保存或正文解析。
- 文档分块。
- embedding 和检索命中。
- 内容安全和租户隔离。
- 后续 AI provider 成本、调用日志和提示词注入边界。

Phase 14 明确不进入真实 RAG 问答、不接 AI provider、不做 Agent、不保存医疗隐私正文。知识库 / RAG 应在治疗摘要管理能力稳定后单独进入安全 Plan Mode。

### 3.3 平台商业化增强后置

Phase 9 到 Phase 11 已完成平台租户管理基础版、套餐配额 enforcement 轻量版和平台商业化健康只读视图。平台商业化继续增强仍有价值，但它更贴近平台运营面，不承接 Phase 12 / 13 的治疗摘要链路。

如果 Phase 14 继续平台商业化，容易滑入套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复、严格一致计费或更多写入审批。Phase 14 应先完成机构端治疗摘要只读管理能力，再后置平台商业化继续增强。

## 4. 治疗摘要管理 v1 范围

Phase 14 v1 包含：

- 新增机构端治疗摘要列表查询 domain 类型。
- 新增治疗摘要列表 query parser。
- 新增 repository list 方法。
- 新增 `GET /api/institution/treatment-summaries`。
- API 只返回安全 DTO 和分页信息。
- API 支持白名单筛选参数。
- 机构端新增治疗摘要管理页面或入口。
- UI 展示治疗摘要列表、基础筛选、分页和安全详情。
- UI 覆盖 loading、empty、error、403 和 503。
- smoke 覆盖机构端入口、筛选请求、分页、详情查看和敏感字段不展示。
- README、roadmap、devlog、Phase 14 spec / plan 收尾。

推荐 UI 入口：

- 优先新增机构端一级导航项“治疗摘要”，与客户中心、预约中心、智能随访、审计日志并列。
- 该入口只读，不提供新增、编辑、删除按钮。
- 如果实现阶段希望减少导航变更，也可以放在客户中心内作为二级入口，但必须保持跨客户列表能力。

## 5. 不纳入本阶段

Phase 14 不做：

- 治疗摘要新增。
- 治疗摘要编辑。
- 治疗摘要删除。
- 治疗后护理 / 随访联动。
- AI provider。
- AI 生成治疗建议。
- Agent。
- RAG / 知识库真实能力。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件上传。
- 图片 / 文件原文保存。
- 外部系统同步。
- 自动触达客户。
- 大规模 UI 重构。
- 平台端治疗摘要下钻。
- 平台商业化写入后台。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode，不能在 Phase 14 顺手扩大范围。

## 6. 机构端治疗摘要只读列表设计

治疗摘要管理页面向机构运营人员，目标是从当前租户所有结构化治疗摘要中快速定位需要复核或跟进的记录。

列表允许展示：

- 治疗摘要 ID。
- 客户引用 ID。
- 预约引用 ID。
- 治疗时间。
- 治疗项目。
- 治疗类别。
- 治疗阶段。
- 恢复阶段。
- 风险等级。
- 负责人 ID。
- 结构化短摘要。
- 下一步护理建议。
- 安全标签。
- 创建时间。
- 更新时间。

列表禁止展示：

- `tenantId`。
- 客户姓名、手机号、身份证号、病历号原文。
- 预约详情明细。
- 随访任务明细。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 文件、图片或外部系统原文。

列表排序建议：

- 默认按 `treatmentDate desc, id asc`。
- cursor 分页也按同一排序口径。
- v1 不开放任意排序字段。

列表状态：

- `loading`：正在加载治疗摘要。
- `empty`：当前筛选下暂无治疗摘要。
- `error`：请求失败或筛选参数非法。
- `403`：当前账号没有查看治疗摘要的权限。
- `503`：数据服务暂时不可用。

## 7. 筛选参数白名单

`GET /api/institution/treatment-summaries` 只允许以下 query 参数：

| 参数 | 规则 | 说明 |
| --- | --- | --- |
| `customerId` | 字符集 `A-Za-z0-9_:-`，长度 1-96 | 只作为当前租户内客户引用筛选，不能作为授权依据 |
| `treatmentProject` | trim 后 1-160 字符，拒绝敏感内容和 SQL / token / secret 字样 | v1 基于现有字段做安全参数化筛选 |
| `riskLevel` | `normal`、`watch`、`urgent` | 复用现有 follow-up risk enum |
| `from` | 有效时间字符串 | 对应 `treatmentDate >= from` |
| `to` | 有效时间字符串 | 对应 `treatmentDate <= to` |
| `limit` | 正整数，默认 50，最大 100 | 防止大范围一次性返回 |
| `cursor` | opaque cursor | 编码上一页最后一条的治疗时间和 ID |

禁止 query 参数：

- `tenantId`
- `page`
- `offset`
- `sort`
- `order`
- `fields`
- `include`
- `metadata`
- `customerName`
- `phoneNumber`
- `medicalRecordNo`
- 任意未列入白名单的参数

解析策略：

- 出现未知参数时返回 `400`。
- 同一参数重复出现时返回 `400`。
- `from > to` 时返回 `400`。
- `tenantId` 出现在 query 中时返回 `400`，不静默忽略。
- 参数错误文案必须稳定，不暴露 SQL、stack、连接串或内部调试对象。

## 8. 详情查看边界

Phase 14 v1 的“详情”是治疗摘要安全详情，不是完整治疗记录详情。

推荐实现：

- UI 直接使用列表 DTO 中的单条记录打开详情抽屉或弹层。
- v1 不新增单条详情 API。
- 详情只展示列表 DTO 已包含的安全白名单字段。
- 详情不额外请求客户、预约、随访明细。

详情允许展示：

- 治疗时间、项目、类别、阶段、恢复阶段。
- 风险等级和负责人 ID。
- 结构化短摘要。
- 下一步护理建议。
- 标签。
- 客户引用 ID 和预约引用 ID。
- 创建时间和更新时间。

详情禁止展示：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 客户 PII。
- 图片 / 文件原文。
- AI 生成内容。
- 外部系统同步原文。

如果后续需要单条详情 API、编辑、删除、附件、治疗记录正文或客户详情联动，应单独进入 Plan Mode。

## 9. API 路径设计

推荐新增：

```text
GET /api/institution/treatment-summaries
```

选择该路径的原因：

- 这是跨客户的机构端治疗摘要管理列表，不属于单个客户详情子路径。
- 与现有机构端列表 API 命名保持一致。
- 与 Phase 13 的 `POST /api/institution/customers/[customerId]/treatment-summaries` 形成互补：POST 发生在客户详情上下文，GET 发生在跨客户管理上下文。

API 要求：

- 从 `getDemoAccessContextFromRequest()` 或后续真实 access context 推导登录上下文。
- 使用 `canAccessResource({ resource: 'treatment_summary', action: 'read_own_tenant' })`。
- 必须存在 `context.tenantId`。
- 不接受前端传入 `tenantId`。
- 只能查询 `tenant_id = context.tenantId` 的治疗摘要。
- 返回安全 DTO 和 `pageInfo`。
- 成功读取可写 allowed 审计：`resource = treatment_summary`、`action = read_own_tenant`、`result = allowed`。
- 权限拒绝可写 denied 审计。
- 审计事件不得包含请求体、筛选原文中的敏感值、SQL、stack、token、secret 或连接串。

状态码建议：

| 场景 | 状态码 | 文案 |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 无权限或缺少 tenant context | `403` | `没有访问权限` |
| 筛选参数非法 | `400` | parser 返回稳定中文错误 |
| 成功 | `200` | `{ records, pageInfo }` |
| 数据服务异常 | `503` | `数据服务暂时不可用` |

## 10. API DTO 字段白名单

建议响应结构：

```ts
type InstitutionTreatmentSummaryListItem = {
  id: string;
  customerId: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: 'normal' | 'watch' | 'urgent';
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type InstitutionTreatmentSummaryListResponse = {
  records: InstitutionTreatmentSummaryListItem[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
    limit: number;
  };
};
```

DTO 允许返回 `customerId` 和 `appointmentId` 作为引用 ID，但不返回客户、预约或随访明细。

DTO 禁止返回：

- `tenantId`
- `customerDisplayName`
- `maskedPhone`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `maskedMedicalRecordNo`
- `appointmentNote`
- `followUpSuggestedAction`
- `requestBody`
- `metadata`
- `rawPayload`
- `treatmentRecord`
- `treatmentRecordBody`
- `medicalRecord`
- `medicalRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `imageUrl`
- `fileUrl`
- `fileContent`
- `aiGeneratedContent`
- `externalSyncPayload`
- `sql`
- `stack`
- `token`
- `secret`
- `databaseUrl`

DTO 必须通过白名单 mapper 生成，不得直接返回数据库行。

## 11. 租户隔离设计

Phase 14 v1 必须延续现有租户隔离规则：

- 租户编号只来自服务端 `AccessContext.tenantId`。
- API 不接受 query、header、body 或 localStorage 中的 `tenantId`。
- 机构端角色只能读取当前租户治疗摘要。
- 平台角色默认不能通过机构端 API 读取治疗摘要。
- repository list 方法必须把 `tenantId` 作为必填输入。
- repository 查询必须包含 `eq(treatmentSummaries.tenantId, tenantId)`。
- API DTO 不返回 `tenantId`。
- 跨租户记录即使被数据库 mock 混入，也必须在 mapper 或 repository 层过滤掉。
- 403、404、400 和 503 文案不能泄露目标记录是否属于其他租户。

测试必须覆盖：

- query 中传入 `tenantId=other-tenant` 返回 400，且不参与查询。
- header `x-tenant-id: other-tenant` 不影响查询租户。
- 机构端只读取 `context.tenantId`。
- 平台角色访问机构端治疗摘要 API 返回 403。
- DTO 和 UI 不展示 `tenantId`。

## 12. PII / 医疗隐私禁区

Phase 14 schema、repository、query parser、DTO、API response、UI、测试快照、日志和审计中均禁止保存、返回或展示：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件原文。
- AI 生成内容。
- 外部系统同步原文。
- 请求体。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

禁止字段名示例：

- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `rawPhone`
- `rawIdCard`
- `rawMedicalRecordNo`
- `treatmentRecord`
- `treatmentRecordBody`
- `medicalRecord`
- `medicalRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `imageUrl`
- `fileUrl`
- `fileContent`
- `requestBody`
- `rawPayload`
- `metadata`
- `aiGeneratedContent`
- `externalSyncPayload`
- `sql`
- `stack`
- `token`
- `secret`
- `databaseUrl`

禁止值示例：

- `完整治疗记录正文`
- `完整病历正文`
- `诊疗原文`
- `咨询对话全文`
- `DATABASE_URL`
- `postgres://`
- `mysql://`
- `sk_test`
- `sk_live`
- `zmtg_sk_`
- `access_token`
- `refresh_token`

UI 文案必须使用“结构化治疗摘要”“安全详情”“只读列表”等表达，不使用“完整病历”“治疗记录全文”“诊疗原文”等会鼓励用户粘贴敏感正文的表达。

## 13. 是否新增 schema / migration

Phase 14 v1 默认不新增 schema / migration。

原因：

- Phase 12 已新增 `treatment_summaries` 表。
- 现有表已包含 Phase 14 v1 所需字段。
- 现有索引优先满足 customer / risk / date 查询：
  - `treatment_summaries_tenant_customer_date_idx`
  - `treatment_summaries_tenant_risk_date_idx`
  - `treatment_summaries_tenant_appointment_idx`
- `treatmentProject` 筛选先基于现有 `treatment_project` 字段实现。
- v1 数据规模在当前 demo / 初始交付阶段可接受。

不新增：

- 新治疗详情表。
- 新治疗正文表。
- 新文件表。
- 新知识库表。
- 新搜索索引表。
- 新 project index migration。
- 新 metadata jsonb。

后续如果治疗摘要规模变大，且项目筛选成为主要性能瓶颈，再单独评估是否新增 `(tenant_id, treatment_project, treatment_date)` 索引。该评估应作为独立 migration PR，不混入 Phase 14 v1。

## 14. 推荐 PR 拆分

Phase 14 推荐拆成 4 个 PR：

1. PR 1：Phase 14 spec / plan 文档。
2. PR 2：治疗摘要列表 domain / query parser / repository / API。
3. PR 3：机构端治疗摘要管理 UI。
4. PR 4：smoke / 文档收尾。

拆分原则：

- PR 1 只做文档，不改业务代码。
- PR 2 只做后端只读列表能力，不做 UI。
- PR 3 只做机构端 UI，不做新增、编辑、删除。
- PR 4 只做 smoke 和文档状态收尾。

## 15. 每个 PR 的范围、风险和验证方式

### PR 1：Phase 14 spec / plan 文档

范围：

- 新增 Phase 14 design spec。
- 新增 Phase 14 implementation plan。
- 不修改业务代码、页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

风险：

- 文档范围不清，导致后续 PR 混入编辑、删除、AI、RAG、外部系统或完整治疗正文。

验证：

- `git diff --check`
- 人工检查文档是否覆盖目标、范围、API、DTO、隐私禁区、租户隔离和 PR 拆分。

### PR 2：治疗摘要列表 domain / query parser / repository / API

范围：

- 新增治疗摘要列表 query 类型和 DTO 类型。
- 新增白名单 query parser。
- 扩展 treatment summary repository 的 list 方法。
- 新增 `GET /api/institution/treatment-summaries`。
- 返回安全 DTO 和分页信息。
- 补 API、parser、repository、DTO 白名单和租户隔离测试。

风险：

- 筛选参数接受未知字段或 `tenantId`。
- repository 查询遗漏 `tenantId`。
- DTO 直接返回数据库行，泄露 `tenantId` 或敏感字段。
- 项目筛选实现为不安全字符串拼接。
- 审计事件误存请求体或筛选敏感值。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 3：机构端治疗摘要管理 UI

范围：

- 新增机构端治疗摘要管理页面或入口。
- 新增 client helper 调用 `GET /api/institution/treatment-summaries`。
- 支持筛选、分页、安全详情查看。
- 复用 `InstitutionPageState` 和 `InstitutionSectionHeader`。
- 不提供新增、编辑、删除入口。
- 补 UI 和 client 测试。

风险：

- UI 展示客户、预约、随访明细。
- UI 把安全详情误写成完整治疗详情。
- 筛选表单提交 `tenantId` 或未知参数。
- 错误态泄露 SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- 新导航入口被误认为包含新增 / 编辑能力。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- `node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 4：smoke / 文档收尾

范围：

- 补 workspace smoke 覆盖治疗摘要管理入口。
- smoke 覆盖列表、筛选、分页、安全详情和敏感字段不展示。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 14 spec / plan 状态为完成。

风险：

- smoke 只验证入口，不验证敏感字段不展示。
- 文档遗漏“不做新增 / 编辑 / 删除”和“不进入 AI / RAG / 外部系统”边界。
- 收尾文档误写成已经完成后续联动或完整治疗记录。

验证：

- `node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`
- `git diff --check`

## 16. Phase 14 完成标准

Phase 14 完成时应满足：

- 机构端存在治疗摘要只读管理入口。
- `GET /api/institution/treatment-summaries` 只查询当前租户治疗摘要。
- API query 参数只接受白名单。
- API DTO 不返回 `tenantId`、客户 / 预约 / 随访明细或敏感正文。
- UI 支持列表、筛选、分页和安全详情查看。
- UI 不提供新增、编辑、删除入口。
- smoke 覆盖入口和敏感字段不展示。
- README、roadmap、devlog、Phase 14 spec / plan 已同步完成状态。
- 未新增 schema / migration。
- 未修改权限、认证或租户隔离模型。
- 未进入治疗后护理 / 随访联动、AI、RAG、企微、外部系统、支付、合同或发票。

## 17. Phase 14 后续建议

Phase 14 完成后，后续优先级建议：

1. 治疗后护理 / 随访联动 v1：只做结构化任务建议和人工确认，不自动触达客户。
2. 平台商业化继续增强：继续保持只读运营辅助，避免支付、合同和发票。
3. 知识库 / RAG 安全基础准备：单独 Plan Mode，优先 metadata-only，不保存医疗隐私正文。
4. 治疗摘要编辑能力：单独 Plan Mode，必须设计审计、权限、版本和敏感字段二次拦截。
