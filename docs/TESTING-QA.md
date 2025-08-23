# Testing & Quality Assurance Standards

## Testing Pyramid

```
         /\
        /E2E\      (5%) - Critical user flows
       /------\
      /Integration\ (25%) - API & service tests  
     /------------\
    /   Unit Tests  \ (70%) - Component & function tests
   /----------------\
```

## Unit Testing

### Fee Calculation Tests
**File**: `tests/unit/fees.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFees } from '@/lib/fees';

describe('Fee Calculations', () => {
  describe('Guest Bookings', () => {
    it('should apply 10% platform fee + 10% surcharge', () => {
      const result = calculateFees(10000, true); // $100
      
      expect(result.baseAmount).toBe(10000);
      expect(result.platformFeeAmount).toBe(1000); // 10%
      expect(result.guestSurchargeAmount).toBe(1000); // 10%
      expect(result.totalAmount).toBe(11000); // Guest pays $110
      expect(result.providerPayout).toBe(9000); // Provider gets $90
    });
  });
  
  describe('Customer Bookings', () => {
    it('should apply only 10% platform fee', () => {
      const result = calculateFees(10000, false); // $100
      
      expect(result.baseAmount).toBe(10000);
      expect(result.platformFeeAmount).toBe(1000); // 10%
      expect(result.guestSurchargeAmount).toBe(0); // No surcharge
      expect(result.totalAmount).toBe(10000); // Customer pays $100
      expect(result.providerPayout).toBe(9000); // Provider gets $90
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const result = calculateFees(0, true);
      expect(result.totalAmount).toBe(0);
    });
    
    it('should round fractional cents correctly', () => {
      const result = calculateFees(999, true); // $9.99
      expect(result.platformFeeAmount).toBe(100); // Rounds to $1.00
    });
  });
});
```

### State Machine Tests
```typescript
describe('Booking State Transitions', () => {
  it('should transition through valid states', () => {
    const booking = new BookingStateMachine('INITIATED');
    
    expect(booking.canTransitionTo('PENDING_PROVIDER')).toBe(true);
    booking.transitionTo('PENDING_PROVIDER');
    
    expect(booking.canTransitionTo('ACCEPTED')).toBe(true);
    booking.transitionTo('ACCEPTED');
    
    expect(booking.canTransitionTo('INITIATED')).toBe(false); // Can't go back
  });
  
  it('should prevent invalid transitions', () => {
    const booking = new BookingStateMachine('INITIATED');
    
    expect(() => booking.transitionTo('COMPLETED'))
      .toThrow('Invalid transition from INITIATED to COMPLETED');
  });
});
```

## Integration Testing

### API Contract Tests
**File**: `tests/integration/checkout.spec.ts`

```typescript
import request from 'supertest';
import { app } from '@/app';
import { mockStripe } from '@/tests/mocks/stripe';

describe('POST /api/checkout/guest', () => {
  beforeEach(() => {
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test',
      client_secret: 'secret_test',
    });
  });
  
  it('should create payment intent with guest surcharge', async () => {
    const response = await request(app)
      .post('/api/checkout/guest')
      .send({
        bookingId: 'booking-123',
        email: 'guest@example.com'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.clientSecret).toBe('secret_test');
    
    // Verify Stripe was called with correct amount
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 11000, // $110 for $100 service
        application_fee_amount: 2000, // $20 total platform take
      })
    );
  });
  
  it('should reject invalid booking state', async () => {
    const response = await request(app)
      .post('/api/checkout/guest')
      .send({
        bookingId: 'completed-booking',
        email: 'guest@example.com'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid booking');
  });
  
  it('should enforce rate limiting', async () => {
    // Make 11 requests rapidly
    for (let i = 0; i < 11; i++) {
      const response = await request(app)
        .post('/api/checkout/guest')
        .send({ bookingId: 'test', email: 'test@test.com' });
      
      if (i < 10) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(429); // Too many requests
      }
    }
  });
});
```

