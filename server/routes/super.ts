import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { superAuth, hashPassword } from "../auth";
import { profileUpload } from "./uploads";
import { handleSingleUpload } from "../middleware/upload-guards";
import { createRateLimiter } from "../middleware/rate-limit";
import crypto from "crypto";

const createTenantSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(80),
  planId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.coerce.number().int().positive().nullable()
  ).optional(),
  adminEmail: z.string().trim().email().max(120),
  adminPassword: z.string().min(6).max(128),
  adminName: z.string().trim().min(2).max(80),
});

const planUpdateSchema = z.object({
  planId: z.coerce.number().int().positive(),
});

const blockSchema = z.object({
  blocked: z.boolean(),
});

const renameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const setPasswordSchema = z.object({
  newPassword: z.string().min(6).max(128),
});

const deleteSchema = z.object({
  confirmText: z.string().trim().min(2).max(200),
});

function generateTempPassword() {
  const base = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `${base}${crypto.randomInt(10, 99)}`;
}

export function registerSuperRoutes(app: Express) {
  const avatarUploadLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: parseInt(process.env.UPLOADS_LIMIT_PER_MIN || "6", 10),
    keyGenerator: (req) => `avatar:${req.auth?.userId || req.ip}`,
    errorMessage: "Demasiadas subidas. Intentá en un minuto.",
    code: "UPLOAD_RATE_LIMIT",
  });
  app.get("/api/super/plans", superAuth, async (_req, res) => {
    try {
      const data = await storage.getPlans();
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/super/tenants", superAuth, async (_req, res) => {
    try {
      const data = await storage.getTenants();
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants", superAuth, async (req, res) => {
    try {
      const { code, name, planId, adminEmail, adminPassword, adminName } = createTenantSchema.parse(req.body);
      if (!code || !name || !adminEmail || !adminPassword || !adminName) {
        return res.status(400).json({ error: "Campos requeridos faltantes" });
      }
      const existing = await storage.getTenantByCode(code);
      if (existing) {
        return res.status(400).json({ error: "Código de negocio ya existe" });
      }
      const tenant = await storage.createTenant({
        code,
        name,
        slug: code,
        planId: planId || null,
        isActive: true,
      });
      const hashedPassword = await hashPassword(adminPassword);
      await storage.createUser({
        tenantId: tenant.id,
        email: adminEmail,
        password: hashedPassword,
        fullName: adminName,
        role: "admin",
        isActive: true,
        isSuperAdmin: false,
      });
      await storage.upsertConfig({
        tenantId: tenant.id,
        businessName: name,
        currency: "ARS",
        trackingExpirationHours: 24,
        language: "es",
      });
      const defaultStatuses = [
        { name: "Pendiente", color: "#F59E0B", sortOrder: 0, isFinal: false },
        { name: "En Proceso", color: "#3B82F6", sortOrder: 1, isFinal: false },
        { name: "Listo", color: "#8B5CF6", sortOrder: 2, isFinal: false },
        { name: "Entregado", color: "#10B981", sortOrder: 3, isFinal: true },
        { name: "Cancelado", color: "#EF4444", sortOrder: 4, isFinal: true },
      ];
      for (const s of defaultStatuses) {
        await storage.createOrderStatus({ tenantId: tenant.id, ...s });
      }
      res.status(201).json({ data: tenant });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/plan", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { planId } = planUpdateSchema.parse(req.body);
      await storage.updateTenantPlan(tenantId, planId);
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/super/tenants/:tenantId/addons", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const addons = await storage.getTenantAddons(tenantId);
      res.json({ data: addons });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants/:tenantId/addons", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { addonKey, enabled } = req.body;
      if (!addonKey) return res.status(400).json({ error: "addonKey requerido" });
      const addon = await storage.upsertTenantAddon({
        tenantId,
        addonKey,
        enabled: enabled ?? true,
        enabledById: req.auth!.userId,
        enabledAt: enabled ? new Date() : null,
      });
      res.json({ data: addon });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/addons/:addonKey", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const addonKey = req.params.addonKey as string;
      const { enabled } = req.body;
      if (enabled === undefined) return res.status(400).json({ error: "enabled requerido" });
      const addon = await storage.upsertTenantAddon({
        tenantId,
        addonKey,
        enabled,
        enabledById: req.auth!.userId,
        enabledAt: enabled ? new Date() : null,
      });
      res.json({ data: addon });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/subscription", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate y endDate requeridos" });
      }
      await storage.updateTenantSubscription(tenantId, new Date(startDate), new Date(endDate));
      await storage.updateTenantActive(tenantId, true);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/block", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { blocked } = blockSchema.parse(req.body);
      await storage.updateTenantBlocked(tenantId, blocked);
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: blocked ? "TENANT_BLOCKED" : "TENANT_UNBLOCKED",
        entityType: "TENANT",
        entityId: tenantId,
        changes: { blocked },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/rename", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { name } = renameSchema.parse(req.body);
      await storage.updateTenantName(tenantId, name);
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: "TENANT_RENAMED",
        entityType: "TENANT",
        entityId: tenantId,
        changes: { name },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants/:tenantId/admin/reset-password", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const admin = await storage.getPrimaryTenantAdmin(tenantId);
      if (!admin) {
        return res.status(404).json({ error: "No se encontró un admin principal" });
      }
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);
      await storage.updateUser(admin.id, tenantId, { password: hashedPassword });
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: "TENANT_ADMIN_PASSWORD_RESET",
        entityType: "USER",
        entityId: admin.id,
        metadata: { adminEmail: admin.email },
      });
      res.json({ tempPassword });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants/:tenantId/admin/set-password", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { newPassword } = setPasswordSchema.parse(req.body);
      const admin = await storage.getPrimaryTenantAdmin(tenantId);
      if (!admin) {
        return res.status(404).json({ error: "No se encontró un admin principal" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(admin.id, tenantId, { password: hashedPassword });
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: "TENANT_ADMIN_PASSWORD_SET",
        entityType: "USER",
        entityId: admin.id,
        metadata: { adminEmail: admin.email },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/super/tenants/:tenantId", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { confirmText } = deleteSchema.parse(req.body);
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }
      const confirmValue = confirmText.trim().toLowerCase();
      const valid = confirmValue === tenant.code.toLowerCase() || confirmValue === tenant.name.toLowerCase();
      if (!valid) {
        return res.status(400).json({ error: "Confirmación inválida" });
      }
      await storage.softDeleteTenant(tenantId);
      await storage.createAuditLog({
        tenantId,
        userId: req.auth!.userId,
        action: "TENANT_DELETED",
        entityType: "TENANT",
        entityId: tenantId,
        metadata: { confirmText: tenant.code },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/super/config", superAuth, async (req, res) => {
    try {
      const config = await storage.getSuperAdminConfig(req.auth!.userId);
      res.json({ data: config || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/super/config/avatar",
    superAuth,
    avatarUploadLimiter,
    handleSingleUpload(profileUpload, "avatar"),
    async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;
      const config = await storage.upsertSuperAdminConfig({
        userId: req.auth!.userId,
        avatarUrl,
      });
      const versionedUrl = `${avatarUrl}?v=${new Date().getTime()}`;
      res.json({ data: { ...config, avatarUrl: versionedUrl } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
