export type ActiveTab = 'scanner' | 'catalog' | 'settings';

export type ScanSpeedMs = 300 | 500 | 1000;

export type ThemeMode = 'light' | 'dark';

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
}

export interface ProductAngle {
  id: string;
  label: string;
  thumbnail: string; // Compressed JPEG data URL or Firebase Storage download URL
  storagePath?: string;
  embedding: number[]; // L2-normalized MobileNet v2 feature vector
}

export interface Product {
  id: string;
  name: string;
  basePrice: number;
  unit: string;
  category: string;
  variants: ProductVariant[];
  angles: ProductAngle[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  currencySymbol: string;
  confidenceThreshold: number; // 0.60 to 0.95 (default 0.78)
  scanIntervalMs: ScanSpeedMs; // 300 | 500 | 1000
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '₹',
  confidenceThreshold: 0.78,
  scanIntervalMs: 500,
  theme: 'dark',
};

export interface ProductMatch {
  product: Product;
  score: number; // 0..1 cosine similarity
  bestAngleId: string;
}

export interface FrameQualityResult {
  status: 'good' | 'too_dark' | 'hold_steady';
  label: string | null;
  brightness: number;
  motion: number;
}

export interface CatalogBackupPayload {
  app: 'PriceLens';
  version: 1;
  exportedAt: string;
  settings?: Partial<AppSettings>;
  products: Product[];
}

export interface AuthState {
  mode: 'firebase' | 'local';
  ready: boolean;
  uid: string | null;
  email: string | null;
  isAnonymous: boolean;
  error: string | null;
}

export const ANGLE_SUGGESTIONS = [
  'Front',
  'Side',
  'Top',
  'Back',
  'Close-Up',
] as const;

export const UNCERTAIN_MIN_THRESHOLD = 0.60;
