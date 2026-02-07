import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { cashSessions, cashMovements, type InsertCashSession, type InsertCashMovement } from "@shared/schema";

export const cashStorage = {
  async getCashSessions(tenantId: number) {
    return db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.tenantId, tenantId))
      .orderBy(desc(cashSessions.openedAt));
  },
  async getOpenSession(tenantId: number, branchId?: number | null) {
    const conditions = [
      eq(cashSessions.tenantId, tenantId),
      eq(cashSessions.status, "open"),
    ];
    if (branchId) {
      conditions.push(eq(cashSessions.branchId, branchId));
    }
    const [session] = await db
      .select()
      .from(cashSessions)
      .where(and(...conditions));
    return session;
  },
  async createCashSession(data: InsertCashSession) {
    const [session] = await db.insert(cashSessions).values(data).returning();
    return session;
  },
  async closeCashSession(id: number, tenantId: number, closingAmount: string) {
    const [session] = await db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.id, id), eq(cashSessions.tenantId, tenantId), eq(cashSessions.status, "open")));
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
  },
  async getCashMovements(tenantId: number) {
    return db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId))
      .orderBy(desc(cashMovements.createdAt));
  },
  async createCashMovement(data: InsertCashMovement) {
    const [movement] = await db.insert(cashMovements).values(data).returning();
    return movement;
  },
  async getMonthlyIncome(tenantId: number, branchId?: number | null) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const conditions = [
      eq(cashMovements.tenantId, tenantId),
      eq(cashMovements.type, "ingreso"),
      sql`${cashMovements.createdAt} >= ${startOfMonth}`,
    ];
    if (branchId) conditions.push(eq(cashMovements.branchId, branchId));
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(and(...conditions));
    return parseFloat(result[0]?.total || "0");
  },
  async getMonthlyExpenses(tenantId: number, branchId?: number | null) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const conditions = [
      eq(cashMovements.tenantId, tenantId),
      eq(cashMovements.type, "egreso"),
      sql`${cashMovements.createdAt} >= ${startOfMonth}`,
    ];
    if (branchId) conditions.push(eq(cashMovements.branchId, branchId));
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(and(...conditions));
    return parseFloat(result[0]?.total || "0");
  },
  async getTodayIncome(tenantId: number, branchId?: number | null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const conditions = [
      eq(cashMovements.tenantId, tenantId),
      eq(cashMovements.type, "ingreso"),
      sql`${cashMovements.createdAt} >= ${today}`,
    ];
    if (branchId) conditions.push(eq(cashMovements.branchId, branchId));
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(and(...conditions));
    return parseFloat(result[0]?.total || "0");
  },
  async getTodayExpenses(tenantId: number, branchId?: number | null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const conditions = [
      eq(cashMovements.tenantId, tenantId),
      eq(cashMovements.type, "egreso"),
      sql`${cashMovements.createdAt} >= ${today}`,
    ];
    if (branchId) conditions.push(eq(cashMovements.branchId, branchId));
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${cashMovements.amount}), 0)` })
      .from(cashMovements)
      .where(and(...conditions));
    return parseFloat(result[0]?.total || "0");
  },
  async getCashSessionsByBranch(tenantId: number, branchId: number) {
    return db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.tenantId, tenantId), eq(cashSessions.branchId, branchId)))
      .orderBy(desc(cashSessions.openedAt));
  },
  async getCashMovementsByBranch(tenantId: number, branchId: number) {
    return db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.branchId, branchId)))
      .orderBy(desc(cashMovements.createdAt));
  },
};
