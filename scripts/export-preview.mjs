import fs from 'node:fs/promises';import path from 'node:path';
let html=await fs.readFile('dist/index.html','utf8');
const script=html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const stylesheet=html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if(!script||!stylesheet)throw Error('Expected one built JS and CSS bundle');
let js=await fs.readFile(path.join('dist',script[1]),'utf8');
let css=await fs.readFile(path.join('dist',stylesheet[1]),'utf8');
const urls=[...css.matchAll(/url\(([^)]+)\)/g)];
for(const match of urls){const asset=match[1].replace(/^['"]|['"]$/g,'');if(asset.startsWith('data:'))continue;const bytes=await fs.readFile(path.resolve(path.dirname(path.join('dist',stylesheet[1])),asset));const mime=asset.endsWith('.woff2')?'font/woff2':'font/woff';css=css.replace(match[0],`url(data:${mime};base64,${bytes.toString('base64')})`);}
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; font-src data:; img-src data:;">');
html=html.replace(script[0],()=>`<script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script>`).replace(stylesheet[0],()=>`<style>${css}</style>`);
await fs.writeFile('RTL-Atlas-Preview.html',html);
console.log(`Created self-contained RTL-Atlas-Preview.html (${(Buffer.byteLength(html)/1048576).toFixed(1)} MiB)`);
