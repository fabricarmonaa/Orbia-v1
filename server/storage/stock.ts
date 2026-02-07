import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { productStockByBranch, stockMovements, type InsertProductStockByBranch, type InsertStockMovement } from "@shared/schema";

export const stockStorage = {
  async getProductStockByBranch(productId: number, tenantId: number) {
    return db
      .select()
      .from(productStockByBranch)
      .where(and(eq(productStockByBranch.productId, productId), eq(productStockByBranch.tenantId, tenantId)));
  },
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
  },
  async getStockMovements(productId: number, tenantId: number) {
    return db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, productId), eq(stockMovements.tenantId, tenantId)))
      .orderBy(desc(stockMovements.createdAt));
  },
  async createStockMovement(data: InsertStockMovement) {
    const [movement] = await db.insert(stockMovements).values(data).returning();
    return movement;
  },
};
