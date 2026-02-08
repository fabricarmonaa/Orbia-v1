import type { Express } from "express";
import { z } from "zod";
import { tenantAuth, requireTenantAdmin } from "../auth";
import { storage } from "../storage";
import { createRateLimiter } from "../middleware/rate-limit";
import { DEFAULT_PDF_SETTINGS } from "../storage/pdf-settings";
import { generatePriceListPdf } from "../services/pdf/price-list";
import { generateInvoiceBPdf } from "../services/pdf/invoice-b";

const allowedTemplates = ["CLASSIC", "MODERN", "MINIMAL", "INVOICE_B"] as const;
const allowedPageSizes = ["A4", "LETTER"] as const;
const allowedOrientations = ["portrait", "landscape"] as const;
const allowedDocumentTypes = ["PRICE_LIST", "INVOICE_B"] as const;
const allowedColumns = ["name", "sku", "description", "price", "stock_total", "branch_stock"] as const;
const allowedInvoiceColumns = ["code", "quantity", "product", "price", "discount", "total"] as const;

const stylesSchema = z.object({
  fontSize: z.number().min(8).max(16).optional(),
  headerSize: z.number().min(12).max(24).optional(),
  subheaderSize: z.number().min(10).max(18).optional(),
  tableHeaderSize: z.number().min(8).max(16).optional(),
  rowHeight: z.number().min(12).max(28).optional(),
});

const pdfSettingsSchema = z.object({
  documentType: z.enum(allowedDocumentTypes).optional(),
  templateKey: z.enum(allowedTemplates).optional(),
  pageSize: z.enum(allowedPageSizes).optional(),
  orientation: z.enum(allowedOrientations).optional(),
  showLogo: z.boolean().optional(),
  headerText: z.string().trim().max(80).optional().nullable(),
  subheaderText: z.string().trim().max(120).optional().nullable(),
  footerText: z.string().trim().max(160).optional().nullable(),
  showBranchStock: z.boolean().optional(),
  showSku: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  priceColumnLabel: z.string().trim().max(30).optional(),
  currencySymbol: z.string().trim().max(5).optional(),
  columns: z.array(z.enum(allowedColumns)).max(allowedColumns.length).optional(),
  invoiceColumns: z.array(z.enum(allowedInvoiceColumns)).max(allowedInvoiceColumns.length).optional(),
  documentTitle: z.string().trim().max(80).optional().nullable(),
  fiscalName: z.string().trim().max(120).optional().nullable(),
  fiscalCuit: z.string().trim().max(30).optional().nullable(),
  fiscalIibb: z.string().trim().max(30).optional().nullable(),
  fiscalAddress: z.string().trim().max(160).optional().nullable(),
  fiscalCity: z.string().trim().max(120).optional().nullable(),
  showFooterTotals: z.boolean().optional(),
  styles: stylesSchema.optional(),
});

const previewLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.PDF_PREVIEW_LIMIT_PER_MIN || "5", 10),
  keyGenerator: (req) => `pdf-preview:${req.auth?.tenantId || req.ip}`,
  errorMessage: "Demasiadas solicitudes de PDF. Intentá en un minuto.",
  code: "PDF_RATE_LIMIT",
});

function normalizeColumns(columns?: string[]) {
  if (!columns?.length) return DEFAULT_PDF_SETTINGS.columns;
  const unique = Array.from(new Set(columns));
  return unique.filter((col) => allowedColumns.includes(col as any));
}

function normalizeInvoiceColumns(columns?: string[]) {
  if (!columns?.length) return DEFAULT_PDF_SETTINGS.invoiceColumns;
  const unique = Array.from(new Set(columns));
  return unique.filter((col) => allowedInvoiceColumns.includes(col as any));
}

async function generatePdfByType(tenantId: number, documentType: string) {
  if (documentType === "INVOICE_B") {
    return generateInvoiceBPdf(tenantId);
  }
  return generatePriceListPdf(tenantId);
}

