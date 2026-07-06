# 产品文档目录规范

本文档用于统一 `docs/product/` 下的产品文档归档口径，避免计划、验收、测试和决策材料混放。

## 目录口径

| 目录 | 用途 |
| --- | --- |
| `docs/product/plans/` | 开发计划、任务方案、切片设计。 |
| `docs/product/acceptance/` | 验收报告、端到端验收、上线前检查。 |
| `docs/product/test-plans/` | 测试计划、测试矩阵。 |
| `docs/product/baselines/` | 产品状态基线、阶段快照。 |
| `docs/product/decisions/` | 设计决策、范围决策、边界决策。 |

## 使用规则

1. 新增开发方案、任务拆分、切片设计时，优先放入 `docs/product/plans/`。
2. 新增本地验收、端到端验收、上线前检查或收口报告时，优先放入 `docs/product/acceptance/`。
3. 新增测试矩阵、测试覆盖计划和测试策略时，优先放入 `docs/product/test-plans/`。
4. 新增产品状态基线和阶段性快照时，优先放入 `docs/product/baselines/`。
5. 新增范围、边界、设计取舍等稳定决策时，优先放入 `docs/product/decisions/`。

部分目录当前可能尚不存在；本规范只说明归档口径，不要求为不存在的分类创建空目录。
