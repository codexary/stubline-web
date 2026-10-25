import { api, errorMessage } from './api';
export interface PaymentAttempt {
  orderId: string;
  amountCents: number;
  key: string;
}
export function createPaymentAttempt(orderId: string, amountCents: number): PaymentAttempt {
  return { orderId, amountCents, key: crypto.randomUUID() };
}
export async function pay(baseUrl: string, token: string, attempt: PaymentAttempt) {
  const response = await api(baseUrl, token).POST('/payments', {
    params: { header: { 'Idempotency-Key': attempt.key } },
    body: { orderId: attempt.orderId, amountCents: attempt.amountCents },
  });
  if (response.error) throw new Error(errorMessage(response.error, response.response.status));
  return response.data;
}
