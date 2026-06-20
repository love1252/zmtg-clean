# AI模型配置 PR-D 配置体验补齐验收报告

> 日期：2026-06-20 CST +0800
> 分支：`codex/old-ai-model-config-parity-01`
> 基线：`2499e2d291829155f55aab1ac178f68d23dfa30a`
> 范围：Logo 恢复默认、场景预设保存、保存全部配置反馈

## 一、任务边界

本阶段只补齐 AI模型配置栏目内的配置体验缺口：

- Logo 上传后支持恢复默认，并向配置持久化边界提交空引用。
- 场景预设从页面内临时效果升级为保存到配置边界。
- 保存全部配置成功后显示真实成功反馈，并提交当前模型启用状态。
- 保存失败时继续给出明确失败提示。

本阶段未执行：

- 未运行 migration。
- 未提交、未推送、未创建 PR。
- 未读取本地环境文件。
- 未接入生产配置。
- 未输出任何敏感配置值。

## 二、实现摘要

### 1. Logo 恢复默认

新增厂商 Logo 恢复默认入口：

- 已上传或已保存 Logo 时显示“恢复默认”。
- 点击后清除当前厂商 Logo 预览与文件名。
- 持久化 payload 中该厂商 `logoRef` 为 `null`。
- 成功反馈为“Logo 已恢复默认：厂商名”。
- 无自定义 Logo 时显示“默认 Logo”。

### 2. 场景预设保存

场景预设不再标记为页面内 dry-run：

- 点击“应用预设：智能随访/运营分析”后立即更新场景默认模型。
- 展示“场景预设保存中...”。
- 调用 AI模型配置持久化边界保存场景默认模型。
- 成功反馈为“场景预设已保存：预设名”。
- 持久化不可用时显示“场景预设保存失败：持久化服务不可用”。

### 3. 保存全部配置

保存全部配置的成功文案从旧 dry-run 状态改为真实配置保存反馈：

- 点击后显示“全部配置保存中...”。
- 成功后显示“全部配置已保存”。
- payload 包含当前业务场景默认模型、模型启用状态、厂商低敏状态和 Logo 引用状态。
- 失败时仍显示“全部配置保存失败：持久化服务不可用”。

## 三、测试覆盖

新增/更新组件测试覆盖：

- Logo 已保存时支持恢复默认并持久化空引用。
- 场景预设应用后自动保存到持久化边界。
- 保存全部配置成功时显示成功并提交当前模型启用状态。
- 旧的场景预设失败提示测试改为验证真实保存失败反馈。

## 四、验证命令

### 组件回归

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

结果：

- 1 个测试文件通过。
- 15/15 测试通过。

### AI模型配置相关回归

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：

- 4 个测试文件通过。
- 37/37 测试通过。

### ESLint

```bash
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts
```

结果：

- 0 问题。

### diff 空白检查

```bash
git diff --check
```

结果：

- 0 问题。

## 五、安全与边界确认

- 测试继续使用 mock 厂商外呼。
- 本阶段未增加真实外部调用。
- 页面不展示敏感配置原值。
- Logo 图片引用只进入配置持久化边界，不在页面文本中暴露。
- 厂商凭据草稿仍只保留在输入框受控状态中，不写入 AI模型配置持久化 payload。

## 六、剩余风险

- 刷新后恢复依赖 AI模型配置持久化表已在目标数据库存在；本阶段未运行 migration。
- 全局 typecheck 仍受既有非本栏目 `.next/dev/types` 问题影响，未作为本阶段通过条件。
- PR-E 仍需做最终安全、权限、审计、低敏回归验收收口。
