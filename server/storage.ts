import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  plans, tenants, users, tenantConfig, branches,
  orderStatuses, orders, orderStatusHistory, orderComments,
  cashSessions, cashMovements, expenseCategories, fixedExpenses,
  productCategories, products, sttLogs, superAdminConfig,
  tenantAddons, deliveryAgents, deliveryActionStates,
  deliveryRoutes, deliveryRouteStops, deliveryProofs,
  productStockByBranch, stockMovements,
  type InsertPlan, type Plan,
  type InsertTenant, type Tenant,
  type InsertUser, type User,
  type InsertTenantConfig, type TenantConfig,
  type InsertBranch, type Branch,
  type InsertOrderStatus, type OrderStatus,
  type InsertOrder, type Order,
  type InsertOrderStatusHistory,
  type InsertOrderComment, type OrderComment,
  type InsertCashSession, type CashSession,
  type InsertCashMovement, type CashMovement,
  type InsertProductCategory, type ProductCategory,
  type InsertProduct, type Product,
  type InsertSttLog, type SttLog,
  type InsertTenantAddon, type TenantAddon,
  type InsertDeliveryAgent, type DeliveryAgent,
  type InsertDeliveryActionState, type DeliveryActionState,
  type InsertDeliveryRoute, type DeliveryRoute,
  type InsertDeliveryRouteStop, type DeliveryRouteStop,
  type InsertDeliveryProof, type DeliveryProof,
  type InsertSuperAdminConfig, type SuperAdminConfig,
  type InsertProductStockByBranch, type ProductStockByBranch,
  type InsertStockMovement, type StockMovement,
} from "@shared/schema";

export interface IStorage {
  // Plans
  getPlans(): Promise<Plan[]>;
  getPlanById(id: number): Promise<Plan | undefined>;
  createPlan(data: InsertPlan): Promise<Plan>;

  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenantById(id: number): Promise<Tenant | undefined>;
  getTenantByCode(code: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  updateTenantPlan(tenantId: number, planId: number): Promise<void>;

  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId?: number | null): Promise<User | undefined>;
  getSuperAdminByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;

  // Config
  getConfig(tenantId: number): Promise<TenantConfig | undefined>;
  upsertConfig(data: InsertTenantConfig): Promise<TenantConfig>;

  // Branches
  getBranches(tenantId: number): Promise<Branch[]>;
  createBranch(data: InsertBranch): Promise<Branch>;

  // Order Statuses
  getOrderStatuses(tenantId: number): Promise<OrderStatus[]>;
  getOrderStatusById(id: number, tenantId: number): Promise<OrderStatus | undefined>;
  createOrderStatus(data: InsertOrderStatus): Promise<OrderStatus>;

  // Orders
  getOrders(tenantId: number): Promise<Order[]>;
  getOrderById(id: number, tenantId: number): Promise<Order | undefined>;
  getOrderByTrackingId(trackingId: string): Promise<Order | undefined>;
  createOrder(data: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, tenantId: number, statusId: number): Promise<void>;
  updateOrderTracking(id: number, tenantId: number, trackingId: string, expiresAt: Date): Promise<void>;
  getNextOrderNumber(tenantId: number): Promise<number>;
  countOrders(tenantId: number): Promise<number>;

  // Order Status History
  getOrderHistory(orderId: number, tenantId: number): Promise<any[]>;
  createOrderHistory(data: InsertOrderStatusHistory): Promise<void>;

  // Order Comments
  getOrderComments(orderId: number, tenantId: number): Promise<OrderComment[]>;
  getPublicOrderComments(orderId: number): Promise<OrderComment[]>;
  createOrderComment(data: InsertOrderComment): Promise<OrderComment>;

  // Cash Sessions
  getCashSessions(tenantId: number): Promise<CashSession[]>;
  getOpenSession(tenantId: number): Promise<CashSession | undefined>;
  createCashSession(data: InsertCashSession): Promise<CashSession>;
  closeCashSession(id: number, tenantId: number, closingAmount: string): Promise<void>;

