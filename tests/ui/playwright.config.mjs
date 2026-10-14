import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'*.spec.mjs',workers:1,timeout:30000,
 reporter:[['list'],['json',{outputFile:'../../work/phase315o-browser-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4179',headless:true},
 webServer:{command:'node ../../node_modules/vite/bin/vite.js --config vite.qa.config.mjs --host 127.0.0.1 --port 4179 --strictPort',url:'http://127.0.0.1:4179',reuseExistingServer:false,timeout:30000},
 projects:[{name:'mobile-chromium',use:{browserName:'chromium',viewport:{width:390,height:844}}},{name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1280,height:900}}}]
});
