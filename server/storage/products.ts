import { db } from "../db";
import { eq, and, desc, asc, count, or, ilike, gte, lte, inArray, sql } from "drizzle-orm";
import { products, productCategories, type InsertProduct, type InsertProductCategory, type Product } from "@shared/schema";
import { storage } from "./index";

interface ProductFilters {
  q?: string;
  categoryId?: number;
  status?: 'active' | 'inactive' | 'all';
  minPrice?: number;
  maxPrice?: number;
  stock?: 'all' | 'in' | 'out' | 'low';
  lowStockThreshold?: number;
}

interface ProductSort {
  field: 'name' | 'price' | 'stock' | 'createdAt';
  dir: 'asc' | 'desc';
}

interface ProductPagination {
  page: number;
  pageSize: number;
}

interface ProductOptions {
  filters?: ProductFilters;
  sort?: ProductSort;
  pagination?: ProductPagination;
  selectedIds?: number[];
}

interface EnrichedProduct extends Product {
  stockTotal: number;
  branchStock?: Array<{ branchId: number; branchName: string; stock: number }>;
}

export const productStorage = {
  async getProductCategories(tenantId: number) {
    return db
      .select()
      .from(productCategories)
      .where(eq(productCategories.tenantId, tenantId))
      .orderBy(productCategories.sortOrder);
  },
  async createProductCategory(data: InsertProductCategory) {
    const [cat] = await db.insert(productCategories).values(data).returning();
    return cat;
  },

  async getProducts(
    tenantId: number,
    options: ProductOptions = {}
  ): Promise<{
    data: EnrichedProduct[];
    meta?: { page: number; pageSize: number; total: number };
  }> {
    const { filters, sort, pagination, selectedIds } = options;

    // 1. Build where conditions
    const conditions: any[] = [eq(products.tenantId, tenantId)];

    // Selected IDs filter (highest priority)
    if (selectedIds && selectedIds.length > 0) {
      conditions.push(inArray(products.id, selectedIds));
    } else if (filters) {
      // Text search (name, sku, description)
      if (filters.q) {
        const search = `%${filters.q}%`;
        conditions.push(
          or(
            ilike(products.name, search),
            filters.q ? ilike(products.sku ?? '', search) : undefined,
            filters.q ? ilike(products.description ?? '', search) : undefined
          )
        );
      }

      // Category
      if (filters.categoryId) {
        conditions.push(eq(products.categoryId, filters.categoryId));
      }

      // Status
      if (filters.status === 'active') {
        conditions.push(eq(products.isActive, true));
      } else if (filters.status === 'inactive') {
        conditions.push(eq(products.isActive, false));
      }

      // Price range
      if (filters.minPrice !== undefined) {
        conditions.push(gte(products.price, String(filters.minPrice)));
      }

      if (filters.maxPrice !== undefined) {
        conditions.push(lte(products.price, String(filters.maxPrice)));
      }
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // 2. Count total (before pagination)
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);
    const total = countResult?.count || 0;

    // 3. Build main query
    let query = db.select().from(products).where(whereClause);

    // 4. Apply sort
    if (sort) {
      if (sort.field === 'name') {
        query = query.orderBy(sort.dir === 'asc' ? asc(products.name) : desc(products.name)) as any;
      } else if (sort.field === 'price') {
        query = query.orderBy(sort.dir === 'asc' ? asc(products.price) : desc(products.price)) as any;
      } else if (sort.field === 'createdAt') {
        query = query.orderBy(sort.dir === 'asc' ? asc(products.createdAt) : desc(products.createdAt)) as any;
      }
      // stock sort requires enrichment first, skip for now
    } else {
      query = query.orderBy(desc(products.createdAt)) as any;
    }

    // 5. Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.pageSize;
      query = query.limit(pagination.pageSize).offset(offset) as any;
    }

    const productsList = await query;

    // 6. Enrich with stock
    const branchCount = await storage.getBranchCount(tenantId);

    let enriched: EnrichedProduct[];
    if (branchCount === 0) {
      // Global stock mode
      enriched = productsList.map(p => ({
        ...p,
        stockTotal: p.stock || 0,
      }));
    } else {
      // Branch stock mode
      const productIds = productsList.map(p => p.id);
      if (productIds.length === 0) {
        enriched = [];
      } else {
        const stockRows = await storage.getStockByProductIds(productIds, tenantId);
        const branches = await storage.getBranches(tenantId);

        const stockByProduct = new Map<number, number>();
        const branchStockByProduct = new Map<number, Array<{ branchId: number; branchName: string; stock: number }>>();

        for (const row of stockRows) {
          const current = stockByProduct.get(row.productId) || 0;
          stockByProduct.set(row.productId, current + (row.stock || 0));

          const branchInfo = branches.find(b => b.id === row.branchId);
          if (!branchStockByProduct.has(row.productId)) {
            branchStockByProduct.set(row.productId, []);
          }
          branchStockByProduct.get(row.productId)!.push({
            branchId: row.branchId,
            branchName: branchInfo?.name || 'Unknown',
            stock: row.stock || 0,
          });
        }

        enriched = productsList.map(p => ({
          ...p,
          stockTotal: stockByProduct.get(p.id) || 0,
          branchStock: branchStockByProduct.get(p.id) || [],
        }));
      }
    }

    // 7. Apply stock filter (post-enrichment)
    if (filters?.stock && filters.stock !== 'all') {
      const threshold = filters.lowStockThreshold || 5;
      enriched = enriched.filter(p => {
        if (filters.stock === 'in') return p.stockTotal > 0;
        if (filters.stock === 'out') return p.stockTotal === 0;
        if (filters.stock === 'low') return p.stockTotal > 0 && p.stockTotal <= threshold;
        return true;
      });
    }

    return {
      data: enriched,
      meta: pagination ? {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      } : undefined,
    };
  },

  async getProductById(id: number, tenantId: number) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
    return product;
  },
  async createProduct(data: InsertProduct) {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  },
  async updateProduct(id: number, tenantId: number, data: Partial<InsertProduct>) {
    const [product] = await db
      .update(products)
      .set(data)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning();
    return product;
  },
  async toggleProductActive(id: number, tenantId: number, isActive: boolean) {
    await db
      .update(products)
      .set({ isActive })
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
  },
  async countProducts(tenantId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.tenantId, tenantId));
    return result?.count || 0;
  },
};
