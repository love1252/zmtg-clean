# 架构 V2 当前到目标模块映射

- 版本：`V2-01`
- 记录数：34
- 格式：Markdown 表格
- 状态：目标所有权映射，不构成批量移动授权

| 当前路径 | 当前文件 | 目标路径 | 目标所有者 | 处置 | 阶段 | 写入政策 | 说明 |
|---|---|---|---|---|---|---|---|
| src/app/(auth) | 2 | src/app/(auth) | identity | retain | V2-foundation | allow_fix_and_extend | 认证 URL 与正式 session 契约保持兼容 |
| src/app/(marketing) | 1 | src/app/(marketing) | marketing | retain | V2-foundation | allow_fix_and_extend | 官网路由保持 |
| src/app/hospital | 2 | src/app/(institution)/hospital | institution-route-shell | migrate_vertical | V2-02 | compatibility_only_until_move | 使用 Route Group 保持 /hospital URL 不变 |
| src/app/open-platform | 1 | src/app/(platform)/open-platform | platform-route-shell | migrate_vertical | V2-02 | compatibility_only_until_move | 使用 Route Group 保持 /open-platform URL 不变 |
| src/app/api/institution | 82 | src/app/api/v1/institution | institution-api | compatibility_migrate | V2-02/per-stream | legacy_plan_route_family_exception_only | 新实现默认进入 v1；旧七线计划明确端点仅可作为逐路由薄兼容候选，必须有 v1 owner、转发测试、观测、回退和删除门禁 |
| src/app/api/open-platform | 6 | src/app/api/v1/open-platform | platform-api | compatibility_migrate | platform-program | no_new_unversioned_route_without_exception | 按路由族迁移，不批量重写 |
| src/modules/audit | 12 | src/modules/audit | audit | retain | V2-foundation | allow_fix_and_extend | 统一低敏审计能力 |
| src/modules/auth | 20 | src/modules/identity | identity | migrate_vertical | V2-02 | compatibility_only_until_move | 认证与身份归一，保留兼容出口 |
| src/modules/branding | 1 | src/modules/branding | branding | retain | platform-program | allow_fix_and_extend | 品牌资源注册表继续保留 |
| src/modules/care | 14 | src/modules/care | care | canonical_expand | MIG-02/CARE | allow_only_authorized_vertical_slice | MIG-02 承载随访任务、认领、结构化结果和线性路径；客户稳定引用与责任归属由 Customers 提供公共契约 |
| src/modules/customer-center | 14 | src/modules/customers | customers | migrate_vertical | MIG-01C/MIG-02/CUS | allow_only_authorized_vertical_slice | MIG-01C 后启动真实 reader；MIG-02 承载客户稳定引用与责任归属，Customers 是其语义所有者 |
| src/modules/deployment | 2 | src/server/operations/deployment | operations | protected_split | post-release | fix_only | 不与业务领域混放 |
| src/modules/institution | 323 | compatibility-layer -> multiple target modules | legacy-institution | decompose | all-streams | freeze_new_business | 只允许修复、兼容、迁出；禁止新增业务事实 |
| src/modules/institution-analytics | 18 | src/modules/analytics | analytics | migrate_vertical | MIG-05/MIG-06/AN | allow_only_authorized_vertical_slice | MIG-05 只解锁消费事实 reader、有效链和确定性聚合；MIG-06／AN-03C 后才解锁 snapshot repository/API、正式 providers、五页 UI、报告版本、归档和来源变化状态 |
| src/modules/institution-contracts | 22 | src/modules/institution-contracts | institution-contracts | retain | V2-foundation | central_contract_only | 跨线契约唯一声明位置 |
| src/modules/institution-conversations | 24 | src/modules/conversations | conversations | migrate_vertical | MIG-04/CONV | allow_only_authorized_vertical_slice | 会话、消息、分配与身份复核唯一所有者 |
| src/modules/institution-knowledge | 8 | src/modules/knowledge/application/institution | knowledge | merge_vertical | MIG-03/KB | allow_only_authorized_vertical_slice | MIG-03 后才允许 scope-bound repository/current reader 和正式机构页面 |
| src/modules/institution-system | 20 | src/modules/institution-system | institution-system | canonical_expand | MIG-01C/MIG-06/SYS | allow_only_authorized_vertical_slice | MIG-01C 后优先真实只读；MIG-06 只承载持久化渠道安全状态，不拥有外部 adapter 或 Analytics 报告事实 |
| src/modules/institution-workbench | 22 | src/modules/workbench | workbench | migrate_vertical | WB-last | allow_only_authorized_vertical_slice | 只聚合正式 provider，不复制业务事实；Analytics 卡片等待 MIG-06 后正式 provider |
| src/modules/knowledge-base | 24 | src/modules/knowledge/domain | knowledge | merge_vertical | MIG-03/KB | compatibility_only_until_move | 与 institution-knowledge 合并；mock/seed/demo 和旧可覆盖索引不得成为正式 Reader 来源 |
| src/modules/marketing | 4 | src/modules/marketing | marketing | retain | platform-program | allow_fix_and_extend | 营销页面领域 |
| src/modules/open-platform | 186 | split -> tenancy; entitlements; branding; integrations/ai; platform-system | platform-domains | protected_split | platform-program | freeze_new_cross_domain_file | 按业务域垂直迁移，不做一次性搬迁 |
| src/modules/platform-homepage | 2 | src/modules/branding/application/platform | branding | merge_vertical | platform-program | compatibility_only_until_move | 并入品牌应用层 |
| src/modules/security | 39 | split -> src/modules/access-control; src/modules/security | access-control + security | split_vertical | V2-02/security-program | freeze_new_mixed_security_file | membership/provenance/guards/action policy -> access-control；secret encryption、低敏输出、safety switch 保留在 security |
| src/modules/workspace | 29 | split -> src/app/(institution)/hospital/_shell; src/shared/layout; src/modules/workbench | institution-shell | split_vertical | V2-02/post-stream | fix_only | 公共壳与共享布局迁出；业务聚合和工作台投影归 workbench |
| src/shared | 3 | src/shared | shared | retain_with_threshold | ongoing | only_cross_module_reuse | 仅真正跨多个模块复用的能力进入 shared |
| src/server/db | 9 | src/server/db | database-runtime | retain | MIG-queue | central_database_only | 继续作为数据库运行时入口 |
| drizzle | 55 | drizzle | database-assets | retain | MIG-queue | migration_serial_only | 不新建第二套 database/schema |
| scripts | 14 | scripts | scripts | retain_and_extend | ongoing | stable_entry_preserved | 按职责新增 verify/maintenance/release，仅在有实现时建目录 |
| external HIS code | 0 | src/integrations/his | integrations-his | extract_when_authorized | INT-HIS | no_business_module_adapter | 业务模块只消费端口和权威事实 |
| external WeCom code | 0 | src/integrations/wecom | integrations-wecom | extract_when_authorized | INT-WECOM | no_business_module_adapter | 消息必须经 messaging 再到 adapter |
| AI provider code | 0 | src/integrations/ai | integrations-ai | extract_when_authorized | INT-AI | no_business_rule_in_prompt | provider、safety、redaction 与业务输出分离 |
| external Excel code | 0 | src/integrations/excel | integrations-excel | create_when_authorized | INT-EXCEL | no_business_module_adapter | 导入、校验和字段映射由独立 adapter 所有 |
| external webhook code | 0 | src/integrations/webhooks | integrations-webhooks | create_when_authorized | INT-WEBHOOK | no_business_module_adapter | 签名验证、重放防护和投递边界独立 |

## 使用规则

- 当前路径是审计基线，不代表继续新增业务的默认位置。
- 目标路径只在获批垂直切片首次落位时创建。
- `freeze_new_business`、`freeze_new_cross_domain_file` 和 `freeze_new_mixed_security_file` 均为强制写入限制。
- `MIG-02` 是 Customers／Care 共享迁移；`MIG-06` 是 Analytics／Institution System 共享迁移；共享只表示 schema 编排，领域事实仍由各自模块所有。
- 旧七线计划中的 `src/app/api/institution/**` 只保留业务路由族归属；新实现默认进入 v1，旧路径只能作为逐路由薄兼容例外。
