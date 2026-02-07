import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, enforceBranchScope } from "../auth";
import { randomUUID } from "crypto";

export function registerOrderRoutes(app: Express) {
  app.get("/api/orders", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      let data;
      if (req.auth!.scope === "BRANCH" && req.auth!.branchId) {
        data = await storage.getOrdersByBranch(tenantId, req.auth!.branchId);
      } else {
        data = await storage.getOrders(tenantId);
      }
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderNumber = await storage.getNextOrderNumber(tenantId);
      const branchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId : (req.body.branchId || null);
      const data = await storage.createOrder({
        tenantId,
        orderNumber,
        type: req.body.type || "PEDIDO",
        customerName: req.body.customerName || null,
        customerPhone: req.body.customerPhone || null,
        customerEmail: req.body.customerEmail || null,
        description: req.body.description || null,
        statusId: req.body.statusId || null,
        totalAmount: req.body.totalAmount ? String(req.body.totalAmount) : null,
        branchId,
        createdById: req.auth!.userId,
        createdByScope: req.auth!.scope || "TENANT",
        createdByBranchId: req.auth!.branchId || null,
        requiresDelivery: req.body.requiresDelivery || false,
        deliveryAddress: req.body.deliveryAddress || null,
        deliveryCity: req.body.deliveryCity || null,
        deliveryAddressNotes: req.body.deliveryAddressNotes || null,
        deliveryStatus: req.body.requiresDelivery ? "pending" : null,
      });
      if (data.statusId) {
        await storage.createOrderHistory({
          tenantId,
          orderId: data.id,
          statusId: data.statusId,
          changedById: req.auth!.userId,
          note: "Pedido creado",
        });
      }
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/orders/:id/status", tenantAuth, enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderId = parseInt(req.params.id as string);
      const { statusId, note } = req.body;
      const order = await storage.getOrderById(orderId, tenantId);
      if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
      if (req.auth!.scope === "BRANCH" && order.branchId !== req.auth!.branchId) {
        return res.status(403).json({ error: "No tenés acceso a este pedido" });
      }
      await storage.updateOrderStatus(orderId, tenantId, statusId);
      await storage.createOrderHistory({
        tenantId,
        orderId,
        statusId,
        changedById: req.auth!.userId,
        note: note || null,
      });
      const status = await storage.getOrderStatusById(statusId, tenantId);
      if (status?.isFinal) {
        const config = await storage.getConfig(tenantId);
        const hours = config?.trackingExpirationHours || 24;
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        if (order.publicTrackingId) {
          await storage.updateOrderTracking(orderId, tenantId, order.publicTrackingId, expiresAt);
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders/:id/comments", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderComments(
        parseInt(req.params.id as string),
        req.auth!.tenantId!
      );
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders/:id/comments", tenantAuth, async (req, res) => {
    try {
      const data = await storage.createOrderComment({
        tenantId: req.auth!.tenantId!,
        orderId: parseInt(req.params.id as string),
        userId: req.auth!.userId,
        content: req.body.content,
        isPublic: req.body.isPublic || false,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders/:id/history", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderHistory(
        parseInt(req.params.id as string),
        req.auth!.tenantId!
      );
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders/:id/tracking-link", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderId = parseInt(req.params.id as string);
      const order = await storage.getOrderById(orderId, tenantId);
      if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
      const config = await storage.getConfig(tenantId);
      const hours = config?.trackingExpirationHours || 24;
      const trackingId = randomUUID();
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      await storage.updateOrderTracking(orderId, tenantId, trackingId, expiresAt);
      res.json({ data: { publicTrackingId: trackingId, expiresAt } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders/:orderId/delivery-proofs", tenantAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId as string);
      const proofs = await storage.getDeliveryProofsByOrder(orderId);
      res.json({ data: proofs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
