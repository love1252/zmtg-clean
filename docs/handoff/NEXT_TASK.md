# 下一任务

## 当前任务

执行第二十三阶段：机构端纯领域／纯类型唯一试点。

## 唯一候选

- 当前文件：`src/modules/institution/domain/appointments.ts`
- 候选性质：纯领域空态模型，不是纯类型文件
- 建议目标：`src/modules/institution/domain/appointment/appointments.ts`
- 选择层级：`B_pure_domain_with_existing_tests`
- 职责：`domain`
- 领域所有者：`appointment`
- 直接调用方：1
- 直接测试调用方：1

## 精确文件白名单

1. `src/modules/institution/domain/appointments.ts`
2. `src/modules/institution/domain/appointment/appointments.ts`
3. `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`
4. `docs/handoff/CURRENT_STATUS.md`
5. `docs/handoff/NEXT_TASK.md`
6. `docs/handoff/RELEASE_HISTORY.md`

机器可读白名单：

- `docs/refactor/phase-22-institution-pilot-allowed-files.csv`

## 必须保持

- export 名称、数量及类型／运行时值边界不变；
- 类型、函数签名和运行时行为不变；
- 直接调用方只允许修正 import；
- 不增加跨模块出向依赖；
- 不产生循环依赖；
- 原有定向测试必须通过；
- 无现有直接测试时，必须新增白名单中的边界测试；
- 可独立回退。

## 禁止范围

- 不扩大到第二个候选；
- 不修改白名单外任何机构端文件；
- 不修改 API；
- 不修改 `file-migration-matrix.csv`；
- 不修改 Schema、Migration、package 或锁文件；
- 不连接数据库、HIS、企业微信或真实外部服务；
- 不改变权限、租户隔离或错误响应；
- 不提前进入第二十四阶段服务边界试点；
- API 后续批次继续冻结。

## 验证

1. `git diff --check`
2. `pnpm typecheck`
3. `pnpm lint`
4. 候选直接测试及边界测试
5. `pnpm build`
6. 新旧 export 契约对比
7. 依赖图无新增循环和反向依赖

## 回退

1. 恢复候选原路径；
2. 恢复全部直接调用方 import；
3. 删除新增边界测试；
4. 恢复 3 个交接文件。

## 后续阶段

第二十四阶段只能在第二十三阶段试点闭环后，
选择一组已有清晰领域归属的服务能力。
