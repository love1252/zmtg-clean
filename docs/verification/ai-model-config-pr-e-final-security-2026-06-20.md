# AI模型配置 PR-E 最终安全与权限回归验收报告

> 日期：2026-06-20 CST +0800
> 分支：`codex/old-ai-model-config-parity-01`
> 基线：`2499e2d291829155f55aab1ac178f68d23dfa30a`
> 范围：安全、权限、审计、低敏响应、最终回归

## 一、验收目标

PR-E 对 PR-A 到 PR-D 的 AI模型配置能力做最终收口：

- 确认同步和测试接口默认不访问真实厂商。
- 确认真实外部调用只在显式开关开启后通过服务端 adapter 执行。
- 确认平台权限边界清晰：平台管理员可写，平台运营只读，审计员只读审阅，租户端拒绝。
- 确认同步、测试、保存配置均有审计记录或审计边界。
- 确认响应、页面文本、持久化 DTO 不暴露敏感配置值。
- 确认 PR-D 的 Logo、场景预设、保存全部配置体验未破坏既有能力。

## 二、本阶段补齐

### 1. 同步 route 审计动作语义修正

同步模型会改变 AI模型配置快照，因此将同步 route 的访问检查和审计动作从连通测试语义调整为配置更新语义：

- 同步 route：`action: update`
- 测试 route：继续使用 `action: test_connection`
- 权限结果不放宽：平台运营与租户端仍被拒绝。

### 2. 访问控制测试补齐

补齐 `ai_model_config` 资源在访问控制领域测试中的稳定断言：

- 稳定资源列表包含 AI模型配置。
- 平台管理员允许读取、更新、管理厂商凭据状态、触发测试。
- 平台运营只允许读取，不允许更新或触发测试。
- 安全审计员允许读取和审阅，不允许更新。
- 租户端角色拒绝访问平台 AI模型配置边界。

## 三、回归结果

### 安全与功能整组回归

```bash
pnpm test src/modules/security/tests/AccessControlDomain.test.ts src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：

- 6 个测试文件通过。
- 103/103 测试通过。

覆盖范围：

- 访问控制领域。
- DB schema 与 migration 候选结构测试。
- AI模型配置 contract。
- AI模型配置持久化边界。
- AI模型配置前端交互。
- 厂商同步与模型测试服务端操作。

### ESLint

```bash
pnpm exec eslint src/app/api/v1/open-platform/ai-model-config/route.ts src/app/api/v1/open-platform/ai-model-config/sync/route.ts src/app/api/v1/open-platform/ai-model-config/test/route.ts src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/security/tests/AccessControlDomain.test.ts src/modules/security/domain/access-control.ts
```

结果：

- 0 问题。

### diff 空白检查

```bash
git diff --check
```

结果：

- 0 问题。

### 全局 typecheck

```bash
pnpm exec tsc --noEmit
```

结果：

- 未通过。
- 失败位置仍在既有 knowledge-management 生成类型文件，不在 AI模型配置变更范围内。

## 四、最终边界确认

- 本轮未运行 migration。
- 本轮未提交、未推送、未创建 PR。
- 本轮未读取本地环境文件。
- 厂商同步/测试测试用例使用 mock 外呼。
- 默认 route adapter 不发起真实厂商请求。
- 显式开关开启后的 route 测试仍使用注入 mock fetch，不访问真实厂商域名。
- 审计写入失败不会把内部错误反射到低敏 API 响应。
- 配置保存失败会在 UI 给出失败反馈。
- Logo 恢复默认、场景预设保存、保存全部配置成功反馈均有组件测试覆盖。

## 五、剩余风险

- 刷新后真实恢复依赖目标数据库已存在 AI模型配置快照表；本阶段未运行 migration。
- 全局 typecheck 被非本栏目生成类型阻塞，需要另开任务处理。
- 真实厂商外呼能力虽然有显式开关和 mock 测试覆盖，但上线前仍需按环境配置进行人工开关复核。
