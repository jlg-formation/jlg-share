import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',fullyParallel:false,workers:1,timeout:30_000,
 use:{baseURL:'http://127.0.0.1:4173',channel:process.env.CI?undefined:'msedge',timezoneId:'Europe/Paris',screenshot:'only-on-failure'},
 webServer:{command:'bun scripts/e2e-server.ts',url:'http://127.0.0.1:4173/api/health',reuseExistingServer:false},
});
