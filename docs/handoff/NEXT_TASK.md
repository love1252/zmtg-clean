# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 第三批低风险正式 Route Guard capability-off 接线实施
```

## 冻结 Route

`["src/app/api/institution/followup-operations/dashboard/route.ts", "src/app/api/institution/treatment-summaries/route.ts", "src/app/api/institution/wecom-official-dry-run/route.ts", "src/app/api/institution/wecom/customer-mapping-candidates/route.ts"]`

## Section

`["care", "conversations"]`

## 既有兼容性测试

`["src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts", "src/modules/institution/tests/TreatmentSummaryDomain.test.ts", "src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts", "src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts"]`

## 生产调用面证据

`["src/app/api/v1/institution/wecom-official-dry-run/route.ts", "src/modules/institution/client/tenant-business-client.ts", "src/modules/institution/components/WeComCustomerMappingCandidatesReadonlyPanel.tsx"]`

调用面文件只用于回归验证，不自动纳入修改范围。

## 精确 implementation allowlist

`["src/app/api/institution/followup-operations/dashboard/route.test.ts", "src/app/api/institution/followup-operations/dashboard/route.ts", "src/app/api/institution/treatment-summaries/route.test.ts", "src/app/api/institution/treatment-summaries/route.ts", "src/app/api/institution/wecom-official-dry-run/route.test.ts", "src/app/api/institution/wecom-official-dry-run/route.ts", "src/app/api/institution/wecom/customer-mapping-candidates/route.test.ts", "src/app/api/institution/wecom/customer-mapping-candidates/route.ts", "src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts", "src/modules/institution/tests/TreatmentSummaryDomain.test.ts", "src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts", "src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts"]`

共 `12` 个文件。

## 固定实施方式

1. 复用 `src/app/api/institution/_shared/institution-route-guard.ts`；
2. 4 个 Route 分别接入冻结的 Section；
3. Guard 拒绝继续使用 `403 / no-store`；
4. Guard 通过后保持原 `503`、payload 与 no-store；
5. 每个 Route 增加或更新 colocated 接线测试；
6. 既有 handler-contract 测试按需 mock 共享 Guard；
7. 公开 GET 的测试调用必须 `await`；
8. 自动替换不得修改源码字符串断言中的 `function GET`；
9. 完整 `pnpm test`、架构门禁、lint、typecheck 和 build 全部通过。

## 禁止范围

- 不修改共享 Guard；
- 不修改 allowlist 外文件；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不处理动态对象、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
