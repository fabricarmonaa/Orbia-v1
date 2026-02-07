import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { orders } from "@shared/schema";

export const trackingStorage = {
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
  },
};
