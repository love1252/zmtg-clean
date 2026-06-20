# AI模型配置 栏目功能与按钮验收报告

> 日期：2026-06-20 CST +0800
> 分支：`codex/old-ai-model-config-parity-01`
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`
> 验收人：Codex
> 用途：给 Claude Code 做二次审评

---

## 一、验收目标

对平台端 `AI模型配置` 栏目内的界面按钮、状态展示、受控 API、Supabase 持久化、安全边界和默认 dry-run 行为做一次整体验收。重点确认：

- 页面已经替换为 `AI模型` 栏目，不再展示 `AI 配额边界 / Quota Denied` 占位。
- `AI 应用默认配置`、`模型厂商配置`、5 家厂商、能力分组、模型行和按钮状态完整。
- Logo、业务场景默认模型、模型启用状态、Key 低敏状态、dry-run 结果能通过 Supabase 保存并刷新读回。
- sync/test route 默认不真实外呼厂商。
- 页面、DTO、测试输出不展示 Key 原文、连接串或敏感字段。

---

## 二、启动检查

| 项目 | 结果 |
| --- | --- |
| 日期 | 2026-06-20 CST +0800 |
| 分支 | `codex/old-ai-model-config-parity-01` |
| HEAD | `2499e2d291829155f55aab1ac178f68d23dfa30a` |
| origin/main | `2499e2d291829155f55aab1ac178f68d23dfa30a` |
| 工作区 | 当前 AI模型配置任务链改动 + `docs/verification/` 报告文件 |
| 禁止项 | 未读取 `.env` / `.env.local`；未输出连接串、Key 或凭证；未提交、未推送、未创建 PR |

---

## 三、按钮与功能入口清单

### 3.1 AI 应用默认配置

| 入口 | 当前行为 | 验收状态 |
| --- | --- | --- |
| `场景预设` | 展开 / 收起预设面板 | 通过 |
| `应用预设：智能随访` | 当前页面应用智能随访预设，更新对应场景模型 | 通过 |
| `应用预设：运营分析` | 当前页面应用运营分析预设，更新对应场景模型 | 通过 |
| 业务场景默认模型下拉 | 只展示已启用且能力匹配模型；选择后更新当前状态 | 通过 |
| `保存应用配置` | 先显示保存中；等待持久化结果后显示成功或失败 | 通过 |
| Agent 继承关系 | 展示 Agent 继承场景和继承模型 | 通过 |

### 3.2 模型厂商配置

| 入口 | 当前行为 | 验收状态 |
| --- | --- | --- |
| `保存全部配置` | 保存场景、模型启用、厂商状态和 dry-run 结果；等待结果后提示 | 通过 |
| 厂商折叠按钮 | 5 家厂商可独立展开 / 收起：豆包、DeepSeek、通义千问、智谱GLM、Kimi | 通过 |
| `上传 Logo` | PNG/JPG/WebP 且 150KB 内可上传；成功后图标变为图片并保存引用 | 通过 |
| `显示 / 关闭显示` | API Key 输入框在隐藏和显示之间切换 | 通过 |
| `保存 Key` | 保存到厂商凭证边界；AI模型配置侧只保存低敏状态 | 通过 |
| `同步模型` | 调用本系统 sync route；默认 dry-run adapter，不真实外呼厂商 | 通过 |
| 能力分组按钮 | 深度思考、文本生成、视觉理解、向量模型可独立展开 / 收起 | 通过 |
| 模型 `测试` 按钮 | 调用本系统 test route；默认 dry-run adapter，不真实外呼厂商 | 通过 |
| 模型启用勾选 | 可切换启用状态，并联动厂商 / 能力分组计数 | 通过 |

---

## 四、Supabase 持久化验收

Supabase 项目：`zmtg-clean-dev`

| 检查项 | 结果 |
| --- | --- |
| 表存在 | `platform_ai_model_config_snapshots` 存在 |
| migration 记录 | `ai_model_config_persistence` 已存在 |
| 本地 API 登录 | 平台演示账号登录成功 |
| 本地 API 写入 | `PUT /api/v1/open-platform/ai-model-config` 返回 200 |
| 本地 API 读回 | `GET /api/v1/open-platform/ai-model-config` 返回 200 |
| Supabase 快照摘要 | provider state 5、model state 25、scenario 8、dry-run 1 |

本次写入的是低敏验收状态，不包含真实 Key 或连接串。刷新式读回断言如下：

| 断言 | 结果 |
| --- | --- |
| `dataSource` / `persistenceMode` 为持久化边界 | 通过 |
| `updatedAt` 存在 | 通过 |
| Logo 引用可读回 | 通过 |
| Key 只读回低敏状态 `Key 已配置 ****2468` | 通过 |
| `analytics-insight` 默认模型读回为 `glm-5.1` | 通过 |
| `qwen-plus-latest` 停用状态读回 | 通过 |
| `glm-5.1` 启用状态读回 | 通过 |
| `codex-functional-report-check` dry-run 结果读回 | 通过 |
| 响应不包含敏感片段 | 通过 |

---

## 五、自动化测试结果

命令：

```bash
pnpm test src/server/db/tests/Schema.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts \
  src/modules/open-platform/tests/VendorProviderConfig.test.ts
