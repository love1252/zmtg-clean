# BASE-B3 正式 Session／revision 契约关闭独立审查

> 日期：`2026-08-03`
>
> 被审查 PR：#952
>
> 被审查 Head：`1bcbecb2afd22ed341f4f6ee6eea12ab370c61f0`
>
> 被审查 Merge Commit：`12f9dd928aca1899a40d2460c402ce1276add66f`
>
> Required Check：Run `30809405127`／Job `91672299774`

## 1. 结论

```text
base02_b3_session_revision_contract_independent_review=passed
formal_login_session_request_roots=all_exact
membership_binding_scope_realtime_read=all_exact
double_read_stability_check=all_exact
formal_cookie_selector_only=true
second_authorization_current_count=0
membership_updated_at_fallback_count=0
operating_context_in_authorization_combination=false
fail_closed_matrix=all_exact
runtime_change_required=false
implementation_allowlist_count=0
base_b3_closure_checklist=all_exact
eligible_for_base_b3_handoff=true
eligible_for_base_b4_after_handoff=true
base_b3_complete=false
base_b4_started=false
```

## 2. 独立核对

- PR #952 只有一个关闭证据 Markdown；
- 前置预检、独立预检审查和 handoff 均精确冻结；
- 登录、Session 恢复和每请求授权三类入口全部消费 genuine Owner current facts；
- Membership、Binding 与 Scope／anchor 三个版本域独立实时重读；
- 正式上下文双轮稳定性比较完整；
- cookie／claims 只保存 selector；
- transition evidence、缓存、Operating Context 与 updated_at fallback 不成为授权 current；
- stale、过期、撤销、多 Membership、缺 Scope 与 Reader 异常均 fail-closed；
- 当前 Runtime 无需修改，implementation allowlist 为 0；
- 本审查未连接数据库，也未修改 Runtime 或数据资产。

## 3. 阶段判定

BASE-B3 完整关闭条件均满足。当前只差 handoff 正式标记：

```text
eligible_for_base_b3_handoff=true
eligible_for_base_b4_after_handoff=true
base_b3_complete=false
base_b4_started=false
```

本审查不直接启动 BASE-B4。
