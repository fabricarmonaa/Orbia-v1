import type {
  Plan, InsertPlan,
  Tenant, InsertTenant,
  User, InsertUser,
  TenantConfig, InsertTenantConfig,
  Branch, InsertBranch,
  OrderStatus, InsertOrderStatus,
  Order, InsertOrder,
  InsertOrderStatusHistory,
  OrderComment, InsertOrderComment,
  CashSession, InsertCashSession,
  CashMovement, InsertCashMovement,
  ProductCategory, InsertProductCategory,
  Product, InsertProduct,
  SttLog, InsertSttLog,
  TenantAddon, InsertTenantAddon,
  DeliveryAgent, InsertDeliveryAgent,
  DeliveryActionState, InsertDeliveryActionState,
  DeliveryRoute, InsertDeliveryRoute,
  DeliveryRouteStop, InsertDeliveryRouteStop,
  DeliveryProof, InsertDeliveryProof,
  SuperAdminConfig, InsertSuperAdminConfig,
  ProductStockByBranch, InsertProductStockByBranch,
  StockMovement, InsertStockMovement,
} from "@shared/schema";

export interface IStorage {
  getPlans(): Promise<Plan[]>;
  getPlanById(id: number): Promise<Plan | undefined>;
  createPlan(data: InsertPlan): Promise<Plan>;

  getTenants(): Promise<Tenant[]>;
  getTenantById(id: number): Promise<Tenant | undefined>;
  getTenantByCode(code: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  updateTenantPlan(tenantId: number, planId: number): Promise<void>;

  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId?: number | null): Promise<User | undefined>;
  getSuperAdminByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;

  getConfig(tenantId: number): Promise<TenantConfig | undefined>;
  upsertConfig(data: InsertTenantConfig): Promise<TenantConfig>;

  getBranches(tenantId: number): Promise<Branch[]>;
  createBranch(data: InsertBranch): Promise<Branch>;

  getOrderStatuses(tenantId: number): Promise<OrderStatus[]>;
  getOrderStatusById(id: number, tenantId: number): Promise<OrderStatus | undefined>;
  createOrderStatus(data: InsertOrderStatus): Promise<OrderStatus>;

  getOrders(tenantId: number): Promise<Order[]>;
  getOrderById(id: number, tenantId: number): Promise<Order | undefined>;
  getOrderByTrackingId(trackingId: string): Promise<Order | undefined>;
  createOrder(data: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, tenantId: number, statusId: number): Promise<void>;
  updateOrderTracking(id: number, tenantId: number, trackingId: string, expiresAt: Date): Promise<void>;
  getNextOrderNumber(tenantId: number): Promise<number>;
  countOrders(tenantId: number, branchId?: number | null): Promise<number>;

  getOrderHistory(orderId: number, tenantId: number): Promise<any[]>;
  createOrderHistory(data: InsertOrderStatusHistory): Promise<void>;

  getOrderComments(orderId: number, tenantId: number): Promise<OrderComment[]>;
  getPublicOrderComments(orderId: number): Promise<OrderComment[]>;
  createOrderComment(data: InsertOrderComment): Promise<OrderComment>;

  getCashSessions(tenantId: number): Promise<CashSession[]>;
  getOpenSession(tenantId: number): Promise<CashSession | undefined>;
  createCashSession(data: InsertCashSession): Promise<CashSession>;
  closeCashSession(id: number, tenantId: number, closingAmount: string): Promise<void>;

  getCashMovements(tenantId: number): Promise<CashMovement[]>;
  createCashMovement(data: InsertCashMovement): Promise<CashMovement>;
  getMonthlyIncome(tenantId: number, branchId?: number | null): Promise<number>;
  getMonthlyExpenses(tenantId: number, branchId?: number | null): Promise<number>;
  getTodayIncome(tenantId: number, branchId?: number | null): Promise<number>;
  getTodayExpenses(tenantId: number, branchId?: number | null): Promise<number>;

  getProductCategories(tenantId: number): Promise<ProductCategory[]>;
  createProductCategory(data: InsertProductCategory): Promise<ProductCategory>;

