import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'integrated/*.spec.mjs',globalTeardown:'./integrated-teardown.mjs',workers:1,timeout:60000,
 reporter:[['list'],['json',{outputFile:'../../work/final-integrated-browser-results.json'}]],
 use:{baseURL:'https://localhost:4178',headless:true,ignoreHTTPSErrors:true},
 webServer:{command:'node integrated-server.mjs',url:'https://localhost:4178/__fixture/ready',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:60000,env:{GS_FICTIONAL_BROWSER_TEST:'1'}},
 projects:[{name:'mobile-integrated',use:{browserName:'chromium',viewport:{width:390,height:844}}},{name:'desktop-integrated',use:{browserName:'chromium',viewport:{width:1280,height:900}}}]
});
