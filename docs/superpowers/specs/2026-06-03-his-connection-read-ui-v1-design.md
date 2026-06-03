# HIS 连接配置只读 UI / workspace 入口 v1 设计

> 日期：2026-06-03
> 状态：HIS 连接配置只读 UI / workspace 入口 Plan Mode 文档。本 PR 只做文档规划，不写代码、不改 UI、不改测试、不新增 API、不改 schema / migration、不改权限、认证或租户隔离，不做凭证管理、测试连接或真实 HIS adapter。

## 0. 本次定位

本 PR 是 **HIS 连接配置只读 UI / workspace 入口 Plan Mode**。目标是规划未来机构端 workspace 中如何以只读方式展示 HIS / 机构系统连接配置入口、列表安全摘要、详情安全摘要、状态说明和安全边界。

本 PR 明确不是：

- 不是 UI 实现。
- 不是 API 实现。
- 不是写入能力。
- 不是凭证管理。
- 不是测试连接。
- 不是 HIS adapter。
- 不连接真实 HIS。
- 不连接任何机构系统。
- 不处理真实客户数据。
- 不写代码。
- 不改 UI。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不保存或读取凭证明文。
- 不保存 raw HIS payload。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果未来实现只读 UI 时发现必须改 API、写入数据、接外部系统、处理真实凭证或处理真实客户数据，必须停止当前只读 UI 范围并单独进入对应 Plan Mode。

## 1. 与现有后端能力的关系

本规划承接已合并的连接配置 schema / migration、只读 repository 和 list / detail 只读 API。

未来只读 UI 只能调用现有只读 API：

- `GET /api/institution/his-connections`
- `GET /api/institution/his-connections/[connectionId]`

UI 必须遵守：

- UI 不传可信 `tenantId`。
- UI 不拼接 query `tenantId`。
- UI 不拼接 header `tenantId`。
- UI 不从 localStorage、URL、body 或外部 payload 决定租户。
- 租户边界由服务端 access context 决定。
- UI 不直接访问 repository。
- UI 不读取 `credentialRef`。
- UI 不读取 raw payload。
- UI 不展示服务端未返回的字段。

当前 API DTO 已不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw HIS payload。未来 UI 规划必须继续以 API DTO 白名单为准，不从 repository read model 或数据库字段反推展示内容。

## 2. UI 展示目标

未来机构端 workspace 可增加一个只读入口，用于机构人员查看本租户 HIS / 机构系统连接配置的安全摘要。

建议展示目标：

- HIS 连接配置入口：在机构端导航中新增清晰入口，例如“连接配置”或“HIS 连接”。
- 连接列表安全摘要：按连接展示连接名称、来源系统、厂商类型、系统类型、连接状态、健康状态、凭证是否已配置、最近检查时间和最近稳定错误码。
- 连接详情安全摘要：点击列表项后展示详情区域或详情抽屉，只展示同一批安全字段，可补充创建 / 更新时间和撤销时间。
- 状态说明：展示连接状态、健康状态和凭证配置状态的中文文案。
- 只读边界说明：明确当前页面只用于查看，不支持创建、编辑、暂停、恢复、撤销、删除、凭证录入或测试连接。
- 后续操作占位说明：可展示稳定占位文案，例如“配置凭证、测试连接、启停连接需后续单独实现”。

这些 UI 文案只代表界面展示，不代表测试连接、健康检查、真实 HIS 调用、凭证写入或真实 adapter 已实现。

## 3. 入口规划

未来 workspace 入口建议遵循现有机构端模式：

- 在 `institutionNavItems` 中增加一个机构端入口，例如 `hisConnections`。
- 在 `InstitutionWorkspace` 中将该入口加入真实页面集合时，必须只渲染只读 shell。
- 入口标签应突出“只读”或“配置状态”，避免让用户误以为可在当前页面写入凭证或发起连接测试。
- 移动导航和桌面导航都应展示同一入口状态。
- 首页或侧栏如展示摘要，只能展示聚合安全状态，例如连接总数、异常连接数、缺失凭证数；不展示租户 ID、凭证引用、外部错误全文或客户业务明细。

建议入口文案：

- 导航：`HIS 连接`
- 页头 eyebrow：`外部连接只读状态`
- 页头 title：`HIS 连接配置`
- 页头 description：`查看当前机构已登记连接的安全摘要，不展示凭证、raw payload 或外部错误全文。`
- 右侧 badge：`当前机构只读`

## 4. 列表卡片规划

列表卡片应服务于快速扫描，不承载写入操作。

每个连接卡片建议包含：

- 连接名称：`connectionName`
- 来源系统：`sourceSystem`
- 厂商类型：`vendorType`
- 系统类型：`systemType`
- 连接状态：`status`
- 健康状态：`healthStatus`
- 凭证是否已配置：`credentialConfigured`
- 最近检查时间：`lastCheckedAt`
- 最近稳定错误码：`lastErrorCode`
- 更新时间：`updatedAt`

列表交互建议：

- 点击卡片或“查看安全详情”按钮后加载详情 API。
- 列表不显示 `tenantId`。
- `connectionId` 可以只作为 React key、详情请求路径参数和辅助 aria label，不必作为主要可见字段。
- 列表不提供“新增连接”“编辑连接”“配置凭证”“测试连接”“暂停”“恢复”“撤销”“删除”等可执行按钮。
- 如需要展示后续操作，只能是禁用态或说明文案，不能发起写入请求。

## 5. 详情区规划

详情可以采用现有安全详情抽屉、右侧详情区或列表下方详情面板。无论采用哪种布局，都只能展示安全摘要。

详情建议包含：

- 连接名称、来源系统、厂商类型、系统类型。
- 连接状态、健康状态、凭证是否已配置。
- 最近检查时间、最近稳定错误码。
- 创建时间、更新时间、撤销时间。
- 只读边界说明。
- 后续操作占位说明。

