# 第八阶段：运行时 Demo 与休眠领域 Mock 边界复核

- 日期：2026-07-26
- 分支：`refactor/runtime-demo-boundary-20260726-012707`
- 基线：`77cb5ab73762b4c1ffa8e0eb2137a0a60c84f33e`
- 原审核候选：11 个
- 当前运行时边界：10 个
- 休眠领域 Mock：1 个
- 高风险边界：3 个
- 中风险边界：8 个
- 本阶段移动文件：0 个

## 审核结论

- 依据当前代码调用证据，确认 10 个候选属于运行时边界。
- 1 个候选重分类为仅测试调用的休眠领域 Mock。
- 企业微信客户联系 Mock API 当前固定返回能力关闭响应。
- 第五阶段对休眠领域 Mock 的运行时可达标记已经过时。
- 11 个候选本阶段均不移动。
- 所有候选的 `move_now` 均为 `no`。

## 职责汇总

| 职责分组 | 数量 | 当前结论 |
|---|---:|---|
| API | 2 | 保持 Framework 路由位置 |
| 认证 | 2 | 保持认证组件和服务边界 |
| 领域 | 5 | 4 个运行时领域边界，1 个休眠领域 Mock |
| 服务 | 2 | 保持显式 Adapter 和 Runtime 边界 |

## 逐文件边界汇总

| 文件 | 分组 | 边界分类 | 运行时值导入 | 候选链值导入 | 测试值导入 | 风险 |
|---|---|---|---:|---:|---:|---|
| `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts` | API | `framework_api_entry_boundary` | 0 | 0 | 1 | high |
| `src/app/api/v1/knowledge-base/demo-readonly/route.ts` | API | `framework_api_entry_boundary` | 0 | 0 | 1 | high |
| `src/modules/auth/components/DemoSessionGate.tsx` | 认证 | `runtime_auth_component_boundary` | 1 | 0 | 0 | medium |
| `src/modules/auth/server/demo-session.ts` | 认证 | `runtime_auth_session_boundary` | 5 | 0 | 7 | high |
| `src/modules/institution/domain/wecom-customer-contact-readonly-proof-mock.ts` | 领域 | `dormant_domain_mock_fixture_boundary` | 0 | 0 | 1 | medium |
| `src/modules/institution/domain/wecom-reachout-mock.ts` | 领域 | `runtime_domain_mock_boundary` | 5 | 0 | 2 | medium |
| `src/modules/institution/server/wecom-customer-broadcast-task-mock-provider.ts` | 服务 | `explicit_injection_mock_service_boundary` | 0 | 0 | 2 | medium |
| `src/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime.ts` | 服务 | `runtime_mock_service_boundary` | 1 | 0 | 2 | medium |
| `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract.ts` | 领域 | `runtime_demo_domain_boundary` | 0 | 1 | 2 | medium |
| `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade.ts` | 领域 | `runtime_demo_domain_boundary` | 0 | 1 | 2 | medium |
| `src/modules/knowledge-base/domain/v1-knowledge-base-demo-source-contract.ts` | 领域 | `runtime_demo_domain_boundary` | 0 | 1 | 1 | medium |

## 逐文件审核

### `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts`

- 职责分组：API
- 执行角色：企业微信客户联系能力关闭 API 入口
- 边界分类：`framework_api_entry_boundary`
- 激活方式：`framework_route_entry`
- 当前证据状态：`framework_entry_confirmed`
- 运行时值导入数：0
- 候选链值导入数：0
- 测试值导入数：1
- 当前结论：属于 Next.js 运行时 API 路由；当前固定返回能力关闭响应，不再调用领域 Mock。
- 后续建议：保持 API 路由位置；后续启用真实能力时重新设计认证、权限、配置开关和只读访问边界。

### `src/app/api/v1/knowledge-base/demo-readonly/route.ts`

- 职责分组：API
- 执行角色：知识库 Demo 只读 API 运行时入口
- 边界分类：`framework_api_entry_boundary`
- 激活方式：`framework_route_entry`
- 当前证据状态：`framework_entry_confirmed`
- 运行时值导入数：0
- 候选链值导入数：0
- 测试值导入数：1
- 当前结论：属于 Next.js 运行时 API 路由，并连接知识库 Demo 领域链。
- 后续建议：保持 API 路由位置；后续真实运行时替换需单独设计兼容、停用和回退策略。

### `src/modules/auth/components/DemoSessionGate.tsx`

- 职责分组：认证
- 执行角色：客户端 Demo 会话访问守卫
- 边界分类：`runtime_auth_component_boundary`
- 激活方式：`runtime_component_import`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：1
- 候选链值导入数：0
- 测试值导入数：0
- 当前结论：属于认证运行时组件，不是展示用 Fixture。
- 后续建议：保持认证组件边界；后续必须与正式 Session、租户和权限策略联合治理。

### `src/modules/auth/server/demo-session.ts`

- 职责分组：认证
- 执行角色：服务端 Demo 会话认证服务
- 边界分类：`runtime_auth_session_boundary`
- 激活方式：`runtime_auth_service_import`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：5
- 候选链值导入数：0
- 测试值导入数：7
- 当前结论：属于服务端认证运行时边界，直接影响登录、会话和租户上下文。
- 后续建议：保持认证服务位置；后续替换必须单独设计认证、权限、租户隔离和回退方案。

### `src/modules/institution/domain/wecom-customer-contact-readonly-proof-mock.ts`

