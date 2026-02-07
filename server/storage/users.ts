import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { users, type InsertUser } from "@shared/schema";

export const userStorage = {
  async getUserById(id: number, tenantId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
    return user;
  },
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
  },
  async getSuperAdminByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isSuperAdmin, true)));
    return user;
  },
  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },
  async getBranchUsers(tenantId: number, branchId?: number) {
    const conditions = [
      eq(users.tenantId, tenantId),
      eq(users.scope, "BRANCH"),
    ];
    if (branchId) conditions.push(eq(users.branchId, branchId));
    return db.select().from(users).where(and(...conditions));
  },
  async updateUser(id: number, tenantId: number, data: Partial<InsertUser>) {
    const [user] = await db
      .update(users)
      .set(data)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();
    return user;
  },
};
