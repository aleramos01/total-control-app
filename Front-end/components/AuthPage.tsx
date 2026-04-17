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
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ name, email, password });
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
    <div className="min-h-screen bg-[var(--app-bg)] px-5 py-8 text-[var(--app-text)]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.45)] backdrop-blur lg:p-12">
          <div className="max-w-xl space-y-5">
            <span className="inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              White-label finance
            </span>
            <h1 className="text-4xl font-extrabold leading-tight text-slate-50">
              {brandSettings.productName}
            </h1>
            <p className="text-lg leading-8 text-slate-300">
              {brandSettings.marketingHeadline || t('marketing_fallback')}
            </p>
            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
                <p className="text-sm text-slate-400">{t('transactions')}</p>
                <p className="mt-2 text-2xl font-bold text-slate-50">SQLite</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
                <p className="text-sm text-slate-400">{t('manage_brand')}</p>
                <p className="mt-2 text-2xl font-bold text-slate-50">API</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
                <p className="text-sm text-slate-400">{t('data_owner')}</p>
                <p className="mt-2 text-2xl font-bold text-slate-50">Secure</p>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.45)] backdrop-blur lg:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-50">{isLogin ? t('login_title') : t('register_title')}</h2>
            <p className="mt-2 text-sm text-slate-400">{t('auth_helper')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
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

            <button type="submit" disabled={isLoading} className="button-primary w-full justify-center">
              {isLoading ? <Spinner className="h-5 w-5" /> : isLogin ? t('login_button') : t('register_button')}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            {isLogin ? t('no_account') : t('has_account')}{' '}
            <button type="button" onClick={() => setIsLogin(current => !current)} className="font-semibold text-[var(--app-primary)]">
              {isLogin ? t('register_now') : t('login_now')}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
