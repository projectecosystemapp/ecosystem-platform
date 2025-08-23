/**
 * Data Transformation Utilities for Booking System
 * Handles timezone conversions, availability calculations, aggregations, and fee calculations
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { 
  format, 
  parseISO, 
  addMinutes, 
  startOfDay, 
  endOfDay, 
  addDays, 
  subDays,
  differenceInMinutes,
  isValid,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay
} from "date-fns";

// ===========================
// TIMEZONE UTILITIES
// ===========================

export interface TimeZoneInfo {
  timeZone: string;
  offset: string;
  abbreviation: string;
  isDST: boolean;
}

export class TimeZoneConverter {
  /**
   * Convert booking time from provider timezone to UTC
   */
  static bookingToUTC(
    date: Date,
    time: string,
    providerTimezone: string
  ): { utcDate: Date; utcTime: string } {
    // Parse the time string (HH:MM format)
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a date object in the provider's timezone
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    
    // Convert to UTC
    const utcDate = fromZonedTime(localDate, providerTimezone);
    
    return {
      utcDate,
      utcTime: format(utcDate, 'HH:mm')
    };
  }

  /**
   * Convert UTC booking time to provider timezone
   */
  static utcToProviderTime(
    utcDate: Date,
    utcTime: string,
    providerTimezone: string
  ): { localDate: Date; localTime: string } {
    // Parse UTC time
    const [hours, minutes] = utcTime.split(':').map(Number);
    const utcDateTime = new Date(utcDate);
    utcDateTime.setHours(hours, minutes, 0, 0);
    
    // Convert to provider timezone
    const localDateTime = toZonedTime(utcDateTime, providerTimezone);
    
    return {
      localDate: new Date(localDateTime.getFullYear(), localDateTime.getMonth(), localDateTime.getDate()),
      localTime: format(localDateTime, 'HH:mm')
    };
  }

  /**
   * Get timezone information for a given timezone
   */
  static getTimezoneInfo(timezone: string, date: Date = new Date()): TimeZoneInfo {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    // Calculate offset
    const utcDate = new Date(date.toISOString());
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = utcDate.getTime() - localDate.getTime();
    const offsetHours = offsetMs / (1000 * 60 * 60);
    const offsetSign = offsetHours >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetHours);
    const offsetString = `${offsetSign}${Math.floor(absOffset).toString().padStart(2, '0')}:${((absOffset % 1) * 60).toString().padStart(2, '0')}`;

    return {
      timeZone: timezone,
      offset: offsetString,
      abbreviation: timeZoneName,
      isDST: this.isDaylightSavingTime(timezone, date)
    };
  }

  /**
   * Check if a date is in daylight saving time for a timezone
   */
  private static isDaylightSavingTime(timezone: string, date: Date): boolean {
    const january = new Date(date.getFullYear(), 0, 1);
    const july = new Date(date.getFullYear(), 6, 1);
    
    const janOffset = this.getTimezoneOffset(timezone, january);
    const julOffset = this.getTimezoneOffset(timezone, july);
    const currentOffset = this.getTimezoneOffset(timezone, date);
    
    return currentOffset !== Math.max(janOffset, julOffset);
  }

  private static getTimezoneOffset(timezone: string, date: Date): number {
    const utcDate = new Date(date.toISOString());
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (utcDate.getTime() - localDate.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Convert availability windows to user's timezone
   */
  static convertAvailabilityToTimezone(
    availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    fromTimezone: string,
    toTimezone: string
  ): Array<{ dayOfWeek: number; startTime: string; endTime: string }> {
    return availability.map(slot => {
      // Use a reference date (current week) to handle timezone conversions properly
      const referenceDate = startOfWeek(new Date());
      const slotDate = addDays(referenceDate, slot.dayOfWeek);
      
      const startConverted = this.bookingToUTC(slotDate, slot.startTime, fromTimezone);
      const endConverted = this.bookingToUTC(slotDate, slot.endTime, fromTimezone);
      
      const startInUserTz = this.utcToProviderTime(startConverted.utcDate, startConverted.utcTime, toTimezone);
      const endInUserTz = this.utcToProviderTime(endConverted.utcDate, endConverted.utcTime, toTimezone);
      
      return {
        dayOfWeek: getDay(startInUserTz.localDate),
        startTime: startInUserTz.localTime,
        endTime: endInUserTz.localTime
      };
    });
  }
}

// ===========================
// AVAILABILITY CALCULATIONS
// ===========================

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  duration: number; // in minutes
}

