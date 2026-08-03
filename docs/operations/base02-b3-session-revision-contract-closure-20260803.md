# BASE-B3 正式 Session／三类 revision 实时重读契约关闭证据

> 日期：`2026-08-03`
>
> 关闭 Base：`d1003dc6f882df74302cacc1aed9ef7006f5b253`
>
> 状态：`current closure evidence`

## 1. 结论

```text
base02_b3_session_revision_contract_closure=passed
base_b3_preflight=passed
base_b3_preflight_independent_review=passed
formal_login_entry_count=1
formal_session_restore_entry_count=1
request_authorization_root_count=1
membership_binding_scope_realtime_read=all_exact
double_read_stability_check=all_exact
formal_cookie_selector_only=true
session_claim_is_authorization_current=false
cache_is_authorization_current=false
transition_evidence_as_authorization_current=false
membership_updated_at_fallback_count=0
operating_context_in_authorization_combination=false
fail_closed_matrix=all_exact
runtime_change_required=false
implementation_allowlist_count=0
eligible_for_base_b3_independent_review=true
base_b3_complete=false
base_b4_started=false
```

## 2. 前置链冻结

- 前置预检 PR #949：Head `7028438765f4ab0d46bf52828d06ad7935823bd8`，Merge Commit `56162452faf974c041994efd946c64a7aff6d543`；
- 前置预检 Required Check：Run `30806244424`／Job `91662168284`；
- 独立预检审查 PR #950：Head `4c6f46a3a9d05eb8daf47fb9aa88ba57d56c56c1`，Merge Commit `d18bbfac952608ec8e5cd5df696d1aa985e0a92b`；
- 预检 handoff PR #951：Head `99fd19c7568b6080903b63aa4f9687b09bfd718b`，Merge Commit `d1003dc6f882df74302cacc1aed9ef7006f5b253`。

## 3. 正式入口

正式授权链只有以下组合根：

1. 正式登录：`src/app/api/auth/login/route.ts`；
2. 正式 Session 恢复：`src/app/api/auth/session/route.ts`；
3. 每请求机构授权：`src/modules/institution/server/institution-server-runtime.ts`。

三类入口均通过 genuine Identity、Access Control 和 Tenancy Owner Reader 构建上下文，不接受调用方注入的 role、revision、Scope fact 或 allow 结果。

## 4. 三个独立 current 域

正式登录和 Session 恢复执行：

```text
Identity I1
→ Membership／Binding M1
→ Scope S1
→ Membership／Binding M2
→ Scope S2
→ Identity I2
```

关闭证明包括：

- Membership：identity、explicit revision、lifecycle、role 和 provenance；
- Binding：identity、version、status、assignedAt、expiresAt、revokedAt 和 tuple；
- Scope：tenant、institution、status 与 revision；
- I1／I2、M1／M2、S1／S2 任一漂移均返回 stale／denied／invalid／unavailable；
- 每请求授权重新创建 Owner Readers，读取 current facts 后才形成 request-bound allow。

Membership revision、Binding version 与 Scope／anchor revision 互不替代。

## 5. Cookie、claims 与第二事实源

正式 cookie payload 精确只有：

```text
source
sessionId
accountId
tenantId
institutionId
issuedAt
expiresAt
```

因此：

- cookie／claims 只承担 selector；
- 不保存 role、Membership revision、Binding version、Scope revision、lifecycle、Binding status 或 allow；
- transition evidence 不回答 current；
- 缓存不成为授权 current；
- `tenant_members.updated_at` 不承担 revision fallback；
- Operating Context 不进入正式授权组合。

## 6. fail-closed 矩阵

现有 Runtime 与测试对以下情况全部失败关闭：

- Identity inactive、漂移、非法 Shape 或 Reader 不可用；
- Membership 缺失、歧义、revoke、delete、非 active 或 revision 漂移；
- Binding 缺失、tuple 不一致、非法来源、revoked、过期或 version 漂移；
- Scope 缺失、inactive、跨 tenant／institution 或 revision 漂移；
- 0 个或多个完整 Membership／Binding tuple；
- cookie 重复、畸形、混合 demo/formal、过期或签名错误；
- Proxy、getter、伪造 Reader、伪造 snapshot 或异常。

## 7. 验证与关闭判定

本轮重新核对 `11` 个生产文件，执行 `10` 个定向测试文件，并运行架构检查器自测、增量架构检查、lint 与 typecheck。全部通过。

```text
runtime_change_required=false
implementation_allowlist_count=0
```

现有 Runtime 已满足 BASE-B3 契约，不得制造无意义代码修改。本证据只准入独立关闭审查；BASE-B3 在 handoff 前保持未完成。

## 8. 持续阻断

- 本 PR 只新增一个关闭证据 Markdown；
- 不修改 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package 或 lock；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B4～B6、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。
