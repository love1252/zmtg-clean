# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 剩余 4 个低风险正式 Route 再校准与第三批 Route Guard 前置预检
```

## 上轮校准中的剩余候选

1. `src/app/api/institution/followup-operations/dashboard/route.ts` → `care`
2. `src/app/api/institution/treatment-summaries/route.ts` → `care`
3. `src/app/api/institution/wecom-official-dry-run/route.ts` → `conversations`
4. `src/app/api/institution/wecom/customer-mapping-candidates/route.ts` → `conversations`

以上 4 个仅是第二批前置校准留下的候选，不代表已准入。第三批必须从当前 main 重新核对。

## 任务目标

1. 从第二批合并后的 main 重新扫描机构端正式 Route；
2. 核对上述 4 个候选是否仍为 GET-only、非动态、无数据库、无 demo、无高风险路径；
3. 核对现有 handler 是否 capability-off、是否读取 Request、是否已有 formal Guard；
4. 重新扫描全部测试对这 4 个 Route 的 import 和源码路径引用；
5. 冻结每个 Route 的 section、拒绝响应、成功 handler contract；
6. 冻结生产文件、colocated 测试和兼容性测试精确 allowlist；
7. 前置预检和独立审查完成后才允许第三批实施。

## 经验固化

- 共享 Guard 固定在 `src/app/api/institution/_shared`；
- 实施前必须纳入既有 handler-contract 测试；
- Guard 包装后公开 GET 可能返回 `Promise<Response>`，测试调用必须 `await`；
- 自动文本替换不得修改源码字符串断言中的 `function GET`；
- 本地门禁必须包含完整 `pnpm test`、typecheck 和 build。

## 禁止范围

- 本预检不修改生产 Route 或共享 Guard；
- 不开放业务 Reader、对象事实 Adapter或新 Capability；
- 不处理动态对象、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