  getProducts(tenantId: number): Promise<Product[]>;
  getProductById(id: number, tenantId: number): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, tenantId: number, data: Partial<InsertProduct>): Promise<Product>;
  toggleProductActive(id: number, tenantId: number, isActive: boolean): Promise<void>;
  countProducts(tenantId: number): Promise<number>;

  createSttLog(data: InsertSttLog): Promise<SttLog>;
  getSttLogs(tenantId: number): Promise<SttLog[]>;

  getOrdersByBranch(tenantId: number, branchId: number): Promise<Order[]>;
  getCashSessionsByBranch(tenantId: number, branchId: number): Promise<CashSession[]>;
  getCashMovementsByBranch(tenantId: number, branchId: number): Promise<CashMovement[]>;
  getBranchById(id: number, tenantId: number): Promise<Branch | undefined>;

  getTenantAddon(tenantId: number, addonKey: string): Promise<TenantAddon | undefined>;
  getTenantAddons(tenantId: number): Promise<TenantAddon[]>;
  upsertTenantAddon(data: InsertTenantAddon): Promise<TenantAddon>;

  getDeliveryAgents(tenantId: number): Promise<DeliveryAgent[]>;
  getDeliveryAgentById(id: number, tenantId: number): Promise<DeliveryAgent | undefined>;
  getDeliveryAgentByDni(dni: string, tenantId: number): Promise<DeliveryAgent | undefined>;
  createDeliveryAgent(data: InsertDeliveryAgent): Promise<DeliveryAgent>;
  updateDeliveryAgent(id: number, tenantId: number, data: Partial<InsertDeliveryAgent>): Promise<DeliveryAgent>;
  toggleDeliveryAgentActive(id: number, tenantId: number, isActive: boolean): Promise<void>;

  getDeliveryActionStates(tenantId: number): Promise<DeliveryActionState[]>;
  createDeliveryActionState(data: InsertDeliveryActionState): Promise<DeliveryActionState>;
  updateDeliveryActionState(id: number, tenantId: number, data: Partial<InsertDeliveryActionState>): Promise<DeliveryActionState>;
  deleteDeliveryActionState(id: number, tenantId: number): Promise<void>;

  getDeliveryRoutes(tenantId: number): Promise<DeliveryRoute[]>;
  getDeliveryRoutesByAgent(agentId: number, tenantId: number): Promise<DeliveryRoute[]>;
  getActiveRouteByAgent(agentId: number, tenantId: number): Promise<DeliveryRoute | undefined>;
  getDeliveryRouteById(id: number, tenantId: number): Promise<DeliveryRoute | undefined>;
  createDeliveryRoute(data: InsertDeliveryRoute): Promise<DeliveryRoute>;
  completeDeliveryRoute(id: number, tenantId: number): Promise<void>;

  getRouteStops(routeId: number): Promise<DeliveryRouteStop[]>;
  createRouteStop(data: InsertDeliveryRouteStop): Promise<DeliveryRouteStop>;
  updateRouteStopAction(id: number, actionStateId: number): Promise<void>;

  getDeliveryProofsByOrder(orderId: number): Promise<DeliveryProof[]>;
  createDeliveryProof(data: InsertDeliveryProof): Promise<DeliveryProof>;

  getDeliveryOrders(tenantId: number): Promise<Order[]>;
  updateOrderDeliveryStatus(id: number, tenantId: number, status: string): Promise<void>;
  assignDeliveryAgent(orderId: number, tenantId: number, agentId: number): Promise<void>;

  getSuperAdminConfig(userId: number): Promise<SuperAdminConfig | undefined>;
  upsertSuperAdminConfig(data: InsertSuperAdminConfig): Promise<SuperAdminConfig>;

  updateTenantSubscription(tenantId: number, startDate: Date, endDate: Date): Promise<void>;
  updateTenantActive(tenantId: number, isActive: boolean): Promise<void>;

  getProductStockByBranch(productId: number, tenantId: number): Promise<ProductStockByBranch[]>;
  upsertProductStockByBranch(data: InsertProductStockByBranch): Promise<ProductStockByBranch>;
  getStockMovements(productId: number, tenantId: number): Promise<StockMovement[]>;
  createStockMovement(data: InsertStockMovement): Promise<StockMovement>;

  purgeExpiredTracking(): Promise<number>;
}
