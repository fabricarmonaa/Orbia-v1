import { apiRequest } from "@/lib/auth";

export type PdfTemplateKey = "CLASSIC" | "MODERN" | "MINIMAL";
export type PdfPageSize = "A4" | "LETTER";
export type PdfOrientation = "portrait" | "landscape";
export type PdfColumnKey = "name" | "sku" | "description" | "price" | "stock_total" | "branch_stock";

export interface PdfStyles {
  fontSize?: number;
  headerSize?: number;
  subheaderSize?: number;
  tableHeaderSize?: number;
  rowHeight?: number;
}

export interface PriceListPdfSettings {
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
  styles: PdfStyles;
  updatedAt?: string;
}

export async function getPriceListPdfSettings(): Promise<PriceListPdfSettings> {
  const res = await apiRequest("GET", "/api/pdfs/price-list/settings");
  const data = await res.json();
  return data.data;
}

export async function updatePriceListPdfSettings(payload: Partial<PriceListPdfSettings>) {
  const res = await apiRequest("PUT", "/api/pdfs/price-list/settings", payload);
  const data = await res.json();
  return data.data;
}

export async function resetPriceListPdfSettings() {
  const res = await apiRequest("POST", "/api/pdfs/price-list/settings/reset");
  const data = await res.json();
  return data.data;
}

export function getPriceListPreviewUrl(cacheBust = true) {
  const base = "/api/pdfs/price-list/preview";
  if (!cacheBust) return base;
  return `${base}?v=${Date.now()}`;
}

export function getPriceListDownloadUrl() {
  return "/api/pdfs/price-list/download";
}
