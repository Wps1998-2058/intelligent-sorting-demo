const http = require('http');
function getJSON(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async()=>{
  const targets = await getJSON('http://127.0.0.1:9223/json');
  const t = targets.find(x=>x.type==='page' && x.url.includes('3101')) || targets.find(x=>x.type==='page');
  console.log('target:', t.url);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend={};
  const errors=[];
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data);
    if(m.method==='Runtime.exceptionThrown') errors.push('exception: '+(m.params.exceptionDetails.text||''));
    if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error') errors.push('console.error');
    if(m.id && pend[m.id]){pend[m.id](m); delete pend[m.id];} };
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(res=>{const i=++id; pend[i]=res; ws.send(JSON.stringify({id:i,method,params}));});
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:3101/?verify='+Date.now()});
  let ready=false;
  for(let k=0;k<40;k++){
    await new Promise(r=>setTimeout(r,1000));
    const ev = await send('Runtime.evaluate',{expression:`document.getElementById('loading').className`, returnByValue:true});
    const cls = ev.result && ev.result.result && ev.result.result.value;
    if(cls && cls.includes('hidden')){ ready=true; break; }
  }
  console.log('ready:', ready);
  const st0 = await send('Runtime.evaluate',{expression:`document.getElementById('status').textContent + '|' + document.getElementById('total').textContent`, returnByValue:true});
  console.log('before:', st0.result && st0.result.result && st0.result.result.value);
  await send('Runtime.evaluate',{expression:`document.getElementById('runOneBtn').click()`});
  await new Promise(r=>setTimeout(r,2500));
  const st1 = await send('Runtime.evaluate',{expression:`document.getElementById('status').textContent + '|' + document.getElementById('total').textContent`, returnByValue:true});
  console.log('after:', st1.result && st1.result.result && st1.result.result.value);
  console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
  ws.close();
})().catch(e=>{console.error('ERR', e.message); process.exit(1);});
