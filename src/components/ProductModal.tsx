import { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressImageFile, loadImageElement } from '../services/imageUtils';
import { extractNormalizedEmbedding, loadVisionModel } from '../services/visionEngine';
import {
  ANGLE_SUGGESTIONS,
  type Product,
  type ProductAngle,
  type ProductVariant,
} from '../types';
import { QuickCaptureModal } from './QuickCaptureModal';

interface ProductModalProps {
  initialProduct: Product | null;
  currencySymbol: string;
  onSave: (product: Product) => Promise<void>;
  onClose: () => void;
}

interface DraftAngle {
  id: string;
  label: string;
  thumbnail: string;
  storagePath?: string;
  embedding?: number[];
}

interface DraftVariant {
  id: string;
  label: string;
  priceText: string;
}

const MAX_ANGLES = 5;
const UNIT_PRESETS = ['per piece', 'per kg', 'per pack', 'per bottle', 'per box'];

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ProductModal({
  initialProduct,
  currencySymbol,
  onSave,
  onClose,
}: ProductModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [priceText, setPriceText] = useState(
    initialProduct ? String(initialProduct.basePrice) : ''
  );
  const [unit, setUnit] = useState(initialProduct?.unit ?? 'per piece');
  const [category, setCategory] = useState(initialProduct?.category ?? '');
  const [variants, setVariants] = useState<DraftVariant[]>(
    initialProduct?.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceText: String(v.price),
    })) ?? []
  );
  const [angles, setAngles] = useState<DraftAngle[]>(
    initialProduct?.angles.map((a) => ({ ...a })) ?? []
  );

  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setError(null);
    const availableSlots = MAX_ANGLES - angles.length;
    if (availableSlots <= 0) {
      setError(`Maximum of ${MAX_ANGLES} angles allowed per product.`);
      return;
    }

    const toProcess = files.slice(0, availableSlots);
    try {
      const added: DraftAngle[] = [];
      for (let i = 0; i < toProcess.length; i += 1) {
        const compressed = await compressImageFile(toProcess[i], 320, 0.78);
        const idx = angles.length + i;
        added.push({
          id: generateId(),
          label: ANGLE_SUGGESTIONS[idx] ?? `Angle ${idx + 1}`,
          thumbnail: compressed,
        });
      }
      setAngles((prev) => [...prev, ...added]);
    } catch {
      setError('One or more selected files could not be processed as images.');
    }
  };

  const handleQuickCaptureAdd = (dataUrl: string, suggestedLabel: string) => {
    setAngles((prev) => {
      if (prev.length >= MAX_ANGLES) return prev;
      return [
        ...prev,
        {
          id: generateId(),
          label: suggestedLabel,
          thumbnail: dataUrl,
        },
      ];
    });
  };

  const handleRemoveAngle = (id: string) => {
    setAngles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { id: generateId(), label: '', priceText: '' }]);
  };

  const handleUpdateVariant = (
    id: string,
    field: 'label' | 'priceText',
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleRemoveVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const parsedPrice = Number.parseFloat(priceText);

    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid base price.');
      return;
    }
    if (angles.length === 0) {
      setError('Add at least 1 product photo (3–5 angles recommended for best accuracy).');
      return;
    }

    const cleanedVariants: ProductVariant[] = [];
    for (const v of variants) {
      const label = v.label.trim();
      const price = Number.parseFloat(v.priceText);
      if (!label && !v.priceText.trim()) continue;
      if (!label || !Number.isFinite(price) || price < 0) {
        setError('Each variant must have both a label and a valid price.');
        return;
      }
      cleanedVariants.push({ id: v.id, label, price });
    }

    setSaving(true);
    try {
      const needsEmbeddingCount = angles.filter((a) => !a.embedding).length;
      if (needsEmbeddingCount > 0) {
        setSaveStatus('Loading MobileNet v2 vision model...');
        await loadVisionModel();
      }

      const finalAngles: ProductAngle[] = [];
      let processedNew = 0;

      for (const draft of angles) {
        if (draft.embedding && draft.embedding.length > 0) {
          finalAngles.push({
            id: draft.id,
            label: draft.label,
            thumbnail: draft.thumbnail,
            ...(draft.storagePath ? { storagePath: draft.storagePath } : {}),
            embedding: draft.embedding,
          });
        } else {
          processedNew += 1;
          setSaveStatus(
            `Computing AI embedding (${processedNew}/${needsEmbeddingCount})...`
          );
          const img = await loadImageElement(draft.thumbnail);
          const embedding = extractNormalizedEmbedding(img);
          finalAngles.push({
            id: draft.id,
            label: draft.label,
            thumbnail: draft.thumbnail,
            embedding,
          });
        }
      }

      setSaveStatus('Saving product to database...');
      const now = Date.now();
      const product: Product = {
        id: initialProduct?.id ?? generateId(),
        name: trimmedName,
        basePrice: parsedPrice,
        unit: unit.trim(),
        category: category.trim(),
        variants: cleanedVariants,
        angles: finalAngles,
        createdAt: initialProduct?.createdAt ?? now,
        updatedAt: now,
      };

      await onSave(product);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process product images or save to database.'
      );
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm sm:p-4">
        <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {initialProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add 1–5 angles for instant, high-accuracy visual price display
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              aria-label="Close modal"
              className="h-9 w-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <form
            id="pricelens-product-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          >
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Multi-Angle Image Onboarding Section */}
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-sm font-bold text-slate-900 dark:text-white">
                  Product Photos ({angles.length}/{MAX_ANGLES})
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Tip: Capture Front, Side &amp; Top
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <button
                  type="button"
                  disabled={saving || angles.length >= MAX_ANGLES}
                  onClick={() => setShowQuickCapture(true)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors disabled:opacity-45"
                >
                  <Camera className="h-4 w-4" strokeWidth={2.5} />
                  Snap with Camera
                </button>
                <button
                  type="button"
                  disabled={saving || angles.length >= MAX_ANGLES}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-45"
                >
                  <Upload className="h-4 w-4" />
                  Upload Photos
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {angles.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {angles.map((angle, idx) => (
                    <div
                      key={angle.id}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-square"
                    >
                      <img
                        src={angle.thumbnail}
                        alt={angle.label || `Angle ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/75 text-white text-[10px] font-bold">
                        {angle.label}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRemoveAngle(angle.id)}
                        aria-label={`Remove angle ${idx + 1}`}
                        className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-rose-600 text-white shadow hover:bg-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  No photos added yet. Snap or upload 1–5 clear photos of this item.
                </div>
              )}
            </section>

            {/* Core Fields: Name, Base Price, Unit, Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Organic Basmati Rice, Classic Cold Coffee"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Base Price ({currencySymbol}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder="120"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Snacks, Beverages, Produce"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Unit (Optional)
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g., per piece, per kg, per pack"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {UNIT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setUnit(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        unit === preset
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional Variants Section */}
            <section className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Variants (Optional)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Show multiple sizes or pack weights directly on the price card
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Variant
                </button>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2.5">
                  {variants.map((variant) => (
                    <div key={variant.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={variant.label}
                        onChange={(e) =>
                          handleUpdateVariant(variant.id, 'label', e.target.value)
                        }
                        placeholder="Label (e.g., 250g, Large)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={variant.priceText}
                          onChange={(e) =>
                            handleUpdateVariant(variant.id, 'priceText', e.target.value)
                          }
                          placeholder="90"
                          className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variant.id)}
                        aria-label="Remove variant"
                        className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </form>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 flex items-center justify-between gap-3 shrink-0 pb-safe">
            <div className="min-w-0">
              {saving && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span className="truncate">{saveStatus}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="pricelens-product-form"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {initialProduct ? 'Update Product' : 'Save & Train'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQuickCapture && (
        <QuickCaptureModal
          existingCount={angles.length}
          maxAngles={MAX_ANGLES}
          onCapture={handleQuickCaptureAdd}
          onClose={() => setShowQuickCapture(false)}
        />
      )}
    </>
  );
}
