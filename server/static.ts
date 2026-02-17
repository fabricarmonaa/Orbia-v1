import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Nunca devolver HTML para /api/*
  app.use("/api/{*path}", (_req, res) => {
    return res.status(404).json({ error: "Endpoint no encontrado", code: "API_NOT_FOUND" });
  });

  // Fallback SPA solo para rutas NO-API
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Endpoint no encontrado", code: "API_NOT_FOUND" });
    }
    return res.sendFile(path.resolve(distPath, "index.html"));
  });
}
