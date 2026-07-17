# BASE-03 机构隔离与 MIG-01 技术设计

> **执行边界：** 本文是 `BASE-03` 的 docs-only 技术设计，也是唯一迁移队列中 `MIG-01` 的数据变更申请。本文不授权修改 `src/**`、`drizzle/**`、schema、migration、API、测试、配置或脚本，不授权连接数据库、执行回填、读取凭证、访问外部系统、推送生产配置或开放机构端能力。任何实际 schema、migration、双写、回填、约束收紧和发布动作都必须再次取得用户对精确任务、文件和验证范围的明确授权。

## 一、任务信息

| 项目 | 内容 |
| --- | --- |
| 任务编号 | `BASE-03` |
| 唯一迁移单元 | `MIG-01` |
| 文档日期 | 2026-07-18 |
| 设计基线 | `origin/main` / `4fa0706d74a400055a5259ac3a13eba91d41bd1a` |
| 任务性质 | docs-only 技术设计与数据变更申请 |
| 目标 | 建立可证明的 `tenantId + institutionId` 数据归属、机构运行上下文和机构级审计持久化基础 |
| 非目标 | 页面、API、业务服务、真实 migration、外部系统、凭证、生产放行 |

## 二、设计结论

1. `tenantId` 继续表示租户边界，`institutionId` 表示租户内的机构边界；机构业务事实必须同时绑定二者，二者不可互相替代。
2. 不从客户端参数、当前登录人、负责人、自由文本、fixture、演示数据或“租户只有一家机构”的假设推断历史机构归属。
3. 新增最小 `institution_scopes` 作为机构存在性锚点；它只能由经人工批准的机构 provisioning manifest 创建，不能从账号绑定或业务记录反推。`institution_operating_contexts` 和 `institution_operating_context_versions` 只负责设置及版本，不兼任机构身份来源。
4. `MIG-01` 是一个逻辑迁移单元，采用 `expand → 服务端双写 → backfill（受控回填）→ enforce`。如实施时必须拆为多个 PR，这些 PR 仍属于同一个 `MIG-01`，不得产生另一套机构归属迁移编号。
5. 回填只接受可复核的确定性来源。无法唯一证明归属的记录保持未迁移并阻断 `enforce`，不得填充占位机构。
6. 机构业务表完成迁移后，正式 reader、writer、唯一约束、外键和审计查询都使用 `tenantId + institutionId`；tenant-only 路径不得继续承载机构端正式能力。
7. `audit_events.institution_id` 保持可空，并增加受控机构归因分类，以区分平台/租户事件、已验证机构事件和无法归属的 legacy 事件；新的机构业务事件必须由机构级审计写入口强制写入有效机构锚点。
8. 默认时区为 `Asia/Shanghai`、默认币种为 `CNY`，但必须记录为显式默认来源；不得把默认值伪装成机构人工配置。

## 三、当前事实基线

### 3.1 已存在的机构范围基础

- `auth_account_institution_bindings` 已包含非空 `tenant_id + institution_id`，并限制同一账号在同一租户只有一个 active 绑定。
- 该账号绑定目前只关联 tenant/member，不关联任何机构锚点；它是登录上下文候选来源，不是机构存在性或历史业务归属的充分证据。
- 知识库、客户映射、联系同意、频控及部分渠道安全表已经使用非空 `tenant_id + institution_id`。
- `customers` 已有可空 `institution_id`，并存在 `(tenant_id, institution_id, id)` 唯一约束；该字段尚未完成非空和历史归属闭环。
- `follow_up_path_enrollments`、`follow_up_path_stages`、`follow_up_message_drafts`、`follow_up_customer_timeline_events` 已有可空 `institution_id`，但外键仍主要使用 tenant-only 组合。
- `AccessContext` 已能携带可选 `institutionId`，但现有通用访问范围仍只有 `platform | tenant`，不能证明所有服务端路径已经强制机构隔离。
- `institution_scopes` 与获批 provisioning manifest 只证明机构存在性，并为历史回填提供必要锚点；它们不能单独证明当前用户、成员身份或任何 action 授权。正式 reader/write 仍必须取得 BASE-02B 的来源证明与 fresh active membership，经过 institution-scoped guard，并在具体资源上再次执行 object-scoped guard。

