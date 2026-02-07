import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, getTenantPlan, enforceBranchScope, blockBranchScope } from "../auth";
import { profileUpload } from "./uploads";

export function registerTenantRoutes(app: Express) {
  app.get("/api/me", tenantAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.auth!.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          scope: user.scope || "TENANT",
          tenantId: user.tenantId,
          branchId: user.branchId,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/me/plan", tenantAuth, async (req, res) => {
    try {
      const plan = await getTenantPlan(req.auth!.tenantId!);
      res.json({ data: plan || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/config", tenantAuth, async (req, res) => {
    try {
      const config = await storage.getConfig(req.auth!.tenantId!);
      res.json({ data: config || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/config", tenantAuth, blockBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const plan = await getTenantPlan(tenantId);
      if (plan && req.body.trackingExpirationHours !== undefined) {
        const hours = parseInt(req.body.trackingExpirationHours);
        const minH = plan.limits.tracking_retention_min_hours || 1;
        const maxH = plan.limits.tracking_retention_max_hours || 24;
        if (hours < minH || hours > maxH) {
          return res.status(400).json({
            error: `Tu plan "${plan.name}" permite entre ${minH}h y ${maxH}h de retención de tracking.`,
            code: "LIMIT_EXCEEDED",
            min: minH,
            max: maxH,
          });
        }
      }
      const config = await storage.upsertConfig({
        tenantId,
        ...req.body,
      });
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/stats", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId! : null;
      const [totalOrders, totalProducts, monthlyIncome, monthlyExpenses, todayIncome, todayExpenses] =
        await Promise.all([
          storage.countOrders(tenantId, branchId),
          storage.countProducts(tenantId),
          storage.getMonthlyIncome(tenantId, branchId),
          storage.getMonthlyExpenses(tenantId, branchId),
          storage.getTodayIncome(tenantId, branchId),
          storage.getTodayExpenses(tenantId, branchId),
        ]);
      let allOrders;
      if (branchId) {
        allOrders = await storage.getOrdersByBranch(tenantId, branchId);
      } else {
        allOrders = await storage.getOrders(tenantId);
      }
      const statuses = await storage.getOrderStatuses(tenantId);
      const finalStatusIds = statuses.filter((s) => s.isFinal).map((s) => s.id);
      const openOrders = allOrders.filter((o) => !finalStatusIds.includes(o.statusId!)).length;

      res.json({
        data: {
          totalOrders,
          openOrders,
          todayIncome,
          todayExpenses,
          totalProducts,
          monthlyIncome,
          monthlyExpenses,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/config/logo", tenantAuth, blockBranchScope, profileUpload.single("logo"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
      const logoUrl = `/uploads/profiles/${req.file.filename}`;
      const config = await storage.upsertConfig({
        tenantId: req.auth!.tenantId!,
        logoUrl,
      });
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/subscription/status", tenantAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.auth!.tenantId!);
      if (!tenant) return res.status(404).json({ error: "Tenant no encontrado" });
      let warning: string | null = null;
      let status: "active" | "warning" | "grace" | "blocked" = "active";
      if (tenant.subscriptionEndDate) {
        const now = new Date();
        const endDate = new Date(tenant.subscriptionEndDate);
        const graceDays = 3;
        const graceEnd = new Date(endDate);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        if (now > graceEnd) {
          status = "blocked";
          warning = "Cuenta bloqueada por falta de pago. Contacte al administrador.";
        } else if (now > endDate) {
          status = "grace";
          const msLeft = graceEnd.getTime() - now.getTime();
          const hoursLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
          const daysLeft = Math.floor(hoursLeft / 24);
          warning = daysLeft > 0
            ? `Tu suscripción venció. Tenés ${daysLeft} día(s) y ${hoursLeft % 24}h para renovar.`
            : `Tu suscripción venció. Tenés ${hoursLeft}h para renovar.`;
        } else {
          const msLeft = endDate.getTime() - now.getTime();
          const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
          if (daysLeft <= 7) {
            status = "warning";
            warning = `Tu suscripción vence en ${daysLeft} día(s). Renová a tiempo.`;
          }
        }
      }
      res.json({
        data: {
          subscriptionStartDate: tenant.subscriptionStartDate,
          subscriptionEndDate: tenant.subscriptionEndDate,
          isActive: tenant.isActive,
          status,
          warning,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/addons/status", tenantAuth, async (req, res) => {
    try {
      const addons = await storage.getTenantAddons(req.auth!.tenantId!);
      const result: Record<string, boolean> = {};
      for (const a of addons) {
        result[a.addonKey] = a.enabled;
      }
      res.json({ data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
