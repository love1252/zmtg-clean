# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 机构端入口清单校准与第一批正式 Route Guard 接线前置预检
```

## 任务目标

1. 复核 116 项入口清单并排除平台、demo、维护和非正式入口；
2. 将 104 个待分类候选按业务域、读写风险和对象事实 Owner 分组；
3. 选定第一批低风险正式机构 Route；
4. 冻结入口 Scope／Section／Action／Object Guard 接线顺序；
5. 冻结每个 Route 的业务 Owner fact Port、拒绝码和 capability-off／release 状态；
6. 形成精确文件 allowlist、测试范围和回退边界；
7. 前置预检及独立审查完成后才允许实施 Route 接线。

## 禁止范围

- 本预检不修改 Runtime、业务 Route、业务 Reader、Schema 或 Migration；
- 不开放真实业务 Capability；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