### 3.2 仍缺机构归属的核心事实

| 表或事实 | 当前状态 | MIG-01 目标 |
| --- | --- | --- |
| `customers` | `institution_id` 可空 | 回填后非空；保留并强化 `(tenant_id, institution_id, id)` |
| `appointments` | 无 `institution_id` | 新增、回填、非空；与客户使用三列外键 |
| `treatment_summaries` | 无 `institution_id` | 新增、回填、非空；与客户、预约使用机构范围外键 |
| `follow_up_tasks` | 无 `institution_id` | 新增、回填、非空；与客户、治疗摘要使用机构范围外键 |
| 随访路径、阶段、草稿、时间线 | `institution_id` 可空 | 回填后非空；父子关系全部按机构范围约束 |
| `follow_up_message_templates` | tenant 和 institution 均可空，草稿仅以 `template_id` 单列关联 | MIG-01 只预检三类历史 scope 与跨机构引用；正式模板归属/版本化引用不在 MIG-01 或已冻结的 MIG-02 范围，须另提数据变更申请，能力继续关闭 |
| `audit_events` | 只有可空 `tenant_id` | 新增可空 `institution_id`、归因分类、机构锚点 FK 和查询索引 |
| 机构存在性与运行上下文 | 无机构锚点、设置 head 与版本 | 新增 `institution_scopes`、设置 head 与不可变 version |

### 3.3 当前风险

- 预约、治疗摘要和随访任务只按 tenant 关联客户，同一租户多机构时存在跨机构读取和关联风险。
- 部分下游随访表虽有 `institution_id`，但外键未把该字段纳入，数据库不能阻止子记录与父记录机构不一致。
- 机构审计查询当前主要按 tenant 过滤；没有可靠 `institution_id` 时，运营数据范围和机构详情审计不可证明。
- 登录账号的当前机构绑定不能反向证明历史业务记录的创建机构，尤其不能用于批量猜测旧数据。
- 没有机构运行上下文版本时，经营周期、时区边界和币种口径无法对历史统计稳定复现。

## 四、MIG-01 精确范围

### 4.1 允许纳入的对象

1. 经批准 manifest 驱动的机构存在性锚点、账号绑定锚定和运行上下文版本。
2. 客户、预约、治疗摘要、随访任务及其已有路径/阶段/草稿/时间线子事实的机构归属。
3. 通用审计事件的机构归属字段、索引及历史可归属性分类。
4. 必要的复合唯一约束、复合外键、非空约束、检查约束和机构范围索引。
5. 历史数据只读预检、确定性回填、失败清单、迁移验证和回滚证据。

### 4.2 明确不纳入

- `MIG-02` 的客户稳定外部引用、负责人治理、随访分配/认领/结构化结果和线性路径新模型。
- `MIG-03` 至 `MIG-06` 的知识、会话、经营事实、分析快照、报告或渠道安全新模型。
- 页面、API、路由壳、provider、adapter、worker、scheduler、queue、cron。
- 真实 HIS、ERP、POS、AIBOTK、企业微信、微信客服、OCR、索引或 AI 接入。
- 凭证、环境变量、生产配置、部署和正式导航放行。
- 清洗客户自由文本、重写治疗正文、创建假机构或生成演示数据。

## 五、目标数据模型

### 5.1 机构存在性锚点与 provisioning

计划新增 `institution_scopes`：

| 字段 | 约束与用途 |
| --- | --- |
| `tenant_id` | 非空，引用 `tenants.id` |
| `institution_id` | 非空、稳定；只在当前 tenant 内有意义 |
| `status` | `active \| suspended`；不得用删除表示停用 |
| `provisioning_source` | `formal_onboarding \| approved_migration_manifest` |
| `provisioning_reference_digest` | 非空低敏摘要，引用获批来源，不保存合同正文或外部 payload |
| `approved_by / approved_at` | 非空人工批准证据 |
| `created_at / updated_at` | 非空服务端时间 |

主键固定为 `(tenant_id, institution_id)`，不建立仅按 `institution_id` 的全局唯一假设。首批行只能来自逐 tenant 审批的 provisioning manifest。manifest 必须由正式机构开户/合同侧受控记录或经平台管理员复核的迁移清单形成，至少绑定 tenant、institution、来源记录摘要、批准人、批准时间和清单版本；账号绑定、负责人、客户记录或“整条关系一致”都不能自行创建锚点。

