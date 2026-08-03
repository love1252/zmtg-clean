# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 deterministic legacy Binding calibration DML Migration 执行准备
```

## 任务目标

1. 固定最新 main、0045 SQL／journal hash 与三文件实现范围；
2. 只读核验 localhost-only local_acceptance 的 journal、Catalog、Shape 与候选数；
3. 核验 planned／conflict／unexpected 预期值和 historical orphan 原值；
4. 创建全新恢复点并完成隔离恢复验证；
5. 签发全新短期、不可续期 Execution Lease；
6. 形成单次 guarded Migration 执行授权包；
7. 本轮执行准备不运行 Migration。

## 禁止范围

- 未获得明确执行授权不得运行 0045；
- automatic retry 固定为 0；
- 不直接执行 SQL；
- 不修改 Binding current、Membership、Scope、Context 或 orphan；
- 不执行 Scope FK VALIDATE；
- 不启动 BASE-B3～B6。
