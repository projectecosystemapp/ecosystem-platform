/**
 * Platform Fee Calculation Utilities
 * 
 * Handles dynamic platform fee calculation based on user authentication status
 * - Base fee: 10% for authenticated users
 * - Guest fee: 20% for non-authenticated users
 */

/**
 * Get the platform fee percentage based on authentication status
 * @param isAuthenticated - Whether the user is logged in
 * @returns The fee percentage as a decimal (0.10 or 0.20)
 */
export function getPlatformFeeRate(isAuthenticated: boolean): number {
  const baseFeePercent = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT!);
  const guestFeePercent = parseFloat(process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT!);
  
  return (isAuthenticated ? baseFeePercent : guestFeePercent) / 100;
}

/**
 * Calculate the platform fee amount
 * @param amount - The transaction amount in cents
 * @param isAuthenticated - Whether the user is logged in
 * @returns The fee amount in cents
 */
export function calculatePlatformFee(amount: number, isAuthenticated: boolean): number {
  const feeRate = getPlatformFeeRate(isAuthenticated);
  return Math.round(amount * feeRate);
}

/**
 * Get a formatted fee percentage string for display
 * @param isAuthenticated - Whether the user is logged in
 * @returns Formatted percentage string (e.g., "10%" or "20%")
 */
export function getFormattedFeePercentage(isAuthenticated: boolean): string {
  const baseFeePercent = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT!);
  const guestFeePercent = parseFloat(process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT!);
  
  return `${isAuthenticated ? baseFeePercent : guestFeePercent}%`;
}

/**
 * Get fee information for display purposes
 * @param isAuthenticated - Whether the user is logged in
 * @returns Object with fee details
 */
export function getFeeInfo(isAuthenticated: boolean) {
  const baseFeePercent = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT!);
  const guestFeePercent = parseFloat(process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT!);
  
  return {
    rate: getPlatformFeeRate(isAuthenticated),
    percentage: isAuthenticated ? baseFeePercent : guestFeePercent,
    formatted: getFormattedFeePercentage(isAuthenticated),
    isGuestRate: !isAuthenticated, 
    savingsMessage: !isAuthenticated 
      ? `Sign in to save ${guestFeePercent - baseFeePercent}% on platform fees!`
      : null
  };
}