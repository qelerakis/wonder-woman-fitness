import sharp from "sharp";
import { mkdir } from "fs/promises";

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

await mkdir("app", { recursive: true });
await mkdir("public", { recursive: true });

for (const { size, path } of sizes) {
  const svg = createSvg(size);
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log(`Generated ${path} (${size}x${size})`);
}
