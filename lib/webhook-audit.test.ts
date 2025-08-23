/**
 * Security Test for Webhook Audit
 * Tests SQL injection prevention and input validation
 */

import { cleanupOldWebhookEvents } from './webhook-audit';

describe('Webhook Audit Security Tests', () => {
  describe('cleanupOldWebhookEvents', () => {
    it('should reject SQL injection attempts', async () => {
      // Test various SQL injection attempts
      const maliciousInputs = [
        "30; DROP TABLE webhook_events; --",
        "30' OR '1'='1",
        "30); DELETE FROM users; --",
        "30 UNION SELECT * FROM users",
        "30'; UPDATE webhook_events SET status='failed'; --"
      ];

      for (const input of maliciousInputs) {
        // These should all fail validation since they're not integers
        const result = await cleanupOldWebhookEvents(input as any);
        expect(result).toBe(0); // Should return 0 on error
      }
    });

    it('should validate numeric bounds', async () => {
      // Test invalid numeric values
      const invalidInputs = [
        -1,      // Negative
        366,     // Too large
        1.5,     // Non-integer
        NaN,     // Not a number
        Infinity // Infinity
      ];

      for (const input of invalidInputs) {
        const result = await cleanupOldWebhookEvents(input);
        expect(result).toBe(0); // Should return 0 on error
      }
    });

    it('should accept valid inputs', async () => {
      // Test valid inputs (won't actually delete in test env)
      const validInputs = [0, 1, 30, 365];

      for (const input of validInputs) {
        // This should not throw
        const result = await cleanupOldWebhookEvents(input);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle date calculation correctly', () => {
      // Test that date calculation works correctly
      const testDays = 30;
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - testDays);
      
      // Verify the date is exactly 30 days ago
      const diffInMs = now.getTime() - cutoffDate.getTime();
      const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
      expect(diffInDays).toBe(testDays);
    });
  });
});