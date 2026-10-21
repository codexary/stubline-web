import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
describe('seat browsing', () => {
  it('shows events and available seats', async () => {
    render(<App config={{ apiBaseUrl: 'https://api.test', tokenIssuerUrl: 'https://issuer.test' }} />);
    expect(await screen.findByRole('button', { name: 'See seats for Concert One' })).toBeInTheDocument();
    expect(await screen.findByText(/A1 — Available/)).toBeInTheDocument();
  });
});
