# BASE-B4 机构端入口清单校准与第一批 Route Guard 接线前置预检

> 日期：`2026-08-03`
>
> 审计 Base：`32d7da0e365b2fbdc5df4133781a6fc2d1f3f665`
>
> 状态：`current preflight evidence`

## 1. 结论

```text
base02_b4_route_guard_first_batch_preflight=passed
source_inventory_count=116
formal_institution_candidate_count=73
first_batch_count=5
first_batch_write_method_count=0
first_batch_dynamic_object_count=0
first_batch_direct_db_count=0
first_batch_demo_signal_count=0
first_batch_guard_chain=scope+section
first_batch_response_contract_change=false
object_guard_required_for_first_batch=false
business_reader_release=false
business_capability_release=false
runtime_change_required=true
implementation_allowlist_count=12
eligible_for_independent_review=true
base_b4_complete=false
base_b5_started=false
```

## 2. 校准原则

原始 116 项清单不直接等于机构端正式 Route：

- 排除 Open Platform、平台管理、demo boundary、维护脚本、正式登录和已受控入口；
- 只保留 `src/app/api/institution/**` 与 `src/app/api/v1/institution/**` 中的待分类 Route；
- 逐文件识别 HTTP method、动态对象参数、数据库直读、demo signal 和现有 formal Guard；
- 按业务域映射 `section` 与潜在 `object_type`；
- 动态对象 Route 固定为 `scope + section + action + object`；
- 集合写 Route 固定为 `scope + section + action`；
- 无对象 ID 的只读聚合 Route 固定为 `scope + section`。

## 3. 第一批选择标准

第一批必须同时满足：

1. 只导出 `GET`；
2. 无动态对象路径；
3. 无直接数据库依赖；
4. 无 demo／mock signal；
5. 无凭证、上传下载、索引、解析、连接测试或外部触达高风险路径；
6. 当前尚未接入 formal Guard；
7. 不要求业务对象事实 Reader。

本轮冻结第一批：

1. `src/app/api/institution/entitlement-usage/route.ts`
2. `src/app/api/institution/knowledge-management/ai-call/usage/route.ts`
3. `src/app/api/institution/knowledge-management/retrieval/route.ts`
4. `src/app/api/institution/knowledge-management/search/route.ts`
5. `src/app/api/institution/knowledge-management/vector-search/route.ts`

涉及 section：`knowledge, system`。

## 4. 接线契约

每个 Route 必须执行：

```text
Request
→ resolveInstitutionServerAuthorizationV1
→ genuine request authorization
→ authorizeCurrentInstitutionSectionV1
→ existing Route handler
```

约束：

- 未登录、Session 无效、Membership／Binding／Scope 不可用时 fail-closed；
- section 不允许时返回固定拒绝响应；
- Guard 通过后才进入既有 Route handler；
- 不从客户端 body、query、header 或 cookie 读取 role／tenant／institution；
- 不改变成功响应结构、业务查询或缓存语义；
- 第一批没有对象 ID，因此不得伪造 Object Guard 调用；
- 第一批不开放新的 Reader 或 Capability。

## 5. 精确实施 allowlist

1. `src/app/api/institution/entitlement-usage/route.ts`
2. `src/app/api/institution/entitlement-usage/route.test.ts`
3. `src/app/api/institution/knowledge-management/ai-call/usage/route.ts`
4. `src/app/api/institution/knowledge-management/ai-call/usage/route.test.ts`
5. `src/app/api/institution/knowledge-management/retrieval/route.ts`
6. `src/app/api/institution/knowledge-management/retrieval/route.test.ts`
7. `src/app/api/institution/knowledge-management/search/route.ts`
8. `src/app/api/institution/knowledge-management/search/route.test.ts`
9. `src/app/api/institution/knowledge-management/vector-search/route.ts`
10. `src/app/api/institution/knowledge-management/vector-search/route.test.ts`
11. `src/modules/institution/server/institution-route-guard.ts`
12. `src/modules/institution/tests/InstitutionRouteGuard.test.ts`

共 `12` 个文件。任何额外文件必须停止并拆分独立任务。

## 6. 测试范围

实施必须覆盖：

- 无 Session；
- 非 genuine authorization；
- Scope／Section 拒绝；
- Guard 异常；
- Guard 通过后 handler 只执行一次；
- 拒绝时 handler、数据库和外部调用均为 0；
- 既有成功响应 contract 不变；
- Route 不接受客户端 role／tenant／institution；
- 相邻未授权 Route 不能继承接线。

## 7. 禁止范围

- 本 PR 只新增前置预检 Markdown 与校准 CSV；
- 不修改 Runtime、业务 Route、业务 Reader、Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放真实业务 Capability；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
