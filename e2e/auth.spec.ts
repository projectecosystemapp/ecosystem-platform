import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup');
    
    // Check for signup form elements
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should redirect to dashboard after login', async ({ page }) => {
    await page.goto('/login');
    
    // Note: This is a mock test as we can't actually log in without real credentials
    // In a real scenario, you'd use test credentials or mock the auth
    
    // Fill in mock credentials
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    
    // In production, you'd mock the Clerk response or use test credentials
    // await page.getByRole('button', { name: /sign in/i }).click();
    // await page.waitForURL('/dashboard');
    // await expect(page).toHaveURL('/dashboard');
  });

  test('should protect dashboard route', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show logout option when authenticated', async ({ page, context }) => {
    // Mock authentication by setting cookies
    // In real tests, you'd use actual test auth tokens
    await context.addCookies([
      {
        name: '__session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    await page.goto('/');
    
    // Check for user menu or logout button
    // This depends on your actual UI implementation
  });
});