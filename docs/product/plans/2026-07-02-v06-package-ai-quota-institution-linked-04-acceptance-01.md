# V0.6-PACKAGE-AI-QUOTA-INSTITUTION-LINKED-04-ACCEPTANCE-01：机构端 AI 服务额度 linked readonly 验收收口

## 1. 验收基线

- 验收日期 / 时区：2026-07-02 CST。
- 仓库：`love1252/zmtg-clean`。
- 本地路径：`/Users/dongxiaolong/Documents/zmtg-clean`。
- 验收 main commit：`743c2af0500db6f871d0c50ee1b434da0f2d3234`。
- 验收对象：机构端 `GET /api/institution/ai-service-usage` 与 `/hospital` 内 `AI 服务使用` 视图。
- 验收性质：linked readonly 验收收口，只记录结果，不开发新能力。

## 2. 本轮范围

本轮验收确认 LINKED-04 已完成的最小演进：

1. 既有机构端 AI 服务使用 API 返回 `quota.isLinked=true`。
2. quota 返回低敏只读字段：`status`、`periodStart`、`periodEnd`、`totalAllowance`、`used`、`remaining`、`usageRate`、`warningLevel`、`displayUnit`、`notes`。
3. `/hospital` 内 `AI 服务使用` 页面展示已用、剩余、使用率。
4. UI 文案明确当前为只读额度视图，不代表真实扣减，不代表财务账单。
5. over-limit 仅作为状态展示，不阻断、不扣减、不告警。

## 3. 本地 5010 验收结论

- 本地测试库 tunnel：`127.0.0.1:15432` 已恢复并可连接。
- 本地 5010：已使用既有 `zmtg-5010-testdb.sh` 启动。
- `GET http://127.0.0.1:5010/api/version` 返回当前 main commit：`743c2af0500db6f871d0c50ee1b434da0f2d3234`。
- 本地演示登录返回 200。
- `GET http://127.0.0.1:5010/api/institution/ai-service-usage` 返回 200。
- API 返回 `quota.isLinked=true`。
- API quota 字段完整，包含 linked readonly 所需字段。
- 本地 `/hospital` 可打开。
- 点击 `AI 服务使用` 入口后，页面展示：
  - `只读额度视图`
  - `已用`
  - `剩余`
  - `使用率`
  - `不代表真实扣减`
  - `不代表财务账单`
- 本地页面无白屏、无 500。
- 本地页面和 API 未发现敏感字段泄露。

## 4. 测试服验收结论

- 测试服正式入口：`https://www.129ai.com/hospital`。
- 验收前测试服版本落后，已使用项目既有 `scripts/deploy-test-server.mjs` 同步测试服到当前 main。
- 未部署生产。
- 未执行 migration。
- 未执行 db:seed。
- 未写入业务数据。
- 未调用 provider。
- 未执行真实 AI smoke。
- `GET https://www.129ai.com/api/version` 返回当前 main commit：`743c2af0500db6f871d0c50ee1b434da0f2d3234`。
- `HEAD https://www.129ai.com/hospital` 返回 200。
- 测试服演示登录返回 200。
- `GET https://www.129ai.com/api/institution/ai-service-usage` 返回 200。
- API 返回 `quota.isLinked=true`。
- API quota 字段完整，包含 linked readonly 所需字段。
- 点击测试服 `/hospital` 内 `AI 服务使用` 入口后，页面展示 linked readonly 额度视图。
- 测试服页面展示已用、剩余、使用率。
- 测试服 UI 文案明确不代表真实扣减、不代表财务账单。
- 测试服页面无白屏、无 500。
- 测试服页面和 API 未发现敏感字段泄露。

## 5. 命令与结果

- 定向测试：
  - `node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionAiServiceUsageService.test.ts src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts src/modules/institution/tests/PackageAiQuotaContract.test.ts`
  - 结果：3 files / 22 tests passed。
- 完整 Vitest：
  - `node scripts/run-vitest.mjs run`
  - 结果：206 files / 2048 tests passed。
- ESLint：
  - `./node_modules/.bin/eslint .`
  - 结果：0 errors，仅既有 4 个 `<img>` warnings。
- Build：
  - `node scripts/run-next.mjs build --webpack`
  - 结果：passed。
- git diff check：
  - `git diff --check`
  - 结果：passed。

## 6. API 结果摘要

本地与测试服 API 均确认：

- 登录态下 `GET /api/institution/ai-service-usage` 返回 200。
- `quota.isLinked=true`。
- `quota` 包含：
  - `displayUnit`
  - `isLinked`
  - `notes`
  - `periodEnd`
  - `periodStart`
  - `remaining`
  - `status`
  - `totalAllowance`
  - `usageRate`
  - `used`
  - `warningLevel`
- 当前验收数据下 `serviceProjects` 可为空数组，quota linked readonly 仍正常展示。
- API 未返回真实扣减动作、额度告警动作或导出能力字段。

## 7. 页面结果摘要

本地与测试服页面均确认：

- `/hospital` 可打开。
- `AI 服务使用` 入口可点击。
- 点击入口后进入 AI 服务使用视图。
- 页面展示 linked readonly quota 文案和指标。
- 页面展示已用、剩余、使用率。
- 页面明确当前为只读额度视图。
- 页面明确不代表真实扣减。
- 页面明确不代表财务账单。
- 页面无白屏、无 500。

## 8. 敏感字段排查结果

本地与测试服 API / 页面均未发现以下内容：

- `Token`
- `totalTokens`
- `provider`
- `model`
- `RMB`
- `¥`
- 真实成本
- `prompt`
- `answer`
- `rawResponse`
- `metadata`
- `meteringDetails`
- `apiKey`
- `baseUrl`
- `credential`
- 客户手机号
- 客户身份证
- 病历详情

## 9. 明确未做

本轮验收未做以下事项：

- 未修改产品代码。
- 未修改测试。
- 未新增 API route。
- 未接真实 DB quota。
- 未修改 DB/schema/migration。
- 未执行 migration。
- 未执行 db:seed。
- 未写入业务数据。
- 未做真实额度扣减。
- 未做额度告警。
- 未做导出。
- 未调用 provider。
- 未做真实 AI smoke。
- 未部署生产。

## 10. 结论

V0.6-PACKAGE-AI-QUOTA-INSTITUTION-LINKED-04 的机构端 AI 服务额度 linked readonly 本地与测试服验收通过。当前可锁定为 mock/fixture-based linked readonly 阶段完成。

后续如继续推进，应单独授权和设计真实套餐权益数据接入、真实扣减、额度告警、导出和生产上线验收，不能从本轮验收结论直接外推。
