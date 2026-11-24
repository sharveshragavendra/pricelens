import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorType =
  | 'permission_denied'
  | 'no_camera'
  | 'in_use'
  | 'unsupported'
  | 'unknown';

export interface CameraErrorInfo {
  type: CameraErrorType;
  message: string;
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export interface UseCameraOptions {
  enabled: boolean;
  preferredFacingMode?: 'environment' | 'user';
}

export function useCamera({
  enabled,
  preferredFacingMode = 'environment',
}: UseCameraOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(preferredFacingMode);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<CameraErrorInfo | null>(null);
  const [restartToken, setRestartToken] = useState(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }));
      setDevices(videoInputs);
    } catch {
      // Ignore enumeration errors on restricted browsers
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        type: 'unsupported',
        message: 'Camera access requires a modern browser over HTTPS (or localhost).',
      });
      return;
    }

    let cancelled = false;

    async function startCamera() {
      stopStream();
      setIsStarting(true);
      setError(null);

      const videoConstraints: MediaTrackConstraints = selectedDeviceId
        ? {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraints,
          });
        } catch {
          // Fallback to generic video constraint if ideal facingMode/device fails on desktop
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const activeTrack = stream.getVideoTracks()[0];
        const settings = activeTrack?.getSettings?.();
        if (settings?.deviceId && !selectedDeviceId) {
          setSelectedDeviceId(settings.deviceId);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play().catch(() => undefined);
        }

        await refreshDevices();

        if (!cancelled) {
          setIsReady(true);
          setIsStarting(false);
        }
      } catch (err) {
        if (cancelled) return;
        setIsStarting(false);
        setIsReady(false);

        const domErr = err as DOMException | Error;
        const name = domErr?.name ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError({
            type: 'permission_denied',
            message: 'Camera permission was denied. Allow camera access in your browser settings to scan products.',
          });
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError({
            type: 'no_camera',
            message: 'No camera was detected on this device.',
          });
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError({
            type: 'in_use',
            message: 'Your camera is currently in use by another app or browser tab.',
          });
        } else {
          setError({
            type: 'unknown',
            message: domErr?.message || 'Unable to start camera feed.',
          });
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [enabled, facingMode, selectedDeviceId, restartToken, stopStream, refreshDevices]);

  const switchCamera = useCallback(() => {
    if (devices.length > 1) {
      const currentIdx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIdx = (currentIdx + 1) % devices.length;
      setSelectedDeviceId(devices[nextIdx].deviceId);
    } else {
      setSelectedDeviceId(null);
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    }
  }, [devices, selectedDeviceId]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  const retry = useCallback(() => {
    setRestartToken((n) => n + 1);
  }, []);

  return {
    videoRef,
    isReady,
    isStarting,
    error,
    facingMode,
    devices,
    selectedDeviceId,
    switchCamera,
    selectDevice,
    retry,
  };
}
