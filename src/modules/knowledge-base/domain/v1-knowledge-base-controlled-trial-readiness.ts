export type KnowledgeBaseTrialCapabilityItem = {
  id: string;
  label: string;
  description: string;
};

export type KnowledgeBaseTrialFileType = {
  id: string;
  label: string;
  behavior: string;
};

export type KnowledgeBaseTrialSafetyLimit = {
  label: string;
  value: string;
  description: string;
};

export type KnowledgeBaseTrialFailureState = {
  id: string;
  label: string;
  message: string;
  operatorGuidance: string;
};

export type KnowledgeBaseControlledTrialReadiness = {
  stage: '10-5';
  status: '内部受控试用';
  baselineCommit: string;
  summary: string;
  supportedFileTypes: KnowledgeBaseTrialFileType[];
  safetyLimits: KnowledgeBaseTrialSafetyLimit[];
  platform: {
    notice: string;
    trialSteps: KnowledgeBaseTrialCapabilityItem[];
    acceptanceChecklist: KnowledgeBaseTrialCapabilityItem[];
    allowedCapabilities: KnowledgeBaseTrialCapabilityItem[];
  };
  institution: {
    notice: string;
    trialSteps: KnowledgeBaseTrialCapabilityItem[];
    acceptanceChecklist: KnowledgeBaseTrialCapabilityItem[];
    allowedCapabilities: KnowledgeBaseTrialCapabilityItem[];
    forbiddenActions: KnowledgeBaseTrialCapabilityItem[];
  };
  blockedCapabilities: KnowledgeBaseTrialCapabilityItem[];
  lowSensitiveBoundaries: string[];
  forbiddenFieldHints: string[];
  commonFailureStates: KnowledgeBaseTrialFailureState[];
  passingCriteria: string[];
  failureMessages: string[];
};

