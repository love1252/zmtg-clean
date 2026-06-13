export type TenantKnowledgeStatus = 'active' | 'low_activity' | 'abnormal';
export type KnowledgeTrainingStatus = 'trained' | 'training' | 'pending' | 'failed';
export type KnowledgeFileParseStatus = 'parsed' | 'failed' | 'parsing' | 'pending';
export type KnowledgeFileTaskStatus = 'completed' | 'running' | 'failed' | 'pending';
export type ImportJobStatus = 'completed' | 'running' | 'failed' | 'partial_failed';

export type PlatformKnowledgeTotals = {
  tenantCount: number;
  knowledgeCount: number;
  categoryCount: number;
  folderCount: number;
  hitCount: number;
  chunkCount: number;
  averageHitCount: number;
  trainedCount: number;
  failedTrainingCount: number;
  zeroHitCount: number;
  importJobCount: number;
  failedImportJobCount: number;
  hitCoverageRate: number;
  trainingCoverageRate: number;
  importSuccessRate: number;
  pendingOptimizationCount: number;
  sourceFileCount: number;
  totalFileSizeKb: number;
  parsedFileCount: number;
  failedFileCount: number;
};

export type TenantKnowledgeStats = {
  tenantId: string;
  tenantName: string | null;
  status: TenantKnowledgeStatus;
  knowledgeCount: number;
  folderCount: number;
  hitCount: number;
  trainedCount: number;
  failedTrainingCount: number;
  zeroHitCount: number;
  chunkCount: number;
  averageHitCount: number;
  hitCoverageRate: number;
  trainingCoverageRate: number;
  importSuccessRate: number;
};

export type KnowledgeItem = {
  knowledgeId: string;
  tenantId: string;
  tenantName: string | null;
  title: string;
  summaryPreview: string;
  category: string;
  folder: string;
  type: 'faq' | 'document' | 'guide' | 'activity';
  hitCount: number;
  chunkCount: number;
  tags: string[];
  enabled: boolean;
  updatedAt: string;
  trainingStatus: KnowledgeTrainingStatus;
};

export type KnowledgeFileItem = {
  fileId: string;
  taskId: string;
  tenantId: string;
  tenantName: string | null;
  fileName: string;
  mimeType: string;
  fileType: string;
  fileSizeKb: number;
  category: string;
  folder: string;
  parseStatus: KnowledgeFileParseStatus;
  taskStatus: KnowledgeFileTaskStatus;
  parsedChars: number;
  safeErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  isDownloadable: boolean;
};

export type CategoryStats = {
  categoryCode: string;
  categoryName: string;
  knowledgeCount: number;
  hitCount: number;
  trainedCount: number;
  zeroHitCount: number;
  chunkCount: number;
  averageHitCount: number;
  hitCoverageRate: number;
  trainingCoverageRate: number;
};

export type TopQuestion = {
  knowledgeId: string;
  tenantId: string;
  tenantName: string | null;
  questionTitle: string;
  category: string;
  folder: string;
  hitCount: number;
  updatedAt: string;
};