`institution_scopes` 与 manifest 是机构存在和可回填历史记录的必要条件，不是当前成员或 action 的授权证据。任何正式 reader/write 不得仅因锚点或 manifest 存在而放行；必须由 BASE-02B 提供来源证明和 fresh active membership，先经 institution-scoped guard，再在目标对象上经 object-scoped guard。

`auth_account_institution_bindings` 只有在 MIG-01A2 已按获批 manifest 写入全部机构锚点后，才增加 `(tenant_id, institution_id)` 指向 `institution_scopes` 的 `NOT VALID` 复合 FK。BASE-02B 只有在 active 账号绑定指向 active 机构锚点时才能签发机构 `AccessContext`；缺锚点、停用、冲突或过期一律 fail-closed。

### 5.2 机构运行上下文版本

计划新增 `institution_operating_contexts`：

| 字段 | 约束与用途 |
| --- | --- |
| `tenant_id` | 非空，引用 `tenants.id` |
| `institution_id` | 非空、稳定、不可由客户端创建 |
| `revision` | 非空正整数，用于设置命令并发控制 |
| `latest_version` | 非空正整数；`(tenant_id, institution_id, latest_version)` 复合 FK 指向版本表 |
| `created_at / updated_at` | 非空服务端时间 |
| `updated_by` | 非空低敏操作者引用，不保存姓名或凭证 |

主键固定为 `(tenant_id, institution_id)` 并引用 `institution_scopes`。head 不保存 `current_version/pending_version` 指针，因此不存在首次创建的双向 FK；`latest_version > 0`、`revision > 0`，并由事务保证二者单调递增。

计划新增 `institution_operating_context_versions`：

| 字段 | 约束与用途 |
| --- | --- |
| `tenant_id + institution_id` | 非空，引用 `institution_scopes` |
| `version` | 正整数，与机构组成唯一键 |
| `timezone` | 合法 IANA 时区；默认仅允许显式写入 `Asia/Shanghai` |
| `currency` | ISO 4217 三字母代码；首期默认 `CNY` |
| `effective_from_business_date` | 非空本地业务日期；与公共 `effectiveFromBusinessDate` 精确对应 |
| `effective_at` | 非空 UTC 时刻；批准时按当时 current 时区把上述业务日边界确定性换算并冻结 |
| `source` | 精确为 `institution_config \| product_default`，与冻结公共契约一致 |
| `migration_provenance` | 可空低敏迁移摘要；不进入公共 `source` |
| `created_at / created_by` | 不可变创建证据 |

版本行只追加、不覆盖，唯一键为 `(tenant_id, institution_id, version)`，并对 `(tenant_id, institution_id, effective_at)` 建立唯一约束。version 和 `effective_at` 必须相对上一版本严格递增。新增设置命令固定执行：按机构锁定 head 行 → 校验 expected revision/latest version → 查询是否已有未来版本 → 若有则以受控 `pending_change_exists` 拒绝，不覆盖或撤销旧 pending → 插入下一版本 → CAS 更新 head；任一步失败整事务回滚。不得用依赖 `now()` 的 partial unique/check 代替该事务规则。

统一 context provider 以服务端当前时间查询 `effective_at <= now()` 的最大版本作为 `current`，以最小未来版本作为 `pending`，无需 worker/scheduler 或浏览器切换；payload 的 pending 返回冻结的 `effective_from_business_date`。provider 未交付或选择结果不唯一时，能力保持 `disabled`。经营分析按事实发生时间解析对应版本，不能用今天的时区或币种重算旧周期。

首次创建顺序为：先插入已批准的 `institution_scopes`，再在同一事务写入 product-default version 1 和 head revision 1。version 1 固定 `effective_from_business_date=0001-01-01`、`effective_at=0001-01-01T00:00:00Z`，表示系统支持时间范围内的明确 product default；早于该覆盖起点或无法被运行时安全解析的事实返回 `partial/unavailable`，不得猜测。head 只校验 `latest_version` 对应版本存在，可通过版本写入后再插 head 实现，不产生循环引用；空库、失败回滚、悬空 latest version、并发 CAS 和重复 effective_at 必须有 migration test。

### 5.3 核心事实的目标键

