import {defineConfig} from '../../node_modules/vite/dist/node/index.js';
export default defineConfig({root:'.',esbuild:{jsx:'automatic'},server:{fs:{allow:['../..']}},build:{outDir:'../../work/ui-build',emptyOutDir:true}});
