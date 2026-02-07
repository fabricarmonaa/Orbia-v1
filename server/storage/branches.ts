import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { branches, type InsertBranch } from "@shared/schema";

export const branchStorage = {
  async getBranches(tenantId: number) {
    return db.select().from(branches).where(eq(branches.tenantId, tenantId));
  },
  async createBranch(data: InsertBranch) {
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  },
  async getBranchById(id: number, tenantId: number) {
    const [branch] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)));
    return branch;
  },
};