| 对象 | 目标唯一键或外键 |
| --- | --- |
| 账号机构绑定 | `(tenant_id, institution_id)` 指向 `institution_scopes`；仅 active→active 才能签发上下文 |
| 客户 | `UNIQUE (tenant_id, institution_id, id)`；`institution_scopes` FK |
| 预约 | `UNIQUE (tenant_id, institution_id, id)`；客户 FK `(tenant_id, institution_id, customer_id)` |
| 治疗摘要 | `UNIQUE (tenant_id, institution_id, id)`；客户和预约均使用机构范围 FK |
| 随访任务 | `UNIQUE (tenant_id, institution_id, id)`；客户和来源治疗摘要均使用机构范围 FK |
| 路径入组 | 机构范围客户、治疗摘要 FK；活动来源唯一键包含 `tenant_id + institution_id` |
| 路径阶段 | 机构范围入组和随访任务 FK；节点唯一键包含 `tenant_id + institution_id` |
| 消息草稿 | 机构范围任务、客户、入组、阶段 FK；稳定 ID 唯一键包含机构；MIG-01 不宣称 template 单列 FK 已机构化 |
| 客户时间线事件 | 机构范围客户 FK；source/event 幂等键包含机构 |
| 消息模板 | 保留现有平台、tenant、institution 三种历史 scope；MIG-01 只做形状/跨机构引用预检，正式版本化引用须另提数据变更申请 |

所有新机构索引以 `tenant_id, institution_id` 开头，再接业务筛选字段。不得只增加 `institution_id` 索引后继续用 tenant-only 查询。

现有 `appointments` 即使完成机构归属，也仍只是当前本地预约记录；MIG-01 不证明其为 HIS 权威预约，不新增时段、占位或送达事实，也不得借迁移把它展示成正式 HIS 预约。

草稿引用模板的预检必须区分：平台模板、同 tenant 模板、同机构模板和跨机构模板。跨机构引用属于冲突并阻断相关数据发布；在另行获批的数据变更交付可由数据库验证的版本化模板引用前，template 只作为非权威历史引用，消息草稿正式能力保持关闭。该数据变更必须由总协调台分配唯一 migration 单元，不得并入已冻结的 MIG-02。

### 5.4 审计事件

`audit_events` 计划新增：

- `institution_id varchar(64) null`，非空时以 `(tenant_id, institution_id)` 引用 `institution_scopes`；
- `institution_attribution` 受控值：`not_applicable | verified | legacy_unattributed`；
- `(tenant_id, institution_id, occurred_at, event_id)` 查询索引；
- `(tenant_id, institution_id, resource, resource_id, occurred_at)` 详情索引。

约束语义：

- `scope = platform` 时 tenant/institution 均为空且 attribution=`not_applicable`。
- tenant 级管理事件要求 tenant 非空、institution 为空且 attribution=`not_applicable`。
- 已验证机构事件要求 tenant/institution 均非空且 attribution=`verified`。
- 无法可靠归属的历史 tenant 事件要求 tenant 非空、institution 为空且 attribution=`legacy_unattributed`；它与合法 tenant 级事件在存储上可区分。
- `institution_id IS NOT NULL` 必须蕴含 `tenant_id IS NOT NULL`，并通过复合 FK 指向有效机构锚点。
- 新的机构业务事件由 `BASE-04` 唯一写入口映射为 `verified`；历史事件只有在资源对象或事务证据能唯一证明机构时才回填，否则持久化为 `legacy_unattributed` 并从机构 reader 排除。
- 审计仍禁止凭证、原始请求体、provider payload、聊天正文、治疗正文、客户自由文本和内部堆栈。

## 六、历史数据预检

实际迁移授权前必须在隔离测试数据库执行只读预检，并保存低敏计数与摘要；不得输出客户姓名、电话、病历号、正文或凭证。

### 6.1 必查计数

