import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, blockBranchScope, enforceBranchScope } from "../auth";

export function registerBranchRoutes(app: Express) {
  app.get("/api/branches", tenantAuth, requireFeature("branches"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId) {
        const branch = await storage.getBranchById(req.auth!.branchId, tenantId);
        return res.json({ data: branch ? [branch] : [] });
      }
      const data = await storage.getBranches(tenantId);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/branches", tenantAuth, requireFeature("branches"), blockBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const plan = req.plan!;
      const maxBranches = plan.limits.max_branches;
      if (maxBranches >= 0) {
        const existing = await storage.getBranches(tenantId);
        if (existing.length >= maxBranches) {
          return res.status(403).json({
            error: `Tu plan "${plan.name}" permite máximo ${maxBranches} sucursales. Mejorá tu plan para agregar más.`,
            code: "LIMIT_REACHED",
            limit: "max_branches",
            currentPlan: plan.planCode,
          });
        }
      }
      const data = await storage.createBranch({
        tenantId,
        ...req.body,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/branches/:branchId/orders", tenantAuth, requireFeature("branches"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = parseInt(req.params.branchId as string);
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId !== branchId) {
        return res.status(403).json({ error: "No tenés acceso a esta sucursal" });
      }
      const branch = await storage.getBranchById(branchId, tenantId);
      if (!branch) return res.status(404).json({ error: "Sucursal no encontrada" });
      const data = await storage.getOrdersByBranch(tenantId, branchId);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/branches/:branchId/cash/movements", tenantAuth, requireFeature("branches"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = parseInt(req.params.branchId as string);
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId !== branchId) {
        return res.status(403).json({ error: "No tenés acceso a esta sucursal" });
      }
      const branch = await storage.getBranchById(branchId, tenantId);
      if (!branch) return res.status(404).json({ error: "Sucursal no encontrada" });
      const data = await storage.getCashMovementsByBranch(tenantId, branchId);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/order-statuses", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderStatuses(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
