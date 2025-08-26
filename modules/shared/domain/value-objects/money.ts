/**
 * Money Value Object
 * 
 * Represents monetary values with currency and proper arithmetic operations.
 * Ensures precision in financial calculations.
 */

import { ValueObject, Result } from '../value-object';

export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private static readonly CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD'] as const;
  private static readonly PRECISION = 2;

  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: string = 'USD'): Result<Money> {
    if (!this.CURRENCIES.includes(currency as any)) {
      return Result.fail(`Invalid currency: ${currency}`);
    }

    if (amount < 0) {
      return Result.fail('Amount cannot be negative');
    }

    if (!Number.isFinite(amount)) {
      return Result.fail('Amount must be a finite number');
    }

    // Round to 2 decimal places for currency
    const roundedAmount = Math.round(amount * 100) / 100;

    return Result.ok(new Money({ amount: roundedAmount, currency }));
  }

  static zero(currency: string = 'USD'): Money {
    const result = Money.create(0, currency);
    if (result.isFailure) {
      throw new Error(result.getError());
    }
    return result.getValue();
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  get cents(): number {
    return Math.round(this.props.amount * 100);
  }

  add(money: Money): Result<Money> {
    if (this.props.currency !== money.props.currency) {
      return Result.fail('Cannot add money with different currencies');
    }

    return Money.create(
      this.props.amount + money.props.amount,
      this.props.currency
    );
  }

  subtract(money: Money): Result<Money> {
    if (this.props.currency !== money.props.currency) {
      return Result.fail('Cannot subtract money with different currencies');
    }

    const newAmount = this.props.amount - money.props.amount;
    if (newAmount < 0) {
      return Result.fail('Subtraction would result in negative amount');
    }

    return Money.create(newAmount, this.props.currency);
  }

  multiply(factor: number): Result<Money> {
    if (factor < 0) {
      return Result.fail('Factor cannot be negative');
    }

    return Money.create(
      this.props.amount * factor,
      this.props.currency
    );
  }

  percentage(percent: number): Result<Money> {
    if (percent < 0 || percent > 100) {
      return Result.fail('Percentage must be between 0 and 100');
    }

    return Money.create(
      this.props.amount * (percent / 100),
      this.props.currency
    );
  }

  isGreaterThan(money: Money): boolean {
    if (this.props.currency !== money.props.currency) {
      throw new Error('Cannot compare money with different currencies');
    }
    return this.props.amount > money.props.amount;
  }

  isLessThan(money: Money): boolean {
    if (this.props.currency !== money.props.currency) {
      throw new Error('Cannot compare money with different currencies');
    }
    return this.props.amount < money.props.amount;
  }

  isEqualTo(money: Money): boolean {
    return this.equals(money);
  }

  format(): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.props.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter.format(this.props.amount);
  }

  toString(): string {
    return this.format();
  }

  // Calculate platform fee based on percentage
  calculatePlatformFee(feePercentage: number): Result<{ fee: Money; remainder: Money }> {
    const feeResult = this.percentage(feePercentage);
    if (feeResult.isFailure) {
      return Result.fail(feeResult.getError());
    }

    const fee = feeResult.getValue();
    const remainderResult = this.subtract(fee);
    if (remainderResult.isFailure) {
      return Result.fail(remainderResult.getError());
    }

    return Result.ok({
      fee,
      remainder: remainderResult.getValue()
    });
  }
}