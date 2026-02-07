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
  getTenantPlan,
} from "./auth";
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
      if (!tenant || !tenant.isActive) {
        return res.status(401).json({ error: "Negocio no encontrado o inactivo" });
      }
      const user = await storage.getUserByEmail(email, tenant.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        isSuperAdmin: false,
        branchId: user.branchId,
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
        },
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
  app.get("/api/orders", tenantAuth, async (req, res) => {
    try {
      const data = await storage.getOrders(req.auth!.tenantId!);
      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderNumber = await storage.getNextOrderNumber(tenantId);
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
        createdById: req.auth!.userId,
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

  app.patch("/api/orders/:id/status", tenantAuth, async (req, res) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const orderId = parseInt(req.params.id);
      const { statusId, note } = req.body;
      const order = await storage.getOrderById(orderId, tenantId);
      if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
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
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
