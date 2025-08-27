import { db } from "@/db/db";
import { transactionsTable, bookingsTable, providersTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Types
export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  fee: number;
  netAmount: number;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  stripeSupported: boolean;
  minAmount: number; // Minimum amount in smallest unit (cents)
}

export class CurrencyService {
  // Supported currencies with their properties
  private readonly supportedCurrencies: Record<string, SupportedCurrency> = {
    USD: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // $0.50
    },
    EUR: {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // €0.50
    },
    GBP: {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 30, // £0.30
    },
    CAD: {
      code: 'CAD',
      name: 'Canadian Dollar',
      symbol: 'C$',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // C$0.50
    },
    AUD: {
      code: 'AUD',
      name: 'Australian Dollar',
      symbol: 'A$',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // A$0.50
    },
    JPY: {
      code: 'JPY',
      name: 'Japanese Yen',
      symbol: '¥',
      decimalPlaces: 0,
      stripeSupported: true,
      minAmount: 50, // ¥50
    },
    CNY: {
      code: 'CNY',
      name: 'Chinese Yuan',
      symbol: '¥',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 400, // ¥4.00
    },
    INR: {
      code: 'INR',
      name: 'Indian Rupee',
      symbol: '₹',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // ₹0.50
    },
    MXN: {
      code: 'MXN',
      name: 'Mexican Peso',
      symbol: 'MX$',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 1000, // MX$10.00
    },
    BRL: {
      code: 'BRL',
      name: 'Brazilian Real',
      symbol: 'R$',
      decimalPlaces: 2,
      stripeSupported: true,
      minAmount: 50, // R$0.50
    },
  };

  // Exchange rates cache (in production, use external API)
  private exchangeRatesCache: Map<string, CurrencyRate> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly CONVERSION_FEE = 0.02; // 2% conversion fee

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): SupportedCurrency[] {
    return Object.values(this.supportedCurrencies);
  }

  /**
   * Check if currency is supported
   */
  isCurrencySupported(currencyCode: string): boolean {
    return currencyCode in this.supportedCurrencies;
  }

  /**
   * Get currency details
   */
  getCurrencyDetails(currencyCode: string): SupportedCurrency | null {
    return this.supportedCurrencies[currencyCode] || null;
  }

  /**
   * Convert amount between currencies
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    applyFee: boolean = true
  ): Promise<CurrencyConversion> {
    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount,
        convertedCurrency: toCurrency,
        exchangeRate: 1,
        fee: 0,
        netAmount: amount,
      };
    }

    // Get exchange rate
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    
    // Calculate conversion
    const convertedAmount = amount * rate;
    const fee = applyFee ? convertedAmount * this.CONVERSION_FEE : 0;
    const netAmount = convertedAmount - fee;

    // Round based on target currency decimal places
    const targetCurrency = this.getCurrencyDetails(toCurrency);
    const decimalPlaces = targetCurrency?.decimalPlaces || 2;
    const roundedNet = this.roundAmount(netAmount, decimalPlaces);

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: this.roundAmount(convertedAmount, decimalPlaces),
      convertedCurrency: toCurrency,
      exchangeRate: rate,
      fee: this.roundAmount(fee, decimalPlaces),
      netAmount: roundedNet,
    };
  }

  /**
   * Get exchange rate between currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cached = this.exchangeRatesCache.get(cacheKey);

    // Check cache validity
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_TTL) {
      return cached.rate;
    }

    // Fetch fresh rate
    const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
    
    // Update cache
    this.exchangeRatesCache.set(cacheKey, {
      from: fromCurrency,
      to: toCurrency,
      rate,
      timestamp: new Date(),
    });

    return rate;
  }

  /**
   * Fetch exchange rate from external API
   * In production, integrate with a real exchange rate API
   */
  private async fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Simulated exchange rates for demo
    // In production, use APIs like:
    // - exchangeratesapi.io
    // - fixer.io
    // - currencyapi.com
    // - xe.com
    
    const mockRates: Record<string, Record<string, number>> = {
      USD: {
        EUR: 0.92,
        GBP: 0.79,
        CAD: 1.36,
        AUD: 1.52,
        JPY: 149.50,
        CNY: 7.24,
        INR: 83.12,
        MXN: 17.05,
        BRL: 4.97,
      },
      EUR: {
        USD: 1.09,
        GBP: 0.86,
        CAD: 1.48,
        AUD: 1.65,
        JPY: 162.50,
        CNY: 7.87,
        INR: 90.35,
        MXN: 18.54,
        BRL: 5.40,
      },
      // Add more as needed...
    };

    // Get rate from mock data
    if (mockRates[fromCurrency]?.[toCurrency]) {
      return mockRates[fromCurrency][toCurrency];
    }

    // Calculate inverse if available
    if (mockRates[toCurrency]?.[fromCurrency]) {
      return 1 / mockRates[toCurrency][fromCurrency];
    }

    // Default to 1:1 if not found (shouldn't happen in production)
    console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    return 1;
  }

  /**
   * Round amount based on currency decimal places
   */
  private roundAmount(amount: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(amount * factor) / factor;
  }

  /**
   * Format amount with currency symbol
   */
  formatCurrency(amount: number, currencyCode: string, locale: string = 'en-US'): string {
    const currency = this.getCurrencyDetails(currencyCode);
    if (!currency) {
      return `${amount} ${currencyCode}`;
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces,
      }).format(amount);
    } catch (error) {
      // Fallback formatting
      return `${currency.symbol}${amount.toFixed(currency.decimalPlaces)}`;
    }
  }

  /**
   * Convert amount to smallest currency unit (for Stripe)
   */
  toSmallestUnit(amount: number, currencyCode: string): number {
    const currency = this.getCurrencyDetails(currencyCode);
    if (!currency) {
      return Math.round(amount * 100); // Default to cents
    }

    const factor = Math.pow(10, currency.decimalPlaces);
    return Math.round(amount * factor);
  }

  /**
   * Convert from smallest currency unit
   */
  fromSmallestUnit(amount: number, currencyCode: string): number {
    const currency = this.getCurrencyDetails(currencyCode);
    if (!currency) {
      return amount / 100; // Default from cents
    }

    const factor = Math.pow(10, currency.decimalPlaces);
    return amount / factor;
  }

  /**
   * Process multi-currency transaction
   */
  async processMultiCurrencyTransaction(
    bookingId: string,
    amount: number,
    customerCurrency: string,
    providerCurrency: string,
    platformCurrency: string = 'USD'
  ) {
    // Convert amounts for each party
    const customerAmount = amount; // Already in customer currency
    
    // Convert to provider currency if different
    const providerConversion = await this.convertCurrency(
      amount,
      customerCurrency,
      providerCurrency,
      false // Don't apply fee for provider
    );

    // Convert platform fee to platform currency
    const platformFee = amount * 0.1; // 10% platform fee
    const platformConversion = await this.convertCurrency(
      platformFee,
      customerCurrency,
      platformCurrency,
      false
    );

    // Store transaction with multi-currency details
    const [transaction] = await db
      .insert(transactionsTable)
      .values({
        bookingId,
        amount: customerAmount.toString(),
        currency: customerCurrency,
        originalAmount: customerAmount.toString(),
        originalCurrency: customerCurrency,
        platformFee: platformConversion.netAmount.toString(),
        providerPayout: (providerConversion.netAmount - platformConversion.netAmount).toString(),
        exchangeRate: providerConversion.exchangeRate.toString(),
        status: 'pending',
      })
      .returning();

    return {
      transactionId: transaction.id,
      customerAmount,
      customerCurrency,
      providerAmount: providerConversion.netAmount,
      providerCurrency,
      platformFee: platformConversion.netAmount,
      platformCurrency,
      exchangeRates: {
        toProvider: providerConversion.exchangeRate,
        toPlatform: platformConversion.exchangeRate,
      },
    };
  }

  /**
   * Get provider preferred currencies
   */
  async getProviderCurrencies(providerId: string): Promise<{
    preferred: string;
    supported: string[];
  }> {
    const [provider] = await db
      .select({
        preferredCurrency: sql<string>`COALESCE(${providersTable.preferredCurrency}, 'USD')`,
        supportedCurrencies: sql<string[]>`COALESCE(${providersTable.supportedCurrencies}, '["USD"]'::jsonb)`,
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return {
        preferred: 'USD',
        supported: ['USD'],
      };
    }

    return {
      preferred: provider.preferredCurrency,
      supported: provider.supportedCurrencies,
    };
  }

  /**
   * Update provider currency preferences
   */
  async updateProviderCurrencies(
    providerId: string,
    preferredCurrency: string,
    supportedCurrencies: string[]
  ) {
    // Validate currencies
    if (!this.isCurrencySupported(preferredCurrency)) {
      throw new Error(`Currency ${preferredCurrency} is not supported`);
    }

    for (const currency of supportedCurrencies) {
      if (!this.isCurrencySupported(currency)) {
        throw new Error(`Currency ${currency} is not supported`);
      }
    }

    // Update provider
    await db
      .update(providersTable)
      .set({
        preferredCurrency,
        supportedCurrencies: supportedCurrencies as any,
      })
      .where(eq(providersTable.id, providerId));
  }

  /**
   * Get currency statistics for reporting
   */
  async getCurrencyStatistics(startDate: Date, endDate: Date) {
    const stats = await db
      .select({
        currency: sql<string>`COALESCE(${transactionsTable.currency}, 'USD')`,
        totalAmount: sql<number>`SUM(${transactionsTable.amount})`,
        totalTransactions: sql<number>`COUNT(*)`,
        avgAmount: sql<number>`AVG(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        sql`${transactionsTable.createdAt} BETWEEN ${startDate} AND ${endDate}`
      )
      .groupBy(sql`COALESCE(${transactionsTable.currency}, 'USD')`);

    return stats;
  }
}

// Export singleton instance
export const currencyService = new CurrencyService();