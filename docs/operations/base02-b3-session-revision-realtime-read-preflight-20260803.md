# BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读前置预检

> 日期：`2026-08-03`
>
> 审计 Base：`0b5161dd33fb1d1001999bcbcc65d3014015d0bd`
>
> 状态：`current preflight evidence`

## 1. 结论

```text
base02_b3_session_revision_realtime_read_preflight=passed
formal_login_entry_count=1
formal_session_restore_entry_count=1
request_authorization_root_count=1
membership_revision_realtime_read=true
binding_revision_status_expiry_realtime_read=true
scope_revision_status_realtime_read=true
formal_cookie_selector_only=true
session_claim_is_authorization_current=false
cache_is_authorization_current=false
transition_evidence_as_authorization_current=false
membership_updated_at_fallback_count=0
operating_context_in_authorization_combination=false
stale_revision_fail_closed=true
expired_binding_fail_closed=true
multiple_membership_fail_closed=true
missing_or_inactive_scope_fail_closed=true
runtime_change_required=false
implementation_allowlist_count=0
eligible_for_base_b3_preflight_independent_review=true
base_b3_complete=false
base_b4_started=false
```

## 2. 入口与 Owner 冻结

正式链路当前唯一入口为：

- 登录：`src/app/api/auth/login/route.ts`；
- Session 恢复：`src/app/api/auth/session/route.ts`；
- 正式上下文解析：`src/modules/auth/application/formal-institution-session-context.ts`；
- 正式 Session cookie Owner：`src/modules/auth/server/formal-server-session-provenance-owner.ts`；
- 每请求机构授权组合根：
  `src/modules/institution/server/institution-server-runtime.ts`。

Identity 继续拥有账号与正式 Session，Access Control 继续拥有 Membership／Binding，Tenancy 继续拥有 Scope。Security 只消费 genuine Owner Reader 与 request-bound 引用。

## 3. 三类 revision 实时重读

登录与 Session 恢复均由正式上下文解析器执行：

```text
Identity I1
→ Membership／Binding M1
→ Scope S1
→ Membership／Binding M2
→ Scope S2
→ Identity I2
```

其中：

- Membership 比较 identity、explicit revision、lifecycle 与 role；
- Binding 比较 identity、version、status、assignedAt、expiresAt 与 revokedAt；
- Scope 比较 tenant、institution、status 与 revision；
- 任一读失败、事实漂移、过期、撤销、歧义或非法 Shape 均 fail-closed；
- 只有两轮 Owner facts 完全一致时才签发或恢复 Session snapshot。

每请求机构授权重新创建 genuine Identity／Membership／Scope Reader，并通过 request authorization root 重新读取 current facts。

## 4. Cookie、Claim、缓存与 evidence 边界

正式 cookie payload 精确为：

```text
source
sessionId
accountId
tenantId
institutionId
issuedAt
expiresAt
```

cookie 不保存 role、Membership revision、Binding version、Scope revision、lifecycle、Binding status 或 allow 结果。Session route 只把 claims 用作 selector，随后重新读取三类 Owner facts。

正式授权链不使用 Membership／Binding transition evidence 回答 current，不读取 `tenant_members.updated_at` 作为 revision fallback，也不把 Operating Context 纳入授权组合。

## 5. Fail-closed 矩阵

当前 Runtime 与测试已锁定：

- stale Membership revision；
- Membership revoke／delete／非 active；
- Binding version 漂移；
- Binding revoked、过期、非法来源或 tuple 不一致；
- Scope revision 漂移、缺 Scope、inactive Scope；
- Identity 漂移或 inactive；
- 0 个 Membership tuple；
- 多个 Membership tuple；
- cookie 重复、畸形、过期、错误签名或混合 demo/formal；
- Reader 伪造、Proxy、getter、异常和不可用。

以上均不发布新的正式 Session 或 request authorization。

## 6. 静态范围

本预检核对 `14` 个生产文件与 `10` 个定向测试文件。定向测试、架构检查器自测、增量架构检查、lint 和 typecheck 全部实际通过。

审计结论：

```text
runtime_change_required=false
implementation_allowlist_count=0
```

因此不得为了阶段编号制造无意义 Runtime 修改。下一步只能进行独立预检审查；BASE-B3 尚未正式完成。

## 7. 禁止范围

- 本 PR 只新增本预检 Markdown；
- 不修改 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package 或 lock；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B4～B6、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。
