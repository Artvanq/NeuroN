const { test, expect } = require('@playwright/test');

test('login page renders sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('register page renders invite form', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /join|register|invite/i })).toBeVisible();
});

test('explore page loads for guests', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('main')).toBeVisible();
});

test('forgot-password page is reachable', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
});

test('verify-email page loads without token', async ({ page }) => {
  await page.goto('/verify-email');
  await expect(page.getByRole('heading', { name: /verify email/i })).toBeVisible();
});

test('privacy page is reachable', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('main')).toContainText(/privacy|data|personal/i);
});

test('terms page is reachable', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('main')).toContainText(/terms|use/i);
});

test('projects page redirects guests to login', async ({ page }) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login/);
});

test('settings page redirects guests to login', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('landing page has enter CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /enter|explore/i }).first()).toBeVisible();
});

test('create organization page loads for guests', async ({ page }) => {
  await page.goto('/orgs/new');
  await expect(page.getByRole('heading', { name: /organization|org/i })).toBeVisible();
});

test('organizations index redirects guests to login', async ({ page }) => {
  await page.goto('/orgs');
  await expect(page).toHaveURL(/\/login/);
});