  // Cash Movements
  getCashMovements(tenantId: number): Promise<CashMovement[]>;
  createCashMovement(data: InsertCashMovement): Promise<CashMovement>;
  getMonthlyIncome(tenantId: number): Promise<number>;
  getMonthlyExpenses(tenantId: number): Promise<number>;
  getTodayIncome(tenantId: number): Promise<number>;
  getTodayExpenses(tenantId: number): Promise<number>;

  // Product Categories
  getProductCategories(tenantId: number): Promise<ProductCategory[]>;
  createProductCategory(data: InsertProductCategory): Promise<ProductCategory>;

  // Products
  getProducts(tenantId: number): Promise<Product[]>;
  getProductById(id: number, tenantId: number): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, tenantId: number, data: Partial<InsertProduct>): Promise<Product>;
  toggleProductActive(id: number, tenantId: number, isActive: boolean): Promise<void>;
  countProducts(tenantId: number): Promise<number>;

  // STT Logs
  createSttLog(data: InsertSttLog): Promise<SttLog>;
  getSttLogs(tenantId: number): Promise<SttLog[]>;

  // Branch-scoped queries
  getOrdersByBranch(tenantId: number, branchId: number): Promise<Order[]>;
  getCashSessionsByBranch(tenantId: number, branchId: number): Promise<CashSession[]>;
  getCashMovementsByBranch(tenantId: number, branchId: number): Promise<CashMovement[]>;
  getBranchById(id: number, tenantId: number): Promise<Branch | undefined>;

  // Tenant Addons
  getTenantAddon(tenantId: number, addonKey: string): Promise<TenantAddon | undefined>;
  getTenantAddons(tenantId: number): Promise<TenantAddon[]>;
  upsertTenantAddon(data: InsertTenantAddon): Promise<TenantAddon>;

  // Delivery Agents
  getDeliveryAgents(tenantId: number): Promise<DeliveryAgent[]>;
  getDeliveryAgentById(id: number, tenantId: number): Promise<DeliveryAgent | undefined>;
  getDeliveryAgentByDni(dni: string, tenantId: number): Promise<DeliveryAgent | undefined>;
  createDeliveryAgent(data: InsertDeliveryAgent): Promise<DeliveryAgent>;
  updateDeliveryAgent(id: number, tenantId: number, data: Partial<InsertDeliveryAgent>): Promise<DeliveryAgent>;
  toggleDeliveryAgentActive(id: number, tenantId: number, isActive: boolean): Promise<void>;

  // Delivery Action States
  getDeliveryActionStates(tenantId: number): Promise<DeliveryActionState[]>;
  createDeliveryActionState(data: InsertDeliveryActionState): Promise<DeliveryActionState>;
  updateDeliveryActionState(id: number, tenantId: number, data: Partial<InsertDeliveryActionState>): Promise<DeliveryActionState>;
  deleteDeliveryActionState(id: number, tenantId: number): Promise<void>;

  // Delivery Routes
  getDeliveryRoutes(tenantId: number): Promise<DeliveryRoute[]>;
  getDeliveryRoutesByAgent(agentId: number, tenantId: number): Promise<DeliveryRoute[]>;
  getActiveRouteByAgent(agentId: number, tenantId: number): Promise<DeliveryRoute | undefined>;
  getDeliveryRouteById(id: number, tenantId: number): Promise<DeliveryRoute | undefined>;
  createDeliveryRoute(data: InsertDeliveryRoute): Promise<DeliveryRoute>;
  completeDeliveryRoute(id: number, tenantId: number): Promise<void>;

  // Delivery Route Stops
  getRouteStops(routeId: number): Promise<DeliveryRouteStop[]>;
  createRouteStop(data: InsertDeliveryRouteStop): Promise<DeliveryRouteStop>;
  updateRouteStopAction(id: number, actionStateId: number): Promise<void>;

  // Delivery Proofs
  getDeliveryProofsByOrder(orderId: number): Promise<DeliveryProof[]>;
  createDeliveryProof(data: InsertDeliveryProof): Promise<DeliveryProof>;

  // Delivery-scoped orders
  getDeliveryOrders(tenantId: number): Promise<Order[]>;
  updateOrderDeliveryStatus(id: number, tenantId: number, status: string): Promise<void>;
  assignDeliveryAgent(orderId: number, tenantId: number, agentId: number): Promise<void>;

  // Super Admin Config
  getSuperAdminConfig(userId: number): Promise<SuperAdminConfig | undefined>;
  upsertSuperAdminConfig(data: InsertSuperAdminConfig): Promise<SuperAdminConfig>;

  // Tenant Subscription
  updateTenantSubscription(tenantId: number, startDate: Date, endDate: Date): Promise<void>;
  updateTenantActive(tenantId: number, isActive: boolean): Promise<void>;

  // Product Stock by Branch
  getProductStockByBranch(productId: number, tenantId: number): Promise<ProductStockByBranch[]>;
  upsertProductStockByBranch(data: InsertProductStockByBranch): Promise<ProductStockByBranch>;
  getStockMovements(productId: number, tenantId: number): Promise<StockMovement[]>;
  createStockMovement(data: InsertStockMovement): Promise<StockMovement>;

  // Tracking Purge
  purgeExpiredTracking(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Plans
  async getPlans() {
    return db.select().from(plans).where(eq(plans.isActive, true));
  }
  async getPlanById(id: number) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }
  async createPlan(data: InsertPlan) {
    const [plan] = await db.insert(plans).values(data).returning();
    return plan;
  }

  // Tenants
  async getTenants() {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }
  async getTenantById(id: number) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }
  async getTenantByCode(code: string) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.code, code));
    return tenant;
  }
  async createTenant(data: InsertTenant) {
    const [tenant] = await db.insert(tenants).values(data).returning();
    return tenant;
  }
  async updateTenantPlan(tenantId: number, planId: number) {
    await db.update(tenants).set({ planId }).where(eq(tenants.id, tenantId));
  }

  // Users
  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email: string, tenantId?: number | null) {
    if (tenantId) {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.tenantId, tenantId)));
      return user;
    }
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getSuperAdminByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isSuperAdmin, true)));
    return user;
  }
  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  // Config
  async getConfig(tenantId: number) {
    const [config] = await db.select().from(tenantConfig).where(eq(tenantConfig.tenantId, tenantId));
    return config;
  }
  async upsertConfig(data: InsertTenantConfig) {
    const existing = await this.getConfig(data.tenantId);
    if (existing) {
      const [config] = await db
        .update(tenantConfig)
        .set(data)
        .where(eq(tenantConfig.tenantId, data.tenantId))
        .returning();
      return config;
    }
    const [config] = await db.insert(tenantConfig).values(data).returning();
    return config;
  }

  // Branches
  async getBranches(tenantId: number) {
    return db.select().from(branches).where(eq(branches.tenantId, tenantId));
  }
  async createBranch(data: InsertBranch) {
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  }

  // Order Statuses
  async getOrderStatuses(tenantId: number) {
    return db
      .select()
      .from(orderStatuses)
      .where(eq(orderStatuses.tenantId, tenantId))
      .orderBy(orderStatuses.sortOrder);
  }
  async getOrderStatusById(id: number, tenantId: number) {
    const [status] = await db
      .select()
      .from(orderStatuses)
      .where(and(eq(orderStatuses.id, id), eq(orderStatuses.tenantId, tenantId)));
    return status;
  }
  async createOrderStatus(data: InsertOrderStatus) {
    const [status] = await db.insert(orderStatuses).values(data).returning();
    return status;
  }

  // Orders
  async getOrders(tenantId: number) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.createdAt));
  }
  async getOrderById(id: number, tenantId: number) {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
    return order;
  }
  async getOrderByTrackingId(trackingId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.publicTrackingId, trackingId));
    return order;
  }
  async createOrder(data: InsertOrder) {
    const [order] = await db.insert(orders).values(data).returning();
    return order;
  }
  async updateOrderStatus(id: number, tenantId: number, statusId: number) {
    await db
      .update(orders)
      .set({ statusId, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  }
  async updateOrderTracking(id: number, tenantId: number, trackingId: string, expiresAt: Date) {
    await db
      .update(orders)
      .set({ publicTrackingId: trackingId, trackingExpiresAt: expiresAt, trackingRevoked: false })
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  }
  async getNextOrderNumber(tenantId: number) {
    const result = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(${orders.orderNumber}), 0)` })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));
    return (result[0]?.maxNum || 0) + 1;
  }
  async countOrders(tenantId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));
    return result?.count || 0;
  }

  // Order Status History
  async getOrderHistory(orderId: number, tenantId: number) {
    return db
      .select()
      .from(orderStatusHistory)
      .where(and(eq(orderStatusHistory.orderId, orderId), eq(orderStatusHistory.tenantId, tenantId)))
      .orderBy(desc(orderStatusHistory.createdAt));
  }
  async createOrderHistory(data: InsertOrderStatusHistory) {
    await db.insert(orderStatusHistory).values(data);
  }

  // Order Comments
  async getOrderComments(orderId: number, tenantId: number) {
    return db
      .select()
      .from(orderComments)
      .where(and(eq(orderComments.orderId, orderId), eq(orderComments.tenantId, tenantId)))
      .orderBy(desc(orderComments.createdAt));
  }
  async getPublicOrderComments(orderId: number) {
    return db
      .select()
      .from(orderComments)
      .where(and(eq(orderComments.orderId, orderId), eq(orderComments.isPublic, true)))
      .orderBy(desc(orderComments.createdAt));
  }
  async createOrderComment(data: InsertOrderComment) {
    const [comment] = await db.insert(orderComments).values(data).returning();
    return comment;
  }

  // Cash Sessions
  async getCashSessions(tenantId: number) {
    return db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.tenantId, tenantId))
      .orderBy(desc(cashSessions.openedAt));
  }
  async getOpenSession(tenantId: number) {
    const [session] = await db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.tenantId, tenantId), eq(cashSessions.status, "open")));
    return session;
  }
  async createCashSession(data: InsertCashSession) {
    const [session] = await db.insert(cashSessions).values(data).returning();
    return session;
  }
  async closeCashSession(id: number, tenantId: number, closingAmount: string) {
    const session = await this.getOpenSession(tenantId);
    if (!session) throw new Error("No hay caja abierta");
    const diff = parseFloat(closingAmount) - parseFloat(session.openingAmount);
    await db
      .update(cashSessions)
      .set({
        status: "closed",
        closingAmount,
        difference: String(diff),
        closedAt: new Date(),
      })
      .where(and(eq(cashSessions.id, id), eq(cashSessions.tenantId, tenantId)));
  }

  // Cash Movements
  async getCashMovements(tenantId: number) {
    return db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId))
      .orderBy(desc(cashMovements.createdAt));
  }
  async createCashMovement(data: InsertCashMovement) {
    const [movement] = await db.insert(cashMovements).values(data).returning();
    return movement;
  }
  async getMonthlyIncome(tenantId: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.tenantId, tenantId),
          eq(cashMovements.type, "ingreso"),
          sql`${cashMovements.createdAt} >= ${startOfMonth}`
        )
      );
    return parseFloat(result[0]?.total || "0");
  }
  async getMonthlyExpenses(tenantId: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.tenantId, tenantId),
          eq(cashMovements.type, "egreso"),
          sql`${cashMovements.createdAt} >= ${startOfMonth}`
        )
      );
    return parseFloat(result[0]?.total || "0");
  }
  async getTodayIncome(tenantId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.tenantId, tenantId),
          eq(cashMovements.type, "ingreso"),
          sql`${cashMovements.createdAt} >= ${today}`
        )
      );
    return parseFloat(result[0]?.total || "0");
  }
  async getTodayExpenses(tenantId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.tenantId, tenantId),
          eq(cashMovements.type, "egreso"),
          sql`${cashMovements.createdAt} >= ${today}`
        )
      );
    return parseFloat(result[0]?.total || "0");
  }

  // Product Categories
  async getProductCategories(tenantId: number) {
    return db
      .select()
      .from(productCategories)
      .where(eq(productCategories.tenantId, tenantId))
      .orderBy(productCategories.sortOrder);
  }
  async createProductCategory(data: InsertProductCategory) {
    const [cat] = await db.insert(productCategories).values(data).returning();
    return cat;
  }

  // Products
  async getProducts(tenantId: number) {
    return db
      .select()
      .from(products)
      .where(eq(products.tenantId, tenantId))
      .orderBy(desc(products.createdAt));
  }
  async getProductById(id: number, tenantId: number) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
    return product;
  }
  async createProduct(data: InsertProduct) {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }
  async updateProduct(id: number, tenantId: number, data: Partial<InsertProduct>) {
    const [product] = await db
      .update(products)
      .set(data)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning();
    return product;
  }
  async toggleProductActive(id: number, tenantId: number, isActive: boolean) {
    await db
      .update(products)
      .set({ isActive })
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
  }
  async countProducts(tenantId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.tenantId, tenantId));
    return result?.count || 0;
  }

  // STT Logs
  async createSttLog(data: InsertSttLog) {
    const [log] = await db.insert(sttLogs).values(data).returning();
    return log;
  }
  async getSttLogs(tenantId: number) {
    return db
      .select()
      .from(sttLogs)
      .where(eq(sttLogs.tenantId, tenantId))
      .orderBy(desc(sttLogs.createdAt));
  }

  // Branch-scoped queries
  async getOrdersByBranch(tenantId: number, branchId: number) {
    return db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.branchId, branchId)))
      .orderBy(desc(orders.createdAt));
  }
  async getCashSessionsByBranch(tenantId: number, branchId: number) {
    return db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.tenantId, tenantId), eq(cashSessions.branchId, branchId)))
      .orderBy(desc(cashSessions.openedAt));
  }
  async getCashMovementsByBranch(tenantId: number, branchId: number) {
    return db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.branchId, branchId)))
      .orderBy(desc(cashMovements.createdAt));
  }
  async getBranchById(id: number, tenantId: number) {
    const [branch] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)));
    return branch;
  }

  // Tenant Addons
  async getTenantAddon(tenantId: number, addonKey: string) {
    const [addon] = await db
      .select()
      .from(tenantAddons)
      .where(and(eq(tenantAddons.tenantId, tenantId), eq(tenantAddons.addonKey, addonKey)));
    return addon;
  }
  async getTenantAddons(tenantId: number) {
    return db.select().from(tenantAddons).where(eq(tenantAddons.tenantId, tenantId));
  }
  async upsertTenantAddon(data: InsertTenantAddon) {
    const existing = await this.getTenantAddon(data.tenantId, data.addonKey);
    if (existing) {
      const [addon] = await db
        .update(tenantAddons)
        .set({ enabled: data.enabled, enabledById: data.enabledById, enabledAt: data.enabledAt })
        .where(eq(tenantAddons.id, existing.id))
        .returning();
      return addon;
    }
    const [addon] = await db.insert(tenantAddons).values(data).returning();
    return addon;
  }

  // Delivery Agents
  async getDeliveryAgents(tenantId: number) {
    return db.select().from(deliveryAgents).where(eq(deliveryAgents.tenantId, tenantId)).orderBy(desc(deliveryAgents.createdAt));
  }
  async getDeliveryAgentById(id: number, tenantId: number) {
    const [agent] = await db
      .select()
      .from(deliveryAgents)
      .where(and(eq(deliveryAgents.id, id), eq(deliveryAgents.tenantId, tenantId)));
    return agent;
  }
  async getDeliveryAgentByDni(dni: string, tenantId: number) {
    const [agent] = await db
      .select()
      .from(deliveryAgents)
      .where(and(eq(deliveryAgents.dni, dni), eq(deliveryAgents.tenantId, tenantId)));
    return agent;
  }
  async createDeliveryAgent(data: InsertDeliveryAgent) {
    const [agent] = await db.insert(deliveryAgents).values(data).returning();
    return agent;
  }
  async updateDeliveryAgent(id: number, tenantId: number, data: Partial<InsertDeliveryAgent>) {
    const [agent] = await db
      .update(deliveryAgents)
      .set(data)
      .where(and(eq(deliveryAgents.id, id), eq(deliveryAgents.tenantId, tenantId)))
      .returning();
    return agent;
  }
  async toggleDeliveryAgentActive(id: number, tenantId: number, isActive: boolean) {
    await db
      .update(deliveryAgents)
      .set({ isActive })
      .where(and(eq(deliveryAgents.id, id), eq(deliveryAgents.tenantId, tenantId)));
  }

  // Delivery Action States
  async getDeliveryActionStates(tenantId: number) {
    return db
      .select()
      .from(deliveryActionStates)
      .where(eq(deliveryActionStates.tenantId, tenantId))
      .orderBy(deliveryActionStates.sortOrder);
  }
  async createDeliveryActionState(data: InsertDeliveryActionState) {
    const [state] = await db.insert(deliveryActionStates).values(data).returning();
    return state;
  }
  async updateDeliveryActionState(id: number, tenantId: number, data: Partial<InsertDeliveryActionState>) {
    const [state] = await db
      .update(deliveryActionStates)
      .set(data)
      .where(and(eq(deliveryActionStates.id, id), eq(deliveryActionStates.tenantId, tenantId)))
      .returning();
    return state;
  }
  async deleteDeliveryActionState(id: number, tenantId: number) {
    await db
      .delete(deliveryActionStates)
      .where(and(eq(deliveryActionStates.id, id), eq(deliveryActionStates.tenantId, tenantId)));
  }

  // Delivery Routes
  async getDeliveryRoutes(tenantId: number) {
    return db
      .select()
      .from(deliveryRoutes)
      .where(eq(deliveryRoutes.tenantId, tenantId))
      .orderBy(desc(deliveryRoutes.startedAt));
  }
  async getDeliveryRoutesByAgent(agentId: number, tenantId: number) {
    return db
      .select()
      .from(deliveryRoutes)
      .where(and(eq(deliveryRoutes.agentId, agentId), eq(deliveryRoutes.tenantId, tenantId)))
      .orderBy(desc(deliveryRoutes.startedAt));
  }
  async getActiveRouteByAgent(agentId: number, tenantId: number) {
    const [route] = await db
      .select()
      .from(deliveryRoutes)
      .where(and(
        eq(deliveryRoutes.agentId, agentId),
        eq(deliveryRoutes.tenantId, tenantId),
        eq(deliveryRoutes.status, "active")
      ));
    return route;
  }
  async getDeliveryRouteById(id: number, tenantId: number) {
    const [route] = await db
      .select()
      .from(deliveryRoutes)
      .where(and(eq(deliveryRoutes.id, id), eq(deliveryRoutes.tenantId, tenantId)));
    return route;
  }
  async createDeliveryRoute(data: InsertDeliveryRoute) {
    const [route] = await db.insert(deliveryRoutes).values(data).returning();
    return route;
  }
  async completeDeliveryRoute(id: number, tenantId: number) {
    await db
      .update(deliveryRoutes)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(eq(deliveryRoutes.id, id), eq(deliveryRoutes.tenantId, tenantId)));
  }

  // Delivery Route Stops
  async getRouteStops(routeId: number) {
    return db
      .select()
      .from(deliveryRouteStops)
      .where(eq(deliveryRouteStops.routeId, routeId))
      .orderBy(deliveryRouteStops.stopOrder);
  }
  async createRouteStop(data: InsertDeliveryRouteStop) {
    const [stop] = await db.insert(deliveryRouteStops).values(data).returning();
    return stop;
  }
  async updateRouteStopAction(id: number, actionStateId: number) {
    await db
      .update(deliveryRouteStops)
      .set({ actionStateId, actionAt: new Date() })
      .where(eq(deliveryRouteStops.id, id));
  }

  // Delivery Proofs
  async getDeliveryProofsByOrder(orderId: number) {
    return db
      .select()
      .from(deliveryProofs)
      .where(eq(deliveryProofs.orderId, orderId))
      .orderBy(desc(deliveryProofs.createdAt));
  }
  async createDeliveryProof(data: InsertDeliveryProof) {
    const [proof] = await db.insert(deliveryProofs).values(data).returning();
    return proof;
  }

  // Delivery-scoped orders
  async getDeliveryOrders(tenantId: number) {
    return db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.requiresDelivery, true)))
      .orderBy(desc(orders.createdAt));
  }
  async updateOrderDeliveryStatus(id: number, tenantId: number, status: string) {
    await db
      .update(orders)
      .set({ deliveryStatus: status, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  }
  async assignDeliveryAgent(orderId: number, tenantId: number, agentId: number) {
    await db
      .update(orders)
      .set({ assignedAgentId: agentId, deliveryStatus: "assigned", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  // Super Admin Config
  async getSuperAdminConfig(userId: number) {
    const [config] = await db.select().from(superAdminConfig).where(eq(superAdminConfig.userId, userId));
    return config;
  }
  async upsertSuperAdminConfig(data: InsertSuperAdminConfig) {
    const existing = await this.getSuperAdminConfig(data.userId);
    if (existing) {
      const [updated] = await db.update(superAdminConfig).set(data).where(eq(superAdminConfig.userId, data.userId)).returning();
      return updated;
    }
    const [created] = await db.insert(superAdminConfig).values(data).returning();
    return created;
  }

  // Tenant Subscription
  async updateTenantSubscription(tenantId: number, startDate: Date, endDate: Date) {
    await db.update(tenants).set({ subscriptionStartDate: startDate, subscriptionEndDate: endDate }).where(eq(tenants.id, tenantId));
  }
  async updateTenantActive(tenantId: number, isActive: boolean) {
    await db.update(tenants).set({ isActive }).where(eq(tenants.id, tenantId));
  }

  // Product Stock by Branch
  async getProductStockByBranch(productId: number, tenantId: number) {
    return db
      .select()
      .from(productStockByBranch)
      .where(and(eq(productStockByBranch.productId, productId), eq(productStockByBranch.tenantId, tenantId)));
  }
  async upsertProductStockByBranch(data: InsertProductStockByBranch) {
    const [existing] = await db
      .select()
      .from(productStockByBranch)
      .where(
        and(
          eq(productStockByBranch.productId, data.productId),
          eq(productStockByBranch.branchId, data.branchId),
          eq(productStockByBranch.tenantId, data.tenantId)
        )
      );
    if (existing) {
      const [updated] = await db
        .update(productStockByBranch)
        .set({ stock: data.stock })
        .where(eq(productStockByBranch.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(productStockByBranch).values(data).returning();
    return created;
  }
  async getStockMovements(productId: number, tenantId: number) {
    return db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, productId), eq(stockMovements.tenantId, tenantId)))
      .orderBy(desc(stockMovements.createdAt));
  }
  async createStockMovement(data: InsertStockMovement) {
    const [movement] = await db.insert(stockMovements).values(data).returning();
    return movement;
  }

  // Tracking Purge
  async purgeExpiredTracking() {
    const now = new Date();
    const result = await db
      .update(orders)
      .set({ trackingRevoked: true })
      .where(
        and(
          eq(orders.trackingRevoked, false),
          sql`${orders.trackingExpiresAt} IS NOT NULL AND ${orders.trackingExpiresAt} < ${now}`
        )
      )
      .returning({ id: orders.id });
    return result.length;
  }
}

export const storage = new DatabaseStorage();
