# Favicon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "WW" monogram favicon (purple rounded square, white text) to the Wonder Woman Fitness site, covering browser tabs, Apple Touch Icon, and PWA manifest.

**Architecture:** Use Next.js 15 App Router file-based metadata conventions. Place `icon.svg` and `apple-icon.png` in `app/` for auto-detection. Create a web manifest via `app/manifest.ts`. Generate PNG icons with a one-time Node script using `sharp` (already available via Next.js).

**Tech Stack:** SVG, sharp (PNG generation), Next.js App Router metadata conventions

---

### Task 1: Create the SVG favicon

**Files:**
- Create: `app/icon.svg`

**Step 1: Create the SVG file**

The SVG is a 32x32 purple rounded square with white "WW" text:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#9333ea"/>
  <text x="16" y="22" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="14" fill="white">WW</text>
</svg>
```

**Step 2: Verify favicon renders**

Run: `npm run dev`
Open browser, check tab icon shows purple square with "WW".

**Step 3: Commit**

```bash
git add app/icon.svg
git commit -m "feat: add WW monogram SVG favicon"
```

---

### Task 2: Create the PNG generation script and generate icons

**Files:**
- Create: `scripts/generate-icons.mjs` (one-time script, not part of build)
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Create: `app/apple-icon.png`

**Step 1: Create `public/` directory**

```bash
mkdir -p public
```

**Step 2: Create the generation script**

`scripts/generate-icons.mjs`:

```js
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";

function createSvg(size) {
  const rx = Math.round(size * 0.1875);
  const fontSize = Math.round(size * 0.4375);
  const textY = Math.round(size * 0.6875);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#9333ea"/>
  <text x="${size / 2}" y="${textY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">WW</text>
</svg>`;
}

const sizes = [
  { size: 180, path: "app/apple-icon.png" },
  { size: 192, path: "public/icon-192.png" },
  { size: 512, path: "public/icon-512.png" },
];

await mkdir("public", { recursive: true });

for (const { size, path } of sizes) {
  const svg = createSvg(size);
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log(`Generated ${path} (${size}x${size})`);
}
```

**Step 3: Run the script**

```bash
node scripts/generate-icons.mjs
```

Expected output:
```
Generated app/apple-icon.png (180x180)
Generated public/icon-192.png (192x192)
Generated public/icon-512.png (512x512)
```

**Step 4: Verify files exist**

```bash
ls -la app/apple-icon.png public/icon-192.png public/icon-512.png
```

**Step 5: Commit**

```bash
git add scripts/generate-icons.mjs app/apple-icon.png public/icon-192.png public/icon-512.png
git commit -m "feat: generate PNG icons for Apple Touch and PWA"
```

---

### Task 3: Create the web app manifest

**Files:**
- Create: `app/manifest.ts`

**Step 1: Create the manifest file**

`app/manifest.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wonder Woman Fitness",
    short_name: "WW Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#9333ea",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

**Step 2: Commit**

```bash
git add app/manifest.ts
git commit -m "feat: add web app manifest with PWA icons"
```

---

### Task 4: Update layout.tsx metadata

**Files:**
- Modify: `app/layout.tsx:10-18`

**Step 1: Add theme color and manifest to metadata**

Update the `metadata` export in `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Wonder Woman Fitness",
  description: "Studio management platform for Wonder Woman Fitness",
  openGraph: {
    title: "Wonder Woman Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    type: "website",
  },
  other: {
    "theme-color": "#9333ea",
    "msapplication-TileColor": "#9333ea",
  },
};
```

Note: `manifest` and `icons` are auto-detected from the file-based convention, so no need to add them here.

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add theme-color metadata for favicon branding"
```

---

### Task 5: Verify everything works

**Step 1: Run dev server and verify**

```bash
npm run dev
```

Check:
- Browser tab shows purple "WW" favicon
- `/manifest.webmanifest` returns valid JSON with icon URLs
- `/icon.svg` returns the SVG
- `/apple-icon.png` returns the PNG

**Step 2: Run build to ensure no errors**

```bash
npm run build
```

Expected: Build succeeds with no new errors.

**Step 3: Run existing tests to ensure nothing broke**

```bash
npm test
```

Expected: All tests pass.

**Step 4: Final commit if any adjustments were needed**

---

### Task 6: Cleanup

**Step 1: Delete the generation script** (optional — keep for future regeneration)

If keeping: no action needed.
If removing: `rm scripts/generate-icons.mjs`
