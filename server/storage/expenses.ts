import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
    expenseCategories,
    fixedExpenses,
    type InsertExpenseCategory,
    type InsertFixedExpense
} from "@shared/schema";

export const expenseStorage = {
    // Expense Categories
    async getExpenseCategories(tenantId: number) {
        return db
            .select()
            .from(expenseCategories)
            .where(eq(expenseCategories.tenantId, tenantId));
    },

    async getExpenseCategoryById(id: number, tenantId: number) {
        const [category] = await db
            .select()
            .from(expenseCategories)
            .where(and(
                eq(expenseCategories.id, id),
                eq(expenseCategories.tenantId, tenantId)
            ));
        return category;
    },

    async createExpenseCategory(data: InsertExpenseCategory) {
        const [category] = await db
            .insert(expenseCategories)
            .values(data)
            .returning();
        return category;
    },

    async updateExpenseCategory(
        id: number,
        tenantId: number,
        data: Partial<InsertExpenseCategory>
    ) {
        const [category] = await db
            .update(expenseCategories)
            .set(data)
            .where(and(
                eq(expenseCategories.id, id),
                eq(expenseCategories.tenantId, tenantId)
            ))
            .returning();
        return category;
    },

    async deleteExpenseCategory(id: number, tenantId: number) {
        await db
            .delete(expenseCategories)
            .where(and(
                eq(expenseCategories.id, id),
                eq(expenseCategories.tenantId, tenantId)
            ));
    },

    // Fixed Expenses
    async getFixedExpenses(tenantId: number) {
        return db
            .select()
            .from(fixedExpenses)
            .where(eq(fixedExpenses.tenantId, tenantId));
    },

    async getFixedExpenseById(id: number, tenantId: number) {
        const [expense] = await db
            .select()
            .from(fixedExpenses)
            .where(and(
                eq(fixedExpenses.id, id),
                eq(fixedExpenses.tenantId, tenantId)
            ));
        return expense;
    },

    async createFixedExpense(data: InsertFixedExpense) {
        const [expense] = await db
            .insert(fixedExpenses)
            .values(data)
            .returning();
        return expense;
    },

    async updateFixedExpense(
        id: number,
        tenantId: number,
        data: Partial<InsertFixedExpense>
    ) {
        const [expense] = await db
            .update(fixedExpenses)
            .set(data)
            .where(and(
                eq(fixedExpenses.id, id),
                eq(fixedExpenses.tenantId, tenantId)
            ))
            .returning();
        return expense;
    },

    async toggleFixedExpenseActive(id: number, tenantId: number, isActive: boolean) {
        await db
            .update(fixedExpenses)
            .set({ isActive })
            .where(and(
                eq(fixedExpenses.id, id),
                eq(fixedExpenses.tenantId, tenantId)
            ));
    },
};
