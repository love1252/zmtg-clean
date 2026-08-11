# POST-V2-R1A Institution Capability Authority Foundation Preflight

> 日期：2026-08-11
>
> 性质：docs-only preflight / Runtime admission decision
>
> Runtime authorization：false
>
> Reader release authorization：false
>
> Capability release authorization：false

## 1. 前置结论

POST-V2-R1 已完成。

```text
page_capability_count=26
eligible_page_count=0
blocked_page_count=26

common_blocker=
current_route_capability_off
+
authority_bearing_capability_status_missing
```

因此 R1A 不逐页实现 26 个 Reader，而只冻结一个公共 Capability Authority Foundation。

## 2. 已存在、禁止重复实现的 Scope authority

现有 Security / Auth / Tenancy 链已经提供：

```text
formal_provenance
fresh_active_membership
active_institution_anchor
trusted_server_clock
```

权威组合由现有：

`InstitutionRequestAuthorizationV1`

承载。

该 sealed authorization 只有在：

- formal server session request owner；
- formal provenance resolver；
- request-bound fresh active membership provider；
- active institution anchor provider；
- trusted `now`；
- guard reference codec；

全部可用时才成立。

R1A 不重新实现这四项，也不修改 Security / Auth / Access Control / Tenancy authority。

## 3. Capability 层真正缺失项

当前 Capability candidate 层仍缺：

```text
authoritative_owner_capability_facts
capability_revision
diagnostic_capability_authority
authority_bearing_decision_evaluator
authority_bearing_CapabilityStatusV1_reader
```

现有 `evaluateInstitutionCapabilityCandidateV1` 与
`readInstitutionCapabilityStatusCandidateV1` 必须继续保持 candidate-only，
不能被 raw claim 直接升级为 authority。

## 4. Authority Owner 决策

R1A 冻结以下职责：

```text
scope authority owner
= existing Security InstitutionRequestAuthorizationV1

capability authority composition root
= src/modules/institution/server/institution-server-runtime.ts

capability decision owner
= src/modules/institution/server/institution-capability-status-evaluator.ts

capability status envelope / evidence seal owner
= src/modules/institution/server/institution-capability-status-reader.ts
```

公共 `CapabilityStatusV1` contract 已经存在，不需要修改。

## 5. R1A Foundation 的 release policy

R1A Runtime 若未来取得明确授权，只允许建立**隐藏态 authority foundation**：

```text
productionRelease=not_released
decision=hidden
```

对全部 36 capability 都不得在 R1A 中产生：

```text
read_only
operational
pilot_released
released
```

因此：

```text
page_release_count_before=0
page_release_count_after_R1A=0
reader_release=false
capability_release=false
```

R1A 只解决“谁有资格产生权威 CapabilityStatusV1”的公共基础问题，
不解决“哪个业务页面已经获准发布”。

## 6. Owner capability facts 最小策略

R1A 不新增真实业务 Provider，也不读取业务数据。

Foundation 中的权威 Owner facts 只允许表达当前保守基线：

```text
codeMaturity = unverified | verified
institutionAuthorization = 由 sealed request authorization 派生
connectionAvailability = not_required | unavailable
dataReadiness = not_required | unavailable
productionRelease = not_released
safeSummary = 固定低敏状态词或 null
```

任何未来将 `productionRelease` 改为 `pilot_released / released` 的事实源，
必须单独进入 R1B 或后续 release Admission。

## 7. Capability revision

R1A 允许在现有 Capability authority implementation 内冻结一个
代码级 revision 常量。

要求：

- deterministic；
- 不来自客户端；
- 不来自 query/header/cookie 任意字段；
- 不来自数据库临时值；
- 修改 revision 必须经过独立 Runtime PR；
- revision 不能单独证明 production release。

## 8. Diagnostic authority

六个 diagnostic page key 继续由现有 public registry 冻结。

R1A authority reader 只有在当前 sealed request authorization
对 `system` section 得到 genuine allowed 结果时，才可返回 diagnostic target。