1. 每个目标表总行数、`institution_id IS NULL` 行数及按 tenant 分组计数。
2. 每个 tenant 的获批 provisioning manifest 行数、机构锚点数量、active 账号绑定数量，以及 binding→anchor 缺失/停用/冲突数量。
3. 客户已有 institution 与映射/同意/频控等可信子事实的机构是否一致。
4. 预约客户、治疗摘要客户/预约、随访任务客户/治疗摘要的跨机构候选冲突。
5. 路径、阶段、草稿、时间线的自身 institution 与父记录是否一致；草稿→模板属于平台、同 tenant、同机构还是跨机构。
6. tenant-only 唯一键在加入 institution 后是否产生重复或改变幂等语义。
7. 审计事件可通过唯一资源对象归属的数量、无法归属数量和多候选冲突数量。
8. 任何孤儿外键、缺失父对象、空 tenant、未知 institution 或重复机构锚点。

### 6.2 回填证据等级

| 等级 | 允许来源 | 处理 |
| --- | --- | --- |
| A | institution 已存在于获批 provisioning manifest/`institution_scopes`，且记录已有非空 institution、所有可信父子事实一致 | 可回填并进入复核 |
| B | 唯一父事实已达到 A，例如预约唯一关联已验证客户 | 可按父事实传播并记录证据链 |
| C | 机构锚点有效，且两个以上独立权威业务关系给出同一机构 | 可回填，但必须保留来源摘要和计数 |
| D | 仅当前账号绑定、负责人、tenant 单机构假设、自由文本、fixture 或演示数据 | 禁止回填 |
| 冲突 | 多个可信来源给出不同机构 | 阻断迁移，人工回源纠正 |

任何 tenant 即使当前只有一个机构，也不能仅凭这一事实把全部历史记录批量填入该机构。单机构现状不是历史归属证据。

机构存在性与业务归属使用两套证据：provisioning manifest 只证明 `(tenant_id, institution_id)` 是获批机构；A/B/C 业务证据只证明某条记录属于该已存在机构。二者缺一不可，不能互相反推。

### 6.3 建议只读预检形态

实际脚本必须参数化并在审批后单独提交。至少输出以下低敏结果集：

```text
table_name | tenant_id_digest | total_count | resolved_count | unresolved_count | conflict_count
relation_name | mismatch_count | orphan_count
audit_resource | attributable_count | legacy_count | conflict_count
```

严禁把原始行、客户标识、正文、外部账号或凭证写入迁移日志、CI artifact 或 PR 评论。

## 七、实施顺序

### 7.1 Gate 0：实施授权与数据库隔离

- 明确批准实际 schema/migration 的允许文件和回滚窗口。
- 创建独立 migration 分支，并取得唯一迁移队列 lease。
- 使用独立测试数据库或隔离容器；不得与其他 Worktree 共用写库。
- 复核 `.env*` 排除、数据库名称、端口和数据卷，禁止误连生产。
- 先执行第六节只读预检。核心业务事实存在 D 级未决或任何可信来源冲突时阻断 enforce；平台/tenant 合法审计和可分类的 `legacy_unattributed` 审计不阻断 expand，但必须完成分类、计数和机构 reader 排除。

### 7.2 MIG-01A：expand 与锚点 provisioning

- `MIG-01A1` 先新增 `institution_scopes`、机构运行上下文 head/version 表，并为缺失业务表新增可空 `institution_id`。
- `MIG-01A1` 为审计事件新增可空 `institution_id` 和可空 `institution_attribution`；存量在回填前不得被默认分类。
- `MIG-01A2` 在独立事务按获批 provisioning manifest 写入 `institution_scopes`、product-default version 1 和 context head；manifest 未获批或锚点计数不一致即停止。
- 只有 MIG-01A2 锚点就绪后，才创建复合唯一键、辅助索引和 `NOT VALID` 锚点/业务外键；这样 `NOT VALID` 对新增行的即时检查不会因空锚点阻断 BASE-02 双写。
- 应用 schema、SQL、Drizzle metadata 和 schema tests 必须在同一审批单元保持一致。
- 不设置默认 institution，不执行回填，不收紧非空。

### 7.3 BASE-02 后续切片：服务端双写

