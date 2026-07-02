# ZMTG-SYSTEM-STAGING-ACCEPTANCE-01：全系统测试服阶段验收与演示路径固定

## 1. 验收基线

验收日期：2026-07-02（Asia/Shanghai）

本轮 main / origin/main：

`d75189e45c62909009673c752df3de9bc32bfbf1`

测试服正式入口：

- 平台端：`https://www.129ai.com/open-platform`
- 机构端：`https://www.129ai.com/hospital`
- 版本接口：`https://www.129ai.com/api/version`

本轮性质：

- 测试服阶段验收。
- 演示路径固定。
- docs-only 沉淀。
- 不开发新功能。

## 2. 测试服同步结论

本轮初始访问 `https://www.129ai.com/api/version` 时，测试服仍返回旧版本：

`3958ce368090183cb3a17a805e6263825438923b`

因此按任务授权，使用既有测试服部署脚本同步测试服：

`scripts/deploy-test-server.mjs`

同步后版本接口返回：

`d75189e45c62909009673c752df3de9bc32bfbf1`

同步边界：

- 未执行 migration。
- 未执行 `db:seed`。
- 未直接写数据库。
- 未调用 provider。
- 未执行真实 AI smoke。
- 未部署生产。

## 3. 测试服访问与证书

测试服正式域名 HTTPS 可访问：

- `https://www.129ai.com/open-platform`：HTTP 200。
- `https://www.129ai.com/hospital`：HTTP 200。
- `https://www.129ai.com/api/version`：HTTP 200，命中当前 main HEAD。

本轮使用正式域名，不使用 IP + 忽略证书通道。

## 4. 平台端验收结果

### 4.1 平台端基础访问

平台端入口 `https://www.129ai.com/open-platform` 可访问，页面返回 HTTP 200。

通过 demo 登录方式进行只读验收后，以下平台端接口返回 200：

- `GET /api/auth/session`
- `GET /api/open-platform/tenants`
- `GET /api/open-platform/ai-usage-credits`
- `GET /api/open-platform/ai-credit-metering-rules`
- `GET /api/open-platform/audit-events`
- `GET /api/v1/open-platform/knowledge-management/capabilities`

### 4.2 平台端 AI 用量与费用

`GET /api/open-platform/ai-usage-credits` 返回 200。

本轮低敏结构验收结论：

- `summary` 存在。
- `records` 存在，本轮查询返回 20 条。
- `aggregations` 包含：
  - `byModel`
  - `byTenant`
  - `byMeteringStatus`
  - `byDate`
  - `byDateProvider`
  - `byDateProviderModel`
  - `byServiceProject`
- 未发现禁用敏感字段键：
  - `apiKey`
  - `encryptedApiKey`
  - `Authorization`
  - `Cookie`
  - `prompt`
  - `question`
  - `answer`
  - `rawResponse`
  - `metadata`
  - `meteringDetails`
  - `baseUrl`
  - `signedUrl`
  - `storageKey`
- 未发现 `RMB`、`人民币`、`¥`、真实成本。
- 平台端仍允许展示 provider / model / Token / AI 积分等平台运营字段。

### 4.3 平台端六页签视觉点击状态

本轮浏览器自动点击通道存在限制：

- 内置浏览器和 Chrome 控制通道在正式域名导航 / DOM 读取时多次超时。
- 因此未完成平台端 AI 用量六个页签的逐点击视觉验收。
- 本轮仅完成页面可达性、版本、登录态、关键 API、低敏字段和数据结构补验。

当前不能把“平台端六页签已完成自动浏览器逐点击验收”作为本轮结论。

### 4.4 平台端其他可演示模块

以下平台端能力可作为当前测试服演示候选，但需按低敏 / 只读 / demo 边界说明：

- 租户 / 机构管理：`GET /api/open-platform/tenants` 返回 200。
- AI 积分计量规则：`GET /api/open-platform/ai-credit-metering-rules` 返回 200。
- 平台审计日志：`GET /api/open-platform/audit-events` 返回 200。
- 知识库管理能力：`GET /api/v1/open-platform/knowledge-management/capabilities` 返回 200。

