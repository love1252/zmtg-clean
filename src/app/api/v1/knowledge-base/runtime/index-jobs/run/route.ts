import { handleIndexJobRunPOST } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-api-routes';

export async function POST(request: Request) {
  return handleIndexJobRunPOST(request);
}
