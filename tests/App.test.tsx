import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
const config = { apiBaseUrl: 'https://api.test', tokenIssuerUrl: 'https://issuer.test' };
const auth = { begin: async () => 'test-token', complete: async () => null };
describe('reservation and order lookup', () => {
  it('reserves an available seat', async () => {
    render(<App config={config} authProvider={auth} />);
    await screen.findByRole('button', { name: 'See seats for Concert One' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Signed in');
    fireEvent.click(await screen.findByRole('button', { name: 'Reserve A1' }));
    expect(await screen.findByText(/Order order-1/)).toBeInTheDocument();
  });
});
