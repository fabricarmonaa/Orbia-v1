import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== PLANS ====================
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  planCode: varchar("plan_code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  featuresJson: jsonb("features_json").notNull().default({}),
  limitsJson: jsonb("limits_json").notNull().default({}),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// ==================== TENANTS ====================
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  planId: integer("plan_id").references(() => plans.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ==================== USERS (Super Admin + Tenant Users) ====================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    password: text("password").notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().default("staff"),
    branchId: integer("branch_id"),
    isActive: boolean("is_active").notNull().default(true),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_users_tenant").on(table.tenantId)]
);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== TENANT CONFIG ====================
export const tenantConfig = pgTable("tenant_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id)
    .notNull()
    .unique(),
  businessName: varchar("business_name", { length: 200 }),
  businessType: varchar("business_type", { length: 100 }),
  currency: varchar("currency", { length: 10 }).default("ARS"),
  trackingExpirationHours: integer("tracking_expiration_hours").default(24),
  language: varchar("language", { length: 10 }).default("es"),
  configJson: jsonb("config_json").default({}),
});

export const insertTenantConfigSchema = createInsertSchema(tenantConfig).omit({
  id: true,
});
export type InsertTenantConfig = z.infer<typeof insertTenantConfigSchema>;
export type TenantConfig = typeof tenantConfig.$inferSelect;

// ==================== BRANCHES ====================
export const branches = pgTable(
  "branches",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_branches_tenant").on(table.tenantId)]
);

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
});
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

// ==================== ORDER STATUSES ====================
export const orderStatuses = pgTable(
  "order_statuses",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 20 }).default("#6B7280"),
    sortOrder: integer("sort_order").default(0),
    isFinal: boolean("is_final").notNull().default(false),
  },
  (table) => [index("idx_order_statuses_tenant").on(table.tenantId)]
);

export const insertOrderStatusSchema = createInsertSchema(orderStatuses).omit({
  id: true,
});
export type InsertOrderStatus = z.infer<typeof insertOrderStatusSchema>;
export type OrderStatus = typeof orderStatuses.$inferSelect;

// ==================== ORDERS ====================
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    branchId: integer("branch_id").references(() => branches.id),
    orderNumber: integer("order_number").notNull(),
    type: varchar("type", { length: 50 }).notNull().default("PEDIDO"),
    customerName: varchar("customer_name", { length: 200 }),
    customerPhone: varchar("customer_phone", { length: 50 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    description: text("description"),
    statusId: integer("status_id").references(() => orderStatuses.id),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
    scheduledAt: timestamp("scheduled_at"),
    closedAt: timestamp("closed_at"),
    publicTrackingId: varchar("public_tracking_id", { length: 100 }).unique(),
    trackingExpiresAt: timestamp("tracking_expires_at"),
    trackingRevoked: boolean("tracking_revoked").default(false),
    requiresDelivery: boolean("requires_delivery").notNull().default(false),
    deliveryAddress: text("delivery_address"),
    deliveryCity: varchar("delivery_city", { length: 200 }),
    deliveryAddressNotes: text("delivery_address_notes"),
    deliveryReceiverName: varchar("delivery_receiver_name", { length: 200 }),
    deliveryReceiverPhone: varchar("delivery_receiver_phone", { length: 50 }),
    deliverySchedule: varchar("delivery_schedule", { length: 100 }),
    deliveryLat: numeric("delivery_lat", { precision: 10, scale: 7 }),
    deliveryLng: numeric("delivery_lng", { precision: 10, scale: 7 }),
    deliveryStatus: varchar("delivery_status", { length: 50 }),
    assignedAgentId: integer("assigned_agent_id"),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_orders_tenant").on(table.tenantId),
    index("idx_orders_tracking").on(table.publicTrackingId),
  ]
);

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ==================== ORDER STATUS HISTORY ====================
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    statusId: integer("status_id").references(() => orderStatuses.id),
    changedById: integer("changed_by_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_order_history_order").on(table.orderId)]
);

