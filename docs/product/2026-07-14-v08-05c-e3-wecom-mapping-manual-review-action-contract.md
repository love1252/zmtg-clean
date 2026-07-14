# V0.8-05C-E3：企业微信客户匹配人工复核动作契约与实现计划

文档日期 / 时区：2026-07-14 / CST（UTC+08:00）

当前基线：`main / origin/main = aa9a51238e8fa0e99fee55712dfcc11b445df20f`

## 1. 背景与当前基线

05C-E1 已完成 mock customer mapping domain，并把候选生成、受控审计和 fail-closed 边界放在可验证的 domain 内。

05C-E2 已完成机构端候选只读 API 与页面：候选仅以 MOCK / DEMO 的低敏摘要展示，使用可信会话 tenant、既有 `customer:read` 权限、route / reader 双运行时 strict parser、Unicode 和敏感文本边界；页面没有 mutation 按钮。

因此当前系统只能展示候选，**不存在人工复核 mutation**。05C-E3 只定义人工复核动作契约与后续实现计划，不实现 API、UI、domain、数据库或任何外部调用。

本文不代表真实客户关系写入、自动合并、真实企业微信同步或任何生产数据变更已获授权。`approved_pending_link` 仅记录人工结论，绝不等同于 `linked`、`merged` 或真实关系已写入。

## 2. E3 目标与非目标

### 2.1 目标

- 定义人工复核动作、状态机和完整 transition matrix。
- 定义角色、权限、可信 tenant / institution 上下文与跨租户拒绝规则。
- 定义 idempotency key、`expectedVersion`、并发冲突和重放规则。
- 定义原子审计、低敏返回、受控 reason code 和 fail-closed 契约。
- 定义未来 mutation API 与机构端 UI 的最小实现切片和验收门禁。

### 2.2 非目标

本阶段明确不做以下事项：

- 不自动合并客户，不写真实客户关系。
- 不真实同步企业微信，不读取外部联系人，也不调用企业微信。
- 不读取会话内容，不接入会话内容存档。
- 不进行批量自动审批，不提供外部发送能力。
- 不修改数据库 schema、migration、seed、package 或 lock。
- 不实现 runtime，包括 domain、API、UI、repository、provider 或测试代码。

## 3. 术语、对象与全局不变量

| 名称 | 契约含义 |
| --- | --- |
| `mappingId` | 服务端已知的候选匹配内部标识；不是外部联系人标识、手机号或客户关系标识。 |
| 人工复核结论 | 人员基于允许的低敏候选摘要作出的业务判断。 |
| `expectedVersion` | 客户端从当前只读视图取得的正整数版本，用于乐观并发控制。 |
| `idempotencyKey` | 客户端为一次用户动作生成的、不透明且有限长度的标识；不承载业务语义或敏感数据。 |
| 低敏备注 | 经 strict parser、长度上限、Unicode 与敏感文本扫描后允许的简短说明。 |
| fail-closed | 无法安全验证认证、租户、权限、版本、请求、审计或输出时，不改变状态且只返回受控代码。 |

全局不变量如下：

1. 服务端只信任可信会话中的 `tenantId`、`institutionId` 和主体身份；body、query、header 都不能指定任意 tenant。
2. 每次 mutation 只能在当前 tenant 的单一 `mappingId` 上工作；不允许跨 tenant 查找、复制或比较候选。
3. 客户端不能提交目标状态、`autoMerge`、真实关系 payload 或外部提供方原始数据。
4. 所有 reason 均为本文注册的固定 code；禁止调用方提交自定义状态文本或自定义 reason。
5. 所有 mutation 都必须保持 `autoMergePerformed=false`、`realCustomerRelationshipWritten=false`；任何相反结果均为契约错误并 fail-closed。
6. `clear_candidate` 在 05C-E3 **明确禁止**，不作为隐式能力；如有业务需要，必须以独立编号、独立状态机、独立授权和独立审查定义。

## 4. 受控枚举

### 4.1 复核状态

