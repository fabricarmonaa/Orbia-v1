import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  generateToken,
  comparePassword,
} from "../auth";
import { createRateLimiter } from "../middleware/rate-limit";

const superLoginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128),
});

const tenantLoginSchema = z.object({
  tenantCode: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128),
});

const superLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AUTH_SUPER_LOGIN_LIMIT_PER_MIN || "8", 10),
  keyGenerator: (req) => `super-login:${req.ip}`,
  errorMessage: "Demasiados intentos. Intentá nuevamente en un minuto.",
  code: "LOGIN_RATE_LIMIT",
});

const tenantLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AUTH_LOGIN_LIMIT_PER_MIN || "10", 10),
  keyGenerator: (req) => `tenant-login:${req.ip}:${String(req.body?.tenantCode || "").toLowerCase()}`,
  errorMessage: "Demasiados intentos. Intentá nuevamente en un minuto.",
  code: "LOGIN_RATE_LIMIT",
});

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/super/login", superLoginLimiter, async (req, res) => {
    try {
      const { email, password } = superLoginSchema.parse(req.body);
      if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña requeridos" });
      }
      const user = await storage.getSuperAdminByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: "super_admin",
        tenantId: null,
        isSuperAdmin: true,
        branchId: null,
      });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: "super_admin",
          tenantId: null,
          isSuperAdmin: true,
          branchId: null,
        },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", tenantLoginLimiter, async (req, res) => {
    try {
      const { tenantCode, email, password } = tenantLoginSchema.parse(req.body);
      if (!tenantCode || !email || !password) {
        return res.status(400).json({ error: "Código, email y contraseña requeridos" });
      }
      const tenant = await storage.getTenantByCode(tenantCode);
      if (!tenant) {
        return res.status(401).json({ error: "Negocio no encontrado" });
      }
      if (tenant.deletedAt) {
        return res.status(403).json({ error: "Negocio eliminado", code: "TENANT_DELETED" });
      }
      if (tenant.isBlocked) {
        return res.status(403).json({ error: "Negocio bloqueado", code: "TENANT_BLOCKED" });
      }
      if (!tenant.isActive) {
        return res.status(403).json({ error: "Cuenta bloqueada por falta de pago. Contacte al administrador.", code: "ACCOUNT_BLOCKED" });
      }
      if (tenant.subscriptionEndDate) {
        const now = new Date();
        const endDate = new Date(tenant.subscriptionEndDate);
        const graceDays = 3;
        const graceEnd = new Date(endDate);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        if (now > graceEnd) {
          await storage.updateTenantActive(tenant.id, false);
          return res.status(403).json({ error: "Cuenta bloqueada por falta de pago. Contacte al administrador.", code: "ACCOUNT_BLOCKED" });
        }
      }
      const user = await storage.getUserByEmail(email, tenant.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      let subscriptionWarning: string | null = null;
      if (tenant.subscriptionEndDate) {
        const now = new Date();
        const endDate = new Date(tenant.subscriptionEndDate);
        if (now > endDate) {
          const graceDays = 3;
          const graceEnd = new Date(endDate);
          graceEnd.setDate(graceEnd.getDate() + graceDays);
          const msLeft = graceEnd.getTime() - now.getTime();
          const hoursLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
          const daysLeft = Math.floor(hoursLeft / 24);
          subscriptionWarning = daysLeft > 0
            ? `Tu suscripción venció. Tenés ${daysLeft} día(s) y ${hoursLeft % 24}h para renovar antes de que se bloquee tu cuenta.`
            : `Tu suscripción venció. Tenés ${hoursLeft}h para renovar antes de que se bloquee tu cuenta.`;
        } else {
          const msLeft = endDate.getTime() - now.getTime();
          const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
          if (daysLeft <= 7) {
            subscriptionWarning = `Tu suscripción vence en ${daysLeft} día(s). Renová a tiempo para no perder acceso.`;
          }
        }
      }
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        isSuperAdmin: false,
        branchId: user.branchId,
        scope: user.scope || "TENANT",
      });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          tenantId: tenant.id,
          isSuperAdmin: false,
          branchId: user.branchId,
          scope: user.scope || "TENANT",
        },
        subscriptionWarning,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });
}
