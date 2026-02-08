import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, enforceBranchScope } from "../auth";
import { z } from "zod";

const cashMovementSchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: z.coerce.number().positive(),
  method: z.string().trim().max(40).optional(),
  category: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  expenseDefinitionId: z.coerce.number().int().positive().optional().nullable(),
  sessionId: z.coerce.number().int().positive().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
});

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
      const existing = await storage.getOpenSession(tenantId, branchId);
      if (existing) {
        return res.status(400).json({ error: "Ya hay una caja abierta para esta sucursal" });
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

  app.patch("/api/cash/sessions/:id/close", tenantAuth, requireFeature("cash_sessions"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const sessionId = parseInt(req.params.id as string);
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : null;

      await storage.closeCashSession(
        sessionId,
        tenantId,
        branchId,
        String(req.body.closingAmount || 0)
      );

      // Audit log
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: "close",
        entityType: "cash_session",
        entityId: sessionId,
        metadata: {
          closingAmount: req.body.closingAmount,
          scope: req.auth!.scope,
          branchId,
        },
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cash/session", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (req.query.branchId ? parseInt(req.query.branchId as string) : null);
      const session = await storage.getOpenSession(tenantId, branchId);
      res.json({ data: session || null });
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
      const payload = cashMovementSchema.parse(req.body);
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (payload.branchId || null);
      const expenseDefinitionId = payload.expenseDefinitionId || null;
      let expenseDefinitionName: string | null = null;

      if (expenseDefinitionId) {
        if (payload.type !== "egreso") {
          return res.status(400).json({ error: "expenseDefinitionId solo aplica a egresos" });
        }
        const definition = await storage.getExpenseDefinitionById(expenseDefinitionId, tenantId);
        if (!definition) {
          return res.status(400).json({ error: "Definición de gasto inválida" });
        }
        expenseDefinitionName = definition.name;
      }
      const data = await storage.createCashMovement({
        tenantId,
        type: payload.type,
        amount: String(payload.amount),
        method: payload.method || "efectivo",
        category: payload.category || null,
        description: payload.description || null,
        expenseDefinitionId,
        expenseDefinitionName,
        sessionId: payload.sessionId || null,
        branchId,
        createdById: req.auth!.userId,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cash/reports/expenses",
    tenantAuth,
    async (req, res) => {
      try {
        const tenantId = req.auth!.tenantId!;
        const dateFrom = req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
        const dateTo = req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : new Date();

        const breakdown = await storage.getExpensesBreakdown(tenantId, dateFrom, dateTo);
        const categories = await storage.getExpenseCategories(tenantId);

        res.json({
          data: {
            breakdown,
            categories,
            dateFrom,
            dateTo,
          }
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );
}