| 状态 | 含义 | 是否代表真实关系写入 |
| --- | --- | --- |
| `pending_review` | 候选可供人工处理。 | 否 |
| `needs_more_info` | 当前证据不足，等待允许范围内的补充信息。 | 否 |
| `conflict` | 存在互斥或不一致的低敏证据，需要人工重新判断。 | 否 |
| `approved_pending_link` | 人工同意候选，但尚未、也不得在 E3 中写任何真实关系。 | 否 |
| `rejected` | 人工拒绝候选。 | 否 |
| `reopened` | 已完成结论被允许重新审阅。 | 否 |
| `disabled` | 候选来源、授权或安全门禁不可用；禁止复核。 | 否 |

`linked`、`merged`、`relation_written`、`auto_merged` 及任何等价状态均不属于 E3 状态集合。

### 4.2 动作、固定 reason code 与审计事件

| 动作 | 固定 reason code | 成功审计事件 | 失败关闭 reason 示例 |
| --- | --- | --- | --- |
| `approve_candidate` | `manual_evidence_confirmed`、`institution_record_match_confirmed` | `mapping_review_approved` | `action_not_allowed`、`version_conflict` |
| `reject_candidate` | `evidence_not_sufficient`、`candidate_not_same_person`、`candidate_outdated` | `mapping_review_rejected` | `action_not_allowed`、`version_conflict` |
| `request_more_info` | `missing_low_sensitive_evidence`、`ownership_or_source_unclear` | `mapping_review_more_info_requested` | `action_not_allowed`、`sensitive_input_blocked` |
| `mark_conflict` | `multiple_candidate_conflict`、`identity_evidence_conflict`、`ownership_conflict` | `mapping_review_conflict_marked` | `action_not_allowed`、`sensitive_input_blocked` |
| `reopen_review` | `new_low_sensitive_evidence`、`prior_decision_reconsidered`、`version_reconciliation` | `mapping_review_reopened` | `action_not_allowed`、`version_conflict` |

固定 fail-closed reason 仅可来自注册集合：`unauthenticated`、`permission_denied`、`tenant_context_missing`、`tenant_mismatch`、`mapping_unavailable`、`request_contract_invalid`、`sensitive_input_blocked`、`action_not_allowed`、`version_conflict`、`idempotency_conflict`、`idempotency_unavailable`、`audit_unavailable`、`transaction_failed`、`response_contract_invalid`。实现不得把异常原文、provider 响应或调用方文本映射为新的 code。

## 5. 状态机与 transition matrix

### 5.1 核心规则

- `approve_candidate` 的唯一成功目标是 `approved_pending_link`，绝不直接进入 `linked`、`merged` 或任何真实关系状态。
- `approved_pending_link` 只是人工结论；真实关系写入必须由未来独立编号、独立授权的切片处理。
- `disabled` 是终止保护状态；任何人工动作都被拒绝，恢复必须由候选来源 / 授权恢复的独立受控流程决定，不属于本契约。
- 非法 transition 返回受控 `action_not_allowed`，不改变状态、版本或审计为 accepted。
- 调用方不能传入状态名、状态显示文本或 transition 覆盖参数。

### 5.2 完整 transition matrix

单元格的“拒绝”均表示固定 fail-closed，不产生状态变更。允许的重复请求只适用于相同 idempotency key 与完全相同的规范化请求指纹，规则见第 8 节。

