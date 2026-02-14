import express from "express";
import type { Express } from "express";
import { tenantAuth, requireTenantAdmin, superAuth } from "../auth";
import { storage } from "../storage";
import { createImageUpload, resolveUploadDir, handleSingleUpload } from "../middleware/upload-guards";
import { createRateLimiter } from "../middleware/rate-limit";

const profileUploadDir = resolveUploadDir("profiles");
const deliveryUploadDir = resolveUploadDir("delivery");
const tenantLogoDir = resolveUploadDir("tenant-logos");
const appLogoDir = resolveUploadDir("app");

const TENANT_LOGO_MAX_BYTES = parseInt(process.env.TENANT_LOGO_MAX_BYTES || "5242880", 10);

export const profileUpload = createImageUpload("profiles", "default");
export const deliveryUpload = createImageUpload("delivery", "default");
export const tenantLogoUpload = createImageUpload("tenant-logos", "logo", TENANT_LOGO_MAX_BYTES);
export const appLogoUpload = createImageUpload("app", "logo");

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.UPLOADS_LIMIT_PER_MIN || "6", 10),
  keyGenerator: (req) => `uploads:${req.auth?.userId || req.ip}`,
  errorMessage: "Demasiadas subidas. Intentá en un minuto.",
  code: "UPLOAD_RATE_LIMIT",
});

export function registerStaticUploads(app: Express) {
  app.use("/uploads/profiles", express.static(profileUploadDir));
  app.use("/uploads/delivery", express.static(deliveryUploadDir));
  app.use("/uploads/tenant-logos", express.static(tenantLogoDir));
  app.use("/uploads/app", express.static(appLogoDir));
}

export function registerUploadRoutes(app: Express) {
  app.post(
    "/api/uploads/tenant-logo",
    tenantAuth,
    requireTenantAdmin,
    uploadLimiter,
    handleSingleUpload(tenantLogoUpload, "logo"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
        const logoUrl = `/uploads/tenant-logos/${req.file.filename}`;
        const data = await storage.upsertTenantBranding(req.auth!.tenantId!, { logoUrl });
        const versionedUrl = data.updatedAt
          ? `${logoUrl}?v=${new Date(data.updatedAt).getTime()}`
          : logoUrl;
        res.json({ url: versionedUrl });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/uploads/app-logo",
    superAuth,
    uploadLimiter,
    handleSingleUpload(appLogoUpload, "logo"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
        const logoUrl = `/uploads/app/${req.file.filename}`;
        const data = await storage.updateAppBranding({ orbiaLogoUrl: logoUrl });
        const versionedUrl = data.updatedAt
          ? `${logoUrl}?v=${new Date(data.updatedAt).getTime()}`
          : logoUrl;
        res.json({ url: versionedUrl });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );
}
