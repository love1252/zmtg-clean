import { NextResponse } from 'next/server';

const capabilityOffBody = Object.freeze({
  code: 'institution_wecom_customer_contact_proof_mock_capability_off',
  error: '企业微信客户联系只读 proof mock 能力当前未开放。',
});

export async function GET(_request?: Request) {
  return NextResponse.json(capabilityOffBody, { status: 410 });
}

export async function POST(_request?: Request) {
  return NextResponse.json(capabilityOffBody, { status: 410 });
}
