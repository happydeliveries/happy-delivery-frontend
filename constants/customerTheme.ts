/**
 * Happy Deliveries Customer Visual Identity
 * Warm paper backdrops (#F4F3EF), matte organic black ink/borders (#1C1B1F),
 * and original welcome-screen golden yellow CTA highlights (#FFCC00).
 *
 * Scoped strictly to customer screens and customer components.
 */

export const CUSTOMER_THEME = {
  // Core Paper Surfaces
  bg: '#F4F3EF',            // Textured Natural Off-White (app-wide backdrop & primary card fill)
  surface: '#F4F3EF',       // Card & modal sheet background
  surfaceRaised: '#ECEAE2', // Warm recessed paper for inputs, chips & placeholders
  surfaceWarm: '#FFF6CC',   // Soft butter paper tint for active callout cards

  // Primary Typography & Organic Ink Strokes
  ink: '#1C1B1F',           // Matte organic black (headings, text, line icons, card borders)
  inkMuted: '#5C5852',      // Warm charcoal for body & secondary labels
  inkSoft: '#7D786F',       // Warm stone for subtle hints & inactive icons

  // Borders & Playful Rounded Strokes
  border: '#1C1B1F',        // Matte black border matching scooter stroke weight
  borderSoft: '#D6D1C6',    // Subtle warm paper divider
  strokeWidth: 1.75,
  strokeWidthBold: 2,

  // Accent / CTA Color (original Welcome screen yellow)
  accent: '#FFCC00',        // Primary action buttons, badges, driver/highlight markers
  accentPressed: '#E6B800',
  accentSoft: '#FFF0A6',

  // Organic Muted Status Tints (zero digital blues or harsh neon)
  successInk: '#255F38',
  successBg: '#DCEBDC',
  warningInk: '#6B4E00',
  warningBg: '#FFF0A6',
  dangerInk: '#9F2B1E',
  dangerBg: '#F9DFDA',
  infoInk: '#1C1B1F',
  infoBg: '#FFF0A6',

  // Crisp paper lift shadow
  cardShadow: {
    shadowColor: '#1C1B1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export const CUSTOMER_CTA_BUTTON = {
  backgroundColor: CUSTOMER_THEME.accent,
  borderWidth: CUSTOMER_THEME.strokeWidthBold,
  borderColor: CUSTOMER_THEME.ink,
  borderRadius: 24,
} as const;

export const CUSTOMER_CTA_TEXT = {
  color: CUSTOMER_THEME.ink,
  fontWeight: '800' as const,
} as const;

export const CUSTOMER_OUTLINE_BUTTON = {
  backgroundColor: CUSTOMER_THEME.bg,
  borderWidth: CUSTOMER_THEME.strokeWidthBold,
  borderColor: CUSTOMER_THEME.ink,
  borderRadius: 24,
} as const;

export function getCustomerOrderStatusColors(status: string, paymentStatus?: string) {
  switch (status) {
    case 'delivered':
      return { ink: CUSTOMER_THEME.successInk, bg: CUSTOMER_THEME.successBg };
    case 'cancelled':
    case 'no_drivers_available':
    case 'delivery_failed':
      return { ink: CUSTOMER_THEME.dangerInk, bg: CUSTOMER_THEME.dangerBg };
    case 'pending':
      return { ink: CUSTOMER_THEME.ink, bg: CUSTOMER_THEME.surfaceWarm };
    case 'ordering_at_restaurant':
      return paymentStatus === 'completed'
        ? { ink: CUSTOMER_THEME.ink, bg: CUSTOMER_THEME.accent }
        : { ink: CUSTOMER_THEME.ink, bg: CUSTOMER_THEME.accentSoft };
    case 'accepted_by_driver':
    case 'picked_up':
    case 'on_the_way':
    case 'arrived':
      return { ink: CUSTOMER_THEME.ink, bg: CUSTOMER_THEME.accent };
    default:
      return { ink: CUSTOMER_THEME.ink, bg: CUSTOMER_THEME.surfaceRaised };
  }
}
