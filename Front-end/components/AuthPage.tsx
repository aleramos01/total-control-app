import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../LanguageContext';
import { useNotification } from '../NotificationContext';
import Spinner from './Spinner';
import { BrandSettings } from '../types';

interface AuthPageProps {
  brandSettings: BrandSettings;
}

const AuthPage: React.FC<AuthPageProps> = ({ brandSettings }) => {
  const [mode, setMode] = useState<'login' | 'invite'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { login, registerWithInvite } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password, rememberMe });
      } else {
        await registerWithInvite({ name, email, password, inviteCode });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('invalid_credentials');
      showNotification(message, 'error');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-5 py-8 text-[var(--app-text)] sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_30%)]" />
          <div className="relative max-w-xl space-y-6">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
              Personal Finance
            </span>
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold leading-tight text-slate-50 sm:text-5xl">
                {brandSettings.productName}
              </h1>
              <p className="max-w-lg text-lg leading-8 text-slate-200">
                {t('login_tagline')}
              </p>
              <p className="max-w-lg text-sm leading-7 text-slate-400">
                {brandSettings.marketingHeadline || t('login_description')}
              </p>
            </div>
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t('transactions')}</p>
                <p className="mt-3 text-2xl font-bold text-slate-50">Tudo em um lugar</p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t('data_owner')}</p>
                <p className="mt-3 text-2xl font-bold text-slate-50">Sem novela de login</p>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-slate-800/70 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.45)] backdrop-blur lg:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-50">{mode === 'login' ? t('login_title') : t('invite_button')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === 'login' ? t('login_description') : t('invite_helper')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'invite' && (
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-300">{t('name')}</label>
                <input
                  id="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="input-base"
                  required
                />
              </div>
            )}

            {mode === 'invite' && (
              <div>
                <label htmlFor="inviteCode" className="mb-2 block text-sm font-medium text-slate-300">{t('invite_code')}</label>
                <input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={event => setInviteCode(event.target.value.toUpperCase())}
                  className="input-base"
                  placeholder={t('invite_code_placeholder')}
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">{t('email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">{t('password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="input-base"
                required
                minLength={8}
              />
            </div>

            {mode === 'login' ? (
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={event => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-[var(--app-primary)]"
                />
                <span>{t('remember_me')}</span>
              </label>
            ) : null}

            <button type="submit" disabled={isLoading} className="button-primary w-full justify-center">
              {isLoading ? <Spinner className="h-5 w-5" /> : mode === 'login' ? t('login_button') : t('invite_button')}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-sm text-slate-400">
            <p>{t('auth_helper')}</p>
            <button
              type="button"
              onClick={() => setMode(current => current === 'login' ? 'invite' : 'login')}
              className="font-semibold text-[var(--app-primary)]"
            >
              {mode === 'login' ? t('have_invite') : t('back_to_login')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
