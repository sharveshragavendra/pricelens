import { useEffect, useState } from 'react';
import { isModelLoaded, loadVisionModel } from '../services/visionEngine';

export interface ModelState {
  ready: boolean;
  loading: boolean;
  progress: number;
  stage: string;
  error: string | null;
  retry: () => void;
}

export function useModel(): ModelState {
  const [ready, setReady] = useState<boolean>(isModelLoaded());
  const [loading, setLoading] = useState<boolean>(!isModelLoaded());
  const [progress, setProgress] = useState<number>(isModelLoaded() ? 100 : 10);
  const [stage, setStage] = useState<string>(isModelLoaded() ? 'AI Ready' : 'Loading AI Model...');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    if (isModelLoaded()) {
      setReady(true);
      setLoading(false);
      setProgress(100);
      setStage('AI Ready');
      return;
    }

    setLoading(true);
    setError(null);

    loadVisionModel((pct, text) => {
      if (!active) return;
      setProgress(pct);
      setStage(text);
    })
      .then(() => {
        if (!active) return;
        setReady(true);
        setLoading(false);
        setProgress(100);
        setStage('AI Ready');
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setReady(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load MobileNet vision model. Check your internet connection.'
        );
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  return {
    ready,
    loading,
    progress,
    stage,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
