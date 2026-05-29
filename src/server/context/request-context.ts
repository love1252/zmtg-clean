export type RequestContext = {
  requestId: string;
};

export function createRequestContext(): RequestContext {
  return {
    requestId: crypto.randomUUID(),
  };
}