| 起始状态 | `approve_candidate` | `reject_candidate` | `request_more_info` | `mark_conflict` | `reopen_review` |
| --- | --- | --- | --- | --- | --- |
| `pending_review` | `approved_pending_link` | `rejected` | `needs_more_info` | `conflict` | 拒绝：`action_not_allowed` |
| `needs_more_info` | `approved_pending_link` | `rejected` | 拒绝：`action_not_allowed` | `conflict` | 拒绝：`action_not_allowed` |
| `conflict` | 拒绝：先 `reopen_review` | `rejected` | `needs_more_info` | 拒绝：`action_not_allowed` | `reopened` |
| `approved_pending_link` | 拒绝：`action_not_allowed` | 拒绝：先 `reopen_review` | 拒绝：先 `reopen_review` | 拒绝：先 `reopen_review` | `reopened` |
| `rejected` | 拒绝：先 `reopen_review` | 拒绝：`action_not_allowed` | 拒绝：先 `reopen_review` | 拒绝：先 `reopen_review` | `reopened` |
| `reopened` | `approved_pending_link` | `rejected` | `needs_more_info` | `conflict` | 拒绝：`action_not_allowed` |
| `disabled` | 拒绝：`action_not_allowed` | 拒绝：`action_not_allowed` | 拒绝：`action_not_allowed` | 拒绝：`action_not_allowed` | 拒绝：`action_not_allowed` |

### 5.3 动作逐项契约

| 动作 | 允许起始状态 | 成功目标状态 | 禁止状态 | 必填输入 | 可选输入与备注 | 权限 | 幂等 / version | 低敏返回 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `approve_candidate` | `pending_review`、`needs_more_info`、`reopened` | `approved_pending_link` | `conflict`、`approved_pending_link`、`rejected`、`disabled` | `action`、`expectedVersion`、`idempotencyKey`、受控 approve reason | 低敏备注可选；不得含敏感标识或原始证据 | `customer:read` + 未来复核动作权限 | 相同 key / 相同指纹重放原结果；版本必须相等 | `mappingId`、前后状态、版本、动作、reason code、回放标记、低敏审计引用 |
| `reject_candidate` | `pending_review`、`needs_more_info`、`conflict`、`reopened` | `rejected` | `approved_pending_link`、`rejected`、`disabled` | 同上 + 受控 reject reason | `candidate_not_same_person` 时低敏备注必填；其他可选 | `customer:read` + 未来复核动作权限 | 同上 | 同上 |
| `request_more_info` | `pending_review`、`conflict`、`reopened` | `needs_more_info` | `needs_more_info`、`approved_pending_link`、`rejected`、`disabled` | 同上 + 受控 reason | 低敏备注必填，描述所需信息类别而非原始数据 | `customer:read` + 未来补充信息请求权限 | 同上 | 同上 |
| `mark_conflict` | `pending_review`、`needs_more_info`、`reopened` | `conflict` | `conflict`、`approved_pending_link`、`rejected`、`disabled` | 同上 + 受控 conflict reason | 低敏备注必填 | `customer:read` + 未来复核动作权限 | 同上 | 同上 |
| `reopen_review` | `conflict`、`approved_pending_link`、`rejected` | `reopened` | `pending_review`、`needs_more_info`、`reopened`、`disabled` | 同上 + 受控 reopen reason | 低敏备注必填 | `customer:read` + 未来复核动作权限 | 同上 | 同上 |

所有成功动作均写入第 4.2 节相应的 accepted 审计事件；任何失败动作只记录受控失败事件和固定 reason，绝不回显原始请求。

## 6. 权限、认证与租户隔离

### 6.1 权限原则

E3 必须复用现有 AccessContext 与 `canAccessResource` 体系，而不是在 API 或 UI 中维护随意的角色白名单。查看候选和进入复核详情至少要求现有 `customer:read`。

当前权限体系没有可直接等同于“执行人工复核 mutation”的已实现动作时，后续实现应新增**最小权限** `customer:mapping_review`（或等价的 `customer` 资源动作），并在同一既有 access-control policy 中定义；本阶段不新增、不实现该权限。

### 6.2 建议角色矩阵

