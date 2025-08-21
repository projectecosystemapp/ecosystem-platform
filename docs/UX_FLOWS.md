# User Experience Flows

## Customer Journey: Discover → Evaluate → Book → Review

### Happy Path: Successful Booking

```mermaid
sequenceDiagram
    participant C as Customer
    participant W as Website
    participant DB as Database
    participant S as Stripe
    participant E as Email Service
    participant P as Provider

    Note over C,P: DISCOVER PHASE
    C->>W: Visit homepage
    W->>C: Show hero, search bar, categories
    C->>W: Search "photography in Austin"
    W->>DB: Query providers (filters: service=photography, location=Austin)
    DB->>W: Return matching providers
    W->>C: Display search results grid
    C->>W: Apply filters (price < $200/hr, 4+ stars)
    W->>DB: Refine query with filters
    DB->>W: Return filtered results
    W->>C: Update results instantly

    Note over C,P: EVALUATE PHASE
    C->>W: Click on provider card
    W->>DB: Fetch full provider profile
    DB->>W: Return profile data, reviews, gallery
    W->>C: Display provider profile page
    C->>W: View gallery images
    W->>C: Lazy load images
    C->>W: Read reviews section
    W->>DB: Fetch paginated reviews
    DB->>W: Return reviews with ratings
    W->>C: Display reviews
    C->>W: Check availability preview
    W->>DB: Query availability for next 7 days
    DB->>W: Return available slots
    W->>C: Show availability indicator

    Note over C,P: BOOK PHASE
    C->>W: Click "Book Now" button
    W->>C: Open booking modal
    C->>W: Select service type
    W->>C: Update pricing display
    C->>W: Select date from calendar
    W->>DB: Query available times for date
    DB->>W: Return available time slots
    W->>C: Display time slots
    C->>W: Select 2:00 PM slot
    W->>C: Show booking summary
    C->>W: Proceed to checkout
    W->>C: Redirect to Stripe checkout
    C->>S: Enter payment details
    S->>S: Validate card
    S->>W: Payment successful webhook
    W->>DB: Create booking record
    W->>DB: Block availability slot
    W->>E: Trigger confirmation emails
    E->>C: Send booking confirmation
    E->>P: Send new booking notification
    W->>C: Show success page

    Note over C,P: SERVICE DELIVERY
    Note over C,P: [Service happens on booking date]
    P->>W: Mark booking completed
    W->>DB: Update booking status

    Note over C,P: REVIEW PHASE
    E->>C: Send review request (24hrs later)
    C->>W: Click review link
    W->>C: Show review form
    C->>W: Rate 5 stars + write review
    W->>DB: Save review
    W->>P: Notify of new review
    W->>C: Show thank you message
```

### Failure Scenario: Payment Declined

```mermaid
sequenceDiagram
    participant C as Customer
    participant W as Website
    participant DB as Database
    participant S as Stripe
    participant A as Availability Service

    C->>W: Complete service selection
    C->>W: Select time slot
    W->>A: Reserve slot temporarily (10 min hold)
    A->>W: Slot reserved
    W->>C: Proceed to checkout
    C->>S: Enter payment details
    S->>S: Card validation fails
    S->>W: Payment declined
    W->>C: Show error message
    C->>W: Try different card
    C->>S: Enter new payment details
    S->>S: Card validation fails again
    S->>W: Payment declined
    W->>A: Release temporary hold
    A->>DB: Mark slot as available
    W->>C: Return to booking page
    C->>W: Try to select same slot
    W->>A: Check availability
    A->>W: Slot still available
    C->>W: Proceed with PayPal
    W->>S: Alternative payment method
    S->>W: Payment successful
    W->>DB: Create booking
    W->>A: Confirm slot reservation
    W->>C: Show success page
```

## Provider Journey: Onboard → Configure → Manage → Earn

### Happy Path: Provider Onboarding to First Booking

