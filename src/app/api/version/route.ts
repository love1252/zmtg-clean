import { NextResponse } from 'next/server';
import { getDeploymentVersion } from '@/modules/deployment/server/deployment-version';

export function GET() {
  return NextResponse.json(getDeploymentVersion(), { status: 200 });
}
