import { db } from "../db";
import { eq } from "drizzle-orm";
import { tenantPdfSettings, type InsertTenantPdfSettings } from "@shared/schema";

export const DEFAULT_PDF_SETTINGS = {
  documentType: "PRICE_LIST",
  templateKey: "CLASSIC",
  pageSize: "A4",
  orientation: "portrait",
  showLogo: true,
  headerText: null as string | null,
  subheaderText: null as string | null,
  footerText: null as string | null,
  showBranchStock: true,
  showSku: false,
  showDescription: true,
  priceColumnLabel: "Precio",
  currencySymbol: "$",
  columns: ["name", "description", "price", "stock_total", "branch_stock"],
  invoiceColumns: ["code", "quantity", "product", "price", "discount", "total"],
  documentTitle: "Factura B",
  fiscalName: null as string | null,
  fiscalCuit: null as string | null,
  fiscalIibb: null as string | null,
  fiscalAddress: null as string | null,
  fiscalCity: null as string | null,
  showFooterTotals: true,
  styles: {
    fontSize: 10,
    headerSize: 16,
    subheaderSize: 12,
    tableHeaderSize: 10,
    rowHeight: 18,
  },
};

function mergeDefaults<T extends Record<string, unknown>>(defaults: T, value?: Record<string, unknown> | null) {
  return { ...defaults, ...(value || {}) } as T;
}

