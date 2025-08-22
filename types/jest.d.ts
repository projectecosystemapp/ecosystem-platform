/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toBeDisabled(): R;
    toHaveClass(className: string): R;
  }
}