- 先形成目标表全部 writer 清单，覆盖现有 API、repository、导入、任务、seed、维护脚本、测试 fixture 和可能仍运行的旧实例；任何未纳入清单的 writer 都阻断回填。
- 所有正式 reader/write 都只从已验证服务端 `AccessContext` 取得 `tenantId + institutionId`：必须先由 BASE-02B 证明来源并确认 fresh active membership，再经过 institution-scoped guard；每个客户、任务、审计或其他目标还必须通过自己的 object-scoped guard。`institution_scopes`、provisioning manifest 与账号绑定只提供机构存在性或回填锚点，不能单独授权任何 action。
- BASE-02B 只在 active account binding 指向 active `institution_scopes` 时签发机构上下文；绑定本身不能创建机构锚点。
- 客户端提交的 institution、当前负责人或对象显示字段不能覆盖服务端 scope。
- 父子对象在写入事务内重新验证机构一致性。
- 机构审计写入与高风险业务写入保持事务一致；审计不可写时 fail-closed。
- 在 MIG-01B 前交付单独获批的最小审计兼容 writer：平台/tenant 事件写 `not_applicable`，已验证机构上下文事件写 `verified + institution_id`；现有 `TenantAuditEvent`、mapper、repository 及全部审计调用方未完成兼容前不得开始回填。
- 所有旧 writer 必须升级为双写或明确冻结；capability-off 只控制新页面，不视为旧写入口已关闭。
- 在另行获批的正式版本化模板引用交付前，所有携带 `templateId` 的草稿创建/更新 writer 必须冻结，或先交付单独获批的临时同 scope guard：仅允许平台模板、同 tenant 模板或同机构模板，跨机构一律 fail-closed。仅隐藏页面不算冻结 writer；该临时保护不把模板模型纳入 MIG-02。
- 双写部署完成即建立“禁止回滚到 tenant-only writer”的发布门，混跑旧实例或回滚旧版本均须先冻结目标表写入。
- 记录双写启动高水位，持续监测新增空 institution；进入回填前、回填完成后和 enforce 前各执行一次增量追赶与一致性复核。

该切片是 runtime，必须另行授权；不能混入 MIG-01 docs 或 migration PR。

### 7.4 MIG-01B：受控回填

固定传播顺序：

```text
customers
→ appointments
→ treatment_summaries
→ follow_up_tasks
→ follow_up_path_enrollments
→ follow_up_path_stages
→ follow_up_message_drafts
→ follow_up_customer_timeline_events
→ 可唯一归属的 audit_events
```

- 每一步只使用 A/B/C 级证据，记录批次、规则版本、影响行数和冲突计数。
- 使用幂等更新条件；重复执行不能改变已验证结果。
- 更新前后分别检查父子机构一致性和行数守恒。
- 不覆盖已有非空值；已有值与证据冲突时停止。
- 回填结束只要仍有核心事实未决，便不得进入 enforce。
- enforce 前设置受控静默窗口或等价写入栅栏，使用双写高水位执行最后一次增量复核；发现新空值或未知 writer 立即停止。
- audit_events 只把确定性记录改为 `verified`；合法平台/tenant 事件使用 `not_applicable`，不可归属历史事件使用 `legacy_unattributed`，不要求强行补 institution。
- 回填期间以最小审计兼容 writer 的启动高水位追赶新事件；任何新 `institution_attribution IS NULL` 都阻断 enforce。

### 7.5 MIG-01C：enforce

- 验证并启用复合外键。
- 对客户、预约、治疗摘要、随访任务及机构专属子事实收紧 `institution_id NOT NULL`。
- 把 tenant-only 业务唯一键和父子外键替换为机构范围约束。
- 验证账号 binding、业务事实和非空 audit institution 的机构锚点复合 FK。
- 将 `audit_events.institution_attribution` 收紧为 `NOT NULL`，验证第 5.4 节 shape checks；`institution_id` 仍按分类保持可空。
- `follow_up_message_templates` 与草稿→模板的正式版本化/作用域外键不在 MIG-01 enforce 声称完成；跨机构历史引用必须为 0，相关能力保持关闭，正式模型另提数据变更申请并由总协调台分配唯一 migration 单元。
- 运行同租户双机构、跨机构拒绝、并发、幂等和回滚测试。
- 证明生产代码不再通过 tenant-only repository/API 承载机构端能力后，才允许删除兼容路径；删除仍需独立审批。

## 八、失败与停止条件

出现以下任一条件立即停止，不得进入下一阶段：

