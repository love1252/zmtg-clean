import { describe, expect, it } from 'vitest';

import { projectFollowUpBusinessDate } from '@/modules/care/domain/follow-up-business-time';

const version = 'operating-context-17';

describe('随访机构业务日纯领域投影', () => {
  it('按 Asia/Shanghai 本地日界投影而非按 UTC 日期', () => {
    expect(
      projectFollowUpBusinessDate({
        instant: '2026-07-16T15:59:59.999Z',
        timeZone: 'Asia/Shanghai',
        operatingContextVersion: version,
      }),
    ).toEqual({
      date: '2026-07-16',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: version,
    });

    expect(
      projectFollowUpBusinessDate({
        instant: '2026-07-16T16:00:00.000Z',
        timeZone: 'Asia/Shanghai',
        operatingContextVersion: version,
      }),
    ).toEqual({
      date: '2026-07-17',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: version,
    });
  });

  it('接受带显式 offset 的合法 ISO instant', () => {
    expect(
      projectFollowUpBusinessDate({
        instant: '2026-07-17T00:00:00+08:00',
        timeZone: 'Asia/Shanghai',
        operatingContextVersion: version,
      }),
    ).toMatchObject({ date: '2026-07-17' });
  });

  it('覆盖 America/New_York 2026 春季跳时业务日', () => {
    const instants = [
      '2026-03-08T05:00:00.000Z',
      '2026-03-08T06:59:59.999Z',
      '2026-03-08T07:00:00.000Z',
      '2026-03-09T03:59:59.999Z',
    ];

    for (const instant of instants) {
      expect(
        projectFollowUpBusinessDate({
          instant,
          timeZone: 'America/New_York',
          operatingContextVersion: version,
        }),
        instant,
      ).toMatchObject({ date: '2026-03-08' });
    }

    expect(
      projectFollowUpBusinessDate({
        instant: '2026-03-09T04:00:00.000Z',
        timeZone: 'America/New_York',
        operatingContextVersion: version,
      }),
    ).toMatchObject({ date: '2026-03-09' });
  });

  it('覆盖 America/New_York 2026 秋季重复小时业务日', () => {
    for (const instant of [
      '2026-11-01T04:00:00.000Z',
      '2026-11-01T05:30:00.000Z',
      '2026-11-01T06:30:00.000Z',
      '2026-11-02T04:59:59.999Z',
    ]) {
      expect(
        projectFollowUpBusinessDate({
          instant,
          timeZone: 'America/New_York',
          operatingContextVersion: version,
        }),
        instant,
      ).toMatchObject({ date: '2026-11-01' });
    }

    expect(
      projectFollowUpBusinessDate({
        instant: '2026-11-02T05:00:00.000Z',
        timeZone: 'America/New_York',
        operatingContextVersion: version,
      }),
    ).toMatchObject({ date: '2026-11-02' });
  });

  it('对非法或非 instant 时间 fail-closed', () => {
    for (const instant of [
      null,
      123,
      new Date('2026-07-17T00:00:00.000Z'),
      '',
      '2026-07-17',
      '2026-07-17T00:00:00',
      '2026-02-30T00:00:00.000Z',
      '2026-07-17T24:00:00.000Z',
      '2026-07-17T00:60:00.000Z',
      '2026-07-17T00:00:60.000Z',
      '2026-07-17T00:00:00.000+24:00',
      ' 2026-07-17T00:00:00.000Z',
    ]) {
      expect(
        projectFollowUpBusinessDate({
          instant,
          timeZone: 'Asia/Shanghai',
          operatingContextVersion: version,
        }),
        String(instant),
      ).toBeNull();
    }
  });

  it('offset 把 instant 推出公元 0001 至 9999 时 fail-closed', () => {
    expect(
      projectFollowUpBusinessDate({
        instant: '0001-01-01T00:00:00.000+23:59',
        timeZone: 'UTC',
        operatingContextVersion: version,
      }),
    ).toBeNull();
    expect(
      projectFollowUpBusinessDate({
        instant: '9999-12-31T23:59:59.999-23:59',
        timeZone: 'UTC',
        operatingContextVersion: version,
      }),
    ).toBeNull();
    expect(
      projectFollowUpBusinessDate({
        instant: '0001-01-01T00:00:00.000Z',
        timeZone: 'UTC',
        operatingContextVersion: version,
      }),
    ).toMatchObject({ date: '0001-01-01' });
    expect(
      projectFollowUpBusinessDate({
        instant: '9999-12-31T23:59:59.999Z',
        timeZone: 'UTC',
        operatingContextVersion: version,
      }),
    ).toMatchObject({ date: '9999-12-31' });
  });

  it('拒绝非法或固定 offset 时区标识', () => {
    for (const timeZone of [null, 8, '', ' ', 'Asia/Shanghai ', '+08:00', 'Not/AZone']) {
      expect(
        projectFollowUpBusinessDate({
          instant: '2026-07-17T00:00:00.000Z',
          timeZone,
          operatingContextVersion: version,
        }),
        String(timeZone),
      ).toBeNull();
    }
  });

  it('把 operatingContextVersion 作为非空不透明版本门禁', () => {
    for (const operatingContextVersion of [
      null,
      17,
      '',
      ' ',
      ' version-17',
      'version-17 ',
      'version\n17',
    ]) {
      expect(
        projectFollowUpBusinessDate({
          instant: '2026-07-17T00:00:00.000Z',
          timeZone: 'Asia/Shanghai',
          operatingContextVersion,
        }),
        String(operatingContextVersion),
      ).toBeNull();
    }
  });

  it('输入不变且重复调用确定，时区或版本变化只改变当前投影', () => {
    const input = Object.freeze({
      instant: '2026-07-17T01:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: version,
    });
    const before = structuredClone(input);

    const first = projectFollowUpBusinessDate(input);
    expect(projectFollowUpBusinessDate(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(first).toEqual({
      date: '2026-07-17',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: version,
    });
    expect(
      projectFollowUpBusinessDate({
        ...input,
        timeZone: 'America/New_York',
      }),
    ).toEqual({
      date: '2026-07-16',
      timeZone: 'America/New_York',
      operatingContextVersion: version,
    });
    expect(
      projectFollowUpBusinessDate({
        ...input,
        operatingContextVersion: 'operating-context-18',
      }),
    ).toEqual({
      ...first,
      operatingContextVersion: 'operating-context-18',
    });
  });
});
