import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
export const server = setupServer(
  http.get('https://api.test/events', () =>
    HttpResponse.json({
      events: [{ id: 'concert-1', title: 'Concert One', startsAt: '2026-11-01T00:00:00Z' }],
      next: null,
    }),
  ),
  http.get('https://api.test/events/:eventId/seats', () =>
    HttpResponse.json({ seats: [{ id: 'A1', eventId: 'concert-1', available: true }], next: null }),
  ),
  http.get('https://api.test/orders/:orderId', () =>
    HttpResponse.json({
      id: 'order-1',
      eventId: 'concert-1',
      seatId: 'A1',
      createdAt: '2026-10-30T00:00:00Z',
    }),
  ),
  http.post('https://api.test/orders', () =>
    HttpResponse.json(
      { id: 'order-1', eventId: 'concert-1', seatId: 'A1', createdAt: '2026-10-30T00:00:00Z' },
      { status: 201 },
    ),
  ),
  http.post('https://api.test/payments', () =>
    HttpResponse.json({ chargeId: 'charge-1', orderId: 'order-1', amountCents: 2500 }, { status: 201 }),
  ),
  http.get('https://api.test/orders/:orderId/ticket', () =>
    HttpResponse.json({ url: 'https://tickets.test/order-1.pdf' }),
  ),
);
