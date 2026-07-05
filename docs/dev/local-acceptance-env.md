# 本地安全验收环境基线

日期：2026-07-05 CST

适用范围：`zmtg-clean` 本地 5010 验收、PR 合并后页面复验、知识库 hybrid retrieval / embedding / rerank 类功能验收。

## 目标

建立一个可重复使用的本地验收环境，避免直接连接疑似生产 `DATABASE_URL`：

1. 只使用 `localhost` / `127.0.0.1` PostgreSQL。
2. 不读取或打印 `.env.local` 内容。
3. 不输出旧 `DATABASE_URL`、API key 或 secret。
4. 不执行 seed、reset、drop 既有数据库。
5. 可执行当前分支或当前 `main` 已有 migration。
6. 可用同一个临时库启动 `5010`。

## 本机环境结论

本轮基线确认：

1. macOS：15.7.7。
2. Node.js：v24.16.0。
3. pnpm：11.7.0。
4. Docker CLI 已安装。
5. Docker Desktop app 不存在，但本机已安装 Colima。
6. Colima 启动后 Docker daemon 可用。
7. `psql` / `createdb` / `pg_isready` 未安装在宿主机 PATH 中。
8. `.env.local` 中存在 `DATABASE_URL`，且命中生产风险关键词；不得用于本地验收 migration。

## 本地验收 DB

脚本：

```bash
scripts/dev/local-acceptance-db.sh
```

默认参数：

1. container：`zmtg-local-acceptance-pg`
2. database：`zmtg_clean_local_acceptance`
3. host：`127.0.0.1`
4. port：`55432`
5. image：`postgres:16-alpine`

脚本不会读取 `.env.local`。如果当前 shell 已存在非 localhost 的 `DATABASE_URL`，脚本会拒绝继续。

## 启动本地验收 DB

```bash
scripts/dev/local-acceptance-db.sh ensure
```

脚本行为：

1. 检查 Docker CLI。
2. 如果 Docker daemon 不可用且本机存在 Colima，则尝试启动 Colima。
3. 创建或启动带有本任务 label 的 PostgreSQL container。
4. 只绑定 `127.0.0.1:55432`。
5. 等待 PostgreSQL ready。

如果同名 container 存在但没有本脚本 label，脚本会拒绝复用，避免误操作其他容器。

## 执行 migration

```bash
scripts/dev/local-acceptance-db.sh migrate
```

说明：

1. 使用当前 shell 临时 `DATABASE_URL` 指向本地验收 DB。
2. 执行 `./node_modules/.bin/drizzle-kit migrate`。
3. 不新增 migration。
4. 不执行 seed。
5. 不执行 reset。

本轮已确认 `pnpm db:migrate` 在当前机器会被 pnpm build approval 前置检查拦截；`drizzle-kit migrate` 是项目等价本地 migration 命令。

## 验证 03C 字段

```bash
scripts/dev/local-acceptance-db.sh verify
```

当前 03C 验收重点字段：

```text
knowledge_document_file_parse_chunk_embeddings.failure_reason_code
```

该字段存在后，说明 `0027_v06_kb_hybrid_retrieval_embedding_status.sql` 已在本地验收库生效。

## 启动 5010

```bash
scripts/dev/local-acceptance-db.sh dev
```

该命令会使用本地验收 DB 启动：

```bash
node scripts/run-next.mjs dev --webpack --port 5010
```

随后可检查：

1. `GET /api/version` 返回当前 commit。
2. `GET /hospital` 返回 200。
3. 登录机构端 demo 账号后进入知识库。
4. 检索测试台可见 `hybrid` / `keyword` / `vector`。
5. `Top 3` / `Top 5` / `Top 10` 可见。
6. 空库情况下页面展示空态，不白屏、不 500。
7. 页面不展示 embedding 原始数组。
8. response 不返回 `embeddingVectorJson`。
9. response 不暴露 provider / model / token / cost / vendor 的内部值。
10. 页面不宣称 OCR、复杂文档解析或生产级训练队列已完成。

## 停止容器

```bash
scripts/dev/local-acceptance-db.sh stop
```

脚本只会停止带有本任务 label 的 container，不删除数据库卷，不删除其他容器。

## 本轮 5010 验收结果

基线 commit：

```text
d0aef0cc66fa566160769866723b6af500ba4655
```

本轮已完成：

1. Colima 启动成功。
2. Docker daemon 可用。
3. 本地 PostgreSQL container 创建成功。
4. 当前 `main` 既有 migration 执行成功。
5. `failure_reason_code` 字段存在。
6. 5010 启动成功。
7. `/api/version` 返回 200，commit 命中当前 `main`。
8. `/hospital` 返回 200。
9. 机构端知识库页面可打开。
10. 空库下知识库页面展示空态，不白屏、不 500。
11. 检索测试台可见 `hybrid` / `keyword` / `vector`。
12. `Top 3` / `Top 5` / `Top 10` 可见。
13. 空结果 hybrid 检索返回 200 和低敏空态。
14. API response 未返回 embedding array / `embeddingVectorJson`。
15. API response 未暴露 provider / model / token / cost / vendor。

因本地验收库为空，本轮没有实操生成 / 重建向量索引；后续如需实操该入口，需要先通过本地安全链路上传可见知识文件并完成解析。

## 禁止事项

本地验收时仍禁止：

1. 连接 `.env.local` 中疑似生产 `DATABASE_URL`。
2. 输出 `DATABASE_URL` 原值。
3. 输出 API key / secret。
4. seed。
5. reset。
6. drop 既有数据库。
7. 修改业务代码、schema、migration、package 或 lockfile。
8. 用本地验收结果替代测试服或生产环境 migration 状态核对。
