# V1 知识库 MVP 端到端验收收口

任务编号：ZMTG-V1-KNOWLEDGE-BASE-MVP-E2E-ACCEPTANCE-01

日期 / 时区：2026-06-13 / CST +0800

## 结论

- GO: internal controlled MVP demo
- NO-GO: production / real customer data / real model / HIS

本轮结论是：知识库链路可以用于内部受控 MVP demo，可以走 demo upload -> parse -> chunk -> index -> search -> UI demo 的闭环验收；但不能进入生产、真实客户数据、真实模型、HIS 或自动业务写入场景。

## 5 个目标完成情况

目标 1：demo / mock / seed 只读输入与知识库 readonly 契约已具备稳定输入基础，覆盖低敏来源、目录、版本、可见范围、审计、治理总览和只读拒绝态。

目标 2：demo readonly facade 与 API contract 已把 domain 输出整理为后续最小 API / UI 可消费的稳定结构，保持低敏、只读、无自动业务动作。

目标 3：upload / parse / chunk runtime 已限制在 text / markdown / json demo payload，拒绝 unsupported type 和空内容，并稳定生成 document / chunks / chunkIndex / charLength。

目标 4：embedding / vector index / search runtime 与工作台 UI demo 已使用 mock_demo_embedding、本地 deterministic ranking 和 GET search API 接入知识库 demo readonly 面板。

目标 5：本轮新增 MVP E2E 验收测试与收口 review，覆盖 upload -> parse -> chunk -> index -> search -> UI demo，并形成 GO / NO-GO 完成结论。

## 当前能力边界

当前能力可用于内部演示，可走受控 MVP 链路，仅 demo / mock / seed / 低敏数据。

允许能力：

- text / markdown / json demo payload 的受控上传验收。
- 纯文本解析与稳定分块验收。
- mock_demo_embedding 生成低敏索引摘要。
- GET /api/v1/knowledge-base/runtime/search?q=... 只读检索 demo。
- 工作台知识库 demo readonly 面板展示 search UI、loading / error / empty / ready 状态。

禁止边界：

- 真实 HIS。
- credential。
- 真实客户数据。
- 真实模型。
- 生产检索。
- 自动业务写入。
- 自动营销、触达、任务、预约、成交、支付、合同、发票。
- PDF / Word / OCR / 图片 / 二进制解析。

## 验收覆盖

- 上传 text / markdown / json demo payload。
- unsupported type 拒绝、空内容拒绝。
- 生成 document / chunks，chunkIndex / chunkText / charLength 稳定。
- tenant / institution / workspace scope 保持。
- run index job 生成 mock embeddings，provider 为 mock_demo_embedding。
- search API 使用 GET /api/v1/knowledge-base/runtime/search?q=...
- search 返回低敏结果，ranking deterministic。
- 不返回 raw vector / raw payload / credential / prompt / completion。
- UI 中知识库 demo readonly 面板存在 search UI。
- UI 显示 demo search / mock embedding / readonly 边界。
- UI 知识库 search 链路无 mutation 控件。

## NO-GO 说明

本轮不构成以下事项的实现许可：

- production。
- real customer data。
- real model。
- HIS。
- credential 读取。
- 生产检索或向量数据库接入。
- 自动业务写入。

如后续需要进入以上任何范围，必须另开任务，重新声明允许修改范围、验证命令、数据边界、安全审查和回滚策略。

## 后续生产化前置任务清单

1. 真实 HIS / credential / 真实客户数据前置审查：确认数据最小化、脱敏、授权、审计和回滚边界。
2. 文件上传生产化设计：对象存储、大小限制、病毒扫描、文件类型白名单和租户隔离。
3. 文档解析生产化设计：PDF / Word / OCR / 图片 / 二进制解析必须独立审批。
4. embedding provider 生产化设计：模型供应商、credential 管理、调用限流、失败降级和成本控制。
5. 向量索引生产化设计：schema / migration、向量库、索引重建、租户隔离和删除策略。
6. 检索 runtime 生产化设计：权限裁剪、可见范围、审计、缓存、召回质量和安全过滤。
7. UI 生产化验收：明确真实生产检索标识、错误态、空态、权限态和可观测性。
8. 自动业务动作审批：营销、触达、任务、预约、成交、支付、合同、发票必须保持 NO-GO，除非另开高风险任务。
