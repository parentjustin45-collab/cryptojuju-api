/**
 * Render dev-only API entrypoint. The legacy server.js is unchanged.
 * No agents start without explicit CJ_AGENT_RUNTIME_ENABLED=1.
 * Optional DB readiness probe is read-only and suppresses all credentials.
 */
import {startCombinedServer,createIntegratedApp} from './vendor/cryptojuju-charts/backtest/agents/render/integrated-api.mjs';
import {registerLegacyImport} from './legacy-import.mjs';
import express from 'express';
import {probeDatabase} from './vendor/cryptojuju-charts/backtest/agents/render/db-readiness.mjs';

await startCombinedServer({createApp:async()=>{
  const combined=await createIntegratedApp();
  // Historical migration completed on 2026-11-24. Closed by default.
  // Reopening requires an explicit environment flag and a redeploy.
  if(process.env.CJ_LEGACY_IMPORT_ENABLED==='1')
    registerLegacyImport(combined.app,express);
  return combined;
}});
if(process.env.CJ_AGENT_DB_PREFLIGHT==='1'){
  const result=await probeDatabase();
  console.log('CJ_DB_PREFLIGHT '+JSON.stringify(result));
  // Leave the public API available even when a database is misconfigured.
  if(result.status!=='READY_FOR_SCHEMA_INITIALIZATION')
    console.error('CJ_DB_PREFLIGHT_BLOCKED '+result.code);
}
