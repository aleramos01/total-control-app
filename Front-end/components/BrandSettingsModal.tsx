import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { BrandSettings } from '../types';

interface BrandSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrandSettings;
  onSave: (settings: BrandSettings) => void;
}

const BrandSettingsModal: React.FC<BrandSettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<BrandSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-50">{t('brand_settings')}</h2>
          <p className="text-sm text-slate-400">{t('manage_brand')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('product_name')}</label>
            <input value={draft.productName} onChange={event => setDraft(current => ({ ...current, productName: event.target.value }))} className="input-base" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('support_email')}</label>
            <input value={draft.supportEmail ?? ''} onChange={event => setDraft(current => ({ ...current, supportEmail: event.target.value || null }))} className="input-base" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('logo_url')}</label>
            <input value={draft.logoUrl ?? ''} onChange={event => setDraft(current => ({ ...current, logoUrl: event.target.value || null }))} className="input-base" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('favicon_url')}</label>
            <input value={draft.faviconUrl ?? ''} onChange={event => setDraft(current => ({ ...current, faviconUrl: event.target.value || null }))} className="input-base" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('primary_color')}</label>
            <input type="color" value={draft.primaryColor} onChange={event => setDraft(current => ({ ...current, primaryColor: event.target.value }))} className="block h-12 w-full rounded-2xl border border-white/10 bg-slate-900 p-1" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('accent_color')}</label>
            <input type="color" value={draft.accentColor} onChange={event => setDraft(current => ({ ...current, accentColor: event.target.value }))} className="block h-12 w-full rounded-2xl border border-white/10 bg-slate-900 p-1" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('surface_color')}</label>
            <input type="color" value={draft.surfaceColor} onChange={event => setDraft(current => ({ ...current, surfaceColor: event.target.value }))} className="block h-12 w-full rounded-2xl border border-white/10 bg-slate-900 p-1" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('text_color')}</label>
            <input type="color" value={draft.textColor} onChange={event => setDraft(current => ({ ...current, textColor: event.target.value }))} className="block h-12 w-full rounded-2xl border border-white/10 bg-slate-900 p-1" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('marketing_headline')}</label>
            <input value={draft.marketingHeadline} onChange={event => setDraft(current => ({ ...current, marketingHeadline: event.target.value }))} className="input-base" />
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

export default BrandSettingsModal;
