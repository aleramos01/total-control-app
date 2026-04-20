import React, { useMemo, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { InviteInfo } from '../types';

interface InviteManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestInvite: InviteInfo | null;
  onGenerateInvite: (expiresInDays: number) => Promise<void>;
  onCopyInvite: (code: string) => Promise<void>;
}

const InviteManagementModal: React.FC<InviteManagementModalProps> = ({
  isOpen,
  onClose,
  latestInvite,
  onGenerateInvite,
  onCopyInvite,
}) => {
  const { t } = useLanguage();
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [isLoading, setIsLoading] = useState(false);

  const expirationOptions = useMemo(() => ([
    { value: 7, label: t('invite_expiration_7_days') },
    { value: 14, label: t('invite_expiration_14_days') },
    { value: 30, label: t('invite_expiration_30_days') },
  ]), [t]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await onGenerateInvite(expiresInDays);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-50">{t('invite_management')}</h2>
          <p className="text-sm text-slate-400">{t('invite_management_helper')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('invite_expiration')}</label>
            <select
              value={expiresInDays}
              onChange={event => setExpiresInDays(Number(event.target.value))}
              className="input-base"
            >
              {expirationOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="button-primary justify-center" onClick={handleGenerate} disabled={isLoading}>
            {t('generate_invite')}
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{t('invite_code_generated')}</p>
          {latestInvite ? (
            <div className="mt-3 space-y-4">
              <div className="rounded-2xl border border-dashed border-[var(--app-primary)]/40 bg-slate-950/65 px-4 py-5 text-center">
                <p className="text-3xl font-extrabold tracking-[0.28em] text-slate-50">{latestInvite.code}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <p>
                  {t('invite_expires_label')}: <span className="font-semibold text-slate-100">{latestInvite.expiresAt ? new Date(latestInvite.expiresAt).toLocaleString() : '-'}</span>
                </p>
                <button type="button" className="button-secondary" onClick={() => onCopyInvite(latestInvite.code)}>
                  {t('copy_invite_code')}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t('no_invite_generated')}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="button-secondary">{t('close')}</button>
        </div>
      </div>
    </div>
  );
};

export default InviteManagementModal;
