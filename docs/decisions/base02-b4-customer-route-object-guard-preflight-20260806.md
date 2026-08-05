# BASE-B4 客户只读动态对象 Route Object Guard 接线前置预检

## 结论

```text
base02_b4_customer_route_object_guard_preflight=passed
customer_route_count=3
customer_reader_ready=true
production_object_fact_reader_adapter_count=1
runtime_object_fact_reader_wired=true
shared_section_route_guard_exists=true
shared_object_route_guard_exists=false
current_customer_section_guard_wiring_count=0
current_customer_object_guard_wiring_count=0
current_capability_disabled_handler_count=3
authorization_instance_strategy=fresh_instance_per_gate
section_id=customers
object_type=customer
action=read
generic_object_failure_http_status=403
generic_object_failure_code=institution_object_forbidden
request_inspection_before_allow=false
context_inspection_before_section_allow=false
first_slice_route_count=1
first_slice_implementation_allowlist_count=4
route_wiring_in_preflight=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
dml_execution=false
base_b4_complete=false
base_b5_started=false
next_task=BASE-B4 客户完整时间线 Route Object Guard 最小接线
```

## 1. 当前三条 Route

1. 客户完整时间线；
2. 客户随访概览；
3. 客户随访时间线。

三条 Route 均为 GET，参数均为 `context.params.customerId`，当前均固定返回
低敏、`no-store` 的 503 capability-disabled 响应。三条 Route 当前均未接
Section Guard 或 Object Guard。

## 2. 冻结授权顺序

```text
fresh authorization A
→ authorize section customers
→ only after section allow read context.params.customerId
→ validate customerId
→ fresh authorization B
→ authorize objectType customer + action read
→ verify genuine matching allow
→ invoke existing handler exactly once
```

Request 在 Guard 阶段保持不读取。由于 Formal Request Owner 为消费式权威句柄，
Section 与 Object 不复用同一 Authorization 实例。

## 3. 失败映射

所有 Factory、Section、参数与 Object Guard 失败统一为：

```text
HTTP 403
cache-control=no-store
error=institution_route_forbidden
code=institution_object_forbidden
```

不得向客户端暴露 `scope_unavailable`、`object_denied`、`object_stale`、
`policy_unavailable` 等内部 Guard code。

## 4. 首个窄实施切片

首个切片仅接线“客户完整时间线”：

- 修改共享 Route Guard；
- 修改共享 Guard 测试；
- 修改客户完整时间线 Route；
- 修改客户完整时间线 Route 测试。

获准文件共 4 个。获准实施仍保留原 503 capability-disabled Handler，不读取
业务数据，不开放 Timeline Capability。

## 5. 后续顺序

首个切片完成并独立审查后，再分别处理：

1. 客户随访概览；
2. 客户随访时间线。

## 6. 唯一下一任务

`BASE-B4 客户完整时间线 Route Object Guard 最小接线`
