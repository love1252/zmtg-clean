# Post-V2 Roadmap Re-baseline

> 日期：2026-08-11
>
> Base：`c9da9cd799268d0fc1439e2cbb60b91068cd5630`
>
> 前置：Architecture V2 refactor/governance phase 已闭环
>
> 性质：docs-only roadmap re-baseline

## 1. 当前事实

```text
architecture_v2_refactor_complete=true
architecture_v2_target_fully_realized=false
business_writer_phase_complete=true

reader_release=false
capability_release=false
production_ready_inferred=false
production_deployment=false

post_v2_backlog_requires_separate_admission=true
```

旧 Architecture V2 授权已经结束。任何 post-V2 工作必须重新定义 goal、base、scope、authorization、validation 和 stop conditions。

## 2. Post-V2 候选优先级

| Priority | Candidate | 价值 | 风险 / 外部依赖 | 结论 |
|---|---|---|---|---|
| P1 | Institution Readonly Reader / Capability Release Readiness Audit | 直接决定现有机构端只读能力能否进入正式 release 评估 | 低；docs-only audit，不改 Runtime/DB/外部系统 | **唯一下一阶段** |
| P2 | Platform / Audit / Workspace later-or-outside-phase review | 清理 V2 原 intentionally-later 范围 | 中；跨多个 Owner | P1 后重新评估 |
| P3 | W2-P2B compatibility delegate / AQ004 exception retirement | 降低 active compatibility debt | 中；当前仍有 production caller，需 Runtime admission | 非 blocker，暂不抢占 P1 |
| P4 | Real HIS / WeCom / AI / Storage / Jobs adapters | 形成真实外部闭环 | 高；需要凭证、外部系统和环境授权 | 后置 |
| P5 | Test / Staging / Production readiness + seven-line formal release | 正式发布价值最高 | 最高；依赖环境、业务验收和前序 capability decision | 最后独立阶段 |

## 3. 为什么 P1 优先

当前 capability 基础已经具备：

```text
public capability registry=36
section capabilities=7
page capabilities=26
controlled-create actions=3
```

但 registry 只是 declaration registry，不拥有 release authority。

当前 capability Evaluator / Reader 明确保持：

```text
non_authorizing_candidate
```

即使输入 claim 自称：

```text
authorized
ready
released
```

也不能生成权威 `read_only` / `operational` 状态。

当前 frozen owner requirements：

```text
formal_provenance
fresh_active_membership
active_institution_anchor
owner_capability_facts
trusted_server_clock
diagnostic_route_guard
capability_revision
```

因此下一阶段应先审计这些权威前置，而不是直接修改 capability status 或打开页面。

## 4. P1 审计对象

P1 只审计 26 个 `kind=page` capability。

明确排除：

```text
7 section navigation keys
3 controlled-create action keys
write capability release
production activation
```

P1 对每个 page capability 只输出 readiness classification：

```text
eligible_for_future_readonly_release_slice
blocked
outside_initial_readonly_release
```

P1 不直接把任何 capability 改为 released。

## 5. P1 审计维度

每个 page capability 至少核验：

1. canonical route 与 public capability key 一致；
2. formal request provenance；
3. fresh active membership；
4. active institution anchor；
5. Owner 提供的 capability facts；
6. trusted server clock / freshness；
7. diagnostic route guard；
8. capability revision；
9. current Route 是否 capability-off；
10. Reader 是否只读 / GET-only；
11. DTO 是否低敏且 tenant+institution scoped；
12. Reader / Route / UI tests 是否存在；
13. 是否依赖真实 HIS / WeCom / AI / Storage / Jobs；
14. 是否需要 Schema / Migration / DB execution；
15. production release evidence 是否真实存在，而不是自报 claim。

## 6. 后续 release 原则

P1 Audit 通过后仍不能自动 release。

它只能冻结未来最小 release slice，并决定该 slice 是否需要：

```text
Runtime implementation admission
Reader release authorization
Capability release authorization
environment validation
production release authorization
```

任何写能力继续独立处理。

## 7. 下一阶段

```text
POST-V2-R1 Institution Readonly Reader/Capability Release Readiness Audit
```
