# AI模型配置 厂商官方接入策略修复验证报告

> 分支：`codex/old-ai-model-config-parity-01`  
> 日期：2026-06-20 CST +0800  
> 目标：校准豆包、DeepSeek、通义千问、智谱GLM、Kimi 的模型同步与连通测试策略，保持低敏边界，供 Claude Code 复审。

## 一、启动与边界

- 当前阶段：AI模型配置 厂商接入闭环修复。
- 本次不是提交、推送、创建 PR、读取 `.env` / `.env.local`。
- 用户已批准通过 Supabase MCP 在项目 `gvmklxettfipioetpgxl` 上应用 AI模型配置所需 DDL；本次只创建缺失表和索引，不写 demo 数据。
- 本次没有真实外呼厂商 API；测试环境仍通过 mock / dry-run 覆盖。
- 启动检查：
  - 日期：`2026-06-20 CST +0800`
  - 分支：`codex/old-ai-model-config-parity-01`
  - HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`
  - origin/main：`2499e2d291829155f55aab1ac178f68d23dfa30a`
  - 工作区存在当前 AI模型配置任务相关 runtime / schema / test / verification 改动，未提交。

## 二、官方文档对照结论

| 厂商 | 同步模型策略 | 连通测试策略 | 官方依据 |
| --- | --- | --- | --- |
| DeepSeek | 使用官方 `GET /models` | 使用 `POST /chat/completions` | DeepSeek 文档明确提供模型列表接口和 Chat Completion 接口：https://api-docs.deepseek.com/api/list-models、https://api-docs.deepseek.com/api/create-chat-completion |
| Kimi | 使用官方 `GET /v1/models` | 使用 `POST /v1/chat/completions` | Kimi 文档明确提供模型列表接口和 Chat Completion 接口：https://platform.kimi.ai/docs/api/list-models、https://platform.kimi.ai/docs/api/chat |
| 通义千问 | 使用受控静态官方目录 | 使用 OpenAI 兼容 `POST /chat/completions` | 阿里云百炼文档明确 OpenAI 兼容 Base URL 与 Chat endpoint，并指向“支持的模型列表”，未把兼容模式证明为统一 `GET /models`：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope |
| 智谱GLM | 使用受控静态官方目录 | 使用 `POST /api/paas/v4/chat/completions` | 智谱文档明确 Chat endpoint 与可用模型枚举，未证明统一 `GET /models`：https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8 |
| 豆包 | 使用受控静态官方目录 | 使用火山方舟 Chat API | 火山方舟文档将 Chat API、模型列表、管控面 API 分开呈现，不能继续假设推理 Base URL 下存在统一 `GET /models`：https://www.volcengine.com/docs/82379/1494384?lang=zh、https://www.volcengine.com/docs/82379/1330310?lang=zh |

## 三、代码修复摘要

- `src/modules/open-platform/domain/vendor-catalog.ts`
  - Kimi 默认 Base URL 从 `api.moonshot.cn` 校准为官方 `api.moonshot.ai`。
- `src/modules/open-platform/server/platformAiModelVendorOperations.ts`
  - 新增厂商同步策略：
    - DeepSeek、Kimi：`official_models_api`
    - 豆包、通义千问、智谱GLM：`static_official_catalog`
  - 豆包、通义千问、智谱GLM 同步模型时不再请求 `/{baseUrl}/models`，直接返回受控静态目录。
  - DeepSeek 默认 Base URL 为 `/v1` 时，模型列表请求仍使用官方 `https://api.deepseek.com/models`。
  - 连通测试仍统一走各厂商官方 OpenAI 兼容 Chat endpoint，并且测试环境默认 dry-run。
- `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`
  - 保存厂商 Key 时，如果后端返回 `PROVIDER_CONFIG_UNAVAILABLE`，前端提示改为“凭证存储不可用”，不再误导为某个厂商服务不可用。
- 测试更新：
  - 覆盖 DeepSeek / Kimi 官方模型列表 endpoint。
  - 覆盖豆包 / 通义千问 / 智谱GLM 同步不调用 `/models`。
  - 覆盖五家厂商 Chat endpoint 构造。
  - 覆盖 provider-configs 不可用时的低敏 UI 提示。

## 四、验证命令

### 1. 红灯验证

调整测试后，首次运行出现预期失败：

- Kimi 仍指向旧 `api.moonshot.cn`
- 豆包仍调用 `/models`
- provider-configs 不可用仍显示“服务不可用”

这证明新增测试能捕捉目标问题。

### 2. 相关回归

