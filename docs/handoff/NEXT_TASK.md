# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C-AUDIT-READER institution-scoped audit readonly reader prerequisite fresh audit + exact Runtime admission
AUDIT_READER_RUNTIME_AUTHORIZED=false
```

## 继承状态

```text
POST_V2_R1C_FAILED_RELEASE_ATTEMPT_GOVERNANCE_CLOSED=true
POST_V2_R1C_RELEASE_COMPLETE=false

PR1163_WORKBENCH_P1_THREAD_RESOLVED=true
PR1163_AUDIT_READER_P1_THREAD_RESOLVED=true
PR1163_TARGET_P1_UNRESOLVED_COUNT=0

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
CONTROLLED_CREATE_RELEASE_COUNT=0

AUDIT_READER_PREREQUISITE_MISSING=true
AUDIT_READER_RUNTIME_AUTHORIZED=false

PRODUCTION_READY_INFERRED=false
PRODUCTION_DEPLOYMENT=false
PRODUCTION_CHANGE=false
```

## 本任务允许的执行顺序

1. 对机构范围审计只读读取器进行新鲜审计；
2. 完成依赖关系与所有权分析；
3. 冻结精确 Runtime 范围并完成准入判断；
4. 仅以文档形式交付准入结果。

## 停止边界

- 当前未授权 Audit Reader Runtime，不得直接开始 Runtime 实现；
- 不得修改 `/api/institution/audit-events`，不得重新放行 `page_system_audit`；
- 不得修改 Route、API、Schema、Migration 或连接数据库；
- 不得推导生产就绪，不得执行生产变更或生产部署；
- 如新鲜审计需要扩大范围，必须停止并获得新的精确授权。
