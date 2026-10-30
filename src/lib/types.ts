/** Shared DTO types for the InvoiceFlow frontend (all money values in cents). */

export type Role = 'OWNER' | 'MEMBER';
export type Plan = 'FREE' | 'PRO';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
export type DiscountType = 'NONE' | 'PERCENT' | 'FIXED';
export type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountId: string;
}

export interface AccountDto {
  id: string;
  name: string;
  plan: Plan;
  logoText: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  footerNote: string;
}

export interface MeDto {
  user: UserDto;
  account: AccountDto;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface ClientDto {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  address: string | null;
  taxNumber: string | null;
  archived: boolean;
  createdAt: string;
  _count?: { invoices: number };
}

export interface ClientListDto {
  items: ClientDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}

export interface PaymentDto {
  id: string;
  amountCents: number;
  paidAt: string;
  method: PaymentMethod;
  note: string | null;
  createdAt: string;
}

export interface ClientRefDto {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  address?: string | null;
  taxNumber?: string | null;
}

export interface InvoiceDto {
  id: string;
  accountId: string;
  clientId: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  notes: string | null;
  publicToken: string;
  sentAt: string | null;
  createdAt: string;
  client: ClientRefDto;
  items: InvoiceItemDto[];
  payments: PaymentDto[];
}

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  status: InvoiceStatus;
  totalCents: number;
  paidCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  createdAt: string;
  client: { id: string; name: string };
}

export interface InvoiceListDto {
  items: InvoiceSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkspaceDto {
  name: string;
  logoText: string;
  footerNote: string;
}

export interface InvoiceDetailDto {
  invoice: InvoiceDto;
  workspace: WorkspaceDto;
}

export interface PublicInvoiceDto {
  invoice: Omit<InvoiceDto, 'payments' | 'accountId'>;
  workspace: WorkspaceDto;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardDto {
  monthlyRevenue: { month: string; totalCents: number }[];
  outstandingCents: number;
  overdueCents: number;
  paidThisMonthCents: number;
  activeClients: number;
  invoicesThisMonth: number;
  topClients: { clientId: string; name: string; totalCents: number }[];
  recentInvoices: {
    id: string;
    number: string;
    status: InvoiceStatus;
    clientName: string;
    totalCents: number;
    paidCents: number;
    currency: string;
    issueDate: string;
    dueDate: string;
  }[];
  plan: Plan;
}

// ---------------------------------------------------------------------------
// Team / settings / billing
// ---------------------------------------------------------------------------

export interface TeamMemberDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface SettingsDto {
  id: string;
  name: string;
  logoText: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  footerNote: string;
  plan: Plan;
}

export interface BillingDto {
  plan: Plan;
  subscriptionStatus: string | null;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  usage: {
    activeClients: number;
    maxActiveClients: number | null;
    invoicesThisMonth: number;
    maxInvoicesPerMonth: number | null;
  };
}
