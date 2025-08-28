# Visual Availability Calendar

## Overview

The enhanced BookingCalendar component provides a visual representation of provider availability with comprehensive visual indicators, real-time availability data, and an intuitive user experience designed for the Ecosystem Marketplace booking flow.

## Key Features

### 🎨 Visual Indicators

- **Available Days**: Green border, slot count badges, and availability progress bars
- **Limited Availability**: Orange styling when ≤30% slots or ≤3 slots remaining
- **Unavailable Days**: Gray styling with reduced opacity
- **Today Indicator**: Blue border with animated pulse effect
- **Selected Date**: Blue background with enhanced styling

### 📊 Real-time Data

- Fetches availability using the slot generator system
- Respects service duration for accurate slot calculations
- Shows remaining capacity with visual progress bars
- Updates when service selection changes
- Efficient batched API calls to minimize server load

### 🔧 Technical Implementation

#### Component Structure

```typescript
interface BookingCalendarProps {
  providerId: string;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  selectedService?: {
    duration: number;
    name: string;
    price: number;
  };
  timezone?: string;
}
```

#### Data Flow

1. **Month Navigation**: Users can navigate between months within booking window
2. **Availability Fetching**: Batched requests fetch availability for visible dates
3. **Visual Updates**: Calendar updates with availability indicators in real-time
4. **Date Selection**: Clicking available dates triggers time slot selection

## Usage Examples

### Basic Implementation

```tsx
import { BookingCalendar } from '@/components/booking/BookingCalendar';

function MyBookingForm() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  return (
    <BookingCalendar
      providerId="provider-123"
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      selectedService={{
        duration: 60,
        name: "Consultation",
        price: 100
      }}
    />
  );
}
```

### Integration with Booking Flow

The calendar automatically integrates with the existing booking flow:

```tsx
// In BookingFlow.tsx
{currentStep === "date" && (
  <BookingCalendar
    providerId={provider.id}
    selectedDate={selectedDate}
    onSelectDate={setSelectedDate}
    selectedService={selectedService}
  />
)}
```

## API Integration

### Slot Generation

The calendar uses the enhanced slot generator system:

```typescript
// Fetches availability using server actions
const result = await getAvailableSlotsAction(
  providerId,
  dateStr,
  serviceDuration,
  { timezone, minimumNoticeHours: 2 }
);
```

### Batch Optimization

- Requests are batched by week (7 dates at a time)
- Sequential processing prevents server overload
- Efficient caching prevents unnecessary re-fetches
- Error handling ensures graceful degradation

## Visual Design System

### Colors & States

| State | Border | Background | Text | Badge |
|-------|--------|------------|------|-------|
| Available | `border-green-200` | `bg-white` | `text-gray-900` | Green count |
| Limited | `border-orange-200` | `bg-orange-50` | `text-orange-700` | Orange count |
| Unavailable | `border-gray-200` | `bg-gray-50` | `text-gray-400` | None |
| Selected | `border-blue-600` | `bg-blue-600` | `text-white` | White count |
| Today | `border-blue-500` | `bg-white` | `text-blue-600` | "Today" label |

### Accessibility Features

- **ARIA Labels**: Each day includes availability information
- **Keyboard Navigation**: Full keyboard support with focus indicators
- **Screen Reader Support**: Availability status announced to screen readers
- **High Contrast**: Visual indicators work in high contrast mode
- **Focus Management**: Logical tab order and focus states

## Performance Optimizations

### Efficient Data Fetching

- **Batched Requests**: Process dates in weekly batches
- **Conditional Fetching**: Only fetch future dates within booking window
- **Error Recovery**: Graceful handling of failed availability requests
- **Memory Management**: Maps used for efficient data lookup

### Rendering Optimizations

- **Motion Components**: Framer Motion for smooth animations
- **Skeleton Loading**: Progressive loading states
- **Conditional Rendering**: Only render necessary visual elements
- **Memoized Calculations**: Efficient status determinations

## Integration Points

### Booking Flow Integration

The calendar seamlessly integrates with:

1. **Service Selection**: Updates availability based on service duration
2. **Time Slot Picker**: Selected date automatically triggers time slot display
3. **Guest vs Customer Flow**: Adapts UI based on authentication status
4. **Fee Calculation**: Provides context for pricing display

### Provider Dashboard

Providers can view their calendar availability:

```tsx
// In provider dashboard
<BookingCalendar
  providerId={currentUser.providerId}
  selectedDate={selectedDate}
  onSelectDate={setSelectedDate}
  selectedService={defaultService}
  // Additional provider-specific props
/>
```

## Future Enhancements

### Planned Features

- **Multi-day Selection**: Support for multi-day bookings
- **Recurring Appointments**: Visual indicators for recurring bookings
- **Capacity Management**: Enhanced capacity visualization
- **Mobile Optimizations**: Touch-optimized interactions
- **Calendar Export**: Integration with calendar applications

### Extension Points

The calendar is designed for extensibility:

```typescript
// Custom availability processors
interface AvailabilityProcessor {
  processDay(date: Date, rawAvailability: any): DayAvailability;
  getVisualState(availability: DayAvailability): VisualState;
}

// Custom visual themes
interface CalendarTheme {
  colors: CalendarColors;
  spacing: CalendarSpacing;
  animations: CalendarAnimations;
}
```

## Troubleshooting

### Common Issues

1. **Slow Loading**: Check network requests, consider reducing batch size
2. **Missing Availability**: Verify provider has set up availability schedules
3. **Incorrect Timezones**: Ensure timezone parameter is properly passed
4. **Visual Glitches**: Check for CSS conflicts with Tailwind classes

### Debug Tools

```typescript
// Enable debug logging
const DEBUG_AVAILABILITY = true;

if (DEBUG_AVAILABILITY) {
  console.log('Availability Map:', availabilityMap);
  console.log('Fetch Results:', batchResults);
}
```

## API Reference

### Dependencies

- **date-fns**: Date manipulation and formatting
- **framer-motion**: Animations and transitions
- **lucide-react**: Icons and visual elements
- **@/components/ui**: ShadCN UI components

### Server Actions

- `getAvailableSlotsAction`: Fetches slots for a specific date
- `checkSlotAvailabilityAction`: Validates specific time slot
- `getProviderAvailability`: Gets comprehensive availability data

---

This enhanced availability calendar provides a sophisticated yet intuitive booking experience that scales with the needs of the Ecosystem Marketplace platform.