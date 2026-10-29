import { http, HttpResponse } from 'msw';
import type { Event, Order, Seat } from '../api';

const events: Event[] = [
  { id: 'concert-1', title: 'Concert One', startsAt: '2026-11-01T00:00:00Z' },
  { id: 'concert-2', title: 'Concert Two', startsAt: '2026-11-08T00:00:00Z' },
];
const seats: Record<string, Seat[]> = {
  'concert-1': [
    { id: 'A1', eventId: 'concert-1', available: true },
    { id: 'A2', eventId: 'concert-1', available: true },
  ],
  'concert-2': [{ id: 'B1', eventId: 'concert-2', available: true }],
};
const initialOrder: Order = {
  id: 'order-1',
  eventId: 'concert-2',
  seatId: 'B1',
  createdAt: '2026-10-30T00:00:00Z',
};
const orders = new Map<string, Order>();
const charges = new Map<string, { orderId: string; amountCents: number; chargeId: string }>();
const paidOrders = new Set<string>();
let nextOrder = 2;

export function resetDemoData() {
  Object.values(seats)
    .flat()
    .forEach((seat) => {
      seat.available = true;
    });
  seats['concert-2'][0].available = false;
  orders.clear();
  orders.set(initialOrder.id, initialOrder);
  charges.clear();
  paidOrders.clear();
  nextOrder = 2;
}
resetDemoData();

function page<T>(items: T[], request: Request, defaultLimit: number) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || defaultLimit));
  const start = Math.max(0, Number(url.searchParams.get('cursor')) || 0);
  return {
    items: items.slice(start, start + limit),
    next: start + limit < items.length ? String(start + limit) : null,
  };
}

function problem(status: number, detail: string) {
  return HttpResponse.json(
    { type: 'about:blank', title: 'Request failed', status, detail, instance: '/' },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export const handlers = [
  http.get('https://api.test/events', ({ request }) => {
    const result = page(events, request, 20);
    return HttpResponse.json({ events: result.items, next: result.next });
  }),
  http.get('https://api.test/events/:eventId/seats', ({ params, request }) => {
    const result = page(seats[String(params.eventId)] ?? [], request, 20);
    return HttpResponse.json({ seats: result.items, next: result.next });
  }),
  http.get('https://api.test/orders/:orderId', ({ params }) => {
    const order = orders.get(String(params.orderId));
    return order ? HttpResponse.json(order) : problem(404, 'Order not found.');
  }),
  http.post('https://api.test/orders', async ({ request }) => {
    const body = (await request.json()) as { eventId?: string; seatId?: string };
    const seat = seats[body.eventId ?? '']?.find((item) => item.id === body.seatId);
    if (!seat || !seat.available) return problem(409, 'Seat unavailable.');
    const order: Order = {
      id: `order-${nextOrder++}`,
      eventId: body.eventId!,
      seatId: body.seatId!,
      createdAt: new Date().toISOString(),
    };
    seat.available = false;
    orders.set(order.id, order);
    return HttpResponse.json(order, { status: 201 });
  }),
  http.post('https://api.test/payments', async ({ request }) => {
    const body = (await request.json()) as { orderId?: string; amountCents?: number };
    const key = request.headers.get('Idempotency-Key');
    if (!key || !body.orderId || !orders.has(body.orderId)) return problem(400, 'Invalid payment.');
    if (!Number.isInteger(body.amountCents) || body.amountCents! <= 0) return problem(400, 'Invalid payment amount.');
    const previous = charges.get(key);
    if (previous && (previous.orderId !== body.orderId || previous.amountCents !== body.amountCents))
      return problem(422, 'Idempotency key belongs to a different payment.');
    const chargeId = previous?.chargeId ?? `charge-${charges.size + 1}`;
    if (!previous) charges.set(key, { orderId: body.orderId, amountCents: body.amountCents!, chargeId });
    paidOrders.add(body.orderId);
    return HttpResponse.json({ chargeId, orderId: body.orderId, amountCents: body.amountCents }, { status: 201 });
  }),
  http.get('https://api.test/orders/:orderId/ticket', ({ params }) =>
    paidOrders.has(String(params.orderId))
      ? HttpResponse.json({
          url: new URL(`${import.meta.env.BASE_URL}ticket.pdf`, location.origin).href,
        })
      : problem(404, 'Ticket not found.'),
  ),
];
