import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  generateToken,
  hashPassword,
  comparePassword,
  superAuth,
  tenantAuth,
  requireFeature,
  requireAddon,
  deliveryAuth,
  getTenantPlan,
  enforceBranchScope,
  blockBranchScope,
} from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== AUTH ====================

  // Super Admin Login
  app.post("/api/auth/super/login", async (req, res) => {
    try {
      const { email, password } = req.body;
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
      res.status(500).json({ error: err.message });
    }
  });

  // Tenant Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { tenantCode, email, password } = req.body;
      if (!tenantCode || !email || !password) {
        return res.status(400).json({ error: "Código, email y contraseña requeridos" });
      }
      const tenant = await storage.getTenantByCode(tenantCode);
      if (!tenant) {
        return res.status(401).json({ error: "Negocio no encontrado" });
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
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== SUPER ADMIN ROUTES ====================

  app.get("/api/super/plans", superAuth, async (_req, res) => {
    try {
      const data = await storage.getPlans();
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/super/tenants", superAuth, async (_req, res) => {
    try {
      const data = await storage.getTenants();
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants", superAuth, async (req, res) => {
    try {
      const { code, name, planId, adminEmail, adminPassword, adminName } = req.body;
      if (!code || !name || !adminEmail || !adminPassword || !adminName) {
        return res.status(400).json({ error: "Campos requeridos faltantes" });
      }
      const existing = await storage.getTenantByCode(code);
      if (existing) {
        return res.status(400).json({ error: "Código de negocio ya existe" });
      }
      const tenant = await storage.createTenant({
        code,
        name,
        slug: code,
        planId: planId || null,
        isActive: true,
      });
      const hashedPassword = await hashPassword(adminPassword);
      await storage.createUser({
        tenantId: tenant.id,
        email: adminEmail,
        password: hashedPassword,
        fullName: adminName,
        role: "admin",
        isActive: true,
        isSuperAdmin: false,
      });
      await storage.upsertConfig({
        tenantId: tenant.id,
        businessName: name,
        currency: "ARS",
        trackingExpirationHours: 24,
        language: "es",
      });
      // Create default order statuses
      const defaultStatuses = [
        { name: "Pendiente", color: "#F59E0B", sortOrder: 0, isFinal: false },
        { name: "En Proceso", color: "#3B82F6", sortOrder: 1, isFinal: false },
        { name: "Listo", color: "#8B5CF6", sortOrder: 2, isFinal: false },
        { name: "Entregado", color: "#10B981", sortOrder: 3, isFinal: true },
        { name: "Cancelado", color: "#EF4444", sortOrder: 4, isFinal: true },
      ];
      for (const s of defaultStatuses) {
        await storage.createOrderStatus({ tenantId: tenant.id, ...s });
      }
      res.status(201).json({ data: tenant });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/plan", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const { planId } = req.body;
      await storage.updateTenantPlan(tenantId, planId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT ROUTES ====================

  // Me / Plan info
  app.get("/api/me", tenantAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.auth!.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          scope: user.scope || "TENANT",
          tenantId: user.tenantId,
          branchId: user.branchId,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/me/plan", tenantAuth, async (req, res) => {
    try {
      const plan = await getTenantPlan(req.auth!.tenantId!);
      res.json({ data: plan || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Config
  app.get("/api/config", tenantAuth, async (req, res) => {
    try {
      const config = await storage.getConfig(req.auth!.tenantId!);
      res.json({ data: config || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/config", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const plan = await getTenantPlan(tenantId);
      if (plan && req.body.trackingExpirationHours !== undefined) {
        const hours = parseInt(req.body.trackingExpirationHours);
        const minH = plan.limits.tracking_retention_min_hours || 1;
        const maxH = plan.limits.tracking_retention_max_hours || 24;
        if (hours < minH || hours > maxH) {
          return res.status(400).json({
            error: `Tu plan "${plan.name}" permite entre ${minH}h y ${maxH}h de retención de tracking.`,
            code: "LIMIT_EXCEEDED",
            min: minH,
            max: maxH,
          });
        }
      }
      const config = await storage.upsertConfig({
        tenantId,
        ...req.body,
      });
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const [totalOrders, totalProducts, monthlyIncome, monthlyExpenses, todayIncome, todayExpenses] =
        await Promise.all([
          storage.countOrders(tenantId),
          storage.countProducts(tenantId),
          storage.getMonthlyIncome(tenantId),
          storage.getMonthlyExpenses(tenantId),
          storage.getTodayIncome(tenantId),
          storage.getTodayExpenses(tenantId),
        ]);
      const allOrders = await storage.getOrders(tenantId);
      const statuses = await storage.getOrderStatuses(tenantId);
      const finalStatusIds = statuses.filter((s) => s.isFinal).map((s) => s.id);
      const openOrders = allOrders.filter((o) => !finalStatusIds.includes(o.statusId!)).length;

      res.json({
        data: {
          totalOrders,
          openOrders,
          todayIncome,
          todayExpenses,
          totalProducts,
          monthlyIncome,
          monthlyExpenses,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Branches
  app.get("/api/branches", tenantAuth, requireFeature("branches"), async (req, res) => {
    try {
      const data = await storage.getBranches(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/branches", tenantAuth, requireFeature("branches"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const plan = req.plan!;
      const maxBranches = plan.limits.max_branches;
      if (maxBranches >= 0) {
        const existing = await storage.getBranches(tenantId);
        if (existing.length >= maxBranches) {
          return res.status(403).json({
            error: `Tu plan "${plan.name}" permite máximo ${maxBranches} sucursales. Mejorá tu plan para agregar más.`,
            code: "LIMIT_REACHED",
            limit: "max_branches",
            currentPlan: plan.planCode,
          });
        }
      }
      const data = await storage.createBranch({
        tenantId,
        ...req.body,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Order Statuses
  app.get("/api/order-statuses", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderStatuses(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Orders
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
      const orderId = parseInt(req.params.id);
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
      // Check if this is a final status and set closedAt
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

  // Order Comments
  app.get("/api/orders/:id/comments", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderComments(
        parseInt(req.params.id),
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
        orderId: parseInt(req.params.id),
        userId: req.auth!.userId,
        content: req.body.content,
        isPublic: req.body.isPublic || false,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Order History
  app.get("/api/orders/:id/history", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrderHistory(
        parseInt(req.params.id),
        req.auth!.tenantId!
      );
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Order Tracking Link
  app.post("/api/orders/:id/tracking-link", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderId = parseInt(req.params.id);
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

  // Cash Sessions
  app.get("/api/cash/sessions", tenantAuth, requireFeature("cash_sessions"), async (req, res) => {
    try {
      const data = await storage.getCashSessions(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cash/sessions", tenantAuth, requireFeature("cash_sessions"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const existing = await storage.getOpenSession(tenantId);
      if (existing) {
        return res.status(400).json({ error: "Ya hay una caja abierta" });
      }
      const data = await storage.createCashSession({
        tenantId,
        userId: req.auth!.userId,
        openingAmount: String(req.body.openingAmount || 0),
        status: "open",
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/cash/sessions/:id/close", tenantAuth, requireFeature("cash_sessions"), async (req, res) => {
    try {
      await storage.closeCashSession(
        parseInt(req.params.id),
        req.auth!.tenantId!,
        String(req.body.closingAmount || 0)
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cash Movements
  app.get("/api/cash/movements", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getCashMovements(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cash/movements", tenantAuth, async (req, res) => {
    try {
      const data = await storage.createCashMovement({
        tenantId: req.auth!.tenantId!,
        type: req.body.type,
        amount: String(req.body.amount),
        method: req.body.method || "efectivo",
        category: req.body.category || null,
        description: req.body.description || null,
        sessionId: req.body.sessionId || null,
        createdById: req.auth!.userId,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Product Categories
  app.get("/api/product-categories", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.getProductCategories(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/product-categories", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.createProductCategory({
        tenantId: req.auth!.tenantId!,
        name: req.body.name,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products
  app.get("/api/products", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.getProducts(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/products", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const data = await storage.createProduct({
        tenantId: req.auth!.tenantId!,
        name: req.body.name,
        description: req.body.description || null,
        price: String(req.body.price),
        sku: req.body.sku || null,
        categoryId: req.body.categoryId || null,
      });
      res.status(201).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== STT / AI (via microservice) ====================
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

  // ==================== PRODUCT STOCK BY BRANCH ====================
  app.get("/api/products/:id/stock", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id);
      const product = await storage.getProductById(productId, tenantId);
      if (!product) return res.status(404).json({ error: "Producto no encontrado" });
      const stockByBranch = await storage.getProductStockByBranch(productId, tenantId);
      const movements = await storage.getStockMovements(productId, tenantId);
      res.json({ data: { stockByBranch, movements } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/products/:id/stock", tenantAuth, requireFeature("products"), enforceBranchScope, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id);
      const { branchId, stock, reason } = req.body;
      if (branchId === undefined || stock === undefined) {
        return res.status(400).json({ error: "branchId y stock son obligatorios" });
      }
      const stockNum = parseInt(String(stock));
      if (isNaN(stockNum) || stockNum < 0) {
        return res.status(400).json({ error: "Stock debe ser un número entero no negativo" });
      }
      const product = await storage.getProductById(productId, tenantId);
      if (!product) return res.status(404).json({ error: "Producto no encontrado" });

      const targetBranchId = req.auth!.scope === "BRANCH" ? req.auth!.branchId! : branchId;
      const existing = await storage.getProductStockByBranch(productId, tenantId);
      const prev = existing.find(s => s.branchId === targetBranchId);
      const prevStock = prev?.stock || 0;
      const delta = stockNum - prevStock;

      await storage.upsertProductStockByBranch({
        tenantId,
        productId,
        branchId: targetBranchId,
        stock: stockNum,
      });

      if (delta !== 0) {
        await storage.createStockMovement({
          tenantId,
          productId,
          branchId: targetBranchId,
          quantity: delta,
          reason: reason || null,
          userId: req.auth!.userId,
        });
      }

      const updatedStock = await storage.getProductStockByBranch(productId, tenantId);
      res.json({ data: updatedStock });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== PRODUCT UPDATES ====================
  app.put("/api/products/:id", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id);
      const existing = await storage.getProductById(productId, tenantId);
      if (!existing) return res.status(404).json({ error: "Producto no encontrado" });

      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.price !== undefined) updateData.price = String(req.body.price);
      if (req.body.cost !== undefined) updateData.cost = req.body.cost !== null ? String(req.body.cost) : null;
      if (req.body.stock !== undefined) updateData.stock = req.body.stock;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku;
      if (req.body.categoryId !== undefined) updateData.categoryId = req.body.categoryId;

      const product = await storage.updateProduct(productId, tenantId, updateData);
      res.json({ data: product });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/products/:id/toggle", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const productId = parseInt(req.params.id);
      const existing = await storage.getProductById(productId, tenantId);
      if (!existing) return res.status(404).json({ error: "Producto no encontrado" });
      await storage.toggleProductActive(productId, tenantId, !existing.isActive);
      res.json({ data: { isActive: !existing.isActive } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/products/export", tenantAuth, requireFeature("products"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const allProducts = await storage.getProducts(tenantId);
      const categories = await storage.getProductCategories(tenantId);
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const config = await storage.getConfig(tenantId);

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 40 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=productos.pdf");
      doc.pipe(res);

      doc.fontSize(18).text(config?.businessName || "Productos", { align: "center" });
      doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, { align: "center" });
      doc.moveDown(1);

      const headers = ["Nombre", "Precio", "Costo", "Stock", "SKU", "Categoría", "Activo"];
      const colWidths = [140, 65, 65, 50, 70, 90, 45];
      const tableLeft = 40;
      let y = doc.y;

      doc.fontSize(8).font("Helvetica-Bold");
      let x = tableLeft;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 16;
      doc.moveTo(tableLeft, y).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 4;

      doc.font("Helvetica").fontSize(7);
      for (const p of allProducts) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        const catName = p.categoryId ? catMap.get(p.categoryId) || "" : "";
        const row = [
          p.name || "",
          p.price ? `$${p.price}` : "",
          p.cost ? `$${p.cost}` : "",
          p.stock?.toString() ?? "",
          p.sku || "",
          catName,
          p.isActive ? "Si" : "No",
        ];
        x = tableLeft;
        row.forEach((val, i) => {
          doc.text(val, x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });
        y += 14;
      }

      doc.moveDown(2);
      doc.fontSize(8).text(`Total: ${allProducts.length} productos`, { align: "right" });

      doc.end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== BRANCH-SCOPED QUERIES ====================
  app.get("/api/branches/:branchId/orders", tenantAuth, requireFeature("branches"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = parseInt(req.params.branchId);
      const branch = await storage.getBranchById(branchId, tenantId);
      if (!branch) return res.status(404).json({ error: "Sucursal no encontrada" });
      const data = await storage.getOrdersByBranch(tenantId, branchId);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/branches/:branchId/cash/movements", tenantAuth, requireFeature("branches"), async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = parseInt(req.params.branchId);
      const branch = await storage.getBranchById(branchId, tenantId);
      if (!branch) return res.status(404).json({ error: "Sucursal no encontrada" });
      const data = await storage.getCashMovementsByBranch(tenantId, branchId);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== PUBLIC TRACKING ====================
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

  // ==================== SUPER ADMIN: ADDON MANAGEMENT ====================

  app.get("/api/super/tenants/:tenantId/addons", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const addons = await storage.getTenantAddons(tenantId);
      res.json({ data: addons });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/tenants/:tenantId/addons", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { addonKey, enabled } = req.body;
      if (!addonKey) return res.status(400).json({ error: "addonKey requerido" });
      const addon = await storage.upsertTenantAddon({
        tenantId,
        addonKey,
        enabled: enabled ?? true,
        enabledById: req.auth!.userId,
        enabledAt: enabled ? new Date() : null,
      });
      res.json({ data: addon });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== SUPER ADMIN: SUBSCRIPTION MANAGEMENT ====================

  app.patch("/api/super/tenants/:tenantId/subscription", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate y endDate requeridos" });
      }
      await storage.updateTenantSubscription(tenantId, new Date(startDate), new Date(endDate));
      await storage.updateTenantActive(tenantId, true);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/super/tenants/:tenantId/block", superAuth, async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId as string);
      const { isActive } = req.body;
      await storage.updateTenantActive(tenantId, isActive ?? false);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== SUPER ADMIN: PROFILE CONFIG ====================

  const profileUploadDir = path.join(process.cwd(), "uploads", "profiles");
  if (!fs.existsSync(profileUploadDir)) {
    fs.mkdirSync(profileUploadDir, { recursive: true });
  }
  const profileUpload = multer({
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

  const expressModule = await import("express");
  app.use("/uploads/profiles", expressModule.default.static(profileUploadDir));

  app.get("/api/super/config", superAuth, async (req, res) => {
    try {
      const config = await storage.getSuperAdminConfig(req.auth!.userId);
      res.json({ data: config || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/super/config/avatar", superAuth, profileUpload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;
      const config = await storage.upsertSuperAdminConfig({
        userId: req.auth!.userId,
        avatarUrl,
      });
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: LOGO UPLOAD ====================

  app.post("/api/config/logo", tenantAuth, profileUpload.single("logo"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
      const logoUrl = `/uploads/profiles/${req.file.filename}`;
      const config = await storage.upsertConfig({
        tenantId: req.auth!.tenantId!,
        logoUrl,
      });
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: SUBSCRIPTION STATUS ====================

  app.get("/api/subscription/status", tenantAuth, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.auth!.tenantId!);
      if (!tenant) return res.status(404).json({ error: "Tenant no encontrado" });
      let warning: string | null = null;
      let status: "active" | "warning" | "grace" | "blocked" = "active";
      if (tenant.subscriptionEndDate) {
        const now = new Date();
        const endDate = new Date(tenant.subscriptionEndDate);
        const graceDays = 3;
        const graceEnd = new Date(endDate);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        if (now > graceEnd) {
          status = "blocked";
          warning = "Cuenta bloqueada por falta de pago. Contacte al administrador.";
        } else if (now > endDate) {
          status = "grace";
          const msLeft = graceEnd.getTime() - now.getTime();
          const hoursLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
          const daysLeft = Math.floor(hoursLeft / 24);
          warning = daysLeft > 0
            ? `Tu suscripción venció. Tenés ${daysLeft} día(s) y ${hoursLeft % 24}h para renovar.`
            : `Tu suscripción venció. Tenés ${hoursLeft}h para renovar.`;
        } else {
          const msLeft = endDate.getTime() - now.getTime();
          const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
          if (daysLeft <= 7) {
            status = "warning";
            warning = `Tu suscripción vence en ${daysLeft} día(s). Renová a tiempo.`;
          }
        }
      }
      res.json({
        data: {
          subscriptionStartDate: tenant.subscriptionStartDate,
          subscriptionEndDate: tenant.subscriptionEndDate,
          isActive: tenant.isActive,
          status,
          warning,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== DELIVERY AUTH ====================

  app.post("/api/delivery/auth/login", async (req, res) => {
    try {
      const { tenantCode, dni, pin } = req.body;
      if (!tenantCode || !dni || !pin) {
        return res.status(400).json({ error: "Código de negocio, DNI y PIN requeridos" });
      }
      const tenant = await storage.getTenantByCode(tenantCode);
      if (!tenant || !tenant.isActive) {
        return res.status(401).json({ error: "Negocio no encontrado o inactivo" });
      }
      const addon = await storage.getTenantAddon(tenant.id, "delivery");
      if (!addon?.enabled) {
        return res.status(403).json({ error: "El addon de delivery no está habilitado", code: "ADDON_NOT_ENABLED" });
      }
      const agent = await storage.getDeliveryAgentByDni(dni, tenant.id);
      if (!agent || !agent.isActive) {
        return res.status(401).json({ error: "Delivery no encontrado o inactivo" });
      }
      const validPin = await comparePassword(pin, agent.pinHash);
      if (!validPin) {
        return res.status(401).json({ error: "PIN incorrecto" });
      }
      const token = generateToken({
        userId: agent.id,
        email: "",
        role: "delivery",
        tenantId: tenant.id,
        isSuperAdmin: false,
        branchId: null,
        scope: "DELIVERY",
        deliveryAgentId: agent.id,
      });
      res.json({
        token,
        agent: {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          dni: agent.dni,
          tenantId: tenant.id,
        },
        tenantName: tenant.name,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: DELIVERY AGENTS CRUD ====================

  app.get("/api/delivery/agents", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const agents = await storage.getDeliveryAgents(req.auth!.tenantId!);
      const safeAgents = agents.map(({ pinHash, ...rest }) => rest);
      res.json({ data: safeAgents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delivery/agents", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const { dni, firstName, lastName, phone, pin } = req.body;
      if (!dni || !firstName || !lastName || !phone || !pin) {
        return res.status(400).json({ error: "DNI, nombre, apellido, teléfono y PIN son obligatorios" });
      }
      const existing = await storage.getDeliveryAgentByDni(dni, req.auth!.tenantId!);
      if (existing) {
        return res.status(409).json({ error: "Ya existe un delivery con ese DNI" });
      }
      const pinHash = await hashPassword(pin);
      const agent = await storage.createDeliveryAgent({
        tenantId: req.auth!.tenantId!,
        dni,
        firstName,
        lastName,
        phone,
        pinHash,
        isActive: true,
      });
      const { pinHash: _, ...safeAgent } = agent;
      res.status(201).json({ data: safeAgent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/delivery/agents/:id", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const { firstName, lastName, phone, pin, isActive } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (phone !== undefined) updates.phone = phone;
      if (pin !== undefined) updates.pinHash = await hashPassword(pin);
      if (isActive !== undefined) updates.isActive = isActive;
      const agent = await storage.updateDeliveryAgent(id, req.auth!.tenantId!, updates);
      if (!agent) return res.status(404).json({ error: "Delivery no encontrado" });
      const { pinHash: _, ...safeAgent } = agent;
      res.json({ data: safeAgent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/delivery/agents/:id/toggle", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const agent = await storage.getDeliveryAgentById(id, req.auth!.tenantId!);
      if (!agent) return res.status(404).json({ error: "Delivery no encontrado" });
      await storage.toggleDeliveryAgentActive(id, req.auth!.tenantId!, !agent.isActive);
      res.json({ data: { isActive: !agent.isActive } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: DELIVERY ACTION STATES ====================

  app.get("/api/delivery/action-states", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const states = await storage.getDeliveryActionStates(req.auth!.tenantId!);
      res.json({ data: states });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delivery/action-states", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const { code, label, requiresPhoto, requiresComment, nextOrderStatusId, sortOrder } = req.body;
      if (!code || !label) return res.status(400).json({ error: "code y label son obligatorios" });
      const state = await storage.createDeliveryActionState({
        tenantId: req.auth!.tenantId!,
        code,
        label,
        requiresPhoto: requiresPhoto ?? true,
        requiresComment: requiresComment ?? false,
        nextOrderStatusId: nextOrderStatusId ?? null,
        sortOrder: sortOrder ?? 0,
      });
      res.status(201).json({ data: state });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/delivery/action-states/:id", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const state = await storage.updateDeliveryActionState(id, req.auth!.tenantId!, req.body);
      res.json({ data: state });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/delivery/action-states/:id", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      await storage.deleteDeliveryActionState(id, req.auth!.tenantId!);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: DELIVERY ROUTES VIEW ====================

  app.get("/api/delivery/routes", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const routes = await storage.getDeliveryRoutes(req.auth!.tenantId!);
      const routesWithStops = await Promise.all(
        routes.map(async (route) => {
          const stops = await storage.getRouteStops(route.id);
          return { ...route, stops };
        })
      );
      res.json({ data: routesWithStops });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: DELIVERY ORDERS VIEW ====================

  app.get("/api/delivery/orders", tenantAuth, requireAddon("delivery"), async (req, res) => {
    try {
      const deliveryOrders = await storage.getDeliveryOrders(req.auth!.tenantId!);
      res.json({ data: deliveryOrders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: CHECK ADDON STATUS ====================

  app.get("/api/addons/status", tenantAuth, async (req, res) => {
    try {
      const addons = await storage.getTenantAddons(req.auth!.tenantId!);
      const result: Record<string, boolean> = {};
      for (const a of addons) {
        result[a.addonKey] = a.enabled;
      }
      res.json({ data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== DELIVERY AGENT PANEL ENDPOINTS ====================

  app.get("/api/delivery/agent/action-states", deliveryAuth, async (req, res) => {
    try {
      const states = await storage.getDeliveryActionStates(req.auth!.tenantId!);
      res.json({ data: states });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/delivery/me", deliveryAuth, async (req, res) => {
    try {
      const agent = await storage.getDeliveryAgentById(req.auth!.deliveryAgentId!, req.auth!.tenantId!);
      if (!agent) return res.status(404).json({ error: "Agente no encontrado" });
      const { pinHash, ...safeAgent } = agent;
      const tenant = await storage.getTenantById(req.auth!.tenantId!);
      res.json({ data: safeAgent, tenantName: tenant?.name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/delivery/orders/available", deliveryAuth, async (req, res) => {
    try {
      const allOrders = await storage.getDeliveryOrders(req.auth!.tenantId!);
      const available = allOrders.filter(
        (o) => !o.assignedAgentId || o.deliveryStatus === "pending"
      );
      const branches_list = await storage.getBranches(req.auth!.tenantId!);
      const enriched = available.map((o) => ({
        ...o,
        branchName: branches_list.find((b) => b.id === o.branchId)?.name || "General",
      }));
      res.json({ data: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delivery/routes", deliveryAuth, async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Se requiere al menos un pedido" });
      }
      const existingActive = await storage.getActiveRouteByAgent(req.auth!.deliveryAgentId!, req.auth!.tenantId!);
      if (existingActive) {
        return res.status(409).json({ error: "Ya tenés una ruta activa. Completala antes de crear otra." });
      }
      const route = await storage.createDeliveryRoute({
        tenantId: req.auth!.tenantId!,
        agentId: req.auth!.deliveryAgentId!,
        status: "active",
      });
      for (let i = 0; i < orderIds.length; i++) {
        await storage.createRouteStop({
          routeId: route.id,
          orderId: orderIds[i],
          stopOrder: i + 1,
        });
        await storage.assignDeliveryAgent(orderIds[i], req.auth!.tenantId!, req.auth!.deliveryAgentId!);
      }
      const stops = await storage.getRouteStops(route.id);
      res.status(201).json({ data: { ...route, stops } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/delivery/routes/active", deliveryAuth, async (req, res) => {
    try {
      const route = await storage.getActiveRouteByAgent(req.auth!.deliveryAgentId!, req.auth!.tenantId!);
      if (!route) return res.json({ data: null });
      const stops = await storage.getRouteStops(route.id);
      const enrichedStops = await Promise.all(
        stops.map(async (stop) => {
          const order = await storage.getOrderById(stop.orderId, req.auth!.tenantId!);
          return { ...stop, order };
        })
      );
      res.json({ data: { ...route, stops: enrichedStops } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/delivery/routes/history", deliveryAuth, async (req, res) => {
    try {
      const routes = await storage.getDeliveryRoutesByAgent(req.auth!.deliveryAgentId!, req.auth!.tenantId!);
      const completed = routes.filter((r) => r.status === "completed");
      res.json({ data: completed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/delivery/routes/:routeId", deliveryAuth, async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId as string);
      const route = await storage.getDeliveryRouteById(routeId, req.auth!.tenantId!);
      if (!route) return res.status(404).json({ error: "Ruta no encontrada" });
      if (route.agentId !== req.auth!.deliveryAgentId) {
        return res.status(403).json({ error: "No tenés acceso a esta ruta" });
      }
      const stops = await storage.getRouteStops(route.id);
      const enrichedStops = await Promise.all(
        stops.map(async (stop) => {
          const order = await storage.getOrderById(stop.orderId, req.auth!.tenantId!);
          return { ...stop, order };
        })
      );
      res.json({ data: { ...route, stops: enrichedStops } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Photo upload config
  const uploadDir = path.join(process.cwd(), "uploads", "delivery");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
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

  const express = await import("express");
  app.use("/uploads/delivery", express.default.static(uploadDir));

  app.post(
    "/api/delivery/routes/:routeId/stops/:stopId/action",
    deliveryAuth,
    upload.single("photo"),
    async (req, res) => {
      try {
        const routeId = parseInt(req.params.routeId as string);
        const stopId = parseInt(req.params.stopId as string);
        const { actionCode, notes } = req.body;

        if (!actionCode) return res.status(400).json({ error: "actionCode requerido" });

        const route = await storage.getDeliveryRouteById(routeId, req.auth!.tenantId!);
        if (!route || route.agentId !== req.auth!.deliveryAgentId) {
          return res.status(403).json({ error: "Sin acceso a esta ruta" });
        }

        const stops = await storage.getRouteStops(routeId);
        const stop = stops.find((s) => s.id === stopId);
        if (!stop) return res.status(404).json({ error: "Parada no encontrada" });

        const actionStates = await storage.getDeliveryActionStates(req.auth!.tenantId!);
        const actionState = actionStates.find((s) => s.code === actionCode);
        if (!actionState) return res.status(400).json({ error: "Estado de acción inválido" });

        if (actionState.requiresPhoto && !req.file) {
          return res.status(400).json({ error: "Esta acción requiere una foto" });
        }

        await storage.updateRouteStopAction(stopId, actionState.id);

        const photoUrl = req.file ? `/uploads/delivery/${req.file.filename}` : null;
        const proof = await storage.createDeliveryProof({
          tenantId: req.auth!.tenantId!,
          routeId,
          stopId,
          orderId: stop.orderId,
          actionCode,
          photoUrl,
          notes: notes || null,
          deliveredById: req.auth!.deliveryAgentId!,
        });

        await storage.updateOrderDeliveryStatus(stop.orderId, req.auth!.tenantId!, actionCode.toLowerCase());

        if (actionState.nextOrderStatusId) {
          await storage.updateOrderStatus(stop.orderId, req.auth!.tenantId!, actionState.nextOrderStatusId);
        }

        res.json({ data: proof });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post("/api/delivery/routes/:routeId/complete", deliveryAuth, async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId as string);
      const route = await storage.getDeliveryRouteById(routeId, req.auth!.tenantId!);
      if (!route || route.agentId !== req.auth!.deliveryAgentId) {
        return res.status(403).json({ error: "Sin acceso a esta ruta" });
      }
      const stops = await storage.getRouteStops(routeId);
      const pending = stops.filter((s) => !s.actionStateId);
      if (pending.length > 0) {
        return res.status(400).json({
          error: `Hay ${pending.length} parada(s) sin acción. Completá todas antes de finalizar.`,
        });
      }
      await storage.completeDeliveryRoute(routeId, req.auth!.tenantId!);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TENANT: DELIVERY PROOF VIEW ====================

  app.get("/api/orders/:orderId/delivery-proofs", tenantAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId as string);
      const proofs = await storage.getDeliveryProofsByOrder(orderId);
      res.json({ data: proofs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
