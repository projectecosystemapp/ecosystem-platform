/**
 * ECOSYSTEM Design System v1.0
 * Premium marketplace design system for Series A investment standards
 * 
 * Design Principles:
 * 1. Trust & Credibility - Every element should reinforce trust
 * 2. Clarity & Simplicity - Reduce cognitive load at every step
 * 3. Premium Feel - Sophisticated without being intimidating
 * 4. Mobile-First - Touch-friendly and responsive
 * 5. Accessibility - WCAG AA compliant
 */

// ========================================
// COLOR SYSTEM
// ========================================

export const colors = {
  // Brand Colors - Professional blue with trust signals
  brand: {
    primary: '#0066FF', // Trust blue - main CTA color
    primaryDark: '#0052CC', // Hover state
    primaryLight: '#4D94FF', // Lighter variant
    primarySoft: '#E6F0FF', // Background tint
    
    secondary: '#6B46C1', // Premium purple accent
    secondaryDark: '#553C9A', 
    secondaryLight: '#9F7AEA',
    secondarySoft: '#F3EBFE',
    
    accent: '#10B981', // Success green - trust signal
    accentDark: '#059669',
    accentLight: '#34D399',
    accentSoft: '#D1FAE5',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
  },
  
  // Neutral Palette - Sophisticated grays
  neutral: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
  
  // UI States
  ui: {
    background: '#FFFFFF',
    backgroundSecondary: '#FAFAFA',
    backgroundTertiary: '#F4F4F5',
    border: '#E4E4E7',
    borderHover: '#D4D4D8',
    borderFocus: '#0066FF',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
};

// ========================================
// TYPOGRAPHY SYSTEM
// ========================================

export const typography = {
  // Font Families
  fonts: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'Clash Display, Inter, sans-serif', // For headings
    mono: 'JetBrains Mono, Consolas, monospace',
  },
  
  // Font Sizes - Mobile first with desktop overrides
  sizes: {
    xs: { mobile: '0.75rem', desktop: '0.75rem' },    // 12px
    sm: { mobile: '0.875rem', desktop: '0.875rem' },  // 14px
    base: { mobile: '1rem', desktop: '1rem' },        // 16px
    lg: { mobile: '1.125rem', desktop: '1.125rem' },  // 18px
    xl: { mobile: '1.25rem', desktop: '1.25rem' },    // 20px
    '2xl': { mobile: '1.5rem', desktop: '1.5rem' },   // 24px
    '3xl': { mobile: '1.875rem', desktop: '2rem' },   // 30px/32px
    '4xl': { mobile: '2.25rem', desktop: '2.5rem' },  // 36px/40px
    '5xl': { mobile: '3rem', desktop: '3.5rem' },     // 48px/56px
    '6xl': { mobile: '3.75rem', desktop: '4.5rem' },  // 60px/72px
  },
  
  // Line Heights
  lineHeights: {
    tight: '1.2',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '1.75',
  },
  
  // Font Weights
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.01em',
    wider: '0.02em',
  },
};

// ========================================
// SPACING SYSTEM
// ========================================

export const spacing = {
  // Base unit: 4px
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  7: '1.75rem',   // 28px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  14: '3.5rem',   // 56px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
  40: '10rem',    // 160px
  48: '12rem',    // 192px
  56: '14rem',    // 224px
  64: '16rem',    // 256px
  
  // Container max-widths
  container: {
    xs: '20rem',    // 320px
    sm: '24rem',    // 384px
    md: '28rem',    // 448px
    lg: '32rem',    // 512px
    xl: '36rem',    // 576px
    '2xl': '42rem', // 672px
    '3xl': '48rem', // 768px
    '4xl': '56rem', // 896px
    '5xl': '64rem', // 1024px
    '6xl': '72rem', // 1152px
    '7xl': '80rem', // 1280px
  },
};

