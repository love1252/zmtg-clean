# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant Membership 权威决策与重绑语义准入
```

## 当前基线

- 权威业务依据 submitted／admitted：`1／1`；
- 业务目标分支：`B5_DETERMINISTIC_REBIND`；
- 当前 A2-P1 唯一已批准并落库 Scope 与目标机构的业务关联：已确认；
- A2-P1 Scope／Context Triplet canonical digest：匹配；
- historical orphan：仍为 1；
- Scope relation orphan：仍为 1；
- historical orphan tenant 与目标 Scope tenant：不一致；
- 当前账号在目标 tenant 的 Membership：0；
- 当前账号在目标 tenant 的 active Binding：0；
- 当前 `rebind` transition：不能直接表示跨 tenant replacement；
- BASE-B5 execution ready：false；
- remediation、Reader、Capability：继续关闭。

## 下一任务目标

完成并独立审查以下决策：

1. 当前账号是否获准进入目标 tenant；
2. 目标 tenant Membership 的角色、revision、provenance、生效与撤销策略；
3. 当前 tenant Membership 的保留、撤销或迁移策略；
4. 跨 tenant Binding 处置采用两步 revoke／create，还是新增 transfer contract／Schema；
5. 如何形成跨 tenant 低敏 correlation evidence；
6. Writer Owner、事务边界、锁、Execution Lease、恢复点和 forward-fix；
7. exact pre-state／post-state 计数与停止条件；
8. 是否需要独立 Schema／Migration 任务。

## 当前禁止

- 不创建或修改 Membership；
- 不创建、更新或撤销 Binding；
- 不执行 historical orphan 重绑；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不把数据库唯一候选替代业务负责人确认；
- 不把业务关联确认写成 remediation 授权；
- 不开放 Reader 或业务 Capability；
- 不把 BASE-B5 或 BASE-02 写成已完成。
