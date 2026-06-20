# AI模型配置 PR-A 同步规则与厂商 adapter 验收报告

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 阶段：PR-A，厂商模型同步 contract、受控 adapter、业务模型筛选和排序  

## 验收范围

- 补齐 5 家厂商模型列表 endpoint 规则：
  - 豆包
  - DeepSeek
  - 通义千问
  - 智谱GLM
  - Kimi
- 支持官方模型列表多种响应结构解析：
  - `data[]`
  - `models[]`
  - `data.models[]`
- 同步结果只保留业务可用模型：
  - 排除第三方代理路径、开放权重、免费、蒸馏、指令微调等非平台业务默认候选模型
  - 按厂商前缀保留本厂商模型
- 按旧系统规则推断能力分组：
  - 深度思考
  - 文本生成
  - 视觉理解
  - 向量模型
- 按旧系统规则执行每组限额：
  - 深度思考最多 3 个
  - 文本生成最多 3 个
  - 视觉理解最多 3 个
  - 向量模型最多 2 个
- 保持默认安全边界：
  - 测试使用 mock fetch
  - 默认 route 仍为 dry-run
  - 不访问真实厂商 API
  - 不读取或输出敏感配置

## 变更文件

- `src/modules/open-platform/server/platformAiModelVendorOperations.ts`
- `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`

## 验证命令

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：10/10 通过。

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：30/30 通过。

```bash
pnpm exec eslint src/modules/open-platform/server/platformAiModelVendorOperations.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：0 问题。

```bash
git diff --check
```

结果：0 问题。

## 已完成结论

PR-A 已完成最小可验收闭环：同步模型不再只是通用 `/models` 调用，而是具备旧系统所需的厂商 endpoint、响应解析、业务筛选、能力归类、偏好排序和限额逻辑。

## 未完成内容

以下内容属于后续 PR，不在 PR-A 范围内：

- PR-B：同步成功后写入模型注册快照，并刷新页面模型列表。
- PR-C：模型测试按钮从 dry-run 扩展为受控服务端真实测试闭环。
- PR-D：保存全部配置、Logo 恢复默认、场景预设真实保存等体验补齐。
- PR-E：最终安全、权限、审计、低敏回归验收。

## 风险与注意

- 当前同步 route 默认仍走 dry-run，不会真实访问厂商。
- adapter 真实外呼仍受服务端显式开关控制。
- 同步结果目前尚未持久化到页面模型注册快照；这会在 PR-B 中处理。
