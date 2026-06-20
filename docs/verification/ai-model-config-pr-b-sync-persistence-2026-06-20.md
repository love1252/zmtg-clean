# AI模型配置 PR-B 同步结果持久化与刷新验收报告

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 阶段：PR-B，同步结果持久化并刷新页面模型列表  

## 验收范围

- 同步 route 在显式外呼开关开启且 mock 厂商返回成功时，将同步模型写入 AI模型配置快照。
- 配置快照通过既有 `providerStates` JSONB 扩展保存同步模型，不新增 schema，不运行 migration。
- 持久化服务读取快照时，将同步模型合并到对应厂商模型列表。
- 页面加载 GET 持久化配置后，不再只使用静态 mock providers，而是渲染服务端返回的 providers。
- 页面刷新后可以看到同步出来的新模型行。
- 保持安全边界：
  - 测试使用 mock fetch。
  - 默认 route 仍为 dry-run。
  - 不访问真实厂商 API。
  - 不读取或输出敏感配置。

## 变更文件

- `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
- `src/modules/open-platform/server/platformAiModelConfigPersistence.ts`
- `src/modules/open-platform/server/platformAiModelConfigPersistenceTypes.ts`
- `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`
- `src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts`
- `src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx`
- `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`

## 验证命令

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：33/33 通过。

```bash
pnpm exec eslint src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/server/platformAiModelConfigPersistenceTypes.ts src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：0 问题。

```bash
git diff --check
```

结果：0 问题。

## 已完成结论

PR-B 已完成“同步结果进入配置快照并刷新页面可见”的闭环。同步按钮不再只是返回一次性状态；当服务端受控同步拿到模型列表后，模型可以进入 AI模型配置持久化视图，并由前端在刷新后渲染出来。

## 未完成内容

以下内容属于后续 PR，不在 PR-B 范围内：

- PR-C：模型测试按钮从 dry-run 扩展为受控服务端真实测试闭环。
- PR-D：保存全部配置、Logo 恢复默认、场景预设真实保存等体验补齐。
- PR-E：最终安全、权限、审计、低敏回归验收。

## 风险与注意

- 当前真实外呼仍必须由服务端显式开关启用；默认 dry-run 不会访问厂商。
- 同步模型已能保存到快照，但同步后的场景默认模型选择能力将在后续体验补齐阶段继续完善。
- 全局 typecheck 仍受既有 `.next/dev/types` RouteContext 问题影响，本轮只验证 AI模型配置相关测试与 ESLint。
