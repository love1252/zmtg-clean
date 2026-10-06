# DATA-SOURCE-01：客户来源证据只读卡开发规格

## 目标、状态与范围

- 日期：2026-10-06，Asia/Shanghai。
- 对应 [第三批开工核对](2026-10-06-third-batch-readiness-01.md)，基线 `f19a42a8dd657af758088de517fe58d3d8d7b22b`。
- 本文是**拟议 runtime 任务规格，尚未实施**；本轮只提交文档，后续按用户对该任务的授权实施。
- 目标：工作人员从 V1.1 的真实客户列表打开客户抽屉后，能判断本系统是否保存了该客户的可核验 Excel 导入关联，并看到批次引用、客户 Sheet 行号及导入批次记录时间。
- 只读、不调用模型、不新增数据库对象。保留现有本地开发和导入读取权限限制；不承诺生产上线。

本切片仅解决来源元数据可见性，不实现资料完整度百分比、重复客户识别、来源可靠性评分、逐字段血缘、资料修复、画像、机会确认、外部 HIS／微信、真实数据库验收或部署。第一版也不增加负责人／项目意向填写状态，避免把资料检查混入来源任务。

## 1. 界面与业务语义

入口固定为 [Approved 脚本](../../../src/modules/institution-v11-preview/server/approved-prototype-assets.ts)中的真实客户列表 `preview-customer-record → openCustomerRuntimeRecord`，使用该次正式列表记录的 `customerId`。客户抽屉新增“查看来源证据”动作及只读卡；只有用户触发动作才请求来源接口。

| 状态 | 展示内容 | 必须保持的含义 |
| --- | --- | --- |
| 加载中 | 正在读取来源证据 | 清除上一客户或上次请求的来源卡，不显示旧证据 |
| 一条有效关联 | 已找到 Excel 导入记录；批次引用、客户 Sheet 行号、导入批次记录时间 | 只证明本系统保存了该客户的导入关联，不证明当前每个字段均来自该行或上游真实可靠 |
| 查询成功，无关联 | 未找到可核验的 Excel 导入记录 | 来源未知，不推断为手工创建、无来源、未导入或资料质量为零 |
| 多条有效关联 | 存在多条导入关联，待核对 | 不选择一个作为唯一来源，不判断为重复客户，不显示伪造的精确关联总数 |
| 无权限／客户不可见 | 固定低敏提示 | 不泄露其他机构对象或残留原卡片 |
| 读取失败／证据损坏 | 来源证据暂不可用，可重试 | 不降级为“无记录”，不显示原型来源或旧成功数据 |

成功响应另外展示“主档更新时间”和“本次读取时间”，与“导入批次记录时间”分开。不使用“最近同步”或“来源已验证”的总括标签。首版只展示批次引用，不新增跳转或导入详情深链接；历史列表只有最近 20 批，不能假设目标批次一定在该列表中。

关闭抽屉、切换客户、离开客户列表或再次请求，均使旧请求失效。迟到的成功和失败响应都不能覆盖新客户状态、重开抽屉或恢复旧证据。HTML 展示沿用文本转义，不插入服务端原始错误消息。

旧 `openCustomerEvidence` 使用 `customer(id)`、`c001` 回退和 `DATA.institution.updated`，保持原型身份，不作为本切片查询输入或正式证据回退。新入口必须来自真实记录，不能仅通过路由尾段推导客户身份。正式 React 客户详情接线不在首版范围。

## 2. 拟议只读接口

新增 `GET /api/v1/institution/customers/[customerId]/source-evidence`。该接口当前不存在，本文定义后续实现契约。

- 不接受查询参数、客户端机构／租户／角色或证据时间；不新增写方法。
- 客户标识使用现有受控客户读取的稳定标识校验，非法或不可见客户按 404 处理。
- 全部响应使用 `Cache-Control: no-store`，客户端请求同样禁用缓存。
- 不返回姓名、手机号、证件、文件名、创建人、外部编号、原始载荷或任何摘要。

拟议 200 响应字段：

```ts
type CustomerSourceEvidenceV1 = Readonly<{
  kind: 'ready';
  contractVersion: 'customer-source-evidence.v1';
  customerId: string;
  customerUpdatedAt: string;
  observedAt: string;
  evidence:
    | Readonly<{
        status: 'recorded';
        importRecord: Readonly<{
          batchId: string;
          sheetKind: 'customer';
          rowNumber: number;
          completedAt: string;
        }>;
      }>
    | Readonly<{
        status: 'not_recorded' | 'ambiguous';
        importRecord: null;
      }>;
}>;
```

