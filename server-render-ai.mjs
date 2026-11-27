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
// Level 4 remains off by default; explicit deployment flags gate paid evidence-only pilot.
process.env.CJ_LLM_RESEARCH_ENABLED=process.env.CJ_LLM_RESEARCH_ENABLED??'0';
process.env.CJ_LLM_EVIDENCE_EXPORT_APPROVED=process.env.CJ_LLM_EVIDENCE_EXPORT_APPROVED??'0';
process.env.CJ_LLM_DRY_RUN_ENABLED=process.env.CJ_LLM_DRY_RUN_ENABLED??'1';
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

 // Private Render logs only: read the first verified Level 4 report without exposing a public endpoint.
 if(process.env.CJ_LLM_RESEARCH_ENABLED==='1'&&process.env.DATABASE_URL){
   let pool;
   try{
     const {default:pg}=await import('pg');
     const {createHash}=await import('node:crypto');
     const {validateProposal}=await import('./vendor/cryptojuju-charts/backtest/agents/render/llm-research.mjs');
     pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:5000,options:'-c default_transaction_read_only=on'});
     const q=await pool.query("SELECT trim(result_sha256) AS sha,result FROM cj_llm_research_attempts WHERE status='HUMAN_REVIEW_ONLY' AND result_sha256=$1 LIMIT 1",['bc1628f43adcdd0cc745f31b01c067f2e0d025133ccd6c1b430edbd2699ca12c']);
     if(q.rows.length===1){
       const row=q.rows[0];
       if(createHash('sha256').update(row.result).digest('hex')!==row.sha)throw Error('HASH_MISMATCH');
       const r=JSON.parse(row.result);
       if(r.noPromotion!==true||r.noTrading!==true||r.noExecution!==true)throw Error('REPORT_POLICY');
       const proposal=validateProposal(r.proposal);
       console.log('CJ_LLM_FIRST_REVIEW '+JSON.stringify({sha:row.sha,source:r.source,channel:r.channel,proposal,usage:r.usage,estimatedMicroUsd:r.estimatedMicroUsd}));
     }else console.log('CJ_LLM_FIRST_REVIEW_NOT_FOUND');
   }catch{console.error('CJ_LLM_FIRST_REVIEW_BLOCKED');}
   finally{if(pool)try{await pool.end();}catch{/* no secret logging */}}
 }