export type ImportJob = {
  taskId: string;
  tenantId: string;
  tenantName: string | null;
  title: string;
  status: ImportJobStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformKnowledgeMockData = {
  totals: PlatformKnowledgeTotals;
  tenants: TenantKnowledgeStats[];
  knowledgeItems: KnowledgeItem[];
  files: KnowledgeFileItem[];
  categories: CategoryStats[];
  topQuestions: TopQuestion[];
  importJobs: ImportJob[];
  emptyState: typeof platformKnowledgeEmptyState;
};

export type PlatformKnowledgeScope = {
  tenantId: string | null;
  scopeName: string;
  totals: PlatformKnowledgeTotals;
  tenants: TenantKnowledgeStats[];
  knowledgeItems: KnowledgeItem[];
  files: KnowledgeFileItem[];
  categories: CategoryStats[];
  topQuestions: TopQuestion[];
  importJobs: ImportJob[];
};

export type KnowledgeFileFilterParams = {
  tenantId?: string | null;
  keyword?: string;
  status?: KnowledgeFileParseStatus;
};

export type KnowledgeItemFilterParams = {
  tenantId?: string | null;
  keyword?: string;
  category?: string;
  trainingStatus?: KnowledgeTrainingStatus;
};

const tenantDirectory: Array<Pick<TenantKnowledgeStats, 'tenantId' | 'tenantName' | 'status'>> = [
  { tenantId: 'tenant-xinglan', tenantName: '星澜医美中心', status: 'active' },
  { tenantId: 'tenant-low-hit', tenantName: '低命中修复门诊', status: 'low_activity' },
  { tenantId: 'tenant-abnormal-name', tenantName: '??enterprise??-79164001', status: 'abnormal' },
];

export const platformKnowledgeItems: KnowledgeItem[] = [
  {
    knowledgeId: 'knowledge-price-reply',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '客户询问价格时怎么回复？',
    summaryPreview: '先确认客户关注项目和预算区间，再说明价格受方案、疗程和活动权益影响。',
    category: '话术库',
    folder: '咨询接待',
    type: 'faq',
    hitCount: 34,
    chunkCount: 6,
    tags: ['价格', '咨询'],
    enabled: true,
    updatedAt: '2026/06/12 09:42',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-hydro-care',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '水光针术后需要注意什么？',
    summaryPreview: '术后 24 小时内避免高温环境、剧烈运动和刺激性护肤品，按医嘱做好补水与防晒。',
    category: '术后护理',
    folder: '光电项目',
    type: 'guide',
    hitCount: 27,
    chunkCount: 5,
    tags: ['水光针', '护理'],
    enabled: true,
    updatedAt: '2026/06/12 10:26',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-summer-activity',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '六月皮肤管理活动权益说明',
    summaryPreview: '展示活动权益、适用项目和门店咨询口径，方便平台侧观察活动知识命中表现。',
    category: '活动知识',
    folder: '活动政策',
    type: 'activity',
    hitCount: 11,
    chunkCount: 4,
    tags: ['活动', '权益'],
    enabled: true,
    updatedAt: '2026/06/11 16:45',
    trainingStatus: 'training',
  },
  {
    knowledgeId: 'knowledge-aopt',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: 'AOPT 的应用',
    summaryPreview: 'AOPT 适用于多类皮肤管理场景，平台侧仅展示运营摘要，不展示完整知识正文。',
    category: '项目知识',
    folder: '光电项目',
    type: 'document',
    hitCount: 0,
    chunkCount: 6,
    tags: ['光电', '项目'],
    enabled: true,
    updatedAt: '2026/06/11 17:21',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-efficiency',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '为什么员工效率正在成为老板最难管的一件事？',
    summaryPreview: '以知识库统一口径、减少重复问答和缩短新人培训周期为核心运营价值。',
    category: '项目知识',
    folder: '内部培训',
    type: 'document',
    hitCount: 4,
    chunkCount: 2,
    tags: ['培训', '运营'],
    enabled: true,
    updatedAt: '2026/06/11 16:29',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-repair-diet',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '修复术后饮食要注意什么？',
    summaryPreview: '术后早期以温凉软食为主，避免硬物和刺激性食物，出现异常时及时复诊。',
    category: '术后护理',
    folder: '修复项目',
    type: 'guide',
    hitCount: 6,
    chunkCount: 4,
    tags: ['修复', '饮食'],
    enabled: true,
    updatedAt: '2026/06/10 15:36',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-repair-recovery',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '客户担心恢复期怎么回复？',
    summaryPreview: '解释恢复期个体差异，强调复诊节奏、医嘱和异常反馈通道。',
    category: '话术库',
    folder: '咨询接待',
    type: 'faq',
    hitCount: 3,
    chunkCount: 0,
    tags: ['恢复期', '安抚'],
    enabled: true,
    updatedAt: '2026/06/10 14:20',
    trainingStatus: 'pending',
  },
  {
    knowledgeId: 'knowledge-implant-basic',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '种植项目基础说明',
    summaryPreview: '说明项目适用场景和咨询前置问题，当前尚未形成有效命中。',
    category: '项目知识',
    folder: '种植项目',
    type: 'document',
    hitCount: 0,
    chunkCount: 0,
    tags: ['种植', '项目'],
    enabled: true,
    updatedAt: '2026/06/09 11:08',
    trainingStatus: 'pending',
  },
  {
    knowledgeId: 'knowledge-low-activity',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '会员复诊活动提醒',
    summaryPreview: '用于低命中机构的活动知识样例，当前训练失败，等待人工复核。',
    category: '活动知识',
    folder: '会员活动',
    type: 'activity',
    hitCount: 0,
    chunkCount: 0,
    tags: ['复诊', '活动'],
    enabled: false,
    updatedAt: '2026/06/09 09:18',
    trainingStatus: 'failed',
  },
  {
    knowledgeId: 'knowledge-abnormal-tenant',
    tenantId: 'tenant-abnormal-name',
    tenantName: '??enterprise??-79164001',
    title: '机构名称异常数据巡检样例',
    summaryPreview: '用于验证机构名称异常时的平台侧兜底展示，不含真实租户敏感内容。',
    category: '项目知识',
    folder: '巡检样例',
    type: 'document',
    hitCount: 0,
    chunkCount: 0,
    tags: ['巡检', '兜底'],
    enabled: false,
    updatedAt: '2026/06/08 18:12',
    trainingStatus: 'failed',
  },
  {
    knowledgeId: 'knowledge-abnormal-activity',
    tenantId: 'tenant-abnormal-name',
    tenantName: null,
    title: '未命名机构活动知识样例',
    summaryPreview: '用于验证机构名称为空时展示未命名机构，并只显示运营摘要。',
    category: '活动知识',
    folder: '活动政策',
    type: 'activity',
    hitCount: 2,
    chunkCount: 1,
    tags: ['活动', '兜底'],
    enabled: true,
    updatedAt: '2026/06/08 17:40',
    trainingStatus: 'trained',
  },
  {
    knowledgeId: 'knowledge-abnormal-script',
    tenantId: 'tenant-abnormal-name',
    tenantName: '??enterprise??-79164001',
    title: '异常机构咨询话术空文本样例',
    summaryPreview: '用于验证解析失败后的知识条目兜底，不展示原始正文或底层错误。',
    category: '话术库',
    folder: '巡检样例',
    type: 'faq',
    hitCount: 0,
    chunkCount: 0,
    tags: ['话术', '空文本'],
    enabled: false,
    updatedAt: '2026/06/08 16:35',
    trainingStatus: 'failed',
  },
];

export const platformKnowledgeFiles: KnowledgeFileItem[] = [
  {
    fileId: 'file-xinglan-care',
    taskId: 'job-xinglan-completed',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '星澜医美中心术后护理指南.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 4200,
    category: '术后护理',
    folder: '光电项目',
    parseStatus: 'parsed',
    taskStatus: 'completed',
    parsedChars: 12864,
    safeErrorMessage: null,
    createdAt: '2026/06/12 10:05',
    updatedAt: '2026/06/12 10:31',
    isDownloadable: false,
  },
  {
    fileId: 'file-xinglan-script',
    taskId: 'job-xinglan-completed',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '咨询价格回复话术.txt',
    mimeType: 'text/plain',
    fileType: 'TXT',
    fileSizeKb: 32,
    category: '话术库',
    folder: '咨询接待',
    parseStatus: 'parsed',
    taskStatus: 'completed',
    parsedChars: 4821,
    safeErrorMessage: null,
    createdAt: '2026/06/12 09:30',
    updatedAt: '2026/06/12 09:52',
    isDownloadable: false,
  },
  {
    fileId: 'file-xinglan-failed',
    taskId: 'job-xinglan-partial',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '星澜导入失败记录.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileType: 'Excel',
    fileSizeKb: 860,
    category: '项目知识',
    folder: '待整理',
    parseStatus: 'failed',
    taskStatus: 'failed',
    parsedChars: 0,
    safeErrorMessage: '文件格式暂不支持',
    createdAt: '2026/06/11 17:58',
    updatedAt: '2026/06/11 18:06',
    isDownloadable: false,
  },
  {
    fileId: 'file-xinglan-processing',
    taskId: 'job-xinglan-running',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '2026活动知识合集.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'Word',
    fileSizeKb: 1460,
    category: '活动知识',
    folder: '活动政策',
    parseStatus: 'parsing',
    taskStatus: 'running',
    parsedChars: 3600,
    safeErrorMessage: null,
    createdAt: '2026/06/11 16:30',
    updatedAt: '2026/06/11 16:44',
    isDownloadable: false,
  },
  {
    fileId: 'file-xinglan-image-failed',
    taskId: 'job-xinglan-partial',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '活动海报图片.png',
    mimeType: 'image/png',
    fileType: '图片',
    fileSizeKb: 180,
    category: '活动知识',
    folder: '活动政策',
    parseStatus: 'failed',
    taskStatus: 'failed',
    parsedChars: 0,
    safeErrorMessage: '文件格式暂不支持',
    createdAt: '2026/06/11 15:48',
    updatedAt: '2026/06/11 15:55',
    isDownloadable: false,
  },
  {
    fileId: 'file-xinglan-large-pdf',
    taskId: 'job-xinglan-partial',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    fileName: '大型项目手册.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 65536,
    category: '项目知识',
    folder: '光电项目',
    parseStatus: 'failed',
    taskStatus: 'failed',
    parsedChars: 0,
    safeErrorMessage: '文件过大，暂无法解析',
    createdAt: '2026/06/11 14:28',
    updatedAt: '2026/06/11 14:36',
    isDownloadable: false,
  },
  {
    fileId: 'file-low-care-word',
    taskId: 'job-low-completed',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    fileName: '低命中修复术后答疑.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'Word',
    fileSizeKb: 1180,
    category: '术后护理',
    folder: '修复项目',
    parseStatus: 'parsed',
    taskStatus: 'completed',
    parsedChars: 9680,
    safeErrorMessage: null,
    createdAt: '2026/06/10 15:18',
    updatedAt: '2026/06/10 15:40',
    isDownloadable: false,
  },
  {
    fileId: 'file-low-project-excel',
    taskId: 'job-low-running',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    fileName: '种植项目知识待解析.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileType: 'Excel',
    fileSizeKb: 210,
    category: '项目知识',
    folder: '种植项目',
    parseStatus: 'pending',
    taskStatus: 'pending',
    parsedChars: 0,
    safeErrorMessage: null,
    createdAt: '2026/06/09 11:10',
    updatedAt: '2026/06/09 11:20',
    isDownloadable: false,
  },
  {
    fileId: 'file-low-service-pdf',
    taskId: 'job-low-completed',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    fileName: '修复服务流程.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 5600,
    category: '项目知识',
    folder: '修复项目',
    parseStatus: 'parsed',
    taskStatus: 'completed',
    parsedChars: 7200,
    safeErrorMessage: null,
    createdAt: '2026/06/09 10:12',
    updatedAt: '2026/06/09 10:34',
    isDownloadable: false,
  },
  {
    fileId: 'file-low-empty-text',
    taskId: 'job-low-partial',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    fileName: '空文本咨询话术.txt',
    mimeType: 'text/plain',
    fileType: 'TXT',
    fileSizeKb: 6,
    category: '话术库',
    folder: '咨询接待',
    parseStatus: 'failed',
    taskStatus: 'failed',
    parsedChars: 0,
    safeErrorMessage: '文档无可解析文本',
    createdAt: '2026/06/09 09:40',
    updatedAt: '2026/06/09 09:44',
    isDownloadable: false,
  },
  {
    fileId: 'file-abnormal-pdf',
    taskId: 'job-abnormal-failed',
    tenantId: 'tenant-abnormal-name',
    tenantName: '??enterprise??-79164001',
    fileName: '机构名称异常样例.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 540,
    category: '项目知识',
    folder: '巡检样例',
    parseStatus: 'failed',
    taskStatus: 'failed',
    parsedChars: 0,
    safeErrorMessage: 'PDF 解析服务异常',
    createdAt: '2026/06/08 18:10',
    updatedAt: '2026/06/08 18:20',
    isDownloadable: false,
  },
  {
    fileId: 'file-abnormal-image-pending',
    taskId: 'job-abnormal-running',
    tenantId: 'tenant-abnormal-name',
    tenantName: null,
    fileName: '未命名机构活动图片.png',
    mimeType: 'image/png',
    fileType: '图片',
    fileSizeKb: 900,
    category: '活动知识',
    folder: '活动政策',
    parseStatus: 'pending',
    taskStatus: 'pending',
    parsedChars: 0,
    safeErrorMessage: null,
    createdAt: '2026/06/08 17:22',
    updatedAt: '2026/06/08 17:25',
    isDownloadable: false,
  },
];

export const platformKnowledgeImportJobs: ImportJob[] = [
  {
    taskId: 'job-xinglan-completed',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '星澜术后护理导入任务',
    status: 'completed',
    totalCount: 2,
    successCount: 2,
    failedCount: 0,
    createdAt: '2026/06/12 09:30',
    updatedAt: '2026/06/12 10:40',
  },
  {
    taskId: 'job-xinglan-partial',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '星澜项目文件导入任务',
    status: 'partial_failed',
    totalCount: 3,
    successCount: 0,
    failedCount: 3,
    createdAt: '2026/06/11 14:20',
    updatedAt: '2026/06/11 18:06',
  },
  {
    taskId: 'job-xinglan-running',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '活动知识训练任务',
    status: 'running',
    totalCount: 4,
    successCount: 1,
    failedCount: 0,
    createdAt: '2026/06/11 16:30',
    updatedAt: '2026/06/11 16:50',
  },
  {
    taskId: 'job-low-completed',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '低命中机构修复资料导入',
    status: 'completed',
    totalCount: 2,
    successCount: 2,
    failedCount: 0,
    createdAt: '2026/06/10 15:10',
    updatedAt: '2026/06/10 15:50',
  },
  {
    taskId: 'job-low-partial',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '低命中话术补录任务',
    status: 'partial_failed',
    totalCount: 2,
    successCount: 1,
    failedCount: 1,
    createdAt: '2026/06/09 09:30',
    updatedAt: '2026/06/09 09:50',
  },
  {
    taskId: 'job-abnormal-failed',
    tenantId: 'tenant-abnormal-name',
    tenantName: '??enterprise??-79164001',
    title: '机构名称异常样例任务',
    status: 'failed',
    totalCount: 2,
    successCount: 0,
    failedCount: 2,
    createdAt: '2026/06/08 18:00',
    updatedAt: '2026/06/08 18:30',
  },
  {
    taskId: 'job-abnormal-running',
    tenantId: 'tenant-abnormal-name',
    tenantName: null,
    title: '未命名机构活动任务',
    status: 'running',
    totalCount: 1,
    successCount: 0,
    failedCount: 0,
    createdAt: '2026/06/08 17:20',
    updatedAt: '2026/06/08 17:25',
  },
];

export const platformKnowledgeTopQuestions: TopQuestion[] = [
  {
    knowledgeId: 'knowledge-price-reply',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    questionTitle: '客户询问价格时怎么回复？',
    category: '话术库',
    folder: '咨询接待',
    hitCount: 34,
    updatedAt: '2026/06/12 09:42',
  },
  {
    knowledgeId: 'knowledge-hydro-care',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    questionTitle: '水光针术后需要注意什么？',
    category: '术后护理',
    folder: '光电项目',
    hitCount: 27,
    updatedAt: '2026/06/12 10:26',
  },
  {
    knowledgeId: 'knowledge-summer-activity',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    questionTitle: '六月活动权益适合哪些客户？',
    category: '活动知识',
    folder: '活动政策',
    hitCount: 11,
    updatedAt: '2026/06/11 16:45',
  },
  {
    knowledgeId: 'knowledge-repair-diet',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    questionTitle: '修复术后饮食要注意什么？',
    category: '术后护理',
    folder: '修复项目',
    hitCount: 6,
    updatedAt: '2026/06/10 15:36',
  },
  {
    knowledgeId: 'knowledge-efficiency',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    questionTitle: '如何降低知识库重复问答成本？',
    category: '项目知识',
    folder: '内部培训',
    hitCount: 4,
    updatedAt: '2026/06/11 16:29',
  },
  {
    knowledgeId: 'knowledge-repair-recovery',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    questionTitle: '客户担心恢复期怎么回复？',
    category: '话术库',
    folder: '咨询接待',
    hitCount: 3,
    updatedAt: '2026/06/10 14:20',
  },
  {
    knowledgeId: 'knowledge-abnormal-activity',
    tenantId: 'tenant-abnormal-name',
    tenantName: null,
    questionTitle: '未命名机构活动如何兜底展示？',
    category: '活动知识',
    folder: '活动政策',
    hitCount: 2,
    updatedAt: '2026/06/08 17:40',
  },
];

export const platformKnowledgeEmptyState = {
  title: '暂无匹配的知识库运营数据',
  description: '请调整机构范围或文件名搜索条件后再查看。',
} as const;

const categoryCodeMap: Record<string, string> = {
  话术库: 'script',
  项目知识: 'project',
  术后护理: 'aftercare',
  活动知识: 'campaign',
};

const parseStatusLabels: Record<KnowledgeFileParseStatus, string> = {
  parsed: '已解析',
  failed: '解析失败',
  parsing: '解析中',
  pending: '待解析',
};

const taskStatusLabels: Record<KnowledgeFileTaskStatus, string> = {
  completed: '已完成',
  running: '进行中',
  failed: '有失败',
  pending: '待处理',
};

export const platformKnowledgeCategories = buildCategoryStats(platformKnowledgeItems);
export const platformKnowledgeTenants = buildTenantStats(tenantDirectory);

export const platformKnowledgeMockData: PlatformKnowledgeMockData = {
  totals: calculateTotals({
    tenants: platformKnowledgeTenants,
    knowledgeItems: platformKnowledgeItems,
    files: platformKnowledgeFiles,
    importJobs: platformKnowledgeImportJobs,
  }),
  tenants: platformKnowledgeTenants,
  knowledgeItems: platformKnowledgeItems,
  files: platformKnowledgeFiles,
  categories: platformKnowledgeCategories,
  topQuestions: sortTopQuestions(platformKnowledgeTopQuestions),
  importJobs: platformKnowledgeImportJobs,
  emptyState: platformKnowledgeEmptyState,
};

export function getPlatformKnowledgeMockData(): PlatformKnowledgeMockData {
  return {
    ...platformKnowledgeMockData,
    totals: { ...platformKnowledgeMockData.totals },
    tenants: [...platformKnowledgeMockData.tenants],
    knowledgeItems: [...platformKnowledgeMockData.knowledgeItems],
    files: [...platformKnowledgeMockData.files],
    categories: [...platformKnowledgeMockData.categories],
    topQuestions: [...platformKnowledgeMockData.topQuestions],
    importJobs: [...platformKnowledgeMockData.importJobs],
  };
}

export function getPlatformKnowledgeScope(
  data: PlatformKnowledgeMockData,
  tenantId?: string | null,
): PlatformKnowledgeScope {
  const scopedTenant = tenantId ? data.tenants.find((tenant) => tenant.tenantId === tenantId) : null;
  const scopedTenantIds = scopedTenant ? new Set([scopedTenant.tenantId]) : new Set(data.tenants.map((tenant) => tenant.tenantId));
  const knowledgeItems = data.knowledgeItems.filter((item) => scopedTenantIds.has(item.tenantId));
  const files = data.files.filter((file) => scopedTenantIds.has(file.tenantId));
  const importJobs = data.importJobs.filter((job) => scopedTenantIds.has(job.tenantId));
  const tenants = scopedTenant ? [scopedTenant] : data.tenants;
  const topQuestions = sortTopQuestions(data.topQuestions.filter((question) => scopedTenantIds.has(question.tenantId))).slice(0, 10);

  return {
    tenantId: scopedTenant?.tenantId ?? null,
    scopeName: scopedTenant ? normalizeTenantName(scopedTenant.tenantName) : '全部机构',
    totals: calculateTotals({ tenants, knowledgeItems, files, importJobs }),
    tenants,
    knowledgeItems,
    files,
    categories: buildCategoryStats(knowledgeItems),
    topQuestions,
    importJobs,
  };
}

export function filterKnowledgeFiles(files: KnowledgeFileItem[], params: KnowledgeFileFilterParams) {
  const keyword = normalizeKeyword(params.keyword);

  return files.filter((file) => {
    if (params.tenantId && file.tenantId !== params.tenantId) return false;
    if (params.status && file.parseStatus !== params.status) return false;
    if (!keyword) return true;

    return [
      file.fileName,
      normalizeTenantName(file.tenantName),
      file.category,
      file.folder,
      file.mimeType,
      file.fileType,
      parseStatusLabels[file.parseStatus],
      taskStatusLabels[file.taskStatus],
    ].some((value) => value.toLowerCase().includes(keyword));
  });
}

export function filterKnowledgeItems(items: KnowledgeItem[], params: KnowledgeItemFilterParams) {
  const keyword = normalizeKeyword(params.keyword);

  return items.filter((item) => {
    if (params.tenantId && item.tenantId !== params.tenantId) return false;
    if (params.category && item.category !== params.category) return false;
    if (params.trainingStatus && item.trainingStatus !== params.trainingStatus) return false;
    if (!keyword) return true;

    return [
      item.title,
      item.summaryPreview,
      normalizeTenantName(item.tenantName),
      item.category,
      item.folder,
    ].some((value) => value.toLowerCase().includes(keyword));
  });
}

export function calculateScopeTotals(data: PlatformKnowledgeMockData, tenantId?: string | null) {
  return getPlatformKnowledgeScope(data, tenantId).totals;
}

export function normalizeTenantName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return '未命名机构';
  if (
    trimmed.includes('�') ||
    trimmed.includes('??') ||
    /^\?+$/.test(trimmed) ||
    /^[-_\s]+$/.test(trimmed) ||
    /^unknown$/i.test(trimmed)
  ) {
    return '机构名称异常';
  }

  return trimmed;
}

