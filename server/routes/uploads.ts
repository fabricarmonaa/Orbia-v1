import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import express from "express";
import type { Express } from "express";

const profileUploadDir = path.join(process.cwd(), "uploads", "profiles");
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

export const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profileUploadDir),
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const deliveryUploadDir = path.join(process.cwd(), "uploads", "delivery");
if (!fs.existsSync(deliveryUploadDir)) {
  fs.mkdirSync(deliveryUploadDir, { recursive: true });
}

export const deliveryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, deliveryUploadDir),
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

export function registerStaticUploads(app: Express) {
  app.use("/uploads/profiles", express.static(profileUploadDir));
  app.use("/uploads/delivery", express.static(deliveryUploadDir));
}
