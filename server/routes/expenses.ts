import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { tenantAuth, blockBranchScope, requireFeature, requireTenantAdmin, requireNotPlanCodes } from "../auth";

const baseExpenseDefinitionSchema = z.object({
    type: z.enum(["FIXED", "VARIABLE"]),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(200).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    defaultAmount: z.coerce.number().positive().optional(),
    currency: z.string().trim().max(10).optional().nullable(),
    isActive: z.boolean().optional(),
}).strict();

const expenseDefinitionSchema = baseExpenseDefinitionSchema.superRefine((data, ctx) => {
    if (data.type === "FIXED" && (!data.defaultAmount || data.defaultAmount <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "defaultAmount requerido para gastos fijos", path: ["defaultAmount"] });
    }
});

const expenseDefinitionUpdateSchema = baseExpenseDefinitionSchema.partial().strict();

const expenseCategorySchema = z.object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(["fixed", "variable"]).optional(),
}).strict();

const expenseCategoryUpdateSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.enum(["fixed", "variable"]).optional(),
}).strict();

const fixedExpenseSchema = z.object({
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    name: z.string().trim().min(2).max(120),
    amount: z.coerce.number().positive(),
    periodicity: z.string().trim().max(30).optional(),
    payDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
    isActive: z.boolean().optional(),
}).strict();

const fixedExpenseUpdateSchema = z.object({
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    name: z.string().trim().min(2).max(120).optional(),
    amount: z.coerce.number().positive().optional(),
    periodicity: z.string().trim().max(30).optional(),
    payDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
    isActive: z.boolean().optional(),
}).strict();


export function registerExpenseRoutes(app: Express) {
    // ============================================
    // EXPENSE CATEGORIES
    // ============================================

    app.get("/api/expense-categories",
        tenantAuth,
        async (req, res) => {
            try {
                const data = await storage.getExpenseCategories(req.auth!.tenantId!);
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    // ============================================
    // EXPENSE DEFINITIONS (FIXED / VARIABLE)
    // ============================================

    app.get("/api/expenses/definitions",
        tenantAuth,
        requireNotPlanCodes(["ECONOMICO"]),
        async (req, res) => {
            try {
                const type = req.query.type ? String(req.query.type).toUpperCase() : undefined;
                if (type && !["FIXED", "VARIABLE"].includes(type)) {
                    return res.status(400).json({ error: "type inválido" });
                }
                const data = await storage.listExpenseDefinitions(req.auth!.tenantId!, type);
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.post("/api/expenses/definitions",
        tenantAuth,
        requireNotPlanCodes(["ECONOMICO"]),
        requireTenantAdmin,
        blockBranchScope,
        async (req, res) => {
            try {
                const payload = expenseDefinitionSchema.parse(req.body);
                const data = await storage.createExpenseDefinition({
                    tenantId: req.auth!.tenantId!,
                    type: payload.type,
                    name: payload.name,
                    description: payload.description || null,
                    category: payload.category || null,
                    defaultAmount: payload.defaultAmount ? String(payload.defaultAmount) : null,
                    currency: payload.currency || null,
                    isActive: payload.isActive ?? true,
                });
                res.status(201).json({ data });
            } catch (err: any) {
                if (err instanceof z.ZodError) {
                    return res.status(400).json({ error: "Datos inválidos", details: err.errors });
                }
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.put("/api/expenses/definitions/:id",
        tenantAuth,
        requireNotPlanCodes(["ECONOMICO"]),
        requireTenantAdmin,
        blockBranchScope,
        async (req, res) => {
            try {
                const payload = expenseDefinitionUpdateSchema.parse(req.body);
                if (!Object.keys(payload).length) {
                    return res.status(400).json({ error: "Sin cambios para actualizar" });
                }
                const data = await storage.updateExpenseDefinition(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    {
                        type: payload.type,
                        name: payload.name,
                        description: payload.description ?? undefined,
                        category: payload.category ?? undefined,
                        defaultAmount: payload.defaultAmount !== undefined ? String(payload.defaultAmount) : undefined,
                        currency: payload.currency ?? undefined,
                        isActive: payload.isActive,
                    }
                );
                if (!data) return res.status(404).json({ error: "Definición no encontrada" });
                res.json({ data });
            } catch (err: any) {
                if (err instanceof z.ZodError) {
                    return res.status(400).json({ error: "Datos inválidos", details: err.errors });
                }
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.delete("/api/expenses/definitions/:id",
        tenantAuth,
        requireNotPlanCodes(["ECONOMICO"]),
        requireTenantAdmin,
        blockBranchScope,
        async (req, res) => {
            try {
                await storage.deleteExpenseDefinition(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!
                );
                res.json({ ok: true });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.post("/api/expense-categories",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,  // Solo TENANT admin puede crear categorías
        async (req, res) => {
            try {
                const payload = expenseCategorySchema.parse(req.body);
                const data = await storage.createExpenseCategory({
                    tenantId: req.auth!.tenantId!,
                    name: payload.name,
                    type: payload.type || "variable",
                });
                res.status(201).json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.patch("/api/expense-categories/:id",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,
        async (req, res) => {
            try {
                const payload = expenseCategoryUpdateSchema.parse(req.body);
                const data = await storage.updateExpenseCategory(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    { name: payload.name, type: payload.type }
                );
                if (!data) return res.status(404).json({ error: "Categoría no encontrada" });
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.delete("/api/expense-categories/:id",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,
        async (req, res) => {
            try {
                await storage.deleteExpenseCategory(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!
                );
                res.json({ ok: true });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    // ============================================
    // FIXED EXPENSES
    // ============================================

    app.get("/api/fixed-expenses",
        tenantAuth,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                const data = await storage.getFixedExpenses(req.auth!.tenantId!);
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.post("/api/fixed-expenses",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                const payload = fixedExpenseSchema.parse(req.body);
                const data = await storage.createFixedExpense({
                    tenantId: req.auth!.tenantId!,
                    categoryId: payload.categoryId || null,
                    name: payload.name,
                    amount: String(payload.amount),
                    periodicity: payload.periodicity || "monthly",
                    payDay: payload.payDay || null,
                    isActive: payload.isActive !== undefined ? payload.isActive : true,
                });
                res.status(201).json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.patch("/api/fixed-expenses/:id",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                const payload = fixedExpenseUpdateSchema.parse(req.body);
                const data = await storage.updateFixedExpense(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    {
                        categoryId: payload.categoryId,
                        name: payload.name,
                        amount: payload.amount ? String(payload.amount) : undefined,
                        periodicity: payload.periodicity,
                        payDay: payload.payDay,
                        isActive: payload.isActive,
                    }
                );
                if (!data) return res.status(404).json({ error: "Gasto fijo no encontrado" });
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );

    app.patch("/api/fixed-expenses/:id/toggle",
        tenantAuth,
        requireTenantAdmin,
        blockBranchScope,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                await storage.toggleFixedExpenseActive(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    req.body.isActive
                );
                res.json({ ok: true });
            } catch (err: any) {
                res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
            }
        }
    );
}
