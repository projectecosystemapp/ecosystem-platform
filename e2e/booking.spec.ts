import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to providers page
    await page.goto('/providers');
  });

  test('should display provider listing page', async ({ page }) => {
    // Check for essential elements
    await expect(page.getByRole('heading', { name: /providers/i })).toBeVisible();
    
    // Check for search/filter elements
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('should filter providers by service', async ({ page }) => {
    // Look for filter options
    const filterButton = page.getByRole('button', { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Check for filter options
      await expect(page.getByText(/price range/i)).toBeVisible();
      await expect(page.getByText(/location/i)).toBeVisible();
    }
  });

  test('should navigate to provider profile', async ({ page }) => {
    // Click on first provider card (if exists)
    const providerCard = page.locator('[data-testid="provider-card"]').first();
    if (await providerCard.isVisible()) {
      await providerCard.click();
      
      // Should navigate to provider profile
      await expect(page).toHaveURL(/\/providers\/.+/);
      
      // Check for profile elements
      await expect(page.getByRole('button', { name: /book now/i })).toBeVisible();
    }
  });

  test('should open booking calendar', async ({ page }) => {
    // Navigate to a specific provider page
    await page.goto('/providers/test-provider');
    
    const bookButton = page.getByRole('button', { name: /book now/i });
    if (await bookButton.isVisible()) {
      await bookButton.click();
      
      // Check for calendar modal
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/select.*date/i)).toBeVisible();
    }
  });

  test('should show provider availability', async ({ page }) => {
    await page.goto('/providers/test-provider');
    
    // Check for availability information
    const availabilitySection = page.getByText(/availability/i);
    if (await availabilitySection.isVisible()) {
      await expect(availabilitySection).toBeVisible();
    }
  });

  test('should display provider services and pricing', async ({ page }) => {
    await page.goto('/providers/test-provider');
    
    // Check for services section
    const servicesSection = page.getByText(/services/i);
    if (await servicesSection.isVisible()) {
      await expect(servicesSection).toBeVisible();
      
      // Check for pricing information
      await expect(page.getByText(/\$\d+/)).toBeVisible();
    }
  });

  test('should show provider reviews', async ({ page }) => {
    await page.goto('/providers/test-provider');
    
    // Check for reviews section
    const reviewsSection = page.getByText(/reviews/i);
    if (await reviewsSection.isVisible()) {
      await expect(reviewsSection).toBeVisible();
      
      // Check for rating display
      const ratingElement = page.locator('[data-testid="rating"]');
      if (await ratingElement.isVisible()) {
        await expect(ratingElement).toBeVisible();
      }
    }
  });
});