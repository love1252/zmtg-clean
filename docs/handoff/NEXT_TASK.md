# 下一任务

## 唯一下一任务

```text
POST-V2-R1A exact 6-file Capability Authority Foundation Runtime implementation explicit authorization
```

## R1A Admission state

```text
post_v2_r1a_preflight=passed

exact_runtime_file_count=6
existing_runtime_file_count=6
new_runtime_file_count=0

architecture_exception_required=false
capability_contract_change_required=false

release_policy=hidden_only

runtime_authorized=false
reader_release=false
capability_release=false
```

Runtime allowlist：

1. `src/modules/institution/server/institution-capability-status-evaluator.ts`
2. `src/modules/institution/server/institution-capability-status-reader.ts`
3. `src/modules/institution/server/institution-server-runtime.ts`
4. `src/modules/institution/tests/InstitutionCapabilityStatusEvaluator.test.ts`
5. `src/modules/institution/tests/InstitutionCapabilityStatusReader.test.ts`
6. `src/modules/institution/tests/InstitutionServerRuntime.test.ts`

## Runtime 目标

未来获批 Runtime 只建立 authority foundation。

所有 capability 必须继续：

```text
productionRelease=not_released
decision=hidden
```

因此不会改变：

```text
page release count=0
reader_release=false
capability_release=false
```

第 7 个 Runtime 文件、新文件、Route、public contract、Security/Auth/Access Control/Tenancy、DB/Schema/Migration 或任何 `read_only/operational` 需求都必须 STOP / re-admit。

只有用户重新明确授权：

```text
授权执行 POST-V2-R1A exact 6-file Capability Authority Foundation Runtime implementation。
```

之后才可进入 Runtime。
