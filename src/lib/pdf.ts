/**
 * Client-side PDF export for invoices (jsPDF + jspdf-autotable).
 * Loaded lazily via dynamic import so it never bloats the main bundle.
 */
import { pdfMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { InvoiceDto, WorkspaceDto } from '@/lib/types';

export interface InvoicePdfData {
  invoice: InvoiceDto;
  workspace: WorkspaceDto;
}

const PAGE_MARGIN = 40;
const BRAND_DARK: [number, number, number] = [24, 24, 27];
const BRAND_MUTED: [number, number, number] = [113, 113, 122];

export async function downloadInvoicePdf({ invoice, workspace }: InvoicePdfData): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  // ------------------------------------------------------------------ header
  if (workspace.logoText) {
    doc.setFillColor(...BRAND_DARK);
    doc.roundedRect(PAGE_MARGIN, PAGE_MARGIN, 42, 42, 6, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(workspace.logoText.slice(0, 3).toUpperCase(), PAGE_MARGIN + 21, PAGE_MARGIN + 27, {
      align: 'center',
    });
  }

  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(workspace.name || 'InvoiceFlow', PAGE_MARGIN + (workspace.logoText ? 54 : 0), PAGE_MARGIN + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  doc.text('Powered by InvoiceFlow', PAGE_MARGIN + (workspace.logoText ? 54 : 0), PAGE_MARGIN + 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_DARK);
  doc.text('INVOICE', pageWidth - PAGE_MARGIN, PAGE_MARGIN + 14, { align: 'right' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.number, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 32, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(`Status: ${invoice.status}`, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 46, { align: 'right' });

  // ---------------------------------------------------------------- bill to
  let y = PAGE_MARGIN + 86;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  doc.text('BILL TO', PAGE_MARGIN, y);
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text(invoice.client.name, PAGE_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  const clientLines = [
    invoice.client.company ?? '',
    invoice.client.address ?? '',
    invoice.client.email ?? '',
    invoice.client.taxNumber ? `Tax ID: ${invoice.client.taxNumber}` : '',
  ].filter(Boolean);
  clientLines.forEach((line, i) => {
    doc.text(line, PAGE_MARGIN, y + 13 + i * 12);
  });

  // ----------------------------------------------------------------- meta
  const metaRows: [string, string][] = [
    ['Issue date', formatDate(invoice.issueDate)],
    ['Due date', formatDate(invoice.dueDate)],
    ['Currency', invoice.currency],
  ];
  doc.setFontSize(9);
  metaRows.forEach(([label, value], i) => {
    const rowY = y + i * 13;
    doc.setTextColor(...BRAND_MUTED);
    doc.text(label, pageWidth - PAGE_MARGIN - 90, rowY, { align: 'left' });
    doc.setTextColor(...BRAND_DARK);
    doc.text(value, pageWidth - PAGE_MARGIN, rowY, { align: 'right' });
  });

  // -------------------------------------------------------------- line items
  autoTable(doc, {
    startY: Math.max(y + 13 + clientLines.length * 12 + 18, 220),
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: invoice.items.map((item) => [
      item.description,
      String(item.quantity),
      pdfMoney(item.unitPriceCents, invoice.currency),
      pdfMoney(Math.round(item.quantity * item.unitPriceCents), invoice.currency),
    ]),
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: BRAND_DARK },
    headStyles: { fillColor: BRAND_DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 247] },
    columnStyles: {
      0: { cellWidth: contentWidth - 220 },
      1: { cellWidth: 50, halign: 'right' },
      2: { cellWidth: 85, halign: 'right' },
      3: { cellWidth: 85, halign: 'right' },
    },
  });

  type WithAutoTable = { lastAutoTable?: { finalY: number } };
  let totalsY = ((doc as unknown as WithAutoTable).lastAutoTable?.finalY ?? 300) + 20;

  // ---------------------------------------------------------------- totals
  const discountLabel =
    invoice.discountType === 'PERCENT'
      ? `Discount (${invoice.discountValue}%)`
      : invoice.discountType === 'FIXED'
        ? 'Discount'
        : null;
  const totals: [string, string, boolean][] = [
    ['Subtotal', pdfMoney(invoice.subtotalCents, invoice.currency), false],
    ...(discountLabel ? ([[discountLabel, `-${pdfMoney(invoice.discountCents, invoice.currency)}`, false]] as [string, string, boolean][]) : []),
    [`Tax (${invoice.taxRate}%)`, pdfMoney(invoice.taxCents, invoice.currency), false],
    ['Total', pdfMoney(invoice.totalCents, invoice.currency), true],
    ['Paid', `-${pdfMoney(invoice.paidCents, invoice.currency)}`, false],
    ['Balance due', pdfMoney(Math.max(0, invoice.totalCents - invoice.paidCents), invoice.currency), true],
  ];
  totals.forEach(([label, value, strong]) => {
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setFontSize(strong ? 10 : 9);
    doc.setTextColor(...(strong ? BRAND_DARK : BRAND_MUTED));
    doc.text(label, pageWidth - PAGE_MARGIN - 110, totalsY, { align: 'left' });
    doc.setTextColor(...BRAND_DARK);
    doc.text(value, pageWidth - PAGE_MARGIN, totalsY, { align: 'right' });
    totalsY += strong ? 16 : 13;
  });

  // ----------------------------------------------------------------- notes
  const notes: string[] = [];
  if (invoice.notes) notes.push(invoice.notes);
  if (workspace.footerNote) notes.push(workspace.footerNote);
  if (notes.length > 0) {
    totalsY += 14;
    doc.setDrawColor(230, 230, 232);
    doc.line(PAGE_MARGIN, totalsY - 8, pageWidth - PAGE_MARGIN, totalsY - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(doc.splitTextToSize(notes.join('\n'), contentWidth), PAGE_MARGIN, totalsY + 6);
  }

  // ---------------------------------------------------------------- footer
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(
      `${invoice.number} - generated by InvoiceFlow`,
      PAGE_MARGIN,
      doc.internal.pageSize.getHeight() - 24
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, doc.internal.pageSize.getHeight() - 24, {
      align: 'right',
    });
  }

  doc.save(`${invoice.number}.pdf`);
}
