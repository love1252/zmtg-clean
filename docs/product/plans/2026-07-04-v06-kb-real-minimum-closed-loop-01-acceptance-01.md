# V0.6-KB-REAL-MINIMUM-CLOSED-LOOP-01-ACCEPTANCE-01：机构端知识库真实最小闭环第一阶段本地验收

## 1. 日期 / 时区

- 日期：2026-07-04
- 时区：CST / Asia Shanghai

## 2. 当前 main commit

- main / origin/main：`c123aada0dcaa92ef296f4ecf264df478d580544`
- 对应背景：PR #442 已合并，机构端知识库真实最小闭环第一阶段进入本地 5010 验收。

## 3. 验收目标

本轮只验收 PR #442 合并后的机构端知识库真实最小闭环第一阶段，确认：

1. 本地 5010 命中当前 main。
2. `/hospital` 可打开并可进入机构端知识库视图。
3. 机构端知识库卡片页面、真实知识条目、真实文件 / 文档记录可见。
4. 现有机构端上传、检索 API 在本地测试库环境下的表现被记录。
5. 受控禁用能力仍未误开启。
6. 未把当前阶段误宣称为生产完整闭环。

## 4. 验收范围

- 页面：`/hospital`
- 版本接口：`GET /api/version`
- 上传接口：`POST /api/institution/knowledge-management/upload`
- 检索接口：`GET /api/institution/knowledge-management/search`
- 只读复核范围：机构端知识库卡片面板、真实知识条目列表、文件 / 文档记录、关键词检索、受控禁用按钮和边界文案。

## 5. 本地 5010 启动方式与版本检查结果

使用项目既有本地 testdb 启动方式：

```bash
/Users/dongxiaolong/Documents/Codex/scripts/zmtg-5010-testdb.sh
```

启动结果：

- 本地 5010 成功启动。
- 数据源使用测试服 PostgreSQL 隧道。
- 未输出数据库连接串、密码、token、cookie 或密钥。
- 验收完成后已停止本地 5010 临时会话。

## 6. `/api/version` 结果

请求：

```bash
curl -i http://127.0.0.1:5010/api/version
```

结果：

- HTTP 状态：200
- 返回 commit：`c123aada0dcaa92ef296f4ecf264df478d580544`
- 结论：命中当前 main。

## 7. `/hospital` 页面验收结果

结果：

- HTTP 状态：200
- 浏览器访问 `/hospital` 成功。
- 初次访问因无机构端 session 跳转到本地机构登录页，使用页面内置开发账号入口登录后进入 `/hospital`。
- 登录后进入机构端工作台成功。
- 切换左侧 `知识库` 入口后，机构端知识库视图可见。
- 未发现白屏、500 页面或明显 runtime error。
- 浏览器 console 未发现 error 级日志。

## 8. 真实知识条目加载验收结果

页面结果：

- 可见 `机构端知识库最小闭环`。
- 可见 `机构知识库` 标题。
- 可见顶部指标卡。
- 页面显示 `知识条目 20`。
- 知识条目区域显示已读取机构可见知识，并展示真实条目卡片，例如 `vt_upload.txt`、`post-merge-ai-regression-1782540001582.txt`、`smoke_test.txt` 等。
- 条目卡片展示本机构归属、状态、更新时间、摘要和片段数等低敏信息。

结论：真实知识条目加载可见。

## 9. 真实文件 / 文档记录加载验收结果

页面结果：

- 可见 `文件 / 文档` 区域。
- 文件列表随真实知识条目加载。
- 文件数指标在文件 API 请求完成后显示为 `20`。
- 下方原有机构端知识库只读内容仍保留，可见 `查看文件` 入口和文件相关低敏摘要。

结论：真实文件 / 文档记录加载可见。

## 10. `.txt / .md` 上传验收结果

准备临时文件：

```bash
/tmp/zmtg-kb-acceptance-upload.txt
```

文件内容：

```text
术后护理验收文本。冷敷后保持创面清洁，避免剧烈热刺激。
```

上传方式：

- 使用本地 5010 现有机构端登录接口取得临时 demo session cookie。
- 调用现有上传接口 `POST /api/institution/knowledge-management/upload`。
- 未提交 `/tmp` 文件到仓库。

验收结果：

- `admin` 账号上传返回 HTTP 409。
- 返回 code：`quota_exceeded_knowledge_files`。
- 继续使用内置机构 demo 账号 `yunlan_admin`、`baiyue_admin`、`xinghe_admin`、`yubai_admin`、`chengxing_admin`、`qingmang_admin` 做受控尝试，均返回 HTTP 409 / `quota_exceeded_knowledge_files`。

结论：

- `.txt / .md` 上传入口和接口可达。
- 本地测试库当前所有内置机构 demo 账号的知识库文件数量配额已满，上传成功未完成。
- 本轮不直接修改数据库配额、不删除现有测试数据、不绕过 quota。
- 上传成功链路需要在补充测试配额或准备独立验收租户后复验。

