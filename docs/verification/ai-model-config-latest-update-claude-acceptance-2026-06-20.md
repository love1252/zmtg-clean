# AI模型配置 最近更新总结与 Claude Code 验收清单

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> origin/main：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 目标接收人：Claude Code  
> 用途：对平台端 `AI模型配置` 栏目的近期更新做独立验收与复审。

## 一、任务边界

本轮最近更新围绕平台端 `AI模型配置` 栏目展开，目标是完成旧系统视觉结构还原后的真实功能闭环：页面可配置、按钮可解释、状态可持久化、厂商同步与测试策略符合官方边界，同时保持低敏展示与默认 dry-run。

本轮不是以下内容：

- 不提交代码。
- 不推送分支。
- 不创建 PR。
- 不读取本地环境文件。
- 不输出任何凭证、连接信息或密文内容。
- 不写 demo 数据。
- 不在测试环境真实访问厂商 API。

当前工作区存在 AI模型配置任务链相关 runtime、schema、test、verification 改动，尚未提交。

## 二、最近更新总览

| 更新项 | 当前状态 | 说明 |
| --- | --- | --- |
| 页面结构 | 已完成 | `AI模型配置` 菜单已挂载新 `AI模型` 页面，不再显示旧 quota 占位。 |
| 默认配置 | 已完成 | 支持业务场景默认模型、Agent 继承关系、场景预设、保存应用配置。 |
| 厂商配置 | 已完成 | 覆盖豆包、DeepSeek、通义千问、智谱GLM、Kimi 五家厂商。 |
| Key 输入体验 | 已完成 | 输入后保留低敏痕迹；显示/关闭显示只在当前会话范围内控制。 |
| Logo 配置 | 已完成 | 支持本地预览、保存引用、恢复默认。 |
| 模型启用 | 已完成 | 支持模型勾选启用，联动统计、能力分组、保存全部配置。 |
| 模型同步 | 已完成 | 按官方文档区分同步策略，默认 dry-run。 |
| 模型测试 | 已完成 | 按官方测试 endpoint 构造，默认 dry-run。 |
| 错误提示 | 已完成 | 厂商配置存储不可用时提示真实原因，不误报为单个厂商不可用。 |
| 数据库结构 | 已完成 | Supabase 项目内两张 AI模型配置所需表与索引已核对存在。 |
| 测试覆盖 | 已完成 | 相关 7 个测试文件、118 个测试通过。 |

## 三、关键功能变化

### 3.1 UI 与交互

- 顶部展示 `AI模型` 标题、说明文案和三张统计卡。
- `AI 应用默认配置` 默认收起，展开后展示业务场景默认模型与 Agent 继承关系。
- `模型厂商配置` 展示五家厂商，每家支持展开、Logo、Key、同步、能力分组、模型行。
- 能力分组包含深度思考、文本生成、视觉理解、向量模型。
- 模型行展示名称、启用状态、上下文、能力标签、说明、计费文案、测试按钮和启用勾选。

### 3.2 Key 输入与保存体验

- 输入新 Key 后，输入框保留低敏痕迹，避免用户误以为未填写。
- 当前会话内点击显示可查看本次输入内容，点击关闭显示恢复隐藏。
- 刷新后不反向解密或回显原文，只展示低敏配置状态。
- 保存 Key 成功后，AI模型配置页面只保存低敏状态。
- 如果存储边界不可用，页面提示“凭证存储不可用”。

### 3.3 厂商官方接入策略

| 厂商 | 模型同步策略 | 连通测试策略 |
| --- | --- | --- |
| DeepSeek | 使用官方模型列表接口 | 使用官方 Chat Completion 接口 |
| Kimi | 使用官方模型列表接口 | 使用官方 Chat Completion 接口 |
| 豆包 | 使用受控静态官方目录 | 使用火山方舟 Chat API 形态 |
| 通义千问 | 使用受控静态官方目录 | 使用 OpenAI 兼容 Chat 形态 |
| 智谱GLM | 使用受控静态官方目录 | 使用官方 Chat 形态 |

复审重点：不能再统一假设五家厂商都支持同一种 `/models` 路径。DeepSeek、Kimi 走官方模型列表；另外三家使用受控静态目录，后续如需接入管控面列表 API，需要单独审批。

### 3.4 Supabase 结构闭环

已在 Supabase 项目 `gvmklxettfipioetpgxl` 中完成只读核对与缺失结构补齐：

- `platform_ai_model_config_snapshots` 已存在。
- `platform_ai_provider_configs` 已创建。
- 两张表主键索引存在。
- 快照表更新时间索引存在。
- 厂商配置表 provider 索引存在。
- 厂商配置表更新时间索引存在。

执行说明：

- 只通过 Supabase MCP 应用缺失 DDL。
- 未写 demo 数据。
- 未读取本地环境文件。
- 未访问厂商 API。
- 未暴露任何凭证内容。

## 四、已验证证据

### 4.1 自动化测试

命令：