- `recorded`：完整范围查询恰好返回一条有效导入行及有效批次。
- `not_recorded`：客户存在且查询成功，目标导入行数为零。
- `ambiguous`：存在至少两条有效关联，查询只探测至两条；表示无法给出唯一证据，`importRecord` 必须为空。这是可说明的歧义状态，不是认可任何一条来源。
- `customerUpdatedAt` 来自当前客户记录；`completedAt` 沿用批次历史字段，但其值在导入事务开始前生成，仅标为“导入批次记录时间”，不代表事务提交完成时刻或最后同步时间；`observedAt` 由服务端在该次成功读取后生成。均为可解析的 ISO 时间，不用当前时间填补缺失业务时间。
- 返回给客户端前校验标识、Sheet、行号及时间。`rowNumber` 为安全整数且不小于 5；批次标识遵循现有导入标识格式；当前客户、导入行、批次中的必要值无效时返回 503。

错误响应沿用现有路由的低敏风格，只返回固定 `code`；不携带客户、证据载荷、数据库异常或调试栈。

| HTTP | 语义 |
| --- | --- |
| 400 | 存在不允许的查询参数 |
| 403 | 现有授权链返回禁止，或角色不在允许名单 |
| 404 | 非法客户标识；可信范围内客户不存在；其他机构客户不可见 |
| 503 | 本地开发门禁关闭、授权能力不可用、读取失败、关联批次缺失或元数据无效 |

多条有效证据使用 200 的 `ambiguous`；损坏关联使用 503，不混为“无证据”。未登录等会话异常遵循现有授权链的禁止／不可用结果，不新造独立身份规则。

## 3. 权限与查询边界

复用 [导入编排](../../../src/server/orchestration/institution-excel-import-runtime.ts) 的 `authorizeImport` 语义：

1. `NODE_ENV=development`，数据库配置须为现有允许名单内的本地 PostgreSQL。
2. 调用 `authorizeInstitutionCustomerControlledWriteV1(true)`，通过可信会话、权威成员关系、租户／机构、已发布客户列表能力和客户创建能力检查。
3. 角色限定 `tenant_admin / tenant_operator`。GET 不自动扩大到普通机构成员；本任务不拆分或放宽现有权限门禁。
4. 授权成功后，按 `tenantId + institutionId + customerId` 确认客户存在。不同机构无法通过客户标识探测证据。

同一次请求在一个只读一致性快照内读取客户更新时间与导入关联，采用现有数据库工具支持的只读、可重复读事务；不写业务表或审计表。门禁失败时不查询目标客户和导入证据，客户不存在时不查询导入证据。

客户存在校验同样使用窄投影，只选择 `id / updatedAt`；不能直接调用会执行全字段 `.select()` 的 `readScopedCustomerCommandRecordV1`，也不能先读取完整客户记录再丢弃敏感字段。

新增专用元数据查询，不调用先读取 `protectedPayload` 再脱敏的批次明细方法：

- 行表条件同时包含可信 `tenantId`、`institutionId`、`sheetKind='customer'`、`canonicalRecordId=customerId`。
- 批次关联同时匹配相同租户、机构和 `batchId`，使用保留未匹配行的关联方式识别异常；不能因内连接丢弃损坏关联而报告“无记录”。
- 业务输出投影仅包含 `batchId / rowNumber / completedAt`；查询可额外选择识别关联存在所需的低敏批次标识。Sheet 固定为 `customer`，不读取其余 Sheet 的业务内容。
- 使用稳定顺序和 `LIMIT 2` 判断零条、一条、多条。不按最近 20 批截断，不用客户 ID 前缀、标签、备注或 `referralSource` 替代查询。
- 对取回的所有候选先校验关联和元数据；任何候选损坏则不可用。两条有效关联才返回歧义，不静默采用最新、最早或第一条。
- SQL 投影不选择 `protectedPayload`、文件／外部编号摘要、创建人或敏感资料；不调用解密、客户敏感资料仓库、模型或外部服务。

[现有 schema](../../../src/server/db/schema.ts)已经包含所需列和复合外键，本任务不新增表、字段、索引或 Migration。`canonicalRecordId` 当前没有专门索引或唯一约束；`LIMIT 2` 仅限制返回量，不能证明扫描量或真实性能。生产规模下的查询计划、索引和环境开放另行评估，不纳入本次开发承诺。