详情不应展示：

- 凭证引用。
- 凭证明文。
- 外部请求 / 响应详情。
- HIS 原始 payload。
- 外部系统错误响应全文。
- 客户、患者、治疗、病历或咨询明细。

详情 `not_found` 时必须展示稳定错误态，例如“连接不存在或不可见”，不得泄露跨租户目标是否存在。

## 6. 允许展示字段

列表 / 详情只允许展示以下安全字段：

- `connectionId`
- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`
- `status`
- `credentialConfigured`
- `healthStatus`
- `lastCheckedAt`
- `lastErrorCode`
- `createdAt`
- `updatedAt`
- `revokedAt`

其中 `connectionId` 可仅作为内部 key、详情请求路径参数、测试选择器或无敏感 aria 辅助文本使用。UI 不需要把 `connectionId` 作为主视觉字段。

`lastErrorCode` 只能展示稳定错误码或安全中文映射，不得展示外部系统错误响应全文。

## 7. 禁止展示字段和内容

UI 严禁展示：

- `tenantId`
- `deletedAt`
- `credentialRef`
- 凭证明文。
- token。
- secret。
- API key。
- OAuth token。
- basic auth。
- 签名密钥。
- 私钥。
- 连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- 外部系统错误响应全文。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。
- 客户业务明细。

UI 也不得通过调试面板、详情 JSON、tooltip、data attribute、错误文案、空态说明或日志式文案间接暴露上述内容。

## 8. UI 状态文案

连接状态中文文案建议：

| 状态 | 展示文案 | 说明 |
| --- | --- | --- |
| `draft` | 草稿 | 已登记但未启用或尚未完成配置。 |
| `active` | 已启用 | 表示配置状态为启用，不代表当前页面执行过测试连接。 |
| `paused` | 已暂停 | 表示连接被暂停，不代表当前页面可恢复。 |
| `revoked` | 已撤销 | 表示连接已撤销，恢复能力需后续单独规划。 |
| `deleted` | 已归档 | 仅为未来归档展示文案；当前只读 API 默认不返回软删除记录。 |
| `error` | 异常 | 表示存在稳定异常状态或错误码，不展示外部错误全文。 |

健康状态中文文案建议：

| 状态 | 展示文案 | 说明 |
| --- | --- | --- |
| `unknown` | 未检查 | 没有最近检查结果，或测试连接能力尚未实现。 |
| `healthy` | 正常 | 只表示已有安全健康状态为正常。 |
| `degraded` | 降级 | 只展示稳定降级状态和安全错误码。 |
| `failed` | 失败 | 只展示稳定失败状态和安全错误码。 |

凭证配置文案建议：

- `credentialConfigured: true`：`已配置凭证引用`
- `credentialConfigured: false`：`未配置凭证`

必须明确：这些只是展示文案，不代表测试连接、真实 HIS 调用、凭证写入、凭证读取或真实 adapter 已实现。

## 9. 错误态和空态

无连接空态：

- 标题：`暂无 HIS 连接配置`
- 描述：`当前机构尚未登记连接配置。配置凭证、测试连接和启停连接需后续单独实现。`
- 不显示“去创建”按钮，除非后续 create / update API 已单独实现并通过审查。

API 加载失败：

- 401：`登录状态已失效，请重新登录`
- 403：`当前账号没有查看 HIS 连接配置的权限`
- 404 详情：`连接不存在或不可见`
- 503：`HIS 连接配置暂时不可用`
- 其他稳定失败：`HIS 连接配置请求失败`

错误态必须遵守：

- 不暴露 SQL。
- 不暴露 stack。
- 不暴露 token、secret、API key、OAuth token、basic auth、签名密钥、私钥或连接串。
- 不暴露 `DATABASE_URL`。
- 不暴露外部系统错误响应全文。
- 不暴露 raw HIS payload。
- 不暴露客户业务明细。

无权限 / 未登录展示边界：

- 未登录只展示登录失效或请先登录类稳定文案。
- 无权限只展示权限不足类稳定文案。
- 不展示连接数量、连接名称、厂商、健康状态或错误码。

详情 `not_found` 展示边界：

- 跨租户连接、不存在连接、已归档连接或空 ID 都应展示同一稳定文案。
- 不泄露跨租户目标是否存在。
- 不显示该目标连接名称、厂商、状态或错误码。

## 10. 安全边界结论

只读 UI 的核心边界：

- UI 只消费已有只读 API。
- UI 不负责连接配置写入。
- UI 不负责凭证写入、读取、轮换、撤销或销毁。
- UI 不负责测试连接。
- UI 不负责健康检查执行。
- UI 不接真实 HIS。
- UI 不展示 `credentialRef`。
- UI 不展示凭证明文。
- UI 不展示 raw HIS payload。
- UI 不展示外部系统错误全文。
- UI 不展示客户业务明细、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- UI 不创建治疗摘要。
- UI 不创建随访任务。
- UI 不自动触达客户。

只读 UI 的成功标准是让机构人员能安全理解“已有连接配置的状态”，而不是完成连接配置、验证连接或处理外部系统数据。

## 11. 后续 PR 拆分建议

建议后续拆成：

- PR A：只读 UI Plan Mode（当前 PR）。
- PR B：workspace 入口轻量 UI 实现。
- PR C：只读 UI smoke / 文档收尾。
- PR D：create / update API Plan Mode。
- PR E：凭证管理 Plan Mode。
- PR F：测试连接 Plan Mode。
- PR G：真实 HIS adapter Plan Mode。

只读 UI 实现不得混入写入 API、凭证管理、测试连接、真实 HIS adapter、患者身份匹配、自动摘要、自动任务或自动触达。
