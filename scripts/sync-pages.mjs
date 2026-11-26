import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const html = source
  .replace(/(href|src)="(assets\/[^\"]+|styles\.css|config\.js|tracking\.js|orders\.js|app\.js)"/g, '$1="dist/$2"')
  .replace('</head>', '<script>window.TFL_ASSET_BASE="dist/";</script>\n</head>');
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('Synchronized root index.html from dist/index.html.');
