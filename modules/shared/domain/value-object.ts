/**
 * Value Object Base Class
 * 
 * Immutable objects that are defined by their attributes rather than identity.
 * Two value objects with the same properties are considered equal.
 */

export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.props === undefined) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  getValue(): Readonly<T> {
    return this.props;
  }
}

/**
 * Result Type for Operation Outcomes
 * 
 * Encapsulates either a successful value or an error,
 * avoiding exceptions for expected failures.
 */
export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value?: T;
  private readonly _error?: string;

  private constructor(isSuccess: boolean, error?: string, value?: T) {
    if (isSuccess && error) {
      throw new Error("InvalidOperation: A successful result cannot have an error");
    }

    if (!isSuccess && !error) {
      throw new Error("InvalidOperation: A failing result must have an error message");
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;

    Object.freeze(this);
  }

  getValue(): T {
    if (!this.isSuccess) {
      throw new Error("Cannot get value from a failed result. Use getError() instead");
    }

    return this._value!;
  }

  getError(): string {
    if (this.isSuccess) {
      throw new Error("Cannot get error from a successful result. Use getValue() instead");
    }

    return this._error!;
  }

  static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }

  static combine(results: Result<any>[]): Result<any> {
    for (const result of results) {
      if (result.isFailure) {
        return result;
      }
    }
    return Result.ok();
  }
}

/**
 * Either Type for Functional Error Handling
 */
export type Either<L, R> = Left<L, R> | Right<L, R>;

export class Left<L, R> {
  readonly value: L;

  constructor(value: L) {
    this.value = value;
  }

  isLeft(): this is Left<L, R> {
    return true;
  }

  isRight(): this is Right<L, R> {
    return false;
  }

  map<T>(_fn: (r: R) => T): Either<L, T> {
    return new Left(this.value);
  }

  flatMap<T>(_fn: (r: R) => Either<L, T>): Either<L, T> {
    return new Left(this.value);
  }
}

export class Right<L, R> {
  readonly value: R;

  constructor(value: R) {
    this.value = value;
  }

  isLeft(): this is Left<L, R> {
    return false;
  }

  isRight(): this is Right<L, R> {
    return true;
  }

  map<T>(fn: (r: R) => T): Either<L, T> {
    return new Right(fn(this.value));
  }

  flatMap<T>(fn: (r: R) => Either<L, T>): Either<L, T> {
    return fn(this.value);
  }
}

export const left = <L, R>(l: L): Either<L, R> => new Left(l);
export const right = <L, R>(r: R): Either<L, R> => new Right(r);