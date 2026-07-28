# 智美天工架构文档索引

- 任务：`V2-02B-HANDOFF-CLOSEOUT-TO-V2-02C`
- 日期：`2026-07-28 CST +0800`
- 审计基线：`af9393d15bbfb10391576640a01f9bd5e57f1206`
- 状态：`current`
- 文档性质：架构导航索引，不是第二套架构事实源
- runtime、Schema、Migration、API、UI 修改：`0`

## 1. 文档定位

本文件是 `docs/architecture/` 的统一导航入口，负责说明每份架构文档的权威级别、状态、适用范围和阅读顺序。

它不重新定义模块所有权、Migration 顺序、权限模型或发布门禁。项目总体目标架构继续由 [`architecture-v2.md`](./architecture-v2.md) 统一约束；当前代码、测试、Schema、Migration 和配置始终优先于文档描述。

## 2. 事实依据顺序

发生冲突时，按以下顺序处理：

1. 当前 `main` 的代码、测试、Schema、Migration 和配置；
2. [`architecture-v2.md`](./architecture-v2.md)、已接受 ADR 和模块映射；
3. 当前架构视图与代码证据审计；
4. 七线技术计划、已合并 PR 和交接文档；
5. 历史草案、旧系统和旧对话记录。

低优先级资料只能用于解释历史原因，不能覆盖当前实现或已接受决策。发现冲突时应记录差异、提出 ADR 或预检任务，不得静默修改权威结论。

## 3. 文档状态词

| 状态 | 含义 | 使用规则 |
|---|---|---|
| `current` | 描述当前 `main` 可验证的事实 | 必须能够追溯到代码、测试、Schema、Migration 或已合并记录 |
| `target` | 已接受的目标边界 | 不表示已经实施，也不自动授权 runtime 或数据变更 |
| `proposed` | 待确认的建议 | 形成 ADR 或明确授权前不得写成已完成事实 |
| `planned` | 已安排但尚未创建或实施 | 只能用于导航和阶段计划 |
| `historical` | 历史设计或过程证据 | 不再作为当前开发入口 |

同一份文档可以同时包含 `current` 和 `target` 内容，但每个重要结论必须明确属于哪一种状态。

## 4. 当前架构摘要

智美天工当前采用模块化单体，处于新领域边界与旧聚合 runtime 并存的过渡期。

目标架构统一为：

```text
SaaS 控制平面
+ 机构业务数据平面
+ 应用入口层
+ 业务模块层
+ 公共基础设施层
+ 外部适配器层
+ 单一 PostgreSQL／Drizzle 数据治理序列
```

机构端七条业务线为：

```text
工作台
客户中心
会话工作台
预约与随访
知识库
经营分析
管理中心
```

当前正式发布为 `0/7`。领域模型、契约、测试、Demo、Mock、旧 API 或 capability-off 页面均不能单独证明业务已经上线。

数据库演进顺序保持：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 双键上下文、scope revision、Guard
→ 全部 Writer 双写与旧 Writer 封堵
→ Audit／模板保护
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ Reader 重新核验与独立放行
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 5. 当前架构文档

| 文档 | 状态 | 职责 |
|---|---|---|
| [`architecture-v2.md`](./architecture-v2.md) | `target` | 总体目标架构、模块边界、写入政策、Migration 所有权和实施主序列 |
| [`architecture-v2-module-map.md`](./architecture-v2-module-map.md) | `target` | 当前路径到目标所有者和目标路径的映射 |
| [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md) | `current + target` | 七线完成度、依赖、发布门禁和重启顺序 |
| [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md) | `current + proposed` | 用当前代码、Schema、测试和历史 PR 对 V2 进行独立核验 |
| [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md) | `current + target + proposed` | MIG-01 A1～C 静态证据、完整影响面、阻断状态和内部候选实施切片。 |
| [`business-architecture.md`](./business-architecture.md) | `current + target` | 角色、价值流、两平面职责、七线业务闭环、AI 人工确认和正式发布尺度 |
| [`application-architecture.md`](./application-architecture.md) | `current + target` | 官网、认证、机构端、平台端、API、Webhook、权限、Capability 和应用依赖方向 |
| [`data-architecture.md`](./data-architecture.md) | `current + target + proposed` | 数据事实所有权、机构隔离、来源、证据和 MIG 序列 |
| [`software-architecture.md`](./software-architecture.md) | `current + target + proposed` | 模块分层、依赖方向、Port／Adapter 和兼容层 |
| [`deployment-architecture.md`](./deployment-architecture.md) | `current + target + proposed` | 当前仓库部署证据、目标环境、发布、回滚和待核验事项 |
| [`development-architecture.md`](./development-architecture.md) | `current + target + proposed` | 开发协作、任务与 PR 生命周期、分层开发、测试、Migration 门禁和完成定义 |
| [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md) | `target` | 已接受架构决策及其约束 |

## 6. 架构视图完成状态

