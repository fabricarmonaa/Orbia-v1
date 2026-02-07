import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, enforceBranchScope, blockBranchScope } from "../auth";

export function registerProductRoutes(app: Express) {
  app.get("/api/product-categories", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.getProductCategories(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/product-categories", tenantAuth, requireFeature("products"), blockBranchScope, async (req, res) => {
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

  app.post("/api/products", tenantAuth, requireFeature("products"), blockBranchScope, async (req, res) => {
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
      const stockByBranch = await storage.getProductStockByBranch(productId, tenantId);
      const movements = await storage.getStockMovements(productId, tenantId);
      res.json({ data: { stockByBranch, movements } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/products/:id/stock", tenantAuth, requireFeature("products"), enforceBranchScope, async (req, res) => {
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

  app.put("/api/products/:id", tenantAuth, requireFeature("products"), blockBranchScope, async (req, res) => {
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

  app.patch("/api/products/:id/toggle", tenantAuth, requireFeature("products"), blockBranchScope, async (req, res) => {
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

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 40 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=productos.pdf");
      doc.pipe(res);

      doc.fontSize(18).text(config?.businessName || "Productos", { align: "center" });
      doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, { align: "center" });
      doc.moveDown(1);

      const headers = ["Nombre", "Precio", "Costo", "Stock", "SKU", "Categoría", "Activo"];
      const colWidths = [140, 65, 65, 50, 70, 90, 45];
      const tableLeft = 40;
      let y = doc.y;

      doc.fontSize(8).font("Helvetica-Bold");
      let x = tableLeft;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 16;
      doc.moveTo(tableLeft, y).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 4;

      doc.font("Helvetica").fontSize(7);
      for (const p of allProducts) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        const catName = p.categoryId ? catMap.get(p.categoryId) || "" : "";
        const row = [
          p.name || "",
          p.price ? `$${p.price}` : "",
          p.cost ? `$${p.cost}` : "",
          p.stock?.toString() ?? "",
          p.sku || "",
          catName,
          p.isActive ? "Si" : "No",
        ];
        x = tableLeft;
        row.forEach((val, i) => {
          doc.text(val, x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });
        y += 14;
      }

      doc.moveDown(2);
      doc.fontSize(8).text(`Total: ${allProducts.length} productos`, { align: "right" });

      doc.end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