function buildTenantStats(directory: Array<Pick<TenantKnowledgeStats, 'tenantId' | 'tenantName' | 'status'>>) {
  return directory.map((tenant) => {
    const knowledgeItems = platformKnowledgeItems.filter((item) => item.tenantId === tenant.tenantId);
    const files = platformKnowledgeFiles.filter((file) => file.tenantId === tenant.tenantId);
    const importJobs = platformKnowledgeImportJobs.filter((job) => job.tenantId === tenant.tenantId);
    const totals = calculateTotals({ tenants: [tenant], knowledgeItems, files, importJobs });

    return {
      ...tenant,
      knowledgeCount: totals.knowledgeCount,
      folderCount: totals.folderCount,
      hitCount: totals.hitCount,
      trainedCount: totals.trainedCount,
      failedTrainingCount: totals.failedTrainingCount,
      zeroHitCount: totals.zeroHitCount,
      chunkCount: totals.chunkCount,
      averageHitCount: totals.averageHitCount,
      hitCoverageRate: totals.hitCoverageRate,
      trainingCoverageRate: totals.trainingCoverageRate,
      importSuccessRate: totals.importSuccessRate,
    } satisfies TenantKnowledgeStats;
  });
}

function buildCategoryStats(items: KnowledgeItem[]): CategoryStats[] {
  const byCategory = new Map<string, KnowledgeItem[]>();
  items.forEach((item) => {
    const current = byCategory.get(item.category) ?? [];
    current.push(item);
    byCategory.set(item.category, current);
  });

  return Array.from(byCategory.entries())
    .map(([categoryName, categoryItems]) => {
      const knowledgeCount = categoryItems.length;
      const hitCount = categoryItems.reduce((sum, item) => sum + item.hitCount, 0);
      const trainedCount = categoryItems.filter((item) => item.trainingStatus === 'trained').length;
      const zeroHitCount = categoryItems.filter((item) => item.hitCount === 0).length;
      const chunkCount = categoryItems.reduce((sum, item) => sum + item.chunkCount, 0);

      return {
        categoryCode: categoryCodeMap[categoryName] ?? `category-${categoryName}`,
        categoryName,
        knowledgeCount,
        hitCount,
        trainedCount,
        zeroHitCount,
        chunkCount,
        averageHitCount: average(hitCount, knowledgeCount),
        hitCoverageRate: rate(knowledgeCount - zeroHitCount, knowledgeCount),
        trainingCoverageRate: rate(trainedCount, knowledgeCount),
      } satisfies CategoryStats;
    })
    .sort((a, b) => b.hitCount - a.hitCount);
}