业务、应用、数据、软件、部署、开发六类架构视图已经完成 `6/6`。`V2-ARCH-DOCS-03` 已通过 PR #787 合并，开发架构、根 `README.md` 项目入口和 `CURRENT_STATUS` 同步均已完成，不再标记为 `planned`。

`V2-02B-MIG01-CLOSURE-PREFLIGHT` 已通过 PR #789 完成并合并，其预检文档现作为 MIG-01 当前静态证据和候选实施切片入口。该结果不表示 MIG-01 已实施或关闭。

文档完成只代表同一套架构 V2 的视图与入口已经建立，不代表 runtime、Schema、Migration、API、UI、Capability、环境或七线正式发布已经完成。

## 7. 历史资料

| 文档 | 状态 | 使用方式 |
|---|---|---|
| [`zmtg-new-project-architecture-design.md`](./zmtg-new-project-architecture-design.md) | `historical` | 作为重建早期方案和需求来源，不再作为根 README 的唯一架构入口 |
| `docs/refactor/**` | `historical` | 作为目录治理、依赖、风险和试点的过程证据 |
| `docs/superpowers/plans/**` | `historical` | 作为七线和专项任务的历史设计／计划证据；与当前 `main` 冲突时以当前实现为准 |
| `docs/devlog/**` | `historical` | 开发过程和阶段记录 |

## 8. 交接文档职责

| 文档 | 只负责 |
|---|---|
| 根 `README.md` | 项目定位、当前状态摘要、快速启动、验证命令和文档导航 |
| `docs/handoff/CURRENT_STATUS.md` | 当前已合并状态、关键门禁、当前阶段和下一阶段 |
| `docs/handoff/NEXT_TASK.md` | 唯一下一任务的允许范围、禁止范围、验证和交付要求 |
| `docs/handoff/RELEASE_HISTORY.md` | 已合并历史和阶段闭环记录 |
| 本文件 | 架构文档导航、状态词和事实源关系 |

这些文件不能相互复制成长篇历史账本，也不能给出相互冲突的下一阶段。

## 9. 推荐阅读路径

### 产品和业务负责人

1. [`business-architecture.md`](./business-architecture.md)
2. [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)

### 应用和前端开发

1. [`application-architecture.md`](./application-architecture.md)
2. [`architecture-v2.md`](./architecture-v2.md)
3. `src/modules/institution-contracts/v1/institution-navigation.ts`
4. `src/modules/institution-contracts/v1/institution-routes.ts`
5. `src/modules/institution-contracts/v1/institution-capability-registry.ts`

### 后端、数据和安全开发

1. [`architecture-v2.md`](./architecture-v2.md)
2. [`architecture-v2-module-map.md`](./architecture-v2-module-map.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)
4. [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md)
5. [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md)
6. [`data-architecture.md`](./data-architecture.md)
7. [`software-architecture.md`](./software-architecture.md)

### 部署和运维

1. [`deployment-architecture.md`](./deployment-architecture.md)
2. `docs/operations/production-migration-runbook.md`
3. `docs/operations/local-development.md`
4. `scripts/README.md`

### 开发与协作

1. [`development-architecture.md`](./development-architecture.md)
2. [`../../AGENTS.md`](../../AGENTS.md)
3. [`../ai-agent-governance.md`](../ai-agent-governance.md)
4. [`../agent-guardrails/zmtg-pr-gatekeeper.md`](../agent-guardrails/zmtg-pr-gatekeeper.md)

## 10. 架构文档更新规则

1. 先核对当前 `main`，再修改架构文档；
2. 新结论必须标记为 `current`、`target`、`proposed`、`planned` 或 `historical`；
3. 影响模块所有权、Migration 顺序、权限根或发布门禁的变更必须形成 ADR 或独立预检；
4. 不在多个文档维护相互独立的模块清单；
5. 不大段复制总体架构，视图文档应引用并展开；
6. 不为目录外观创建空模块或空适配器；
7. docs-only 合并不构成 runtime、Schema、Migration、API、UI、Capability 或发布授权；
8. 发现代码与文档不一致时，优先记录差距，不把目标状态伪装为当前状态。

## 11. 当前实施顺序

```text
V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
→ 最小 Architecture／Quality CI
→ MIG-01 后续独立数据 PR
→ 后续既定顺序
```

`V2-02B` 已通过 PR #789 合并。唯一下一任务切换为 `V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT`，但尚未启动；它仍须独立用户授权，且不得自动启动 Architecture／Quality CI、MIG-01A2 或其他 MIG-01 实施切片。

MIG-01 内部候选顺序继续保持：

```text
A2
→ BASE-02
→ Writer
→ Audit／模板
→ B
→ C
→ Reader
```

后续既定数据顺序保持：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 12. 本文禁止的解释

- 本索引不是新架构源；
- 文档存在不代表对应目录、模块或服务已经存在；
- `target` 不等于已实施；
- `current` 不等于正式发布；
- Capability Registry 不等于授权；
- Capability 状态不等于对象或动作权限；
- 角色 Audience 不等于服务端授权；
- 代码合并、测试通过或 Demo 可用不等于七线正式上线。
