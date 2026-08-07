# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant transfer orchestration 实现准入与 exact allowlist 冻结
```

## 当前已接受

- relation-orphan 终态方案：Option 1；
- M09-A immutable/no-delete 保持不变；
- active authorization orphan 必须清零；
- active Scope relation orphan 必须清零；
- revoked 且 evidence 完整的 historical relation orphan 允许保留 1；
- XT09：`resolved_by_adr`；
- XT10：仍需真实执行与独立 postcheck 才能进入完成审查。

## 下一任务只做

1. 审计现有 Access Control Membership/Binding Owner 服务、transaction-bound UoW、composition root 和 AQ008；
2. 冻结 cross-tenant transfer orchestration exact source/test allowlist；
3. 冻结 application/server transaction contract；
4. 冻结 command/evidence correlation contract；
5. 冻结未来实现测试矩阵；
6. 判断是否确实无需 Schema/Migration；
7. 输出 implementation admission + independent review + handoff。

## 当前禁止

- 不连接数据库；
- 不执行 DDL、DML、Migration、Seed、FK VALIDATE；
- 不创建或修改 Membership/Binding；
- 不执行 historical orphan remediation；
- 不直接开始代码实现；
- 不开放 Reader 或 Capability；
- 不把 BASE-B5/BASE-02 写成完成。
