import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  LogIn,
  LogOut,
  Moon,
  Sliders,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Zap,
} from 'lucide-react';
import {
  registerWithEmail,
  signInWithEmail,
  signOutAccount,
} from '../services/repository';
import type {
  AppSettings,
  AuthState,
  CatalogBackupPayload,
  Product,
  ScanSpeedMs,
} from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  products: Product[];
  authState: AuthState;
  onUpdateSettings: (next: AppSettings) => Promise<void>;
  onImportProducts: (products: Product[], replaceExisting: boolean) => Promise<void>;
  onClearAll: () => Promise<void>;
}

const CURRENCY_PRESETS = ['₹', '$', '€', '£'];

const SPEED_OPTIONS: Array<{ value: ScanSpeedMs; label: string; desc: string }> = [
  { value: 300, label: 'Fast (300ms)', desc: 'Snappiest response for busy counters' },
  { value: 500, label: 'Balanced (500ms)', desc: 'Recommended speed & smooth battery use' },
  { value: 1000, label: 'Battery Saver (1000ms)', desc: 'Best for long mobile counter shifts' },
];

export function SettingsView({
  settings,
  products,
  authState,
  onUpdateSettings,
  onImportProducts,
  onClearAll,
}: SettingsViewProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [customCurrency, setCustomCurrency] = useState(
    CURRENCY_PRESETS.includes(settings.currencySymbol) ? '' : settings.currencySymbol
  );
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Firebase Shop Account Auth form
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 5000);
  };

  const handleExportJson = () => {
    const payload: CatalogBackupPayload = {
      app: 'PriceLens',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      products,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricelens-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotice('success', `Exported ${products.length} products with embeddings.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<CatalogBackupPayload>;
      if (!Array.isArray(parsed.products)) {
        throw new Error('Invalid PriceLens backup file: missing products array.');
      }

      const validProducts = parsed.products.filter(
        (p): p is Product =>
          Boolean(p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.angles))
      );

      if (validProducts.length === 0) {
        throw new Error('No valid products found in the selected backup file.');
      }

      await onImportProducts(validProducts, false);
      if (parsed.settings) {
        await onUpdateSettings({ ...settings, ...parsed.settings });
      }
      showNotice(
        'success',
        `Imported ${validProducts.length} products into your ${
          authState.mode === 'firebase' ? 'Firebase catalog' : 'device storage'
        }.`
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to import backup JSON.'
      );
    }
  };

  const handleClearConfirm = async () => {
    setClearing(true);
    try {
      await onClearAll();
      setConfirmClear(false);
      showNotice('success', 'All products have been cleared.');
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Failed to clear catalog.'
      );
    } finally {
      setClearing(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      showNotice('error', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password);
        showNotice('success', 'Signed in to Firebase shop account. Syncing catalog...');
      } else {
        await registerWithEmail(email, password);
        showNotice('success', 'Shop account created! Your catalog now syncs across devices.');
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Authentication failed.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Settings &amp; Backup
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Tune scanner accuracy, currency, Firebase cloud sync, and portable JSON backups
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
            aria-label="Toggle light or dark theme"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors shrink-0"
          >
            {settings.theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-slate-700" />
                Dark Mode
              </>
            )}
          </button>
        </div>

        {/* Status Notification Banner */}
        {notice && (
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold border ${
              notice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Firebase Cloud Sync & Account Card */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  authState.mode === 'firebase'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {authState.mode === 'firebase' ? (
                  <Cloud className="h-5 w-5" />
                ) : (
                  <CloudOff className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {authState.mode === 'firebase'
                    ? 'Firebase Cloud Backend Connected'
                    : 'Local Offline Mode (Firebase Not Configured)'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {authState.mode === 'firebase'
                    ? 'Firestore syncs products & embeddings with built-in offline IndexedDB cache.'
                    : 'Add your Firebase keys to .env to enable real-time multi-device cloud sync.'}
                </p>
              </div>
            </div>
          </div>

          {authState.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-300">
              Firebase Auth Notice: {authState.error}
            </div>
          )}

          {authState.mode === 'firebase' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              {authState.email && !authState.isAnonymous ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Signed-in Shop Account
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {authState.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOutAccount()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Sign in with Email to share the same catalog across phone &amp; desktop:
                    </p>
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setAuthMode('signin')}
                        className={`px-2.5 py-1 rounded-md ${
                          authMode === 'signin'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signup')}
                        className={`px-2.5 py-1 rounded-md ${
                          authMode === 'signup'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        Create
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="shop@example.com"
                      className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold disabled:opacity-60"
                  >
                    {authMode === 'signin' ? (
                      <>
                        <LogIn className="h-4 w-4" />
                        {authBusy ? 'Signing in...' : 'Sign In & Sync'}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        {authBusy ? 'Creating account...' : 'Create Shop Account'}
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>

        {/* Currency Selector */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Currency Symbol
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Displayed on the live price overlay and product catalog
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {CURRENCY_PRESETS.map((symbol) => {
              const active = settings.currencySymbol === symbol;
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => {
                    setCustomCurrency('');
                    onUpdateSettings({ ...settings, currencySymbol: symbol });
                  }}
                  className={`h-11 min-w-[56px] px-4 rounded-xl text-lg font-extrabold border transition-all ${
                    active
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {symbol}
                </button>
              );
            })}

            <input
              type="text"
              maxLength={6}
              value={customCurrency}
              onChange={(e) => {
                const val = e.target.value;
                setCustomCurrency(val);
                if (val.trim()) {
                  onUpdateSettings({ ...settings, currencySymbol: val.trim() });
                }
              }}
              placeholder="Custom (e.g. Rs.)"
              className="h-11 w-40 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </section>

        {/* Scanner Tuning: Confidence Threshold & Scan Speed */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
          {/* Confidence Threshold Slider */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-500" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  High Confidence Threshold
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-sm font-black">
                {Math.round(settings.confidenceThreshold * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Matches above this score show the large primary price card. Matches between 60% and this threshold show the Top-3 strip.
            </p>
            <input
              type="range"
              min={60}
              max={95}
              step={1}
              value={Math.round(settings.confidenceThreshold * 100)}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  confidenceThreshold: Number(e.target.value) / 100,
                })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1">
              <span>60% (Relaxed)</span>
              <span>78% (Default)</span>
              <span>95% (Strict)</span>
            </div>
          </div>

          {/* Scan Speed Selector */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-emerald-500" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Scan Speed
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SPEED_OPTIONS.map((opt) => {
                const active = settings.scanIntervalMs === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, scanIntervalMs: opt.value })
                    }
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      active
                        ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <p className="text-sm font-extrabold">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Backup & Transfer */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Backup &amp; Transfer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export all {products.length} products, thumbnails, and AI embeddings as a portable JSON file or restore onto another device.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={products.length === 0}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-extrabold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export Catalog (JSON)
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-extrabold text-sm border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import Catalog (JSON)
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Clear All Data
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanently delete every saved product and embedding from your catalog.
              </p>
            </div>
            <button
              type="button"
              disabled={products.length === 0}
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white font-bold text-xs transition-colors disabled:opacity-40 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </div>
        </section>
      </div>

      {/* Clear All Confirmation Modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Clear entire catalog?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              This will permanently delete all {products.length} products and their MobileNet embeddings. Consider exporting a JSON backup first.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setConfirmClear(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearConfirm}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-60"
              >
                {clearing ? 'Clearing...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
