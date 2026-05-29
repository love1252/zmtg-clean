export type PlatformRoleId =
  | 'platform_super_admin'
  | 'platform_operator'
  | 'security_auditor'
  | 'tenant_admin';

export type GovernanceResource =
  | 'tenant'
  | 'open_connection'
  | 'permission_policy'
  | 'audit_log'
  | 'platform_health';

export type GovernanceAction =
  | 'read_aggregate'
  | 'read_detail'
  | 'read_own_tenant'
  | 'manage_status'
  | 'manage_policy'
  | 'review'
  | 'export_report';

export type CapabilityLifecycleId = 'api_key' | 'oauth_app' | 'webhook';

export type LifecycleStateId =
  | 'draft'
  | 'active'
  | 'rotating'
  | 'revoked'
  | 'configured'
  | 'published'
  | 'suspended'
  | 'enabled'
  | 'degraded'
  | 'disabled';

export type AuditCategory =
  | 'tenant_boundary'
  | 'permission_policy'
  | 'connection_lifecycle'
  | 'security_review';

export const governanceForbiddenTerms = [
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'webhook_secret',
  'sk_live',
  'sk_test',
  'zmtg_sk_',
] as const;

export const tenantIsolationPrinciples = [
  {
    title: '服务端租户上下文',
    detail: '租户身份只能来自服务端 session、服务端签发上下文或后续可信网关，不读取浏览器缓存作为授权依据。',
    risk: '阻断伪造租户、越权访问、跨机构读取。',
  },
  {
    title: '平台聚合可观测',
    detail: '平台端默认展示跨租户聚合指标、健康状态和治理状态，不直接展示机构客户明细。',
    risk: '降低平台运营误看客户 PII 和医疗敏感数据的风险。',
  },
  {
    title: '机构租户最小权限',
    detail: '机构管理员只能看到本租户资源、连接状态和被授予的配置入口。',
    risk: '避免机构间配置、客户资产、订单和审计事件互相泄露。',
  },
  {
    title: '敏感数据默认不可见',
    detail: '真实客户信息、治疗记录、外部凭证和安全事件详情默认不进入平台聚合卡片。',
    risk: '降低日志、截图和运营看板中的敏感信息暴露面。',
  },
] as const;

export const platformRoleCatalog: Array<{
  id: PlatformRoleId;
  name: string;
  description: string;
}> = [
  {
    id: 'platform_super_admin',
    name: '平台超级管理员',
    description: '负责租户状态、平台策略、开放连接治理和高风险操作审批。',
  },
  {
    id: 'platform_operator',
    name: '平台运营',
    description: '查看平台聚合运营状态，处理低风险租户运营任务。',
  },
  {
    id: 'security_auditor',
    name: '安全审计员',
    description: '查看审计事件、权限策略和安全巡检结果，不执行业务配置变更。',
  },
  {
    id: 'tenant_admin',
    name: '机构管理员',
    description: '管理本机构工作台和本租户开放连接可见状态。',
  },
];

export const openPlatformPermissions: Array<{
  roleId: PlatformRoleId;
  resource: GovernanceResource;
  actions: GovernanceAction[];
  boundary: string;
}> = [
  {
    roleId: 'platform_super_admin',
    resource: 'tenant',
    actions: ['read_aggregate', 'read_detail', 'manage_status'],
    boundary: '可管理租户运营状态，但第一阶段不能读取租户客户 PII。',
  },
  {
    roleId: 'platform_super_admin',
    resource: 'permission_policy',
    actions: ['read_detail', 'manage_policy', 'review'],
    boundary: '可定义策略草案，并在审查后审批高风险策略变更。',
  },
  {
    roleId: 'platform_operator',
    resource: 'platform_health',
    actions: ['read_aggregate', 'read_detail'],
    boundary: '可查看平台健康和聚合趋势，不修改安全策略。',
  },
  {
    roleId: 'security_auditor',
    resource: 'audit_log',
    actions: ['read_detail', 'export_report', 'review'],
    boundary: '可查看和导出审计报告，不能轮换凭证或修改租户状态。',
  },
  {
    roleId: 'tenant_admin',
    resource: 'open_connection',
    actions: ['read_own_tenant'],
    boundary: '只能查看本租户开放连接态势，不能管理平台级策略。',
  },
];

