# V0.6-PACKAGE-AI-QUOTA-PLATFORM-READONLY-03-ACCEPTANCE-01：平台端套餐权益 / AI 服务额度只读 API 本地与测试服验收收口

## 1. 验收基线

- 验收日期 / 时区：2026-07-02 CST。
- main HEAD：`bc99b5e613e4323d0899944342fdcaebb7dc0537`。
- API route：`GET /api/v1/open-platform/package-ai-quota`。
- 本轮性质：验收 + docs-only 收口。
- API 当前口径：mock/fixture-based readonly contract，不接 DB，不做真实扣减、不做额度告警、不做导出、不做 UI。

## 2. 本地 5010 验收结论

- 15432 tunnel：已监听，`127.0.0.1:15432` 可连接。
- 本地 5010：已通过 `/Users/dongxiaolong/Documents/Codex/scripts/zmtg-5010-testdb.sh` 启动。
- `/api/version` 返回 main HEAD：`bc99b5e613e4323d0899944342fdcaebb7dc0537`。
- `GET /api/v1/open-platform/package-ai-quota` 返回 200。
- 未出现 500。
- 未返回 HTML 错误页或白屏相关错误内容。
- 本地 API 验收不需要浏览器视觉验收。

## 3. 本地 response sections 验收

本地默认响应包含以下 sections：

1. `packages`
2. `entitlements`
3. `tenantBindings`
4. `tenantQuotaSummaries`
5. `serviceProjectQuotaAttributions`
6. `quotaStatuses`
7. `notes`

默认响应计数：

1. `packages`：3。
2. `entitlements`：3。
3. `tenantBindings`：5。
4. `tenantQuotaSummaries`：5。
5. `serviceProjectQuotaAttributions`：16。
6. `quotaStatuses`：5。
7. `notes`：5。

## 4. 本地 query 筛选验收

已确认以下 query 只筛选 mock/fixture 数据，不触发 DB 读取或真实扣减：

1. `packageCode=basic`
2. `quotaStatus=active`
3. `tenantId=tenant-demo-low-sensitive`

筛选结果能够正确回显 `filters`，并返回匹配的 fixture 数据。

## 5. 测试服同步情况

- 测试服正式域名：`https://www.129ai.com`。
- 初始测试服 `/api/version` 为旧 HEAD：`d75189e45c62909009673c752df3de9bc32bfbf1`。
- 已使用既有脚本 `scripts/deploy-test-server.mjs` 同步测试服到当前 main HEAD。
- 同步时设置公网版本校验入口为 `https://www.129ai.com/api/version`。
- 同步后测试服 `/api/version` 返回：`bc99b5e613e4323d0899944342fdcaebb7dc0537`。
- HTTPS 证书正常，本轮未使用 IP + 忽略证书通道。
- 本轮未执行 migration。
- 本轮未执行 db:seed。
- 本轮未写入业务数据。
- 本轮未调用 provider。
- 本轮未执行真实 AI smoke。
- 本轮未部署生产。

## 6. 测试服 API 验收结论

- `GET /api/v1/open-platform/package-ai-quota` 返回 200。
- 未出现 500。
- 未返回 HTML 错误页。
- 响应为 mock/fixture-based readonly contract。
- 测试服默认响应 sections 与本地一致。
- 测试服默认响应计数与本地一致：
  - `packages`：3。
  - `entitlements`：3。
  - `tenantBindings`：5。
  - `tenantQuotaSummaries`：5。
  - `serviceProjectQuotaAttributions`：16。
  - `quotaStatuses`：5。
  - `notes`：5。

## 7. 测试服 query 筛选验收

已在正式域名验证：

1. `packageCode=basic`
2. `quotaStatus=active`
3. `tenantId=tenant-demo-low-sensitive`

筛选结果能够正确回显 `filters`，并返回匹配的 fixture 数据。

## 8. notes 不可宣称边界验收

本地和测试服响应中的 `notes` 均明确包含以下边界：

1. 当前为 mock/fixture-based readonly contract。
2. 不代表真实套餐扣减。
3. 不代表真实剩余额度。
4. 不代表真实财务账单。
5. 不代表 provider 成本验收。

## 9. 低敏字段检查结果

本地和测试服响应均未发现以下字段或内容：

1. `apiKey`
2. `encryptedApiKey`
3. `Authorization`
4. `Cookie`
5. `prompt`
6. `answer`
7. `rawResponse`
8. `metadata` 原文
9. `meteringDetails` 原文
10. `RMB`
11. `¥`
12. 真实成本金额
13. 客户姓名
14. 手机号
15. 身份证
16. 病历详情

## 10. 当前可对内宣称

1. 平台端已有套餐权益 / AI 服务额度 mock-based 只读 API。
2. API 可返回套餐、权益、租户绑定、额度摘要、服务项目归因、额度状态和说明 notes。
3. API 已完成本地 5010 只读验收。
4. API 已完成测试服正式域名只读验收。
5. 测试服已同步到 main HEAD：`bc99b5e613e4323d0899944342fdcaebb7dc0537`。

## 11. 当前不可对外宣称

1. 不可宣称真实套餐扣减已完成。
2. 不可宣称真实剩余额度可用。
3. 不可宣称额度告警已完成。
4. 不可宣称导出已完成。
5. 不可宣称真实财务账单。
6. 不可宣称人民币成本核算。
7. 不可宣称 provider 成本验收。
8. 不可宣称接入真实 DB。
9. 不可宣称生产可直接上线。

## 12. 后续建议

1. 建议先锁定 `V0.6-PACKAGE-AI-QUOTA-PLATFORM-READONLY-03` 的 API 验收完成。
2. 下一刀如继续推进，建议只做平台端只读 UI 或机构端 `quota.isLinked=true` 演进设计，二者不要并行混做。
3. 真实扣减、额度告警、导出、生产上线必须单独设计和授权。
4. 若后续接入 DB/schema/migration，应单独拆 PR，不与 UI 或扣减逻辑混入同一轮。
