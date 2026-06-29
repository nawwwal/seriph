import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'payload_too_large'
  | 'rate_limited'
  | 'internal_error';

export function ok<T>(data: T, init?: ResponseInit): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
  init?: Omit<ResponseInit, 'status'>
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { ...init, status });
}

export function unauthorized(): NextResponse {
  return fail('unauthorized', 'Unauthorized', 401);
}