- 主线或目标 schema 在实施期间发生未经复核的变更。
- 发现范围外文件、第二个 migration 队列任务或共享数据库写入竞争。
- 任何核心业务目标表存在无法唯一归属的事实；已分类的合法平台/tenant 审计及 `legacy_unattributed` 审计除外。
- 已有 institution 与权威父事实冲突。
- 复合外键验证失败、产生孤儿记录或回填前后行数不守恒。
- runtime 尚未稳定双写，或仍允许客户端控制 institution。
- writer 清单不完整、仍有 tenant-only 实例写入、增量高水位后出现新空值，或无法建立 enforce 静默窗口/写入栅栏。
- 最小审计兼容 writer 未覆盖全部审计调用方，或高水位后出现 attribution 空值/非法 shape。
- 正式模板迁移交付前仍存在未冻结且没有同 scope guard 的 `templateId` 草稿 writer。
- 审计写入不能携带机构范围，或敏感字段进入日志。
- 验证需要真实凭证、外部网络、生产配置或真实 HIS。
- 只能通过默认机构、fixture、演示数据或人工猜测才能继续。

## 九、验证矩阵

### 9.1 Migration 与 schema

- 空库从零迁移和现有最新 schema 升级均成功。
- 重复执行预检/回填不产生第二次变更。
- 同一 tenant 两个 institution 使用相同业务局部 ID 时不串线。
- provisioning manifest 之外的 institution 无法创建锚点，账号 binding 不能指向缺失/停用锚点。
- 跨机构客户、预约、治疗摘要、任务和随访子事实关联被数据库拒绝。
- 草稿引用跨机构模板在预检中被识别并阻断；正式模板引用在独立数据变更获批并交付前保持未发布。
- `NOT VALID → VALIDATE → NOT NULL` 顺序可复现，中间版本保持可运行。
- 失败回滚不删除已验证 institution，也不丢失原始业务记录。

### 9.2 服务端范围

- 缺 tenant、缺 institution、跨机构、未知角色全部 fail-closed。
- 客户端 institution 与服务端上下文不一致时拒绝。
- 管理员、运营、咨询师、客服只读取当前机构及各自正式数据范围。
- tenant-only repository 不得用于机构页面、API 或聚合。
- 父对象属于其他机构时统一返回无权限或不存在，不泄露对象存在性。

### 9.3 审计

- 新机构业务事件持久化 `tenantId + institutionId`。
- 管理员只读取当前机构白名单；运营只读取授权模块及本人低敏操作。
- 平台/租户级事件不会伪装成机构事件。
- `not_applicable | verified | legacy_unattributed` 的 shape checks、机构锚点 FK 和错误组合拒绝通过。
- expand 时 attribution 可空、兼容 writer 后新事件非空、回填后 C 阶段 `NOT NULL` 的完整生命周期通过。
- `legacy_unattributed` 历史审计不进入机构 reader，页面显示明确完整性状态而不是 `0`。
- 审计分页游标、时间排序和同时间 eventId 稳定排序在机构过滤后保持正确。

### 9.4 运行上下文

- 默认 `Asia/Shanghai + CNY` 明确标记 `product_default`。
- 管理员设置按 revision 并发控制，冻结 `effectiveFromBusinessDate + effective_at`，并从批准的下一统计周期生效。
- 运营只读；咨询师、客服无入口。
- 历史周期按对应 context version 解析，不被新配置覆盖。
- provider 由 `effective_at` 确定性派生 current/pending，无 worker、浏览器切换或懒写晋升；选择不唯一时 disabled。
- 不同币种不得直接相加；时区变更跨日、月、季度、年度边界有测试。

### 9.5 必跑命令类别

实际实现授权后至少执行：

```text
schema/migration 定向测试
机构访问与审计定向测试
客户、预约、治疗摘要、随访回归
pnpm exec tsc --noEmit
精确 ESLint
git diff --check
隔离数据库从零迁移、升级、回填、enforce 和回滚演练
```

命令和精确测试文件由实际实现 PR 冻结；本文不创建或运行 migration。

## 十、发布与回滚

### 10.1 发布门禁

只有同时满足以下条件，MIG-01 才可标记完成：

1. 所有核心事实机构归属为非空且可证明。
2. 复合外键、唯一约束和索引已验证。
3. 全部 writer 已盘点，服务端新写入稳定携带机构范围，高水位之后没有新增空值。
4. 机构级审计新事件完整，legacy 覆盖率明确。
5. 四角色和同租户双机构测试通过。
6. 隔离数据库升级、回填、enforce、回滚演练通过。
7. `.env*` 排除的零信任复核、TypeScript、ESLint 和 diff-check 通过。
8. 人工确认实际 migration、回滚窗口和上线顺序。

