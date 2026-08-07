# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant transfer controlled execution runner 准入与 exact allowlist 冻结
```

## 已完成

- relation-orphan Option 1 ADR 已收口；
- cross-tenant transfer implementation admission 已通过；
- 4-file minimal implementation PR #1061 已合并；
- Independent Review 已通过；
- targeted / architecture / full tests / typecheck / build 全部通过；
- exact implementation diff 为 4 文件；
- 不存在第 5 文件修改；
- AQ007 已解决；
- canonical Writer、Port、Schema、Migration、AQ008 均未扩大。

## 为什么不能直接执行 remediation

当前 4-file foundation 没有 composition root、API 或 controlled runner。

因此代码虽然已经可复用，但**没有已准入的受控执行入口**。

下一任务只允许：

1. 审计现有 local_acceptance runner / database composition 模式；
2. 选择一次性 controlled execution runner，而不是长期业务 API；
3. 冻结 runner/composition exact allowlist；
4. 冻结 localhost-only / local_acceptance / fail-closed 环境门；
5. 冻结 Scope assertion dependency injection；
6. 冻结 dry-run / execute / outcome-unknown 操作协议；
7. 冻结 execution evidence 与 result log；
8. 判断是否需要第 5 个以上文件，并明确说明原因；
9. 输出 runner admission + independent review + handoff。

## 当前禁止

- 不连接数据库；
- 不执行 DDL/DML/Migration/Seed/FK VALIDATE；
- 不执行 Membership/Binding 实际数据库写入；
- 不执行 historical orphan remediation；
- 不创建 execution runner；
- 不接 API；
- 不开放 Reader/Capability；
- 不做生产变更；
- 不把 BASE-B5/BASE-02 写成完成。
