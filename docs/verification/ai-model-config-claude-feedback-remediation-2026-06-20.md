# AI模型配置 Claude 验收反馈整改报告

> 日期：2026-06-20 CST +0800  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 依据：`docs/verification/ai-model-config-claude-terminal-acceptance-2026-06-20.md`  
> 用途：记录 Claude Code P2/P3 反馈的整改内容，供二次验收。

## 一、整改边界

本轮只处理 Claude Code 独立验收后的 P2/P3 反馈，不扩大 `AI模型配置` 功能范围。

- 未读取本地环境文件。
- 未运行 migration。
- 未写 demo 数据。
- 未访问真实厂商 API。
- 未提交、未推送、未创建 PR。
- 未处理 knowledge-management 的既有 typecheck 问题。

## 二、整改清单

| Claude 反馈 | 整改结果 | 涉及文件 |
| --- | --- | --- |
| P2：Logo data URL 服务端校验余量偏小 | 已将服务端 base64 长度上限提升到 260000，并保留超限拒绝测试 | `src/modules/open-platform/server/platformAiModelConfigPersistence.ts`、`src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts` |
| P3：模型列表嵌套格式缺少说明 | 已增加防御性兼容注释，并补充 `data.models` 响应结构测试 | `src/modules/open-platform/server/platformAiModelVendorOperations.ts`、`src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts` |
| P3：厂商类型和运行时列表分开定义 | 已改为从运行时 catalog key 推导 `SupportedVendor`，并加源文件结构断言 | `src/modules/open-platform/domain/vendor-catalog.ts`、`src/modules/open-platform/tests/VendorCatalog.test.ts` |
| P3：短前缀敏感匹配可能误拦 | 已改为精确模式匹配，允许普通业务短文本，继续拒绝真实凭证形态文本 | `src/modules/open-platform/server/platformAiModelConfigPersistence.ts`、`src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts` |
| Claude 运行态接口验证使用了错误登录路径 | 已在 Claude 验收报告 7.2 增加 Codex 复核补充，说明正确登录路径与只读验证结果 | `docs/verification/ai-model-config-claude-terminal-acceptance-2026-06-20.md` |

## 三、TDD 红绿记录

新增测试后，整改前确认失败：

- Logo 服务端校验余量测试失败：当前上限无法接受 235000 字符级别的安全余量。
- 普通业务短文本误拦测试失败：旧逻辑按短片段直接包含匹配。
- 厂商类型推导测试失败：旧逻辑仍为手写 union。

整改后目标测试通过：

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts -- -t "服务端校验余量|非凭证格式"
```

结果：2 个目标测试通过。

```bash
pnpm test src/modules/open-platform/tests/VendorCatalog.test.ts -- -t "derives"
```

结果：1 个目标测试通过。

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts -- -t "data.models"
```

结果：1 个目标测试通过。

## 四、待二次验收重点

Claude Code 二次验收建议重点确认：

1. Logo data URL 上限是否既覆盖 150KB 文件转换后的安全余量，又能拒绝服务端超限数据。
2. 普通业务短文本是否不再被误拦，真实凭证形态文本是否仍被拒绝。
3. `SupportedVendor` 是否已从 `SUPPORTED_VENDOR_CONFIGS` 推导，新增厂商时不再维护两套列表。
4. `readModelRecords` 的 `data.models` 结构是否有注释和测试覆盖。
5. Claude 报告中的运行态接口误差说明是否已补充清楚。

## 五、结论

Claude Code 验收报告中的 1 个 P2 和 3 个 P3 反馈均已完成整改或补充说明。下一步需运行完整相关回归、静态检查和二次 Claude Code 独立验收。
