/**
 * Render dev-only API entrypoint. The legacy server.js is unchanged.
 * No agents start without explicit CJ_AGENT_RUNTIME_ENABLED=1.
 * Optional DB readiness probe is read-only and suppresses all credentials.
 */
import {startCombinedServer,createIntegratedApp} from './vendor/cryptojuju-charts/backtest/agents/render/integrated-api.mjs';
import {registerLegacyImport} from './legacy-import.mjs';
import express from 'express';
import {probeDatabase} from './vendor/cryptojuju-charts/backtest/agents/render/db-readiness.mjs';

// Render PostgreSQL disk independently confirmed at 10 GB on 2026-11-27.
// Decimal GB is deliberately conservative even if provisioned storage is binary.
process.env.CJ_ARCHIVE_DISK_BUDGET_BYTES='10000000000';
console.log('CJ_STORAGE_POLICY '+JSON.stringify({configuredBudgetBytes:10000000000,thresholdBytes:7000000000,logicalOnly:true}));
// Approved 2026-11-27: bounded, research-only tasks; no live trading.
process.env.CJ_OLDER_HISTORY_ENABLED=process.env.CJ_OLDER_HISTORY_ENABLED??'1';
process.env.CJ_AUTONOMOUS_EXPERIMENTS_ENABLED=process.env.CJ_AUTONOMOUS_EXPERIMENTS_ENABLED??'1';
// Approved independent Binance public archive ingestion; no orders.
process.env.CJ_BINANCE_ARCHIVES_ENABLED=process.env.CJ_BINANCE_ARCHIVES_ENABLED??'1';
// Approved bounded evidence-driven follow-up research, no paid model or promotion.
process.env.CJ_ADAPTIVE_RESEARCH_ENABLED=process.env.CJ_ADAPTIVE_RESEARCH_ENABLED??'1';
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
