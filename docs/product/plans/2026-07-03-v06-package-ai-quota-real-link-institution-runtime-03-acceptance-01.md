# V0.6-PACKAGE-AI-QUOTA-REAL-LINK-INSTITUTION-RUNTIME-03-ACCEPTANCE-01：机构端 runtime 顶层 quota readonly source facade 验收收口

## 1. 验收基线

- 验收日期 / 时区：2026-07-03 CST。
- main / origin/main：`7861597359112cc5bec8cb90531a48f47aff35b1`。
- 来源 PR：#432，`V0.6-PACKAGE-AI-QUOTA-REAL-LINK-INSTITUTION-RUNTIME-03`。
- 验收性质：acceptance-only / docs-only / no code。
- 验收对象：
  - 本地：`http://127.0.0.1:5010/hospital`。
  - 测试服：`https://www.129ai.com/hospital`。
  - API：`GET /api/institution/ai-service-usage`。

## 2. 本轮验收目标

本轮只验证 PR #432 合并后的机构端 AI 服务使用 runtime 顶层 `quota` 是否已通过 readonly source facade 接入，并确认本地 5010 与测试服正式域名均保持低敏、只读、无误导的展示状态。

本轮不验证真实 DB quota、不验证真实套餐绑定读取、不验证真实额度扣减、不验证额度告警、不验证导出。

## 3. 本地测试命令与结果

- 定向测试：
  - 命令：`node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionAiServiceUsageService.test.ts src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts src/modules/institution/tests/PackageAiQuotaReadonlySource.test.ts`
  - 结果：3 files / 29 tests passed。
- 机构端测试：
  - 命令：`node scripts/run-vitest.mjs run src/modules/institution/tests`
  - 结果：67 files / 1011 tests passed。
- 完整 Vitest：
  - 命令：`node scripts/run-vitest.mjs run`
  - 结果：207 files / 2069 tests passed。
- ESLint：
  - 命令：`./node_modules/.bin/eslint .`
  - 结果：0 errors，仅既有 4 个 `<img>` warnings。
- Build：
  - 命令：`node scripts/run-next.mjs build --webpack`
  - 结果：通过；仅出现既有 `metadataBase` warning。
- diff check：
  - 命令：`git diff --check`
  - 结果：通过。

## 4. 本地 5010 验收结果

- 本地 5010 启动方式：`/Users/dongxiaolong/Documents/Codex/scripts/zmtg-5010-testdb.sh`。
- 本地测试库 tunnel：已恢复 `15432:127.0.0.1:5432 -> root@43.142.91.19`，仅用于本地验收连接，不执行写操作。
- `/api/version`：
  - 返回 commit：`7861597359112cc5bec8cb90531a48f47aff35b1`。
- `GET /api/institution/ai-service-usage`：
  - 登录后返回 200。
  - 顶层 `quota.isLinked=true`。
  - 顶层 `quota` 字段严格为低敏白名单：
    - `isLinked`
    - `status`
    - `periodStart`
    - `periodEnd`
    - `totalAllowance`
    - `used`
    - `remaining`
    - `usageRate`
    - `warningLevel`
    - `displayUnit`
    - `notes`
  - `serviceProjects` 返回数组结构。
  - 未发现敏感字段命中。
- `/hospital`：
  - 页面可打开。
  - `AI 服务使用` 入口可点击。
  - 页面展示 `已用`、`剩余`、`使用率`。
  - 页面展示 `只读额度视图`。
  - 页面文案明确：`不代表真实扣减`、`不代表财务账单`。
  - 无白屏、无 500。

## 5. 测试服版本同步情况

- 验收前 `https://www.129ai.com/api/version` 返回旧版本 `743c2af0500db6f871d0c50ee1b434da0f2d3234`。
- 已使用项目既有脚本同步测试服：
  - 命令：`node scripts/deploy-test-server.mjs`
  - 部署 commit：`7861597359112cc5bec8cb90531a48f47aff35b1`
  - 远程 build：通过。
  - PM2 测试服服务：已重启。
  - 脚本内本机版本验证：命中 `7861597359112cc5bec8cb90531a48f47aff35b1`。
  - 脚本内公网版本验证：命中 `7861597359112cc5bec8cb90531a48f47aff35b1`。
- 同步范围：仅测试服。
- 未执行 migration、未执行 db:seed、未写业务数据、未部署生产。

## 6. 测试服 API 验收结果

- `https://www.129ai.com/api/version`：
  - 返回 commit：`7861597359112cc5bec8cb90531a48f47aff35b1`。
- `GET https://www.129ai.com/api/institution/ai-service-usage`：
  - 登录后返回 200。
  - 顶层 `quota.isLinked=true`。
  - 顶层 `quota` 字段严格为低敏白名单：
    - `isLinked`
    - `status`
    - `periodStart`
    - `periodEnd`
    - `totalAllowance`
    - `used`
    - `remaining`
    - `usageRate`
    - `warningLevel`
    - `displayUnit`
    - `notes`
  - `serviceProjects` 返回数组结构。
  - 未发现敏感字段命中。

## 7. 测试服 `/hospital` 页面验收结果

- `https://www.129ai.com/hospital` 可打开。
- 机构端登录返回 200。
- `AI 服务使用` 入口可点击。
- 页面展示 `已用`、`剩余`、`使用率`。
- 页面展示 `只读额度视图`。
- 页面文案明确：`不代表真实扣减`、`不代表财务账单`。
- 页面说明超出额度仅显示状态，不阻断服务、不触发扣减或告警。
- 无白屏、无 500。
- 未发现敏感字段命中。

## 8. 顶层 quota readonly source facade 接入验收结论

- 本地 5010 和测试服均确认顶层 `quota.isLinked=true`。
- 顶层 `quota` 字段保持机构端低敏白名单。
- 页面展示的额度信息为只读额度视图。
- fallback / source 不可用时的 `isLinked=false` 兼容已由 PR #432 测试覆盖，本轮不额外修改代码。

## 9. serviceProjects quota map 边界

本轮只验证 PR #432 的顶层 `response.quota` runtime 来源已接入 readonly source facade。

`serviceProjects` quota map 仍保持既有 fixture / attribution 口径，不宣称已完成真实 source 化，不宣称已接真实 DB，不宣称已接真实套餐绑定或真实额度扣减。

## 10. 敏感字段排查结果

本地 API、本地页面、测试服 API、测试服页面均未发现以下字段或文案命中：

- `Token`
- `totalTokens`
- `provider`
- `model`
- `RMB`
- `¥`
- `真实成本`
- `prompt`
- `answer`
- `rawResponse`
- `metadata`
- `meteringDetails`
- `apiKey`
- `baseUrl`
- `credential`
- `客户手机号`
- `客户身份证`
- `病历详情`

## 11. 明确未做事项

- 未修改产品代码。
- 未修改测试代码。
- 未新增 API route。
- 未改 API URL。
- 未改 UI / page / component。
- 未接真实 DB。
- 未改 DB/schema/migration。
- 未执行 migration。
- 未执行 db:seed。
- 未写真实业务数据。
- 未调用 provider。
- 未做真实 AI smoke。
- 未做真实额度扣减。
- 未做额度告警。
- 未做导出。
- 未部署生产。
- 未把 readonly source facade 误写成真实 DB 接入完成。

## 12. 风险边界

- 当前仍不是真实 DB quota。
- 当前仍不是真实套餐绑定读取。
- 当前 `remaining` 不等同于真实可用余额。
- 当前 `overLimit` / `warningLevel` 不等同于真实阻断或真实告警。
- 当前不构成真实财务账单。
- 当前不构成生产直接上线结论。
