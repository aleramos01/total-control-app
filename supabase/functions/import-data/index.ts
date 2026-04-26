import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, getAuthenticatedProfile, jsonResponse, HttpError } from '../_shared/admin.ts';
import { buildUniqueCategoryKey, createId, normalizeCategoryKey, nowIso, resolveImportedTransactionCategory } from '../_shared/utils.ts';

type ImportCategory = {
  key?: string;
  name: string;
  color: string;
};

type ImportTransaction = {
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category: string;
  scheduleType?: 'once' | 'recurring' | 'installment';
  installmentCount?: number | null;
  isRecurring?: boolean;
  dueDate?: string | null;
  isPaid?: boolean;
  notes?: string | null;
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient, profile } = await getAuthenticatedProfile(req, false);
    const payload = await req.json().catch(() => null);
    const categories = Array.isArray(payload?.categories) ? payload.categories as ImportCategory[] : [];
    const transactions = Array.isArray(payload?.transactions) ? payload.transactions as ImportTransaction[] : [];
    const createdAt = nowIso();

    const { data: existingCategories, error: existingCategoriesError } = await adminClient
      .from('custom_categories')
      .select('id, key, name, color')
      .eq('user_id', profile.id);

    if (existingCategoriesError) {
      throw new HttpError(400, existingCategoriesError.message);
    }

    const existingCategoryKeys = new Set((existingCategories ?? []).map(category => category.key));
    const existingCategoryMap = new Map((existingCategories ?? []).map(category => [category.key, category]));
    const categoryKeyMap = new Map<string, string>();

    for (const category of categories) {
      if (!category?.name || !category?.color) {
        throw new HttpError(400, 'Invalid import payload');
      }

      const sourceKey = normalizeCategoryKey(category.key || category.name);
      const existingCategory = existingCategoryMap.get(sourceKey);

      if (existingCategory) {
        categoryKeyMap.set(sourceKey, existingCategory.key);
        const { error } = await adminClient
          .from('custom_categories')
          .update({
            name: category.name,
            color: category.color,
          })
          .eq('id', existingCategory.id);

        if (error) {
          throw new HttpError(400, error.message);
        }

        continue;
      }

      const finalKey = buildUniqueCategoryKey(sourceKey, existingCategoryKeys);
      existingCategoryKeys.add(finalKey);
      categoryKeyMap.set(sourceKey, finalKey);
      existingCategoryMap.set(sourceKey, {
        id: createId('cat_preview'),
        key: finalKey,
        name: category.name,
        color: category.color,
      });

      const { error } = await adminClient
        .from('custom_categories')
        .insert({
          id: createId('cat'),
          user_id: profile.id,
          key: finalKey,
          name: category.name,
          color: category.color,
          created_at: createdAt,
        });

      if (error) {
        throw new HttpError(400, error.message);
      }
    }

    if (transactions.length > 0) {
      const rows = transactions.map(transaction => {
        if (!transaction?.description || typeof transaction.amount !== 'number' || !transaction.date || !transaction.type || !transaction.category) {
          throw new HttpError(400, 'Invalid import payload');
        }

        const importedCategory = categoryKeyMap.get(transaction.category) ?? transaction.category;
        return {
          id: createId('txn'),
          user_id: profile.id,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          category_key: resolveImportedTransactionCategory(importedCategory, existingCategoryKeys),
          transaction_date: transaction.date,
          schedule_type: transaction.scheduleType ?? 'once',
          series_id: null,
          installment_index: null,
          installment_count: transaction.installmentCount && transaction.installmentCount > 1 ? transaction.installmentCount : null,
          is_recurring: Boolean(transaction.isRecurring),
          due_date: transaction.dueDate ?? null,
          is_paid: Boolean(transaction.isPaid),
          notes: transaction.notes ?? null,
          created_at: createdAt,
          updated_at: createdAt,
        };
      });

      const { error } = await adminClient
        .from('transactions')
        .insert(rows);

      if (error) {
        throw new HttpError(400, error.message);
      }
    }

    return jsonResponse({
      message: 'Import completed successfully',
      imported: {
        transactions: transactions.length,
        categories: categories.length,
      },
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
