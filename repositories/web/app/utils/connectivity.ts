import type { Calculation } from '~/types/api';

// Longer than this and a request counts as "no signal": a seller in a shop with
// one bar should not stare at a spinner. The order id makes a repeated send safe.
export const REQUEST_TIMEOUT_MS = 8000;

// What a failed request means for an order that was being sent.
//  OFFLINE  no answer at all (no signal, or too slow): keep the order, try later
//  SERVER   the server answered with an error of its own (5xx): keep it, try later
//  SESSION  the login ended (401): keep it, it goes out after logging in again
//  REFUSED  a rule was broken (422): the server says which
//  OTHER    any other refusal (400, 404...): it will not work as it is
export type Failure = 'OFFLINE' | 'SERVER' | 'SESSION' | 'REFUSED' | 'OTHER';

interface FetchLikeError {
  name?: string;
  statusCode?: number;
  status?: number;
  response?: { status?: number };
  data?: { data?: { calculation?: Calculation } };
}

const NETWORK_ERROR_NAMES = new Set(['FetchError', 'TypeError', 'AbortError', 'TimeoutError']);

export function statusOf(error: unknown): number | undefined {
  const e = error as FetchLikeError | null;
  return e?.statusCode ?? e?.status ?? e?.response?.status;
}

export function classifyFailure(error: unknown): Failure {
  const status = statusOf(error);
  if (status === undefined) {
    // Only a failure to reach the server counts as "offline"; a bug in our own
    // code (some other error) must not be hidden as a lost connection.
    return NETWORK_ERROR_NAMES.has((error as FetchLikeError | null)?.name ?? '') ? 'OFFLINE' : 'OTHER';
  }
  if (status === 401) return 'SESSION';
  if (status === 422) return 'REFUSED';
  if (status >= 500) return 'SERVER';
  return 'OTHER';
}

// The reasons the server gave when it refused an order (the BFF passes the
// backend's calculation along in the error body).
export function calculationOf(error: unknown): Calculation | undefined {
  return (error as FetchLikeError | null)?.data?.data?.calculation;
}