diagnostic target：

- 只是诊断入口引用；
- 不授权目标页面；
- 不授权业务 action；
- 不允许 provider 自报 URL；
- 不允许绕过当前 request authorization。

## 9. Exact Runtime Allowlist

Runtime 实施范围冻结为 **exact 6 existing files / 0 new files**：

```text
src/modules/institution/server/institution-capability-status-evaluator.ts
src/modules/institution/server/institution-capability-status-reader.ts
src/modules/institution/server/institution-server-runtime.ts
src/modules/institution/tests/InstitutionCapabilityStatusEvaluator.test.ts
src/modules/institution/tests/InstitutionCapabilityStatusReader.test.ts
src/modules/institution/tests/InstitutionServerRuntime.test.ts
```

Allowlist evidence：

`docs/operations/post-v2-r1a-capability-authority-foundation-runtime-allowlist-20260811.csv`

第 7 个 Runtime 文件出现即 STOP / re-admit。

## 10. Explicit Exclusions

R1A Runtime 明确禁止修改：

```text
src/modules/institution-contracts/v1/institution-capability.ts
src/modules/institution-contracts/v1/institution-capability-registry.ts

src/modules/security/**
src/modules/auth/**
src/modules/access-control/**
src/modules/tenancy/**

src/app/hospital/**
src/modules/institution/components/InstitutionCapabilityOffPage.tsx
src/modules/institution-workbench/**

scripts/verify/architecture-quality-rules.json

Schema
Migration
DB
external adapters
```

并禁止：

```text
Reader release
Capability release
Route release
controlled-create action release
production readiness
production deployment
```

## 11. Architecture decision

R1A 不新增文件，因此：

```text
runtime_file_count=6
existing_runtime_file_count=6
new_runtime_file_count=0

architecture_exception_required=false
```

不得新增 AQ004 exception。

## 12. Runtime Acceptance Criteria

未来 Runtime 只有在取得新的显式授权后才可执行，并至少满足：

1. candidate evaluator / reader 仍无法从 raw claims 产生 authority；
2. authority-bearing evaluator 只能消费内部 sealed evidence；
3. genuine `InstitutionRequestAuthorizationV1` 是 scope authority 前置；
4. trusted server clock 来自 server runtime；
5. owner facts 默认 `productionRelease=not_released`；
6. 所有 capability decision 均为 `hidden`；
7. diagnostic target 仅对 genuine system-section authorization 可达；
8. fake/proxy/extra-key/stale/future/scope mismatch 全部 fail-closed；
9. `CapabilityStatusV1` scope 必须精确 tenant + institution；
10. 不读业务数据库来决定 release；
11. 不修改 Route；
12. 不释放 controlled-create actions；
13. exact 6 Runtime files / 0 new files；
14. architecture incremental / typecheck / targeted / full test / lint / build 全通过。

## 13. Stop Conditions

发现以下任何情况必须停止并 re-admit：

- 需要修改 public Capability contract；
- 需要修改 Security/Auth/Access Control/Tenancy authority；
- 需要新增 Runtime 文件；
- 需要 architecture exception；
- 需要修改 Route 或 capability-off 页面；
- 需要产生 `read_only / operational`；
- 需要 `pilot_released / released`；
- 需要业务 DB facts；
- 需要 Schema / Migration；
- 需要真实 HIS / WeCom / AI / Storage / Jobs；
- 需要生产放行。

## 14. Preflight Decision

```text
post_v2_r1a_preflight=passed
post_v2_r1a_exact_runtime_file_count=6
post_v2_r1a_existing_runtime_file_count=6
post_v2_r1a_new_runtime_file_count=0
post_v2_r1a_architecture_exception_required=false

post_v2_r1a_runtime_authorized=false
reader_release=false
capability_release=false
```

## 15. 唯一下一任务

```text
POST-V2-R1A exact 6-file Capability Authority Foundation Runtime implementation explicit authorization
```

在用户给出新的显式 Runtime 授权前，不得执行任何 R1A Runtime 修改。
