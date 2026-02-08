import type { Express } from "express";
import { storage } from "../storage";
import {
  tenantAuth,
  requireFeature,
  enforceBranchScope,
  blockBranchScope,
  requireTenantAdmin,
} from "../auth";

export function registerProductRoutes(app: Express) {
  app.get("/api/product-categories", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.getProductCategories(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/product-categories",
    tenantAuth,
    requireTenantAdmin,
    requireFeature("products"),
    blockBranchScope,
    async (req, res) => {
    try {
      const data = await storage.createProductCategory({
        tenantId: req.auth!.tenantId!,
        name: req.body.name,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/products", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.getProducts(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/products",
    tenantAuth,
    requireTenantAdmin,
    requireFeature("products"),
    blockBranchScope,
    async (req, res) => {
    try {
      const data = await storage.createProduct({
        tenantId: req.auth!.tenantId!,
        name: req.body.name,
        description: req.body.description || null,
        price: String(req.body.price),
        sku: req.body.sku || null,
        categoryId: req.body.categoryId || null,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/products/:id/stock", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id as string);
      const product = await storage.getProductById(productId, tenantId);
      if (!product) return res.status(404).json({ error: "Producto no encontrado" });
      const [stockByBranch, branches] = await Promise.all([
        storage.getProductStockByBranch(productId, tenantId),
        storage.getBranches(tenantId),
      ]);
      const stockMap = new Map(stockByBranch.map((stock) => [stock.branchId, stock.stock ?? 0]));
      const stockView = branches.map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        stock: stockMap.get(branch.id) ?? 0,
      }));
      const movements = await storage.getStockMovements(productId, tenantId);
      res.json({ data: { stockByBranch: stockView, movements } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(
    "/api/products/:id/stock",
    tenantAuth,
    requireTenantAdmin,
    requireFeature("products"),
    enforceBranchScope,
    async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id as string);
      const { branchId, stock, reason } = req.body;
      if (branchId === undefined || stock === undefined) {
        return res.status(400).json({ error: "branchId y stock son obligatorios" });
      }
      const stockNum = parseInt(String(stock));
      if (isNaN(stockNum) || stockNum < 0) {
        return res.status(400).json({ error: "Stock debe ser un número entero no negativo" });
      }
      const product = await storage.getProductById(productId, tenantId);
      if (!product) return res.status(404).json({ error: "Producto no encontrado" });

      const targetBranchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId! : branchId;
      const existing = await storage.getProductStockByBranch(productId, tenantId);
      const prev = existing.find(s => s.branchId === targetBranchId);
      const prevStock = prev?.stock || 0;
      const delta = stockNum - prevStock;

      await storage.upsertProductStockByBranch({
        tenantId,
        productId,
        branchId: targetBranchId,
        stock: stockNum,
      });

      if (delta !== 0) {
        await storage.createStockMovement({
          tenantId,
          productId,
          branchId: targetBranchId,
          quantity: delta,
          reason: reason || null,
          userId: req.auth!.userId,
        });
      }

      const updatedStock = await storage.getProductStockByBranch(productId, tenantId);
      res.json({ data: updatedStock });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(
    "/api/products/:id",
    tenantAuth,
    requireTenantAdmin,
    requireFeature("products"),
    blockBranchScope,
    async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id as string);
      const existing = await storage.getProductById(productId, tenantId);
      if (!existing) return res.status(404).json({ error: "Producto no encontrado" });

      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.price !== undefined) updateData.price = String(req.body.price);
      if (req.body.cost !== undefined) updateData.cost = req.body.cost !== null ? String(req.body.cost) : null;
      if (req.body.stock !== undefined) updateData.stock = req.body.stock;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku;
      if (req.body.categoryId !== undefined) updateData.categoryId = req.body.categoryId;

      const product = await storage.updateProduct(productId, tenantId, updateData);
      res.json({ data: product });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(
    "/api/products/:id/toggle",
    tenantAuth,
    requireTenantAdmin,
    requireFeature("products"),
    blockBranchScope,
    async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id as string);
      const existing = await storage.getProductById(productId, tenantId);
      if (!existing) return res.status(404).json({ error: "Producto no encontrado" });
      await storage.toggleProductActive(productId, tenantId, !existing.isActive);
      res.json({ data: { isActive: !existing.isActive } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/products/export", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const allProducts = await storage.getProducts(tenantId);
      const categories = await storage.getProductCategories(tenantId);
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const config = await storage.getConfig(tenantId);

      const pdfTemplate = (config?.configJson as any)?.pdfTemplate || {};
      const tpl = {
        title: pdfTemplate.title || config?.businessName || "Productos",
        showDate: pdfTemplate.showDate !== false,
        showLogo: pdfTemplate.showLogo !== false,
        columns: pdfTemplate.columns || ["name", "price", "cost", "stock", "sku", "category", "active"],
        headerColor: pdfTemplate.headerColor || "#6366f1",
        fontSize: pdfTemplate.fontSize || 8,
        pageSize: pdfTemplate.pageSize || "A4",
        orientation: pdfTemplate.orientation || "portrait",
        footerText: pdfTemplate.footerText || "",
      };

      const columnDefs: Record<string, { label: string; width: number; getValue: (p: any) => string }> = {
        name: { label: "Nombre", width: 140, getValue: (p) => p.name || "" },
        price: { label: "Precio", width: 65, getValue: (p) => p.price ? `$${p.price}` : "" },
        cost: { label: "Costo", width: 65, getValue: (p) => p.cost ? `$${p.cost}` : "" },
        stock: { label: "Stock", width: 50, getValue: (p) => p.stock?.toString() ?? "" },
        sku: { label: "SKU", width: 70, getValue: (p) => p.sku || "" },
        category: { label: "Categoría", width: 90, getValue: (p) => p.categoryId ? catMap.get(p.categoryId) || "" : "" },
        active: { label: "Activo", width: 45, getValue: (p) => p.isActive ? "Si" : "No" },
      };

      const activeColumns = tpl.columns.filter((c: string) => columnDefs[c]);
      const headers = activeColumns.map((c: string) => columnDefs[c].label);
      const colWidths = activeColumns.map((c: string) => columnDefs[c].width);

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: tpl.pageSize as any,
        margin: 40,
        layout: tpl.orientation === "landscape" ? "landscape" : "portrait",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=productos.pdf");
      doc.pipe(res);

      if (tpl.showLogo && config?.logoUrl) {
        try {
          const fs = await import("fs");
          const logoPath = `.${config.logoUrl}`;
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width / 2 - 30, doc.y, { width: 60, height: 60 });
            doc.moveDown(4);
          }
        } catch {}
      }

      doc.fontSize(18).text(tpl.title, { align: "center" });
      if (tpl.showDate) {
        doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, { align: "center" });
      }
      doc.moveDown(1);

      const tableLeft = 40;
      let y = doc.y;

      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b] as [number, number, number];
      };

      const [hr, hg, hb] = hexToRgb(tpl.headerColor);
      doc.rect(tableLeft, y - 2, colWidths.reduce((a: number, b: number) => a + b, 0), 16).fill(`rgb(${hr},${hg},${hb})`);
      doc.fillColor("white").fontSize(tpl.fontSize).font("Helvetica-Bold");
      let x = tableLeft;
      headers.forEach((h: string, i: number) => {
        doc.text(h, x + 2, y, { width: colWidths[i] - 4, align: "left" });
        x += colWidths[i];
      });
      y += 18;

      doc.fillColor("black").font("Helvetica").fontSize(tpl.fontSize - 1);
      const maxY = tpl.orientation === "landscape" ? 520 : 750;
      for (let idx = 0; idx < allProducts.length; idx++) {
        const p = allProducts[idx];
        if (y > maxY) {
          doc.addPage();
          y = 40;
        }
        if (idx % 2 === 0) {
          doc.rect(tableLeft, y - 2, colWidths.reduce((a: number, b: number) => a + b, 0), 14).fill("#f8f9fa");
          doc.fillColor("black");
        }
        x = tableLeft;
        activeColumns.forEach((col: string, i: number) => {
          const val = columnDefs[col].getValue(p);
          doc.text(val, x + 2, y, { width: colWidths[i] - 4, align: "left" });
          x += colWidths[i];
        });
        y += 14;
      }

      doc.moveDown(2);
      doc.fontSize(tpl.fontSize).text(`Total: ${allProducts.length} productos`, { align: "right" });
      if (tpl.footerText) {
        doc.moveDown(1);
        doc.fontSize(tpl.fontSize - 1).fillColor("gray").text(tpl.footerText, { align: "center" });
      }

      doc.end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
