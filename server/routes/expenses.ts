import type { Express } from "express";
import { storage } from "../storage";
import { tenantAuth, blockBranchScope, requireFeature } from "../auth";

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
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.post("/api/expense-categories",
        tenantAuth,
        blockBranchScope,  // Solo TENANT puede crear categorías
        async (req, res) => {
            try {
                const data = await storage.createExpenseCategory({
                    tenantId: req.auth!.tenantId!,
                    name: req.body.name,
                    type: req.body.type || "variable",
                });
                res.status(201).json({ data });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.patch("/api/expense-categories/:id",
        tenantAuth,
        blockBranchScope,
        async (req, res) => {
            try {
                const data = await storage.updateExpenseCategory(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    { name: req.body.name, type: req.body.type }
                );
                if (!data) return res.status(404).json({ error: "Categoría no encontrada" });
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.delete("/api/expense-categories/:id",
        tenantAuth,
        blockBranchScope,
        async (req, res) => {
            try {
                await storage.deleteExpenseCategory(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!
                );
                res.json({ ok: true });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
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
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.post("/api/fixed-expenses",
        tenantAuth,
        blockBranchScope,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                const data = await storage.createFixedExpense({
                    tenantId: req.auth!.tenantId!,
                    categoryId: req.body.categoryId || null,
                    name: req.body.name,
                    amount: String(req.body.amount),
                    periodicity: req.body.periodicity || "monthly",
                    payDay: req.body.payDay || null,
                    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
                });
                res.status(201).json({ data });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.patch("/api/fixed-expenses/:id",
        tenantAuth,
        blockBranchScope,
        requireFeature("fixed_expenses"),
        async (req, res) => {
            try {
                const data = await storage.updateFixedExpense(
                    parseInt(req.params.id as string),
                    req.auth!.tenantId!,
                    {
                        categoryId: req.body.categoryId,
                        name: req.body.name,
                        amount: req.body.amount ? String(req.body.amount) : undefined,
                        periodicity: req.body.periodicity,
                        payDay: req.body.payDay,
                        isActive: req.body.isActive,
                    }
                );
                if (!data) return res.status(404).json({ error: "Gasto fijo no encontrado" });
                res.json({ data });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        }
    );

    app.patch("/api/fixed-expenses/:id/toggle",
        tenantAuth,
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
                res.status(500).json({ error: err.message });
            }
        }
    );
}
