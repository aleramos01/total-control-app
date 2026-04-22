import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useLanguage } from './LanguageContext';
import { useNotification } from './NotificationContext';
import { useAppSettings } from './AppSettingsContext';
import ManageCategoriesModal from './components/ManageCategoriesModal';
import { CATEGORY_COLORS, CATEGORY_KEYS, CATEGORY_MAP, CategoryKey } from './constants';
import * as api from './services/api';
import Spinner from './components/Spinner';
import AuthPage from './components/AuthPage';
import { useAuth } from './hooks/useAuth';
import { AppSettings, BrandSettings, CustomCategory, ExportPayload, InviteInfo, Transaction, TransactionFilters, TransactionType } from './types';
import UpcomingBills from './components/UpcomingBills';
import BrandSettingsModal from './components/BrandSettingsModal';
import InviteManagementModal from './components/InviteManagementModal';
import AppSettingsModal from './components/AppSettingsModal';
import { buildTransactionsCsv } from './lib/transactions';
import ExpenseChart from './components/ExpenseChart';
import { BarChartIcon } from './components/icons/BarChartIcon';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { CogIcon } from './components/icons/CogIcon';
import { PlusIcon } from './components/icons/PlusIcon';
import { LogoutIcon } from './components/icons/LogoutIcon';
import { parseImportFilePayload } from './services/parsers';

const emptyBrandSettings: BrandSettings = {
  productName: 'Total Control',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#275df5',
  accentColor: '#5c7cfa',
  surfaceColor: '#f7f8fa',
  textColor: '#1f2937',
  supportEmail: null,
  marketingHeadline: 'Controle financeiro simples, seguro e pronto para venda.',
};

const defaultCurrentMonthFilters: TransactionFilters = {
  preset: 'current_month',
};

type MobileTab = 'summary' | 'transactions' | 'account';

