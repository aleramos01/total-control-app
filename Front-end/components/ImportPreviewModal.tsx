import React, { useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import { ImportPreviewPayload } from '../types';

interface ImportPreviewModalProps {
  isOpen: boolean;
  preview: ImportPreviewPayload | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  allCategoriesMap: { [key: string]: { name: string; color?: string } };
}

const PREVIEW_LIMIT = 5;

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  preview,
  isSubmitting,
  onClose,
  onConfirm,
  allCategoriesMap,
}) => {
  const { t, locale, formatCurrency } = useLanguage();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  const previewCategoryMap = useMemo(() => {
    const map: { [key: string]: { name: string; color?: string } } = { ...allCategoriesMap };
    preview?.categories.forEach(category => {
      map[category.key] = {
        name: category.name,
        color: category.color,
      };
    });
    return map;
  }, [allCategoriesMap, preview]);

  if (!isOpen || !preview) return null;

  const visibleTransactions = preview.transactions.slice(0, PREVIEW_LIMIT);
  const visibleCategories = preview.categories.slice(0, PREVIEW_LIMIT);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-preview-title"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-800 p-6 text-slate-100 shadow-2xl sm:p-8"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">{t('import_json')}</p>
          <h2 id="import-preview-title" className="mt-2 text-2xl font-bold text-slate-50">{t('import_preview_title')}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {t('import_preview_description')
              .replace('{fileName}', preview.fileName)
              .replace('{transactions}', String(preview.transactions.length))
              .replace('{categories}', String(preview.categories.length))}
          </p>
          <p className="mt-2 text-sm text-slate-500">{t('import_preview_warning')}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{t('import_preview_categories')}</h3>
                <p className="text-sm text-slate-400">{preview.categories.length}</p>
              </div>
              {preview.categories.length > PREVIEW_LIMIT ? (
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
                  {t('import_preview_sample_limit').replace('{count}', String(visibleCategories.length))}
                </span>
              ) : null}
            </div>

            {visibleCategories.length > 0 ? (
              <div className="space-y-3">
                {visibleCategories.map(category => (
                  <div key={category.key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{category.name}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{category.key}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-400">
                {t('import_preview_categories_empty')}
              </p>
            )}
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{t('import_preview_transactions')}</h3>
                <p className="text-sm text-slate-400">{preview.transactions.length}</p>
              </div>
              {preview.transactions.length > PREVIEW_LIMIT ? (
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
                  {t('import_preview_sample_limit').replace('{count}', String(visibleTransactions.length))}
                </span>
              ) : null}
            </div>

            {visibleTransactions.length > 0 ? (
              <div className="space-y-3">
                {visibleTransactions.map(transaction => {
                  const category = previewCategoryMap[transaction.category];
                  const categoryName = category?.name ?? transaction.category;
                  const transactionKey = JSON.stringify([
                    transaction.description,
                    transaction.amount,
                    transaction.date,
                    transaction.type,
                    transaction.category,
                    transaction.notes ?? null,
                  ]);

                  return (
                    <div
                      key={transactionKey}
                      className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">{transaction.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <span>{categoryName}</span>
                            <span>-</span>
                            <span>{new Date(transaction.date).toLocaleDateString(locale)}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-400">
                {t('import_preview_transactions_empty')}
              </p>
            )}
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="button-secondary" disabled={isSubmitting}>
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? t('importing') : t('confirm_import')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPreviewModal;
