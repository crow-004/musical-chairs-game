import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        referrals: 'referrals.html',
        links: 'links.html',
        dashboard: 'dashboard.html',
        farcaster: 'farcaster-frame.html',
        leaderboard: 'leaderboard.html',
      },
    },
  },
});
