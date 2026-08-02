/**
 * 已退役：Security 不再暴露 Scope 数据库 Repository。Tenancy 是 Scope 原始事实的
 * 唯一 Owner；Security 只能消费 Tenancy application Reader 的 genuine handle。
 *
 * 保留该空模块仅用于让历史路径以可审查方式失败关闭，不提供兼容 facade、类型或
 * 数据库入口。
 */
export {};
