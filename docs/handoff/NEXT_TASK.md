# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 deterministic legacy Binding calibration DML Migration 实施
```

## 精确范围

启动时实时分配 Migration idx；当前无漂移时候选为 0045，但未预留。

只允许：

1. `drizzle/<live_idx>_base02_binding_legacy_calibration.sql`
2. `drizzle/meta/_journal.json`
3. `src/server/db/tests/Schema.test.ts`

## 边界

- 只追加 deterministic legacy Binding evidence；
- Binding current、Membership、Scope、Context 零 mutation；
- Scope revision 固定 NULL；
- historical orphan 原值保持；
- 不连接数据库、不执行 Migration；
- 不修改 schema.ts、Runtime、snapshot、package 或 lock；
- 实施后必须独立审查与 handoff；
- 不启动 BASE-B3～B6。