## 4. 拟议改动位置

核心业务文件控制为四处，全部围绕同一个客户来源 GET 与只读消费，不修改客户写字段或导入写流程：

| 位置 | 计划职责 |
| --- | --- |
| `src/modules/institution-import/server/institution-excel-import-repository.ts` | 增加客户导入关联的元数据查询；完整范围、有限返回和明确投影 |
| `src/server/orchestration/institution-excel-import-runtime.ts` | 复用门禁；客户存在校验；一致性读取；状态分类和响应校验 |
| `src/app/api/v1/institution/customers/[customerId]/source-evidence/route.ts`（拟新增） | GET、拒绝查询参数、状态映射及禁止缓存 |
| `src/modules/institution-v11-preview/server/approved-prototype-assets.ts` | 真实客户抽屉只读卡、请求与客户绑定、空／错／歧义状态及竞态处理 |

相关仓库、编排、路由和 DOM 行为测试单列，覆盖下面的风险，不为文案或实现细节机械增加测试。若实施时发现必须改动权限、schema、真实数据、跨业务域或自动任务，先回报该差异，再处理对应授权；不扩大本规格。

## 5. 验收标准

| 编号 | 必须证明的结果 |
| --- | --- |
| S01 | 单条有效关联显示真实批次、客户 Sheet 行号和批次记录时间；即使该批次不在最近 20 批也能读取 |
| S02 | 客户存在但无导入行返回 `not_recorded`；数据库异常返回 503；两条有效关联返回 `ambiguous` 且没有单条来源；不同结果不可折叠 |
| S03 | 行缺失匹配批次、无效时间、非法批次标识或行号均返回 503；不伪造时间、不把损坏关联当作零条 |
| S04 | 客户、导入行和批次 SQL 均有完整可信范围；跨机构客户为 404；不接受客户端范围注入 |
| S05 | 普通角色、生产／远端环境、未发布能力等保持既有禁止或不可用语义；门禁失败不读取目标客户和导入证据 |
| S06 | 断言 SQL 投影没有载荷、摘要和敏感字段；解密、敏感资料读取、写命令、模型和外部业务调用均未发生 |
| S07 | API 拒绝所有查询参数、验证响应形状、全部状态禁止缓存；非法客户标识不查询业务证据 |
| S08 | DOM 使用当前真实客户标识；加载、403／404／503、异常响应与网络错误清除旧卡；可重试且不显示原始错误载荷 |
| S09 | 切换客户、关闭抽屉、离页或重复请求后，旧成功和旧失败均不能覆盖当前状态或重开抽屉；显示文本经过安全处理 |
| S10 | 不回退 `DATA`、`c001` 或原型更新时间；不输出完整度、唯一上游来源、最近同步、重复客户数；三种时间标签明确 |
| S11 | 用隔离合成数据验证一条、零条、歧义、读取失败、迟到响应的实际交互；原客户列表及导入历史入口无行为回退 |

可以参考现有测试的模式，但不能将旧测试结果记作新增能力已通过：

- [导入历史仓库测试](../../../src/modules/institution-import/tests/InstitutionExcelImportHistoryRepository.test.ts)：SQL 条件和投影。
- [导入历史编排测试](../../../src/modules/institution-import/tests/InstitutionExcelImportHistoryRuntime.test.ts)：角色、环境和拒绝前的查询边界。
- [导入历史 DOM 测试](../../../src/modules/institution-v11-preview/tests/ApprovedImportHistoryRuntime.test.ts)：只读请求、错误清理、关闭和过期响应。

实施后的验证包括本任务新增测试、受影响客户／导入／V1.1 测试、`pnpm typecheck`、`pnpm lint`、必要构建与增量架构检查，以及隔离合成数据的浏览器交互。运行前确认测试不连接真实业务数据；如缺少环境，只报告未完成的验证，不以模拟结果替代。

## 6. 交付与停止条件

本规格达到可开发状态的依据是：已有表能表达关联，权限门禁可复用，真实客户 UI 入口明确，有限读取与错误语义可独立验收。开始实施时仍需刷新基线、工作树和相关回归基线；本轮未运行新增能力测试，因为尚无代码实现。

runtime 交付预期为单主题草稿 PR，说明实际变更、验证和环境限制。回滚只需回退该功能提交，不涉及数据或 Migration 回滚。客户来源卡通过验收后，本任务结束；不自动开始画像、机会确认、开放生产或读取真实数据。
