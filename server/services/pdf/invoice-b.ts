import path from "path";
import fs from "fs";
import { storage } from "../../storage";
import { drawBox, drawDottedLine, fitImage, drawCheckbox, drawBarcode, drawLabelValue } from "./layout-helpers";

const ALLOWED_COLUMNS = ["code", "quantity", "product", "price", "discount", "total"] as const;
type InvoiceColumnKey = (typeof ALLOWED_COLUMNS)[number];

function sanitizeText(value: string | null | undefined, max: number) {
  if (!value) return "";
  return value.replace(/[\r\n]+/g, " ").replace(/[<>]/g, "").slice(0, max);
}

function parseLocalFile(logoUrl?: string | null) {
  if (!logoUrl) return null;
  const clean = logoUrl.split("?")[0];
  if (!clean.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), clean);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

function resolveColumns(columns: string[]) {
  const unique = Array.from(new Set(columns));
  return unique.filter((col) => ALLOWED_COLUMNS.includes(col as InvoiceColumnKey)) as InvoiceColumnKey[];
}

export async function generateInvoiceBPdf(tenantId: number) {
  const settings = await storage.getTenantPdfSettings(tenantId);
  const branding = await storage.getTenantBranding(tenantId);
  const appBranding = await storage.getAppBranding();
  const products = await storage.getProducts(tenantId);

  const logoPath = settings.showLogo
    ? parseLocalFile(branding.logoUrl || appBranding.orbiaLogoUrl)
    : null;

  const items = (products.length ? products.slice(0, 50) : [
    { id: 0, name: "Producto ejemplo 1", sku: "SKU-001", price: 1200 },
    { id: 1, name: "Producto ejemplo 2", sku: "SKU-002", price: 850 },
  ]).map((product, index) => {
    const qty = 1 + (index % 3);
    const price = Number(product.price || 0);
    const discount = 0;
    const total = qty * price - discount;
    return {
      code: sanitizeText(product.sku || `P-${product.id}`, 30),
      product: sanitizeText(product.name, 80),
      quantity: qty,
      price,
      discount,
      total,
    };
  });

  const columns = resolveColumns(settings.invoiceColumns);
  const showDiscount = columns.includes("discount");

  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    layout: "portrait",
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  // Draw first page
  drawInvoicePage(doc, {
    settings,
    branding,
    logoPath,
    items,
    showDiscount,
    isFirstPage: true,
  });

  doc.end();

  return await new Promise<Buffer>((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

interface InvoicePageOptions {
  settings: any;
  branding: any;
  logoPath: string | null;
  items: any[];
  showDiscount: boolean;
  isFirstPage: boolean;
}

function drawInvoicePage(doc: PDFKit.PDFDocument, opts: InvoicePageOptions) {
  const { settings, branding, logoPath, items, showDiscount, isFirstPage } = opts;

  // A. Outer border
  drawBox(doc, 30, 30, 535, 780, { lineWidth: 1.5, cornerRadius: 5 });

  // Horizontal separators
  doc.moveTo(30, 155).lineTo(565, 155).lineWidth(2).stroke(); // After header
  doc.moveTo(30, 205).lineTo(565, 205).lineWidth(1).stroke(); // After client
  doc.moveTo(30, 265).lineTo(565, 265).lineWidth(2).stroke(); // Before table
  doc.moveTo(30, 725).lineTo(565, 725).lineWidth(2).stroke(); // Before footer

  // B. Header (3 sections)
  drawHeader(doc, settings, branding, logoPath);

  // C. Client data
  drawClientData(doc);

  // D. Sales conditions
  drawSalesConditions(doc);

  // E. Items table
  const { cursorY, totalAmount } = drawItemsTable(doc, items, settings, 270, showDiscount);

  // F. Footer
  drawFooter(doc, totalAmount, settings);
}

function drawHeader(doc: PDFKit.PDFDocument, settings: any, branding: any, logoPath: string | null) {
  // B1: Logo + Issuer (left)
  if (logoPath) {
    fitImage(doc, logoPath, 45, 45, 140, 55);
  }

  doc.fontSize(10).fillColor("#111111").font("Helvetica-Bold");
  const businessName = sanitizeText(settings.fiscalName || branding.displayName || "Negocio", 80);
  doc.text(businessName, 45, 105, { width: 170 });

  doc.fontSize(8).font("Helvetica");
  if (settings.fiscalAddress) {
    doc.text(sanitizeText(settings.fiscalAddress, 60), 45, 118, { width: 170 });
  }
  if (settings.fiscalCity) {
    doc.text(sanitizeText(settings.fiscalCity, 40), 45, 128, { width: 170 });
  }
  doc.text("I.V.A. RESPONSABLE INSCRIPTO", 45, 138, { width: 170 });

  // B2: "B" Box (center)
  drawBox(doc, 230, 40, 135, 110, { lineWidth: 2 });
  doc.fontSize(48).font("Helvetica-Bold").text("B", 230, 55, {
    width: 135,
    align: "center",
  });
  doc.fontSize(10).font("Helvetica").text("Código N° 06", 230, 120, {
    width: 135,
    align: "center",
  });

  // B3: FACTURA + Fiscal (right)
  doc.fontSize(20).font("Helvetica-Bold").text("FACTURA", 375, 45, { width: 180 });

  // Date box
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  drawBox(doc, 375, 70, 180, 20);
  doc.fontSize(9).font("Helvetica");
  doc.text(`Día: ${day}`, 380, 74);
  doc.text(`Mes: ${month}`, 440, 74);
  doc.text(`Año: ${year}`, 500, 74);

  // Fiscal data mini boxes
  doc.fontSize(8);
  doc.text(`C.U.I.T: ${settings.fiscalCuit || "—"}`, 375, 95, { width: 180 });
  doc.text(`Ing. Brutos: ${settings.fiscalIibb || "—"}`, 375, 107, { width: 180 });
  doc.text(`Inicio Act.: —`, 375, 119, { width: 180 });
}

function drawClientData(doc: PDFKit.PDFDocument) {
  doc.fontSize(9).fillColor("#111111").font("Helvetica");
  drawLabelValue(doc, 45, 165, "Señor(es):", "", 500, true);
  drawLabelValue(doc, 45, 185, "Dirección:", "", 280, true);
  doc.text("Loc.:", 340, 185);
  drawDottedLine(doc, 370, 192, 555, 192);
}

function drawSalesConditions(doc: PDFKit.PDFDocument) {
  doc.fontSize(9).fillColor("#111111").font("Helvetica");

  // Line 1: Payment conditions
  doc.text("Condiciones de Venta:", 45, 215);
  doc.text("Contado", 160, 215);
  drawCheckbox(doc, 200, 214, 10);
  doc.text("Cta. Cte.", 220, 215);
  drawCheckbox(doc, 270, 214, 10);

  // Line 2: IVA checkboxes
  doc.text("I.V.A:", 45, 232);
  const ivaOptions = ["Exento", "No Resp.", "Cons. Final", "Resp. Monot."];
  ivaOptions.forEach((label, i) => {
    const x = 90 + i * 105;
    doc.text(label, x, 232);
    drawCheckbox(doc, x + doc.widthOfString(label) + 5, 231, 10);
  });

  // Line 3: CUIT and REMITO
  doc.text("C.U.I.T:", 45, 248);
  drawDottedLine(doc, 85, 255, 200, 255);

  doc.text("REMITO N°:", 250, 248);
  drawDottedLine(doc, 310, 255, 555, 255);
}

function drawItemsTable(
  doc: PDFKit.PDFDocument,
  items: any[],
  settings: any,
  startY: number,
  showDiscount: boolean
) {
  let cursorY = startY;

  // Table header
  drawTableHeader(doc, cursorY, showDiscount);
  cursorY += 20;

  let totalAmount = 0;

  for (const item of items) {
    // Check pagination
    if (cursorY > 710) {
      doc.addPage({ size: "A4", margin: 0 });
      cursorY = 40;
      drawTableHeader(doc, cursorY, showDiscount);
      cursorY += 20;
    }

    // Draw item row
    doc.fontSize(9).fillColor("#111111").font("Helvetica");

    doc.text(item.quantity.toString(), 50, cursorY, { width: 50, align: "center" });
    doc.text(item.product, 110, cursorY, { width: 260, ellipsis: true });

    if (showDiscount) {
      doc.text(`${settings.currencySymbol}${item.price.toFixed(2)}`, 380, cursorY, { width: 70, align: "right" });
      doc.text(`${settings.currencySymbol}${item.discount.toFixed(2)}`, 460, cursorY, { width: 50, align: "right" });
      doc.text(`${settings.currencySymbol}${item.total.toFixed(2)}`, 520, cursorY, { width: 35, align: "right" });
    } else {
      doc.text(`${settings.currencySymbol}${item.price.toFixed(2)}`, 380, cursorY, { width: 80, align: "right" });
      doc.text(`${settings.currencySymbol}${item.total.toFixed(2)}`, 470, cursorY, { width: 85, align: "right" });
    }

    cursorY += 18;
    drawDottedLine(doc, 40, cursorY - 2, 555, cursorY - 2);
    totalAmount += item.total;
  }

  return { cursorY, totalAmount };
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, showDiscount: boolean) {
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#111111");

  doc.text("Cantidad", 50, y, { width: 50, align: "center" });
  doc.text("DESCRIPCION", 110, y);

  if (showDiscount) {
    doc.text("Precio Unit.", 380, y, { width: 70, align: "right" });
    doc.text("Bonif", 460, y, { width: 50, align: "right" });
    doc.text("IMPORTE", 520, y, { width: 35, align: "right" });
  } else {
    doc.text("Precio Unitario", 380, y, { width: 80, align: "right" });
    doc.text("IMPORTE", 470, y, { width: 85, align: "right" });
  }

  doc.font("Helvetica");
  doc.moveTo(40, y + 15).lineTo(555, y + 15).lineWidth(1.5).stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, totalAmount: number, settings: any) {
  // Left: barcode
  doc.fontSize(7).fillColor("#111111").font("Helvetica");
  doc.text("ORIGINAL BLANCO / DUPLICADO COLOR", 45, 740);
  doc.fontSize(6);
  doc.text('"147 teléfono Gratuito C.A.B.A., Área de Defensa y Protección al Consumidor C.A.B.A."', 45, 795, {
    width: 320,
  });
  drawBarcode(doc, 45, 755, 120, 35);

  // Right: TOTAL box
  drawBox(doc, 420, 735, 135, 60, { lineWidth: 2 });
  doc.fontSize(14).font("Helvetica-Bold").text("TOTAL $", 430, 745);
  doc.fontSize(18).text(`${settings.currencySymbol}${totalAmount.toFixed(2)}`, 430, 765, {
    align: "right",
    width: 115,
  });
}