```bash
pnpm test src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/VendorProviderConfig.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

结果：

- 7 个测试文件通过。
- 118 个测试通过。

覆盖重点：

- 页面结构与旧占位移除。
- 五家厂商展示。
- Key 低敏输入、保存、显示/关闭显示。
- Logo 本地预览、保存引用、恢复默认。
- 场景默认模型、Agent 继承关系、场景预设。
- 模型启用状态保存与刷新恢复。
- 同步模型与测试连接默认 dry-run。
- 厂商官方 endpoint 策略。
- 响应与页面不展示敏感内容。

### 4.2 ESLint

命令：

```bash
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/domain/vendor-catalog.ts src/app/api/v1/open-platform/ai-model-config/route.ts src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/app/api/v1/open-platform/ai-model-config/test/route.ts src/app/api/v1/open-platform/provider-configs/route.ts src/server/db/schema.ts
```

结果：通过，0 输出。

### 4.3 空白检查

命令：

```bash
git diff --check
```

结果：通过，0 输出。

### 4.4 本地运行态只读接口

本机平台 demo 登录返回 200。

只读请求：

```bash
curl -sS -b /tmp/zmtg-ai-model-cookie.txt http://localhost:5010/api/v1/open-platform/provider-configs
```

结果：

```json
{"configs":[]}
```

结论：厂商配置存储边界已恢复可用。因为本轮不写 demo 数据，所以空列表符合预期。

只读请求 AI模型配置接口确认：

- `dataSource` 为持久化边界。
- `persistenceMode` 为数据库模式。
- `externalCallMode` 为关闭外呼模式。

## 五、Claude Code 建议验收步骤

### 5.1 启动检查

请先执行：

```bash
date '+%Y-%m-%d %Z %z'
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

期望：

- 日期为 2026-06-20 或实际执行当天。
- 分支为 `codex/old-ai-model-config-parity-01`。
- HEAD 与 origin/main 当前均为 `2499e2d291829155f55aab1ac178f68d23dfa30a`，除非后续已明确同步。
- 工作区改动应限定在 AI模型配置任务链文件和 verification 文档。

### 5.2 代码复审重点

请重点复审：

- `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`
- `src/modules/open-platform/server/platformAiModelVendorOperations.ts`
- `src/modules/open-platform/server/platformAiModelConfigPersistence.ts`
- `src/modules/open-platform/server/platformAiModelConfigPersistenceRepository.ts`
- `src/app/api/v1/open-platform/ai-model-config/route.ts`
- `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
- `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
- `src/app/api/v1/open-platform/provider-configs/route.ts`
- `src/modules/open-platform/domain/vendor-catalog.ts`
- `src/server/db/schema.ts`
- `drizzle/meta/_journal.json`
- `drizzle/0016_ai_provider_config_secure.sql`
- `drizzle/0017_ai_model_config_persistence.sql`

### 5.3 自动化复审命令

建议执行：

```bash
pnpm test src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/VendorProviderConfig.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

```bash
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/domain/vendor-catalog.ts src/app/api/v1/open-platform/ai-model-config/route.ts src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/app/api/v1/open-platform/ai-model-config/test/route.ts src/app/api/v1/open-platform/provider-configs/route.ts src/server/db/schema.ts
```

```bash
git diff --check
```

可选执行：

```bash
pnpm exec tsc --noEmit
```

已知风险：全局 typecheck 可能仍被 knowledge-management 的既有 Next 生成类型问题阻塞；该问题不属于 AI模型配置本轮改动。

### 5.4 浏览器人工验收

在 `http://localhost:5010/open-platform` 中验收：

- 点击 `AI模型配置` 后显示 `AI模型`。
- 不再出现 quota 旧占位。
- `AI 应用默认配置` 初始为收起态。
- 展开默认配置后，能看到业务场景默认模型和 Agent 继承关系。
- 五家厂商均存在。
- 厂商可独立展开和收起。
- Key 输入框输入后保留低敏痕迹。
- 显示/关闭显示按钮只影响当前会话显示状态。
- 刷新后不显示原文，只显示低敏已配置状态。
- Logo 上传后可预览并保存引用。
- 模型能力分组可展开收起。
- 模型启用勾选联动计数。
- 保存应用配置、保存全部配置按结果提示。
- 同步模型和测试连接默认表现为受控 dry-run，不触发真实厂商访问。

## 六、安全边界验收

Claude Code 复审时请确认：

- 页面不展示完整凭证内容。
- API 响应不携带完整凭证内容。
- 验证报告不记录凭证、连接信息或密文内容。
- 测试环境 sync/test route 默认不真实访问厂商。
- 只有显式开启外呼开关时，才允许走真实厂商 adapter。
- 保存 Key 的原始输入只进入服务端受控保存边界，不进入 AI模型配置快照。
- 刷新后页面不尝试反解原始 Key。

## 七、遗留风险

| 风险 | 级别 | 说明 | 建议 |
| --- | --- | --- | --- |
| 未写 demo 数据 | 低 | 本轮按用户要求不写 demo 数据，因此未用假 Key 做 POST 后刷新验收。 | 由用户用自己的厂商 Key 做人工保存与刷新验收。 |
| 远端迁移名称不完全一致 | 低 | Supabase 远端已有快照表的既有迁移记录，名称与本地 `0017` 不完全一致。 | 以表和索引存在性为准，PR 说明中标注。 |
| 豆包/通义/智谱模型同步为静态目录 | 中 | 官方未统一证明支持同类模型列表 endpoint，因此当前使用受控静态目录。 | 后续如接管控面 API，单独设计权限、认证和外呼边界。 |
| 全局 typecheck 外部阻塞 | 中 | 失败点在 knowledge-management 的既有 Next 生成类型文件。 | 单独开任务修复或在 PR 风险说明中声明。 |

## 八、结论

最近更新已把 `AI模型配置` 栏目从视觉还原推进到功能闭环：

- 页面结构完整。
- Key、Logo、场景、模型启用状态具备持久化边界。
- 五家厂商同步与测试策略已按官方差异校准。
- Supabase 缺失结构已补齐。
- 测试与静态检查通过。
- 默认不真实访问厂商 API。
- 低敏展示边界保持有效。

建议 Claude Code 复审结论重点判定：

1. 五家厂商官方接入策略是否合理。
2. Key 保存与显示/隐藏体验是否满足产品预期。
3. Supabase 表与索引是否可独立确认存在。
4. 页面刷新后低敏状态和模型状态是否可由用户真实验收。
5. 全局 typecheck 的既有外部阻塞是否需要纳入本 PR。
