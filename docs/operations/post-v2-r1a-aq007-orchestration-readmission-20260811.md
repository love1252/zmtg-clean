# POST-V2-R1A AQ007 Orchestration Re-admission

> 日期：2026-08-11
>
> Base：`5480efe3ca7cff365495623a2642f60e15341f11`
>
> Failed local WIP：`3e73952f12de25e036344d949253eb9f4605470b`
>
> 性质：docs-only scope re-admission
>
> Runtime authorization：false

## 1. Why re-admission is required

原 R1A exact-6 Runtime 在本地完成：

```text
targeted_tests=102/102
typecheck=passed
architecture_unit=148/148
full_tests=6599/6599
lint=passed
build=passed
```

但 commit 后 Architecture incremental fail-closed：

```text
AQ007_CROSS_MODULE_SERVER_REPOSITORY=4
architecture_incremental=blocked
```

违规边为：

1. Institution capability evaluator -> Security section guard；
2. Institution capability reader -> Auth formal session owner；
3. Institution capability reader -> Security request authorization；
4. Institution capability reader -> Security section guard。

因此旧 exact-6 设计不能 merge。

## 2. Failed WIP preservation

失败实现保留在本地：

```text
branch=refactor/post-v2-r1a-capability-authority-foundation-20260811
head=3e73952f12de25e036344d949253eb9f4605470b
remote_branch=false
remote_pr=false
reset=false
```

该 commit 只作为失败证据和实现参考，不允许直接 push。

## 3. Architecture correction

跨 Owner authority composition 必须退出：

```text
src/modules/institution/server/**
```

并进入：

```text
src/server/orchestration/**
```

Institution capability evaluator / reader 恢复并保持原 candidate-only 边界。

Security/Auth/Access Control/Tenancy 的 genuine authority 继续由各 Owner 自己拥有。

## 4. Revised authority architecture

新的 R1A Authority Foundation：

```text
Institution Server Runtime
  -> 提供当前 server-only authorization/context 入口
  -> 不新增跨 Owner edge 到 frozen Institution evaluator/reader

src/server/orchestration/institution-capability-authority.ts
  -> 组合 Auth + Security + Institution Contracts
  -> 消费 genuine request authorization
  -> 消费 formal verified session scope
  -> 形成当前 request 的 authority snapshot
  -> 输出 hidden-only CapabilityStatusV1
```

Authority 必须满足：

- no raw caller scope；
- no raw caller role；
- no raw release claim；
- genuine sealed Security authorization；
- verified formal-session scope；
- trusted server clock；
- canonical public capability registry；
- all productionRelease=not_released；
- all decision=hidden；
- page release count=0。

## 5. Revised exact Runtime scope

新 Runtime 冻结为 **exact 3 files**：

```text
1 existing:
src/modules/institution/server/institution-server-runtime.ts

2 new:
src/server/orchestration/institution-capability-authority.ts
src/server/orchestration/institution-capability-authority.test.ts
```

统计：

```text
exact_runtime_file_count=3
existing_runtime_file_count=1
new_runtime_file_count=2
new_orchestration_file_count=2
```

## 6. Files removed from Runtime scope

以下文件退出 R1A Runtime scope，并必须保持 Base 内容不变：

```text
src/modules/institution/server/institution-capability-status-evaluator.ts
src/modules/institution/server/institution-capability-status-reader.ts
src/modules/institution/tests/InstitutionCapabilityStatusEvaluator.test.ts
src/modules/institution/tests/InstitutionCapabilityStatusReader.test.ts
src/modules/institution/tests/InstitutionServerRuntime.test.ts
```

这保证 candidate evaluator / reader 不被升级为跨 Owner authority surface。

## 7. Architecture exception decision

```text
architecture_exception_required=false
architecture_rules_change=false
```

不允许新增 AQ007 exception，也不允许扩大现有 AQ004 exception。

## 8. Release boundary

新 exact-3 Runtime 即使未来获批并完成，也必须保持：

```text
productionRelease=not_released
decision=hidden

page_release_count=0
reader_release=false
capability_release=false
route_change=false
```

## 9. Explicit exclusions

```text
public CapabilityStatusV1 contract
capability registry
Security/Auth/Access Control/Tenancy implementation
hospital Route
capability-off UI
controlled-create action release
DB/Schema/Migration
real HIS/WeCom/AI/Storage/Jobs
production deployment
```

## 10. Stop conditions

发现以下任一情况立即 STOP / re-admit：

- 第 4 个 Runtime 文件；
- orchestration 之外新增跨 Owner server dependency；
- 需要修改 capability evaluator/reader；
- 需要 architecture exception；
- 需要 public contract change；
- 需要 Route change；
- 需要 read_only / operational；
- 需要 pilot_released / released；
- 需要 DB/Schema/Migration；
- 需要 production release。

## 11. Admission decision

```text
post_v2_r1a_aq007_readmission=passed

exact_runtime_file_count=3
existing_runtime_file_count=1
new_runtime_file_count=2

architecture_exception_required=false
runtime_authorized=false

reader_release=false
capability_release=false
```

## 12. Unique next task

```text
POST-V2-R1A revised exact 3-file orchestration Capability Authority Foundation Runtime explicit authorization
```

旧 exact-6 Runtime 授权不得复用。
