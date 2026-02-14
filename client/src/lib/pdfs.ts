import { apiRequest, getToken } from "@/lib/auth";
import { parseApiError } from "@/lib/api-errors";

export type PdfTemplateKey = "CLASSIC" | "MODERN" | "MINIMAL" | "INVOICE_B";
export type PdfPageSize = "A4" | "LETTER";
export type PdfOrientation = "portrait" | "landscape";
export type PdfDocumentType = "PRICE_LIST" | "INVOICE_B";
export type PdfColumnKey = "name" | "sku" | "description" | "price" | "stock_total" | "branch_stock";
export type InvoiceColumnKey = "code" | "quantity" | "product" | "price" | "discount" | "total";

export interface PdfStyles {
  fontSize?: number;
  headerSize?: number;
  subheaderSize?: number;
  tableHeaderSize?: number;
  rowHeight?: number;
}

export interface PdfSettings {
  documentType: PdfDocumentType;
  templateKey: PdfTemplateKey;
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  showLogo: boolean;
  headerText?: string | null;
  subheaderText?: string | null;
  footerText?: string | null;
  showBranchStock: boolean;
  showSku: boolean;
  showDescription: boolean;
  priceColumnLabel: string;
  currencySymbol: string;
  columns: PdfColumnKey[];
  invoiceColumns: InvoiceColumnKey[];
  documentTitle?: string | null;
  fiscalName?: string | null;
  fiscalCuit?: string | null;
  fiscalIibb?: string | null;
  fiscalAddress?: string | null;
  fiscalCity?: string | null;
  showFooterTotals?: boolean;
  styles: PdfStyles;
  updatedAt?: string;
}

export async function getPdfSettings(): Promise<PdfSettings> {
  const res = await apiRequest("GET", "/api/pdfs/settings");
  const data = await res.json();
  return data.data;
}

export async function updatePdfSettings(payload: Partial<PdfSettings>) {
  const res = await apiRequest("PUT", "/api/pdfs/settings", payload);
  const data = await res.json();
  return data.data;
}

export async function resetPdfSettings() {
  const res = await apiRequest("POST", "/api/pdfs/settings/reset");
  const data = await res.json();
  return data.data;
}

export async function fetchPdfPreview(documentType: PdfDocumentType): Promise<Blob> {
  const token = getToken();
  const res = await fetch("/api/pdfs/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ documentType }),
  });
  if (!res.ok) {
    const info = await parseApiError(res);
    throw new Error(info.message);
  }
  return res.blob();
}

export function getPdfDownloadUrl(documentType: PdfDocumentType) {
  return `/api/pdfs/download?documentType=${documentType}`;
}

export async function downloadPdfWithAuth(url: string, filename: string) {
  const token = getToken();
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const info = await parseApiError(res);
    throw new Error(info.message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
