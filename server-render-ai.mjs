/**
 * Render dev-only entrypoint. Intentionally distinct from stable server.js.
 * Imports the exact pinned CryptoJuju research code prepared at build time.
 * No agents start unless CJ_AGENT_RUNTIME_ENABLED=1 and DATABASE_URL is present.
 */
import { startCombinedServer } from './vendor/cryptojuju-charts/backtest/agents/render/integrated-api.mjs';
await startCombinedServer();
