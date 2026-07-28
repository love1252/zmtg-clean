# 下一任务

## 当前交接状态

`V2-02B-MIG01-CLOSURE-PREFLIGHT` 已通过 PR #789 完成并合并。MIG-01A1 只有仓库静态 Expand 证据达到“已具备”；A2 缺失；BASE-02 部分具备；Writer、Audit／模板、B、C、Reader 均为阻断。该结果只冻结静态证据、影响面和 MIG-01 内部候选实施顺序，不表示 MIG-01 已启动、实施或关闭。

项目级参考顺序保持：

```text
V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
→ 最小 Architecture／Quality CI
→ MIG-01 后续独立数据 PR
→ 后续既定顺序
```

本文件只冻结未来 V2-02C 的 docs-only 静态预检范围。V2-02C、Architecture／Quality CI、MIG-01A2 和机构端旧任务均未启动。

## 唯一下一任务

```text
V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
平台正式授权与路由族静态预检
```

`V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT` 是唯一下一任务，但尚未启动。只有用户在后续任务中明确授权后，才可按本文边界开展仓库内静态审计；本次 handoff 不构成对源码、Route、Session、权限、Capability 或环境操作的授权。

## 一、未来任务的精确文件范围

未来 V2-02C 只允许创建：

```text
docs/architecture/v2-02c-platform-auth-route-preflight.md
```

不得修改或创建其他文件。若该路径已经存在，必须停止并报告，不得覆盖、复用同名历史内容或创建同义文档。

该预检文档只展开同一套架构 V2 的平台授权与路由证据，不是第二套权限模型、路由事实源、API 规范或实施授权。

## 二、任务定位与事实边界

未来 V2-02C 只允许读取当前 `main` 内可验证的代码、测试、配置和已合并文档，静态回答：

1. 平台入口、登录入口和 Session 来源当前如何接线；
2. 平台角色、资源、动作、目标租户和服务端策略当前具备什么；
3. 正式平台授权根缺少哪些 Session、Scope、Guard、Entitlement、Audit 和 fail-closed 证据；
4. 平台页面、现有 API 路由族、调用方和数据来源的完整影响面；
5. 旧路由与 v1 路由应如何逐路由兼容、迁移、观测和退出；
6. 后续独立实施切片的依赖、允许范围、测试、停止、回退和授权条件。

当前 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定 `current` 事实；`docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target` 约束；`architecture-v2-module-map.md`、六类架构视图、代码证据审计、架构索引和 handoff 只负责展开、导航、核验与记录状态，不得独立改写模块所有权、权限根、路由政策、Migration 顺序或发布门禁。本预检只能记录证据、缺口和候选切片。仓库外调用方、真实 Session、环境配置、部署状态和生产授权统一标记为“待确认”，不得从文件名、类型定义、Demo、Mock、测试通过或角色常量推断为已上线。

## 三、必须审计的内容

### 3.1 平台应用入口与 Session 来源

至少审计：

- `src/app/open-platform/page.tsx`；
- `DemoSessionGate`；
- `PlatformConsole`；
- `/api/auth/session`；
- 平台登录入口；
- 页面和 API 实际消费的 Session、Actor、tenant 与 provenance 来源。

必须区分 Demo 门禁、客户端展示、登录态存在和正式服务端授权。任何客户端角色判断、Demo Session 或页面可访问证据都不能单独证明平台授权已完成。

### 3.2 平台角色、资源、动作与策略

至少核对：

- `platform_admin`；
- `platform_operator`；
- `security_auditor`；
- 当前 `ProtectedResource`；
- 当前 `ProtectedAction`；
- 角色与资源／动作的映射；
- 已存在但未接线、只覆盖部分入口或完全缺失的服务端策略。

不得把角色 Audience、导航可见性、Capability 或类型常量等同于对象和动作级服务端授权。

### 3.3 正式平台授权根

预检必须分别记录以下目标能力的当前证据和缺口：

1. 正式服务端 Session 解析；
2. 可追溯的 Actor／Provenance；
3. platform Scope；
4. 页面 Guard 与 Route Guard；
5. target tenant／目标对象／Action 授权；
6. Entitlement、Capability 与 Release Gate 的独立职责；
7. Audit attribution；
8. fail-closed；
9. 面向调用方的低敏错误。

缺少正式 Session、Scope、目标对象或策略时必须按入口 fail-closed，不得用默认 tenant、客户端状态或宽泛平台角色兜底。

### 3.4 平台页面与 API 路由族完整清单

静态清单至少覆盖：

```text
src/app/open-platform/**
src/app/api/open-platform/**
src/app/api/v1/open-platform/**
```

并追踪相关 `auth`、`security`、`open-platform`、`workspace` 模块、Repository、Service、测试和仓库内调用方。不能因某个目录为空、缺失或只有部分路由，就省略缺口记录。

### 3.5 每个页面与 Route 的记录字段

每一项至少记录：

- 当前文件路径和公开 URL；
- 当前业务 Owner；
- 当前认证／授权方式；
- 允许角色；
- 受保护资源和动作；
- target tenant 或目标对象；
- 数据来源、Service 和 Repository；
- Audit 状态；
- legacy／v1 状态；
- 仓库内调用方；
- 仓库外调用方是否待确认；
- 兼容条件；
- 回退条件；
- 旧入口退出条件。

所有结论必须引用真实路径、符号或测试；未找到证据时明确写“缺失”或“待确认”。

### 3.6 Route Group 目标

目标页面路径为：

