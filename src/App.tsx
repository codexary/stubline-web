import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Event, type Seat } from './api';
import { DevelopmentAuthProvider, type AuthProvider } from './auth';
import type { RuntimeConfig } from './config';

export function App({ config, authProvider }: { config: RuntimeConfig; authProvider?: AuthProvider }) {
  const auth = useRef<AuthProvider>(authProvider ?? new DevelopmentAuthProvider(config.tokenIssuerUrl));
  const completedCallback = useRef(false);
  const [token, setToken] = useState('');
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
        if (result) setToken(result.token);
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
  function selectEvent(id: string) {
    setEventId(id);
    setSeatCursor(null);
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
              {seat.id} — {seat.available ? 'Available' : 'Unavailable'}
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
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
