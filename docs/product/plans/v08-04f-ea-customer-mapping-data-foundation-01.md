# V0.8-04F-EA 客户映射数据基础

日期 / 时区：2026-07-10 CST +0800

任务编号：`V0.8-04F-EA-CUSTOMER-MAPPING-DATA-FOUNDATION-01-CODEX-REVIEW`

## 范围

本任务只建立客户机构归属和企业微信客户映射持久化基础，不包含映射 API、UI、timeline/audit 业务接入、自动匹配或真实企业微信调用。

## 客户机构归属

- `customers.institution_id` 为 nullable，不设置默认值。
- migration 不回填历史客户；来源未知的历史记录继续保持 `null`。
- 新建客户和低敏导入客户只从可信 `AccessContext.institutionId` 写入，request body / 上传行不能覆盖。
- 新导入客户不再生成 `institution_ref:*` 标签，历史标签不删除。
- 保留 `UNIQUE (tenant_id, id)`，新增 `UNIQUE (tenant_id, institution_id, id)`，供机构范围复合外键引用。

## 企业微信客户映射状态

`wecom_customer_mapping_states` 只保存固定低敏 proof 引用和系统内部 ID：

- `id`
- `tenant_id`、`institution_id`、`proof_contact_id`、`proof_employee_id`
- `source_mode`，仅允许 `real_readonly_proof`
- `customer_id`
- `status`，仅允许 `confirmed`、`rejected`、`revoked`
- `decided_by`、`decided_at`、`created_at`、`updated_at`

约束：

- `(tenant_id, institution_id, customer_id)` 复合外键引用 customers。
- `(tenant_id, institution_id, proof_contact_id)` 唯一。
- `(tenant_id, institution_id, customer_id, status)` 查询索引。
- 不对 `customer_id` 设置全局唯一，不持久化 `unreviewed` 或运行错误状态。
- 不保存 `external_userid`、`UserID`、`corpId`、Secret、token、联系方式原文或企业微信原始响应。

## Repository

- 客户 repository 保留 tenant-only 兼容方法，并新增 tenant + institution 的 get/list；list 将 limit 安全限制在 1 至 20，并按客户 ID 稳定排序。
- 映射 repository 独立实现按 scope 查询、插入和带预期当前状态的条件更新。
