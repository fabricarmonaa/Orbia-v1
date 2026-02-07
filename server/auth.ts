import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET || "orbia-secret-key-change-me";

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  tenantId: number | null;
  isSuperAdmin: boolean;
  branchId: number | null;
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

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
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
