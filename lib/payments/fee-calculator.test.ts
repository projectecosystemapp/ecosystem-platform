// Jest test file - no imports needed as Jest globals are available
import {
  calculateFees,
  calculateFeesFromDollars,
  validateGuestPricing,
  calculateProviderEarnings,
  calculatePlatformRevenue,
  dollarsToCents,
  centsToDollars,
  formatCentsToDisplay,
  parseDisplayToCents,
  createFeeBreakdown,
  PLATFORM_FEE_RATE,
  GUEST_SURCHARGE_RATE,
  MIN_TRANSACTION_CENTS,
  MAX_TRANSACTION_CENTS
} from './fee-calculator';

describe('Fee Calculator', () => {
  describe('calculateFees', () => {
    it('should calculate correct fees for authenticated user', () => {
      const result = calculateFees({
        baseAmountCents: 10000, // $100
        isGuest: false
      });

      expect(result.customerTotalCents).toBe(10000); // Customer pays base amount
      expect(result.guestSurchargeCents).toBe(0); // No surcharge
      expect(result.platformFeeCents).toBe(1000); // 10% platform fee
      expect(result.providerPayoutCents).toBe(9000); // 90% to provider
      expect(result.platformTotalRevenueCents).toBe(1000); // Platform gets only fee
      expect(result.effectiveCustomerRate).toBe(1.0); // No markup
      expect(result.displayAmounts.customerTotal).toBe('$100.00');
      expect(result.displayAmounts.providerPayout).toBe('$90.00');
    });

    it('should calculate correct fees for guest user', () => {
      const result = calculateFees({
        baseAmountCents: 10000, // $100
        isGuest: true
      });

      expect(result.customerTotalCents).toBe(11000); // Customer pays 110%
      expect(result.guestSurchargeCents).toBe(1000); // 10% surcharge
      expect(result.platformFeeCents).toBe(1000); // 10% platform fee
      expect(result.providerPayoutCents).toBe(9000); // Still 90% to provider
      expect(result.platformTotalRevenueCents).toBe(2000); // Platform gets fee + surcharge
      expect(result.effectiveCustomerRate).toBe(1.1); // 10% markup
      expect(result.displayAmounts.customerTotal).toBe('$110.00');
      expect(result.displayAmounts.guestSurcharge).toBe('$10.00');
    });

    it('should always use fixed 10% platform fee (constitutional mandate)', () => {
      const result = calculateFees({
        baseAmountCents: 10000, // $100
        isGuest: false
        // No commission rate parameter - always 10%
      });

      expect(result.platformFeeCents).toBe(1000); // Always 10% platform fee
      expect(result.providerPayoutCents).toBe(9000); // Always 90% to provider
      expect(result.platformFeeRate).toBe(0.10); // Fixed at 10%
    });

    it('should handle small amounts with proper rounding', () => {
      const result = calculateFees({
        baseAmountCents: 333, // $3.33
        isGuest: true
      });

      expect(result.platformFeeCents).toBe(33); // 10% of 333 = 33.3, rounded to 33
      expect(result.guestSurchargeCents).toBe(33); // Same
      expect(result.customerTotalCents).toBe(366); // 333 + 33
      expect(result.providerPayoutCents).toBe(300); // 333 - 33
    });

    it('should handle edge case amounts', () => {
      // Minimum transaction
      const minResult = calculateFees({
        baseAmountCents: MIN_TRANSACTION_CENTS,
        isGuest: true
      });
      expect(minResult.customerTotalCents).toBe(55); // 50 + 5

      // Large transaction (within limits)
      const largeResult = calculateFees({
        baseAmountCents: 10000000, // $100,000 (within MAX_TRANSACTION_CENTS)
        isGuest: false
      });
      expect(largeResult.platformFeeCents).toBe(1000000); // $10,000
      expect(largeResult.providerPayoutCents).toBe(9000000); // $90,000
    });

    it('should throw error for invalid amounts', () => {
      expect(() => calculateFees({
        baseAmountCents: 49, // Below minimum
        isGuest: false
      })).toThrow('Minimum transaction amount');

      expect(() => calculateFees({
        baseAmountCents: 100.5, // Not an integer
        isGuest: false
      })).toThrow('must be an integer');

      expect(() => calculateFees({
        baseAmountCents: MAX_TRANSACTION_CENTS + 1,
        isGuest: false
      })).toThrow('Maximum transaction amount');
    });

    it('should enforce fixed 10% rate regardless of input variations', () => {
      // Test that platform fee is immutable at 10%
      const standardFees = calculateFees({
        baseAmountCents: 10000,
        isGuest: false
      });
      expect(standardFees.platformFeeRate).toBe(0.10);
      expect(standardFees.platformFeeCents).toBe(1000);

      // Even with guest transactions, platform fee on base remains 10%
      const guestFees = calculateFees({
        baseAmountCents: 10000,
        isGuest: true
      });
      expect(guestFees.platformFeeRate).toBe(0.10);
      expect(guestFees.platformFeeCents).toBe(1000); // 10% of base
      expect(guestFees.guestSurchargeCents).toBe(1000); // Additional 10% surcharge
    });
  });

  describe('calculateFeesFromDollars', () => {
    it('should convert dollars to cents correctly', () => {
      const result = calculateFeesFromDollars(100.50, false);
      expect(result.customerTotalCents).toBe(10050);
      expect(result.platformFeeCents).toBe(1005); // 10% of 10050
    });

    it('should handle floating point precision', () => {
      // Test with a value above minimum that has floating point issues
      const amount1 = 10.1 + 10.2; // Should be 20.3 but might have precision issues
      const result1 = calculateFeesFromDollars(amount1, false);
      expect(result1.customerTotalCents).toBe(2030); // Should be exactly 2030 cents
      
      // Test with another floating point prone calculation
      const amount2 = 0.1 + 0.2 + 0.7; // Should be 1.0
      const result2 = calculateFeesFromDollars(amount2, false);
      expect(result2.customerTotalCents).toBe(100); // Should round correctly to 100 cents
    });
  });

  describe('validateGuestPricing', () => {
    it('should validate correct guest pricing', () => {
      const validation = validateGuestPricing(10000, 11000, true);
      expect(validation.valid).toBe(true);
      expect(validation.expectedCents).toBe(11000);
      expect(validation.difference).toBe(0);
    });

    it('should validate correct authenticated pricing', () => {
      const validation = validateGuestPricing(10000, 10000, false);
      expect(validation.valid).toBe(true);
      expect(validation.expectedCents).toBe(10000);
      expect(validation.difference).toBe(0);
    });

    it('should reject incorrect guest pricing', () => {
      const validation = validateGuestPricing(10000, 10000, true); // Guest paying base price
      expect(validation.valid).toBe(false);
      expect(validation.expectedCents).toBe(11000);
      expect(validation.difference).toBe(-1000);
    });

    it('should allow 1 cent rounding difference', () => {
      const validation = validateGuestPricing(10000, 11001, true); // 1 cent over
      expect(validation.valid).toBe(true);
    });
  });

  describe('calculateProviderEarnings', () => {
    it('should calculate total provider earnings', () => {
      const transactions = [
        { baseAmountCents: 10000, isGuest: true },
        { baseAmountCents: 5000, isGuest: false },
        { baseAmountCents: 20000, isGuest: true }
      ];

      const earnings = calculateProviderEarnings(transactions);
      
      // Expected: 9000 + 4500 + 18000 = 31500
      expect(earnings.totalPayoutCents).toBe(31500);
      expect(earnings.totalTransactions).toBe(3);
      expect(earnings.averageTransactionCents).toBe(10500);
      expect(earnings.displayAmounts.totalPayout).toBe('$315.00');
    });

    it('should handle empty transactions', () => {
      const earnings = calculateProviderEarnings([]);
      expect(earnings.totalPayoutCents).toBe(0);
      expect(earnings.totalTransactions).toBe(0);
      expect(earnings.averageTransactionCents).toBe(0);
    });
  });

  describe('calculatePlatformRevenue', () => {
    it('should calculate platform revenue breakdown', () => {
      const transactions = [
        { baseAmountCents: 10000, isGuest: true },  // Fee: 1000, Surcharge: 1000
        { baseAmountCents: 5000, isGuest: false },  // Fee: 500, Surcharge: 0
        { baseAmountCents: 20000, isGuest: true }   // Fee: 2000, Surcharge: 2000
      ];

      const revenue = calculatePlatformRevenue(transactions);
      
      expect(revenue.totalFeeCents).toBe(3500); // 1000 + 500 + 2000
      expect(revenue.totalSurchargeCents).toBe(3000); // 1000 + 0 + 2000
      expect(revenue.totalRevenueCents).toBe(6500); // 3500 + 3000
      expect(revenue.guestTransactionCount).toBe(2);
      expect(revenue.authenticatedTransactionCount).toBe(1);
    });
  });

  describe('Utility functions', () => {
    describe('dollarsToCents', () => {
      it('should convert dollars to cents correctly', () => {
        expect(dollarsToCents(10)).toBe(1000);
        expect(dollarsToCents(10.99)).toBe(1099);
        expect(dollarsToCents(0.01)).toBe(1);
        expect(dollarsToCents(0.1 + 0.2)).toBe(30); // Floating point handling
      });
    });

    describe('centsToDollars', () => {
      it('should convert cents to dollars correctly', () => {
        expect(centsToDollars(1000)).toBe(10);
        expect(centsToDollars(1099)).toBe(10.99);
        expect(centsToDollars(1)).toBe(0.01);
      });
    });

    describe('formatCentsToDisplay', () => {
      it('should format cents to display string', () => {
        expect(formatCentsToDisplay(1000)).toBe('$10.00');
        expect(formatCentsToDisplay(1099)).toBe('$10.99');
        expect(formatCentsToDisplay(1)).toBe('$0.01');
        expect(formatCentsToDisplay(1000000)).toBe('$10,000.00');
      });
    });

    describe('parseDisplayToCents', () => {
      it('should parse display string to cents', () => {
        expect(parseDisplayToCents('$10.00')).toBe(1000);
        expect(parseDisplayToCents('$10.99')).toBe(1099);
        expect(parseDisplayToCents('$0.01')).toBe(1);
        expect(parseDisplayToCents('$10,000.00')).toBe(1000000);
        expect(parseDisplayToCents('10.00')).toBe(1000); // Without $ sign
      });

      it('should throw error for invalid format', () => {
        expect(() => parseDisplayToCents('invalid')).toThrow('Invalid amount format');
        expect(() => parseDisplayToCents('')).toThrow('Invalid amount format');
      });
    });
  });

  describe('createFeeBreakdown', () => {
    it('should create fee breakdown for authenticated user', () => {
      const fees = calculateFees({
        baseAmountCents: 10000,
        isGuest: false
      });
      
      const breakdown = createFeeBreakdown(fees);
      
      expect(breakdown).toHaveLength(4);
      expect(breakdown[0]).toEqual({
        label: 'Service Amount',
        amount: '$100.00',
        type: 'charge'
      });
      expect(breakdown[1]).toEqual({
        label: 'Total Charge',
        amount: '$100.00',
        type: 'charge'
      });
    });

    it('should create fee breakdown for guest user', () => {
      const fees = calculateFees({
        baseAmountCents: 10000,
        isGuest: true
      });
      
      const breakdown = createFeeBreakdown(fees);
      
      expect(breakdown).toHaveLength(5);
      expect(breakdown[1]).toEqual({
        label: 'Guest Service Fee',
        amount: '$10.00',
        type: 'surcharge'
      });
      expect(breakdown[2]).toEqual({
        label: 'Total Charge',
        amount: '$110.00',
        type: 'charge'
      });
    });
  });
});