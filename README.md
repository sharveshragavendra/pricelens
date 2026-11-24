# PriceLens — AI Visual Product Recognition & Instant Price Display

PriceLens is a responsive, commercial-grade web application that recognizes physical products through a live mobile or desktop camera feed and instantly displays their stored price.

- **100% Client-Side AI Vision (Zero Per-Scan API Cost):** Runs TensorFlow.js + MobileNet v2 (`alpha: 1.0`) directly in the browser using L2-normalized feature embeddings, cosine similarity, and a 3-frame temporal smoothing buffer.
- **Firebase Backend & Database:** Syncs products, variants, thumbnails, MobileNet embeddings, and settings in real time with Cloud Firestore (`persistentLocalCache` enabled for offline counter operation) and Firebase Auth (Anonymous + Email/Password), with optional Firebase Storage media uploads.
- **Seamless Offline Fallback:** Runs immediately out-of-the-box with local IndexedDB if `.env` is not yet configured.
- **Strict Scope:** Focused purely on instant visual recognition and counter price display (no billing, cart, checkout, payment/UPI, or receipt printing).

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** → Sign-in method → enable **Anonymous** and **Email/Password**.
3. Enable **Cloud Firestore** → Create database.
4. Register a **Web App** in Project Settings and copy your config values.
5. Copy `.env.example` to `.env` and fill in your Firebase keys:
   ```bash
   cp .env.example .env
   ```
6. (Optional) Deploy the included Firestore & Storage security rules:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

> **Note:** If you skip `.env` setup, PriceLens automatically launches in **Local Offline Mode (IndexedDB)** so you can test the scanner right away and connect Firebase later.

### 3. Run Locally
```bash
npm run dev
```
Open the URL shown in your terminal. To test on a mobile phone camera over your local network, serve over HTTPS (or deploy to Firebase Hosting / Vercel) because mobile browsers require a secure context for `getUserMedia`.

### 4. Build for Production
```bash
npm run build
```

---

## Project Structure

```text
pricelens/
├── .env.example                # Firebase environment variables template
├── firebase.json               # Firebase Hosting, Firestore & Storage config
├── firestore.rules             # Per-shop UID Firestore security rules
├── storage.rules               # Per-shop UID Storage security rules
├── src/
│   ├── config/firebase.ts      # Firebase init with Firestore IndexedDB offline cache
│   ├── services/
│   │   ├── visionEngine.ts     # MobileNet v2, L2 embeddings, cosine similarity, 3-frame smoother, lighting check
│   │   ├── imageUtils.ts       # Client-side compression, frame capture, currency formatting
│   │   ├── indexedDbStore.ts   # Local IndexedDB fallback store
│   │   └── repository.ts       # Unified Firebase Firestore/Storage/Auth + fallback layer
│   ├── hooks/
│   │   ├── useCamera.ts        # Rear camera default, front/back + multi-webcam switching
│   │   └── useModel.ts         # MobileNet v2 model loader with progress
│   └── components/
│       ├── Navigation.tsx      # Mobile bottom nav & desktop side rail
│       ├── ScannerView.tsx     # Full-viewport live scanner, viewfinder, price card, Top-3 strip
│       ├── CatalogView.tsx     # Searchable catalog grid & category filters
│       ├── ProductModal.tsx    # Add/Edit product + 1–5 angle onboarding & variants
│       ├── QuickCaptureModal.tsx # In-app camera capture modal with angle prompts
│       └── SettingsView.tsx    # Firebase sync/auth, currency, threshold, scan speed, JSON backup
```
