import { storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { users, plans, tenants } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function seedDatabase() {
  try {
    // Check if super admin exists
    const existingSuperAdmin = await storage.getSuperAdminByEmail("admin@orbia.app");
    if (existingSuperAdmin) {
      console.log("Seed: Database already seeded, skipping.");
      return;
    }

    console.log("Seed: Creating initial data...");

    // 1. Create Super Admin
    const hashedPassword = await hashPassword("admin123");
    await storage.createUser({
      email: "admin@orbia.app",
      password: hashedPassword,
      fullName: "Admin Orbia",
      role: "super_admin",
      isSuperAdmin: true,
      isActive: true,
      tenantId: null,
    });
    console.log("Seed: Super Admin created (admin@orbia.app / admin123)");

    // 2. Create Plans
    const planEconomico = await storage.createPlan({
      planCode: "ECONOMICO",
      name: "Económico",
      featuresJson: {
        orders: true,
        tracking: true,
        cash_basic: true,
        products_basic: true,
        branches: false,
        fixed_expenses: false,
        reports_advanced: false,
        stt: false,
        marketing: false,
      },
      limitsJson: {
        max_orders_month: 200,
        max_products: 30,
        max_branches: 1,
      },
      priceMonthly: "4999",
      isActive: true,
    });

    const planProfesional = await storage.createPlan({
      planCode: "PROFESIONAL",
      name: "Profesional",
      featuresJson: {
        orders: true,
        tracking: true,
        cash_basic: true,
        cash_advanced: true,
        products_basic: true,
        products_pdf: true,
        branches: true,
        fixed_expenses: true,
        reports_advanced: true,
        stt: false,
        marketing: false,
      },
      limitsJson: {
        max_orders_month: -1,
        max_products: -1,
        max_branches: 3,
      },
      priceMonthly: "9999",
      isActive: true,
    });

    const planEscala = await storage.createPlan({
      planCode: "ESCALA",
      name: "Escala",
      featuresJson: {
        orders: true,
        tracking: true,
        cash_basic: true,
        cash_advanced: true,
        products_basic: true,
        products_pdf: true,
        branches: true,
        fixed_expenses: true,
        reports_advanced: true,
        stt: true,
        marketing: true,
      },
      limitsJson: {
        max_orders_month: -1,
        max_products: -1,
        max_branches: -1,
      },
      priceMonthly: "19999",
      isActive: true,
    });

    console.log("Seed: Plans created");

    // 3. Create Demo Tenant
    const demoTenant = await storage.createTenant({
      code: "demo",
      name: "Negocio Demo",
      slug: "demo",
      planId: planProfesional.id,
      isActive: true,
    });

    const demoAdminPass = await hashPassword("demo123");
    const demoAdmin = await storage.createUser({
      tenantId: demoTenant.id,
      email: "admin@demo.com",
      password: demoAdminPass,
      fullName: "Carlos Rodríguez",
      role: "admin",
      isActive: true,
      isSuperAdmin: false,
    });

    await storage.upsertConfig({
      tenantId: demoTenant.id,
      businessName: "Negocio Demo",
      businessType: "Comercio",
      currency: "ARS",
      trackingExpirationHours: 48,
      language: "es",
    });

    console.log("Seed: Demo tenant created (demo / admin@demo.com / demo123)");

    // 4. Create default order statuses for demo
    const statuses = [
      { name: "Pendiente", color: "#F59E0B", sortOrder: 0, isFinal: false },
      { name: "En Proceso", color: "#3B82F6", sortOrder: 1, isFinal: false },
      { name: "Listo", color: "#8B5CF6", sortOrder: 2, isFinal: false },
      { name: "Entregado", color: "#10B981", sortOrder: 3, isFinal: true },
      { name: "Cancelado", color: "#EF4444", sortOrder: 4, isFinal: true },
    ];
    const createdStatuses: any[] = [];
    for (const s of statuses) {
      const created = await storage.createOrderStatus({ tenantId: demoTenant.id, ...s });
      createdStatuses.push(created);
    }

    // 5. Create demo branches
    const branch1 = await storage.createBranch({
      tenantId: demoTenant.id,
      name: "Casa Central",
      address: "Av. Corrientes 1234, CABA",
      phone: "+54 11 4555-1234",
      isActive: true,
    });
    await storage.createBranch({
      tenantId: demoTenant.id,
      name: "Sucursal Norte",
      address: "Av. Cabildo 2000, CABA",
      phone: "+54 11 4555-5678",
      isActive: true,
    });

    // 6. Create product categories and products
    const cat1 = await storage.createProductCategory({
      tenantId: demoTenant.id,
      name: "Servicios",
      sortOrder: 0,
    });
    const cat2 = await storage.createProductCategory({
      tenantId: demoTenant.id,
      name: "Productos",
      sortOrder: 1,
    });
    const cat3 = await storage.createProductCategory({
      tenantId: demoTenant.id,
      name: "Accesorios",
      sortOrder: 2,
    });

    await storage.createProduct({
      tenantId: demoTenant.id,
      categoryId: cat1.id,
      name: "Servicio de Reparación",
      description: "Reparación general de equipos",
      price: "5500",
      sku: "SRV-001",
      isActive: true,
    });
    await storage.createProduct({
      tenantId: demoTenant.id,
      categoryId: cat1.id,
      name: "Mantenimiento Preventivo",
      description: "Limpieza y revisión completa",
      price: "3200",
      sku: "SRV-002",
      isActive: true,
    });
    await storage.createProduct({
      tenantId: demoTenant.id,
      categoryId: cat2.id,
      name: "Repuesto Original",
      description: "Repuesto de fábrica certificado",
      price: "8900",
      sku: "PRD-001",
      isActive: true,
    });
    await storage.createProduct({
      tenantId: demoTenant.id,
      categoryId: cat3.id,
      name: "Funda Protectora",
      description: "Funda de silicona premium",
      price: "1500",
      sku: "ACC-001",
      isActive: true,
    });
    await storage.createProduct({
      tenantId: demoTenant.id,
      categoryId: cat3.id,
      name: "Cable USB-C",
      description: "Cable de carga rápida 1.5m",
      price: "2200",
      sku: "ACC-002",
      isActive: true,
    });

    // 7. Create demo orders
    const order1 = await storage.createOrder({
      tenantId: demoTenant.id,
      branchId: branch1.id,
      orderNumber: 1,
      type: "PEDIDO",
      customerName: "María García",
      customerPhone: "+54 11 5555-1111",
      description: "Reparación de pantalla",
      statusId: createdStatuses[1].id,
      totalAmount: "5500",
      createdById: demoAdmin.id,
    });
    await storage.createOrderHistory({
      tenantId: demoTenant.id,
      orderId: order1.id,
      statusId: createdStatuses[0].id,
      changedById: demoAdmin.id,
      note: "Pedido creado",
    });
    await storage.createOrderHistory({
      tenantId: demoTenant.id,
      orderId: order1.id,
      statusId: createdStatuses[1].id,
      changedById: demoAdmin.id,
      note: "Comenzando reparación",
    });

    const order2 = await storage.createOrder({
      tenantId: demoTenant.id,
      branchId: branch1.id,
      orderNumber: 2,
      type: "ENCARGO",
      customerName: "Juan Pérez",
      customerPhone: "+54 11 5555-2222",
      description: "Encargo de 3 fundas protectoras",
      statusId: createdStatuses[0].id,
      totalAmount: "4500",
      createdById: demoAdmin.id,
    });

    const order3 = await storage.createOrder({
      tenantId: demoTenant.id,
      orderNumber: 3,
      type: "SERVICIO",
      customerName: "Ana López",
      customerPhone: "+54 11 5555-3333",
      description: "Mantenimiento preventivo equipo completo",
      statusId: createdStatuses[2].id,
      totalAmount: "3200",
      createdById: demoAdmin.id,
    });
    await storage.createOrderHistory({
      tenantId: demoTenant.id,
      orderId: order3.id,
      statusId: createdStatuses[0].id,
      changedById: demoAdmin.id,
      note: "Pedido creado",
    });
    await storage.createOrderHistory({
      tenantId: demoTenant.id,
      orderId: order3.id,
      statusId: createdStatuses[1].id,
      changedById: demoAdmin.id,
      note: "En proceso de mantenimiento",
    });
    await storage.createOrderHistory({
      tenantId: demoTenant.id,
      orderId: order3.id,
      statusId: createdStatuses[2].id,
      changedById: demoAdmin.id,
      note: "Listo para retirar",
    });

    // Add comments
    await storage.createOrderComment({
      tenantId: demoTenant.id,
      orderId: order1.id,
      userId: demoAdmin.id,
      content: "Pantalla modelo X confirmada con el proveedor",
      isPublic: false,
    });
    await storage.createOrderComment({
      tenantId: demoTenant.id,
      orderId: order1.id,
      userId: demoAdmin.id,
      content: "Tu equipo está siendo reparado, te avisamos cuando esté listo",
      isPublic: true,
    });

    // 8. Create demo cash movements
    const session = await storage.createCashSession({
      tenantId: demoTenant.id,
      userId: demoAdmin.id,
      openingAmount: "10000",
      status: "open",
    });

    await storage.createCashMovement({
      tenantId: demoTenant.id,
      sessionId: session.id,
      type: "ingreso",
      amount: "5500",
      method: "efectivo",
      category: "Ventas",
      description: "Cobro reparación María García",
      createdById: demoAdmin.id,
    });
    await storage.createCashMovement({
      tenantId: demoTenant.id,
      sessionId: session.id,
      type: "ingreso",
      amount: "2200",
      method: "transferencia",
      category: "Ventas",
      description: "Venta cable USB-C",
      createdById: demoAdmin.id,
    });
    await storage.createCashMovement({
      tenantId: demoTenant.id,
      sessionId: session.id,
      type: "egreso",
      amount: "1500",
      method: "efectivo",
      category: "Insumos",
      description: "Compra de insumos de limpieza",
      createdById: demoAdmin.id,
    });
    await storage.createCashMovement({
      tenantId: demoTenant.id,
      sessionId: session.id,
      type: "ingreso",
      amount: "3200",
      method: "mercadopago",
      category: "Ventas",
      description: "Cobro mantenimiento Ana López",
      createdById: demoAdmin.id,
    });

    console.log("Seed: Demo data created successfully!");
    console.log("---");
    console.log("Super Admin: admin@orbia.app / admin123");
    console.log("Demo Tenant: demo / admin@demo.com / demo123");
    console.log("---");
  } catch (err) {
    console.error("Seed error:", err);
  }
}
