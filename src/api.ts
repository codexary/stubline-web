import createClient from 'openapi-fetch';
import type { paths, components } from './api.generated';
export type Event = components['schemas']['Event'];
export type EventPage = components['schemas']['EventPage'];
export type Seat = components['schemas']['Seat'];
export type SeatPage = components['schemas']['SeatPage'];
export type Order = components['schemas']['Order'];
export type Problem = components['schemas']['Problem'];
export function api(baseUrl: string, token?: string) {
  return createClient<paths>({
    baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
export function errorMessage(error: unknown, status?: number): string {
  if (error && typeof error === 'object' && 'detail' in error && typeof error.detail === 'string') return error.detail;
  const messages: Record<number, string> = {
    400: 'Check the request and try again.',
    401: 'Sign in again.',
    402: 'Payment was declined.',
    403: 'You cannot access this order.',
    404: 'The requested item was not found.',
    409: 'This seat is unavailable or the request conflicts with an earlier attempt.',
    422: 'The payment details or retry key were rejected.',
    503: 'The service is temporarily unavailable. Retry this payment with the same key.',
  };
  return messages[status ?? 0] ?? 'The request failed. Please try again.';
}
