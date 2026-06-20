# AI模型配置 Draft PR 准备包

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> origin/main：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 状态：提交前准备，不提交、不推送、不创建 PR。

## 一、PR 标题建议

```text
feat(open-platform): restore AI model configuration console
```

## 二、Summary

- 还原平台端 `AI模型配置` 栏目，替换原 quota 占位页，补齐旧系统视觉结构、应用默认配置、厂商配置、能力分组和模型行交互。
- 新增 AI模型配置持久化边界、厂商配置低敏状态、受控同步/测试 route、厂商官方接入策略和默认 dry-run 外呼保护。
- 补齐 Supabase/Drizzle 表结构候选、访问控制边界、低敏 DTO 校验和 Claude Code 验收反馈整改。

## 三、变更范围

### UI / 页面

- `src/modules/workspace/components/PlatformConsole.tsx`
  - `AI模型配置` 菜单挂载 `OpenPlatformAiModelConfigPanel`。
  - AI模型配置与 AI用量页面共用浅色平台布局。
- `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`
  - 顶部统计卡、应用默认配置、五家厂商配置、Logo、Key 低敏输入、同步/测试、模型启用、保存全部配置。

### 数据与服务端

- `src/modules/open-platform/mock/platformAiModelConfig.ts`
  - 受控 mock/contract 基线数据。
- `src/modules/open-platform/server/platformAiModelConfigContract.ts`
  - 页面 DTO 与低敏 contract。
- `src/modules/open-platform/server/platformAiModelConfigPersistence*.ts`
  - 快照持久化、输入校验、低敏响应、repository。
- `src/modules/open-platform/server/platformAiModelVendorOperations.ts`
  - 五家厂商同步/测试策略，默认 dry-run，真实外呼仅显式开启后可走。
- `src/app/api/v1/open-platform/ai-model-config/**`
  - 配置 GET/PUT、同步、测试 route。

### 厂商配置与安全

- `src/modules/open-platform/domain/vendor-catalog.ts`
  - Kimi Base URL 校准，厂商类型从运行时 catalog key 推导。
- `src/modules/security/domain/access-control.ts`
  - 新增 `ai_model_config` 权限资源。
- `src/modules/security/tests/AccessControlDomain.test.ts`
  - 平台管理员、运营、审计和租户端边界测试。

### 数据库候选

- `src/server/db/schema.ts`
  - 新增 AI模型配置快照表、厂商配置表 schema。
- `drizzle/0017_ai_model_config_persistence.sql`
  - 快照表 DDL 候选。
- `drizzle/meta/_journal.json`
  - 登记 0016/0017 migration 序列。

### 测试与验收文档

- 新增 AI模型配置 contract、panel、persistence、vendor operations 测试。
- 新增多份 `docs/verification/ai-model-config-*.md` 验收、复审和整改报告。

## 四、Test Plan

已执行：

```bash
pnpm test src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/VendorProviderConfig.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

结果：

- 7 个测试文件通过。
- 122 个测试通过。

已执行：

```bash
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/server/platformAiModelConfigPersistence.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/domain/vendor-catalog.ts src/app/api/v1/open-platform/ai-model-config/route.ts src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/app/api/v1/open-platform/ai-model-config/test/route.ts src/app/api/v1/open-platform/provider-configs/route.ts src/server/db/schema.ts src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：0 问题。

已执行：

```bash
git diff --check
```

结果：0 问题。

可选执行：

```bash
pnpm exec tsc --noEmit
```

结果：失败点仍为 knowledge-management 的既有 Next 生成类型问题，与 AI模型配置改动无关。

补充扫描：

- 对当前改动文件执行高风险凭证形态扫描。
- 扫描文件数：37。
- 高风险形态命中：0。

## 五、文件归属审计

本轮工作区文件均可归入 AI模型配置任务链，没有发现随机临时文件。