```mermaid
sequenceDiagram
    participant P as Provider
    participant W as Website
    participant DB as Database
    participant C as Clerk Auth
    participant S as Stripe
    participant V as Verification Service
    participant Cu as Customer

    Note over P,Cu: ONBOARD PHASE
    P->>W: Visit /become-a-provider
    W->>P: Show benefits, requirements
    P->>W: Click "Start Application"
    W->>C: Redirect to signup
    P->>C: Create account with email
    C->>P: Send verification email
    P->>C: Verify email
    C->>W: Return authenticated
    W->>P: Show onboarding flow
    
    P->>W: Step 1: Basic Information
    P->>W: Enter name, location, services
    W->>DB: Save provider draft
    
    P->>W: Step 2: Professional Details
    P->>W: Write bio, add experience
    W->>DB: Update provider draft
    
    P->>W: Step 3: Portfolio
    P->>W: Upload gallery images
    W->>DB: Store in Supabase Storage
    
    P->>W: Step 4: Verification
    P->>W: Upload ID, certifications
    W->>V: Submit for verification
    V->>V: Review documents
    V->>W: Approved
    W->>DB: Mark provider as verified
    
    P->>W: Step 5: Payment Setup
    W->>S: Start Stripe Connect flow
    P->>S: Complete Connect onboarding
    S->>W: Account connected
    W->>DB: Save Stripe account ID

    Note over P,Cu: CONFIGURE PHASE
    P->>W: Access provider dashboard
    W->>P: Show empty dashboard
    
    P->>W: Set service pricing
    P->>W: Add service descriptions
    W->>DB: Save service catalog
    
    P->>W: Configure availability
    P->>W: Set Mon-Fri 9am-5pm
    W->>DB: Save availability rules
    
    P->>W: Block vacation dates
    P->>W: Select Dec 24-31
    W->>DB: Save blocked dates
    
    P->>W: Add testimonials
    P->>W: Enter past client reviews
    W->>DB: Save testimonials
    
    P->>W: Preview profile
    W->>P: Show public profile view
    P->>W: Publish profile
    W->>DB: Mark profile as active
    W->>P: Profile is now live!

    Note over P,Cu: FIRST BOOKING
    Cu->>W: Discover provider
    Cu->>W: Book appointment
    W->>DB: Create booking
    W->>P: Send booking notification
    
    Note over P,Cu: MANAGE PHASE
    P->>W: View booking details
    W->>DB: Fetch booking info
    DB->>W: Return customer details
    W->>P: Display booking card
    
    P->>W: Send message to customer
    W->>Cu: Deliver message
    Cu->>W: Confirm appointment
    W->>P: Update confirmation

    Note over P,Cu: EARN PHASE
    Note over P,Cu: [Service delivered]
    
    P->>W: Mark service completed
    W->>DB: Update booking status
    W->>S: Trigger payout
    S->>S: Process transfer
    S->>P: Funds transferred (minus fee)
    
    Cu->>W: Leave 5-star review
    W->>DB: Save review
    W->>P: Notify of review
    P->>W: Respond to review
    W->>DB: Save response
    W->>P: Update dashboard metrics
```

### Failure Scenario: Verification Rejected

```mermaid
sequenceDiagram
    participant P as Provider
    participant W as Website
    participant V as Verification Service
    participant DB as Database
    participant E as Email Service

    P->>W: Complete basic profile
    P->>W: Upload verification docs
    W->>V: Submit for review
    V->>V: Review documents
    V->>V: Identify issues (blurry ID)
    V->>W: Rejection reason
    W->>DB: Mark verification failed
    W->>E: Send rejection email
    E->>P: Email with reasons
    
    P->>W: Access dashboard
    W->>P: Show verification alert
    P->>W: Click "Resubmit Documents"
    W->>P: Show requirements checklist
    P->>W: Upload clear ID photo
    W->>V: Resubmit for review
    V->>V: Review documents
    V->>V: Still missing proof of certification
    V->>W: Partial rejection
    W->>E: Send update email
    E->>P: Specific requirements needed
    
    P->>W: Upload certification
    W->>V: Submit additional doc
    V->>V: Review complete package
    V->>W: Approved
    W->>DB: Mark provider verified
    W->>E: Send approval email
    E->>P: Congrats, you're verified!
    W->>P: Update dashboard status
    P->>W: Continue to payment setup
```

