# Phase 23 HIS 连接配置状态 API 闭环收尾

> 状态：docs-only 收尾。本 PR 只确认 HIS 连接配置状态 API 从权限、service、route、route denied audit 到测试的当前闭环状态，不写代码，不改测试，不新增 API，不修改 route、service、parser、repository、权限、audit domain、reason、query whitelist、schema 或 migration。

## 本次范围

- 新增状态 API 闭环收尾文档。
- 同步 README、roadmap 和 devlog 的 Phase 23 状态 API 当前状态。
- 明确下一阶段建议优先进入凭证管理 Plan Mode，后续再进入测试连接 Plan Mode 和真实 HIS adapter Plan Mode。
- 不把当前能力描述为真实 HIS 已接入。

## 已完成链路

- 状态权限已实现。
- 状态 service 已实现。
- pause / resume API route 已实现。
- revoke / DELETE API route 已实现。
- 403 权限拒绝 route denied audit 已实现。
- parser 失败 route denied audit 已实现。
- route tests 已覆盖。
- status service tests 已覆盖。
- 权限 / audit domain 回归已覆盖。

## 已具备的状态 API

- `POST /api/institution/his-connections/[connectionId]/pause`
- `POST /api/institution/his-connections/[connectionId]/resume`
- `POST /api/institution/his-connections/[connectionId]/revoke`
- `DELETE /api/institution/his-connections/[connectionId]`

这些 API 只表达连接配置状态生命周期动作，不表达凭证创建、凭证轮换、测试连接、健康检查刷新或真实 HIS 调用。

## 权限边界

- pause / resume / revoke 使用 `open_connection:manage_status`。
- DELETE / softDelete 使用 `open_connection:delete`。
- `open_connection:read_own_tenant` 不可替代状态写入权限。
- `open_connection:update` 不可替代状态写入权限。
- v1 默认仅 `tenant_admin` 可执行状态写入。
- 不做平台代管写入。
- 权限判断只使用服务端 access context，不接受 body、query、header、localStorage 或外部系统 payload 中的 `tenantId`。

## service 边界

- service 不判断权限。
- service 不读取 request、header、query 或 localStorage。
- service 只接收 accessContext、connectionId、database 和可选 reasonCode。
- service 只调用 repository 状态方法。
- repository 写入与 audit 写入在同一事务内完成。
- 成功 DTO 固定为 `{ ok: true }`。
- service 继续负责成功 allowed audit 和 repository 非 ok denied audit。
- service 不调用真实 HIS，不测试连接，不处理凭证，不创建治疗摘要或随访任务。

## route audit 边界

- 权限拒绝 route denied audit 已实现。
- parser 失败 route denied audit 已实现。
- `401 unauthorized` 不写 route audit。
- 空 connectionId 的 `404 not_found` 不写 route audit。
- service repository failure 不重复写 route audit。
- `service_unavailable` 不写 route denied audit。
- status service 继续负责 allowed audit 和 repository 非 ok denied audit。
- route audit 失败返回 `503 service_unavailable`，且不调用 status service。

## audit action 与 reason

- pause / resume / revoke 使用 `manage_status`。
- DELETE / softDelete 使用 `delete`。
- 权限拒绝 reason 复用 canAccessResource 既有 reason。
- parser 失败 reason 使用 `invalid_his_connection_payload`。
- repository `not_found` 使用 `not_found_or_not_owned`。
- repository `invalid_state_transition` 使用 `invalid_transition`。
- repository `validation_failed` 使用 `invalid_his_connection_payload`。
- repository `conflict` 使用 `invalid_transition`。
- 未新增 audit reason。
- 未新增 audit action。

## DTO 与敏感信息边界

- 成功响应只返回 `{ ok: true }`。
- 错误响应只返回稳定 code / error。
- 不返回 id、tenantId、status、credentialRef、credentialConfigured、healthStatus、时间字段、actor 字段或 read model。
- 不记录或回显凭证、token、secret、API key、连接串、raw HIS payload、SQL、stack、DATABASE_URL、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- route denied audit 不记录 request body、response body、body tenantId、query tenantId、header tenantId 或外部错误全文。

## 仍未进入范围

- 凭证管理。
- 测试连接。
- 真实 HIS adapter。
- 患者身份匹配。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。
- 外部机构系统。
- 企微。
- AI / RAG / Agent。
- 经营智能中心、图表或导出。

## 下一阶段建议

1. Phase 23 凭证管理 Plan Mode。
2. 测试连接 Plan Mode。
3. 真实 HIS adapter Plan Mode。

凭证管理应先于测试连接和真实 HIS adapter，因为测试连接和 adapter 都依赖安全凭证存储、凭证可见性、凭证审计、错误降级和明文展示禁止边界。

## 验证清单

- `git status --short`
- `git diff --name-only origin/main...HEAD`
- `git diff --stat origin/main...HEAD`
- `git diff --check origin/main...HEAD`
- 中文化残留检查
- 禁止范围检查

## 收口结论

Phase 23 HIS 连接配置状态 API 当前已从权限、service、pause / resume route、revoke / DELETE route、权限拒绝 route denied audit、parser 失败 route denied audit、route tests、status service tests 和权限 / audit domain 回归覆盖形成闭环。

当前闭环仍是连接配置状态管理能力，不代表真实 HIS 已接入；凭证管理、测试连接和真实 HIS adapter 必须继续拆分为独立 Plan Mode 和独立 PR。