```text
src/app/(platform)/open-platform
```

公开 URL 继续保持：

```text
/open-platform
```

未来预检只核验移动影响面、服务端 Guard 前置条件和公开 URL 不变的证明方案，不得移动页面、创建 Route Group、改变 URL 或修改任何调用方。

### 3.7 API 路径政策

- 新平台 API 默认使用 `/api/v1/open-platform/**`；
- 旧 `/api/open-platform/**` 只能作为逐路由薄兼容候选；
- 每个旧路由必须有单一业务 Owner、明确调用方、观测窗口和退出条件；
- 不允许批量代理、批量迁移、通配兼容或复制第二套业务逻辑；
- 预检不得新建 API、兼容代理、Route Handler 或占位实现。

### 3.8 状态词

每个审计单元必须且只能使用：

- `已具备`：当前仓库存在完整、一致、可追溯的静态证据；
- `部分具备`：存在部分结构或接线，但不足以关闭；
- `缺失`：仓库中没有所需实现或证据；
- `阻断`：存在必须先解决的授权、安全、依赖或兼容问题；
- `待确认`：仅凭仓库无法确定，或必须由后续获批环境核验。

代码存在、Route 存在、测试通过、Demo、Mock、Seed、客户端 Guard 或 Capability 均不能单独把正式授权标为“已具备”。

### 3.9 后续候选实施切片

未来预检必须冻结但不得启动以下候选切片：

1. 正式平台 Session／Provenance；
2. 平台 Access Context 与 Action Policy；
3. 服务端页面 Guard 与 Route Group 证明；
4. v1 平台 API 逐路由 Guard；
5. target tenant／对象授权；
6. Entitlement、Audit 与低敏错误；
7. legacy Route 调用方迁移、观测与退出。

每个候选切片必须写明：

- 前置依赖；
- 允许文件类型与禁止范围；
- 单元测试、契约测试、架构测试和未来环境验证要求；
- 启动条件与完成证据；
- 立即停止条件；
- 可回退步骤或必须前向修复的条件；
- 所需的用户、Runtime、安全、环境或发布授权。

候选队列只用于冻结依赖和风险，不构成任何实施许可，也不得因预检完成自动启动第一个切片。

## 四、停止条件

遇到以下任一情况，未来 V2-02C 必须停止并报告：

- 基线、任务编号、唯一允许路径或 working tree 不符合授权；
- 目标文档已经存在；
- 无法确认平台页面、Route、角色、策略、调用方或 Repository 的完整影响面；
- 当前实现与已接受架构存在无法解释的矛盾；
- 需要读取凭证、环境变量值或真实 Session 才能继续；
- 需要连接数据库、外部系统、测试服务器或生产环境；
- 需要修改唯一允许文件之外的内容；
- 需要创建代码、Route、Session、Guard、API、测试、配置或占位实现；
- 需要启动 Architecture／Quality CI、MIG-01A2 或机构端旧任务；
- 出现未获授权的文件改动或其他 Agent 并发写入。

## 五、禁止范围

未来 V2-02C 不得：

- 修改 `src/**`、`drizzle/**`、`scripts/**`、`tests/**`、package、lock、配置或现有文档；
- 修改源码、Route、Session、认证、授权、Audit、Entitlement、Capability 或 Release Gate；
- 移动 `src/app/open-platform` 或创建 `src/app/(platform)`；
- 改变公开 URL；
- 新建 API、Route Handler、兼容代理或第二套业务逻辑；
- 修改 Schema 或 Migration；
- 运行测试、Build、`db:generate`、Migration、Seed 或部署；
- 连接数据库、HIS、企业微信、AI 厂商、对象存储、CI、监控、测试服务器或生产环境；
- 读取 `.env.local`、`DATABASE_URL`、Secret、Token、私钥、凭证、真实 Session 或环境变量值；
- 启动 Architecture／Quality CI；
- 启动 MIG-01A2 或任何 MIG-01 实施切片；
- 恢复或启动机构端旧任务；
- 自动进入正式审查（Ready）或自动合并（Merge）；
- 因预检完成自动启动任何候选实施切片。

## 六、未来预检的验证与交付

未来任务至少必须确认：

1. `git diff --check` 通过；
2. 修改文件精确为新建的 `docs/architecture/v2-02c-platform-auth-route-preflight.md`；
3. 平台入口、Session、角色、策略、授权根、页面和 API 路由族影响面均已覆盖；
4. 每个页面／Route 均记录本文规定的字段；
5. Route Group 目标与公开 URL 不变被明确区分；
6. v1 路径和逐路由薄兼容政策保持一致；
7. 所有审计单元只使用五种规定状态；
8. 七个候选切片均写明依赖、范围、测试、停止、回退和授权；
9. Runtime、Schema、Migration 修改均为 `0`；
10. 未运行测试、Build、`db:generate`、Migration、Seed 或部署；
11. 未读取凭证或环境变量值，未连接数据库或外部环境；
12. 工作树在提交后干净，最终只有一个同主题提交；
13. 只创建草稿 PR，不自动进入正式审查，不自动合并；
14. 未启动 V2-02C 的 Runtime 实施、Architecture／Quality CI、MIG-01A2 或机构端旧任务。

未来 V2-02C 的完成定义仅是：平台正式授权根、页面与 API 路由族的当前静态证据、缺口、完整影响面和后续候选实施切片被文档化并冻结。它不代表平台授权已经实施、Route Group 已移动、v1 API 已创建或任何 Capability 已发布。