```

结果：6 个测试文件、99 个测试全部通过。

覆盖重点：

- AI模型配置页面结构与旧占位移除。
- 5 家厂商展示、厂商折叠、能力分组折叠。
- Logo 上传成功 / 失败提示。
- Key 输入、显示 / 隐藏、保存、低敏状态。
- 应用配置 / 全部配置保存成功与失败提示。
- sync/test route 默认 dry-run，不真实外呼厂商。
- 真实外呼只在显式开启开关时才允许走 default adapter。
- DTO / 页面不展示敏感字段。
- schema 和 migration 文件存在性。

---

## 六、静态检查结果

命令：

```bash
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx \
  src/modules/open-platform/server/platformAiModelConfigPersistence.ts \
  src/modules/open-platform/server/platformAiModelVendorOperations.ts \
  src/app/api/v1/open-platform/ai-model-config/route.ts \
  src/app/api/v1/open-platform/ai-model-config/sync/route.ts \
  src/app/api/v1/open-platform/ai-model-config/test/route.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：通过，0 问题。

命令：

```bash
git diff --check
```

结果：通过，0 问题。

---

## 七、安全边界

| 边界 | 验收结果 |
| --- | --- |
| 不读取 `.env` / `.env.local` | 通过 |
| 不输出数据库连接串 | 通过 |
| 页面不展示 Key 原文 | 通过 |
| AI模型配置持久化表不保存 Key 原文 | 通过 |
| Key 原文只允许进入厂商凭证保存边界 | 通过 |
| sync/test 默认不真实外呼厂商 | 通过 |
| 未授权 / 租户端 / 只读角色受权限边界限制 | 自动化测试覆盖 |
| DTO 不包含敏感字段片段 | 自动化测试覆盖 |

---

## 八、剩余问题与建议

### P1：全局 typecheck 仍有既有 `.next/dev/types` 问题

命令：

```bash
pnpm typecheck
```

结果：失败，错误位置在：

```text
.next/dev/types/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts
```

错误类型：`FilesRouteContext.params` 与 Next 生成的 `RouteContext` 约束不匹配。

判断：这不是 AI模型配置栏目改动引入的问题，但如果 PR 检查包含 `pnpm typecheck`，会阻断合并。建议单独修复或在 PR 风险说明中明确。

### P3：Logo input 重复选择同一文件不会触发 `onChange`

现状：文件 input 选择同一文件时浏览器可能不触发 change。

影响：低。用户可以选择不同文件，或刷新后再选同一文件。

建议：后续可用 input ref 在处理完成后清空 `event.currentTarget.value`。

---

## 九、结论

`AI模型配置` 栏目内的主要按钮和功能逻辑已通过当前验收：

- 页面结构正确。
- 按钮交互完整。
- Supabase 持久化可用。
- Logo / 场景默认模型 / 模型启用 / Key 低敏状态 / dry-run 结果可刷新恢复。
- sync/test 默认 dry-run，不真实外呼厂商。
- 安全边界未发现敏感信息展示问题。

建议 Claude Code 审评重点：

1. 复核本报告的功能覆盖是否遗漏按钮或状态。
2. 复核 sync/test route 默认 dry-run 是否符合 PR10 最终边界。
3. 判断 `pnpm typecheck` 的既有 `.next/dev/types` 问题是否需要纳入本 PR 修复。
4. 判断 Logo input 重复选择同一文件问题是否需要顺手修。
