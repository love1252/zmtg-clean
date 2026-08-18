import { describe, expect, it } from 'vitest';

import {
  FOLLOW_UP_CONTROLLED_ACTION_CODES,
  FOLLOW_UP_CONTROLLED_STAGE_CODES,
  isFollowUpControlledActionCode,
  isFollowUpControlledStageCode,
} from '@/modules/care/domain/follow-up-controlled-create';

describe('Follow-up controlled create vocabulary', () => {
  it('freezes one explicit manual stage and action for the first controlled-write release', () => {
    expect(FOLLOW_UP_CONTROLLED_STAGE_CODES).toEqual(['manual_followup']);
    expect(FOLLOW_UP_CONTROLLED_ACTION_CODES).toEqual(['manual_contact']);
    expect(Object.isFrozen(FOLLOW_UP_CONTROLLED_STAGE_CODES)).toBe(true);
    expect(Object.isFrozen(FOLLOW_UP_CONTROLLED_ACTION_CODES)).toBe(true);
  });

  it('rejects arbitrary stage/action text', () => {
    expect(isFollowUpControlledStageCode('manual_followup')).toBe(true);
    expect(isFollowUpControlledActionCode('manual_contact')).toBe(true);
    expect(isFollowUpControlledStageCode('post_care')).toBe(false);
    expect(isFollowUpControlledActionCode('send_message')).toBe(false);
  });
});
