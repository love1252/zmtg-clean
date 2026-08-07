# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 controlled runner local_acceptance readonly preflight、private manifest 签发与 dry-run 授权执行
```

## 已完成

- cross-tenant transfer 4-file foundation 已完成并独立审查；
- controlled runner admission 已通过；
- controlled runner 2-file implementation PR #1067 已合并；
- Runner Independent Review 已通过；
- exact runner diff 为 2 文件；
- controlled execution entry 已存在；
- targeted / architecture / full tests / typecheck / build / Required Check 全部通过；
- 本阶段没有实际连接数据库，没有执行 local_acceptance dry-run/execute。

## 下一任务目标

下一任务不是 remediation execution，而是先完成**只读现场准入**：

1. 新取得 localhost-only `local_acceptance` 数据库只读授权；
2. 只允许 `SELECT` / read-only transaction；
3. 禁止 DDL/DML/Migration/Seed/FK VALIDATE；
4. 通过只读现场重新定位 source/target technical tuple；
5. 生成仓库外 `0600` private manifest；
6. manifest `expectedCodeSha` 必须绑定当时已 review 的 clean `main` HEAD；
7. 只读计算 journal/schema fingerprint；
8. 执行 runner `--dry-run` 一次；
9. 输出低敏 ready/blocked 结果；
10. 不生成 execution lease，不执行 `--execute`。

## 当前仍禁止

- 未授权前不得连接数据库；
- 不执行 `--execute`；
- 不执行 Membership/Binding 实际数据库写入；
- 不执行 historical orphan remediation；
- 不执行 FK VALIDATE；
- 不开放 Reader/Capability；
- 不做生产变更；
- 不宣称 BASE-B5/BASE-02 完成。

## 新授权要求

进入下一任务必须取得类似以下明确授权：

```text
授权连接本机 localhost-only local_acceptance 数据库，执行 BASE-B5 controlled runner readonly preflight、仓库外 private manifest 签发与一次 --dry-run；仅允许 SELECT/read-only transaction，禁止 --execute、DDL、DML、Migration、Seed、FK VALIDATE、Membership/Binding 数据写入、historical orphan remediation 和生产连接。
```
