import React from 'react';
import { BrandSettings, User } from '../types';
import { useLanguage } from '../LanguageContext';

interface HeaderProps {
  brandSettings: BrandSettings;
  user: User;
}

const Header: React.FC<HeaderProps> = ({ brandSettings, user }) => {
  const { t } = useLanguage();

  return (
    <header className="mb-6 rounded-[28px] border border-white/10 bg-slate-800/70 px-5 py-6 text-center shadow-[0_20px_70px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        {brandSettings.logoUrl ? (
          <img src={brandSettings.logoUrl} alt={brandSettings.productName} className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--app-primary)] to-[var(--app-accent)] text-lg font-extrabold text-white shadow-lg">
            {brandSettings.productName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('header_title')}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-50">{brandSettings.productName}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{brandSettings.marketingHeadline || t('header_subtitle')}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="font-semibold text-slate-100">{user.name}</span>
          <span className="text-slate-500">•</span>
          <span>{user.role === 'admin' ? t('admin_badge') : t('member_badge')}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