| 角色 / scope | 查看候选（`customer:read`） | 建议的人工复核 mutation 权限 | 说明 |
| --- | --- | --- | --- |
| `tenant_admin` | 按既有策略允许 | 允许全部五个动作，仍须通过 future `customer:mapping_review` policy | 仅限本 tenant / institution。 |
| `tenant_operator` | 按既有策略允许 | 建议允许全部五个动作，仍须通过 policy | 不因 UI 显示而绕过服务端检查。 |
| `consultant` | 按既有策略允许 | 建议仅 `request_more_info`、`mark_conflict`；approve / reject / reopen 需明确提升权限 | 具体能力由 policy 决定，而非组件硬编码。 |
| `customer_service` | 按既有策略允许 | 建议仅 `request_more_info`、`mark_conflict`；approve / reject / reopen 需明确提升权限 | 具体能力由 policy 决定，而非组件硬编码。 |
| 平台角色或非 tenant scope | 不作为机构复核入口 | 不允许执行机构动作 | 不可替代 tenant 人工决策。 |
| 无权限或缺 tenant / institution 的主体 | 不允许 | 不允许 | fail-closed。 |

### 6.3 服务端强制条件

- API 从可信会话提取 `tenantId`、`institutionId`、用户和 scope；body、query、header 的 tenant 相关字段一律拒绝或忽略，绝不作为可信来源。
- 服务端以 `targetTenantId=context.tenantId` 重新执行资源权限和复核动作权限判断；UI 按钮隐藏只改善体验，不能作为授权。
- 缺会话返回受控 401；缺权限、非 tenant scope、缺 tenant / institution 或跨 tenant 企图均为受控 403 / `tenant_mismatch`，不得泄露候选是否存在。
- `mappingId` 的查找与 version 校验必须附带当前 tenant / institution 谓词；不存在、不可见、跨 tenant 均映射到低敏 `mapping_unavailable` 或 `tenant_mismatch`。

## 7. 未来 mutation API 契约（仅设计）

建议端点：

```http
POST /api/institution/wecom/customer-mapping-reviews/:mappingId/actions
```

禁止使用 GET 执行 mutation；该端点不是本阶段已实现 API。

### 7.1 请求 exact-key 契约

请求 root 只允许以下 keys：

| 字段 | 类型与约束 |
| --- | --- |
| `action` | 第 4.2 节的五个受控动作之一。 |
| `expectedVersion` | 正整数，必须等于服务端当前版本。 |
| `idempotencyKey` | 不透明 ASCII 标识，建议 16–128 字符；不得包含业务数据。 |
| `reasonCode` | 与动作匹配的固定 reason code。 |
| `note` | 可选低敏短文本；逐动作遵守“必填 / 可选”规则。 |

后续 route 必须使用运行时 strict parser、root / nested exact keys、普通对象检查、accessor / Proxy fail-closed、请求体大小上限、Unicode 类别与敏感文本扫描。TypeScript 类型断言不得替代运行时验证。

请求必须拒绝以下内容：

- `tenantId`、`institutionId`、任何任意 scope 或客户端授权覆盖字段。
- 客户端目标状态、`autoMerge`、`realCustomerRelationshipWritten`、任何真实关系 payload。
- 原始 `external_userid`、`userid`、手机号、身份证号。
- secret、token、credential、Authorization、chat、conversation、archive 或 raw provider payload。
- 未注册 reason、任意状态文本、批量数组、动作脚本或 provider 原始异常。

### 7.2 低敏响应契约

成功或受控失败的 response 只能输出：`mappingId`、当前低敏状态 code、前后状态 code、版本、动作 code、reason code、`idempotentReplay`、低敏 audit reference 和受控 fail-closed code。输出必须 `Cache-Control: no-store`，不返回原始 body、异常、堆栈、候选敏感字段、提供方响应或请求备注原文。

`autoMergePerformed` 与 `realCustomerRelationshipWritten` 如出现在响应中，必须固定为 `false`；更安全的最小响应可以完全省略这两个字段，但不得返回相反值。

## 8. 幂等、版本与并发

### 8.1 Idempotency key

