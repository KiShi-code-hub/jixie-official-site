import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function setPixel(pixels, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = 255;
}

function fillRect(pixels, width, height, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      setPixel(pixels, width, height, px, py, color);
    }
  }
}

function fillCircle(pixels, width, height, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        setPixel(pixels, width, height, x, y, color);
      }
    }
  }
}

function drawTerminalScene(width, height, seed) {
  const pixels = Buffer.alloc(width * height * 4);
  const bg = [22, 27, 23];
  const panel = [14, 18, 15];
  const panelLine = [52, 62, 54];
  const codeColors = [
    [78, 201, 160],
    [232, 122, 93],
    [212, 164, 76],
    [140, 152, 142],
    [106, 166, 214],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gradient = Math.min(255, Math.round(18 + (x / width) * 16 + (y / height) * 10));
      setPixel(pixels, width, height, x, y, [gradient, gradient + 4, gradient]);
    }
  }

  const padX = Math.round(width * 0.07);
  const padY = Math.round(height * 0.08);
  const panelW = width - padX * 2;
  const panelH = height - padY * 2;
  fillRect(pixels, width, height, padX, padY, panelW, panelH, panel);

  const titleH = Math.round(panelH * 0.08);
  fillRect(pixels, width, height, padX, padY, panelW, titleH, [36, 44, 38]);
  fillRect(pixels, width, height, padX, padY + titleH, panelW, 2, panelLine);

  const dotY = padY + Math.round(titleH / 2);
  const dotColors = [
    [232, 122, 93],
    [212, 164, 76],
    [78, 201, 160],
  ];
  dotColors.forEach((color, index) => {
    fillCircle(pixels, width, height, padX + 22 + index * 26, dotY, 7, color);
  });

  const codeX = padX + 30;
  const codeStartY = padY + titleH + Math.round(panelH * 0.12);
  const lineGap = Math.round(panelH * 0.075);
  const barWidths = [0.52, 0.36, 0.68, 0.3, 0.46, 0.24, 0.58, 0.4];
  barWidths.forEach((ratio, index) => {
    const color = codeColors[(index + seed) % codeColors.length];
    const y = codeStartY + index * lineGap;
    const w = Math.round(panelW * ratio);
    fillRect(pixels, width, height, codeX, y, w, Math.max(10, Math.round(lineGap * 0.42)), color);
  });

  const sideW = Math.round(panelW * 0.16);
  const sideX = padX + panelW - sideW - Math.round(panelW * 0.04);
  const sideY = padY + titleH + Math.round(panelH * 0.2);
  const sideH = panelH - titleH - Math.round(panelH * 0.26);
  fillRect(pixels, width, height, sideX, sideY, sideW, sideH, [30, 39, 33]);
  fillRect(pixels, width, height, sideX, sideY, sideW, 3, [78, 201, 160]);

  const cursorW = Math.round(panelW * 0.055);
  fillRect(pixels, width, height, codeX, codeStartY + barWidths.length * lineGap + 8, cursorW, Math.max(10, Math.round(lineGap * 0.42)), [232, 122, 93]);

  return pixels;
}

const scenes = [
  { name: 'hero.png', width: 1600, height: 1200, seed: 0 },
  { name: 'about.png', width: 1280, height: 800, seed: 1 },
  { name: 'activity-1.png', width: 1280, height: 720, seed: 2 },
  { name: 'activity-2.png', width: 1280, height: 720, seed: 3 },
  { name: 'activity-3.png', width: 1280, height: 720, seed: 4 },
];

for (const scene of scenes) {
  const pixels = drawTerminalScene(scene.width, scene.height, scene.seed);
  writeFileSync(join(outDir, scene.name), encodePng(scene.width, scene.height, pixels));
  console.log(`generated public/images/${scene.name}`);
}
