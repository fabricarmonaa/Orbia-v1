import type { Express } from "express";
import { storage } from "../storage";

export function registerTrackingRoutes(app: Express) {
  app.get("/api/public/tracking/:trackingId", async (req, res) => {
    try {
      const order = await storage.getOrderByTrackingId(req.params.trackingId);
      if (!order) {
        return res.status(404).json({ error: "Seguimiento no encontrado" });
      }
      if (order.trackingRevoked) {
        return res.status(410).json({ error: "Link de seguimiento revocado" });
      }
      if (order.trackingExpiresAt && new Date(order.trackingExpiresAt) < new Date()) {
        return res.status(410).json({ error: "Link de seguimiento expirado" });
      }

      const tenantId = order.tenantId;
      const statuses = await storage.getOrderStatuses(tenantId);
      const currentStatus = statuses.find((s) => s.id === order.statusId);
      const history = await storage.getOrderHistory(order.id, tenantId);
      const publicComments = await storage.getPublicOrderComments(order.id);
      const config = await storage.getConfig(tenantId);

      const historyFormatted = history.map((h) => {
        const s = statuses.find((st) => st.id === h.statusId);
        return {
          status: s?.name || "Desconocido",
          color: s?.color || "#6B7280",
          date: h.createdAt,
          note: h.note,
        };
      });

      res.json({
        data: {
          orderNumber: order.orderNumber,
          type: order.type,
          status: currentStatus?.name || "Sin estado",
          statusColor: currentStatus?.color || "#6B7280",
          customerName: order.customerName || "",
          createdAt: order.createdAt,
          scheduledAt: order.scheduledAt,
          closedAt: order.closedAt,
          history: historyFormatted,
          publicComments: publicComments.map((c) => ({
            content: c.content,
            date: c.createdAt,
          })),
          businessName: config?.businessName || "",
          logoUrl: config?.logoUrl || null,
          trackingLayout: config?.trackingLayout || "classic",
          trackingPrimaryColor: config?.trackingPrimaryColor || "#6366f1",
          trackingAccentColor: config?.trackingAccentColor || "#8b5cf6",
          trackingBgColor: config?.trackingBgColor || "#ffffff",
          trackingTosText: config?.trackingTosText || null,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