export interface AvailabilityWindow {
  date: string;
  dayOfWeek: number;
  slots: TimeSlot[];
  totalAvailableSlots: number;
  totalBookedSlots: number;
  utilizationPercentage: number;
}

export class AvailabilityCalculator {
  /**
   * Generate time slots for a given availability window
   */
  static generateTimeSlots(
    startTime: string,
    endTime: string,
    slotDuration: number = 60,
    bookedSlots: Array<{ startTime: string; endTime: string }> = [],
    blockedSlots: Array<{ startTime: string; endTime: string }> = []
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    
    for (let currentMinutes = startMinutes; currentMinutes + slotDuration <= endMinutes; currentMinutes += slotDuration) {
      const slotStart = this.minutesToTime(currentMinutes);
      const slotEnd = this.minutesToTime(currentMinutes + slotDuration);
      
      // Check if slot is available
      const isBooked = this.isTimeSlotConflicted(slotStart, slotEnd, bookedSlots);
      const isBlocked = this.isTimeSlotConflicted(slotStart, slotEnd, blockedSlots);
      
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: !isBooked && !isBlocked,
        duration: slotDuration
      });
    }
    
    return slots;
  }

  /**
   * Calculate availability windows for a date range
   */
  static calculateAvailabilityWindows(
    dateRange: { start: Date; end: Date },
    providerSchedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    bookings: Array<{ date: Date; startTime: string; endTime: string }>,
    blockedSlots: Array<{ date: Date; startTime?: string; endTime?: string }>,
    slotDuration: number = 60
  ): AvailabilityWindow[] {
    const windows: AvailabilityWindow[] = [];
    const days = eachDayOfInterval(dateRange);
    
    for (const day of days) {
      const dayOfWeek = getDay(day);
      const schedule = providerSchedule.find(s => s.dayOfWeek === dayOfWeek);
      
      if (!schedule) continue; // Provider not available on this day
      
      // Check if entire day is blocked
      const dayBlocked = blockedSlots.some(blocked => 
        this.isSameDay(blocked.date, day) && (!blocked.startTime || !blocked.endTime)
      );
      
      if (dayBlocked) {
        windows.push({
          date: format(day, 'yyyy-MM-dd'),
          dayOfWeek,
          slots: [],
          totalAvailableSlots: 0,
          totalBookedSlots: 0,
          utilizationPercentage: 0
        });
        continue;
      }
      
      // Get bookings and blocks for this day
      const dayBookings = bookings
        .filter(booking => this.isSameDay(booking.date, day))
        .map(booking => ({ startTime: booking.startTime, endTime: booking.endTime }));
      
      const dayBlocks = blockedSlots
        .filter(blocked => this.isSameDay(blocked.date, day) && blocked.startTime && blocked.endTime)
        .map(blocked => ({ startTime: blocked.startTime!, endTime: blocked.endTime! }));
      
      // Generate slots
      const slots = this.generateTimeSlots(
        schedule.startTime,
        schedule.endTime,
        slotDuration,
        dayBookings,
        dayBlocks
      );
      
      const availableSlots = slots.filter(slot => slot.available).length;
      const bookedSlots = slots.filter(slot => !slot.available).length;
      const utilizationPercentage = slots.length > 0 ? (bookedSlots / slots.length) * 100 : 0;
      
      windows.push({
        date: format(day, 'yyyy-MM-dd'),
        dayOfWeek,
        slots,
        totalAvailableSlots: availableSlots,
        totalBookedSlots: bookedSlots,
        utilizationPercentage
      });
    }
    
    return windows;
  }

  /**
   * Find next available slot for a provider
   */
  static findNextAvailableSlot(
    providerSchedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    bookings: Array<{ date: Date; startTime: string; endTime: string }>,
    blockedSlots: Array<{ date: Date; startTime?: string; endTime?: string }>,
    requiredDuration: number = 60,
    startSearchFromDate: Date = new Date()
  ): { date: Date; startTime: string; endTime: string } | null {
    const searchEndDate = addDays(startSearchFromDate, 30); // Search up to 30 days ahead
    
    const availability = this.calculateAvailabilityWindows(
      { start: startSearchFromDate, end: searchEndDate },
      providerSchedule,
      bookings,
      blockedSlots,
      requiredDuration
    );
    
    for (const window of availability) {
      const availableSlot = window.slots.find(slot => slot.available && slot.duration >= requiredDuration);
      if (availableSlot) {
        return {
          date: parseISO(window.date),
          startTime: availableSlot.startTime,
          endTime: availableSlot.endTime
        };
      }
    }
    
    return null; // No available slots found
  }

  // Helper methods
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private static isTimeSlotConflicted(
    slotStart: string,
    slotEnd: string,
    conflicts: Array<{ startTime: string; endTime: string }>
  ): boolean {
    return conflicts.some(conflict => 
      (slotStart >= conflict.startTime && slotStart < conflict.endTime) ||
      (slotEnd > conflict.startTime && slotEnd <= conflict.endTime) ||
      (slotStart <= conflict.startTime && slotEnd >= conflict.endTime)
    );
  }

  private static isSameDay(date1: Date, date2: Date): boolean {
    return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
  }
}

