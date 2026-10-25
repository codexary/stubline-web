import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import type { AuthProvider } from '../src/auth';
import { server } from './server';
import { http, HttpResponse } from 'msw';
const config = { apiBaseUrl: 'https://api.test', tokenIssuerUrl: 'https://issuer.test' };
const auth: AuthProvider = { begin: async () => 'test-token', complete: async () => null };
async function reserve() {
  await screen.findByRole('button', { name: 'See seats for Concert One' });
  expect(await screen.findByText(/A1 — Available/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Signed in');
  fireEvent.click(screen.getByRole('button', { name: 'Reserve A1' }));
  await screen.findByText(/Order order-1/);
}
describe('buyer flow', () => {
  it('shows events and a useful payment error', async () => {
    server.use(
      http.post('https://api.test/payments', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Payment Required',
            status: 402,
            detail: 'card declined',
            instance: '/payments',
          },
          { status: 402, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    render(<App config={config} authProvider={auth} />);
    await reserve();
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('card declined');
    expect(screen.getByRole('button', { name: 'Retry payment' })).toBeEnabled();
  });
  it('reuses the key for retries', async () => {
    const keys: string[] = [];
    server.use(
      http.post('https://api.test/payments', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        return HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Unavailable',
            status: 503,
            detail: 'try again',
            instance: '/payments',
          },
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );
    render(<App config={config} authProvider={auth} />);
    await reserve();
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() => expect(keys).toHaveLength(1));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry payment' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
  it('reopens a buyer order by URL after sign-in', async () => {
    history.replaceState({}, '', '/?order=order-1');
    render(<App config={config} authProvider={auth} />);
    expect(screen.getByText(/Sign in to reopen order order-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText(/Order order-1/);
  });
});
