/**
 * Render dev-only API entrypoint. The legacy server.js is unchanged.
 * No agents start without explicit CJ_AGENT_RUNTIME_ENABLED=1.
 * Optional DB readiness probe is read-only and suppresses all credentials.
 */
import {startCombinedServer,createIntegratedApp} from './vendor/cryptojuju-charts/backtest/agents/render/integrated-api.mjs';
import {registerLegacyImport} from './legacy-import.mjs';
import express from 'express';
import {probeDatabase} from './vendor/cryptojuju-charts/backtest/agents/render/db-readiness.mjs';

import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.env.CJ_AGENT_RUNTIME_ENABLED==='1' && process.env.DATABASE_URL){
 const path=fileURLToPath(new URL('./vendor/cryptojuju-charts/backtest/agents/render/hourly-bitunix-failure-audit.mjs',import.meta.url));
 await new Promise(resolve=>{
  const child=spawn(process.execPath,['--max-old-space-size=128',path],{stdio:['ignore','inherit','inherit']});
  const timer=setTimeout(()=>child.kill('SIGKILL'),60000);
  child.once('error',()=>{clearTimeout(timer);console.error('CJ_HOURLY_FAILURE_AUDIT_SPAWN_FAILED');resolve()});
  child.once('close',(code,signal)=>{clearTimeout(timer);console.log('CJ_HOURLY_FAILURE_AUDIT_EXIT '+JSON.stringify({code,signal}));resolve()});
 });
}
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
