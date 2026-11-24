import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerLegacyImport} from '../legacy-import.mjs';

test('protected historical POST rejects unauthenticated requests without touching database',async()=>{
  const app=express();
  registerLegacyImport(app,express);
  const server=await new Promise(resolve=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));
  });
  try{
    const url='http://127.0.0.1:'+server.address().port+'/api/internal/legacy-import';
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/octet-stream'},
      body:Buffer.from('untrusted')});
    assert.equal(r.status,403);
    assert.equal((await r.json()).error,'NOT_AUTHORIZED');
    const r2=await fetch(url,{method:'GET'});
    assert.equal(r2.status,404);
  }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