const controlledTrialReadiness: KnowledgeBaseControlledTrialReadiness = {
  stage: '10-5',
  status: '内部受控试用',
  baselineCommit: 'be94539792d54ac67275702cd102364f621bd706',
  summary: '知识库已进入内部受控试用验收闭环，当前仅开放低敏、授权、mock/local 能力。',
  supportedFileTypes: [
    { id: 'txt', label: 'TXT', behavior: '按纯文本解析，空内容会安全失败。' },
    { id: 'md', label: 'Markdown', behavior: '按 Markdown 文本解析，保留可读正文。' },
    { id: 'csv', label: 'CSV', behavior: '抽取表格文本并复用现有 chunk 切分。' },
    { id: 'pdf_text', label: '文本型 PDF', behavior: '仅抽取文本型 PDF；扫描件或空文本安全失败。' },
    { id: 'docx', label: 'DOCX', behavior: '抽取正文文本，受 ZIP 解压上限保护。' },
    { id: 'xlsx', label: 'XLSX', behavior: '抽取工作表文本，受 ZIP 解压上限保护。' },
  ],
  safetyLimits: [
    { label: '文件大小限制', value: '20MB', description: '超过限制会安全拒绝解析。' },
    { label: '解析文本上限', value: '32000 字符', description: '超过上限会截断并保留低敏状态。' },
    { label: 'ZIP 单文件解压上限', value: '5MB', description: 'DOCX/XLSX 解压单文件限制。' },
    { label: 'ZIP 总解压上限', value: '12MB', description: 'DOCX/XLSX 解压总量限制。' },
    { label: 'PDF 单段解压上限', value: '8MB', description: 'PDF 文本流解压限制。' },
  ],
  platform: {
    notice: '平台端可按 tenant 范围试用知识库管理闭环。',
    trialSteps: [
      { id: 'capability', label: '确认 capability 与 No-Go', description: '先确认能力开关、No-Go 清单和禁止外显字段。' },
      { id: 'parse', label: '上传白名单文件并发起解析', description: '验证文件上传、真实文本解析和安全失败文案。' },
      { id: 'chunks', label: '查看解析状态与 chunk 预览', description: '确认解析状态、失败原因和低敏 chunk 预览。' },
      { id: 'keyword', label: '执行关键词检索', description: '使用已解析 chunk 验证关键词召回。' },
      { id: 'vector', label: '执行 mock 向量检索', description: '使用 mock embedding 验证相似片段召回。' },
      { id: 'qa', label: '发起 mock/local QA', description: '基于召回片段验证本地问答和无引用状态。' },
      { id: 'audit', label: '核对 citations 与 QA audit', description: '核对回答引用、审计编号和低敏审计记录。' },
      { id: 'quota', label: '核对 quota 与失败态说明', description: '核对每日次数限制和各类中文安全状态说明。' },
    ],
    acceptanceChecklist: [
      { id: 'parse-copy', label: '解析状态和失败文案可理解', description: '解析成功、空内容、格式不支持、大小超限和解析失败均有中文安全说明。' },
      { id: 'chunk-safe', label: '检索和 QA 均基于低敏 chunk', description: '检索、QA 与 citations 只展示低敏片段预览。' },
      { id: 'audit-quota', label: 'citations、audit、quota、capability 可核对', description: '引用、审计、用量和能力边界均在平台端可确认。' },
      { id: 'no-go', label: 'No-Go 和禁止外显字段持续可见', description: '高风险能力禁用边界和禁止外显字段对试用人员可见。' },
    ],
    allowedCapabilities: [
      { id: 'upload', label: '文件上传', description: '平台端可在受控范围上传白名单文件。' },
      { id: 'parse', label: '真实文本文件解析', description: '仅解析文本型文件，不做图片识别。' },
      { id: 'chunks', label: 'chunk 查看', description: '查看复用现有切分机制生成的低敏片段预览。' },
      { id: 'keyword', label: '关键词检索', description: '基于已解析 chunk 的关键词检索。' },
      { id: 'vector', label: 'mock 向量检索', description: '使用 deterministic mock embedding 验证召回链路。' },
      { id: 'qa', label: 'mock/local QA', description: '基于召回片段生成本地回答，不调用真实 AI。' },
      { id: 'citations', label: 'citations', description: '展示回答引用的低敏片段来源。' },
      { id: 'audit', label: 'QA audit', description: '查看低敏问答审计记录。' },
      { id: 'quota', label: 'quota', description: '受 tenant 与 institution 每日次数限制。' },
      { id: 'capability', label: 'capability', description: '查看能力启用状态和禁用边界。' },
    ],
  },
  institution: {
    notice: '机构端仅可只读试用授权内容。',
    trialSteps: [
      { id: 'authorizedScope', label: '确认只读授权范围', description: '先确认只能访问本机构归属或平台授权内容。' },
      { id: 'authorizedFiles', label: '查看授权知识库与授权文件', description: '查看授权知识库摘要、文件低敏元数据和解析状态。' },
      { id: 'parseStatus', label: '查看解析状态与 chunk 预览', description: '只读查看解析成功、失败或待处理状态和 chunk 预览。' },
      { id: 'keyword', label: '执行关键词检索', description: '仅在本机构可见范围内验证关键词召回。' },
      { id: 'vector', label: '执行 mock 向量检索', description: '仅在授权范围内验证 mock 相似片段召回。' },
      { id: 'qa', label: '发起 mock/local QA', description: '基于授权片段验证本地问答。' },
      { id: 'audit', label: '核对 citations 与本机构 QA audit', description: '核对授权引用和本机构低敏问答审计。' },
      { id: 'forbiddenActions', label: '确认禁止操作不可用', description: '确认上传、解析、训练、embedding、visibility 和真实 AI 入口不可见。' },
    ],
    acceptanceChecklist: [
      { id: 'authorizedOnly', label: '只能查看授权知识库内容', description: '本机构外、其他 tenant 和未授权知识库均不可见。' },
      { id: 'readonlyFlow', label: '只读链路可完成检索、QA、citations、audit 验收', description: '机构端不需要管理入口即可完成只读试用闭环。' },
      { id: 'forbiddenEntries', label: '上传、归档、解析、训练、embedding、visibility、真实 AI 入口不可见', description: '机构端不提供任何管理、训练或真实 AI 操作。' },
      { id: 'isolation', label: '跨机构、跨 tenant、未授权内容不可见', description: '权限态失败时仅展示中文安全说明。' },
    ],
    allowedCapabilities: [
      { id: 'authorizedKnowledge', label: '授权知识库查看', description: '只查看本机构归属或平台授权知识库。' },
      { id: 'authorizedFiles', label: '授权文件查看', description: '只查看授权文件的低敏元数据和解析状态。' },
      { id: 'parseStatus', label: '解析状态查看', description: '查看待解析、解析中、成功或失败状态。' },
      { id: 'chunkPreview', label: 'chunk 预览', description: '只查看授权范围内的低敏 chunk 预览。' },
      { id: 'keyword', label: '关键词检索', description: '仅在本机构可见范围内检索。' },
      { id: 'qa', label: 'mock/local QA', description: '仅基于授权片段发起 mock/local QA。' },
      { id: 'citations', label: 'citations', description: '只展示授权引用片段。' },
      { id: 'audit', label: 'QA audit', description: '只读查看本机构低敏问答审计。' },
    ],
    forbiddenActions: [
      { id: 'upload', label: '上传', description: '机构端不提供知识库文件上传入口。' },
      { id: 'archive', label: '归档', description: '机构端不提供归档或删除入口。' },
      { id: 'parse', label: '发起解析', description: '机构端不能触发平台知识库解析。' },
      { id: 'training', label: '训练', description: '当前不提供任何训练能力。' },
      { id: 'embedding', label: '生成 embedding', description: '机构端不能生成或重建 embedding。' },
      { id: 'visibility', label: '管理 visibility', description: '机构端不能管理授权可见范围。' },
      { id: 'realAi', label: '调用真实 AI', description: '当前不允许调用真实 AI。' },
    ],
  },
  blockedCapabilities: [
    { id: 'ocr', label: 'OCR', description: '未接入图片文字识别，内部试用不包含 OCR。' },
    { id: 'scannedPdf', label: '扫描 PDF / 图片文字识别', description: '扫描件或图片内容没有可抽取文本时会安全失败。' },
    { id: 'realAi', label: '真实 AI', description: '真实 AI 未启用，QA 仍为 mock/local。' },
    { id: 'credentials', label: '真实凭据 / API 凭据', description: '不读取、写入或使用任何真实凭据。' },
    { id: 'externalNetwork', label: '外部网络服务', description: '不调用外部网络解析、AI 或向量服务。' },
    { id: 'vectorStore', label: '真实向量数据库', description: '当前仅使用本地 mock embedding。' },
    { id: 'runtimeIngestion', label: 'runtime ingestion', description: '不启用自动 ingestion 链路。' },
    { id: 'workerQueue', label: 'worker / queue / scheduler', description: '不启用后台 worker、queue 或 scheduler。' },
    { id: 'training', label: '训练系统', description: '不做模型训练或知识训练系统。' },
    { id: 'billing', label: '计费系统', description: '不接入计费或商业化扣费。' },
    { id: 'dashboard', label: 'dashboard 聚合', description: '不新增 dashboard 聚合页。' },
    { id: 'homepage', label: '首页编辑', description: '不开发或修改首页编辑能力。' },
  ],
  lowSensitiveBoundaries: [
    '仅展示低敏摘要、解析状态、chunk 预览、引用和审计摘要。',
    '平台端按 tenant 范围展示，机构端按本机构授权范围展示。',
    '错误文案只返回中文安全说明，不展示底层异常原文。',
  ],
  forbiddenFieldHints: ['存储定位键', '本地文件系统路径', '数据库语句', '异常堆栈', '令牌', '密钥', 'API 凭据'],
  commonFailureStates: [
    { id: 'empty', label: '空态', message: '暂无授权可见知识库', operatorGuidance: '确认 tenant、机构授权范围或搜索条件后再刷新。' },
    { id: 'parseFailed', label: '解析失败', message: '知识库文件解析失败，请稍后重试', operatorGuidance: '按文件类型、大小、空文本或扫描件预期处理，不补做 OCR。' },
    { id: 'permissionDenied', label: '权限失败', message: '当前账号没有访问该知识库内容的权限', operatorGuidance: '确认当前账号、tenant、institution 与授权范围。' },
    { id: 'quotaExceeded', label: 'quota 超限', message: '当前知识库问答次数已达上限，请稍后再试', operatorGuidance: '保留每日次数限制，不绕过 quota。' },
    { id: 'noCitation', label: '无引用', message: '当前问题没有命中可引用的知识片段', operatorGuidance: '调整问题或先确认文件已解析并存在 chunk。' },
    { id: 'noSearchResult', label: '无检索结果', message: '当前范围没有命中关键词或相似片段', operatorGuidance: '调整关键词、确认授权范围和解析状态。' },
  ],
  passingCriteria: [
    '平台端按步骤完成上传、解析、chunk、检索、QA、citations、audit、quota、capability 验收。',
    '机构端按步骤完成授权内容只读查看、检索、QA、citations 和本机构 audit 验收。',
    '空态、失败态、权限态、quota 超限态、无引用态、无检索结果均展示中文安全文案。',
    'No-Go、低敏字段边界和禁止外显字段在平台端与机构端持续可见。',
  ],
  failureMessages: [
    '当前文件类型暂不支持解析',
    '文件大小超过解析限制，请拆分后重新上传',
    '文件未提取到可解析文本，扫描件或图片内容暂不支持',
    '知识库文件解析失败，请稍后重试',
    '解析文本超过长度限制，已截断为低敏预览',
    '当前知识库问答次数已达上限，请稍后再试',
    '当前账号没有访问该知识库内容的权限',
  ],
};

export function getKnowledgeBaseControlledTrialReadiness(): KnowledgeBaseControlledTrialReadiness {
  return controlledTrialReadiness;
}
