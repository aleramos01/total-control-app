import React, { useEffect, useState } from 'react';
import { BrandSettings, User } from '../types';
import { useLanguage } from '../LanguageContext';

interface HeaderProps {
  brandSettings: BrandSettings;
  user: User;
}

const Header: React.FC<HeaderProps> = ({ brandSettings, user }) => {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 90);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logoSmall = brandSettings.logoUrl ? (
    <img
      src={brandSettings.logoUrl}
      alt={brandSettings.productName}
      className="h-8 w-8 rounded-xl object-cover"
    />
  ) : (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--app-primary)] to-[var(--app-accent)] text-xs font-extrabold text-white">
      {brandSettings.productName.slice(0, 2).toUpperCase()}
    </div>
  );

  return (
    <header
      className={`sticky top-0 z-30 will-change-transform border border-white/10 bg-slate-800 transition-all duration-300 ${
        scrolled
          ? 'mb-3 rounded-2xl px-5 py-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.5)]'
          : 'mb-6 rounded-[28px] px-5 py-6 shadow-[0_20px_70px_rgba(15,23,42,0.45)]'
      }`}
    >
      {scrolled ? (
        /* ── Compact bar ── */
        <div className="mx-auto flex max-w-5xl animate-fade-in items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {logoSmall}
            <span className="font-bold text-slate-100">{brandSettings.productName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-100">{user.name}</span>
            <span className="hidden text-slate-500 sm:inline">•</span>
            <span className="hidden text-slate-400 sm:inline">
              {user.role === 'admin' ? t('admin_badge') : t('member_badge')}
            </span>
          </div>
        </div>
      ) : (
        /* ── Full header ── */
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          {brandSettings.logoUrl ? (
            <img
              src={brandSettings.logoUrl}
              alt={brandSettings.productName}
              className="h-16 w-16 rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--app-primary)] to-[var(--app-accent)] text-lg font-extrabold text-white shadow-lg">
              {brandSettings.productName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              {t('header_title')}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-50">{brandSettings.productName}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {brandSettings.marketingHeadline || t('header_subtitle')}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-100">{user.name}</span>
            <span className="text-slate-500">•</span>
            <span>{user.role === 'admin' ? t('admin_badge') : t('member_badge')}</span>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
