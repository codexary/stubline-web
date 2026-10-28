import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const apiUrl = process.env.API_URL ?? 'https://localhost:8080';
async function accessible(page: import('@playwright/test').Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
}
async function signIn(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/https:\/\/localhost:8443\/authorize/);
  await page.getByRole('textbox', { name: 'Buyer subject' }).fill('buyer-a');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/http:\/\/localhost:8088\//);
  await expect(page.getByText('Signed in')).toBeVisible();
}
test('browse, sign in with PKCE, reopen, pay once across a replay, and download a ticket', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'See seats for Concert 1' })).toBeVisible();
  await expect(page.getByText(/A1 — Available/)).toBeVisible();
  await accessible(page);
  await page.getByRole('button', { name: 'Next seats page' }).click();
  await expect(page.getByText(/A2 — Available/)).toBeVisible();
  await accessible(page);
  await page.getByRole('button', { name: 'First seats page' }).click();
  await signIn(page);
  await accessible(page);
  await page.getByRole('button', { name: 'Reserve A1' }).click();
  await expect(page.getByText(/Order .*concert-1, seat A1/)).toBeVisible();
  await expect(page).toHaveURL(/\?order=/);
  await accessible(page);
  const paymentRequest = page.waitForRequest((req) => req.url() === `${apiUrl}/payments` && req.method() === 'POST');
  const paymentResponse = page.waitForResponse(
    (resp) => resp.url() === `${apiUrl}/payments` && resp.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  const original = await paymentRequest;
  const result = await paymentResponse;
  expect(result.status()).toBe(201);
  const first = await result.json();
  const token = original.headers()['authorization'];
  const key = original.headers()['idempotency-key'];
  expect(key).toBeTruthy();
  const replay = await request.post(`${apiUrl}/payments`, {
    data: original.postDataJSON(),
    headers: { Authorization: token, 'Idempotency-Key': key },
  });
  expect(replay.status()).toBe(201);
  expect((await replay.json()).chargeId).toBe(first.chargeId);
  await accessible(page);
  await page.reload();
  await expect(page.getByText(/Sign in to reopen order/)).toBeVisible();
  const orderResponse = page.waitForResponse(
    (response) => response.url().includes('/orders/') && response.request().method() === 'GET',
  );
  await signIn(page);
  await expect(page.getByText(/Order .*concert-1, seat A1/)).toBeVisible();
  expect((await orderResponse).status()).toBe(200);
  await accessible(page);
  await page.getByRole('button', { name: 'Get ticket' }).click();
  const download = page.getByRole('link', { name: 'Download ticket PDF' });
  await expect(download).toBeVisible();
  await accessible(page);
  const pdf = await request.get((await download.getAttribute('href')) ?? '');
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
});