// ===========================
// BOOKING STATUS AGGREGATIONS
// ===========================

export interface BookingStatusSummary {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  successRate: number;
  cancellationRate: number;
}

export interface BookingTrend {
  period: string;
  bookings: BookingStatusSummary;
  revenue: {
    total: number;
    platformFees: number;
    providerPayouts: number;
  };
}

export class BookingAggregator {
  /**
   * Aggregate booking statuses
   */
  static aggregateBookingStatuses(
    bookings: Array<{
      status: string;
      totalAmount?: number;
      platformFee?: number;
      providerPayout?: number;
    }>
  ): BookingStatusSummary {
    const total = bookings.length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    const noShow = bookings.filter(b => b.status === 'no_show').length;
    
    const successRate = total > 0 ? (completed / total) * 100 : 0;
    const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;
    
    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      noShow,
      successRate,
      cancellationRate
    };
  }

  /**
   * Group bookings by time period
   */
  static groupBookingsByPeriod(
    bookings: Array<{
      date: Date;
      status: string;
      totalAmount?: number;
      platformFee?: number;
      providerPayout?: number;
    }>,
    period: 'day' | 'week' | 'month' = 'day'
  ): BookingTrend[] {
    const grouped = new Map<string, typeof bookings>();
    
    bookings.forEach(booking => {
      let key: string;
      
      switch (period) {
        case 'day':
          key = format(booking.date, 'yyyy-MM-dd');
          break;
        case 'week':
          key = format(startOfWeek(booking.date), 'yyyy-MM-dd');
          break;
        case 'month':
          key = format(startOfMonth(booking.date), 'yyyy-MM');
          break;
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(booking);
    });
    
    return Array.from(grouped.entries()).map(([period, periodBookings]) => {
      const completedBookings = periodBookings.filter(b => b.status === 'completed');
      
      return {
        period,
        bookings: this.aggregateBookingStatuses(periodBookings),
        revenue: {
          total: completedBookings.reduce((sum, b) => sum + (parseFloat(b.totalAmount?.toString() || '0')), 0),
          platformFees: completedBookings.reduce((sum, b) => sum + (parseFloat(b.platformFee?.toString() || '0')), 0),
          providerPayouts: completedBookings.reduce((sum, b) => sum + (parseFloat(b.providerPayout?.toString() || '0')), 0)
        }
      };
    }).sort((a, b) => a.period.localeCompare(b.period));
  }
}

