# V0.6-KB-REAL-OPERATIONS-CLOSED-LOOP-02A：本地 5010 上传 503 根因记录

## 1. 日期与基线

- 日期 / 时区：2026-07-04 CST。
- 当前 main commit：`daf2d1e1be7de95ca3f01f660d089379d838c971`。
- 本记录只说明本地 5010 / testdb 的根因与处理结果，不代表测试服或生产数据库状态。

## 2. 问题现象

在本地 5010 验收机构端知识库真实最小闭环第一阶段时，出现以下现象：

1. `GET /api/institution/entitlement-usage` 返回 `503`。
2. `POST /api/institution/knowledge-management/upload` 返回 `503`。
3. upload response 为 `service_unavailable`。
4. 上传 payload 曾确认包含 `file` 字段。

## 3. 已排除原因

本轮诊断排除了以下方向：

1. 不是前端未传文件。
2. 不是简单 quota 已满。
3. 不是 upload route 代码本身优先问题。
4. 不是需要清空知识库数据。

## 4. 真实根因

真实根因是本地 testdb migration 落后，导致运行时代码与数据库结构不一致。

具体表现：

1. `tenant_quota_snapshots` 缺少 `current_ai_credits` / `max_ai_credits`。
2. 当前代码 schema / quota 查询已引用这两列。
3. `checkTenantQuotaForCreate` 与 `getTenantEntitlementUsageService` 均会走 `findActiveQuotaLimitByTenant`。
4. 该查询因缺列抛出 `Failed query`。
5. route 外层 `catch` 将异常包装成 `503 service_unavailable`。

因此，`entitlement-usage 503` 与 `upload 503` 是同一个本地 testdb schema drift 问题，而不是前端 payload、quota 已满或 upload service 主逻辑问题。

## 5. 诊断结果

本轮诊断确认：

1. `DATABASE_URL` 存在，但未输出 secret。
2. DB 为 `postgres`，schema 为 `public`。
3. required tables 存在。
4. `growth-tenant-chengxing` 存在且 active。
5. active plan assignment 存在。
6. active knowledge file count 为 `0`。
7. knowledge files by status 无记录。
8. migration 记录停在 `0023`，`0024` / `0025` / `0026` 未执行。

## 6. 处理结果

本地处理过程如下：

1. 尝试 `pnpm db:migrate`，被 pnpm 前置检查拦截。
2. 使用项目等价本地命令 `./node_modules/.bin/drizzle-kit migrate` 成功执行既有 migration。
3. 未新增 migration。
4. 未改代码。
5. 未执行 seed。
6. 未执行 reset apply。

## 7. 处理后结果

处理后，本地 testdb 状态与 5010 复验结果如下：

1. `tenant_quota_snapshots` 已出现 `current_ai_credits` / `max_ai_credits`。
2. migration 记录新增到 id `34` / `35` / `36`，对应 `0024` / `0025` / `0026`。
3. `GET /api/institution/entitlement-usage` 恢复 HTTP `200`。
4. entitlement response 返回 `trial-care` 试用版权益。
5. `knowledge_files` 为 `used=0 / limit=20 / remaining=20 / status=normal`。
6. `.txt` 上传恢复 HTTP `201`。
7. upload 返回 `status=created`。
8. upload parse result 为 `parseStatus=succeeded`。
9. upload parse result 为 `chunkCount=1`。

## 8. 后续规则

后续本地 5010 调试前，应优先确认 testdb migration 状态。

如果 `entitlement-usage` 和 upload 同时返回 `503`，应先检查 migration / schema 是否一致，不要优先误判为：

1. quota 已满。
2. 前端 payload 未传文件。
3. upload service 主逻辑错误。
4. 平台端 UI 问题。

## 9. 明确未做

本轮记录对应的诊断与处理未做以下事项：

1. 未改代码。
2. 未新增 API route。
3. 未改 repository / service。
4. 未改 DB/schema/migration 文件。
5. 未新增 migration。
6. 未改 `drizzle/**`。
7. 未改 `src/server/db/**`。
8. 未改 package / lock。
9. 未提交 secret。
10. 未接 AI provider。
11. 未接向量数据库。
12. 未做复杂文档解析 / OCR。
13. 未做真实训练 runtime。
14. 未做生产级队列。

## 10. 风险

1. 本记录只说明本地 testdb 根因与处理。
2. 不代表测试服或生产数据库已执行相同 migration。
3. 后续环境需要单独核对 migration 状态。
4. 如测试服或生产出现类似 `entitlement-usage` 与 upload 同时 `503`，不得直接套用本地处理命令，必须先确认目标库、备份策略、migration 状态和执行授权。
