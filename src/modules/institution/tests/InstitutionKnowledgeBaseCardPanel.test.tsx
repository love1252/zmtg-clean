import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstitutionKnowledgeBaseCardPanel } from '@/modules/institution/components/InstitutionKnowledgeBaseCardPanel';

describe('InstitutionKnowledgeBaseCardPanel', () => {
  it('展示机构知识库标题和受控说明', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    expect(screen.getByRole('heading', { name: '机构知识库' })).toBeInTheDocument();
    expect(screen.getByText('用于维护机构内部话术、项目说明、服务流程和培训知识。当前为受控运营视图，真实上传 / 解析 / 训练 / 检索能力后续接入。')).toBeInTheDocument();
    expect(screen.getByText(/示例结构或受控 fallback/)).toBeInTheDocument();
  });

  it('展示顶部指标卡', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const metrics = screen.getByLabelText('机构知识库顶部指标');
    ['知识条目', '文件数', '已解析 / 待解析', '待优化 / 低命中'].forEach((label) => {
      expect(within(metrics).getByText(label)).toBeInTheDocument();
    });
    expect(within(metrics).getByText('24')).toBeInTheDocument();
    expect(within(metrics).getByText('18')).toBeInTheDocument();
    expect(within(metrics).getByText('11 / 7')).toBeInTheDocument();
    expect(within(metrics).getByText('6 / 3')).toBeInTheDocument();
  });

  it('展示左侧知识目录并支持本地选中态切换', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const directorySection = screen.getByLabelText('机构知识目录');
    ['全部知识', '咨询话术', '项目资料', '术后护理', '活动政策', '培训资料'].forEach((label) => {
      expect(within(directorySection).getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    });

    const allButton = within(directorySection).getByRole('button', { name: /全部知识/ });
    const aftercareButton = within(directorySection).getByRole('button', { name: /术后护理/ });
    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(aftercareButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(aftercareButton);

    expect(allButton).toHaveAttribute('aria-pressed', 'false');
    expect(aftercareButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('当前目录：术后护理。条目为示例结构或待接入真实知识数据。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '术后冷敷护理提醒' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '初诊咨询接待标准话术' })).not.toBeInTheDocument();
  });

  it('展示知识条目卡片', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const entrySection = screen.getByLabelText('机构知识条目卡片');
    const entryCard = within(entrySection).getByRole('heading', { name: '初诊咨询接待标准话术' }).closest('article') as HTMLElement;
    expect(within(entrySection).getByRole('heading', { name: '知识条目' })).toBeInTheDocument();
    expect(within(entryCard).getByRole('heading', { name: '初诊咨询接待标准话术' })).toBeInTheDocument();
    expect(within(entryCard).getByText('咨询话术 / 初诊接待')).toBeInTheDocument();
    expect(within(entryCard).getByText('已解析示例')).toBeInTheDocument();
    expect(within(entryCard).getByText('更新于 2026-07-02 10:20')).toBeInTheDocument();
    expect(within(entryCard).getByText('命中稳定；低命中提示为受控示例')).toBeInTheDocument();
    expect(within(entryCard).getByText('片段数 16（示例）')).toBeInTheDocument();
    expect(within(entryCard).getByText(/用于演示咨询顾问接待流程/)).toBeInTheDocument();
  });

  it('展示文件 / 文档卡片', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const documentSection = screen.getByLabelText('机构知识库文件文档卡片');
    expect(within(documentSection).getByRole('heading', { name: '文件 / 文档' })).toBeInTheDocument();
    expect(within(documentSection).getByText('初诊咨询标准话术.md')).toBeInTheDocument();
    expect(within(documentSection).getByText('Markdown / 42 KB')).toBeInTheDocument();
    expect(within(documentSection).getByText('解析字符数 18,420（示例）')).toBeInTheDocument();
    expect(within(documentSection).getAllByText('暂无错误').length).toBeGreaterThan(0);
    expect(within(documentSection).getByText('操作待接入真实功能')).toBeInTheDocument();
  });

  it('受控按钮均禁用并提示待接入真实功能', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const actionSection = screen.getByLabelText('机构知识库受控操作');
    ['上传文档', '新建知识', '新建文件夹', '重新解析', '重新训练', '删除'].forEach((label) => {
      const button = within(actionSection).getByRole('button', { name: `${label}（待接入真实功能）` });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', '待接入真实功能');
    });
    expect(actionSection.textContent).toContain('均待接入真实功能，本轮不可执行');
  });

  it('展示检索测试卡片且真实检索按钮不可执行', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    expect(within(searchSection).getByRole('heading', { name: '检索测试' })).toBeInTheDocument();
    expect(within(searchSection).getByText('真实检索测试能力待接入，不调用 AI / provider / search API。')).toBeInTheDocument();
    expect(within(searchSection).getByLabelText('知识库检索测试只读输入')).toHaveAttribute('readonly');
    expect(within(searchSection).getByRole('button', { name: '开始检索测试' })).toBeDisabled();
    expect(within(searchSection).getByText('示例问题：术后冷敷需要注意什么？')).toBeInTheDocument();
    expect(within(searchSection).getByText(/检索结果区域：当前仅展示空状态/)).toBeInTheDocument();
  });

  it('展示解析 / 训练任务记录卡片', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const taskSection = screen.getByLabelText('机构知识库解析训练任务记录');
    expect(within(taskSection).getByRole('heading', { name: '解析 / 训练任务记录' })).toBeInTheDocument();
    expect(within(taskSection).getByText('咨询话术解析任务')).toBeInTheDocument();
    expect(within(taskSection).getByText('活动政策文件解析任务')).toBeInTheDocument();
    expect(within(taskSection).getByText('解析中')).toBeInTheDocument();
    expect(within(taskSection).getByText('待解析')).toBeInTheDocument();
    expect(within(taskSection).getByText('错误信息：示例错误：字段格式不一致')).toBeInTheDocument();
    expect(within(taskSection).getByText('训练按钮受控禁用，等待真实训练 runtime')).toBeInTheDocument();
  });

  it('展示右侧运营建议 / 风险提示卡片', () => {
    render(<InstitutionKnowledgeBaseCardPanel />);

    const riskSection = screen.getByLabelText('机构知识库运营建议风险提示');
    expect(within(riskSection).getByRole('heading', { name: '运营建议 / 风险提示' })).toBeInTheDocument();
    ['低命中知识', '待补充资料', '解析失败文件', '待训练内容', '建议动作'].forEach((label) => {
      expect(within(riskSection).getByRole('heading', { name: label })).toBeInTheDocument();
    });
    expect(riskSection.textContent).toContain('全部为受控示例或 fallback，不伪装真实风控。');
  });

  it('不出现误导真实能力已完成或已接入的文案', () => {
    const { container } = render(<InstitutionKnowledgeBaseCardPanel />);

    [
      '真实训练已完成',
      '真实解析已完成',
      '真实统计 API 已接入',
      '已接入真实知识库数据库',
    ].forEach((text) => {
      expect(container.textContent).not.toContain(text);
    });
  });
});