```bash
pnpm test src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/VendorProviderConfig.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

结果：

- 7 个测试文件通过
- 118 个测试通过

### 3. ESLint

```bash
pnpm exec eslint src/modules/open-platform/domain/vendor-catalog.ts src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests/VendorCatalog.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx
```

结果：通过，0 输出。

### 4. 空白检查

```bash
git diff --check
```

结果：通过，0 输出。

### 5. 全局 typecheck

```bash
pnpm exec tsc --noEmit
```

结果：失败，但失败点仍为既有 `.next/dev/types/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts` 路由类型问题，与本次 AI模型配置修复无关。

### 6. Supabase MCP DDL 应用与只读验证

用户已批准通过 Supabase MCP 在项目 `gvmklxettfipioetpgxl` 上应用 `0016_ai_provider_config_secure` 与 `0017_ai_model_config_persistence` DDL，范围限定为 AI模型配置所需表和索引。

执行前只读检查：

- 迁移历史已有 `ai_model_config_persistence` 记录。
- `platform_ai_model_config_snapshots` 表已存在。
- `platform_ai_model_config_snapshots_updated_at_idx` 索引已存在。
- `platform_ai_provider_configs` 表不存在。

执行结果：

- 已通过 Supabase MCP 应用 `0016_ai_provider_config_secure`。
- 未重复应用 `0017_ai_model_config_persistence`，因为对应表与索引已存在。
- 未写 demo 数据。
- 未读取或输出连接串、密钥或凭证内容。
- 未外呼厂商 API。

执行后只读验证：

- `platform_ai_model_config_snapshots` 存在。
- `platform_ai_provider_configs` 存在。
- 两张表的主键索引存在。
- `platform_ai_model_config_snapshots_updated_at_idx` 存在。
- `platform_ai_provider_configs_provider_idx` 存在。
- `platform_ai_provider_configs_updated_at_idx` 存在。
- Supabase 迁移历史新增 `0016_ai_provider_config_secure`；`0017` 对应结构由既有迁移记录覆盖。

### 7. 本地运行态 provider-configs 检查

在不读取环境变量、不输出连接串、不访问厂商 API 的前提下，通过本机登录态请求：

```bash
curl -sS -b /tmp/zmtg-ai-model-cookie.txt http://localhost:5010/api/v1/open-platform/provider-configs
```

结果：

```json
{"configs":[]}
```

结论：当前运行态的厂商配置存储边界已恢复可用；在未写入 demo 数据的前提下，空列表返回符合预期。

同时只读请求 AI模型配置接口，确认返回：

- `dataSource` 为 `persisted_boundary`。
- `persistenceMode` 为 `database`。
- `externalCallMode` 为 `blocked`。

这证明页面配置持久化边界已连到数据库，且厂商外呼仍保持关闭。

### 8. Migration 元数据修复

只读检查曾发现：

- `drizzle/0016_ai_provider_config_secure.sql` 已定义 `platform_ai_provider_configs`。
- `drizzle/0017_ai_model_config_persistence.sql` 已定义 `platform_ai_model_config_snapshots`。
- `drizzle/meta/_journal.json` 当前只登记到 `0015_v1_knowledge_qa_audit_logs`，未登记 `0016_ai_provider_config_secure` 和 `0017_ai_model_config_persistence`。

已按用户授权完成：

- `drizzle/meta/_journal.json` 已追加 `idx: 16` / `tag: 0016_ai_provider_config_secure`。
- `drizzle/meta/_journal.json` 已追加 `idx: 17` / `tag: 0017_ai_model_config_persistence`。
- 未读取 `.env` / `.env.local`。

验证：

```bash
pnpm exec tsx -e 'const fs=require("node:fs"); const journal=JSON.parse(fs.readFileSync("drizzle/meta/_journal.json","utf8")); const tail=journal.entries.slice(-3).map((entry)=>entry.idx+":"+entry.tag).join(","); console.log(tail);'
```

输出：

```text
15:0015_v1_knowledge_qa_audit_logs,16:0016_ai_provider_config_secure,17:0017_ai_model_config_persistence
```

### 9. 远端结构闭环结论

早前 `pnpm db:migrate` 尝试因当前 shell 未加载数据库连接参数而未能完成。用户随后提供并批准了 Supabase project ref，本轮已通过 Supabase MCP 完成结构补齐。

当前结论：

- `platform_ai_provider_configs` 已创建。
- `platform_ai_model_config_snapshots` 已存在。
- 本地运行态 `/api/v1/open-platform/provider-configs` 已从不可用恢复为正常空列表响应。
- 因用户限定“不写 demo 数据”，本轮未执行写入型页面数据验证。

## 五、安全边界复核

- 没有读取 `.env` / `.env.local`。
- 没有执行本地 `pnpm db:migrate`。
- 已按用户批准通过 Supabase MCP 应用缺失 DDL。
- 没有真实外呼厂商 API。
- 测试环境默认 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED` 为关闭路径，sync/test route 使用 dry-run adapter。
- 页面与低敏响应测试继续断言不展示明文凭证、连接串、密文字段名和本机路径。
- 服务端只在受控操作内部读取已保存凭证并传给 adapter；不会写入浏览器响应或测试报告。

## 六、剩余风险

- 本轮未写 demo 数据，因此没有用假凭证做 POST/刷新验收；真实页面保存仍建议由用户使用自己的凭证做人工验收。
- `0017` 对应结构已由既有 Supabase 迁移记录覆盖，远端迁移历史中的名称与本地文件名不完全一致，但表与索引已核对存在。
- 豆包、通义千问、智谱GLM 目前采用受控静态目录作为同步结果，后续若要接入各自管控面模型列表 API，需要单独审批认证方式、权限和外呼边界。
- 全局 typecheck 被 knowledge-management 的既有 `.next/dev/types` 问题阻塞，建议另开任务处理。

## 七、复审建议

Claude Code 可重点复审：

1. `platformAiModelVendorOperations.ts` 中三类同步策略是否符合官方文档边界。
2. DeepSeek / Kimi 是否仅在显式外呼开启时通过注入 adapter 调用官方模型列表 endpoint。
3. 豆包 / 通义千问 / 智谱GLM 是否不会再拼接 `/models`。
4. provider-configs 不可用时 UI 是否显示“凭证存储不可用”。
5. 测试与页面输出是否仍保持低敏，不泄露凭证、连接串或密文字段。
6. migration journal 是否已正确登记 0016/0017，Supabase 远端两张表和索引是否已存在。