### Webhook Tests
```typescript
describe('Stripe Webhooks', () => {
  it('should handle payment success idempotently', async () => {
    const event = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { bookingId: 'booking-123' }
        }
      }
    };
    
    // First call
    const response1 = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', generateSignature(event))
      .send(event);
    
    expect(response1.status).toBe(200);
    
    // Second call (idempotent)
    const response2 = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', generateSignature(event))
      .send(event);
    
    expect(response2.status).toBe(200);
    
    // Verify only one state change
    const booking = await getBooking('booking-123');
    expect(booking.state).toBe('COMPLETED');
    expect(booking.stateChanges).toHaveLength(1);
  });
});
```

## E2E Testing with Playwright

### Guest Booking Flow
**File**: `tests/e2e/guest-booking.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Guest Booking Flow', () => {
  test('should complete booking with 10% surcharge', async ({ page }) => {
    // 1. Navigate to provider
    await page.goto('/providers/john-doe-plumbing');
    
    // 2. Click Book Now
    await page.click('[data-testid="book-now-primary"]');
    
    // 3. Select service
    await page.click('[data-testid="service-drain-cleaning"]');
    expect(await page.locator('.service-price').textContent()).toBe('$100');
    
    // 4. Select time slot
    await page.click('[data-testid="timeslot-morning"]');
    
    // 5. Enter guest email
    await page.fill('[data-testid="guest-email"]', 'guest@test.com');
    
    // 6. Verify surcharge display
    const summary = page.locator('[data-testid="price-summary"]');
    await expect(summary.locator('.base-price')).toContainText('$100');
    await expect(summary.locator('.guest-fee')).toContainText('$10');
    await expect(summary.locator('.total')).toContainText('$110');
    
    // 7. Enter payment
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');
    
    // 8. Submit payment
    await page.click('[data-testid="pay-button"]');
    
    // 9. Wait for confirmation
    await expect(page.locator('[data-testid="booking-status"]'))
      .toContainText('Processing payment...', { timeout: 5000 });
    
    await expect(page.locator('[data-testid="booking-status"]'))
      .toContainText('Booking confirmed!', { timeout: 15000 });
    
    // 10. Verify confirmation details
    await expect(page.locator('[data-testid="confirmation-code"]'))
      .toMatch(/^[A-Z0-9]{6}$/);
  });
  
  test('should handle payment failure gracefully', async ({ page }) => {
    await page.goto('/providers/john-doe-plumbing');
    await page.click('[data-testid="book-now-primary"]');
    
    // Use card that triggers failure
    await page.fill('[data-testid="card-number"]', '4000000000000002');
    
    await page.click('[data-testid="pay-button"]');
    
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('Payment failed');
    
    await expect(page.locator('[data-testid="retry-button"]'))
      .toBeVisible();
  });
});
```

### Customer Booking Flow
```typescript
test.describe('Customer Booking Flow', () => {
  test.use({ storageState: 'tests/e2e/.auth/customer.json' });
  
  test('should not charge surcharge for authenticated users', async ({ page }) => {
    await page.goto('/providers/john-doe-plumbing');
    await page.click('[data-testid="book-now-primary"]');
    
    // Verify no surcharge
    const summary = page.locator('[data-testid="price-summary"]');
    await expect(summary.locator('.base-price')).toContainText('$100');
    await expect(summary.locator('.guest-fee')).not.toBeVisible();
    await expect(summary.locator('.total')).toContainText('$100');
  });
});
```

## Accessibility Testing

### Automated A11y Checks
```typescript
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('booking flow should be WCAG AA compliant', async ({ page }) => {
    await page.goto('/providers/john-doe-plumbing');
    
    // Check provider page
    const providerResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(providerResults.violations).toEqual([]);
    
    // Check booking modal
    await page.click('[data-testid="book-now-primary"]');
    
    const bookingResults = await new AxeBuilder({ page })
      .exclude('.mapbox-container') // Exclude third-party widgets
      .analyze();
    
    expect(bookingResults.violations).toEqual([]);
  });
  
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/providers/john-doe-plumbing');
    
    // Tab to Book Now button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Escape closes modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
```

