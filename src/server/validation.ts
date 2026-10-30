import { z } from 'zod';

/**
 * All request validation lives here (Zod). The server never trusts the
 * client: every API route parses its input through one of these schemas.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailField = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .refine((v) => EMAIL_RE.test(v), { message: 'Enter a valid email address' });

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

/**
 * Optional text field.
 * - ''            -> null (explicitly cleared)
 * - undefined     -> undefined (field not provided; Prisma skips it on update)
 */
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t === '' ? null : t;
    });

/** Optional email field: '' -> null, lowercased, validated when present. */
const optionalEmail = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v.trim().toLowerCase();
    return t === '' ? null : t;
  })
  .refine((v) => v === undefined || v === null || EMAIL_RE.test(v), { message: 'Enter a valid email address' });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  workspaceName: z.string().trim().min(1, 'Workspace name is required').max(80),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  email: emailField,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(120),
  email: optionalEmail,
  company: optionalText(160),
  address: optionalText(500),
  taxNumber: optionalText(60),
});

/** Update accepts partial payloads (e.g. archive-only PATCHes). */
export const clientUpdateSchema = clientCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});
export const clientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  archived: z.enum(['true', 'false', 'all']).default('false'),
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD date format');

export const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code (e.g. USD)');

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be greater than 0').max(1_000_000),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').max(10_000_000),
});

export const discountTypeEnum = z.enum(['NONE', 'PERCENT', 'FIXED']);

export const invoiceCreateSchema = z
  .object({
    clientId: z.string().min(1, 'Select a client'),
    issueDate: dateString,
    dueDate: dateString,
    currency: currencyField,
    taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100).default(0),
    discountType: discountTypeEnum.default('NONE'),
    discountValue: z.number().min(0, 'Discount cannot be negative').max(1_000_000).default(0),
    notes: z
      .string()
      .max(2000)
      .optional()
      .transform((v) => (v ?? '').trim() || null),
    items: z.array(invoiceItemSchema).min(1, 'Add at least one line item'),
  })
  .refine((data) => data.discountType !== 'PERCENT' || data.discountValue <= 100, {
    message: 'A percent discount must be between 0 and 100',
    path: ['discountValue'],
  })
  .refine((data) => data.dueDate >= data.issueDate, {
    message: 'Due date must be on or after the issue date',
    path: ['dueDate'],
  });

export const invoiceUpdateSchema = invoiceCreateSchema;

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID', 'UNPAID']).optional(),
  clientId: z.string().trim().optional(),
});

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']),
});

export const paymentMethodEnum = z.enum(['CARD', 'BANK_TRANSFER', 'CASH', 'OTHER']);

export const paymentCreateSchema = z.object({
  amountCents: z
    .number()
    .int('Amount must be a whole number of cents')
    .positive('Amount must be greater than 0')
    .max(1_000_000_000_0),
  paidAt: dateString,
  method: paymentMethodEnum,
  note: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ?? '').trim() || null),
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const inviteMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: emailField,
  password: passwordSchema,
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const settingsUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80),
  logoText: z.string().trim().max(8, 'Logo text is at most 8 characters'),
  defaultCurrency: currencyField,
  defaultTaxRate: z.number().min(0, 'Tax rate cannot be negative').max(100),
  footerNote: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ?? '').trim()),
});

// ---------------------------------------------------------------------------
// Public + cron
// ---------------------------------------------------------------------------

export const publicTokenSchema = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid invoice link');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