function calculateTotals(input: {
  tenants: Array<Pick<TenantKnowledgeStats, 'tenantId'>>;
  knowledgeItems: KnowledgeItem[];
  files: KnowledgeFileItem[];
  importJobs: ImportJob[];
}): PlatformKnowledgeTotals {
  const tenantIds = new Set(input.tenants.map((tenant) => tenant.tenantId));
  const knowledgeCount = input.knowledgeItems.length;
  const hitCount = input.knowledgeItems.reduce((sum, item) => sum + item.hitCount, 0);
  const chunkCount = input.knowledgeItems.reduce((sum, item) => sum + item.chunkCount, 0);
  const trainedCount = input.knowledgeItems.filter((item) => item.trainingStatus === 'trained').length;
  const failedTrainingCount = input.knowledgeItems.filter((item) => item.trainingStatus === 'failed').length;
  const zeroHitCount = input.knowledgeItems.filter((item) => item.hitCount === 0).length;
  const totalImportedCount = input.importJobs.reduce((sum, job) => sum + job.totalCount, 0);
  const successfulImportedCount = input.importJobs.reduce((sum, job) => sum + job.successCount, 0);
  const failedImportJobCount = input.importJobs.filter((job) => job.failedCount > 0 || job.status === 'failed' || job.status === 'partial_failed').length;

  return {
    tenantCount: tenantIds.size,
    knowledgeCount,
    categoryCount: new Set(input.knowledgeItems.map((item) => item.category)).size,
    folderCount: new Set(input.knowledgeItems.map((item) => item.folder)).size,
    hitCount,
    chunkCount,
    averageHitCount: average(hitCount, knowledgeCount),
    trainedCount,
    failedTrainingCount,
    zeroHitCount,
    importJobCount: input.importJobs.length,
    failedImportJobCount,
    hitCoverageRate: rate(knowledgeCount - zeroHitCount, knowledgeCount),
    trainingCoverageRate: rate(trainedCount, knowledgeCount),
    importSuccessRate: rate(successfulImportedCount, totalImportedCount),
    pendingOptimizationCount: zeroHitCount + failedTrainingCount + failedImportJobCount,
    sourceFileCount: input.files.length,
    totalFileSizeKb: input.files.reduce((sum, file) => sum + file.fileSizeKb, 0),
    parsedFileCount: input.files.filter((file) => file.parseStatus === 'parsed').length,
    failedFileCount: input.files.filter((file) => file.parseStatus === 'failed').length,
  };
}

function sortTopQuestions(questions: TopQuestion[]) {
  return [...questions].sort((a, b) => b.hitCount - a.hitCount);
}

function normalizeKeyword(keyword: string | undefined) {
  return keyword?.trim().toLowerCase() ?? '';
}

function average(total: number, count: number) {
  return count > 0 ? Number((total / count).toFixed(1)) : 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}
