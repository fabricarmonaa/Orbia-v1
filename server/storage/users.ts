import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { users, type InsertUser } from "@shared/schema";

export const userStorage = {
  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
};