| 类别 | 文件/目录 | 归属判断 |
| --- | --- | --- |
| 菜单挂载 | `src/modules/workspace/components/PlatformConsole.tsx` | 属于本任务：将 `AI模型配置` 从旧占位切换到新面板，并复用浅色平台布局。 |
| 权限边界 | `src/modules/security/domain/access-control.ts`、`src/modules/security/tests/AccessControlDomain.test.ts` | 属于本任务：新增 `ai_model_config` 平台权限资源，限制写入、凭证管理和连通测试能力。 |
| 页面与交互 | `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx` | 属于本任务：AI模型配置栏目主体。 |
| API / service / repository | `src/app/api/v1/open-platform/ai-model-config/**`、`src/modules/open-platform/server/platformAiModelConfig*`、`platformAiModelVendorOperations.ts` | 属于本任务：配置持久化、同步、测试和厂商策略。 |
| mock / contract | `src/modules/open-platform/mock/platformAiModelConfig.ts`、`platformAiModelConfigContract.ts` | 属于本任务：受控低敏数据结构与 DTO。 |
| schema / migration | `src/server/db/schema.ts`、`drizzle/0017_ai_model_config_persistence.sql`、`drizzle/meta/_journal.json` | 属于本任务：AI模型配置持久化表结构候选与 migration 序列。 |
| 测试 | `src/modules/open-platform/tests/OpenPlatformAiModelConfig*.test.tsx?`、`VendorCatalog.test.ts`、`VendorProviderConfig.test.ts`、`Schema.test.ts` | 属于本任务：页面、服务端、安全、schema 和厂商接入回归。 |
| 验收文档 | `docs/verification/ai-model-config-*.md` | 属于本任务：Codex/Claude 验收、复审、整改和 PR 准备记录。 |

## 六、Security Boundary

- 页面只展示低敏 Key 状态，不展示原始 Key。
- 保存 Key 的原始输入只进入服务端受控保存边界，不进入 AI模型配置快照。
- 刷新后不反解原始 Key。
- 同步模型和测试连接默认 dry-run，不真实访问厂商。
- 真实厂商 adapter 只有显式开启服务端开关时才会被 route 注入。
- AI模型配置快照校验拒绝凭证形态文本、本地连接标识和旧系统敏感痕迹。
- 本轮未读取本地环境文件，未输出凭证或连接信息。

## 七、Migration / Supabase Note

- 本 PR 包含 schema 与 migration 候选，不在 PR 准备阶段运行 migration。
- Supabase 项目 `gvmklxettfipioetpgxl` 已在用户批准下通过 MCP 补齐缺失的厂商配置表；快照表此前已存在。
- MCP 操作只创建 AI模型配置所需表和索引，不写 demo 数据。
- 远端快照表已有既有迁移记录，名称与本地 `0017` 文件名不完全一致；复核以表和索引存在性为准。

## 八、Known Issues

- 全局 typecheck 仍被 knowledge-management 的既有 Next 生成类型问题阻塞，不属于本 PR 的 AI模型配置改动。
- 豆包、通义千问、智谱GLM 当前同步模型使用受控静态目录。后续如要接入各自管控面模型列表 API，需要单独审批外呼、认证和权限边界。
- 本轮按边界不写 demo 数据；真实厂商 Key 保存后的人工刷新验收需要用户用自己的凭证执行。

## 九、Rollback

如需回滚本 PR，可按以下顺序处理：

1. `PlatformConsole` 中将 `AI模型配置` 菜单挂载从 `OpenPlatformAiModelConfigPanel` 回退到旧占位面板。
2. 移除 `/api/v1/open-platform/ai-model-config` 下新增 route。
3. 停用 `platformAiModelConfigPersistence` 与 `platformAiModelVendorOperations` 调用路径。
4. 撤回 `ai_model_config` 权限资源及相关测试。
5. 如 schema 尚未应用到目标环境，直接移除本地 schema/migration 候选；如已应用，需另行审批数据库回滚脚本。
6. 保留或归档 `docs/verification` 中的验收报告作为审计记录。

## 十、建议提交拆分

推荐 3 个 commit：

```text
feat(open-platform): restore AI model configuration panel
feat(open-platform): add AI model config persistence and vendor operations
test(open-platform): cover AI model config safety and review fixes
```

也可以合并为一个 commit：

```text
feat(open-platform): restore AI model configuration console
```

## 十一、提交前结论

当前分支已具备 draft PR 准备条件，但仍需用户明确批准后才能执行：

- `git add`
- `git commit`
- `git push`
- 创建 draft PR
