# AI模型配置 PR-C 模型测试受控执行验收报告

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 阶段：PR-C，模型测试服务端受控执行闭环  

## 验收范围

- 模型测试 route 默认仍使用 dry-run adapter，不访问真实或注入厂商域名。
- 只有显式开启服务端外呼开关时，测试 route 才通过注入 adapter 执行模型连通测试。
- 测试 route 覆盖以下低敏状态：
  - 成功
  - 未配置厂商 Key
  - 厂商不可用
  - 限流
  - 超时
- 显式开启外呼且测试成功后，将模型测试结果写入 AI模型配置快照。
- 持久化内容只保存低敏 `model_test` 结果：
  - `targetType`
  - `targetId`
  - `status`
  - `message`
- 不保存厂商响应正文，不保存 Key，不保存密文字段。

## 变更文件

- `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
- `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`

## 验证命令

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：34/34 通过。

```bash
pnpm exec eslint src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/app/api/v1/open-platform/ai-model-config/test/route.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：0 问题。

```bash
git diff --check
```

结果：0 问题。

## 已完成结论

PR-C 已完成模型测试受控服务端闭环。测试按钮对应的服务端 route 仍默认 dry-run；显式开关开启后，测试通过注入 adapter 执行，并将低敏测试结果写入 AI模型配置快照，便于后续审计和页面状态追踪。

## 未完成内容

以下内容属于后续 PR，不在 PR-C 范围内：

- PR-D：保存全部配置、Logo 恢复默认、场景预设真实保存等体验补齐。
- PR-E：最终安全、权限、审计、低敏回归验收。

## 风险与注意

- 当前测试结果持久化仅记录低敏状态和文案，不记录厂商响应详情。
- 默认环境不会访问真实厂商 API。
- 全局 typecheck 仍受既有 `.next/dev/types` RouteContext 问题影响，本轮只验证 AI模型配置相关测试与 ESLint。