代码合并不等于导航发布。客户中心、工作台、预约随访、会话、知识库、经营分析和管理中心仍须分别满足自身 capability 门禁。

### 10.2 回滚原则

- `expand` 阶段在双写开始前可回滚应用版本；新增可空列和表先保留，不执行破坏性 drop。
- 双写一旦开始，禁止回滚到 tenant-only writer。确需应用回滚时先冻结所有目标表写入，回滚到仍支持 institution 双写的兼容版本。
- 双写或回填失败时关闭相关 capability、冻结或维持双写、停止新批次，保留证据并修复来源；不得把已验证 institution 清空。
- `enforce` 前保留完整预检和回填快照摘要；约束失败只撤销约束切换，不删除业务记录。
- `enforce` 后若应用回滚，新旧应用都必须能读取新 schema；不允许回滚到会写 tenant-only 新记录的版本。
- 任何需要删除列、表、索引或历史记录的清理工作另立任务并单独审批。

## 十一、后续审批队列

本文通过后仍需按顺序分别授权：

1. `MIG-01A`：expand schema/migration。
2. `BASE-02` 后续 runtime 切片：机构锚点绑定验证、全部 writer 盘点/双写、复合归属校验与 capability-off 验收。
3. 最小审计兼容 writer：扩展事件 DTO/mapper/repository 和全部调用方，只解决 MIG-01 期间新事件 institution/attribution 连续写入，不提前开放 BASE-04 页面能力。
4. 模板保护切片：冻结 `templateId` 草稿 writer，或交付临时同 scope fail-closed guard；正式模板归属/版本化模型另提数据变更申请，由总协调台分配唯一 migration 单元，不得并入 MIG-02。
5. `MIG-01B`：确定性回填、审计分类、高水位追赶和冲突清零。
6. `MIG-01C`：外键验证、业务 institution 非空、audit attribution 非空和 shape 约束收紧。
7. `BASE-04`：机构级审计 reader、正式 writer 治理、角色范围和低敏审计策略。
8. `BASE-05`：统一页面状态和局部失效。
9. 各栏目在最新 `main` 上重新同步并执行自己的机构隔离验收。

`MIG-01` 是现有客户、预约、治疗、随访任务及既有随访子事实 institution 归属/非空回填的唯一所有者；本结论取代 Care 计划中把这些 institution 回填留给 MIG-02 的旧表述。`MIG-02` 只有在 `MIG-01` 完成后才能验证并消费其结果，再处理客户稳定引用、责任归属、认领、结构化结果和新的线性路径最小持久化，不得二次推断或覆盖 institution。消息模板正式归属/版本化引用不属于 MIG-02，必须另提数据变更申请并由总协调台分配唯一 migration 单元。`MIG-03` 至 `MIG-06` 继续严格串行。任何外部集成仍进入独立串行队列，不因本文获得授权。

`CUS-01B` 的客户列表、详情 repository/read-service 只有在 `MIG-01C` 已证明 `customers` 的 `(tenant_id, institution_id)` 归属、复合约束与历史预检通过，并且 `BASE-02` 可提供当前成员的服务端双键上下文后才能开始；不得以旧 tenant-only 列表、当前账号绑定或单机构假设作为过渡回退。七线 reader 同样必须等待其消费的事实完成 `MIG-01` 机构锚点/归属 enforce，并在每次读取重新执行自身模块的角色、对象归属与 capability guard；`MIG-01` 不替代这些 reader 的对象权限或新鲜度/分区状态验收。

## 十二、完成定义

本 docs-only 任务完成仅表示：

- MIG-01 的事实基线、目标表、目标约束和唯一顺序已明确；
- 历史归属采用确定性证据，不允许默认机构或人工猜测；
- 机构运行上下文、核心业务事实和机构级审计的持久化边界已冻结；
- expand、双写、回填、enforce、停止条件、验证和回滚已形成可审查方案；
- 后续实际 schema、migration 和 runtime 仍处于未授权状态。

本文不代表数据库已迁移、机构隔离已上线、审计已达到机构级，也不代表七个栏目可以进入正式导航。
