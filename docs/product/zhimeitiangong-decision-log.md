# 智美天工产品决策日志

> 文档状态：已记录 PRODUCT-REBASE-01 与 V1-SCOPE-LOCK-01 决策；不代表 runtime 授权。

## 已收口判断

| 日期 | 编号 | 判断 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 2026-06-08 | PRODUCT-REBASE-01 | 智美天工不是 HIS 系统 | 已收口 | 当前产品定位是面向医美 / 美业机构的 AI 客户运营中台 |
| 2026-06-08 | PRODUCT-REBASE-01 | HIS 是数据来源之一，不是产品主线 | 已收口 | HIS 可提供预约、治疗、消费等数据，但不应定义产品主线 |
| 2026-06-08 | PRODUCT-REBASE-01 | 1.0 不应被真实 HIS 接入阻塞 | 已收口 | 1.0 可用人工录入、演示数据或轻量导入验证客户运营闭环 |
| 2026-06-08 | PRODUCT-REBASE-01 | SCRM、随访、复诊、复购、沉睡客户唤醒属于产品主线 | 已收口 | 这些能力直接服务机构客户运营 |
| 2026-06-08 | PRODUCT-REBASE-01 | AI 是运营辅助能力 | 已收口 | AI 应服务话术、建议、分析和辅助沟通，并保留人工确认 |
| 2026-06-08 | PRODUCT-REBASE-01 | 暂停继续扩张 Phase 24 HIS 风险治理线 | 已收口 | credential provider、HIS adapter、external network、scheduler、schema 等不在本轮推进 |
| 2026-06-08 | PRODUCT-REBASE-01 | 先建立产品事实源，再锁定 1.0 范围 | 已收口 | 后续范围、差距和试运行修复应基于产品事实源 |
| 2026-06-08 | V1-SCOPE-LOCK-01 | 1.0 主线锁定为治疗后客户运营闭环 | 已锁定 | 客户档案 / 患者信息、预约到院、治疗摘要、随访任务、复诊复购机会、沉睡客户机会、人工确认、基础看板和审计追踪构成主线 |
| 2026-06-08 | V1-SCOPE-LOCK-01 | 1.0 正式定位锁定为 AI 客户运营中台 | 已锁定 | 不把 1.0 定位为 HIS、EMR、完整 SCRM、完整 BI 或完整 AI Agent |
| 2026-06-08 | V1-SCOPE-LOCK-01 | 主线术语使用客户档案，医疗语境可显示患者信息 | 已锁定 | 避免把智美天工误读为病历系统或 HIS 系统 |
| 2026-06-08 | V1-SCOPE-LOCK-01 | SCRM 是能力描述，不是唯一正式定位 | 已锁定 | 正式定位优先使用“AI 客户运营中台” |
| 2026-06-08 | V1-SCOPE-LOCK-01 | HIS 是数据来源之一，不阻塞 1.0 | 已锁定 | 1.0 可保留 fake / 模拟 / 手工输入能力，不接真实 HIS runtime |
| 2026-06-08 | V1-SCOPE-LOCK-01 | AI 是辅助能力，不做自动医疗决策 | 已锁定 | AI 可用于建议、草稿、标签、提醒和运营洞察，但必须保留人工确认 |
| 2026-06-08 | V1-SCOPE-LOCK-01 | 企业微信 / 微信自动触达后置 | 已锁定 | 1.0 可做触达建议或记录，不做自动发送 |
| 2026-06-08 | V1-SCOPE-LOCK-01 | Phase 24 后续 HIS 风险治理线继续暂停 | 已锁定 | CONFIG、SCHEDULER、AUDIT、OBS、SCHEMA、credential、adapter、external network 等不在本轮推进 |

## V1-SCOPE-LOCK-01 影响范围

- `docs/product/zhimeitiangong-v1-scope.md` 成为 1.0 范围持续维护事实源。
- `docs/product/zhimeitiangong-product-source-of-truth.md` 引用 1.0 范围事实源，并补充定位、HIS、AI、SCRM 与微信触达锁定口径。
- `docs/product/zhimeitiangong-module-map.md` 将模块状态调整为必须、简化、后置、待确认。
- `docs/product/zhimeitiangong-feature-addendum.md` 将后期功能补充调整为不阻塞 1.0 的增强方向。
- 后续 PROD-GAP-REVIEW-01 与 1.0 试运行修复应以本次锁定范围为判断依据。

## 待人工确认问题

- 待人工确认：1.0 是否需要“客服工作台 / 客服记录”作为必须项。
- 待人工确认：AI 在 1.0 中是否真实调用模型，还是只做占位 / 人工辅助。
- 待人工确认：企业微信 / 微信在 1.0 中是否只记录触达建议，还是需要真实接入试点。
- 待人工确认：OneID / SceneID / Event 是否进入 1.0 基础模型，还是全部后置。
- 待人工确认：标签 / 分层采用轻量规则时，具体字段与规则由后续任务确认。
- 待人工确认：沉睡客户机会识别的时间阈值与业务规则由后续任务确认。
- 待人工确认：复购机会提示的项目周期规则由后续任务确认。
- 待人工确认：真实 HIS 是否进入后续试点版本，而非 1.0 正式范围。
- 待人工确认：是否需要单独产品演示版范围，与 1.0 试运行版分开。
- 待人工确认：1.0 发布是否以内部试运行、客户试点还是正式 SaaS 上线为准。

## 后续候选事项

V1-SCOPE-LOCK-01 已在 2026-06-08 完成锁定。当前后续候选仅保留以下事项，不会自动执行。

- PROD-GAP-REVIEW-01：基于产品事实源审查当前系统偏离点。
- 1.0 试运行修复：只处理与客户运营闭环直接相关的问题。

后续候选不自动执行，不代表 runtime、开发任务、schema / migration 或真实外部系统接入已获批准。

## 暂停事项

以下事项在未获得后续明确授权前暂停推进。

- Phase 24 credential provider。
- Phase 24 HIS adapter。
- Phase 24 external network。
- Phase 24 scheduler、runner、worker、queue。
- Phase 24 schema 或 migration。
- 真实 HIS 凭证、真实外网、真实第三方系统接入。
