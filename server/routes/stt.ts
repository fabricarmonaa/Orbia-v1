import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, enforceBranchScope } from "../auth";

export function registerSttRoutes(app: Express) {
  app.post("/api/ai/stt", tenantAuth, requireFeature("stt"), async (req, res) => {
    try {
      const { audio, context } = req.body;
      if (!audio || !context) {
        return res.status(400).json({ error: "Audio y contexto requeridos" });
      }
      const validContexts = ["orders", "cash", "products"];
      if (!validContexts.includes(context)) {
        return res.status(400).json({ error: "Contexto inválido" });
      }

      const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001";
      let sttResult: { transcription: string; intent: any };

      try {
        const aiRes = await fetch(`${aiServiceUrl}/api/stt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio, context }),
          signal: AbortSignal.timeout(30000),
        });
        if (!aiRes.ok) {
          const errBody = await aiRes.json().catch(() => ({}));
          throw new Error((errBody as any).error || `AI service responded ${aiRes.status}`);
        }
        sttResult = await aiRes.json() as { transcription: string; intent: any };
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError" || fetchErr.code === "ECONNREFUSED") {
          return res.status(503).json({
            error: "Servicio de IA no disponible. Intentá de nuevo más tarde.",
            code: "AI_SERVICE_UNAVAILABLE",
          });
        }
        throw fetchErr;
      }

      await storage.createSttLog({
        tenantId: req.auth!.tenantId!,
        userId: req.auth!.userId,
        context,
        transcription: sttResult.transcription,
        intentJson: sttResult.intent,
        confirmed: false,
      });

      res.json({
        data: {
          transcription: sttResult.transcription,
          intent: sttResult.intent,
          context,
        },
      });
    } catch (err: any) {
      console.error("STT error:", err);
      res.status(500).json({ error: "Error procesando audio: " + (err.message || "desconocido") });
    }
  });

  app.post("/api/ai/apply", tenantAuth, requireFeature("stt"), enforceBranchScope, async (req, res) => {
    try {
      const { context, intent } = req.body;
      if (!context || !intent) {
        return res.status(400).json({ error: "Contexto e intent requeridos" });
      }
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (intent.branchId || null);

      let result: any;

      if (context === "orders" && intent.action === "create") {
        const orderNumber = await storage.getNextOrderNumber(tenantId);
        result = await storage.createOrder({
          tenantId,
          orderNumber,
          type: intent.type || "PEDIDO",
          customerName: intent.customerName || null,
          customerPhone: intent.customerPhone || null,
          customerEmail: null,
          description: intent.description || null,
          statusId: intent.statusId || null,
          totalAmount: intent.totalAmount ? String(intent.totalAmount) : null,
          branchId,
          createdById: req.auth!.userId,
          createdByScope: req.auth!.scope || "TENANT",
          createdByBranchId: req.auth!.branchId || null,
          requiresDelivery: false,
          deliveryAddress: null,
          deliveryCity: null,
          deliveryAddressNotes: null,
          deliveryStatus: null,
        });
      } else if (context === "cash" && intent.action === "income") {
        result = await storage.createCashMovement({
          tenantId,
          type: "ingreso",
          amount: String(intent.amount || 0),
          method: intent.method || "efectivo",
          category: intent.category || null,
          description: intent.description || null,
          sessionId: null,
          branchId,
          createdById: req.auth!.userId,
        });
      } else if (context === "cash" && intent.action === "expense") {
        result = await storage.createCashMovement({
          tenantId,
          type: "egreso",
          amount: String(intent.amount || 0),
          method: intent.method || "efectivo",
          category: intent.category || null,
          description: intent.description || null,
          sessionId: null,
          branchId,
          createdById: req.auth!.userId,
        });
      } else if (context === "products" && intent.action === "create") {
        result = await storage.createProduct({
          tenantId,
          name: intent.name || "Producto sin nombre",
          description: intent.description || null,
          price: String(intent.price || 0),
          sku: intent.sku || null,
          categoryId: intent.categoryId || null,
        });
      } else {
        return res.status(400).json({ error: "Acción no soportada para este contexto" });
      }

      res.status(201).json({ data: result });
    } catch (err: any) {
      console.error("Apply intent error:", err);
      res.status(500).json({ error: "Error aplicando intent: " + (err.message || "desconocido") });
    }
  });
}
