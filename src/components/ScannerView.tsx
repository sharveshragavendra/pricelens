import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  SwitchCamera,
  X,
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import type { ModelState } from '../hooks/useModel';
import { formatPrice } from '../services/imageUtils';
import {
  analyzeFrameQuality,
  extractNormalizedEmbedding,
  matchProducts,
  TemporalSmoother,
} from '../services/visionEngine';
import {
  UNCERTAIN_MIN_THRESHOLD,
  type AppSettings,
  type FrameQualityResult,
  type Product,
  type ProductMatch,
} from '../types';

interface ScannerViewProps {
  products: Product[];
  settings: AppSettings;
  modelState: ModelState;
  onAddFirstProduct: () => void;
}

export function ScannerView({
  products,
  settings,
  modelState,
  onAddFirstProduct,
}: ScannerViewProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);

  const [confirmedMatch, setConfirmedMatch] = useState<ProductMatch | null>(null);
  const [uncertainMatches, setUncertainMatches] = useState<ProductMatch[]>([]);
  const [pinnedFallback, setPinnedFallback] = useState<ProductMatch | null>(null);
  const [frameQuality, setFrameQuality] = useState<FrameQualityResult>({
    status: 'good',
    label: null,
    brightness: 128,
    motion: 0,
  });

  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const smootherRef = useRef<TemporalSmoother>(new TemporalSmoother(3));
  const isScanningFrameRef = useRef(false);

  const {
    videoRef,
    isReady: cameraReady,
    isStarting: cameraStarting,
    error: cameraError,
    devices,
    selectedDeviceId,
    switchCamera,
    selectDevice,
    retry: retryCamera,
  } = useCamera({ enabled: true, preferredFacingMode: 'environment' });

  // Reset temporal buffer whenever catalog changes or scanning resumes
  useEffect(() => {
    smootherRef.current.reset();
    if (products.length === 0) {
      setConfirmedMatch(null);
      setUncertainMatches([]);
      setPinnedFallback(null);
    }
  }, [products]);

  // Live inference loop (runs every 300ms / 500ms / 1000ms)
  useEffect(() => {
    if (!cameraReady || !modelState.ready || isPaused || products.length === 0) {
      return;
    }

    if (!qualityCanvasRef.current) {
      qualityCanvasRef.current = document.createElement('canvas');
    }

    const tick = () => {
      if (isScanningFrameRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      isScanningFrameRef.current = true;
      try {
        // 1. Lighting & motion stability check on hidden canvas
        const { quality, nextGray } = analyzeFrameQuality(
          video,
          qualityCanvasRef.current!,
          prevGrayRef.current
        );
        prevGrayRef.current = nextGray;
        setFrameQuality(quality);

        // 2. Extract MobileNet v2 L2-normalized embedding from live video frame
        const frameEmbedding = extractNormalizedEmbedding(video);

        // 3. Compute cosine similarity across all stored products (best angle per product)
        const ranked = matchProducts(frameEmbedding, products);
        const top = ranked[0] ?? null;

        // 4. Push through 3-frame temporal smoothing buffer to prevent price flicker
        const smoothed = smootherRef.current.push(top, UNCERTAIN_MIN_THRESHOLD);

        if (
          smoothed.stableProductId &&
          smoothed.smoothedScore >= settings.confidenceThreshold
        ) {
          const matchedEntry = ranked.find(
            (m) => m.product.id === smoothed.stableProductId
          );
          if (matchedEntry) {
            setConfirmedMatch({
              ...matchedEntry,
              score: smoothed.smoothedScore,
            });
            setUncertainMatches([]);
            setPinnedFallback(null);
            return;
          }
        }

        // Uncertain range (60% up to high-confidence threshold): show Top-3 strip
        if (top && top.score >= UNCERTAIN_MIN_THRESHOLD) {
          setConfirmedMatch(null);
          setUncertainMatches(ranked.filter((m) => m.score >= 0.45).slice(0, 3));
        } else {
          // Below 60% -> No Match state
          setConfirmedMatch(null);
          setUncertainMatches([]);
        }
      } catch {
        // Silently skip transient frame errors while video stream stabilizes
      } finally {
        isScanningFrameRef.current = false;
      }
    };

    const intervalId = window.setInterval(tick, settings.scanIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    cameraReady,
    modelState.ready,
    isPaused,
    products,
    settings.confidenceThreshold,
    settings.scanIntervalMs,
    videoRef,
  ]);

  const activeCardMatch = pinnedFallback ?? confirmedMatch;
  const viewfinderColor = activeCardMatch
    ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
    : uncertainMatches.length > 0
      ? 'border-amber-400'
      : 'border-white/80';

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      if (prev) {
        smootherRef.current.reset();
        setPinnedFallback(null);
      }
      return !prev;
    });
  };

  return (
    <div className="relative h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* Full-Viewport Live Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Subtle Top & Bottom Gradient Scrims for Legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950/80 via-slate-950/35 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent z-10" />

      {/* Top Control Bar */}
      <header className="absolute top-0 inset-x-0 z-20 px-4 pt-4 sm:px-6 sm:pt-5 flex items-start justify-between gap-3">
        {/* Left: Model Status Pill + Lighting/Quality Badge */}
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 text-white shadow-lg">
            {modelState.loading ? (
              <>
                <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  {modelState.stage} ({modelState.progress}%)
                </span>
              </>
            ) : modelState.error ? (
              <button
                type="button"
                onClick={modelState.retry}
                className="flex items-center gap-2 text-xs font-semibold text-rose-300"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>AI Failed — Tap to Retry</span>
              </button>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold tracking-wide">AI Ready</span>
              </>
            )}
          </div>

          {/* Lighting & Quality Warning Badge */}
          {cameraReady && !isPaused && frameQuality.label && products.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/95 text-slate-950 text-xs font-bold shadow-lg animate-slide-up">
              {frameQuality.status === 'too_dark' ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>{frameQuality.label}</span>
            </div>
          )}
        </div>

        {/* Right: Camera Switch + Pause/Resume Controls */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={handleTogglePause}
            aria-label={isPaused ? 'Resume live scanning' : 'Pause live scanning'}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full backdrop-blur-md border text-xs font-bold shadow-lg transition-all active:scale-95 ${
              isPaused
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-950/75 text-white border-white/15 hover:bg-slate-900'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">Resume</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                <span className="hidden sm:inline">Pause</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (devices.length > 2) {
                setShowCameraPicker((v) => !v);
              } else {
                switchCamera();
              }
            }}
            aria-label="Switch camera"
            title="Switch camera"
            className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white backdrop-blur-md border border-white/15 shadow-lg transition-all active:scale-95"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>

          {/* Multi-Webcam Selector Popover (Desktop with >2 cameras) */}
          {showCameraPicker && devices.length > 1 && (
            <div className="absolute right-0 top-12 w-60 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/15 p-2 shadow-2xl z-30">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 mb-1">
                <span className="text-xs font-bold text-slate-300">Select Camera</span>
                <button
                  type="button"
                  onClick={() => setShowCameraPicker(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {devices.map((device) => (
                <button
                  key={device.deviceId}
                  type="button"
                  onClick={() => {
                    selectDevice(device.deviceId);
                    setShowCameraPicker(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold truncate transition-colors ${
                    device.deviceId === selectedDeviceId
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {device.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Center Corner-Bracket Viewfinder */}
      {cameraReady && !cameraError && products.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10 pb-28 md:pb-16">
          <div className="relative w-60 h-60 sm:w-72 sm:h-72">
            {/* Top-Left Bracket */}
            <div
              className={`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-2xl transition-colors duration-200 ${viewfinderColor}`}
            />
            {/* Top-Right Bracket */}
            <div
              className={`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-2xl transition-colors duration-200 ${viewfinderColor}`}
            />
            {/* Bottom-Left Bracket */}
            <div
              className={`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-2xl transition-colors duration-200 ${viewfinderColor}`}
            />
            {/* Bottom-Right Bracket */}
            <div
              className={`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-2xl transition-colors duration-200 ${viewfinderColor}`}
            />

            {!isPaused && !activeCardMatch && (
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400/50 rounded-full animate-scan-pulse" />
            )}

            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="px-4 py-1.5 rounded-full bg-slate-950/80 border border-white/20 text-white text-xs font-bold tracking-wider uppercase">
                  Scanning Paused
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Starting Indicator */}
      {cameraStarting && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-10 gap-3">
          <Loader2 className="h-9 w-9 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Starting camera...</p>
        </div>
      )}

      {/* Camera Permission / Hardware Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/95 z-20">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <CameraOff className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-white">Camera Access Needed</h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              {cameraError.message}
            </p>
            {cameraError.type === 'permission_denied' && (
              <div className="mt-4 rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5 text-left text-xs text-slate-300 space-y-1.5">
                <p className="font-bold text-slate-100">How to enable camera access:</p>
                <p>1. Tap the lock or camera icon in your browser address bar.</p>
                <p>2. Set Camera permission to Allow for this site.</p>
                <p>3. Tap Retry Camera below (or reload the page).</p>
              </div>
            )}
            <button
              type="button"
              onClick={retryCamera}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Camera
            </button>
          </div>
        </div>
      )}

      {/* Empty Catalog Call-to-Action Overlay */}
      {!cameraError && products.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pb-24 md:pb-6">
          <div className="max-w-sm w-full rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-white/15 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Camera className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Your Catalog Is Empty</h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Register a product with 1–5 quick photos so PriceLens can recognize it and display its price instantly.
            </p>
            <button
              type="button"
              onClick={onAddFirstProduct}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg transition-transform active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Add your first product to start scanning
            </button>
          </div>
        </div>
      )}

      {/* Bottom Results Overlay Area */}
      {!cameraError && products.length > 0 && (
        <div className="absolute inset-x-0 bottom-20 md:bottom-6 z-20 px-4 sm:px-6 flex flex-col items-center pointer-events-none">
          {/* 1. Primary High-Confidence Price Display Card */}
          {activeCardMatch && (
            <div className="pointer-events-auto w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/80 dark:border-emerald-500/40 shadow-pos-card p-5 sm:p-6 animate-slide-up">
              <div className="flex items-start gap-4">
                {activeCardMatch.product.angles[0]?.thumbnail && (
                  <img
                    src={activeCardMatch.product.angles[0].thumbnail}
                    alt={activeCardMatch.product.name}
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {Math.round(activeCardMatch.score * 100)}% match
                      </span>
                      {activeCardMatch.product.category && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                          {activeCardMatch.product.category}
                        </span>
                      )}
                    </div>

                    {pinnedFallback && (
                      <button
                        type="button"
                        onClick={() => setPinnedFallback(null)}
                        aria-label="Close preview"
                        className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate mt-1.5">
                    {activeCardMatch.product.name}
                  </h2>

                  {/* Arm's-Length High-Contrast Price */}
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {formatPrice(
                        activeCardMatch.product.basePrice,
                        settings.currencySymbol
                      )}
                    </span>
                    {activeCardMatch.product.unit && (
                      <span className="text-base sm:text-lg font-bold text-slate-500 dark:text-slate-400">
                        / {activeCardMatch.product.unit.replace(/^per\s+/i, '')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Variants Price Pills */}
              {activeCardMatch.product.variants.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                  {activeCardMatch.product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {variant.label}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        {formatPrice(variant.price, settings.currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Top-3 Uncertain Range Fallback Strip (60% to High Confidence Threshold) */}
          {!activeCardMatch && uncertainMatches.length > 0 && (
            <div className="pointer-events-auto w-full max-w-2xl animate-slide-up">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 drop-shadow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Closest Matches — Tap to Inspect
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {uncertainMatches.map((item) => (
                  <button
                    key={item.product.id}
                    type="button"
                    onClick={() => setPinnedFallback(item)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/20 dark:border-slate-700 text-left shadow-xl hover:border-emerald-400 transition-all active:scale-[0.98]"
                  >
                    {item.product.angles[0]?.thumbnail && (
                      <img
                        src={item.product.angles[0].thumbnail}
                        alt={item.product.name}
                        className="h-12 w-12 rounded-xl object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">
                        {formatPrice(item.product.basePrice, settings.currencySymbol)}
                      </p>
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {Math.round(item.score * 100)}% match
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. No Match State (<60%) */}
          {!activeCardMatch && uncertainMatches.length === 0 && (
            <div className="px-4 py-2.5 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 text-slate-200 text-xs sm:text-sm font-semibold shadow-lg">
              {isPaused
                ? 'Live scanning paused'
                : 'Point camera at a registered item'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
