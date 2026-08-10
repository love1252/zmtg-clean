# 下一任务

## 唯一下一任务

```text
W5 Analytics exact 6-file Runtime implementation explicit authorization
```

## Admission

```text
w3_knowledge_complete=true
w5_analytics_symbol_callgraph_audit=passed
w5_analytics_admission=passed
w5_canonical_owner=analytics
w5_active_production_writer_callers=0
w5_exact_runtime_file_count=6
w5_runtime_authorized=false
business_writer_phase_complete=false
```

冻结清单：

`docs/operations/base02-w5-analytics-exact-runtime-allowlist-20260810.csv`

W5 Runtime 仅允许建立 Analytics append Writer、阻断 legacy `createUsageRecord`，并保留现有 Readers。

不得修改 `institution-ai-call-service.ts`、机构 AI Route、平台 AI usage Route。不得释放 capability。

必须收到明确 Runtime 授权后才可实施。