export const capabilityLifecycleGroups = [
  {
    id: 'api_key',
    title: 'API Key 生命周期',
    description: '第一阶段仅展示遮罩凭证预览和状态流转，不生成、存储或校验真实密钥。',
    states: [
      { id: 'draft', label: '草稿', description: '连接需求已登记，尚未允许调用。' },
      { id: 'active', label: '启用', description: '后续真实实现中代表调用权限已开启。' },
      { id: 'rotating', label: '轮换中', description: '后续真实实现中代表新旧遮罩凭证处于交接窗口。' },
      { id: 'revoked', label: '已吊销', description: '后续真实实现中代表调用权限已停止。' },
    ],
    transitions: [
      { from: 'draft', to: 'active', trigger: '审批连接申请' },
      { from: 'active', to: 'rotating', trigger: '轮换遮罩凭证预览' },
      { from: 'rotating', to: 'active', trigger: '完成轮换审查' },
      { from: 'active', to: 'revoked', trigger: '安全审查后吊销' },
    ],
  },
  {
    id: 'oauth_app',
    title: 'OAuth 应用生命周期',
    description: '第一阶段仅展示应用配置状态，不创建授权地址、回调处理或令牌交换。',
    states: [
      { id: 'draft', label: '草稿', description: '应用名称、授权范围和租户归属处于设计中。' },
      { id: 'configured', label: '已配置', description: '授权范围和回调域名通过人工校验。' },
      { id: 'published', label: '已发布', description: '后续真实实现中代表应用可被授权。' },
      { id: 'suspended', label: '已暂停', description: '后续真实实现中代表应用授权入口被暂停。' },
    ],
    transitions: [
      { from: 'draft', to: 'configured', trigger: '完成策略审查' },
      { from: 'configured', to: 'published', trigger: '发布已审查应用' },
      { from: 'published', to: 'suspended', trigger: '风险告警后暂停' },
      { from: 'suspended', to: 'configured', trigger: '整改复核后重新打开' },
    ],
  },
  {
    id: 'webhook',
    title: 'Webhook 生命周期',
    description: '第一阶段仅展示订阅健康状态，不保存目标地址、不签名、不投递事件。',
    states: [
      { id: 'draft', label: '草稿', description: '订阅主题和租户归属处于设计中。' },
      { id: 'enabled', label: '已启用', description: '后续真实实现中代表订阅可以接收事件。' },
      { id: 'degraded', label: '降级', description: '后续真实实现中代表投递健康低于策略阈值。' },
      { id: 'disabled', label: '已停用', description: '后续真实实现中代表订阅停止投递。' },
    ],
    transitions: [
      { from: 'draft', to: 'enabled', trigger: '审批订阅策略' },
      { from: 'enabled', to: 'degraded', trigger: '投递健康低于策略阈值' },
      { from: 'degraded', to: 'enabled', trigger: '健康恢复并通过复核' },
      { from: 'enabled', to: 'disabled', trigger: '租户申请或风险告警后停用' },
    ],
  },
] satisfies Array<{
  id: CapabilityLifecycleId;
  title: string;
  description: string;
  states: Array<{ id: LifecycleStateId; label: string; description: string }>;
  transitions: Array<{ from: LifecycleStateId; to: LifecycleStateId; trigger: string }>;
}>;

export const auditEventCatalog: Array<{
  category: AuditCategory;
  title: string;
  exampleAction: string;
  requiredFields: string[];
}> = [
  {
    category: 'tenant_boundary',
    title: '租户边界事件',
    exampleAction: 'tenant.aggregate.read',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'permission_policy',
    title: '权限策略事件',
    exampleAction: 'permission.policy.review',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'connection_lifecycle',
    title: '开放连接生命周期事件',
    exampleAction: 'connection.lifecycle.transition',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'security_review',
    title: '安全审查事件',
    exampleAction: 'security.review.complete',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
];