这些模块可用于阶段演示，但不等同生产可上线，不等同完整真实业务闭环。

## 5. 机构端验收结果

### 5.1 机构端基础访问

机构端入口 `https://www.129ai.com/hospital` 可访问，页面返回 HTTP 200。

通过 demo 登录方式进行只读验收后，以下机构端接口返回 200：

- `GET /api/auth/session`
- `GET /api/institution/dashboard-stats`
- `GET /api/institution/entitlement-usage`
- `GET /api/institution/ai-service-usage`
- `GET /api/institution/customers`
- `GET /api/institution/appointments`
- `GET /api/institution/followups`
- `GET /api/institution/opportunities`
- `GET /api/institution/treatment-summaries`
- `GET /api/institution/his-connections`
- `GET /api/institution/knowledge-management/items`

### 5.2 机构端 AI 服务使用

`GET /api/institution/ai-service-usage` 返回 200。

本轮数据态验收结论：

- 本月返回空态结构：
  - `totalUsageCount = 0`
  - `aiServiceUnitsUsed = 0`
  - `serviceProjects = []`
- 上月返回服务项目聚合数据，本轮查询 `serviceProjects` 数量为 1。
- 近 7 天筛选返回 200。
- `quota.isLinked = false`，符合“套餐额度暂未接入”口径。
- 未发现 provider / model / Token / totalTokens。
- 未发现 prompt / answer / rawResponse / metadata / meteringDetails。
- 未发现 `RMB`、`人民币`、`¥`、真实成本。
- 未发现客户姓名、手机号、身份证、病历详情、治疗摘要原文、随访建议原文。

### 5.3 机构端 AI 服务使用视觉点击状态

本轮浏览器自动点击通道存在限制：

- 未完成机构端 `AI 服务使用` 入口的自动浏览器点击验收。
- 未完成本月 / 近 7 天 / 上月筛选控件的自动浏览器逐点击验收。
- 本轮通过页面可达性、登录态、API 数据态、字段低敏边界和状态码完成补验。

当前不能把“机构端 AI 服务使用已完成自动浏览器逐点击验收”作为本轮结论。

### 5.4 机构端其他可演示模块

以下机构端能力可作为当前测试服演示候选，但需按只读 / demo / 阶段能力边界说明：

- 工作台首页：`GET /api/institution/dashboard-stats` 返回 200。
- 当前套餐 / 权益摘要：`GET /api/institution/entitlement-usage` 返回 200。
- 知识库相关入口：`GET /api/institution/knowledge-management/items` 返回 200。
- 客户中心：`GET /api/institution/customers` 返回 200。
- 预约：`GET /api/institution/appointments` 返回 200。
- 随访任务：`GET /api/institution/followups` 返回 200。
- 机会池：`GET /api/institution/opportunities` 返回 200。
- 治疗摘要：`GET /api/institution/treatment-summaries` 返回 200。
- HIS / 连接器只读信息：`GET /api/institution/his-connections` 返回 200。

这些模块可作为演示路径候选，但不能宣称真实 HIS 已接通，也不能宣称自动随访统计或生产闭环已经完成。

## 6. 当前推荐演示路径

### 6.1 平台端演示路径

1. 打开 `https://www.129ai.com/open-platform`。
2. 登录平台端 demo / 测试账号。
3. 查看平台端首页 / 控制台。
4. 查看 AI 用量与费用。
5. 演示总览、模型与厂商、租户用量、服务项目、计量状态、明细记录。
6. 查看服务项目消耗。
7. 查看租户用量排行。
8. 查看明细记录低敏字段。
9. 强调：这是平台运营视角，不是机构端视角，不是财务账单。

注意：本轮未完成平台端六页签自动浏览器逐点击验收，该路径需人工或后续浏览器通道恢复后复验。

