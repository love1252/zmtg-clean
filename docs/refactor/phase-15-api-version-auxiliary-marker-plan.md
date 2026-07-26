# 第十五阶段：API 版本治理辅助标记方案

- 日期：2026-07-26
- 分支：`refactor/api-version-auxiliary-marker-plan-20260726-134857`
- 基线：`0ec768bbbad7271431bfa1c8ca098e6f064c676e`
- 迁移矩阵总行数：1509
- 主 `API_VERSION_REVIEW`：146
- 运行时边界保留记录：2
- 本阶段迁移矩阵修改：0
- 本阶段 API 文件移动：0
- 本阶段 API 源码修改：0

## 问题

两条路由已经完成运行时边界确认，主字段必须继续保持：

- `recommended_action=RUNTIME_BOUNDARY_CONFIRMED_KEEP_CURRENT`
- `status=runtime_boundary_confirmed`

但两条路由仍需参与 API 版本治理。不能通过覆盖主动作的方式记录该要求。

## 方案比较

### 覆盖 `recommended_action`

拒绝。会丢失已经确认的运行时边界结论。

### 使用复合动作字符串

拒绝。会破坏当前迁移矩阵单一动作语义，并增加自动化解析风险。

### 仅写入 `notes`

暂不采用。可读性较好，但缺少稳定的机器可读键值和独立生命周期。

### 为迁移矩阵增加新列

暂缓。会一次性改变 1509 条记录的矩阵结构，影响范围过大。

### 独立辅助标记注册表

推荐。使用 `current_path` 与迁移矩阵关联，不覆盖主动作和主状态。

建议后续注册表：

`docs/refactor/api-version-governance-auxiliary-markers.csv`

## 建议字段

| 字段 | 含义 |
|---|---|
| `current_path` | 与迁移矩阵稳定关联的路径 |
| `marker_key` | `api_version_governance` |
| `marker_value` | `review_required` |
| `marker_authority` | `supplemental_non_overriding` |
| `primary_action_snapshot` | 主动作快照 |
| `primary_status_snapshot` | 主状态快照 |
| `evidence_source` | 审核和应用证据 |
| `marker_status` | 辅助标记生命周期状态 |

## 两条候选

1. `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts`
2. `src/app/api/v1/knowledge-base/demo-readonly/route.ts`

两条记录都只计划增加辅助标记，不修改迁移矩阵主动作、状态、notes 或任何其他字段。

## 下一阶段准入条件

1. 单独批准创建辅助标记注册表。
2. 注册表首次只能包含这两条记录。
3. 主动作和主状态必须逐字段保持不变。
4. 注册表必须以 `current_path` 为唯一键。
5. 不得修改 API 文件或运行时行为。
6. 不得将辅助标记解释为可迁移或可删除。

## 安全边界

- 本阶段只规划，不创建正式辅助标记注册表。
- 未修改迁移矩阵。
- 未修改或移动 API、源码、测试或脚本。
- 未修改 Schema、Migration、依赖或锁文件。
- 未执行数据库连接、Seed、Migration 或真实外部调用。
