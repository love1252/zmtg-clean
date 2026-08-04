# BASE-B4 Owner 外 Writer／Deleter 静态误报校准

> 日期：`2026-08-05`
>
> 校准 Base：`18f1b7f198f14a1077ab0b634628d130490bdadb`
>
> 来源：BASE-B4 全量入口 Guard／绕过闭环终检前置预检

## 1. 结论

```text
base02_b4_owner_writer_false_positive_calibration=passed
prior_owner_outside_direct_writer_count=1
prior_lifecycle_unresolved_count=4
false_positive_count=4
corrected_owner_outside_direct_writer_count=0
corrected_lifecycle_unresolved_count=0
production_change_required=false
route_review_candidate_count_provisional=56
capability_off_unwired_count_provisional=52
base_b4_complete=false
base_b5_started=false
business_reader_release=false
business_capability_release=false
eligible_for_independent_review=true
next_task=BASE-B4 剩余 capability-off 正式 Route 第四批精确校准前置预检
```

## 2. 根因

上一轮临时静态扫描器只识别 `.test.ts/.test.tsx/.spec.ts/.spec.tsx`，
未把 `.test.mjs` 排除在生产候选之外；同时对受保护表名使用纯文本扫描，
把规则常量、错误码和 UI 文案误判为生命周期访问。

因此：

- `architecture-quality.test.mjs` 中的 mutation 片段是 AQ008 负向测试夹具；
- `architecture-quality.mjs` 是治理检查器本身；
- `auth-account-service.ts` 只包含
  `tenant_membership_missing` 业务错误码；
- `TrialDataResetPanel.tsx` 只包含 UI 文案，POST Route 固定返回 503，
  服务端重置写能力已关闭。

## 3. 校准结果

| Path | 原分类 | 校准分类 | 证据 |
|---|---|---|---|
| `scripts/verify/architecture-quality.test.mjs` | `owner_outside_direct_writer` | `test_fixture_non_runtime` | .test.mjs; node:test fixture; protected mutation strings are negative AQ008 test inputs |
| `scripts/verify/architecture-quality.mjs` | `lifecycle_review_required` | `governance_checker_non_runtime` | AQ008 rule implementation; table names are policy constants; no DB runtime import |
| `src/modules/auth/server/auth-account-service.ts` | `lifecycle_review_required` | `semantic_error_code_non_table_access` | only tenant_membership_missing reason string; no protected table symbol or DB import |
| `src/modules/open-platform/components/TrialDataResetPanel.tsx` | `lifecycle_review_required` | `disabled_client_ui_non_writer` | client UI text only; POST route returns fixed 503; reset service write capability disabled |

四项均不是 Owner 外生产 Writer／Deleter，不需要修改生产代码。

## 4. 后续判定

上一轮记录的 `56` 个 Route review candidate 与 `52` 个
capability-off unwired candidate 仍是**宽口径临时扫描结果**，不是实施
allowlist，也不代表 52 个生产缺陷。

下一步只准入：

`BASE-B4 剩余 capability-off 正式 Route 第四批精确校准前置预检`

第四批预检必须重新排除：

- versioned re-export；
- legacy／retired；
- dynamic object；
- write／mixed method；
- direct DB；
- demo／fixture；
- external touch；
- 高风险凭证、HIS、上传下载、解析、索引和真实触达；
- 已有独立 formal Guard；
- 仅字符串、测试夹具和治理工具命中。

## 5. 禁止范围

- 本校准只新增 Markdown 与 CSV；
- 不修改生产 Runtime、Route、Guard、Checker 或测试；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5，不处理 historical orphan；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。