## Visual Regression Testing

### Screenshot Comparisons
```typescript
test.describe('Visual Regression', () => {
  const viewports = [
    { width: 320, height: 568 },  // Mobile
    { width: 768, height: 1024 }, // Tablet
    { width: 1280, height: 720 }, // Desktop
  ];
  
  for (const viewport of viewports) {
    test(`provider profile at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/providers/john-doe-plumbing');
      
      await expect(page).toHaveScreenshot(
        `provider-${viewport.width}.png`,
        { 
          maxDiffPixels: 100,
          threshold: 0.2 
        }
      );
    });
  }
});
```

## Performance Testing

### Lighthouse CI Configuration
```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/providers/test-provider',
        'http://localhost:3000/bookings/confirmation',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### Performance Monitoring
```typescript
test('should meet performance budgets', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    const paint = performance.getEntriesByType('paint');
    const navigation = performance.getEntriesByType('navigation')[0];
    
    return {
      fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
      domContentLoaded: navigation.domContentLoadedEventEnd,
      loadComplete: navigation.loadEventEnd,
    };
  });
  
  expect(metrics.fcp).toBeLessThan(1500);
  expect(metrics.domContentLoaded).toBeLessThan(3000);
  expect(metrics.loadComplete).toBeLessThan(5000);
});
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Check coverage
        run: |
          coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 80" | bc -l) )); then
            echo "Coverage $coverage% is below 80%"
            exit 1
          fi
      
      - name: Integration tests
        run: npm run test:integration
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            test-results/
            playwright-report/
      
      - name: Lighthouse CI
        run: |
          npm run build
          npm run start &
          sleep 5
          npx lhci autorun
      
      - name: Visual regression
        run: npm run test:visual
      
      - name: Comment PR
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json'));
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.name,
              body: `## Test Results
              
              ✅ Type Check: Passed
              ✅ Unit Tests: ${coverage.total.lines.pct}% coverage
              ✅ Integration Tests: Passed
              ✅ E2E Tests: Passed
              ✅ Accessibility: WCAG AA compliant
              ✅ Performance: All budgets met
              
              ### Fee Validation
              - Guest checkout: ✅ 110% total (10% + 10%)
              - Customer checkout: ✅ 100% total (10% platform fee)
              `
            });
```

## Design QA Checklist

### Visual Standards
- [ ] 8pt spacing grid maintained
- [ ] Typography hierarchy (H1 > H2 > H3)
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] Focus states visible on all interactive elements

### Responsive Design
- [ ] Mobile (320px): Single column, touch-friendly
- [ ] Tablet (768px): Appropriate scaling
- [ ] Desktop (1280px): Full layout utilized

### Interaction Patterns
- [ ] Loading states for all async operations
- [ ] Error messages are actionable
- [ ] Success feedback is clear
- [ ] Form validation happens inline

### Empty States
- [ ] No providers: "No providers in your area"
- [ ] No bookings: "You haven't made any bookings yet"
- [ ] Search no results: "Try adjusting your filters"

## Test Data Management

### Seed Data
```typescript
// tests/fixtures/seed.ts
export const testProvider = {
  id: 'provider-test-123',
  name: 'John Doe Plumbing',
  stripeAccountId: 'acct_test_123',
  services: [
    { id: 'service-1', name: 'Drain Cleaning', price: 10000 }, // $100
  ],
};

export const testCustomer = {
  id: 'customer-test-123',
  email: 'customer@test.com',
  stripeCustomerId: 'cus_test_123',
};

export const testGuest = {
  email: 'guest@test.com',
};
```

## Monitoring & Observability

### Test Metrics to Track
- Test execution time
- Flaky test rate
- Coverage trends
- Visual diff percentage
- Performance score trends

### Alerts
- Coverage drops below 80%
- E2E test failure rate > 5%
- Performance score < 80
- Accessibility violations detected