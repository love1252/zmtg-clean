# 第七阶段：模块 Mock 运行时与测试调用边界

- 日期：2026-07-26
- 分支：`refactor/module-mock-boundary-20260726-010139`
- 基线：`40e0f9ac7897807b69fefec6d55703cb983ece49`
- 审核候选：5 个
- 本阶段移动文件：0 个

## 审核结论

- 4 个候选属于运行时可达的受控样例 Provider。
- 1 个候选属于运行时类型契约来源与测试值样例。
- 5 个候选均不是可以直接迁入测试目录的纯测试 Fixture。
- 所有候选的 `move_now` 均为 `no`。

## 边界汇总

| 文件 | 当前角色 | 运行时值可达 | 运行时类型导入 | 测试值导入 | Mock 组合导入 | 结论 |
|---|---|---:|---:|---:|---:|---|
| `src/modules/open-platform/mock/platformAiModelConfig.ts` | 运行时受控 AI 模型配置样例与共享类型源 | yes | 1 | 0 | 0 | 存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。 |
| `src/modules/open-platform/mock/platformAiModelRegistry.ts` | 运行时受控模型注册表样例 | yes | 0 | 0 | 1 | 存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。 |
| `src/modules/open-platform/mock/platformAiReadonly.ts` | 运行时 AI 只读聚合样例 | yes | 0 | 0 | 0 | 存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。 |
| `src/modules/open-platform/mock/platformAiUsageCost.ts` | 运行时 AI 用量与成本样例 | yes | 0 | 0 | 1 | 存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。 |
| `src/modules/open-platform/mock/platformKnowledge.ts` | 运行时类型契约来源与测试值样例 | no | 2 | 1 | 0 | 运行时仅依赖类型，测试直接依赖值；后续应优先拆分共享类型。 |

## 逐文件边界

### `src/modules/open-platform/mock/platformAiModelConfig.ts`

- 当前角色：运行时受控 AI 模型配置样例与共享类型源
- 边界分类：`controlled_runtime_sample_provider`
- 运行时值可达：yes
- 运行时值导入数：4
- 运行时类型导入数：1
- 测试值导入数：0
- Mock 组合值导入数：0
- 当前结论：存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。
- 后续建议：保持当前位置；后续若治理，先拆分共享类型、运行时默认值和受控样例数据。

### `src/modules/open-platform/mock/platformAiModelRegistry.ts`

- 当前角色：运行时受控模型注册表样例
- 边界分类：`controlled_runtime_sample_provider`
- 运行时值可达：yes
- 运行时值导入数：1
- 运行时类型导入数：0
- 测试值导入数：0
- Mock 组合值导入数：1
- 当前结论：存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。
- 后续建议：保持当前位置；后续通过显式运行时 Provider 替代直接 Mock 数据依赖。

### `src/modules/open-platform/mock/platformAiReadonly.ts`

- 当前角色：运行时 AI 只读聚合样例
- 边界分类：`controlled_runtime_sample_provider`
- 运行时值可达：yes
- 运行时值导入数：1
- 运行时类型导入数：0
- 测试值导入数：0
- Mock 组合值导入数：0
- 当前结论：存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。
- 后续建议：保持当前位置；该文件组合模型注册表和用量成本样例，不得单独移动。

### `src/modules/open-platform/mock/platformAiUsageCost.ts`

- 当前角色：运行时 AI 用量与成本样例
- 边界分类：`controlled_runtime_sample_provider`
- 运行时值可达：yes
- 运行时值导入数：1
- 运行时类型导入数：0
- 测试值导入数：0
- Mock 组合值导入数：1
- 当前结论：存在运行时值依赖或通过其他运行时 Mock 聚合可达，不是纯测试 Fixture。
- 后续建议：保持当前位置；后续先分离用量类型契约、样例数据和真实计量读取接口。

### `src/modules/open-platform/mock/platformKnowledge.ts`

- 当前角色：运行时类型契约来源与测试值样例
- 边界分类：`runtime_type_contract_and_test_fixture`
- 运行时值可达：no
- 运行时值导入数：0
- 运行时类型导入数：2
- 测试值导入数：1
- Mock 组合值导入数：0
- 当前结论：运行时仅依赖类型，测试直接依赖值；后续应优先拆分共享类型。
- 后续建议：保持当前位置；后续优先将共享类型迁出 mock，再决定测试值样例的归属。

## 后续治理原则

1. 不按目录名称将运行时 Mock 直接搬入测试目录。
2. 先拆分共享类型、运行时接口和受控样例数据。
3. 运行时样例应通过显式 Provider 或 Repository 边界提供。
4. Mock 聚合文件必须与其上游样例一起审核，不单独移动。
5. `platformKnowledge.ts` 后续优先拆出共享类型，再处理测试值样例。

## 安全边界

- 未修改或移动 5 个模块 Mock 文件。
- 未修改任何运行时路由、服务、组件或测试。
- 未修改 `package.json`、锁文件、Schema 或 Migration。
- 未执行数据库 Migration 或 Seed。
- 未连接数据库、HIS、企业微信或服务器。
- 未读取或输出 `.env.local` 或真实凭证。