- 作用域是 `(tenantId, mappingId, action, idempotencyKey)`；tenant 来自可信会话，不来自请求。
- 服务端把该作用域与规范化请求指纹（动作、`expectedVersion`、reason code、允许的低敏备注摘要）原子保存。
- 同一 key、相同指纹：返回第一次的同一低敏结果和 `idempotentReplay=true`，不重复变更状态或重复产生 accepted 审计。
- 同一 key、不同指纹：固定返回 `idempotency_conflict`，不执行动作。
- key 记录在保留期内不可跨 mapping、跨 tenant 或跨 action 复用；保留期和清理策略必须在后续实现评审中确定，不能默认为无限或立即删除。

### 8.2 乐观锁与竞态决策

- mutation 必须携带当前 `expectedVersion`；服务端在同一原子操作中比较当前版本、应用 transition、版本加一、写入 idempotency 记录和审计。
- 当前版本不等于 `expectedVersion` 时返回 `version_conflict`，附带可安全展示的当前版本和刷新提示；不返回其他人的备注或候选内容。
- 并发 approve / reject 中，第一个成功提交且完成审计的动作获胜；其余请求必须收到 `version_conflict` 或在同 key 重放首个结果。
- 禁止 last-write-wins、静默覆盖、用客户端时间排序或以 UI 最后点击者覆盖服务端状态。
- 对已完成动作的新 key 重复请求仍按 transition matrix 拒绝；只有相同 key / 相同指纹可以重放。

## 9. 审计与原子性

### 9.1 必需审计语义

后续实现至少定义以下受控事件：

| 场景 | 审计事件 | 可记录的低敏字段 |
| --- | --- | --- |
| 请求进入并通过基础 contract | `mapping_review_action_requested` | tenant / institution 内部标识、mappingId、动作 code、请求时间、actor 内部标识、idempotency 摘要。 |
| transition 成功 | 第 4.2 节对应 accepted 事件 | 前后状态、版本、固定 reason、actor、低敏 audit reference。 |
| transition 被拒绝 | `mapping_review_action_rejected` | 动作、当前状态 code、受控失败 reason、版本。 |
| stale version | `mapping_review_version_conflict` | 动作、期望 / 当前版本、actor。 |
| 同 key 重放 | `mapping_review_idempotent_replay` | 原动作、版本、idempotency 摘要。 |
| 权限拒绝 | `mapping_review_permission_denied` | actor、scope、受控 reason；不泄露 mapping。 |
| tenant 不匹配 | `mapping_review_tenant_mismatch` | actor、受控 reason；不记录攻击者提交的 tenant 文本。 |
| 审计失败 | `mapping_review_audit_failed` | 受控错误类别；不记录异常原文。 |

### 9.2 原子性要求

成功 mutation 必须在同一原子边界内完成：transition 验证、版本递增、idempotency 记录、`requested` 与 `accepted` 审计写入。任意一步无法完成时整体回滚，返回 `audit_unavailable` 或 `transaction_failed`，不得返回 mutation 成功。

对拒绝、权限失败、tenant mismatch 和 version conflict，也必须以可用的受控审计机制记录；如该审计机制本身不可用，不得降级为成功或泄露原始错误。实现可把“请求已接收”作为审计内事件的一部分，但不得先写状态再异步补审计。

审计 payload 只允许固定代码、内部低敏标识、时间、版本和有限状态元数据。严禁记录原始请求、备注原文、手机号、身份证号、外部用户标识、secret、会话内容、聊天内容、provider 原始响应、异常原文或堆栈。

## 10. Web 安全边界

后续 runtime 必须逐项实现并测试：

- 身份认证、可信会话 tenant / institution、服务端 `customer:read` 和复核动作权限复核。
- cookie 认证场景的 CSRF 防护：严格 Origin / same-origin 校验、适当的 SameSite 策略、受控 CSRF token / header；失败一律 fail-closed。
- 不开放宽泛跨域 mutation CORS；不得接受第三方 Origin 代发动作。
- 请求体大小上限、严格 parser、exact keys、普通对象 / accessor / Proxy 防护、Unicode 与敏感文本扫描。
- `Cache-Control: no-store`，不在 URL、日志、浏览器存储或错误页中暴露请求敏感内容。
- 幂等重放防护、版本冲突处理、每 tenant / actor / mapping 的动作频控和速率限制。
- 只允许 POST mutation；GET、预取、链接点击或客户端状态切换不得产生动作。
- 服务端而非隐藏按钮执行授权、状态与 version 判断；客户端可以禁用不可用动作，但不能决定是否允许。

