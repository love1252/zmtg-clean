# V0.6 Follow-up Operations Dashboard 01D

日期：2026-07-07

## 目标

在智能随访 V0.6 已有 01A 路径纳入、01B 消息草稿、01C 客户时间线基础上，新增机构端只读运营看板，帮助运营负责人查看今日待随访、逾期、高风险、路径执行、草稿处理和角色工作量。

## 范围

本 slice 复用现有数据：

- `followUpTasks`
- `followUpPathEnrollments`
- `followUpPathStages`
- `followUpMessageDrafts`
- `followUpCustomerTimelineEvents`

新增能力：

- `followup-operations-dashboard` domain 只读聚合。
- `followup-operations-dashboard-service` 服务层权限校验和 snapshot 读取。
- `GET /api/institution/followup-operations/dashboard` 机构端 API。
- `SmartFollowUpShell` 新增“运营看板 / 路径效果”区域。

## 聚合口径

### overview

- 今日待随访：到期日在当前 UTC 日期内，且状态仍可行动的任务。
- 逾期任务：到期时间早于 `now`，且状态仍可行动的任务。
- pending：`scheduled`、`due`、`in_progress`。
- 高风险：`riskLevel = urgent`。
- 已确认待人工发送：`messageDraft.status = approved`。
- 已人工发送：`messageDraft.status = marked_sent`。
- 人工反馈：timeline eventType 为 `manual_feedback_recorded`。

### path performance

固定返回四类路径模板，便于空数据时展示 0 值结构：

- 水光术后管理：`hydro_injection_care`
- 光电术后管理：`photoelectric_care`
- 术后修复：`post_surgery_repair`
- 皮肤管理：`skin_management`

完成率为 `completedTaskCount / generatedTaskCount` 的百分比。

### workload

按路径阶段 `handlerRole` 聚合。当前 schema 没有个人负责人字段，所以 `assignedUserId` 固定为 `null`，UI 不展示个人身份。

## 安全与边界

- 本功能只读聚合，不触发客户触达。
- 不发送微信、企业微信、短信。
- 不做电话外呼。
- 不接外部消息渠道、客户自动回复、HIS、webhook。
- 不调用真实 AI provider。
- 不返回手机号原文、身份证、病历号、HIS payload。
- 不返回 provider、model、token、cost、vendor、prompt、raw AI response。
- 不新增 schema。
- 不新增 migration。

## 权限与隔离

- API 使用 `follow_up/read_own_tenant` 权限。
- tenantId 从 `AccessContext` 获取，不信任请求参数。
- 当 `context.institutionId` 存在时，snapshot 查询按 institutionId 限制 enrollment、stage、draft、timeline 数据。
- follow-up task 自身没有 institutionId，通过可见 stage 关联进入看板。

## API response 白名单

允许返回：

- 聚合数字。
- `templateKey` / `pathName`。
- `handlerRole`。
- `assignedUserId: null`。
- `nextDueAt` 等时间字段。

禁止返回：

- `tenantId` / `institutionId`。
- 客户隐私原文。
- 完整治疗原文 / HIS payload。
- provider / model / token / cost / vendor。
- channel secret / API key / baseUrl / secret。
- prompt / raw AI response / stack trace。

## UI 文案

运营看板明确提示：

- 本区域为内部运营统计。
- 不代表已自动联系客户。
- 标记已发送仅代表人工记录。
- 当前没有企业微信 / 短信接入。
- 不做自动营销群发。

## 测试覆盖

新增 / 更新测试覆盖：

- domain overview 今日待随访、逾期、高风险、升级、草稿和人工反馈。
- path performance 固定模板、完成率、空数据 0 值。
- workload 按 handlerRole 聚合。
- draft operations approvedButNotMarkedSentCount。
- risk summary。
- API response 白名单和错误脱敏。
- UI 展示运营看板、路径效果、草稿处理、工作量、空态和人工边界文案。
- 旧 SmartFollowUpShell fetch mock 支持 dashboard fallback，避免 01A/01B/01C UI 回归。
