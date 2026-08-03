# BASE-B3 正式 Session／revision 实时重读前置预检独立审查

> 日期：`2026-08-03`
>
> 被审查 PR：#949
>
> 被审查 Head：`7028438765f4ab0d46bf52828d06ad7935823bd8`
>
> 被审查 Merge Commit：`56162452faf974c041994efd946c64a7aff6d543`
>
> Required Check：Run `30806244424`／Job `91662168284`

## 1. 结论

```text
base02_b3_session_revision_preflight_independent_review=passed
formal_login_session_request_roots=all_exact
membership_binding_scope_realtime_read=all_exact
double_read_stability_check=all_exact
formal_cookie_selector_only=true
session_claim_is_authorization_current=false
transition_evidence_as_authorization_current=false
membership_updated_at_fallback_count=0
operating_context_in_authorization_combination=false
fail_closed_matrix=all_exact
runtime_change_required=false
implementation_allowlist_count=0
eligible_for_base_b3_preflight_handoff=true
base_b3_complete=false
base_b4_started=false
```

## 2. 独立核对

- PR #949 只有一个预检 Markdown；
- 登录、Session 恢复和每请求授权组合根均消费 genuine Owner Readers；
- 正式上下文执行 Identity／Membership-Binding／Scope 双轮稳定性比较；
- Membership revision、Binding version/status/expiry 与 Scope revision/status 分属独立 current 域；
- cookie 与 claims 只保存 selector，不保存授权 current；
- transition evidence、缓存、Operating Context 和 `updated_at` 不参与授权 current；
- stale、过期、撤销、多 Membership、缺 Scope、Reader 异常均 fail-closed；
- 现有定向测试与架构门禁已覆盖上述契约；
- 没有必要的 Runtime 变更，implementation allowlist 必须保持 `0`。

## 3. 后续准入

本审查只准入 docs-only handoff，将唯一下一任务切换至：

`BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读契约关闭证据`

本审查不直接把 BASE-B3 写成完成，也不启动 BASE-B4。