## 11. UI 计划（仅规划）

未来机构端人工复核 UI 的最小范围：

- 候选详情和当前低敏状态 code / 中文受控展示。
- 当前 version、可执行动作、权限不足提示和 disabled 提示。
- 动作二次确认、受控 reason code 选择、低敏备注输入和本地敏感文本拦截提示。
- conflict、stale version、idempotent replay、permission denied 和其他 fail-closed 的固定提示。
- 单次提交的 loading / success / retry 状态，避免双击产生新 key 或误导用户。

明确不提供批量审批、自动合并、真实关系写入按钮、原始外部标识展示、原始 provider payload、聊天 / 会话内容或任何外部发送能力。

## 12. 后续实现切片与门禁

| 切片 | 允许范围 | 禁止范围 | 最低验收门禁 |
| --- | --- | --- | --- |
| 05C-E3-A：domain action contract / tests | 实现状态机、受控 reason、transition、版本和幂等 domain 测试。 | 不建 route / UI / DB schema，不写真实关系。 | 完整 transition matrix、非法 transition、并发 / 重放和 `approved_pending_link` 断言通过。 |
| 05C-E3-B：mock mutation API | 实现受信任会话、权限、strict parser、mock persistence seam 和低敏 response。 | 不调用企业微信，不连接真实 DB，不接真实关系写入。 | 401 / 403、跨 tenant、CSRF、body exact keys、idempotency、version conflict、no-store、审计失败回滚测试通过。 |
| 05C-E3-C：机构端人工复核 UI | 实现受权限控制的单候选动作 UI 与受控状态反馈。 | 不做批量审批、自动合并、真实关系写入或原始数据展示。 | UI 只渲染可信 view-model，按钮 / 直接 view-key 绕过无效，错误不回显原文。 |
| 05C-E3-D：审计与并发收口 | 收口原子审计、事务边界、频控、并发与重放测试。 | 不扩大为 provider / repository / 真实同步工作。 | 状态与审计原子、审计失败不成功、并发决定性、低敏审计审查通过。 |
| 真实关系写入（独立编号、独立授权） | 仅在后续另行授权时单独设计和实现。 | 不得作为 E3 隐含后续或由 approve 自动触发。 | 独立 threat model、数据授权、schema / migration 审查、回滚和外部影响验收。 |

任何切片都不能因本文件而自动开始；每个切片均需新的明确授权和独立审查。

## 13. 验收标准

后续实现进入审查前，至少应能够证明：

- 状态机和完整 transition matrix 与本契约一致。
- 五个动作的输入、reason、备注、权限、幂等、版本、审计、低敏输出和 fail-closed 均可测试。
- `approve_candidate` 只能到达 `approved_pending_link`，且未写真实客户关系。
- 权限矩阵、可信 tenant / institution、跨租户 403 / fail-closed 和 API 最终授权防线完整。
- 同 key 重放、同 key 不同 payload、stale version、并发 approve / reject 均有决定性结果。
- 状态变更与审计原子；审计失败不得返回成功。
- CSRF、Origin / SameSite、请求大小、strict parser、Unicode / 敏感文本、no-store 和频控均已落实。
- 无自动合并、无批量审批、无 schema / migration、无 runtime 外部企业微信调用。
- 无会话内容能力、无真实关系写入、无原始敏感标识回显。
- 后续切片边界清晰，真实关系写入保留为独立编号和独立授权。

## 14. 本文档边界结论

本文是 docs-only 的动作契约和实施计划。它不新增 runtime、API、UI、domain、测试、schema、migration、provider、repository、外部调用或真实数据处理能力；更不构成任何真实客户关系写入、企业微信同步、会话内容处理或生产操作授权。
