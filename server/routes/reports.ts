import type { Express } from "express";
import { z } from "zod";
import { sql, and, eq } from "drizzle-orm";
import { tenantAuth, requireTenantAdmin } from "../auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { db } from "../db";
import { cashMovements, expenseDefinitions } from "@shared/schema";
import { storage } from "../storage";

const monthlySummarySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  force: z.boolean().optional(),
});

const summaryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.REPORTS_LIMIT_PER_MIN || "4", 10),
  keyGenerator: (req) => `monthly-summary:${req.auth?.tenantId || req.ip}`,
  errorMessage: "Demasiadas solicitudes. Intentá nuevamente en un minuto.",
  code: "REPORT_RATE_LIMIT",
});

export function registerReportRoutes(app: Express) {
  app.post("/api/reports/monthly-summary", tenantAuth, requireTenantAdmin, summaryLimiter, async (req, res) => {
    try {
      const { year, month, force } = monthlySummarySchema.parse(req.body);
      const tenantId = req.auth!.tenantId!;

      const existing = await storage.getTenantMonthlySummary(tenantId, year, month);
      if (existing && !force) {
        return res.json({ data: existing, cached: true });
      }

      const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const rangeEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));

      const [incomeRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
        .from(cashMovements)
        .where(
          and(
            eq(cashMovements.tenantId, tenantId),
            eq(cashMovements.type, "ingreso"),
            sql`${cashMovements.createdAt} >= ${rangeStart}`,
            sql`${cashMovements.createdAt} < ${rangeEnd}`
          )
        );

      const [expenseRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
        .from(cashMovements)
        .where(
          and(
            eq(cashMovements.tenantId, tenantId),
            eq(cashMovements.type, "egreso"),
            sql`${cashMovements.createdAt} >= ${rangeStart}`,
            sql`${cashMovements.createdAt} < ${rangeEnd}`
          )
        );

      const [fixedRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenseDefinitions.defaultAmount}), 0)` })
        .from(expenseDefinitions)
        .where(
          and(
            eq(expenseDefinitions.tenantId, tenantId),
            eq(expenseDefinitions.type, "FIXED"),
            eq(expenseDefinitions.isActive, true)
          )
        );

      const income = parseFloat(incomeRow?.total || "0");
      const expenses = parseFloat(expenseRow?.total || "0");
      const fixedImpact = parseFloat(fixedRow?.total || "0");
      const net = income - expenses - fixedImpact;

      const summary = await storage.upsertTenantMonthlySummary({
        tenantId,
        year,
        month,
        totalsJson: {
          income,
          expenses,
          fixedImpact,
          net,
        },
      });

      res.json({ data: summary, cached: false });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });
}