// ===========================
// REVENUE/FEE CALCULATIONS
// ===========================

export interface FeeStructure {
  baseRate: number; // percentage (e.g., 10 for 10%)
  guestSurcharge: number; // additional percentage for non-authenticated users
  minimumFee?: number; // minimum fee amount
  maximumFee?: number; // maximum fee amount
}

export interface PricingCalculation {
  servicePrice: number;
  platformFee: number;
  platformFeePercentage: number;
  providerPayout: number;
  totalAmount: number;
  breakdown: {
    baseServicePrice: number;
    platformFeeAmount: number;
    taxes?: number;
    additionalFees?: number;
  };
}

export class RevenueCalculator {
  /**
   * Calculate platform fees and provider payout
   */
  static calculatePricing(
    servicePrice: number,
    feeStructure: FeeStructure,
    isGuest: boolean = false,
    taxes: number = 0,
    additionalFees: number = 0
  ): PricingCalculation {
    // Calculate platform fee percentage
    let feePercentage = feeStructure.baseRate;
    if (isGuest) {
      feePercentage += feeStructure.guestSurcharge;
    }
    
    // Calculate platform fee amount
    let platformFee = (servicePrice * feePercentage) / 100;
    
    // Apply minimum/maximum fee constraints
    if (feeStructure.minimumFee && platformFee < feeStructure.minimumFee) {
      platformFee = feeStructure.minimumFee;
    }
    if (feeStructure.maximumFee && platformFee > feeStructure.maximumFee) {
      platformFee = feeStructure.maximumFee;
    }
    
    // Round to 2 decimal places
    platformFee = Math.round(platformFee * 100) / 100;
    
    const totalAmount = servicePrice + platformFee + taxes + additionalFees;
    const providerPayout = servicePrice;
    
    return {
      servicePrice,
      platformFee,
      platformFeePercentage: (platformFee / servicePrice) * 100,
      providerPayout,
      totalAmount,
      breakdown: {
        baseServicePrice: servicePrice,
        platformFeeAmount: platformFee,
        taxes: taxes > 0 ? taxes : undefined,
        additionalFees: additionalFees > 0 ? additionalFees : undefined
      }
    };
  }

  /**
   * Calculate revenue metrics for a set of bookings
   */
  static calculateRevenueMetrics(
    bookings: Array<{
      status: string;
      totalAmount: number;
      platformFee: number;
      providerPayout: number;
      createdAt: Date;
    }>,
    dateRange?: { start: Date; end: Date }
  ): {
    totalRevenue: number;
    totalPlatformFees: number;
    totalProviderPayouts: number;
    averageOrderValue: number;
    averageFeePercentage: number;
    completedBookings: number;
    revenueGrowthRate?: number;
  } {
    // Filter by date range if provided
    let filteredBookings = bookings;
    if (dateRange) {
      filteredBookings = bookings.filter(
        b => b.createdAt >= dateRange.start && b.createdAt <= dateRange.end
      );
    }

    const completedBookings = filteredBookings.filter(b => b.status === 'completed');
    
    const totalRevenue = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPlatformFees = completedBookings.reduce((sum, b) => sum + b.platformFee, 0);
    const totalProviderPayouts = completedBookings.reduce((sum, b) => sum + b.providerPayout, 0);
    
    const averageOrderValue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;
    const averageFeePercentage = totalRevenue > 0 ? (totalPlatformFees / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalPlatformFees,
      totalProviderPayouts,
      averageOrderValue,
      averageFeePercentage,
      completedBookings: completedBookings.length,
    };
  }

