import { Cloud, CloudOff, Package, ScanLine, Settings } from 'lucide-react';
import type { ActiveTab, AuthState } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  productCount: number;
  authState: AuthState;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof ScanLine }> = [
  { id: 'scanner', label: 'Scanner', icon: ScanLine },
  { id: 'catalog', label: 'Catalog', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Navigation({
  activeTab,
  onSelectTab,
  productCount,
  authState,
}: NavigationProps) {
  return (
    <>
      {/* Desktop Side Rail */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-slate-200 dark:md:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-30">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-emerald-500 text-emerald-400 dark:text-slate-950 shadow-sm">
            <ScanLine className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              PriceLens
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Visual Price Display
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {label}
                </span>
                {id === 'catalog' && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      active
                        ? 'bg-slate-950/15 text-slate-950'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {productCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sync Status Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/70">
            {authState.mode === 'firebase' ? (
              <Cloud className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {authState.mode === 'firebase' ? 'Firebase Cloud Sync' : 'Local Offline Mode'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {authState.mode === 'firebase'
                  ? authState.email || 'Anonymous Shop Session'
                  : 'IndexedDB on this device'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-3 h-16 max-w-lg mx-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  {id === 'catalog' && productCount > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold">
                      {productCount > 99 ? '99+' : productCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