// ========================================
// BORDER RADIUS
// ========================================

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px - subtle rounding
  base: '0.5rem',  // 8px - default for cards, buttons
  md: '0.75rem',   // 12px - medium components
  lg: '1rem',      // 16px - large components
  xl: '1.5rem',    // 24px - hero sections
  '2xl': '2rem',   // 32px - extra large
  full: '9999px',  // Pills, avatars
};

// ========================================
// SHADOWS
// ========================================

export const shadows = {
  // Elevation levels
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Colored shadows for brand elements
  brand: '0 10px 40px -10px rgba(0, 102, 255, 0.35)',
  success: '0 10px 40px -10px rgba(16, 185, 129, 0.35)',
  
  // Inset shadows
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
};

// ========================================
// ANIMATIONS
// ========================================

export const animations = {
  // Durations
  duration: {
    instant: '100ms',
    fast: '200ms',
    normal: '300ms',
    slow: '400ms',
    slower: '600ms',
  },
  
  // Easing functions
  easing: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  
  // Common transitions
  transitions: {
    all: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    colors: 'background-color, border-color, color, fill, stroke 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    shadow: 'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ========================================
// BREAKPOINTS
// ========================================

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ========================================
// Z-INDEX SCALE
// ========================================

export const zIndex = {
  negative: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
  notification: 70,
};

// ========================================
// COMPONENT SPECIFICATIONS
// ========================================

export const components = {
  // Buttons
  button: {
    heights: {
      sm: '32px',
      md: '40px',
      lg: '48px',
      xl: '56px',
    },
    padding: {
      sm: '0 12px',
      md: '0 16px',
      lg: '0 24px',
      xl: '0 32px',
    },
    iconSize: {
      sm: '16px',
      md: '20px',
      lg: '24px',
      xl: '28px',
    },
  },
  
  // Form inputs
  input: {
    heights: {
      sm: '32px',
      md: '40px',
      lg: '48px',
    },
    padding: '0 12px',
    borderWidth: '1px',
    focusRingWidth: '2px',
  },
  
  // Cards
  card: {
    padding: {
      sm: '16px',
      md: '24px',
      lg: '32px',
    },
    borderWidth: '1px',
  },
  
  // Modals
  modal: {
    sizes: {
      sm: '400px',
      md: '600px',
      lg: '800px',
      xl: '1000px',
      full: '95vw',
    },
    padding: '24px',
  },
  
  // Navigation
  nav: {
    height: {
      mobile: '64px',
      desktop: '72px',
    },
    logoSize: {
      mobile: '32px',
      desktop: '40px',
    },
  },
  
  // Avatar sizes
  avatar: {
    xs: '24px',
    sm: '32px',
    md: '40px',
    lg: '48px',
    xl: '64px',
    '2xl': '80px',
  },
};

// ========================================
// GRID SYSTEM
// ========================================

export const grid = {
  columns: 12,
  gap: {
    sm: '16px',
    md: '24px',
    lg: '32px',
  },
  margin: {
    mobile: '16px',
    tablet: '24px',
    desktop: '32px',
  },
};

// ========================================
// ACCESSIBILITY
// ========================================

export const accessibility = {
  // Focus styles
  focus: {
    outline: `2px solid ${colors.brand.primary}`,
    outlineOffset: '2px',
  },
  
  // Minimum touch target size
  minTouchTarget: '44px',
  
  // Color contrast ratios (WCAG AA)
  contrast: {
    normal: 4.5,  // Normal text
    large: 3,     // Large text (18px+ or 14px+ bold)
  },
  
  // Animation preferences
  reducedMotion: {
    transition: 'none',
    animation: 'none',
  },
};

// ========================================
// RESPONSIVE UTILITIES
// ========================================

export const responsive = {
  // Hide/Show utilities
  hide: {
    mobile: '@media (max-width: 767px)',
    tablet: '@media (min-width: 768px) and (max-width: 1023px)',
    desktop: '@media (min-width: 1024px)',
  },
  
  // Container queries
  container: {
    sm: '@container (min-width: 640px)',
    md: '@container (min-width: 768px)',
    lg: '@container (min-width: 1024px)',
  },
};