# BASE-B5 可核验仓库外权威业务依据低敏提交表（定稿）

> 提交日期：`2026-08-06`
>
> 原始签发单：`BASE-B5-AUTH-20260806-001`
>
> 原始目标机构名称和真实 Scope 映射继续保存在仓库外，本文件不包含原始机构键或数据库键。

```yaml
submission_id: "BASE-B5-EVIDENCE-20260806-002"
submission_status: "draft_only"
submitted_at: "2026-08-06T23:59:00+08:00"
submitted_by_role: "智美天工项目负责人"

authority_source_type: "具备责任权限的业务负责人决定"
authority_issuer_role: "智美天工项目负责人／业务数据责任人"
authority_issued_at: "2026-08-06"
authority_source_reference_low_sensitive: "BASE-B5-AUTH-20260806-001"
authority_original_held_outside_repository: true
authority_verifiable: true

applicable_record_reference_low_sensitive: "BASE-B5-HO-001"
record_scope_is_unambiguous: true

requested_branch: "B5_DETERMINISTIC_REBIND"
business_reason_low_sensitive: "该 historical orphan 的业务归属已经明确，应重新绑定到一个已经存在且唯一确定的目标机构 Scope。目标机构名称和真实 Scope 映射保存在仓库外权威签发单中。"

exact_target_scope_authority_reference: "BASE-B5-AUTH-20260806-001 第三至第七节"
exact_target_scope_authority_verifiable: true

separate_provisioning_approval_reference: ""

invalid_record_authority_reference: ""
retention_policy_reference: ""
retention_policy_allows_requested_action: false

contains_pii: false
contains_raw_tenant_institution_keys: false
contains_database_credentials: false
contains_secret_or_token: false
contains_unredacted_database_export: false
source_document_remains_outside_repository: true

admission_status: "not_reviewed"
admitted_branch: "B5_KEEP_BLOCKED"
remediation_authorized: false
database_connection_authorized: false
dml_authorized: false
```

## 提交声明

1. 本文件只申请 `B5_DETERMINISTIC_REBIND` 重新准入审查；
2. 本文件不直接授权 remediation、数据库连接或 DML；
3. `admitted_branch` 在独立审查前继续保持 `B5_KEEP_BLOCKED`；
4. 原始机构名称和真实 Scope 映射未写入本低敏提交表；
5. 本文件可以上传到当前 ChatGPT 对话用于下一阶段准入审查。
