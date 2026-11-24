import { useMemo, useState } from 'react';
import {
  Camera,
  Edit3,
  Package,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { formatPrice } from '../services/imageUtils';
import type { AppSettings, Product } from '../types';

interface CatalogViewProps {
  products: Product[];
  settings: AppSettings;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => Promise<void>;
}

export function CatalogView({
  products,
  settings,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
}: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category.trim()) set.add(p.category.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'All' || p.category.trim() === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        p.variants.some((v) => v.label.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDeleteProduct(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Product Catalog
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {products.length} registered {products.length === 1 ? 'item' : 'items'} ready for instant price scanning
            </p>
          </div>

          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Add Product
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        {products.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, category, or variant..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {categories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {products.length === 0 ? (
          <div className="mt-10 max-w-md mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Package className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              No products registered yet
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Add your first product with 1 to 5 photos from different angles. MobileNet embeddings are computed locally in seconds.
            </p>
            <button
              type="button"
              onClick={onAddProduct}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition-colors"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Add Your First Product
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="mt-12 text-center py-10">
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">
              No matching products found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Try a different search term or reset the category filter.
            </p>
          </div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all flex flex-col"
              >
                <div className="flex gap-4 p-4">
                  {/* Primary Thumbnail */}
                  <div className="relative h-24 w-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                    {product.angles[0]?.thumbnail ? (
                      <img
                        src={product.angles[0].thumbnail}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-400">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/80 text-white text-[10px] font-bold">
                      <Camera className="h-2.5 w-2.5 text-emerald-400" />
                      {product.angles.length}
                    </span>
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {product.category && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <Tag className="h-3 w-3" />
                          {product.category}
                        </span>
                      )}
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                        {product.name}
                      </h3>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {formatPrice(product.basePrice, settings.currencySymbol)}
                        </span>
                        {product.unit && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            / {product.unit.replace(/^per\s+/i, '')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {product.angles.length}{' '}
                        {product.angles.length === 1 ? 'trained angle' : 'trained angles'}
                        {product.variants.length > 0 &&
                          ` · ${product.variants.length} ${
                            product.variants.length === 1 ? 'variant' : 'variants'
                          }`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Variant Pills Preview */}
                {product.variants.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {product.variants.map((v) => (
                      <span
                        key={v.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {v.label}:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {formatPrice(v.price, settings.currencySymbol)}
                        </strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="mt-auto px-4 py-3 bg-slate-50/80 dark:bg-slate-950/50 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEditProduct(product)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(product)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Delete "{pendingDelete.name}"?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              This removes the product and all {pendingDelete.angles.length} trained reference angles permanently.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
