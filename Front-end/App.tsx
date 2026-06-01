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
import { useVersionCheck } from './hooks/useVersionCheck';
import { Account, AppSettings, BrandSettings, CustomCategory, ExportPayload, ImportPreviewPayload, InviteInfo, StatementImportAction, StatementImportPreview, Transaction, TransactionFilters, TransactionScope, TransactionType } from './types';
import UpcomingBills from './components/UpcomingBills';
import BrandSettingsModal from './components/BrandSettingsModal';
import InviteManagementModal from './components/InviteManagementModal';
import AppSettingsModal from './components/AppSettingsModal';
import { buildTransactionsCsv, buildTransactionsCsvFilename } from './lib/transactions';
import { exportTransactionsPdf } from './lib/pdf-export';
import ExpenseChart from './components/ExpenseChart';
import BalanceEvolutionChart from './components/BalanceEvolutionChart';
import AccountManagerModal from './components/AccountManagerModal';
import { BarChartIcon } from './components/icons/BarChartIcon';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { CogIcon } from './components/icons/CogIcon';
import { PlusIcon } from './components/icons/PlusIcon';
import { LogoutIcon } from './components/icons/LogoutIcon';
import { parseImportFilePayload } from './services/parsers';
import StatePanel from './components/StatePanel';
import ImportPreviewModal from './components/ImportPreviewModal';
import StatementImportPreviewModal from './components/StatementImportPreviewModal';
import CsvColumnMappingModal from './components/CsvColumnMappingModal';
import { buildStatementImportPreview, detectCsvHeaders, parseBankStatementCsvWithMapping, parseBankStatementCsv, type CsvColumnMapping } from './lib/statement-import';
import { parseOfxFile } from './lib/ofx-import';

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
  preset: '',
};

type MobileTab = 'summary' | 'transactions' | 'account';