## 11. 上传后刷新验收结果

由于上传被测试库配额拦截为 HTTP 409，本轮未产生新的上传记录，因此无法完成“上传成功后知识 / 文件数据刷新”的正向验收。

补充观察：

- 页面已有真实知识条目和文件记录加载。
- 代码测试中已覆盖上传成功后刷新知识和文件数据。
- 本轮验收结论仍将上传成功后刷新标记为待复验，不宣称通过。

## 12. 关键词检索命中验收结果

请求：

```bash
GET /api/institution/knowledge-management/search?keyword=冷敷&pageSize=10
```

结果：

- HTTP 状态：200
- `pageInfo.total`：1
- 首条命中：
  - knowledgeTitle：`post-merge-ai-regression-1782540001582.txt`
  - fileName：`post-merge-ai-regression-1782540001582.txt`
  - matchReason：`片段包含关键词“冷敷”`
  - textPreview 包含 `冷敷`

结论：关键词检索 API 命中结果可用。

## 13. 关键词检索空结果验收结果

请求：

```bash
GET /api/institution/knowledge-management/search?keyword=zzzz-not-exist-kb-acceptance&pageSize=10
```

结果：

- HTTP 状态：200
- `pageInfo.total`：0
- emptyState title：`暂无匹配片段`

结论：关键词检索空结果状态可用。

## 14. 关键词检索错误态验收结果

安全模拟方式：

- 使用 81 个字符的超长关键词触发校验错误，不修改代码、不断网、不制造服务异常。

结果：

- HTTP 状态：400
- status：`validation_failed`
- message：`关键词过长，最多支持 80 个字符`

页面补充观察：

- 检索测试卡片、关键词输入和 `开始检索测试` 按钮可见。
- 浏览器自动化中尝试点击按钮、回车提交和真实键入后提交，检索结果区未从初始提示刷新为命中 / 空结果状态。
- 由于 API 层命中、空结果和校验错误均已通过，本轮将 UI 表单结果刷新记录为后续复验点，不宣称页面交互完全通过。

## 15. 禁用项验收结果

以下按钮均可见且保持 disabled / 待接入说明：

- 新建知识：disabled，title 为 `待接入可靠新建知识 API`
- 新建文件夹：disabled，title 为 `待接入目录写入 API`
- 重新解析：disabled，title 为 `待接入机构端重新解析触发入口`
- 重新训练：disabled，title 为 `未接训练 runtime`
- 删除：disabled，title 为 `待接入删除审计和恢复策略`

页面文案同时说明：

- 训练、AI 问答和向量能力仍为后续专项。
- 本轮不调用 AI provider。
- 本轮不使用向量数据库。
- 本轮不做复杂 PDF / Word / Excel 深度解析。

结论：禁用项仍受控。

## 16. 页面错误检查结果

- `/hospital` 可打开。
- 知识库视图可打开。
- 未发现白屏。
- 未发现 500 页面。
- 未发现明显 hydration / runtime error。
- 浏览器 error 日志为空。

## 17. 仍未完成能力

本轮仍不可宣称以下能力已完成：

1. 真实训练闭环。
2. AI provider 接入。
3. 向量数据库接入。
4. PDF / Word / Excel 深度解析。
5. OCR。
6. 生产级异步队列、worker、scheduler、cron。
7. 上传 / 解析 / 检索统一审计补齐。
8. 生产可用知识库完整闭环。

## 18. 本轮未改内容

本轮为 docs-only / acceptance-only：

- 未修改产品代码。
- 未修改测试代码。
- 未新增 API route。
- 未修改 API URL。
- 未修改 repository / service。
- 未修改 server / domain。
- 未修改 DB schema / migration。
- 未修改 `drizzle/**`。
- 未修改 `src/server/db/**`。
- 未修改 package / lock / config。
- 未引入新依赖。
- 未部署测试服或生产。
- 未提交 `/tmp` 上传测试文件。
- 未提交参考图资源。
- 未读取或输出 `.env.local`、`DATABASE_URL`、API key、cookie、token 或密钥。

## 19. 风险与后续建议

当前验收结论不是“全部通过”，而是：

1. 版本、页面、真实知识条目、真实文件记录、检索 API 命中 / 空结果 / 校验错误、禁用项和边界文案均已完成本地 5010 验收。
2. 上传成功链路被本地测试库套餐文件数配额拦截，返回 HTTP 409 / `quota_exceeded_knowledge_files`，需要补充测试配额或准备独立验收租户后复验。
3. 上传成功后刷新未能正向验收，需要在上传成功链路复验时一并确认。
4. 页面检索表单结果刷新在浏览器自动化中未观察到命中 / 空结果切换，但 API 层检索能力已通过；建议后续单独复验 UI 表单提交状态。
5. 不建议绕过 quota、直接改 DB 或删除测试库数据来强行制造通过结论。
6. 下一步建议先处理本地验收租户配额 / 数据准备，再重新进行上传成功与页面检索交互复验。