const App: React.FC = () => {
  const { t, locale } = useLanguage();
  const { showNotification } = useNotification();
  const { settings: appSettings, refreshSettings } = useAppSettings();
  const { user, isAuthenticated, logout } = useAuth();

  const [brandSettings, setBrandSettings] = useState<BrandSettings>(emptyBrandSettings);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>(defaultCurrentMonthFilters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('summary');
  const [latestInvite, setLatestInvite] = useState<InviteInfo | null>(null);

  const fetchBrand = useCallback(async () => {
    try {
      const settings = await api.fetchBrandSettings();
      setBrandSettings(settings);
    } catch (error) {
      console.error(error);
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-primary', brandSettings.primaryColor);
    root.style.setProperty('--app-accent', brandSettings.accentColor);
    root.style.setProperty('--app-surface', brandSettings.surfaceColor);
    root.style.setProperty('--app-text', brandSettings.textColor);
    root.setAttribute('lang', locale.toLowerCase());
    root.setAttribute('data-app-timezone', appSettings.timezone);
    root.setAttribute('data-billing-day-default', String(appSettings.billingDayDefault));
    document.title = brandSettings.productName;

    const faviconLink = document.querySelector('link[rel="icon"]') ?? document.createElement('link');
    faviconLink.setAttribute('rel', 'icon');
    faviconLink.setAttribute('href', brandSettings.faviconUrl || '/favicon.ico');

    if (!faviconLink.parentNode) {
      document.head.appendChild(faviconLink);
    }
  }, [appSettings.billingDayDefault, appSettings.timezone, brandSettings, locale]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setTransactions([]);
      setCustomCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [transactionsData, categoriesData] = await Promise.all([
        api.fetchTransactions(filters),
        api.fetchCustomCategories(),
      ]);
      setTransactions(transactionsData);
      setCustomCategories(categoriesData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch data';
      showNotification(message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filters, isAuthenticated, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { allCategoriesMap, allCategoryKeys } = useMemo(() => {
    const map: { [key: string]: { name: string; color: string } } = {};
    CATEGORY_KEYS.forEach(key => {
      map[key] = {
        name: CATEGORY_MAP[key as CategoryKey][locale] || CATEGORY_MAP[key as CategoryKey]['en-US'],
        color: CATEGORY_COLORS[key as CategoryKey],
      };
    });
    customCategories.forEach(category => {
      map[category.key] = {
        name: category.name,
        color: category.color,
      };
    });
    return { allCategoriesMap: map, allCategoryKeys: Object.keys(map) };
  }, [customCategories, locale]);

  const totals = useMemo(() => {
    const totalIncome = transactions
      .filter(transaction => transaction.type === TransactionType.INCOME)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalExpenses = transactions
      .filter(transaction => transaction.type === TransactionType.EXPENSE)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const upcomingCount = transactions.filter(transaction => transaction.isRecurring && transaction.dueDate).length;
    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      upcomingCount,
    };
  }, [transactions]);

  const handleSaveTransaction = useCallback(async (transaction: Omit<Transaction, 'id'> & { id?: string }) => {
    try {
      const savedTransactions = await api.saveTransactionBatch(transaction);
      if (transaction.id) {
        setTransactions(prev => prev.map(item => item.id === savedTransactions[0].id ? savedTransactions[0] : item));
      } else {
        fetchData();
      }
      showNotification(transaction.id ? t('transaction_updated_success') : t('transaction_added_success'), 'success');
      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save transaction';
      showNotification(message, 'error');
    }
  }, [fetchData, showNotification, t]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setTransactions(prev => prev.filter(item => item.id !== id));
      showNotification(t('transaction_deleted_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete transaction';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleTogglePaidStatus = useCallback(async (id: string, isPaid: boolean) => {
    try {
      const updatedTransaction = await api.toggleTransactionPaidStatus(id, isPaid);
      setTransactions(prev => prev.map(item => item.id === id ? updatedTransaction : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transaction';
      showNotification(message, 'error');
    }
  }, [showNotification]);

  const handleAddCategory = useCallback(async (category: Omit<CustomCategory, 'id' | 'key'>) => {
    try {
      const created = await api.addCustomCategory(category);
      setCustomCategories(prev => [...prev, created]);
      showNotification(t('category_added_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create category';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    try {
      await api.deleteCustomCategory(id);
      setCustomCategories(prev => prev.filter(item => item.id !== id));
      showNotification(t('category_deleted_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('category_in_use_error');
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleSaveBrandSettings = useCallback(async (settings: BrandSettings) => {
    try {
      const updated = await api.updateBrandSettings(settings);
      setBrandSettings(updated);
      showNotification(t('settings_saved_success'), 'success');
      setIsBrandModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save brand settings';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleSaveAppSettings = useCallback(async (settings: AppSettings) => {
    try {
      await api.updateAppSettings(settings);
      await refreshSettings();
      showNotification(t('settings_saved_success'), 'success');
      setIsAppSettingsModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save app settings';
      showNotification(message, 'error');
    }
  }, [refreshSettings, showNotification, t]);

  const handleGenerateInvite = useCallback(async (expiresInDays: number) => {
    try {
      const invite = await api.createInvite(expiresInDays);
      setLatestInvite(invite);
      showNotification(t('invite_created_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create invite';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleCopyInvite = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showNotification(t('invite_copied_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy invite code';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleExportCsv = useCallback(() => {
    if (transactions.length === 0) {
      return;
    }
    const csv = buildTransactionsCsv(transactions, allCategoriesMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [allCategoriesMap, transactions]);

  const handleExportJson = useCallback(async () => {
    try {
      const payload = await api.exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'total-control-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export data';
      showNotification(message, 'error');
    }
  }, [showNotification]);

  const handleImportJson = useCallback(async (file: File) => {
    try {
      const payload = parseImportFilePayload(JSON.parse(await file.text()) as unknown);
      await api.importData({
        transactions: payload.transactions,
        categories: payload.categories,
      });
      showNotification(t('import_success'), 'success');
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      showNotification(message, 'error');
    }
  }, [fetchData, showNotification, t]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <Spinner className="h-10 w-10 text-[var(--app-primary)]" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthPage brandSettings={brandSettings} />;
  }

  const tabs: Array<{ id: MobileTab; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }> = [
    { id: 'summary', label: t('summary_tab'), Icon: BarChartIcon },
    { id: 'transactions', label: t('transactions'), Icon: CalendarIcon },
    { id: 'account', label: t('user_menu'), Icon: CogIcon },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-4 pb-28 pt-6 text-[var(--app-text)] sm:px-6 sm:pb-12">
      <div className="mx-auto max-w-5xl">
        <Header
          brandSettings={brandSettings}
          user={user}
        />

        <div className="mb-6 hidden rounded-full border border-white/10 bg-slate-800/70 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.28)] sm:flex">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
                activeTab === id ? 'bg-slate-900 text-slate-50' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-white/10 bg-slate-800/70">
            <Spinner className="h-8 w-8 text-[var(--app-primary)]" />
          </div>
        ) : (
          <div className="grid gap-6">
            {activeTab === 'summary' ? (
              <>
                <Dashboard
                  totalIncome={totals.totalIncome}
                  totalExpenses={totals.totalExpenses}
                  balance={totals.balance}
                  upcomingCount={totals.upcomingCount}
                />
                <UpcomingBills
                  transactions={transactions}
                  onTogglePaidStatus={handleTogglePaidStatus}
                  allCategoriesMap={allCategoriesMap}
                />
                <ExpenseChart transactions={transactions} allCategoriesMap={allCategoriesMap} />
              </>
            ) : null}

            {activeTab === 'transactions' ? (
              <TransactionList
                transactions={transactions}
                filters={filters}
                onFiltersChange={setFilters}
                onEdit={(id) => {
                  const transaction = transactions.find(item => item.id === id) ?? null;
                  setEditingTransaction(transaction);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteTransaction}
                onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
                onExportCsv={handleExportCsv}
                onExportJson={handleExportJson}
                onImportJson={handleImportJson}
                allCategoriesMap={allCategoriesMap}
              />
            ) : null}

            {activeTab === 'account' ? (
              <section className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[28px] border border-white/10 bg-slate-800/70 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
                  <div className="mb-4">
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{t('user_menu')}</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-50">{user.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{t('language_label')}</p>
                      <div className="mt-3">
                        <LanguageSwitcher fixed={false} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{t('current_settings')}</p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        <p>{t('locale_label')}: <span className="font-semibold text-slate-100">{appSettings.locale}</span></p>
                        <p>{t('currency_label')}: <span className="font-semibold text-slate-100">{appSettings.currency}</span></p>
                        <p>{t('timezone_label')}: <span className="font-semibold text-slate-100">{appSettings.timezone}</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-slate-50">{t('tools_label')}</h3>
                      <p className="text-sm text-slate-400">{t('manage_brand')}</p>
                    </div>
                    <div className="grid gap-3">
                      <button type="button" className="button-secondary justify-center" onClick={() => setIsCategoryModalOpen(true)}>
                        {t('categories')}
                      </button>
                      {user.role === 'admin' ? (
                        <button type="button" className="button-secondary justify-center" onClick={() => setIsAppSettingsModalOpen(true)}>
                          {t('app_settings')}
                        </button>
                      ) : null}
                      {user.role === 'admin' ? (
                        <button type="button" className="button-secondary justify-center" onClick={() => setIsInviteModalOpen(true)}>
                          {t('invite_management')}
                        </button>
                      ) : null}
                      {user.role === 'admin' ? (
                        <button type="button" className="button-primary justify-center" onClick={() => setIsBrandModalOpen(true)}>
                          {t('manage_brand')}
                        </button>
                      ) : null}
                      <button type="button" className="button-ghost justify-center" onClick={logout}>
                        <LogoutIcon className="h-5 w-5" />
                        {t('logout')}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-slate-50">{t('categories_table_title')}</h3>
                      <p className="text-sm text-slate-400">{t('categories_overview')}</p>
                    </div>
                    <div className="space-y-3">
                      {customCategories.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-5 text-sm text-slate-400">
                          {t('no_custom_categories')}
                        </p>
                      ) : (
                        customCategories.slice(0, 5).map(category => (
                          <div key={category.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                              <span className="font-medium text-slate-100">{category.name}</span>
                            </div>
                            <button type="button" className="text-sm font-semibold text-rose-300" onClick={() => handleDeleteCategory(category.id)}>
                              {t('delete')}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setEditingTransaction(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-8 right-5 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[var(--app-primary)] text-white shadow-[0_18px_45px_rgba(99,102,241,0.4)] transition hover:scale-105 sm:flex"
        aria-label={t('create_transaction')}
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      <nav className="fixed inset-x-4 bottom-4 z-40 rounded-full border border-white/10 bg-slate-900/92 p-1 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2">
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-3">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-full px-3 py-3 text-xs font-semibold transition ${
                activeTab === id ? 'bg-slate-800 text-slate-50' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-full px-3 py-3 text-xs font-semibold text-[var(--app-primary)] transition sm:hidden"
          >
            <PlusIcon className="h-5 w-5" />
            <span>{t('create_transaction')}</span>
          </button>
        </div>
      </nav>

      <TransactionForm
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        transaction={editingTransaction}
        allCategoriesMap={allCategoriesMap}
        allCategoryKeys={allCategoryKeys}
        customCategories={customCategories}
      />

      <ManageCategoriesModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        customCategories={customCategories}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {user.role === 'admin' ? (
        <AppSettingsModal
          isOpen={isAppSettingsModalOpen}
          onClose={() => setIsAppSettingsModalOpen(false)}
          settings={appSettings}
          onSave={handleSaveAppSettings}
        />
      ) : null}

      {user.role === 'admin' ? (
        <BrandSettingsModal
          isOpen={isBrandModalOpen}
          onClose={() => setIsBrandModalOpen(false)}
          settings={brandSettings}
          onSave={handleSaveBrandSettings}
        />
      ) : null}

      {user.role === 'admin' ? (
        <InviteManagementModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          latestInvite={latestInvite}
          onGenerateInvite={handleGenerateInvite}
          onCopyInvite={handleCopyInvite}
        />
      ) : null}
    </div>
  );
};

export default App;
