import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { loadConfig } from '../src/config';
import { DemoAuthProvider } from '../src/demo/auth';
import { resetDemoData } from '../src/demo/handlers';

afterEach(() => vi.unstubAllEnvs());

describe('demo switch', () => {
  it('uses the mock API without loading runtime configuration in demo mode', async () => {
    vi.stubEnv('VITE_DEMO', '1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const config = await loadConfig();
    expect(config.apiBaseUrl).toBe('https://api.test');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    render(<App config={config} authProvider={new DemoAuthProvider()} demo />);
    expect(screen.getByText('Demo data — no real backend')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'See seats for Concert One' })).toBeEnabled();
  });

  it('loads configuration and hides the banner in a normal build', async () => {
    vi.stubEnv('VITE_DEMO', '');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ apiBaseUrl: 'https://api.test', tokenIssuerUrl: 'https://issuer.test' })),
      );
    const config = await loadConfig();
    expect(fetchSpy).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
    fetchSpy.mockRestore();
    render(<App config={config} />);
    expect(screen.queryByText('Demo data — no real backend')).not.toBeInTheDocument();
  });
});

describe('demo order and payment invariants', () => {
  const order = (seatId: string) =>
    fetch('https://api.test/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'concert-1', seatId }),
    });

  it('rejects a second reservation and restores seats on reset', async () => {
    const first = await order('A1');
    expect(first.status).toBe(201);
    expect((await first.json()).id).toBe('order-2');
    expect((await order('A1')).status).toBe(409);
    const seats = await fetch('https://api.test/events/concert-1/seats');
    expect((await seats.json()).seats[0].available).toBe(false);
    resetDemoData();
    const restored = await fetch('https://api.test/events/concert-1/seats');
    expect((await restored.json()).seats[0].available).toBe(true);
    const next = await order('A1');
    expect((await next.json()).id).toBe('order-2');
  });

  it('rejects a changed payment under an existing key', async () => {
    const firstOrder = await (await order('A1')).json();
    const secondOrder = await (await order('A2')).json();
    expect(firstOrder.id).not.toBe(secondOrder.id);
    const pay = (orderId: string) =>
      fetch('https://api.test/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'demo-key' },
        body: JSON.stringify({ orderId, amountCents: 2500 }),
      });
    expect((await pay(firstOrder.id)).status).toBe(201);
    expect((await pay(firstOrder.id)).status).toBe(201);
    expect((await pay(secondOrder.id)).status).toBe(422);
    expect((await fetch(`https://api.test/orders/${secondOrder.id}/ticket`)).status).toBe(404);
  });
});