## Booking State Transitions

```mermaid
stateDiagram-v2
    [*] --> Draft: Customer starts booking
    Draft --> Pending: Payment authorized
    Pending --> Confirmed: Provider accepts
    Pending --> Cancelled: Customer cancels
    Pending --> Expired: No provider response (24hr)
    Confirmed --> Completed: Service delivered
    Confirmed --> Cancelled: Cancellation (>24hr notice)
    Confirmed --> NoShow: Customer doesn't attend
    Completed --> Reviewed: Customer writes review
    Cancelled --> Refunded: Process refund
    NoShow --> Disputed: Customer disputes
    Disputed --> Resolved: Support resolution
    Reviewed --> [*]
    Refunded --> [*]
    Resolved --> [*]
    Expired --> [*]
```

## Review Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant W as Website
    participant DB as Database
    participant E as Email Service
    participant P as Provider

    Note over C,P: 24 hours after booking completion
    E->>C: "How was your experience?" email
    C->>W: Click review link
    W->>DB: Verify booking completed
    DB->>W: Booking eligible for review
    W->>C: Show review form
    C->>W: Select 5 stars
    C->>W: Write detailed review
    C->>W: Upload photos
    W->>DB: Save review
    W->>DB: Update provider rating
    W->>P: Notify of new review
    W->>C: Show thank you + discount code
    
    P->>W: Read review
    P->>W: Write public response
    W->>DB: Save response
    W->>C: Notify of provider response
    C->>W: Read provider response
    W->>C: Show in review section
```

## Search & Filter Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Search UI
    participant API as Search API
    participant DB as Database
    participant Cache as Redis Cache

    U->>UI: Type "yoga instructor"
    UI->>API: Autocomplete request
    API->>Cache: Check suggestions cache
    Cache->>API: Return cached suggestions
    API->>UI: Return suggestions
    UI->>U: Show dropdown suggestions
    
    U->>UI: Select "Yoga Instructor"
    U->>UI: Set location "Austin, TX"
    U->>UI: Set price range $50-100
    U->>UI: Set availability "Weekends"
    UI->>API: Search request with filters
    
    API->>Cache: Check results cache
    Cache->>API: Cache miss
    API->>DB: Complex query with filters
    DB->>DB: Execute search
    DB->>API: Return 47 providers
    API->>Cache: Store results (5 min TTL)
    API->>UI: Return paginated results
    
    UI->>U: Display results grid
    U->>UI: Change sort to "Price: Low to High"
    UI->>API: Re-sort request
    API->>Cache: Fetch cached results
    Cache->>API: Return cached data
    API->>API: Sort in memory
    API->>UI: Return sorted results
    UI->>U: Update display order
```

## Mobile App Booking Flow (Future)

```mermaid
sequenceDiagram
    participant M as Mobile App
    participant API as API Gateway
    participant Auth as Auth Service
    participant Book as Booking Service
    participant Pay as Payment Service
    participant Push as Push Notifications

    M->>API: Open app
    API->>Auth: Validate token
    Auth->>API: Token valid
    API->>M: Load home screen
    
    M->>API: Get nearby providers
    API->>M: Return geo-filtered results
    M->>M: Show on map view
    
    M->>API: Select provider
    API->>M: Return profile + availability
    M->>M: Show native calendar
    
    M->>API: Select time slot
    API->>Book: Reserve slot (10 min)
    Book->>API: Reservation ID
    API->>M: Proceed to payment
    
    M->>M: Use FaceID for saved card
    M->>Pay: Process payment
    Pay->>API: Payment successful
    API->>Book: Confirm booking
    Book->>Push: Send confirmations
    Push->>M: Push notification
    M->>M: Add to device calendar
```