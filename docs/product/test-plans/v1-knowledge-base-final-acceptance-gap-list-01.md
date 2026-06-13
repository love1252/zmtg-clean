# 知识库管理 V1 收尾验收与上线缺口清单

日期：2026-06-13

## 结论

知识库管理 V1 当前达到最小可用闭环：平台端可以基于真实 repository/service 查询知识库列表，并绑定或解绑机构可见范围；机构端可以通过只读入口查看本机构归属或平台授权可见的低敏知识库摘要。平台端绑定后机构端可见，解绑后机构端不可见，tenant / institution 隔离和低敏 payload 均已有测试覆盖。

当前 V1 仍然是“低敏只读管理闭环”，不是上传、解析、embedding、训练或问答闭环。后续如要进入上传 / 解析 / embedding / 训练 / 问答 / runtime ingestion，必须另起目标任务审批。

## 当前已完成能力清单

1. 平台端知识库入口已接入平台控制台“知识库管理”。
2. 平台端知识库列表支持真实 repository/service 查询。
3. 平台端列表支持 tenant 范围、搜索、分页、机构筛选、状态返回。
4. 平台端 visibility API 支持绑定和解绑机构可见范围。
5. 平台端 visibility 写入前校验 tenant 下是否存在目标 institution。
6. 机构端知识库入口已接入机构工作台“知识库”菜单。
7. 机构端只读列表支持搜索、分页、刷新、loading、empty、error 状态。
8. 机构端只展示当前 tenant 下、本机构归属或平台授权可见的知识库。
9. 平台端与机构端 payload 均保持低敏，不返回正文、解析内容、embedding 或训练内容。
10. 平台端与机构端底层异常均返回固定中文安全错误文案，不透出数据库连接、SQL、stack、token 或 secret。

## 平台端实际应用路径

1. 平台账号进入平台控制台。
2. 点击“知识库管理”。
3. 选择机构范围或 tenant 范围。
4. 在知识条目区域查看知识库名称、分类、状态、更新时间、分块数量、低敏摘要等字段。
5. 使用搜索、分页、机构筛选和状态返回定位目标知识库。
6. 通过平台端 visibility API 将目标知识库绑定给指定机构。
7. 如需撤销机构可见范围，通过平台端 visibility API 解绑。

当前平台端 UI 不提供上传、下载、导出、解析、embedding、训练或问答操作入口。界面中仍存在“解析”“训练”“导入”等历史状态文案，用于只读展示当前知识记录状态，不代表当前 V1 允许执行这些操作。

## 机构端实际应用路径

1. 机构账号进入机构工作台。
2. 点击“知识库”。
3. 查看平台授权给本机构或明确归属本机构的知识库。
4. 使用搜索、分页和刷新查看低敏摘要。
5. 当平台未授权或解绑后，机构端列表为空或不再展示对应知识库。

机构端只读列表不提供上传、下载、导出、解析、embedding、训练、问答、编辑正文或删除真实文件入口。

## 平台授权 / 解绑与机构端可见联动

联动路径如下：

1. 平台端调用绑定 service / API，将 `knowledgeId` 与 `institutionId` 写入 `platform_knowledge_institution_visibility`。
2. 平台端 repository 读取知识库时返回 `visibleInstitutionIds`。
3. 机构端 service 读取同一 tenant 下的知识库记录。
4. 机构端 service 只保留 `record.institutionId === accessContext.institutionId` 或 `visibleInstitutionIds` 包含当前机构的记录。
5. 平台解绑后，目标机构从 `visibleInstitutionIds` 中移除，机构端再次读取时不再可见。

测试证据：

- `KnowledgeManagementPlatformInstitutionE2EAcceptance.test.ts` 覆盖同一个 repository 状态下的平台绑定、平台列表验证、机构端可见、机构 B 不可见、tenant B 不可见、平台解绑、机构端不可见。
- `OpenPlatformKnowledgeManagementRealCore.test.ts` 覆盖平台端列表、搜索、分页、状态、tenant mismatch、绑定和解绑。
- `InstitutionKnowledgeManagementReadonlyService.test.ts` 覆盖机构端只读过滤、搜索、分页和低敏 payload。