export function registerPdfRoutes(app: Express) {
  app.get("/api/pdfs/settings", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: "No se pudieron cargar los PDFs", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.put("/api/pdfs/settings", tenantAuth, requireTenantAdmin, async (req, res) => {
    try {
      const payload = pdfSettingsSchema.parse(req.body);
      const data = await storage.upsertTenantPdfSettings(req.auth!.tenantId!, {
        documentType: payload.documentType,
        templateKey: payload.templateKey,
        pageSize: payload.pageSize,
        orientation: payload.orientation,
        showLogo: payload.showLogo,
        headerText: payload.headerText ?? undefined,
        subheaderText: payload.subheaderText ?? undefined,
        footerText: payload.footerText ?? undefined,
        showBranchStock: payload.showBranchStock,
        showSku: payload.showSku,
        showDescription: payload.showDescription,
        priceColumnLabel: payload.priceColumnLabel,
        currencySymbol: payload.currencySymbol,
        columnsJson: payload.columns ? normalizeColumns(payload.columns) : undefined,
        invoiceColumnsJson: payload.invoiceColumns ? normalizeInvoiceColumns(payload.invoiceColumns) : undefined,
        documentTitle: payload.documentTitle ?? undefined,
        fiscalName: payload.fiscalName ?? undefined,
        fiscalCuit: payload.fiscalCuit ?? undefined,
        fiscalIibb: payload.fiscalIibb ?? undefined,
        fiscalAddress: payload.fiscalAddress ?? undefined,
        fiscalCity: payload.fiscalCity ?? undefined,
        showFooterTotals: payload.showFooterTotals,
        stylesJson: payload.styles ?? undefined,
      });
      const response = await storage.getTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data: response });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: "No se pudieron guardar los PDFs", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.post("/api/pdfs/settings/reset", tenantAuth, requireTenantAdmin, async (req, res) => {
    try {
      const data = await storage.resetTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo restaurar el PDF", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.post("/api/pdfs/preview", tenantAuth, previewLimiter, async (req, res) => {
    try {
      const documentType = req.body?.documentType || (await storage.getTenantPdfSettings(req.auth!.tenantId!)).documentType;
      const pdfBuffer = await generatePdfByType(req.auth!.tenantId!, documentType);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=documento.pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo generar el PDF", code: "PDF_GENERATION_ERROR" });
    }
  });

  app.get("/api/pdfs/download", tenantAuth, previewLimiter, async (req, res) => {
    try {
      const documentType = req.query.documentType ? String(req.query.documentType) : (await storage.getTenantPdfSettings(req.auth!.tenantId!)).documentType;
      const pdfBuffer = await generatePdfByType(req.auth!.tenantId!, documentType);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo generar el PDF", code: "PDF_GENERATION_ERROR" });
    }
  });

  app.get("/api/pdfs/price-list/settings", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: "No se pudieron cargar los PDFs", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.put("/api/pdfs/price-list/settings", tenantAuth, requireTenantAdmin, async (req, res) => {
    try {
      const payload = pdfSettingsSchema.parse(req.body);
      await storage.upsertTenantPdfSettings(req.auth!.tenantId!, {
        documentType: payload.documentType,
        templateKey: payload.templateKey,
        pageSize: payload.pageSize,
        orientation: payload.orientation,
        showLogo: payload.showLogo,
        headerText: payload.headerText ?? undefined,
        subheaderText: payload.subheaderText ?? undefined,
        footerText: payload.footerText ?? undefined,
        showBranchStock: payload.showBranchStock,
        showSku: payload.showSku,
        showDescription: payload.showDescription,
        priceColumnLabel: payload.priceColumnLabel,
        currencySymbol: payload.currencySymbol,
        columnsJson: payload.columns ? normalizeColumns(payload.columns) : undefined,
        invoiceColumnsJson: payload.invoiceColumns ? normalizeInvoiceColumns(payload.invoiceColumns) : undefined,
        documentTitle: payload.documentTitle ?? undefined,
        fiscalName: payload.fiscalName ?? undefined,
        fiscalCuit: payload.fiscalCuit ?? undefined,
        fiscalIibb: payload.fiscalIibb ?? undefined,
        fiscalAddress: payload.fiscalAddress ?? undefined,
        fiscalCity: payload.fiscalCity ?? undefined,
        showFooterTotals: payload.showFooterTotals,
        stylesJson: payload.styles ?? undefined,
      });
      const response = await storage.getTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data: response });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: "No se pudieron guardar los PDFs", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.post("/api/pdfs/price-list/settings/reset", tenantAuth, requireTenantAdmin, async (req, res) => {
    try {
      const data = await storage.resetTenantPdfSettings(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo restaurar el PDF", code: "PDF_SETTINGS_ERROR" });
    }
  });

  app.get("/api/pdfs/price-list/preview", tenantAuth, previewLimiter, async (req, res) => {
    try {
      const pdfBuffer = await generatePriceListPdf(req.auth!.tenantId!);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=lista-precios.pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo generar el PDF", code: "PDF_GENERATION_ERROR" });
    }
  });

  app.get("/api/pdfs/price-list/download", tenantAuth, previewLimiter, async (req, res) => {
    try {
      const pdfBuffer = await generatePriceListPdf(req.auth!.tenantId!);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=lista-precios.pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo generar el PDF", code: "PDF_GENERATION_ERROR" });
    }
  });
}