const App: React.FC = () => {
  useVersionCheck(); // auto-reload when a new Vercel deploy is detected
  const { t, locale } = useLanguage();
  const { showNotification } = useNotification();
  const { settings: appSettings, refreshSettings } = useAppSettings();
  const { user, isAuthenticated, logout } = useAuth();

  const [brandSettings, setBrandSettings] = useState<BrandSettings>(emptyBrandSettings);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [summaryTransactions, setSummaryTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrappingError, setBootstrappingError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(defaultCurrentMonthFilters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('summary');
  const [latestInvite, setLatestInvite] = useState<InviteInfo | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewPayload | null>(null);
  const [statementImportPreview, setStatementImportPreview] = useState<StatementImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isStatementImporting, setIsStatementImporting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [csvMappingState, setCsvMappingState] = useState<{
    rawText: string;
    fileName: string;
    headers: string[];
    sampleRows: string[][];
  } | null>(null);

  const fetchBrand = useCallback(async () => {
    setBootstrappingError(null);
    try {
      const settings = await api.fetchBrandSettings();
      setBrandSettings(settings);
    } catch (error) {
      console.error(error);
      setBootstrappingError(error instanceof Error ? error.message : t('startup_error_description'));
    } finally {
      setIsBootstrapping(false);
    }
  }, [t]);

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

  const fetchSummaryData = useCallback(async () => {
    if (!isAuthenticated) {
      setSummaryTransactions([]);
      setCustomCategories([]);
      setDataError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setDataError(null);
    try {
      const [transactionsData, categoriesData, accountsData] = await Promise.all([
        api.fetchTransactions({}),
        api.fetchCustomCategories(),
        api.fetchAccounts().catch((err: unknown) => {
          console.error('[fetchAccounts] failed:', err);
          return [] as Account[];
        }),
      ]);
      setSummaryTransactions(transactionsData);
      setCustomCategories(categoriesData);
      setAccounts(accountsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch data';
      setDataError(message);
      showNotification(message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, showNotification]);

  const fetchFilteredTransactions = useCallback(async () => {
    if (!isAuthenticated) {
      setFilteredTransactions([]);
      return;
    }
    try {
      const data = await api.fetchTransactions(transactionFilters);
      setFilteredTransactions(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      showNotification(message, 'error');
    }
  }, [isAuthenticated, transactionFilters, showNotification]);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  useEffect(() => {
    fetchFilteredTransactions();
  }, [fetchFilteredTransactions]);

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
    // Transfers (transferToAccountId set) are excluded from income/expense totals —
    // they are balance-neutral (money moves between accounts, not in/out of net worth).
    const totalIncome = summaryTransactions
      .filter(transaction => transaction.type === TransactionType.INCOME && !transaction.transferToAccountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalExpenses = summaryTransactions
      .filter(transaction => transaction.type === TransactionType.EXPENSE && !transaction.transferToAccountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const upcomingCount = summaryTransactions.filter(transaction => transaction.isRecurring && transaction.dueDate).length;
    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      upcomingCount,
    };
  }, [summaryTransactions]);

  const handleSaveTransaction = useCallback(async (transaction: Omit<Transaction, 'id'> & { id?: string }, scope: TransactionScope) => {
    try {
      const savedTransactions = await api.saveTransactionBatch(transaction, scope);
      if (transaction.id) {
        const updatedMap = new Map(savedTransactions.map(item => [item.id, item]));
        const updater = (prev: Transaction[]) => prev.map(item => updatedMap.get(item.id) ?? item);
        setFilteredTransactions(updater);
        setSummaryTransactions(updater);
      } else {
        fetchSummaryData();
        fetchFilteredTransactions();
      }
      const successMessage = !transaction.id
        ? t('transaction_added_success')
        : scope === 'series'
          ? t('transaction_series_updated_success')
          : t('transaction_updated_success');
      showNotification(successMessage, 'success');
      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save transaction';
      showNotification(message, 'error');
    }
  }, [fetchSummaryData, fetchFilteredTransactions, showNotification, t]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setFilteredTransactions(prev => prev.filter(item => item.id !== id));
      setSummaryTransactions(prev => prev.filter(item => item.id !== id));
      showNotification(t('transaction_deleted_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete transaction';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleDeleteTransactions = useCallback(async (ids: string[]) => {
    try {
      await api.deleteTransactions(ids);
      setFilteredTransactions(prev => prev.filter(item => !ids.includes(item.id)));
      setSummaryTransactions(prev => prev.filter(item => !ids.includes(item.id)));
      showNotification(t('transactions_deleted_success').replace('{count}', String(ids.length)), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete transactions';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleTogglePaidStatus = useCallback(async (id: string, isPaid: boolean) => {
    try {
      const updatedTransaction = await api.toggleTransactionPaidStatus(id, isPaid);
      const updater = (prev: Transaction[]) => prev.map(item => item.id === id ? updatedTransaction : item);
      setFilteredTransactions(updater);
      setSummaryTransactions(updater);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transaction';
      showNotification(message, 'error');
    }
  }, [showNotification]);

  const handleTogglePaidMany = useCallback(async (ids: string[], isPaid: boolean) => {
    try {
      const updatedTransactions = await api.toggleTransactionsPaidStatus(ids, isPaid);
      const updatedMap = new Map(updatedTransactions.map(transaction => [transaction.id, transaction]));
      const updater = (prev: Transaction[]) => prev.map(item => updatedMap.get(item.id) ?? item);
      setFilteredTransactions(updater);
      setSummaryTransactions(updater);
      showNotification(
        (isPaid ? t('transactions_marked_paid_success') : t('transactions_marked_unpaid_success')).replace('{count}', String(updatedTransactions.length)),
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transactions';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const handleAddCategory = useCallback(async (category: Omit<CustomCategory, 'id' | 'key'>): Promise<CustomCategory> => {
    const created = await api.addCustomCategory(category);
    setCustomCategories(prev => [...prev, created]);
    showNotification(t('category_added_success'), 'success');
    return created;
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

  const handleAddAccount = useCallback(async (account: Omit<Account, 'id'>) => {
    try {
      const created = await api.createAccount(account);
      setAccounts(prev => [...prev, created]);
      showNotification('Conta adicionada com sucesso.', 'success');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Falha ao criar conta', 'error');
    }
  }, [showNotification]);

  const handleDeleteAccount = useCallback(async (id: string) => {
    try {
      await api.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      showNotification('Conta removida com sucesso.', 'success');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Falha ao remover conta', 'error');
    }
  }, [showNotification]);

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

  const handleExportPdf = useCallback(() => {
    if (filteredTransactions.length === 0) {
      showNotification(t('export_csv_empty'), 'error');
      return;
    }
    const symbol = appSettings.currency === 'USD' ? '$' : 'R$';
    const period = transactionFilters.preset === 'current_month' || !transactionFilters.from
      ? new Date().toISOString().slice(0, 7)
      : transactionFilters.from.slice(0, 7);
    exportTransactionsPdf({
      transactions: filteredTransactions,
      allCategoriesMap,
      productName: brandSettings.productName,
      currencySymbol: symbol,
      period,
    });
  }, [allCategoriesMap, appSettings.currency, brandSettings.productName, transactionFilters, showNotification, t, filteredTransactions]);

  const handleExportCsv = useCallback(() => {
    if (filteredTransactions.length === 0) {
      showNotification(t('export_csv_empty'), 'error');
      return;
    }
    const csv = buildTransactionsCsv(filteredTransactions, allCategoriesMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildTransactionsCsvFilename();
    link.click();
    URL.revokeObjectURL(url);
  }, [allCategoriesMap, showNotification, t, filteredTransactions]);

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

      if (payload.transactions.length === 0 && payload.categories.length === 0) {
        showNotification(t('import_empty_error'), 'error');
        return;
      }

      setImportPreview({
        fileName: file.name,
        transactions: payload.transactions,
        categories: payload.categories,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      showNotification(message, 'error');
    }
  }, [showNotification, t]);

  const buildAndShowStatementPreview = useCallback(async (
    fileName: string,
    parsed: ReturnType<typeof parseBankStatementCsv>,
  ) => {
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      showNotification(t('statement_import_empty_error'), 'error');
      return;
    }

    const dates = parsed.rows.map(row => row.date).sort();
    const existingTransactions = dates.length > 0
      ? await api.fetchTransactions({
        from: new Date(new Date(dates[0]).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date(new Date(dates[dates.length - 1]).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })
      : [];

    setStatementImportPreview(buildStatementImportPreview(
      fileName,
      parsed,
      existingTransactions,
      allCategoriesMap,
      allCategoryKeys,
    ));
  }, [allCategoriesMap, allCategoryKeys, showNotification, t]);

  const handleImportStatementCsv = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const detection = detectCsvHeaders(text);

      if (detection.headers.length === 0) {
        showNotification(t('statement_import_empty_error'), 'error');
        return;
      }

      const allFound = detection.dateIndex !== -1 && detection.descriptionIndex !== -1 && detection.amountIndex !== -1;
      if (!allFound) {
        // Headers not recognized — open mapping modal
        setCsvMappingState({ rawText: text, fileName: file.name, headers: detection.headers, sampleRows: detection.sampleRows });
        return;
      }

      const parsed = parseBankStatementCsv(text);
      await buildAndShowStatementPreview(file.name, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import statement';
      showNotification(message, 'error');
    }
  }, [buildAndShowStatementPreview, showNotification, t]);

  const handleCsvMappingConfirm = useCallback(async (mapping: CsvColumnMapping) => {
    if (!csvMappingState) return;
    try {
      const parsed = parseBankStatementCsvWithMapping(csvMappingState.rawText, mapping);
      setCsvMappingState(null);
      await buildAndShowStatementPreview(csvMappingState.fileName, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import statement';
      showNotification(message, 'error');
    }
  }, [buildAndShowStatementPreview, csvMappingState, showNotification]);

  const handleImportStatementOfx = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseOfxFile(text);

      if (parsed.rows.length === 0 && parsed.errors.length === 0) {
        showNotification(t('statement_import_empty_error'), 'error');
        return;
      }

      if (parsed.rows.length === 0 && parsed.errors.length > 0) {
        showNotification(t('ofx_parse_error'), 'error');
        return;
      }

      await buildAndShowStatementPreview(file.name, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import OFX file';
      showNotification(message, 'error');
    }
  }, [buildAndShowStatementPreview, showNotification, t]);

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview) {
      return;
    }

    setIsImporting(true);
    try {
      await api.importData({
        transactions: importPreview.transactions,
        categories: importPreview.categories,
      });
      setImportPreview(null);
      showNotification(t('import_success'), 'success');
      fetchSummaryData();
      fetchFilteredTransactions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      showNotification(message, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [fetchSummaryData, fetchFilteredTransactions, importPreview, showNotification, t]);

  const handleConfirmStatementImport = useCallback(async (actions: StatementImportAction[]) => {
    if (actions.length === 0) {
      showNotification(t('statement_preview_nothing_selected'), 'error');
      return;
    }

    setIsStatementImporting(true);
    try {
      const result = await api.applyStatementImportActions(actions);
      setStatementImportPreview(null);
      showNotification(
        t('statement_import_success')
          .replace('{updated}', String(result.updated.length))
          .replace('{created}', String(result.created.length)),
        'success',
      );
      fetchSummaryData();
      fetchFilteredTransactions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reconcile statement';
      showNotification(message, 'error');
    } finally {
      setIsStatementImporting(false);
    }
  }, [fetchSummaryData, fetchFilteredTransactions, showNotification, t]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <Spinner className="h-10 w-10 text-[var(--app-primary)]" />
      </div>
    );
  }

  if (bootstrappingError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
        <div className="w-full max-w-2xl">
          <StatePanel
            title={t('startup_error_title')}
            description={bootstrappingError}
            actionLabel={t('retry_action')}
            onAction={() => {
              setIsBootstrapping(true);
              fetchBrand();
            }}
          />
        </div>
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
  const shouldBlockDataViews = Boolean(dataError && !isLoading && summaryTransactions.length === 0 && customCategories.length === 0);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-4 pb-28 pt-6 text-[var(--app-text)] sm:px-6 sm:pb-12">
      <div className="mx-auto max-w-5xl">
        <Header
          brandSettings={brandSettings}
          user={user}
        />

        {dataError && !shouldBlockDataViews ? (
          <div className="mb-6">
            <StatePanel
              title={t('sync_error_title')}
              description={dataError}
              actionLabel={t('retry_action')}
              onAction={() => { fetchSummaryData(); fetchFilteredTransactions(); }}
            />
          </div>
        ) : null}

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
                {shouldBlockDataViews ? (
                  <StatePanel
                    title={t('sync_error_title')}
                    description={dataError ?? t('startup_error_description')}
                    actionLabel={t('retry_action')}
                    onAction={() => { fetchSummaryData(); fetchFilteredTransactions(); }}
                  />
                ) : (
                  <>
                    <Dashboard
                      totalIncome={totals.totalIncome}
                      totalExpenses={totals.totalExpenses}
                      balance={totals.balance}
                      upcomingCount={totals.upcomingCount}
                      accounts={accounts}
                      transactions={summaryTransactions}
                      onAddAccount={() => setIsAccountModalOpen(true)}
                    />
                    <UpcomingBills
                      transactions={summaryTransactions}
                      onTogglePaidStatus={handleTogglePaidStatus}
                      allCategoriesMap={allCategoriesMap}
                    />
                    <BalanceEvolutionChart transactions={summaryTransactions} />
                    <ExpenseChart transactions={summaryTransactions} allCategoriesMap={allCategoriesMap} />
                  </>
                )}
              </>
            ) : null}

            {activeTab === 'transactions' ? (
              shouldBlockDataViews ? (
                <StatePanel
                  title={t('sync_error_title')}
                  description={dataError ?? t('startup_error_description')}
                  actionLabel={t('retry_action')}
                  onAction={() => { fetchSummaryData(); fetchFilteredTransactions(); }}
                />
              ) : (
                <TransactionList
                  transactions={filteredTransactions}
                  filters={transactionFilters}
                  onFiltersChange={setTransactionFilters}
                  onEdit={(id) => {
                    const transaction = filteredTransactions.find(item => item.id === id) ?? null;
                    setEditingTransaction(transaction);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteTransaction}
                  onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
                  onExportCsv={handleExportCsv}
                  onExportJson={handleExportJson}
                  onExportPdf={handleExportPdf}
                  onImportJson={handleImportJson}
                  onImportStatementCsv={handleImportStatementCsv}
                  onImportStatementOfx={handleImportStatementOfx}
                  onResetFilters={() => setTransactionFilters(defaultCurrentMonthFilters)}
                  onDeleteMany={handleDeleteTransactions}
                  onTogglePaidMany={handleTogglePaidMany}
                  allCategoriesMap={allCategoriesMap}
                />
              )
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
                      <button type="button" className="button-secondary justify-center" onClick={() => setIsAccountModalOpen(true)}>
                        Contas bancárias
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
        data-tooltip={t('create_transaction')}
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
        onAddCategory={handleAddCategory}
        accounts={accounts}
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

      <ImportPreviewModal
        isOpen={Boolean(importPreview)}
        preview={importPreview}
        isSubmitting={isImporting}
        onClose={() => {
          if (!isImporting) {
            setImportPreview(null);
          }
        }}
        onConfirm={handleConfirmImport}
        allCategoriesMap={allCategoriesMap}
      />

      <StatementImportPreviewModal
        isOpen={Boolean(statementImportPreview)}
        preview={statementImportPreview}
        isSubmitting={isStatementImporting}
        onClose={() => {
          if (!isStatementImporting) {
            setStatementImportPreview(null);
          }
        }}
        onConfirm={handleConfirmStatementImport}
        allCategoriesMap={allCategoriesMap}
      />

      <AccountManagerModal
        isOpen={isAccountModalOpen}
        accounts={accounts}
        onClose={() => setIsAccountModalOpen(false)}
        onAdd={handleAddAccount}
        onDelete={handleDeleteAccount}
      />

      <CsvColumnMappingModal
        isOpen={Boolean(csvMappingState)}
        headers={csvMappingState?.headers ?? []}
        sampleRows={csvMappingState?.sampleRows ?? []}
        onConfirm={handleCsvMappingConfirm}
        onClose={() => setCsvMappingState(null)}
      />
    </div>
  );
};

export default App;
