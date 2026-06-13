import { handleIndexJobsGET } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-api-routes';

export async function GET(request: Request) {
  return handleIndexJobsGET(request);
}
