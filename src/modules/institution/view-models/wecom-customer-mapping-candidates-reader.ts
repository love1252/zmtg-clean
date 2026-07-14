import {
  parseWeComCustomerMappingCandidatesReadonlyResponse,
  type WeComCustomerMappingCandidatesResponse,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';

export type WeComCustomerMappingCandidatesResponseReadResult =
  | { ok: true; data: WeComCustomerMappingCandidatesResponse }
  | {
      ok: false;
      reason: 'response_unavailable' | 'response_json_invalid' | 'response_contract_invalid';
    };

export async function readWeComCustomerMappingCandidatesResponse(
  response: Response,
): Promise<WeComCustomerMappingCandidatesResponseReadResult> {
  if (!response.ok) {
    return { ok: false, reason: 'response_unavailable' };
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return { ok: false, reason: 'response_json_invalid' };
  }

  const data = parseWeComCustomerMappingCandidatesReadonlyResponse(value);
  return data
    ? { ok: true, data }
    : { ok: false, reason: 'response_contract_invalid' };
}
