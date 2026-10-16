import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react(),{name:'local-dev-csp',transformIndexHtml(html,ctx){return ctx.server?html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,''):html;}}],build:{emptyOutDir:true},server:{host:'127.0.0.1',port:5173,strictPort:true}});
