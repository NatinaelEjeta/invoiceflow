/** Shared client-side constants. */

export const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'AED', label: 'AED — UAE Dirham' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const DEMO_ACCOUNTS = [
  {
    label: 'Owner (PRO workspace)',
    email: 'owner@invoiceflow.demo',
    password: 'Owner123!',
    description: 'Acme Studio — full access, PRO plan',
  },
  {
    label: 'Member (PRO workspace)',
    email: 'member@invoiceflow.demo',
    password: 'Member123!',
    description: 'Acme Studio — clients & invoices only',
  },
  {
    label: 'Owner (FREE workspace)',
    email: 'free@invoiceflow.demo',
    password: 'Free123!',
    description: 'Bright Freelance — near plan limits',
  },
] as const;

export const DEMO_EMAIL_SUFFIX = '@invoiceflow.demo';
