import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
// New HTML must not reuse a cached stylesheet or application from an older release.
// Derive versions from file contents so a second synchronization is a no-op.
const versioned = source.replace(
  /(href|src)="(assets\/fonts\/fonts\.css|assets\/favicon\.svg|styles\.css|config\.js|tracking\.js|orders\.js|app\.js)(?:\?v=[a-f0-9]+)?"/g,
  (_, attribute, asset) => {
    const version = createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', asset))).digest('hex').slice(0, 12);
    return `${attribute}="${asset}?v=${version}"`;
  }
);
const html = versioned
  .replace(/(href|src)="(assets\/[^\"]+|(?:styles\.css|config\.js|tracking\.js|orders\.js|app\.js)(?:\?v=[a-f0-9]+)?)"/g, '$1="dist/$2"')
  .replace('</head>', '<script>window.TFL_ASSET_BASE="dist/";</script>\n</head>');
fs.writeFileSync(path.join(root, 'dist/index.html'), versioned);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('Versioned frontend assets and synchronized root index.html from dist/index.html.');
