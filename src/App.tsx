import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Event, type Order, type Seat } from './api';
import { DevelopmentAuthProvider, type AuthProvider } from './auth';
import type { RuntimeConfig } from './config';

export function App({ config, authProvider }: { config: RuntimeConfig; authProvider?: AuthProvider }) {
  const auth = useRef<AuthProvider>(authProvider ?? new DevelopmentAuthProvider(config.tokenIssuerUrl));
  const completedCallback = useRef(false);
  const [token, setToken] = useState('');
  const [orderId, setOrderId] = useState<string | null>(() => new URL(location.href).searchParams.get('order'));
  const [order, setOrder] = useState<Order | null>(null);
  const lastOrderLookup = useRef('');
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [nextEvent, setNextEvent] = useState<string | null>(null);
  const [eventId, setEventId] = useState('concert-1');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatCursor, setSeatCursor] = useState<string | null>(null);
  const [nextSeat, setNextSeat] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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
        }
      })
      .catch(() => {
        if (active) setMessage('Could not reopen the order.');
      });
    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, token, orderId]);
  function selectEvent(id: string) {
    setEventId(id);
    setSeatCursor(null);
    setOrderId(null);
    setOrder(null);
    history.replaceState({}, '', '/');
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
      history.replaceState({}, '', `/?order=${encodeURIComponent(data.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reservation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
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
        </section>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
