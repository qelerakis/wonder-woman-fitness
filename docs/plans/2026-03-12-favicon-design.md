# Favicon Design — "WW" Monogram

**Date**: 2026-03-12
**Status**: Approved

## Visual Design
- White bold "WW" letters centered on `#9333ea` (primary-600) purple rounded-square background
- Clean, legible at 16x16px
- Rounded corners (~20% radius)

## Files
| File | Purpose |
|---|---|
| `app/icon.svg` | Favicon (auto-detected by Next.js App Router) |
| `app/apple-icon.png` | 180x180 Apple Touch Icon (auto-detected) |
| `app/manifest.ts` | Web App Manifest (auto-detected) |
| `public/icon-192.png` | PWA icon 192x192 |
| `public/icon-512.png` | PWA icon 512x512 |

## Integration
- Next.js 15 App Router auto-serves `app/icon.svg` as favicon — no `<link>` tags needed
- `app/apple-icon.png` auto-detected for Apple devices
- `app/manifest.ts` auto-detected for PWA/manifest
- Add `metadataBase` and theme color to `layout.tsx` metadata

## Generation
- SVG created inline (rounded rect + text)
- PNGs generated via Node script using `sharp` or canvas
- Script is one-time, not part of the build
