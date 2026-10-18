import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/* the gateway (server/gateway.js) bridges the browser WebSocket to the IRC
   server TCP connection; in development vite forwards /irc to it */
const gatewayPort = Number(process.env.PIRC_GATEWAY_PORT ?? 8667);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/irc': { target: `ws://localhost:${gatewayPort}`, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
});
