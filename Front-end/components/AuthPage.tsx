import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../LanguageContext';
import { useNotification } from '../NotificationContext';
import Spinner from './Spinner';
import { BrandSettings } from '../types';
import * as api from '../services/api';

interface AuthPageProps {
  brandSettings: BrandSettings;
}

const AuthPage: React.FC<AuthPageProps> = ({ brandSettings }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'invite'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthStatusLoading, setIsAuthStatusLoading] = useState(true);
  const [publicRegistrationOpen, setPublicRegistrationOpen] = useState(false);
  const { login, register, registerWithInvite } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const isInviteMode = mode === 'invite';
  const isRegisterMode = mode === 'register';

  useEffect(() => {
    let isMounted = true;

    const loadAuthStatus = async () => {
      setIsAuthStatusLoading(true);
      try {
        const status = await api.fetchAuthStatus();
        if (!isMounted) {
          return;
        }

        setPublicRegistrationOpen(status.publicRegistrationOpen);
        if (!status.publicRegistrationOpen) {
          setMode(current => current === 'register' ? 'login' : current);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setPublicRegistrationOpen(false);
        }
      } finally {
        if (isMounted) {
          setIsAuthStatusLoading(false);
        }
      }
    };

    void loadAuthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const modeOptions: Array<{ id: 'login' | 'register' | 'invite'; label: string }> = useMemo(() => ([
    { id: 'login', label: t('login_button') },
    ...(publicRegistrationOpen
      ? [{ id: 'register', label: t('register_button') }]
      : [{ id: 'invite', label: t('invite_mode_button') }]),
  ]), [publicRegistrationOpen, t]);

  const authModeMessage = isAuthStatusLoading
    ? t('checking_access_modes')
    : publicRegistrationOpen
      ? t('register_bootstrap_helper')
      : t('public_registration_closed');

  const switchMode = (nextMode: 'login' | 'register' | 'invite') => {
    if (nextMode === 'register' && !publicRegistrationOpen) {
      return;
    }

    setMode(nextMode);
    if (nextMode === 'login') {
      setInviteCode('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password, rememberMe });
      } else if (mode === 'register') {
        if (!publicRegistrationOpen) {
          throw new Error(t('public_registration_closed'));
        }
        await register({ name, email, password });
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
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-slate-900/55 p-2">
            {modeOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => switchMode(option.id)}
                disabled={isAuthStatusLoading}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  mode === option.id ? 'bg-slate-50 text-slate-900' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-50">
              {mode === 'login' ? t('login_title') : isRegisterMode ? t('register_title') : t('invite_title')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === 'login' ? t('login_description') : isRegisterMode ? t('register_helper') : t('invite_helper')}
            </p>
            <p className="mt-3 text-sm font-medium text-[var(--app-primary)]">
              {authModeMessage}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(isInviteMode || isRegisterMode) && (
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

            {isInviteMode && (
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
              {isLoading ? <Spinner className="h-5 w-5" /> : mode === 'login' ? t('login_button') : mode === 'register' ? t('register_button') : t('invite_button')}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-sm text-slate-400">
            <p>{t('auth_helper')}</p>
            <div className="flex flex-wrap gap-3">
              {mode !== 'login' ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-[var(--app-primary)]"
                >
                  {t('back_to_login')}
                </button>
              ) : null}
              {mode === 'login' ? (
                <>
                  {publicRegistrationOpen ? (
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-semibold text-[var(--app-primary)]"
                    >
                      {t('register_now')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchMode('invite')}
                      className="font-semibold text-[var(--app-primary)]"
                    >
                      {t('have_invite')}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
