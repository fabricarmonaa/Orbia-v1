import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  plans, tenants, users, tenantConfig, branches,
  orderStatuses, orders, orderStatusHistory, orderComments,
  cashSessions, cashMovements, expenseCategories, fixedExpenses,
  productCategories, products,
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
  createProduct(data: InsertProduct): Promise<Product>;
  countProducts(tenantId: number): Promise<number>;
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
  async createProduct(data: InsertProduct) {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }
  async countProducts(tenantId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.tenantId, tenantId));
    return result?.count || 0;
  }
}

export const storage = new DatabaseStorage();