### 6.2 机构端演示路径

1. 打开 `https://www.129ai.com/hospital`。
2. 登录机构端 demo / 测试账号。
3. 查看机构工作台。
4. 查看 AI 服务使用。
5. 切换本月 / 近 7 天 / 上月。
6. 查看服务项目排行。
7. 查看 `套餐额度暂未接入` 提示。
8. 查看知识库 / 智能随访 / 客户运营相关入口，如当前页面可用。
9. 强调：这是机构端低敏只读运营视图，不是财务账单，不展示内部模型、Token、provider 或成本。

注意：本轮未完成机构端 AI 服务使用入口和筛选控件的自动浏览器逐点击验收，该路径需人工或后续浏览器通道恢复后复验。

## 7. 当前可对内宣称

当前可以对内宣称：

1. 测试服正式域名可访问。
2. 测试服已同步到当前 main HEAD。
3. 平台端和机构端入口页面均返回 200。
4. 平台端 AI 用量只读 API 返回 200，聚合结构完整。
5. 机构端 AI 服务使用只读 API 返回 200，本月空态和上月数据态正常。
6. 关键平台端 / 机构端只读 API 可作为演示候选。
7. 当前系统具备测试服阶段演示路径草案。

## 8. 当前不可对外宣称

当前不可对外宣称：

1. 生产可直接上线。
2. 真实 HIS 已接通。
3. provider 真实调用已验收。
4. 真实财务账单 / 人民币成本核算。
5. 套餐扣减已完成。
6. 剩余额度真实可用。
7. 额度告警已完成。
8. 导出能力已完成。
9. 智能随访写入口径已补齐。
10. 自动随访统计已完成。
11. 所有业务场景均已 service project 归因。
12. 机构端可查看模型、Token、成本、provider 等内部信息。
13. 当前测试服等于生产环境。
14. 本轮已经完成全路径浏览器逐点击视觉验收。

## 9. 阻断项

本轮存在阻断项：

浏览器自动化通道在正式域名测试服上不稳定，内置浏览器和 Chrome 控制通道均出现导航 / DOM 读取超时，导致未完成平台端和机构端的完整逐点击视觉验收。

已完成的替代验收：

- 正式域名 HTTPS 可达。
- 测试服版本命中当前 main HEAD。
- 平台端和机构端页面 HTTP 200。
- 关键只读 API HTTP 200。
- 平台端 AI 用量聚合结构完整。
- 机构端 AI 服务使用本月空态 / 上月数据态 / 近 7 天筛选 API 正常。
- 字段级低敏边界检查未发现禁用敏感键。
- 未发现 RMB / 人民币 / `¥` / 真实成本。

仍需补验：

- 平台端 AI 用量六页签逐点击视觉验收。
- 机构端 AI 服务使用入口逐点击验收。
- 机构端本月 / 近 7 天 / 上月筛选控件逐点击验收。
- 页面级白屏 / 500 需人工或恢复浏览器通道后复核。

## 10. 下一阶段建议

建议下一步先完成：

`ZMTG-SYSTEM-STAGING-ACCEPTANCE-02：全系统测试服浏览器逐点击补验`

目标：

- 使用可稳定控制的浏览器或人工配合，补齐平台端和机构端逐点击视觉验收。
- 不开发新功能。
- 不执行 migration。
- 不调用 provider。
- 不写数据库。
- 不扩大到套餐权益、额度告警、导出或智能随访写入口径。

在该补验完成前，不建议把“全系统测试服阶段验收已完整完成”作为最终结论。

## 11. 本轮不包含

本轮不包含：

- 不改代码。
- 不改测试。
- 不改 DB / schema / migration。
- 不新增 API route。
- 不改 UI。
- 不执行 migration。
- 不执行 `db:seed`。
- 不写数据库。
- 不调用 provider。
- 不真实 AI smoke。
- 不部署生产。
- 不开始套餐权益、额度告警、导出、智能随访写入口径等新功能。
