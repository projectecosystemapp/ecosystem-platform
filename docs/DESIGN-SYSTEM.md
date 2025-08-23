# ECOSYSTEM Design System Documentation

## Table of Contents
1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Patterns](#component-patterns)
6. [Page Layouts](#page-layouts)
7. [Mobile Responsive Design](#mobile-responsive-design)
8. [Accessibility (WCAG AA)](#accessibility-wcag-aa)
9. [User Flows](#user-flows)
10. [Implementation Guidelines](#implementation-guidelines)

---

## Design Principles

### 1. Trust First
Every design decision reinforces credibility and security. Use verified badges, security icons, and trust signals prominently.

### 2. Reduce Friction
Minimize steps in critical flows. Use progressive disclosure and smart defaults to simplify complex processes.

### 3. Premium Feel
Sophisticated design without intimidation. Clean lines, ample whitespace, and subtle animations create a premium experience.

### 4. Mobile-First
Design for touch interfaces first, then enhance for desktop. All interactions must be thumb-friendly on mobile devices.

### 5. Inclusive Design
WCAG AA compliance is non-negotiable. Design for all users, including those with disabilities.

---

## Color System

### Primary Palette
```css
/* Brand Blue - Trust & Action */
primary-500: #0066FF  /* Main CTAs, links */
primary-600: #0052CC  /* Hover states */
primary-50:  #E6F0FF  /* Background tints */

/* Premium Purple - Accent */
secondary-500: #6B46C1  /* Premium features */
secondary-50:  #F3EBFE  /* Soft backgrounds */

/* Success Green - Verification */
success-500: #10B981  /* Verified badges, success states */
success-50:  #D1FAE5  /* Success backgrounds */
```

### Usage Guidelines
- **Primary Blue**: Main CTAs, navigation, links
- **Secondary Purple**: Premium/Pro features, special offers
- **Success Green**: Verification badges, success messages, available status
- **Neutral Grays**: Body text, borders, disabled states
- **Error Red**: Form validation, critical alerts only

---

## Typography

### Font Stack
```css
/* Headings - Display Font */
font-family: 'Clash Display', Inter, -apple-system, sans-serif;

/* Body Text - Clean Sans */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Code/Numbers - Monospace */
font-family: 'JetBrains Mono', Consolas, monospace;
```

### Type Scale (Mobile → Desktop)
```css
/* Hero Headlines */
h1: 2.25rem → 3.5rem (36px → 56px)
line-height: 1.2
font-weight: 700

/* Section Headers */
h2: 1.875rem → 2.5rem (30px → 40px)
line-height: 1.3
font-weight: 600

/* Card Titles */
h3: 1.25rem → 1.5rem (20px → 24px)
line-height: 1.4
font-weight: 600

/* Body Text */
body: 1rem (16px)
line-height: 1.6
font-weight: 400

/* Small Text */
small: 0.875rem (14px)
line-height: 1.5
font-weight: 400
```

---

## Spacing & Layout

### Grid System
```css
/* Container Widths */
max-w-sm:  384px  /* Forms, modals */
max-w-2xl: 672px  /* Content blocks */
max-w-4xl: 896px  /* Wide content */
max-w-6xl: 1152px /* Main container */
max-w-7xl: 1280px /* Full width sections */

/* Spacing Scale (rem) */
space-1: 0.25rem (4px)
space-2: 0.5rem (8px)
space-3: 0.75rem (12px)
space-4: 1rem (16px)
space-6: 1.5rem (24px)
space-8: 2rem (32px)
space-12: 3rem (48px)
space-16: 4rem (64px)
```

### Section Padding
```css
/* Mobile → Desktop */
Section: py-12 md:py-16 lg:py-20 (48px → 64px → 80px)
Container: px-4 md:px-6 lg:px-8
Card: p-4 md:p-6 lg:p-8
```

---

## Component Patterns

### 1. Buttons

#### Primary Button (CTA)
```tsx
<button className="
  bg-primary-500 text-white
  hover:bg-primary-600 active:bg-primary-700
  px-6 py-3 rounded-lg
  font-semibold text-base
  transition-all duration-200
  shadow-sm hover:shadow-md
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  min-h-[44px] /* Touch target */
">
  Book Now
</button>
```

#### Secondary Button
```tsx
<button className="
  bg-white text-primary-600
  border-2 border-primary-200
  hover:bg-primary-50 hover:border-primary-300
  px-6 py-3 rounded-lg
  font-semibold text-base
  transition-all duration-200
">
  Learn More
</button>
```

#### Ghost Button
```tsx
<button className="
  text-neutral-600 hover:text-primary-600
  hover:bg-neutral-100
  px-4 py-2 rounded-md
  font-medium text-sm
  transition-all duration-200
">
  Cancel
</button>
```

### 2. Cards

#### Provider Card
```tsx
<div className="
  bg-white rounded-xl
  border border-neutral-200
  hover:border-primary-200 hover:shadow-lg
  transition-all duration-300
  overflow-hidden
  group
">
  {/* Image Container */}
  <div className="relative h-48 bg-neutral-100">
    <img className="w-full h-full object-cover" />
    <div className="absolute top-3 right-3">
      <span className="bg-success-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Verified
      </span>
    </div>
  </div>
  
  {/* Content */}
  <div className="p-4 space-y-3">
    <div className="flex items-start justify-between">
      <div>
        <h3 className="font-semibold text-lg text-neutral-900">John Smith</h3>
        <p className="text-sm text-neutral-600">Professional Photographer</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-neutral-900">$150</p>
        <p className="text-xs text-neutral-500">/hour</p>
      </div>
    </div>
    
    {/* Rating */}
    <div className="flex items-center gap-2">
      <div className="flex text-yellow-400">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-current" />
        ))}
      </div>
      <span className="text-sm text-neutral-600">4.9 (127 reviews)</span>
    </div>
    
    {/* Tags */}
    <div className="flex flex-wrap gap-2">
      <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs font-medium">
        Wedding
      </span>
      <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs font-medium">
        Portrait
      </span>
    </div>
    
    {/* CTA */}
    <button className="w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors">
      View Profile
    </button>
  </div>
</div>
```

### 3. Forms

#### Input Field
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-neutral-700">
    Email Address
  </label>
  <input
    type="email"
    className="
      w-full px-4 py-2.5
      border border-neutral-300 rounded-lg
      focus:border-primary-500 focus:ring-2 focus:ring-primary-100
      placeholder:text-neutral-400
      text-neutral-900
      transition-all duration-200
      min-h-[44px]
    "
    placeholder="your@email.com"
  />
  <p className="text-xs text-neutral-500">We'll never share your email</p>
</div>
```

#### Select Dropdown
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-neutral-700">
    Service Type
  </label>
  <select className="
    w-full px-4 py-2.5
    border border-neutral-300 rounded-lg
    focus:border-primary-500 focus:ring-2 focus:ring-primary-100
    text-neutral-900
    bg-white
    appearance-none
    bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDEuNUw2IDYuNUwxMSAxLjUiIHN0cm9rZT0iIzZCNzI4MCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4=')] bg-[position:right_1rem_center] bg-no-repeat
    min-h-[44px]
  ">
    <option>Select a service</option>
    <option>Photography</option>
    <option>Personal Training</option>
  </select>
</div>
```

### 4. Navigation

#### Desktop Navigation
```tsx
<nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16 lg:h-18">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">E</span>
        </div>
        <span className="font-bold text-xl text-neutral-900">ECOSYSTEM</span>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden lg:flex items-center gap-8">
        <a href="#" className="text-neutral-600 hover:text-primary-600 font-medium transition-colors">
          Find Services
        </a>
        <a href="#" className="text-neutral-600 hover:text-primary-600 font-medium transition-colors">
          How It Works
        </a>
        <a href="#" className="text-neutral-600 hover:text-primary-600 font-medium transition-colors">
          Become a Provider
        </a>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="text-neutral-600 hover:text-primary-600 font-medium">
          Sign In
        </button>
        <button className="bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors">
          Get Started
        </button>
      </div>
    </div>
  </div>
</nav>
```

### 5. Modals

#### Booking Modal
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
  
  {/* Modal */}
  <div className="relative bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
    {/* Header */}
    <div className="sticky top-0 bg-white border-b border-neutral-200 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Book Service</h2>
        <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
    
    {/* Content */}
    <div className="p-6 space-y-6">
      {/* Provider Info */}
      <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
        <img className="w-12 h-12 rounded-full" />
        <div>
          <p className="font-semibold text-neutral-900">John Smith</p>
          <p className="text-sm text-neutral-600">Photography - $150/hour</p>
        </div>
      </div>
      
      {/* Date & Time Selection */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Select Date</label>
          <input type="date" className="w-full mt-2 px-4 py-2.5 border border-neutral-300 rounded-lg" />
        </div>
        
        <div>
          <label className="text-sm font-medium text-neutral-700">Select Time</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {['9:00 AM', '10:00 AM', '11:00 AM'].map(time => (
              <button key={time} className="px-3 py-2 border border-neutral-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-sm">
                {time}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Price Summary */}
      <div className="p-4 bg-primary-50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Service (2 hours)</span>
          <span className="font-medium text-neutral-900">$300.00</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Platform Fee</span>
          <span className="font-medium text-neutral-900">$30.00</span>
        </div>
        <div className="pt-2 border-t border-primary-200 flex justify-between">
          <span className="font-semibold text-neutral-900">Total</span>
          <span className="font-bold text-lg text-primary-600">$330.00</span>
        </div>
      </div>
    </div>
    
    {/* Footer */}
    <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-6 flex gap-3">
      <button className="flex-1 py-3 px-4 border border-neutral-300 rounded-lg font-medium hover:bg-neutral-50 transition-colors">
        Cancel
      </button>
      <button className="flex-1 py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors">
        Confirm Booking
      </button>
    </div>
  </div>
</div>
```

---

## Page Layouts

### 1. Landing Page Structure

```
┌─────────────────────────────────────────┐
│  Navigation (Sticky)                    │
├─────────────────────────────────────────┤
│                                         │
│  Hero Section                           │
│  - Headline (56px)                      │
│  - Subheadline (20px)                   │
│  - CTA Buttons                          │
│  - Trust Indicators                     │
│                                         │
├─────────────────────────────────────────┤
│  Social Proof Bar                      │
│  - Stats (10K+ Providers, etc.)        │
├─────────────────────────────────────────┤
│                                         │
│  Service Categories Grid               │
│  - 8 Category Cards (2x4 mobile, 4x2)  │
│                                         │
├─────────────────────────────────────────┤
│  How It Works                          │
│  - Split: Customer | Provider          │
│  - 4 Steps Each with Icons             │
├─────────────────────────────────────────┤
│                                         │
│  Featured Providers                    │
│  - Carousel of Provider Cards          │
│                                         │
├─────────────────────────────────────────┤
│  Trust & Safety                        │
│  - Feature Grid (6 items)              │
├─────────────────────────────────────────┤
│                                         │
│  Testimonials                          │
│  - 3 Review Cards                      │
│                                         │
├─────────────────────────────────────────┤
│  CTA Section                           │
│  - Final Conversion Push               │
├─────────────────────────────────────────┤
│  Footer                                │
│  - Links, Legal, Social                │
└─────────────────────────────────────────┘
```

### 2. Provider Search/Discovery Page

```
┌─────────────────────────────────────────┐
│  Navigation                             │
├─────────────────────────────────────────┤
│  Search Header                          │
│  ┌─────────────────────────────────┐   │
│  │ Search Input with Filters       │   │
│  │ Location | Service | Price      │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│                                         │
│  Results Section (2-Column Desktop)     │
│  ┌──────────┬─────────────────────┐    │
│  │ Filters  │  Provider Grid       │    │
│  │          │  ┌────┐ ┌────┐      │    │
│  │ Service  │  │Card│ │Card│      │    │
│  │ Price    │  └────┘ └────┘      │    │
│  │ Rating   │  ┌────┐ ┌────┐      │    │
│  │ Distance │  │Card│ │Card│      │    │
│  │          │  └────┘ └────┘      │    │
│  └──────────┴─────────────────────┘    │
│                                         │
│  Load More / Pagination                │
└─────────────────────────────────────────┘
```

### 3. Provider Profile Page

```
┌─────────────────────────────────────────┐
│  Navigation                             │
├─────────────────────────────────────────┤
│  Provider Header                       │
│  ┌─────────────────────────────────┐   │
│  │ Photo | Name, Title              │   │
│  │       | Rating, Reviews          │   │
│  │       | Verified Badge           │   │
│  │       | [Book Now] [Message]    │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  Tab Navigation                        │
│  About | Services | Reviews | Gallery  │
├─────────────────────────────────────────┤
│                                         │
│  Tab Content Area                      │
│  - Dynamic based on selected tab       │
│                                         │
├─────────────────────────────────────────┤
│  Sticky Booking Widget (Mobile)        │
│  Price | [Book Now Button]             │
└─────────────────────────────────────────┘
```

### 4. Booking Flow (Multi-Step)

```
Step 1: Service Selection
┌─────────────────────────────────────────┐
│  Progress Bar (Step 1 of 4)            │
├─────────────────────────────────────────┤
│  Select Service                        │
│  ┌─────────────────────────────────┐   │
│  │ □ Photography ($150/hr)         │   │
│  │ □ Event Coverage ($500/event)   │   │
│  │ □ Portrait Session ($200)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Continue →]                          │
└─────────────────────────────────────────┘

Step 2: Date & Time
┌─────────────────────────────────────────┐
│  Progress Bar (Step 2 of 4)            │
├─────────────────────────────────────────┤
│  Select Date & Time                    │
│  ┌─────────────────────────────────┐   │
│  │ Calendar Widget                 │   │
│  │ Available Time Slots            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [← Back] [Continue →]                 │
└─────────────────────────────────────────┘

Step 3: Details
┌─────────────────────────────────────────┐
│  Progress Bar (Step 3 of 4)            │
├─────────────────────────────────────────┤
│  Booking Details                       │
│  ┌─────────────────────────────────┐   │
│  │ Location/Address                │   │
│  │ Special Requirements            │   │
│  │ Contact Information             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [← Back] [Continue →]                 │
└─────────────────────────────────────────┘

Step 4: Payment
┌─────────────────────────────────────────┐
│  Progress Bar (Step 4 of 4)            │
├─────────────────────────────────────────┤
│  Review & Pay                          │
│  ┌─────────────────────────────────┐   │
│  │ Booking Summary                 │   │
│  │ Price Breakdown                 │   │
│  │ Payment Method (Stripe)         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [← Back] [Confirm & Pay $330]         │
└─────────────────────────────────────────┘
```

### 5. Customer Dashboard

```
┌─────────────────────────────────────────┐
│  Navigation                             │
├─────────────────────────────────────────┤
│  Dashboard Header                      │
│  Welcome back, Sarah!                  │
├──────┬──────────────────────────────────┤
│      │                                  │
│ Side │  Main Content Area               │
│ Nav  │  ┌────────────────────────────┐  │
│      │  │ Upcoming Bookings          │  │
│ Home │  │ - Card 1 (Tomorrow)       │  │
│ Book │  │ - Card 2 (Next Week)      │  │
│ Past │  └────────────────────────────┘  │
│ Rev. │                                  │
│ Set. │  ┌────────────────────────────┐  │
│      │  │ Recent Activity            │  │
│      │  │ - Timeline of actions      │  │
│      │  └────────────────────────────┘  │
│      │                                  │
└──────┴──────────────────────────────────┘
```

---

## Mobile Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
sm: 640px   /* Large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile-Specific Patterns

#### 1. Bottom Navigation (Mobile Only)
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 lg:hidden z-50">
  <div className="grid grid-cols-5 gap-1">
    <button className="flex flex-col items-center py-2 text-neutral-600">
      <Home className="w-5 h-5" />
      <span className="text-xs mt-1">Home</span>
    </button>
    <button className="flex flex-col items-center py-2 text-neutral-600">
      <Search className="w-5 h-5" />
      <span className="text-xs mt-1">Search</span>
    </button>
    <button className="flex flex-col items-center py-2 text-primary-600">
      <Plus className="w-5 h-5" />
      <span className="text-xs mt-1">Book</span>
    </button>
    <button className="flex flex-col items-center py-2 text-neutral-600">
      <Calendar className="w-5 h-5" />
      <span className="text-xs mt-1">Bookings</span>
    </button>
    <button className="flex flex-col items-center py-2 text-neutral-600">
      <User className="w-5 h-5" />
      <span className="text-xs mt-1">Profile</span>
    </button>
  </div>
</nav>
```

#### 2. Swipeable Cards (Touch Gestures)
```tsx
<div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide">
  <div className="flex gap-4 px-4">
    {providers.map(provider => (
      <div key={provider.id} className="snap-center flex-shrink-0 w-[280px]">
        <ProviderCard {...provider} />
      </div>
    ))}
  </div>
</div>
```

#### 3. Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Cards automatically reflow based on screen size */}
</div>
```

---

## Accessibility (WCAG AA)

### Color Contrast Requirements
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Interactive elements: 3:1 minimum
- Focus indicators: 3:1 minimum

### Keyboard Navigation
```css
/* Focus States */
.focus-visible:focus {
  outline: 2px solid #0066FF;
  outline-offset: 2px;
}

/* Skip to Content */
.skip-to-content {
  position: absolute;
  left: -999px;
  z-index: 999;
}

.skip-to-content:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 1rem;
}
```

### Touch Targets
- Minimum size: 44x44px
- Spacing between targets: 8px minimum

### Screen Reader Support
```tsx
{/* Proper ARIA labels */}
<button aria-label="Book photography service with John">
  Book Now
</button>

{/* Status announcements */}
<div role="status" aria-live="polite">
  Booking confirmed!
</div>

{/* Form validation */}
<input 
  aria-invalid={errors.email ? "true" : "false"}
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  {errors.email}
</span>
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## User Flows

### 1. Customer Booking Flow
```
Start → Search Providers → View Profile → Select Service → Choose Date/Time → Enter Details → Payment → Confirmation
         ↓                  ↓              ↓                ↓                 ↓              ↓
      [Filter]          [Reviews]     [Compare]      [Calendar]        [Save Info]    [Cancel]
```

### 2. Provider Onboarding Flow
```
Sign Up → Verify Email → Profile Setup → Service Setup → Pricing → Availability → Bank Details → Review → Live
           ↓              ↓               ↓              ↓           ↓               ↓            ↓
        [Resend]      [Photo Upload]  [Categories]   [Packages]  [Calendar]    [Stripe Connect] [Edit]
```

### 3. Guest Checkout Flow
```
Select Service → Date/Time → Guest Details → Payment (+10% fee) → Email Confirmation
                    ↓            ↓              ↓
                [Login]    [Create Account] [Save Card]
```

---

## Implementation Guidelines

### 1. Component Architecture
```tsx
// Use composition for flexibility
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Dynamic content */}
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### 2. State Management Pattern
```tsx
// Zustand store for complex state
const useBookingStore = create((set) => ({
  service: null,
  date: null,
  time: null,
  setService: (service) => set({ service }),
  setDateTime: (date, time) => set({ date, time }),
  reset: () => set({ service: null, date: null, time: null })
}));
```

### 3. Loading States
```tsx
// Skeleton loaders for better UX
const ProviderCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-48 bg-neutral-200 rounded-t-xl" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-neutral-200 rounded w-3/4" />
      <div className="h-4 bg-neutral-200 rounded w-1/2" />
      <div className="h-10 bg-neutral-200 rounded" />
    </div>
  </div>
);
```

### 4. Error States
```tsx
const ErrorState = ({ message, onRetry }) => (
  <div className="text-center py-12">
    <AlertCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">
      Something went wrong
    </h3>
    <p className="text-neutral-600 mb-4">{message}</p>
    <Button onClick={onRetry}>Try Again</Button>
  </div>
);
```

### 5. Empty States
```tsx
const EmptyState = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <Search className="w-8 h-8 text-neutral-400" />
    </div>
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">
      No results found
    </h3>
    <p className="text-neutral-600 mb-4">
      Try adjusting your filters or search criteria
    </p>
    <Button variant="outline">Clear Filters</Button>
  </div>
);
```

### 6. Responsive Utilities
```tsx
// Use Tailwind's responsive prefixes
<div className="
  grid 
  grid-cols-1      // Mobile: 1 column
  sm:grid-cols-2   // Tablet: 2 columns
  lg:grid-cols-3   // Desktop: 3 columns
  xl:grid-cols-4   // Large: 4 columns
  gap-4 sm:gap-6 lg:gap-8
">
```

### 7. Performance Optimization
```tsx
// Lazy load images
<Image
  src={provider.image}
  alt={provider.name}
  loading="lazy"
  className="w-full h-48 object-cover"
/>

// Code splitting
const BookingModal = lazy(() => import('./BookingModal'));

// Memoization for expensive components
const ProviderList = memo(({ providers }) => {
  // Component logic
});
```

---

## Component Library Integration

### Using with Shadcn UI
```bash
# Install required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add toast
```

### Custom Theme Variables
```css
/* Update app/globals.css */
@layer base {
  :root {
    /* Update existing variables */
    --primary: 214 100% 50%; /* #0066FF */
    --primary-foreground: 0 0% 100%;
    
    /* Add new semantic variables */
    --success: 160 84% 39%; /* #10B981 */
    --success-foreground: 0 0% 100%;
    
    --premium: 258 51% 51%; /* #6B46C1 */
    --premium-foreground: 0 0% 100%;
  }
}
```

---

## Testing & Quality Assurance

### Visual Regression Testing
- Test all components at each breakpoint
- Verify hover/focus states
- Check loading and error states
- Validate dark mode (if implemented)

### Accessibility Testing
- Keyboard navigation flow
- Screen reader compatibility
- Color contrast validation
- Touch target sizing

### Performance Metrics
- First Contentful Paint < 1.5s
- Time to Interactive < 3.5s
- Cumulative Layout Shift < 0.1
- Largest Contentful Paint < 2.5s

---

## Version History
- v1.0.0 - Initial design system release
- Last Updated: 2025-08-23
- Author: ECOSYSTEM Design Team

---

## Resources
- [Figma Design Files](#) (Link to be added)
- [Component Storybook](#) (Link to be added)
- [Brand Guidelines](#) (Link to be added)