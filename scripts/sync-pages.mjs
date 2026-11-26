import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharePath = 'ruby-pearl';
const shareUrl = `https://thefragrancelabperfume.shop/${sharePath}/`;
// A fresh, stable collection URL lets social crawlers build a new card while
// the original homepage card remains in third-party caches. Keep both full
// storefronts and their receipt pages generated from the same source.
function shareMetadata(html) {
  return html
    .replace(/(<meta property="og:url" content=")[^"]+(">)/, `$1${shareUrl}$2`)
    .replace(/(<link rel="canonical" href=")[^"]+(">)/, `$1${shareUrl}$2`);
}
// New HTML must not reuse a cached stylesheet or application from an older release.
// Derive versions from file contents so a second synchronization is a no-op.
for (const page of ['index.html', 'cam-on.html']) {
  const source = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
  const versioned = source.replace(
    /(href|src)="(assets\/fonts\/fonts\.css|assets\/favicon\.svg|styles\.css|thank-you\.css|config\.js|tracking\.js|orders\.js|app\.js|receipt\.js|thank-you\.js)(?:\?v=[a-f0-9]+)?"/g,
    (_, attribute, asset) => {
      const version = createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', asset))).digest('hex').slice(0, 12);
      return `${attribute}="${asset}?v=${version}"`;
    }
  );
  const html = versioned
    .replace(/(href|src)="(assets\/[^\"]+|(?:styles\.css|thank-you\.css|config\.js|tracking\.js|orders\.js|app\.js|receipt\.js|thank-you\.js)(?:\?v=[a-f0-9]+)?)"/g, '$1="dist/$2"')
    .replace('</head>', '<script>window.TFL_ASSET_BASE="dist/";</script>\n</head>');
  fs.writeFileSync(path.join(root, 'dist', page), versioned);
  fs.writeFileSync(path.join(root, page), html);
  const previewShare = shareMetadata(versioned)
    .replace(/(href|src)="(assets\/[^\"]+|(?:styles\.css|thank-you\.css|config\.js|tracking\.js|orders\.js|app\.js|receipt\.js|thank-you\.js)(?:\?v=[a-f0-9]+)?)"/g, '$1="../$2"')
    .replace('</head>', '<script>window.TFL_ASSET_BASE="../";</script>\n</head>');
  const publishedShare = shareMetadata(html)
    .replace(/(href|src)="dist\//g, '$1="../dist/')
    .replace('window.TFL_ASSET_BASE="dist/"', 'window.TFL_ASSET_BASE="../dist/"');
  for (const [directory, output] of [
    [path.join(root, 'dist', sharePath), previewShare],
    [path.join(root, sharePath), publishedShare]
  ]) {
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, page), output);
  }
}
console.log('Versioned assets and synchronized storefront, sharing and thank-you pages.');