export const insertOrderStatusHistorySchema = createInsertSchema(
  orderStatusHistory
).omit({ id: true, createdAt: true });
export type InsertOrderStatusHistory = z.infer<
  typeof insertOrderStatusHistorySchema
>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;

// ==================== ORDER COMMENTS ====================
export const orderComments = pgTable(
  "order_comments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    userId: integer("user_id").references(() => users.id),
    content: text("content").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_order_comments_order").on(table.orderId)]
);

export const insertOrderCommentSchema = createInsertSchema(orderComments).omit({
  id: true,
  createdAt: true,
});
export type InsertOrderComment = z.infer<typeof insertOrderCommentSchema>;
export type OrderComment = typeof orderComments.$inferSelect;

// ==================== CASH SESSIONS ====================
export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    branchId: integer("branch_id").references(() => branches.id),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    openingAmount: numeric("opening_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    closingAmount: numeric("closing_amount", { precision: 12, scale: 2 }),
    difference: numeric("difference", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => [index("idx_cash_sessions_tenant").on(table.tenantId)]
);

export const insertCashSessionSchema = createInsertSchema(cashSessions).omit({
  id: true,
  openedAt: true,
});
export type InsertCashSession = z.infer<typeof insertCashSessionSchema>;
export type CashSession = typeof cashSessions.$inferSelect;

// ==================== CASH MOVEMENTS ====================
export const cashMovements = pgTable(
  "cash_movements",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    sessionId: integer("session_id").references(() => cashSessions.id),
    branchId: integer("branch_id").references(() => branches.id),
    type: varchar("type", { length: 20 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: varchar("method", { length: 50 }).default("efectivo"),
    category: varchar("category", { length: 100 }),
    description: text("description"),
    orderId: integer("order_id").references(() => orders.id),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_cash_movements_tenant").on(table.tenantId)]
);

export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({
  id: true,
  createdAt: true,
});
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
export type CashMovement = typeof cashMovements.$inferSelect;

// ==================== EXPENSE CATEGORIES ====================
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull().default("variable"),
  },
  (table) => [index("idx_expense_cats_tenant").on(table.tenantId)]
);

export const insertExpenseCategorySchema = createInsertSchema(
  expenseCategories
).omit({ id: true });
export type InsertExpenseCategory = z.infer<
  typeof insertExpenseCategorySchema
>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

// ==================== FIXED EXPENSES ====================
export const fixedExpenses = pgTable(
  "fixed_expenses",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    categoryId: integer("category_id").references(() => expenseCategories.id),
    name: varchar("name", { length: 200 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    periodicity: varchar("periodicity", { length: 20 }).default("monthly"),
    payDay: integer("pay_day"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("idx_fixed_expenses_tenant").on(table.tenantId)]
);

export const insertFixedExpenseSchema = createInsertSchema(fixedExpenses).omit({
  id: true,
});
export type InsertFixedExpense = z.infer<typeof insertFixedExpenseSchema>;
export type FixedExpense = typeof fixedExpenses.$inferSelect;

// ==================== PRODUCT CATEGORIES ====================
export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [index("idx_prod_cats_tenant").on(table.tenantId)]
);

export const insertProductCategorySchema = createInsertSchema(
  productCategories
).omit({ id: true });
export type InsertProductCategory = z.infer<
  typeof insertProductCategorySchema
>;
export type ProductCategory = typeof productCategories.$inferSelect;

// ==================== PRODUCTS ====================
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    categoryId: integer("category_id").references(() => productCategories.id),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    stock: integer("stock"),
    sku: varchar("sku", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_products_tenant").on(table.tenantId)]
);

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ==================== TENANT ADDONS ====================
export const tenantAddons = pgTable(
  "tenant_addons",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    addonKey: varchar("addon_key", { length: 50 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    enabledById: integer("enabled_by_id").references(() => users.id),
    enabledAt: timestamp("enabled_at"),
  },
  (table) => [index("idx_tenant_addons_tenant").on(table.tenantId)]
);

export const insertTenantAddonSchema = createInsertSchema(tenantAddons).omit({
  id: true,
});
export type InsertTenantAddon = z.infer<typeof insertTenantAddonSchema>;
export type TenantAddon = typeof tenantAddons.$inferSelect;

// ==================== DELIVERY AGENTS ====================
export const deliveryAgents = pgTable(
  "delivery_agents",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    dni: varchar("dni", { length: 20 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    pinHash: text("pin_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_delivery_agents_tenant").on(table.tenantId)]
);

export const insertDeliveryAgentSchema = createInsertSchema(deliveryAgents).omit({
  id: true,
  createdAt: true,
});
export type InsertDeliveryAgent = z.infer<typeof insertDeliveryAgentSchema>;
export type DeliveryAgent = typeof deliveryAgents.$inferSelect;

// ==================== DELIVERY ACTION STATES ====================
export const deliveryActionStates = pgTable(
  "delivery_action_states",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    label: varchar("label", { length: 100 }).notNull(),
    requiresPhoto: boolean("requires_photo").notNull().default(true),
    requiresComment: boolean("requires_comment").notNull().default(false),
    nextOrderStatusId: integer("next_order_status_id").references(() => orderStatuses.id),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [index("idx_delivery_action_states_tenant").on(table.tenantId)]
);

export const insertDeliveryActionStateSchema = createInsertSchema(deliveryActionStates).omit({
  id: true,
});
export type InsertDeliveryActionState = z.infer<typeof insertDeliveryActionStateSchema>;
export type DeliveryActionState = typeof deliveryActionStates.$inferSelect;

// ==================== DELIVERY ROUTES ====================
export const deliveryRoutes = pgTable(
  "delivery_routes",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    agentId: integer("agent_id")
      .references(() => deliveryAgents.id)
      .notNull(),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_delivery_routes_tenant").on(table.tenantId)]
);

export const insertDeliveryRouteSchema = createInsertSchema(deliveryRoutes).omit({
  id: true,
  startedAt: true,
});
export type InsertDeliveryRoute = z.infer<typeof insertDeliveryRouteSchema>;
export type DeliveryRoute = typeof deliveryRoutes.$inferSelect;

// ==================== DELIVERY ROUTE STOPS ====================
export const deliveryRouteStops = pgTable(
  "delivery_route_stops",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .references(() => deliveryRoutes.id)
      .notNull(),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    stopOrder: integer("stop_order").notNull(),
    actionStateId: integer("action_state_id").references(() => deliveryActionStates.id),
    actionAt: timestamp("action_at"),
  },
  (table) => [index("idx_delivery_route_stops_route").on(table.routeId)]
);

export const insertDeliveryRouteStopSchema = createInsertSchema(deliveryRouteStops).omit({
  id: true,
});
export type InsertDeliveryRouteStop = z.infer<typeof insertDeliveryRouteStopSchema>;
export type DeliveryRouteStop = typeof deliveryRouteStops.$inferSelect;

// ==================== DELIVERY PROOFS ====================
export const deliveryProofs = pgTable(
  "delivery_proofs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    routeId: integer("route_id").references(() => deliveryRoutes.id),
    stopId: integer("stop_id").references(() => deliveryRouteStops.id),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    actionCode: varchar("action_code", { length: 50 }).notNull(),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    deliveredById: integer("delivered_by_id")
      .references(() => deliveryAgents.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_delivery_proofs_order").on(table.orderId)]
);

export const insertDeliveryProofSchema = createInsertSchema(deliveryProofs).omit({
  id: true,
  createdAt: true,
});
export type InsertDeliveryProof = z.infer<typeof insertDeliveryProofSchema>;
export type DeliveryProof = typeof deliveryProofs.$inferSelect;

// ==================== STT LOGS ====================
export const sttLogs = pgTable(
  "stt_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    userId: integer("user_id").references(() => users.id),
    context: varchar("context", { length: 50 }).notNull(),
    transcription: text("transcription"),
    intentJson: jsonb("intent_json"),
    confirmed: boolean("confirmed").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_stt_logs_tenant").on(table.tenantId)]
);

export const insertSttLogSchema = createInsertSchema(sttLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertSttLog = z.infer<typeof insertSttLogSchema>;
export type SttLog = typeof sttLogs.$inferSelect;
