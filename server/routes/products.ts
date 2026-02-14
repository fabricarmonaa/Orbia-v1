import type { Express } from "express";
import { storage } from "../storage";
import {
  tenantAuth,
  requireFeature,
  enforceBranchScope,
  blockBranchScope,
  requireTenantAdmin,
} from "../auth";
import { generatePriceListPdf } from "../services/pdf/price-list";

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
        const tenantId = req.auth!.tenantId!;
        const branchCount = await storage.getBranchCount(tenantId);

        const data: any = {
          tenantId,
          name: req.body.name,
          description: req.body.description || null,
          price: String(req.body.price),
          sku: req.body.sku || null,
          categoryId: req.body.categoryId || null,
        };

        // Only accept stock/cost if NO branches exist
        if (branchCount === 0) {
          if (req.body.stock !== undefined) {
            data.stock = parseInt(String(req.body.stock), 10);
          }
          if (req.body.cost !== undefined) {
            data.cost = req.body.cost !== null ? String(req.body.cost) : null;
          }
        }

        const product = await storage.createProduct(data);
        res.status(201).json({ data: product });
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

        const branchCount = await storage.getBranchCount(tenantId);

        const updateData: any = {};
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.description !== undefined) updateData.description = req.body.description;
        if (req.body.price !== undefined) updateData.price = String(req.body.price);
        if (req.body.sku !== undefined) updateData.sku = req.body.sku;
        if (req.body.categoryId !== undefined) updateData.categoryId = req.body.categoryId;

        // Only accept stock/cost if NO branches
        if (branchCount === 0) {
          if (req.body.cost !== undefined) updateData.cost = req.body.cost !== null ? String(req.body.cost) : null;
          if (req.body.stock !== undefined) updateData.stock = parseInt(String(req.body.stock), 10);
        }

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
      const pdfBuffer = await generatePriceListPdf(tenantId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=productos.pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: "No se pudo generar el PDF", code: "PDF_EXPORT_ERROR" });
    }
  });
}