## 数据安全边界

### tenant 隔离

平台端 service 要求 `tenantId`，repository 查询和 service 二次过滤都限定当前 tenant。机构端 route 从访问上下文读取 tenant，不接受前端传入的 tenant 覆盖。验收测试覆盖 tenant B 看不到 tenant A 的知识库。

### institution 隔离

平台端绑定 / 解绑前通过 `hasTenantInstitution` 校验目标机构属于当前 tenant。机构端 route 要求访问上下文存在 `institutionId`，缺失时返回 403 且不初始化 repository。机构端 service 只返回本机构归属或平台授权可见记录。验收测试覆盖机构 B 看不到机构 A 被授权的数据。

### 低敏 payload

平台端和机构端 DTO 只返回知识库 ID、标题、分类、状态、来源类型、摘要预览、分块数量、可见机构 ID、时间等低敏字段。测试明确断言 payload 不包含：

- `content`
- `rawContent`
- `parsedContent`
- `embedding`
- `embeddingVectorJson`
- `trainingContent`

### 固定中文安全错误文案

平台端 items API 底层异常返回“知识库条目暂时无法查询”。平台端 visibility API 底层异常返回“知识库可见范围暂时无法更新”。机构端只读 API 底层异常返回“知识库只读数据暂时不可用”。测试覆盖不暴露 `DATABASE_URL`、`postgres`、`token`、`secret`、路径、SQL 或 stack。

## 当前仍禁止能力

以下能力不属于当前 V1 最小闭环，不得在当前知识库管理 V1 中误认为已上线：

1. 上传。
2. 下载。
3. 导出。
4. 删除真实文件。
5. 编辑真实知识正文。
6. 文档解析。
7. OCR。
8. embedding。
9. 向量数据库。
10. 训练。
11. 问答。
12. runtime ingestion。
13. dashboard 聚合。
14. 第三方服务对接。

## 当前是否达到 V1 最小可用闭环

达到。当前闭环是：

1. 平台端读取真实知识库低敏列表。
2. 平台端搜索、分页、机构筛选和状态展示可用。
3. 平台端绑定机构可见范围。
4. 机构端看到授权给本机构的知识库。
5. 平台端解绑机构可见范围。
6. 机构端不再看到该知识库。
7. tenant / institution 隔离、低敏 payload 和安全错误文案有测试证明。

## 当前上线缺口清单

### P0

无。当前未发现阻塞 V1 最小只读闭环上线的缺口。

### P1

1. 平台端 UI 中仍有“解析”“训练”“导入”等状态类文案。它们当前只是只读状态展示，不是操作入口；如果进入真实生产运营界面，可在后续任务中进一步替换为“处理状态”“可用状态”等更中性的文案。
2. 平台端无 tenantId 或数据库未配置时仍保留 mock fallback。该 fallback 有利于演示和本地开发；真实应用部署时应通过环境和访问入口保证平台端带明确 tenant 范围，并在后续任务中评估是否需要生产环境禁用 mock fallback。

### P2

1. 当前机构端只读列表未展示平台授权来源的审计时间、授权人等治理信息；这不是 V1 最小闭环必需项，可后续补充。
2. 当前没有浏览器级真实数据库 E2E；已通过 service / route / workspace 入口测试覆盖关键行为。若后续引入正式 E2E runner，应另起目标任务。

## 下一阶段建议

1. 如要进入上传、解析、OCR、embedding、向量数据库、训练、问答或 runtime ingestion，必须另起目标任务，并单独评估 schema、migration、权限、审计、数据安全和回滚方案。
2. 如要将平台端文案从“训练 / 解析 / 导入”完全替换为生产运营中性文案，应另起小范围 UI 文案任务，并同步更新平台端 UI 测试。
3. 如要补授权审计明细、授权人、授权时间或批量授权能力，应另起平台端治理任务，不应混入当前 V1 收尾验收。
