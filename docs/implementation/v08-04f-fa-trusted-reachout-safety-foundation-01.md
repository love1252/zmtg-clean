# V0.8-04F-FA 可信触达安全事实基础

任务编号：`V0.8-04F-FA-TRUSTED-REACHOUT-SAFETY-FOUNDATION-01`

## 范围

本任务只建立以下三类生产可信事实，不执行真实发送：

1. `customer_channel_contact_consents`：客户企业微信触达许可最新状态。
2. `customer_channel_frequency_states`：系统维护的 24 小时保守频控状态。
3. `institution_channel_dry_run_snapshots`：机构企业微信官方路线最新 dry-run 评估快照。

## 固定安全语义

- 渠道当前仅为 `wechat_work`。
- 无许可记录对外等同 `unknown`，不等同 consented。
- 许可只能通过 `record_consent`、`record_opt_out`、`revoke_consent` 三个动作变更。
- 请求不接受 `status`、`evidenceRef`、租户/机构 ID、计数或发送开关。
- `evidenceRef` 由服务端生成，不保存自由文本证据。
- opt-out 独立优先阻断；恢复联系必须重新记录明确 consent。
- 频控窗口固定 24 小时，`maxPreparedCount=1`、`maxCompletedCount=1`。
- 频控只能由内部 `reservePreparedAttempt` 维护；服务端从低敏系统 operation ID 生成 `operationRef`，同一系统操作幂等，使用 `version` CAS 防并发覆盖。
- dry-run 快照只保存服务端 `evaluateWeComOfficialDryRunConfig` 的最新结果；后续 blocked 会覆盖旧 ready。
- dry-run POST 只接受官方路线、两项低敏引用、测试环境确认、secret keeper 确认和精确人工确认；`preflightStatus` 与 `proofEligibleMock` 均由服务端派生。
- `allowRealSend=false`、`externalChannelEnabled=false`、`realSendAllowed=false`、`dryRunOnly=true` 同时由服务和数据库 CHECK 固定。

## 入口

- 客户许可与频控只读：`GET /api/institution/customers/[customerId]/wecom-reachout-safety`
- 客户许可受控动作：`POST /api/institution/customers/[customerId]/wecom-reachout-safety`
- 机构 dry-run 最新快照：`GET/POST /api/institution/wecom-official-dry-run-snapshot`
- UI：现有 confirmed 企业微信客户映射下的“企业微信触达许可”紧凑区域。

`tenant_admin` 可执行许可动作；`tenant_operator` 只读。不存在与跨机构客户统一返回 `customer_not_found`。

## 明确未包含

- 真实企业微信 API、真实网络请求或真实发送。
- Secret、Token、corpId、UserID、agentId、真实 callback URL、原始 payload。
- 管理员频控修改、清零、绕过入口。
- 自动 consent、默认 consented、自动客户/映射创建。
- MessageDelivery 状态修改、`mark_sent`、worker、queue、scheduler、dashboard 扩展或 4F-G。
