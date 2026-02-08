import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, requireFeature, enforceBranchScope } from "../auth";
import { sttRateLimiter, sttConcurrencyGuard, validateSttPayload } from "../middleware/stt-guards";

export function registerSttRoutes(app: Express) {
  app.post("/api/ai/stt",
    tenantAuth,
    requireFeature("stt"),
    sttRateLimiter,
    sttConcurrencyGuard,
    validateSttPayload,
    async (req, res) => {
      try {
        const { audio, context } = req.body;

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
          if (
            fetchErr.name === "AbortError" ||
            fetchErr.code === "ECONNREFUSED" ||
            fetchErr?.cause?.code === "ECONNREFUSED" ||
            fetchErr.message?.includes("fetch failed")
          ) {
            return res.status(503).json({
              error: "Servicio de IA no disponible. Intentá de nuevo más tarde.",
              code: "AI_SERVICE_UNAVAILABLE",
            });
          }
          throw fetchErr;
        }

        const log = await storage.createSttLog({
          tenantId: req.auth!.tenantId!,
          userId: req.auth!.userId,
          context,
          transcription: sttResult.transcription,
          intentJson: sttResult.intent,
          confirmed: false,
        });

        res.json({
          data: {
            logId: log.id,
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
      const { context, intent, logId } = req.body;
      if (!context || !intent) {
        return res.status(400).json({ error: "Contexto e intent requeridos" });
      }
      const tenantId = req.auth!.tenantId!;
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (intent.branchId || null);

      const missingFields: string[] = [];
      if (context === "products" && intent.action === "create") {
        if (!intent.name) missingFields.push("name");
        if (!intent.price && intent.price !== 0) missingFields.push("price");
      } else if (context === "cash" && (intent.action === "income" || intent.action === "expense")) {
        if (!intent.amount && intent.amount !== 0) missingFields.push("amount");
      } else if (context === "orders" && intent.action === "create") {
        if (!intent.customerName && !intent.description) missingFields.push("customerName o description");
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          missing_fields: missingFields,
          message: `Faltan campos requeridos: ${missingFields.join(", ")}`,
        });
      }

      let result: any;
      let entityType: string = "";

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
        entityType = "order";
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
        entityType = "cash_movement";
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
        entityType = "cash_movement";
      } else if (context === "products" && intent.action === "create") {
        result = await storage.createProduct({
          tenantId,
          name: intent.name,
          description: intent.description || null,
          price: String(intent.price),
          sku: intent.sku || null,
          categoryId: intent.categoryId || null,
        });
        entityType = "product";
      } else {
        return res.status(400).json({ error: "Acción no soportada para este contexto" });
      }

      if (logId) {
        try {
          await storage.updateSttLogConfirmed(logId, tenantId, {
            resultEntityType: entityType,
            resultEntityId: result.id,
          });
        } catch (_e) { }
      } else {
        const lastLog = await storage.getLastUnconfirmedLog(tenantId, req.auth!.userId, context);
        if (lastLog) {
          try {
            await storage.updateSttLogConfirmed(lastLog.id, tenantId, {
              resultEntityType: entityType,
              resultEntityId: result.id,
            });
          } catch (_e) { }
        }
      }

      res.status(201).json({ data: result, entityType });
    } catch (err: any) {
      console.error("Apply intent error:", err);
      res.status(500).json({ error: "Error aplicando intent: " + (err.message || "desconocido") });
    }
  });
}
