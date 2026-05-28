import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import type { CsvColumnMapping } from '../lib/statement-import';

interface CsvColumnMappingModalProps {
  isOpen: boolean;
  headers: string[];
  sampleRows: string[][];
  onConfirm: (mapping: CsvColumnMapping) => void;
  onClose: () => void;
}

const CsvColumnMappingModal: React.FC<CsvColumnMappingModalProps> = ({
  isOpen,
  headers,
  sampleRows,
  onConfirm,
  onClose,
}) => {
  const { t } = useLanguage();

  const [dateIndex, setDateIndex] = useState(-1);
  const [amountIndex, setAmountIndex] = useState(-1);
  const [descriptionIndex, setDescriptionIndex] = useState(-1);

  React.useEffect(() => {
    if (isOpen) {
      setDateIndex(-1);
      setAmountIndex(-1);
      setDescriptionIndex(-1);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isValid = dateIndex !== -1 && amountIndex !== -1 && descriptionIndex !== -1;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({ dateIndex, amountIndex, descriptionIndex });
  };

  const selectClass = 'w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-[var(--app-primary)] focus:outline-none';
  const columnOptions = headers.map((h, i) => (
    <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
  ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-800 p-6 text-slate-100 shadow-2xl sm:p-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            {t('import_statement_csv')}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-50">{t('csv_mapping_title')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{t('csv_mapping_description')}</p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('csv_mapping_date_column')}
            </label>
            <select
              className={selectClass}
              value={dateIndex}
              onChange={e => setDateIndex(Number(e.target.value))}
            >
              <option value={-1}>{t('csv_mapping_select_column')}</option>
              {columnOptions}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('csv_mapping_amount_column')}
            </label>
            <select
              className={selectClass}
              value={amountIndex}
              onChange={e => setAmountIndex(Number(e.target.value))}
            >
              <option value={-1}>{t('csv_mapping_select_column')}</option>
              {columnOptions}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('csv_mapping_description_column')}
            </label>
            <select
              className={selectClass}
              value={descriptionIndex}
              onChange={e => setDescriptionIndex(Number(e.target.value))}
            >
              <option value={-1}>{t('csv_mapping_select_column')}</option>
              {columnOptions}
            </select>
          </div>
        </div>

        {sampleRows.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('csv_mapping_preview')}
            </p>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {headers.map((h, i) => (
                      <th
                        key={i}
                        className={`px-3 py-2 text-left font-semibold ${
                          i === dateIndex ? 'text-cyan-300' :
                          i === amountIndex ? 'text-emerald-300' :
                          i === descriptionIndex ? 'text-violet-300' :
                          'text-slate-400'
                        }`}
                      >
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/5 last:border-0">
                      {headers.map((_, ci) => (
                        <td
                          key={ci}
                          className={`max-w-[140px] truncate px-3 py-1.5 text-xs ${
                            ci === dateIndex ? 'text-cyan-200' :
                            ci === amountIndex ? 'text-emerald-200' :
                            ci === descriptionIndex ? 'text-violet-200' :
                            'text-slate-500'
                          }`}
                        >
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            {t('csv_mapping_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CsvColumnMappingModal;
