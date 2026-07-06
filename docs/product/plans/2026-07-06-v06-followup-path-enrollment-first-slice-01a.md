# V0.6-FOLLOWUP-PATH-ENROLLMENT-FIRST-SLICE-01A

日期：2026-07-06（本地时区）

## 范围

本切片实现智能随访路径纳入第一版：从治疗摘要识别标准化治疗事件，匹配现有随访路径模板，创建路径实例 enrollment，并生成 D1 / D3 / D7 等人工随访任务与阶段实例。

## 已实现能力

1. 治疗摘要标准化为最小治疗事件。
2. 复用 `treatment-path-templates` 匹配路径模板：
   - `photoelectric_care`
   - `hydro_injection_care`
   - `post_surgery_repair`
   - `skin_management`
3. 新增路径实例与阶段实例 schema / migration。
4. 创建 enrollment 后按模板节点生成 `followUpTasks` 人工任务。
5. 通过 active enrollment 唯一约束和服务层查询防重复纳入。
6. API 响应只返回低敏路径实例白名单字段。
7. 机构端智能随访页面展示路径管理、路径实例、路径进度和真实随访旅程摘要。
8. 审计使用低敏 reason，不记录完整治疗原文、手机号、HIS payload、prompt 或 provider 信息。

## 安全边界

- 不真实发送微信、企业微信、短信或任何外部消息。
- 不接 HIS。
- 不接外部 webhook。
- 不做客户自动回复。
- 不做消息渠道集成。
- 不做自动营销群发。
- 不做医疗诊断。
- 不读取或输出 `.env.local`、secret、API key。
- 不新增消息发送表、channel delivery 表、HIS 表、worker / queue / cron 表。

## API

- `GET /api/institution/followup-paths/templates`
- `GET /api/institution/followup-paths/enrollments`
- `POST /api/institution/followup-paths/enrollments`
- `GET /api/institution/followup-paths/enrollments/[enrollmentId]`
- `POST /api/institution/followup-paths/enrollments/[enrollmentId]/cancel`

`POST /api/institution/followup-paths/enrollments` 当前最小支持：

```json
{
  "sourceType": "treatment_summary",
  "sourceId": "treatmentSummaryId",
  "templateKey": "hydro_injection_care"
}
```

`templateKey` 可省略，省略时自动匹配。

## API 响应白名单

路径实例 DTO 仅返回：

- `enrollmentId`
- `customerId`
- `customerDisplayName`
- `templateKey`
- `status`
- `stageCount`
- `taskCount`
- `dueAt`
- `safeMessage`
- `stages`
- `taskIds`
- `createdAt`
- `updatedAt`

阶段 DTO 仅返回：

- `nodeKey`
- `stageKey`
- `dueAt`
- `status`
- `followUpTaskId`
- `handlerRole`
- `riskLevel`
- `safeMessage`

## 不包含内容

- 真实消息发送。
- 企业微信 / 短信 / 电话外呼接入。
- HIS 接入或 webhook。
- 自动营销群发。
- 自动客户回复。
- 生产 worker / queue / cron。
- 医疗诊断判断。

## 验证计划

需运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests
node scripts/run-vitest.mjs run src/modules/open-platform/tests
node scripts/run-vitest.mjs run src/modules/knowledge-base/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/eslint .
node scripts/run-next.mjs build --webpack
./node_modules/.bin/drizzle-kit check
git diff --check
```

## 后续建议

下一切片可在保持人工处理边界的前提下，增加路径实例详情页、手动取消原因、阶段完成同步 enrollment 进度，以及治疗摘要列表中的“纳入路径”入口。
