import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const JWT_SECRET = process.env.SESSION_SECRET || "orbia-secret-key-change-me";

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  tenantId: number | null;
  isSuperAdmin: boolean;
  branchId: number | null;
}

export interface PlanFeatures {
  orders: boolean;
  tracking: boolean;
  cash_simple: boolean;
  cash_sessions: boolean;
  products: boolean;
  branches: boolean;
  fixed_expenses: boolean;
  variable_expenses: boolean;
  reports_advanced: boolean;
  stt: boolean;
  [key: string]: boolean;
}

export interface PlanLimits {
  max_branches: number;
  max_staff_users: number;
  max_orders_month: number;
  tracking_retention_min_hours: number;
  tracking_retention_max_hours: number;
  [key: string]: number;
}

export interface TenantPlanInfo {
  planCode: string;
  name: string;
  features: PlanFeatures;
  limits: PlanLimits;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getTenantPlan(tenantId: number): Promise<TenantPlanInfo | null> {
  const tenant = await storage.getTenantById(tenantId);
  if (!tenant?.planId) return null;
  const plan = await storage.getPlanById(tenant.planId);
  if (!plan) return null;
  return {
    planCode: plan.planCode,
    name: plan.name,
    features: plan.featuresJson as PlanFeatures,
    limits: plan.limitsJson as PlanLimits,
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
      plan?: TenantPlanInfo;
    }
  }
}

export function superAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token requerido" });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload.isSuperAdmin) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function tenantAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token requerido" });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload.tenantId) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.tenantId) {
        return res.status(403).json({ error: "Acceso denegado" });
      }
      const plan = await getTenantPlan(req.auth.tenantId);
      if (!plan) {
        return res.status(403).json({ error: "Sin plan asignado", code: "NO_PLAN" });
      }
      req.plan = plan;
      if (!plan.features[featureKey]) {
        return res.status(403).json({
          error: `Tu plan "${plan.name}" no incluye esta funcionalidad. Mejorá tu plan para acceder.`,
          code: "FEATURE_BLOCKED",
          feature: featureKey,
          currentPlan: plan.planCode,
        });
      }
      next();
    } catch {
      return res.status(500).json({ error: "Error verificando plan" });
    }
  };
}
