import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { sttLogs, type InsertSttLog } from "@shared/schema";

export const sttStorage = {
  async createSttLog(data: InsertSttLog) {
    const [log] = await db.insert(sttLogs).values(data).returning();
    return log;
  },
  async getSttLogs(tenantId: number) {
    return db
      .select()
      .from(sttLogs)
      .where(eq(sttLogs.tenantId, tenantId))
      .orderBy(desc(sttLogs.createdAt));
  },
};