  /**
   * Calculate provider earnings summary
   */
  static calculateProviderEarnings(
    bookings: Array<{
      status: string;
      providerPayout: number;
      totalAmount: number;
      serviceName: string;
      createdAt: Date;
    }>,
    period: 'day' | 'week' | 'month' = 'month'
  ): {
    totalEarnings: number;
    completedBookings: number;
    averageBookingValue: number;
    topServices: Array<{ serviceName: string; earnings: number; bookings: number }>;
    earningsOverTime: Array<{ period: string; earnings: number; bookings: number }>;
  } {
    const completedBookings = bookings.filter(b => b.status === 'completed');
    
    const totalEarnings = completedBookings.reduce((sum, b) => sum + b.providerPayout, 0);
    const averageBookingValue = completedBookings.length > 0 ? totalEarnings / completedBookings.length : 0;
    
    // Calculate top services
    const serviceEarnings = new Map<string, { earnings: number; bookings: number }>();
    completedBookings.forEach(booking => {
      const existing = serviceEarnings.get(booking.serviceName) || { earnings: 0, bookings: 0 };
      serviceEarnings.set(booking.serviceName, {
        earnings: existing.earnings + booking.providerPayout,
        bookings: existing.bookings + 1
      });
    });
    
    const topServices = Array.from(serviceEarnings.entries())
      .map(([serviceName, data]) => ({ serviceName, ...data }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);
    
    // Calculate earnings over time
    const earningsOverTime = BookingAggregator.groupBookingsByPeriod(
      completedBookings.map(b => ({
        date: b.createdAt,
        status: b.status,
        totalAmount: b.totalAmount,
        providerPayout: b.providerPayout
      })),
      period
    ).map(trend => ({
      period: trend.period,
      earnings: trend.revenue.providerPayouts,
      bookings: trend.bookings.completed
    }));

    return {
      totalEarnings,
      completedBookings: completedBookings.length,
      averageBookingValue,
      topServices,
      earningsOverTime
    };
  }
}

// ===========================
// DATA EXPORT UTILITIES
// ===========================

export class DataExporter {
  /**
   * Convert data to CSV format
   */
  static toCSV<T extends Record<string, any>>(
    data: T[],
    headers?: string[]
  ): string {
    if (data.length === 0) return '';
    
    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = data.map(row => 
      csvHeaders.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [csvHeaders.join(','), ...csvRows].join('\n');
  }

  /**
   * Format data for analytics dashboard
   */
  static formatForDashboard(
    bookingTrends: BookingTrend[],
    revenueMetrics: any
  ): {
    chartData: Array<{ date: string; bookings: number; revenue: number }>;
    summaryStats: Record<string, number>;
    growthRates: Record<string, number>;
  } {
    const chartData = bookingTrends.map(trend => ({
      date: trend.period,
      bookings: trend.bookings.total,
      revenue: trend.revenue.total
    }));

    const summaryStats = {
      totalRevenue: revenueMetrics.totalRevenue,
      totalBookings: bookingTrends.reduce((sum, t) => sum + t.bookings.total, 0),
      averageOrderValue: revenueMetrics.averageOrderValue,
      conversionRate: revenueMetrics.conversionRate || 0
    };

    // Calculate growth rates (comparing last period to previous)
    const growthRates: Record<string, number> = {};
    if (bookingTrends.length >= 2) {
      const current = bookingTrends[bookingTrends.length - 1];
      const previous = bookingTrends[bookingTrends.length - 2];
      
      growthRates.bookingsGrowth = previous.bookings.total > 0 
        ? ((current.bookings.total - previous.bookings.total) / previous.bookings.total) * 100
        : 0;
        
      growthRates.revenueGrowth = previous.revenue.total > 0
        ? ((current.revenue.total - previous.revenue.total) / previous.revenue.total) * 100
        : 0;
    }

    return {
      chartData,
      summaryStats,
      growthRates
    };
  }
}

// Export default fee structure (can be overridden by environment variables)
export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  baseRate: 10, // 10% for authenticated users
  guestSurcharge: 10, // Additional 10% for guests (total 20%)
  minimumFee: 0.50, // $0.50 minimum
  maximumFee: 100.00 // $100 maximum
};