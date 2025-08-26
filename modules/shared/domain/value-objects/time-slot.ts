/**
 * TimeSlot Value Object
 * 
 * Represents a time period with validation and conflict detection.
 */

import { ValueObject, Result } from '../value-object';

export interface TimeSlotProps {
  startTime: Date;
  endTime: Date;
  timeZone: string;
}

export class TimeSlot extends ValueObject<TimeSlotProps> {
  private static readonly MIN_DURATION_MINUTES = 15;
  private static readonly MAX_DURATION_HOURS = 8;

  private constructor(props: TimeSlotProps) {
    super(props);
  }

  static create(startTime: Date, endTime: Date, timeZone: string = 'UTC'): Result<TimeSlot> {
    if (!startTime || !endTime) {
      return Result.fail('Start time and end time are required');
    }

    if (startTime >= endTime) {
      return Result.fail('Start time must be before end time');
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    const durationHours = durationMinutes / 60;

    if (durationMinutes < this.MIN_DURATION_MINUTES) {
      return Result.fail(`Duration must be at least ${this.MIN_DURATION_MINUTES} minutes`);
    }

    if (durationHours > this.MAX_DURATION_HOURS) {
      return Result.fail(`Duration cannot exceed ${this.MAX_DURATION_HOURS} hours`);
    }

    // Ensure times are in the future (for booking purposes)
    const now = new Date();
    if (startTime < now) {
      return Result.fail('Start time must be in the future');
    }

    return Result.ok(new TimeSlot({ startTime, endTime, timeZone }));
  }

  static createFromDuration(
    startTime: Date,
    durationMinutes: number,
    timeZone: string = 'UTC'
  ): Result<TimeSlot> {
    if (durationMinutes <= 0) {
      return Result.fail('Duration must be positive');
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    return TimeSlot.create(startTime, endTime, timeZone);
  }

  get startTime(): Date {
    return new Date(this.props.startTime);
  }

  get endTime(): Date {
    return new Date(this.props.endTime);
  }

  get timeZone(): string {
    return this.props.timeZone;
  }

  get durationMinutes(): number {
    return (this.props.endTime.getTime() - this.props.startTime.getTime()) / (1000 * 60);
  }

  get durationHours(): number {
    return this.durationMinutes / 60;
  }

  overlaps(other: TimeSlot): boolean {
    return (
      this.props.startTime < other.props.endTime &&
      this.props.endTime > other.props.startTime
    );
  }

  contains(time: Date): boolean {
    return time >= this.props.startTime && time <= this.props.endTime;
  }

  containsSlot(other: TimeSlot): boolean {
    return (
      this.props.startTime <= other.props.startTime &&
      this.props.endTime >= other.props.endTime
    );
  }

  adjacentTo(other: TimeSlot): boolean {
    return (
      this.props.endTime.getTime() === other.props.startTime.getTime() ||
      this.props.startTime.getTime() === other.props.endTime.getTime()
    );
  }

  merge(other: TimeSlot): Result<TimeSlot> {
    if (!this.overlaps(other) && !this.adjacentTo(other)) {
      return Result.fail('Time slots must overlap or be adjacent to merge');
    }

    const startTime = new Date(
      Math.min(this.props.startTime.getTime(), other.props.startTime.getTime())
    );
    const endTime = new Date(
      Math.max(this.props.endTime.getTime(), other.props.endTime.getTime())
    );

    return TimeSlot.create(startTime, endTime, this.props.timeZone);
  }

  split(splitTime: Date): Result<[TimeSlot, TimeSlot]> {
    if (!this.contains(splitTime)) {
      return Result.fail('Split time must be within the time slot');
    }

    if (splitTime.getTime() === this.props.startTime.getTime() ||
        splitTime.getTime() === this.props.endTime.getTime()) {
      return Result.fail('Cannot split at start or end time');
    }

    const firstSlotResult = TimeSlot.create(
      this.props.startTime,
      splitTime,
      this.props.timeZone
    );

    const secondSlotResult = TimeSlot.create(
      splitTime,
      this.props.endTime,
      this.props.timeZone
    );

    if (firstSlotResult.isFailure || secondSlotResult.isFailure) {
      return Result.fail('Failed to create split time slots');
    }

    return Result.ok([
      firstSlotResult.getValue(),
      secondSlotResult.getValue()
    ]);
  }

  format(): string {
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: this.props.timeZone
      });
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: this.props.timeZone
      });
    };

    return `${formatDate(this.props.startTime)} ${formatTime(this.props.startTime)} - ${formatTime(this.props.endTime)} (${this.props.timeZone})`;
  }

  toString(): string {
    return this.format();
  }
}