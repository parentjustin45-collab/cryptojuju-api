/*
 * One-time CryptoJuju historical research import, DEV ONLY.
 * GitHub Actions OIDC (RS256, pinned workflow/branch) is the sole writer.
 * Never exposes database contents, credentials or import blobs over GET.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import pg from 'pg';

const DATASET='CJ-HISTORICAL-DEDUP-V1-20261124';
const AUD='cryptojuju-legacy-import-v1';
const REF_HASH='ab76d0f162c8f836b9d21586e594a457b6b9667b10548be3eccf3f8cdd2a7a3b';
const OBJECT_HASH='d8578e4e2c084d5908e708760426a680bde6655d457832d3f20a248a42d4d889';
const ARTIFACT_IDS=new Set([14553812202,14555524207,14556179411,
  14560354562,14561024011,14580018592,14597356667,14597676036,
  14597870776,14597905685,14707958267,14727729006,14728821271]);
const SHA=/^[0-9a-f]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const decode=x=>JSON.parse(Buffer.from(x,'base64url').toString('utf8'));
let jwksCache=null,jwksFetchedAt=0,dbPool=null;
async function checkOidc(jwt,{fetchImpl=globalThis.fetch,now=Date.now()}={}){
  if(typeof jwt!=='string'||jwt.length>20000)throw Error('AUTH_MISSING');
  const parts=jwt.split('.');
  if(parts.length!==3)throw Error('AUTH_FORMAT');
  const header=decode(parts[0]),claims=decode(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('AUTH_ALGORITHM');
  const t=Math.floor(now/1000);
  if(claims.iss!=='https://token.actions.githubusercontent.com'||
    claims.aud!==AUD||
    claims.sub!=='repo:parentjustin45-collab/Cryptojuju-charts:ref:refs/heads/dev/ai-agents-phase1'||
    claims.repository!=='parentjustin45-collab/Cryptojuju-charts'||
    claims.ref!=='refs/heads/dev/ai-agents-phase1'||
    claims.workflow_ref!=='parentjustin45-collab/Cryptojuju-charts/.github/workflows/cj-legacy-import.yml@refs/heads/dev/ai-agents-phase1'||
    claims.event_name!=='push'||
    !Number.isInteger(claims.exp)||claims.exp<t||
    !Number.isInteger(claims.iat)||claims.iat>t+60||
    (Number.isInteger(claims.nbf)&&claims.nbf>t+60))
    throw Error('AUTH_CLAIMS');
  if(!jwksCache||now-jwksFetchedAt>3600000){
    const response=await fetchImpl('https://token.actions.githubusercontent.com/.well-known/jwks',{
      signal:AbortSignal.timeout(7000),
      headers:{accept:'application/json'}});
    if(!response.ok)throw Error('AUTH_KEY_SOURCE_UNAVAILABLE');
    jwksCache=await response.json();
    jwksFetchedAt=now;
  }
  const jwk=jwksCache.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig');
  if(!jwk)throw Error('AUTH_UNKNOWN_KEY');
  const key=createPublicKey({key:jwk,format:'jwk'});
  if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')))
    throw Error('AUTH_SIGNATURE');
  return claims;
}
function pool(){
  if(!process.env.DATABASE_URL)throw Error('ARCHIVE_DB_NOT_CONFIGURED');
  return dbPool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,
    idleTimeoutMillis:15000,connectionTimeoutMillis:7000});
}
async function schema(db){
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_archive_objects ('+
    'sha256 char(64) PRIMARY KEY, raw_bytes bigint NOT NULL, '+
    'compressed_bytes bigint NOT NULL, encoding text NOT NULL '+
    "DEFAULT 'gzip', content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_legacy_file_refs ('+
    'dataset text NOT NULL, artifact_id bigint NOT NULL, original_path text NOT NULL,'+
    'sha256 char(64) NOT NULL REFERENCES cj_archive_objects(sha256),'+
    'source_run_url text NOT NULL,source_archive text NOT NULL,'+
    'original_expiry_utc timestamptz,created_at timestamptz NOT NULL DEFAULT now(),'+
    'PRIMARY KEY(dataset,artifact_id,original_path))');
  await db.query(
    'CREATE INDEX IF NOT EXISTS cj_legacy_refs_sha_idx ON cj_legacy_file_refs(sha256)');
  await db.query(
    'CREATE TABLE IF NOT EXISTS cj_legacy_import_receipts ('+
    'dataset text PRIMARY KEY, object_count integer NOT NULL,reference_count integer NOT NULL,'+
    'reference_digest char(64) NOT NULL,object_digest char(64) NOT NULL,'+
    'database_bytes bigint NOT NULL,confirmed_at timestamptz NOT NULL DEFAULT now())');
}
function assertObject(x){
  if(!x||!SHA.test(x.sha256)||typeof x.content_b64!=='string'||
    x.content_b64.length>900000)throw Error('OBJECT_FORMAT');
  const raw=Buffer.from(x.content_b64,'base64');
  if(raw.length>1024*1024||sha(raw)!==x.sha256)throw Error('OBJECT_HASH_OR_SIZE');
  return raw;
}
function assertReference(r){
  if(!r||!ARTIFACT_IDS.has(r.github_artifact_id)||
    typeof r.original_path!=='string'||r.original_path.length>350||
    r.original_path.includes('..')||r.original_path.startsWith('/')||
    !SHA.test(r.sha256)||
    typeof r.source_run_url!=='string'||
    !/^https:\/\/github\.com\/parentjustin45-collab\/Cryptojuju-charts\/actions\/runs\/\d+$/.test(r.source_run_url)||
    typeof r.source_archive!=='string'||r.source_archive.length>110)
    throw Error('REFERENCE_FORMAT');
}
async function ingest(payload){
  if(payload.dataset!==DATASET||!Array.isArray(payload.items)||
    payload.items.length<1||payload.items.length>50||
    !['objects','references'].includes(payload.kind))throw Error('IMPORT_BATCH_FORMAT');
  const db=pool();await schema(db);
  const c=await db.connect();
  try{
    await c.query('BEGIN');
    for(const item of payload.items){
      if(payload.kind==='objects'){
        const raw=assertObject(item),compressed=gzipSync(raw,{level:6});
        await c.query(
          "INSERT INTO cj_archive_objects (sha256,raw_bytes,compressed_bytes,encoding,content) "+
          "VALUES ($1,$2,$3,'gzip',$4) ON CONFLICT (sha256) DO NOTHING",
          [item.sha256,raw.length,compressed.length,compressed]);
        const proof=await c.query('SELECT raw_bytes,encoding,content FROM cj_archive_objects WHERE sha256=$1',[item.sha256]);
        if(proof.rowCount!==1||proof.rows[0].encoding!=='gzip'||
          Number(proof.rows[0].raw_bytes)!==raw.length||
          sha(gunzipSync(proof.rows[0].content))!==item.sha256)
          throw Error('OBJECT_DATABASE_READBACK_MISMATCH');
      }else{
        assertReference(item);
        await c.query(
          'INSERT INTO cj_legacy_file_refs(dataset,artifact_id,original_path,sha256,source_run_url,source_archive,original_expiry_utc) '+
          'VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (dataset,artifact_id,original_path) DO NOTHING',
          [DATASET,item.github_artifact_id,item.original_path,item.sha256,
           item.source_run_url,item.source_archive,item.original_github_expiry_utc??null]);
        const proof=await c.query(
          'SELECT trim(sha256) AS sha256 FROM cj_legacy_file_refs WHERE dataset=$1 AND artifact_id=$2 AND original_path=$3',
          [DATASET,item.github_artifact_id,item.original_path]);
        if(proof.rowCount!==1||proof.rows[0].sha256!==item.sha256)
          throw Error('REFERENCE_DATABASE_READBACK_MISMATCH');
      }
    }
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;
  }finally{c.release();}
  return {status:'BATCH_VERIFIED',kind:payload.kind,count:payload.items.length};
}
async function finalize(){
  const db=pool();await schema(db);
  const rows=(await db.query(
    'SELECT artifact_id,original_path,trim(sha256) AS sha256 '+
    'FROM cj_legacy_file_refs WHERE dataset=$1',[DATASET])).rows;
  const refs=rows.map(r=>[String(r.artifact_id),r.original_path,r.sha256].join('\t')).sort();
  const distinct=[...new Set(rows.map(r=>r.sha256))].sort();
  const digest=sha(Buffer.from(refs.join('\n'))),objects=sha(Buffer.from(distinct.join('\n')));
  if(rows.length!==491||distinct.length!==408||digest!==REF_HASH||objects!==OBJECT_HASH)
    throw Error('IMPORT_FINAL_DIGEST_OR_COUNT_MISMATCH');
  for(const part of distinct){
    const record=await db.query(
      'SELECT raw_bytes,encoding,content FROM cj_archive_objects WHERE sha256=$1',[part]);
    if(record.rowCount!==1||record.rows[0].encoding!=='gzip')
      throw Error('IMPORT_OBJECT_MISSING');
    const raw=gunzipSync(record.rows[0].content);
    if(Number(record.rows[0].raw_bytes)!==raw.length||sha(raw)!==part)
      throw Error('IMPORT_OBJECT_CORRUPT');
  }
  const disk=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
  const bytes=Number(disk.rows[0].bytes);
  await db.query('INSERT INTO cj_legacy_import_receipts '+
    '(dataset,object_count,reference_count,reference_digest,object_digest,database_bytes) '+
    'VALUES($1,408,491,$2,$3,$4) ON CONFLICT(dataset) DO UPDATE SET '+
    'object_count=EXCLUDED.object_count,reference_count=EXCLUDED.reference_count,'+
    'reference_digest=EXCLUDED.reference_digest,object_digest=EXCLUDED.object_digest,'+
    'database_bytes=EXCLUDED.database_bytes,confirmed_at=now()',
    [DATASET,REF_HASH,OBJECT_HASH,bytes]);
  console.log('CJ_LEGACY_IMPORT_COMPLETE '+JSON.stringify({dataset:DATASET,objects:408,
    references:491,dbBytes:bytes,verified:'CONTENT_SHA256_AND_MANIFEST'}));
  return {status:'IMPORTED_VERIFIED',objects:408,references:491,databaseBytes:bytes};
}
export function registerLegacyImport(app,express){
  // Reject unauthenticated uploads before buffering their body.
  app.post('/api/internal/legacy-import',async(req,res,next)=>{
    try {
      const authorization=req.get('authorization')??'';
      if(!authorization.startsWith('Bearer '))throw Error('AUTH_MISSING');
      await checkOidc(authorization.slice(7));
      next();
    }catch(e){
      // Diagnostic code only. Never log bearer tokens, OIDC claims or credentials.
      console.error('CJ_LEGACY_AUTH_REJECTED '+String(e?.message??e).slice(0,80));
      return res.status(403).json({error:'NOT_AUTHORIZED'});
    }
  },express.raw({type:'application/octet-stream',limit:'5mb'}),async(req,res)=>{
    res.set('cache-control','no-store');
    try{
      if(!Buffer.isBuffer(req.body))return res.status(400).json({error:'BODY_REQUIRED'});
      const data=JSON.parse(gunzipSync(req.body,{maxOutputLength:7*1024*1024}).toString('utf8'));
      if(data.dataset!==DATASET)return res.status(400).json({error:'DATASET_MISMATCH'});
      const receipt=data.kind==='finalize'?await finalize():await ingest(data);
      res.json(receipt);
    }catch(e){
      const code=String(e?.message??e).slice(0,85);
      console.error('CJ_LEGACY_IMPORT_ERROR '+code);
      res.status(422).json({error:'IMPORT_NOT_ACCEPTED',reason:code});
    }
  });
}