export const pdfSettingsStorage = {
  async getTenantPdfSettings(tenantId: number) {
    const [row] = await db
      .select()
      .from(tenantPdfSettings)
      .where(eq(tenantPdfSettings.tenantId, tenantId));

    if (!row) {
      return {
        id: null,
        tenantId,
        ...DEFAULT_PDF_SETTINGS,
        columns: DEFAULT_PDF_SETTINGS.columns,
        styles: DEFAULT_PDF_SETTINGS.styles,
        updatedAt: new Date(),
      };
    }

    return {
      id: row.id,
      tenantId,
      templateKey: row.templateKey,
      documentType: row.documentType,
      pageSize: row.pageSize,
      orientation: row.orientation,
      showLogo: row.showLogo,
      headerText: row.headerText,
      subheaderText: row.subheaderText,
      footerText: row.footerText,
      showBranchStock: row.showBranchStock,
      showSku: row.showSku,
      showDescription: row.showDescription,
      priceColumnLabel: row.priceColumnLabel,
      currencySymbol: row.currencySymbol,
      columns: Array.isArray(row.columnsJson) && row.columnsJson.length > 0
        ? row.columnsJson
        : DEFAULT_PDF_SETTINGS.columns,
      invoiceColumns: Array.isArray(row.invoiceColumnsJson) && row.invoiceColumnsJson.length > 0
        ? row.invoiceColumnsJson
        : DEFAULT_PDF_SETTINGS.invoiceColumns,
      documentTitle: row.documentTitle ?? DEFAULT_PDF_SETTINGS.documentTitle,
      fiscalName: row.fiscalName ?? DEFAULT_PDF_SETTINGS.fiscalName,
      fiscalCuit: row.fiscalCuit ?? DEFAULT_PDF_SETTINGS.fiscalCuit,
      fiscalIibb: row.fiscalIibb ?? DEFAULT_PDF_SETTINGS.fiscalIibb,
      fiscalAddress: row.fiscalAddress ?? DEFAULT_PDF_SETTINGS.fiscalAddress,
      fiscalCity: row.fiscalCity ?? DEFAULT_PDF_SETTINGS.fiscalCity,
      showFooterTotals: row.showFooterTotals ?? DEFAULT_PDF_SETTINGS.showFooterTotals,
      styles: mergeDefaults(DEFAULT_PDF_SETTINGS.styles, row.stylesJson as Record<string, unknown>),
      updatedAt: row.updatedAt,
    };
  },

  async upsertTenantPdfSettings(tenantId: number, payload: Partial<InsertTenantPdfSettings>) {
    const [existing] = await db
      .select()
      .from(tenantPdfSettings)
      .where(eq(tenantPdfSettings.tenantId, tenantId));

    if (existing) {
      const [updated] = await db
        .update(tenantPdfSettings)
        .set({
          templateKey: 'templateKey' in payload ? payload.templateKey : existing.templateKey,
          documentType: 'documentType' in payload ? payload.documentType : existing.documentType,
          pageSize: 'pageSize' in payload ? payload.pageSize : existing.pageSize,
          orientation: 'orientation' in payload ? payload.orientation : existing.orientation,
          showLogo: 'showLogo' in payload ? payload.showLogo : existing.showLogo,
          headerText: 'headerText' in payload ? (payload.headerText ?? null) : existing.headerText,
          subheaderText: 'subheaderText' in payload ? (payload.subheaderText ?? null) : existing.subheaderText,
          footerText: 'footerText' in payload ? (payload.footerText ?? null) : existing.footerText,
          showBranchStock: 'showBranchStock' in payload ? payload.showBranchStock : existing.showBranchStock,
          showSku: 'showSku' in payload ? payload.showSku : existing.showSku,
          showDescription: 'showDescription' in payload ? payload.showDescription : existing.showDescription,
          priceColumnLabel: 'priceColumnLabel' in payload ? payload.priceColumnLabel : existing.priceColumnLabel,
          currencySymbol: 'currencySymbol' in payload ? payload.currencySymbol : existing.currencySymbol,
          columnsJson: 'columnsJson' in payload ? payload.columnsJson : existing.columnsJson,
          invoiceColumnsJson: 'invoiceColumnsJson' in payload ? payload.invoiceColumnsJson : existing.invoiceColumnsJson,
          documentTitle: 'documentTitle' in payload ? (payload.documentTitle ?? null) : existing.documentTitle,
          fiscalName: 'fiscalName' in payload ? (payload.fiscalName ?? null) : existing.fiscalName,
          fiscalCuit: 'fiscalCuit' in payload ? (payload.fiscalCuit ?? null) : existing.fiscalCuit,
          fiscalIibb: 'fiscalIibb' in payload ? (payload.fiscalIibb ?? null) : existing.fiscalIibb,
          fiscalAddress: 'fiscalAddress' in payload ? (payload.fiscalAddress ?? null) : existing.fiscalAddress,
          fiscalCity: 'fiscalCity' in payload ? (payload.fiscalCity ?? null) : existing.fiscalCity,
          showFooterTotals: 'showFooterTotals' in payload ? payload.showFooterTotals : existing.showFooterTotals,
          stylesJson: 'stylesJson' in payload ? payload.stylesJson : existing.stylesJson,
          updatedAt: new Date(),
        })
        .where(eq(tenantPdfSettings.tenantId, tenantId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(tenantPdfSettings)
      .values({
        tenantId,
        documentType: payload.documentType || DEFAULT_PDF_SETTINGS.documentType,
        templateKey: payload.templateKey || DEFAULT_PDF_SETTINGS.templateKey,
        pageSize: payload.pageSize || DEFAULT_PDF_SETTINGS.pageSize,
        orientation: payload.orientation || DEFAULT_PDF_SETTINGS.orientation,
        showLogo: payload.showLogo ?? DEFAULT_PDF_SETTINGS.showLogo,
        headerText: payload.headerText ?? DEFAULT_PDF_SETTINGS.headerText,
        subheaderText: payload.subheaderText ?? DEFAULT_PDF_SETTINGS.subheaderText,
        footerText: payload.footerText ?? DEFAULT_PDF_SETTINGS.footerText,
        showBranchStock: payload.showBranchStock ?? DEFAULT_PDF_SETTINGS.showBranchStock,
        showSku: payload.showSku ?? DEFAULT_PDF_SETTINGS.showSku,
        showDescription: payload.showDescription ?? DEFAULT_PDF_SETTINGS.showDescription,
        priceColumnLabel: payload.priceColumnLabel || DEFAULT_PDF_SETTINGS.priceColumnLabel,
        currencySymbol: payload.currencySymbol || DEFAULT_PDF_SETTINGS.currencySymbol,
        columnsJson: payload.columnsJson ?? DEFAULT_PDF_SETTINGS.columns,
        invoiceColumnsJson: payload.invoiceColumnsJson ?? DEFAULT_PDF_SETTINGS.invoiceColumns,
        documentTitle: payload.documentTitle ?? DEFAULT_PDF_SETTINGS.documentTitle,
        fiscalName: payload.fiscalName ?? DEFAULT_PDF_SETTINGS.fiscalName,
        fiscalCuit: payload.fiscalCuit ?? DEFAULT_PDF_SETTINGS.fiscalCuit,
        fiscalIibb: payload.fiscalIibb ?? DEFAULT_PDF_SETTINGS.fiscalIibb,
        fiscalAddress: payload.fiscalAddress ?? DEFAULT_PDF_SETTINGS.fiscalAddress,
        fiscalCity: payload.fiscalCity ?? DEFAULT_PDF_SETTINGS.fiscalCity,
        showFooterTotals: payload.showFooterTotals ?? DEFAULT_PDF_SETTINGS.showFooterTotals,
        stylesJson: mergeDefaults(DEFAULT_PDF_SETTINGS.styles, payload.stylesJson as Record<string, unknown>),
      })
      .returning();
    return created;
  },

  async resetTenantPdfSettings(tenantId: number) {
    await db.delete(tenantPdfSettings).where(eq(tenantPdfSettings.tenantId, tenantId));
    return this.getTenantPdfSettings(tenantId);
  },
};
