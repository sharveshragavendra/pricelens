import { useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Loader2,
  RefreshCw,
  SwitchCamera,
  X,
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { captureVideoFrameAsDataUrl } from '../services/imageUtils';
import { ANGLE_SUGGESTIONS } from '../types';

interface QuickCaptureModalProps {
  existingCount: number;
  maxAngles: number;
  onCapture: (dataUrl: string, suggestedLabel: string) => void;
  onClose: () => void;
}

export function QuickCaptureModal({
  existingCount,
  maxAngles,
  onCapture,
  onClose,
}: QuickCaptureModalProps) {
  const [sessionShots, setSessionShots] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);

  const totalCount = existingCount + sessionShots.length;
  const remaining = Math.max(0, maxAngles - totalCount);
  const currentSuggestion =
    ANGLE_SUGGESTIONS[Math.min(totalCount, ANGLE_SUGGESTIONS.length - 1)] ?? 'Angle';

  const {
    videoRef,
    isReady,
    isStarting,
    error,
    switchCamera,
    retry,
  } = useCamera({ enabled: true, preferredFacingMode: 'environment' });

  const handleSnap = () => {
    if (!videoRef.current || !isReady || remaining <= 0) return;
    const dataUrl = captureVideoFrameAsDataUrl(videoRef.current, 360, 0.82);

    setFlash(true);
    window.setTimeout(() => setFlash(false), 160);

    setSessionShots((prev) => [...prev, dataUrl]);
    onCapture(dataUrl, currentSuggestion);

    if (remaining <= 1) {
      window.setTimeout(onClose, 260);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/90 border-b border-white/10 z-20">
        <div>
          <h3 className="text-sm font-extrabold text-white">Quick-Capture Angles</h3>
          <p className="text-xs text-slate-400">
            {totalCount} of {maxAngles} photos captured
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={switchCamera}
            aria-label="Switch camera"
            className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Live Video Stage */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />

        {/* Shutter flash feedback */}
        {flash && (
          <div className="pointer-events-none absolute inset-0 bg-white/80 z-30 transition-opacity" />
        )}

        {/* Angle Prompt Pill */}
        {isReady && !error && remaining > 0 && (
          <div className="pointer-events-none absolute top-4 inset-x-0 flex justify-center z-20 px-4">
            <div className="px-4 py-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-400/40 text-center shadow-lg">
              <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                Suggested Angle: {currentSuggestion}
              </span>
              <p className="text-[11px] text-slate-200 mt-0.5">
                Center the product inside the frame and tap Capture
              </p>
            </div>
          </div>
        )}

        {/* Center Guide Box */}
        {isReady && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-3xl border-2 border-dashed border-white/60" />
          </div>
        )}

        {/* Loading State */}
        {isStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white gap-2 z-20">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-300">Opening camera...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/95 z-20">
            <div className="max-w-xs w-full text-center space-y-3">
              <CameraOff className="h-10 w-10 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-white">{error.message}</p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Camera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Shutter & Thumbnail Strip */}
      <div className="bg-slate-950 border-t border-white/10 px-4 py-4 pb-safe z-20">
        {sessionShots.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4 overflow-x-auto no-scrollbar">
            {sessionShots.map((shot, idx) => (
              <img
                key={idx}
                src={shot}
                alt={`Captured angle ${idx + 1}`}
                className="h-12 w-12 rounded-lg object-cover border border-emerald-400/70 shrink-0"
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="w-20 text-left">
            <span className="text-xs font-semibold text-slate-400">
              {remaining} left
            </span>
          </div>

          <button
            type="button"
            disabled={!isReady || remaining <= 0}
            onClick={handleSnap}
            aria-label="Capture photo"
            className="h-16 w-16 rounded-full bg-white p-1.5 shadow-lg active:scale-90 transition-transform disabled:opacity-40"
          >
            <div className="h-full w-full rounded-full border-2 border-slate-950 bg-emerald-500 flex items-center justify-center text-slate-950">
              <Camera className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </button>

          <div className="w-20 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
