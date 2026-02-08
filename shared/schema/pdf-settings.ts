import {
  pgTable,
  serial,
  integer,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants } from "./tenants";

export const tenantPdfSettings = pgTable(
  "tenant_pdf_settings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id)
      .notNull()
      .unique(),
    templateKey: varchar("template_key", { length: 20 }).notNull().default("CLASSIC"),
    pageSize: varchar("page_size", { length: 10 }).notNull().default("A4"),
    orientation: varchar("orientation", { length: 12 }).notNull().default("portrait"),
    showLogo: boolean("show_logo").notNull().default(true),
    headerText: varchar("header_text", { length: 80 }),
    subheaderText: varchar("subheader_text", { length: 120 }),
    footerText: varchar("footer_text", { length: 160 }),
    showBranchStock: boolean("show_branch_stock").notNull().default(true),
    showSku: boolean("show_sku").notNull().default(false),
    showDescription: boolean("show_description").notNull().default(true),
    priceColumnLabel: varchar("price_column_label", { length: 30 }).notNull().default("Precio"),
    currencySymbol: varchar("currency_symbol", { length: 5 }).notNull().default("$"),
    columnsJson: jsonb("columns_json").default([]),
    stylesJson: jsonb("styles_json").default({}),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_pdf_settings_tenant").on(table.tenantId)]
);

export const insertTenantPdfSettingsSchema = createInsertSchema(tenantPdfSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertTenantPdfSettings = z.infer<typeof insertTenantPdfSettingsSchema>;
export type TenantPdfSettings = typeof tenantPdfSettings.$inferSelect;
