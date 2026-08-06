# BASE-B5 仓库外权威业务依据提交契约

> 日期：`2026-08-06`
>
> 本文只定义证据提交和重新准入要求，不构成 remediation、数据库连接或 DML 授权。

## 可接受来源

- 正式组织归属确认；
- 具备责任权限的业务负责人决定；
- 已批准的 Tenancy／Scope Provisioning 决定；
- 已批准的记录无效认定和数据保留政策；
- 可审计治理工单。

## 禁止来源

- PII、病历原文、原始 tenant／institution 双键或数据库行；
- 连接参数、密码、Token、API Key 或凭证；
- 未脱敏数据库导出；
- 模型推断、聊天推断、仓库计数或“只有一个 Scope”的推断；
- 无签发人、日期、适用范围或来源引用的口头结论。

## 分支最低证明

| 分支 | 最低证明 | 当前授权 |
|---|---|---|
| `B5_KEEP_BLOCKED` | 证据不足或未提交 | 保持 |
| `B5_REVOKE_ONLY` | 权威撤销／失效决定 | 否 |
| `B5_DETERMINISTIC_REBIND` | 精确目标 Scope 的组织归属证明 | 否 |
| `B5_PROVISION_THEN_REVIEW` | Scope 不存在及独立 Provisioning 批准 | 否 |
| `B5_CONTROLLED_DELETE_ARCHIVE` | 记录无效证明和数据保留政策 | 否 |

## 当前状态

```text
base_b5_evidence_submission_contract_ready=true
base_b5_evidence_input_template_ready=true
authority_evidence_submitted_count=0
authority_evidence_admitted_count=0
base_b5_selected_branch=B5_KEEP_BLOCKED
historical_orphan_remediation_authorized=false
live_readonly_reprobe_required=true
database_connection=false
dml_execution=false
reader_release=false
base02_complete=false
```
