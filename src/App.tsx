import { useEffect, useState } from 'react';
import { CatalogView } from './components/CatalogView';
import { Navigation } from './components/Navigation';
import { ProductModal } from './components/ProductModal';
import { ScannerView } from './components/ScannerView';
import { SettingsView } from './components/SettingsView';
import { useModel } from './hooks/useModel';
import {
  clearAllProducts,
  deleteProduct,
  importProductsBatch,
  saveProduct,
  saveSettings,
  subscribeAuth,
  subscribeProducts,
  subscribeSettings,
} from './services/repository';
import {
  DEFAULT_SETTINGS,
  type ActiveTab,
  type AppSettings,
  type AuthState,
  type Product,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [authState, setAuthState] = useState<AuthState>({
    mode: 'local',
    ready: false,
    uid: null,
    email: null,
    isAnonymous: true,
    error: null,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Load MobileNet v2 once at app boot so Scanner & Catalog share the warm model
  const modelState = useModel();

  // Subscribe to Firebase Auth (or Local Mode)
  useEffect(() => {
    return subscribeAuth(setAuthState);
  }, []);

  // Subscribe to real-time Products and Settings
  useEffect(() => {
    if (!authState.ready) return;
    const unsubProducts = subscribeProducts(authState.uid, setProducts);
    const unsubSettings = subscribeSettings(authState.uid, setSettings);
    return () => {
      unsubProducts();
      unsubSettings();
    };
  }, [authState.ready, authState.uid]);

  // Apply light/dark theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleAddFirstProduct = () => {
    setActiveTab('catalog');
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleSaveProduct = async (product: Product) => {
    await saveProduct(authState.uid, product);
  };

  const handleDeleteProduct = async (product: Product) => {
    await deleteProduct(authState.uid, product);
  };

  const handleUpdateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(authState.uid, next);
  };

  const handleImportProducts = async (
    imported: Product[],
    replaceExisting: boolean
  ) => {
    await importProductsBatch(authState.uid, imported, replaceExisting);
  };

  const handleClearAll = async () => {
    await clearAllProducts(authState.uid);
  };

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        productCount={products.length}
        authState={authState}
      />

      <main className="flex-1 relative h-full overflow-hidden">
        {activeTab === 'scanner' && (
          <ScannerView
            products={products}
            settings={settings}
            modelState={modelState}
            onAddFirstProduct={handleAddFirstProduct}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogView
            products={products}
            settings={settings}
            onAddProduct={handleOpenAddModal}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            products={products}
            authState={authState}
            onUpdateSettings={handleUpdateSettings}
            onImportProducts={handleImportProducts}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      {modalOpen && (
        <ProductModal
          initialProduct={editingProduct}
          currencySymbol={settings.currencySymbol}
          onSave={handleSaveProduct}
          onClose={() => {
            setModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