- 职责分组：领域
- 执行角色：企业微信只读证明休眠领域 Mock
- 边界分类：`dormant_domain_mock_fixture_boundary`
- 激活方式：`test_only_dormant_domain_fixture`
- 当前证据状态：`runtime_reachability_reclassified`
- 运行时值导入数：0
- 候选链值导入数：0
- 测试值导入数：1
- 当前结论：当前 Mock API 路由已改为固定能力关闭响应；本文件仅剩测试值调用，第五阶段运行时可达标记已经过时。
- 后续建议：暂时保持机构领域位置；后续单独评估删除、归档或迁入测试 Fixture，本阶段不直接移动。

### `src/modules/institution/domain/wecom-reachout-mock.ts`

- 职责分组：领域
- 执行角色：企业微信触达受控 Mock 领域数据
- 边界分类：`runtime_domain_mock_boundary`
- 激活方式：`runtime_shared_mock_dependency`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：5
- 候选链值导入数：0
- 测试值导入数：2
- 当前结论：被机构端运行时组件、领域和服务直接依赖，不是纯测试数据。
- 后续建议：保持机构领域位置；后续先拆分领域类型、样例数据和真实渠道 Provider。

### `src/modules/institution/server/wecom-customer-broadcast-task-mock-provider.ts`

- 职责分组：服务
- 执行角色：企业微信群发任务显式注入 Mock Adapter
- 边界分类：`explicit_injection_mock_service_boundary`
- 激活方式：`explicit_service_injection`
- 当前证据状态：`explicit_injection_confirmed`
- 运行时值导入数：0
- 候选链值导入数：0
- 测试值导入数：2
- 当前结论：当前用于测试或显式服务注入，不是默认生产 Provider，但仍属于服务契约实现。
- 后续建议：保持服务目录；禁止注册为默认真实发送 Provider，后续与 Provider 契约联合治理。

### `src/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime.ts`

- 职责分组：服务
- 执行角色：企业微信客户映射审核进程内 Mock Runtime
- 边界分类：`runtime_mock_service_boundary`
- 激活方式：`runtime_default_mock_service`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：1
- 候选链值导入数：0
- 测试值导入数：2
- 当前结论：被候选读取、审核动作 API 和默认运行时服务直接依赖。
- 后续建议：保持服务目录；后续持久化替换需保留幂等、审计、容量和故障关闭语义。

### `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract.ts`

- 职责分组：领域
- 执行角色：知识库 Demo 只读 API 契约
- 边界分类：`runtime_demo_domain_boundary`
- 激活方式：`runtime_demo_contract_chain`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：0
- 候选链值导入数：1
- 测试值导入数：2
- 当前结论：连接运行时 API、工作台和 Demo Facade，属于运行时领域契约。
- 后续建议：保持知识库领域位置；后续将通用 API 契约与 Demo 默认数据解耦。

### `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade.ts`

- 职责分组：领域
- 执行角色：知识库 Demo 只读 Facade
- 边界分类：`runtime_demo_domain_boundary`
- 激活方式：`runtime_demo_facade_chain`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：0
- 候选链值导入数：1
- 测试值导入数：2
- 当前结论：连接运行时 API 契约和 Demo 数据源契约，属于运行时领域编排。
- 后续建议：保持知识库领域位置；使用真实只读 Repository 替换时保持响应契约兼容。

### `src/modules/knowledge-base/domain/v1-knowledge-base-demo-source-contract.ts`

- 职责分组：领域
- 执行角色：知识库 Demo 数据源契约
- 边界分类：`runtime_demo_domain_boundary`
- 激活方式：`runtime_demo_source_chain`
- 当前证据状态：`runtime_dependency_confirmed`
- 运行时值导入数：0
- 候选链值导入数：1
- 测试值导入数：1
- 当前结论：通过 Demo Facade 进入运行时领域链，不是孤立测试 Fixture。
- 后续建议：保持知识库领域位置；后续先引入正式数据源接口，再停用 Demo 数据源。

## 后续治理原则

1. API 路由不得因名称包含 Demo 或 Mock 而迁入测试目录。
2. Demo 认证必须与正式 Session、权限和租户隔离联合设计。
3. 机构领域 Mock 应拆分领域契约、样例数据和真实渠道 Provider。
4. 显式注入 Mock Adapter 不得注册为默认真实发送 Provider。
5. 知识库 Demo API、契约、Facade 和数据源按完整调用链治理。
6. 休眠领域 Mock 依据当前调用证据单独评估，不沿用过时标记。
7. 本阶段不实施真实运行时替换、重命名或路径迁移。

## 安全边界

- 未修改或移动 11 个候选文件。
- 未修改任何 API、认证、领域、服务、测试或脚本。
- 未修改 Schema、Migration、`package.json` 或锁文件。
- 未执行数据库 Migration 或 Seed。
- 未连接数据库、HIS、企业微信或服务器。
- 未读取或输出 `.env.local` 或真实凭证。
- 未改变认证、权限、租户隔离或运行时行为。

## 验证基线说明

- `src/modules/auth/tests/DemoAuthRoutes.test.ts` 保留了旧 Demo 认证契约预期。
- 旧测试仍允许缺少 `scope` 的登录请求，并接受缺少 `source` 的旧 Demo Cookie。
- 当前登录路由要求精确的 `scope: institution`。
- 当前会话路由要求 Demo Session 明确包含 `source: demo_session`。
- 该旧测试在当前基线出现 11 项预期漂移，不是第八阶段文档变更导致的回归。
- 本阶段不修改认证源码或测试文件。
- 当前认证边界改用 `FormalAuthRoutes.test.ts`、认证领域测试和正式会话来源测试验证。
- 旧 Demo 认证测试后续需单独立项更新、拆分或退役。
