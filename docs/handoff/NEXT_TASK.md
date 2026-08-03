# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 deterministic legacy Binding calibration DML Migration 前置预检
```

## 任务目标

1. 只读核对既有 Binding current 与 Membership current Shape；
2. 冻结 `legacy_calibration` eligibility、稳定 command／evidence identity 派生；
3. 冻结 observed status／version／assignmentSource／Membership revision 映射；
4. Scope revision 固定为 `NULL`，不得处理 historical orphan；
5. 冻结 journal predecessor、实时 Migration Lease、恢复点与单次 guarded Migration；
6. 冻结幂等、冲突、高水位、计数守恒、回滚与独立审查标准；
7. 本轮只做前置预检，不执行 DML。

## 禁止范围

- 不修改 Binding current；
- 不创建／修复 Scope；
- 不处理 historical orphan；
- 不执行 Scope FK `VALIDATE`；
- 不连接外部数据库；
- 不启动 BASE-B3～B6；
- 不放行项目级 Writer或业务 Reader。
