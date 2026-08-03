# BASE-B4 入口／业务／对象 Guard 与绕过闭环前置预检

> 日期：`2026-08-03`
>
> 审计 Base：`380037dd5fda0d04c128b3bad60f27e3d72890f0`
>
> 状态：`current preflight evidence`

## 1. 结论

```text
base02_b4_guard_bypass_preflight=passed
scope_guard_current=true
section_navigation_guard_current=true
object_guard_current=false
action_policy_current=false
request_authorization_object_action_methods=0
inventory_entry_count=116
api_route_candidate_count=112
server_action_candidate_count=0
formal_guarded_entry_count=2
formal_auth_bootstrap_count=2
capability_off_entry_count=1
review_candidate_count=104
maintenance_candidate_count=2
database_touch_candidate_count=27
membership_binding_touch_candidate_count=2
demo_formal_mixed_candidate_count=2
owner_outside_membership_binding_writer_count=0
business_reader_release=false
runtime_change_required=true
accepted_implementation_path=B4_G1_capability_off_object_action_guard
implementation_allowlist_count=10
eligible_for_base_b4_preflight_independent_review=true
base_b4_complete=false
base_b5_started=false
```

## 2. 当前能力与缺口

当前已具备正式 Scope Guard、Section／Navigation Guard、genuine request authorization、
institution server composition root 和 capability-off Workbench 入口。

当前 request authorization 只公开 section／navigation 方法。仓库中尚无：

- 业务 Owner 对象事实消费 Port；
- Action Policy；
- Object Guard；
- object／action request authorization 方法。

## 3. Owner 与 capability-off 边界

- Security 只拥有 Guard 决策、Action Policy、引用校验和拒绝结果；
- Customers、Care、Knowledge、Conversations 等业务模块继续拥有对象存在性、归属、状态和版本；
- Security 只能消费未来业务 Owner 提供的版本化低敏 Port；
- Security 不得直接读取业务 Repository、内部表、DTO 或原始业务行；
- 当前业务 Reader／Capability 继续关闭，本轮只准入 capability-off 核心实施。

## 4. 入口与绕过清单

本预检新增：

`docs/operations/base02-b4-entry-bypass-inventory-20260803.csv`

清单记录入口类型、Guard 状态、数据库接触、Membership／Binding 接触、demo／formal 混用和当前分类。

`review_candidate_count=104` 代表后续需逐项确认的入口，不等于已证实安全漏洞。
无法枚举的候选入口为 `0`。Owner 外 Membership／Binding direct writer 为 `0`。

## 5. 接受实施路径

```text
accepted_implementation_path=B4_G1_capability_off_object_action_guard
```

实施必须：

1. 新增对象事实低敏消费 Port；
2. 新增注册表驱动的 Action Policy；
3. 新增只接受 genuine request authorization 与 genuine object fact 的 Object Guard；
4. 扩展 request authorization 与 institution runtime；
5. 未接业务 Owner Adapter 时保持 capability-off；
6. 未知 action／object、跨 tenant／institution、陈旧 revision、伪造 handle 和 Provider 异常全部 fail-closed。

## 6. 精确实施 allowlist

1. `src/modules/security/ports/institution-object-fact.ts`
2. `src/modules/security/server/institution-action-policy.ts`
3. `src/modules/security/server/institution-object-guard.ts`
4. `src/modules/security/server/institution-request-authorization.ts`
5. `src/modules/institution/server/institution-server-runtime.ts`
6. `src/modules/security/tests/InstitutionActionPolicy.test.ts`
7. `src/modules/security/tests/InstitutionObjectGuard.test.ts`
8. `src/modules/security/tests/InstitutionRequestAuthorization.test.ts`
9. `src/modules/institution/tests/InstitutionServerRuntime.test.ts`
10. `src/modules/security/tests/InstitutionSectionGuard.test.ts`

任何额外文件都必须停止并拆分独立任务。

## 7. 禁止范围

- 本 PR 只新增本 Markdown 与 CSV；
- 不修改 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package 或 lock；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放业务 Reader／Capability；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
