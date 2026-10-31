import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Event, type Order, type Seat } from './api';
import { DevelopmentAuthProvider, type AuthProvider } from './auth';
import type { RuntimeConfig } from './config';
import { createPaymentAttempt, pay, type PaymentAttempt } from './payment';

function savedAttempt(orderId: string): PaymentAttempt | null {
  try {
    const raw = sessionStorage.getItem(`stubline.payment.${orderId}`);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      'orderId' in value &&
      value.orderId === orderId &&
      'amountCents' in value &&
      typeof value.amountCents === 'number' &&
      'key' in value &&
      typeof value.key === 'string'
    )
      return value as PaymentAttempt;
  } catch {
    /* Ignore unavailable or malformed session storage. */
  }
  return null;
}

export function App({
  config,
  authProvider,
  demo = false,
}: {
  config: RuntimeConfig;
  authProvider?: AuthProvider;
  demo?: boolean;
}) {
  const auth = useRef<AuthProvider>(authProvider ?? new DevelopmentAuthProvider(config.tokenIssuerUrl));
  const completedCallback = useRef(false);
  const paymentInFlight = useRef(false);
  const lastOrderLookup = useRef('');
  const attemptRef = useRef<PaymentAttempt | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [nextEvent, setNextEvent] = useState<string | null>(null);
  const [eventId, setEventId] = useState('concert-1');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatCursor, setSeatCursor] = useState<string | null>(null);
  const [nextSeat, setNextSeat] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [orderId, setOrderId] = useState<string | null>(() => new URL(location.href).searchParams.get('order'));
  const [order, setOrder] = useState<Order | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [canPay, setCanPay] = useState(false);
  const [amount, setAmount] = useState('25.00');
  const [paid, setPaid] = useState(false);
  const [ticketUrl, setTicketUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (completedCallback.current) return;
    completedCallback.current = true;
    auth.current
      .complete()
      .then((result) => {
        if (result) {
          setToken(result.token);
          setOrderId(new URL(result.returnPath, location.origin).searchParams.get('order'));
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Sign in failed.'));
  }, []);

  useEffect(() => {
    let active = true;
    api(config.apiBaseUrl)
      .GET('/events', {
        params: { query: { limit: 20, ...(eventCursor ? { cursor: eventCursor } : {}) } },
      })
      .then(({ data, error, response }) => {
        if (!active) return;
        if (error) setMessage(errorMessage(error, response.status));
        else {
          setEvents(data.events);
          setNextEvent(data.next);
        }
      })
      .catch(() => {
        if (active) setMessage('Could not load events. Check the API connection.');
      });
    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, eventCursor]);

  useEffect(() => {
    let active = true;
    api(config.apiBaseUrl)
      .GET('/events/{eventId}/seats', {
        params: {
          path: { eventId },
          query: { limit: 1, ...(seatCursor ? { cursor: seatCursor } : {}) },
        },
      })
      .then(({ data, error, response }) => {
        if (!active) return;
        if (error) setMessage(errorMessage(error, response.status));
        else {
          setSeats(data.seats);
          setNextSeat(data.next);
        }
      })
      .catch(() => {
        if (active) setMessage('Could not load seats. Check the API connection.');
      });
    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, eventId, seatCursor]);

  useEffect(() => {
    if (!token || !orderId || lastOrderLookup.current === `${token}:${orderId}`) return;
    lastOrderLookup.current = `${token}:${orderId}`;
    let active = true;
    api(config.apiBaseUrl, token)
      .GET('/orders/{orderId}', { params: { path: { orderId } } })
      .then(({ data, error, response }) => {
        if (!active) return;
        if (error) setMessage(errorMessage(error, response.status));
        else {
          setOrder(data);
          setEventId(data.eventId);
          const prior = savedAttempt(data.id);
          attemptRef.current = prior;
          setAttempt(prior);
          setCanPay(!!prior);
          if (prior) setAmount((prior.amountCents / 100).toFixed(2));
        }
      })
      .catch(() => {
        if (active) setMessage('Could not reopen the order.');
      });
    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, token, orderId]);

  async function signIn() {
    setBusy(true);
    setMessage('');
    try {
      const result = await auth.current.begin();
      if (result) setToken(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }
  function selectEvent(id: string) {
    setEventId(id);
    setSeatCursor(null);
    setOrderId(null);
    setOrder(null);
    attemptRef.current = null;
    setAttempt(null);
    setCanPay(false);
    setPaid(false);
    setTicketUrl('');
    history.replaceState({}, '', import.meta.env.BASE_URL);
  }
  async function reserve(seatId: string) {
    if (!token) {
      setMessage('Sign in before reserving a seat.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error, response } = await api(config.apiBaseUrl, token).POST('/orders', {
        body: { eventId, seatId },
      });
      if (error) throw new Error(errorMessage(error, response.status));
      lastOrderLookup.current = `${token}:${data.id}`;
      setOrder(data);
      setOrderId(data.id);
      setSeats((current) => current.map((seat) => (seat.id === seatId ? { ...seat, available: false } : seat)));
      setCanPay(true);
      attemptRef.current = null;
      setAttempt(null);
      setPaid(false);
      setTicketUrl('');
      history.replaceState({}, '', `${import.meta.env.BASE_URL}?order=${encodeURIComponent(data.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reservation failed.');
    } finally {
      setBusy(false);
    }
  }
  async function submitPayment() {
    if (!order || !token || !canPay || busy || paymentInFlight.current) return;
    paymentInFlight.current = true;
    const current = attemptRef.current ?? createPaymentAttempt(order.id, Math.round(Number(amount) * 100));
    attemptRef.current = current;
    setAttempt(current);
    sessionStorage.setItem(`stubline.payment.${order.id}`, JSON.stringify(current));
    setBusy(true);
    setMessage('');
    try {
      await pay(config.apiBaseUrl, token, current);
      setPaid(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment failed.');
    } finally {
      paymentInFlight.current = false;
      setBusy(false);
    }
  }
  async function getTicket() {
    if (!order || !token) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error, response } = await api(config.apiBaseUrl, token).GET('/orders/{orderId}/ticket', {
        params: { path: { orderId: order.id } },
      });
      if (error) throw new Error(errorMessage(error, response.status));
      setTicketUrl(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ticket is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      {demo && <p className="demo-banner">Demo data — no real backend</p>}
      <h1>Stubline tickets</h1>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Events</h2>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              {event.title} — {new Date(event.startsAt).toLocaleString()}{' '}
              <button onClick={() => selectEvent(event.id)}>See seats for {event.title}</button>
            </li>
          ))}
        </ul>
        {eventCursor && <button onClick={() => setEventCursor(null)}>First events page</button>}
        {nextEvent && <button onClick={() => setEventCursor(nextEvent)}>Next events page</button>}
      </section>
      <section aria-labelledby="seats-heading">
        <h2 id="seats-heading">Seats for {eventId}</h2>
        <ul>
          {seats.map((seat) => (
            <li key={seat.id}>
              {seat.id} — {seat.available ? 'Available' : 'Unavailable'}{' '}
              {seat.available && (
                <button disabled={busy || !token} onClick={() => reserve(seat.id)}>
                  Reserve {seat.id}
                </button>
              )}
            </li>
          ))}
        </ul>
        {seatCursor && <button onClick={() => setSeatCursor(null)}>First seats page</button>}
        {nextSeat && <button onClick={() => setSeatCursor(nextSeat)}>Next seats page</button>}
      </section>
      <section aria-labelledby="signin-heading">
        <h2 id="signin-heading">Sign in</h2>
        {!token ? (
          <button disabled={busy} onClick={signIn}>
            Sign in
          </button>
        ) : (
          <p>Signed in</p>
        )}
      </section>
      {orderId && !token && <p>Sign in to reopen order {orderId}.</p>}
      {order && (
        <section aria-labelledby="order-heading">
          <h2 id="order-heading">Your order</h2>
          <p>
            Order {order.id}: {order.eventId}, seat {order.seatId}
          </p>
          <p>Created {new Date(order.createdAt).toLocaleString()}</p>
          <label htmlFor="amount">Demo payment amount (AUD)</label>{' '}
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            disabled={!!attempt || !canPay}
            onChange={(event) => setAmount(event.target.value)}
          />
          {canPay ? (
            <button
              disabled={busy || paid || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
              onClick={submitPayment}
            >
              {attempt ? 'Retry payment' : 'Pay'}
            </button>
          ) : (
            <p>Payment status cannot be recovered for this order. Use the original session to retry a payment.</p>
          )}
          <button disabled={busy} onClick={getTicket}>
            Get ticket
          </button>
          {ticketUrl && (
            <p>
              <a href={ticketUrl} download="ticket.pdf">
                Download ticket PDF
              </a>
            </p>
          )}
        </section>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
