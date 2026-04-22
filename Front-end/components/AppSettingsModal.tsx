import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { AppSettings } from '../types';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const timezoneOptions: AppSettings['timezone'][] = [
  'America/Sao_Paulo',
  'America/New_York',
  'UTC',
];

const AppSettingsModal: React.FC<AppSettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-50">{t('app_settings')}</h2>
          <p className="text-sm text-slate-400">{t('app_settings_helper')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('currency_label')}</label>
            <select
              value={draft.currency}
              onChange={event => setDraft(current => ({ ...current, currency: event.target.value as AppSettings['currency'] }))}
              className="input-base"
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('locale_label')}</label>
            <select
              value={draft.locale}
              onChange={event => setDraft(current => ({ ...current, locale: event.target.value as AppSettings['locale'] }))}
              className="input-base"
            >
              <option value="pt-BR">pt-BR</option>
              <option value="en-US">en-US</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('timezone_label')}</label>
            <select
              value={draft.timezone}
              onChange={event => setDraft(current => ({ ...current, timezone: event.target.value }))}
              className="input-base"
            >
              {timezoneOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('billing_day_default')}</label>
            <input
              type="number"
              min={1}
              max={31}
              value={draft.billingDayDefault}
              onChange={event => setDraft(current => ({ ...current, billingDayDefault: Number(event.target.value) || 1 }))}
              className="input-base"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button type="button" className="button-secondary" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="button-primary" onClick={() => onSave(draft)}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
};

export default AppSettingsModal;
