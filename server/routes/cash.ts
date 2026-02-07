import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, enforceBranchScope } from "../auth";

export function registerCashRoutes(app: Express) {
  app.get("/api/cash/sessions", tenantAuth, requireFeature("cash_sessions"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      let data;
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId) {
        data = await storage.getCashSessionsByBranch(tenantId, req.auth!.branchId);
      } else {
        data = await storage.getCashSessions(tenantId);
      }
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cash/sessions", tenantAuth, requireFeature("cash_sessions"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (req.body.branchId || null);
      const existing = await storage.getOpenSession(tenantId);
      if (existing) {
        return res.status(400).json({ error: "Ya hay una caja abierta" });
      }
      const data = await storage.createCashSession({
        tenantId,
        branchId,
        userId: req.auth!.userId,
        openingAmount: String(req.body.openingAmount || 0),
        status: "open",
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/cash/sessions/:id/close", tenantAuth, requireFeature("cash_sessions"), async (req, res) => {
    try {
      await storage.closeCashSession(
        parseInt(req.params.id as string),
        req.auth!.tenantId!,
        String(req.body.closingAmount || 0)
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cash/movements", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      let data;
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId) {
        data = await storage.getCashMovementsByBranch(tenantId, req.auth!.branchId);
      } else {
        data = await storage.getCashMovements(tenantId);
      }
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cash/movements", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (req.body.branchId || null);
      const data = await storage.createCashMovement({
        tenantId,
        type: req.body.type,
        amount: String(req.body.amount),
        method: req.body.method || "efectivo",
        category: req.body.category || null,
        description: req.body.description || null,
        sessionId: req.body.sessionId || null,
        branchId,
        createdById: req.auth!.userId,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
