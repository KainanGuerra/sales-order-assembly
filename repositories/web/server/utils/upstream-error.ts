// Turns a failure from a backend service into the answer the browser gets.
// A verdict from the service (a 4xx, with its body) passes through unchanged;
// anything else means the service could not answer.

export interface UpstreamFailure {
  statusCode: number;
  data?: unknown;
  message: string;
}

interface FetchLikeError {
  statusCode?: number;
  status?: number;
  data?: unknown;
}

export function mapUpstreamError(error: unknown, service: string): UpstreamFailure {
  const e = error as FetchLikeError;
  const status = e?.statusCode ?? e?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { statusCode: status, data: e.data, message: `${service} refused the request` };
  }
  return { statusCode: 503, message: `${service} is unavailable, try again shortly` };
}
