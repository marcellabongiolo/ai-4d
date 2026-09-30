const input = document.querySelector("#csvInput");
const sampleBtn = document.querySelector("#sampleBtn");
const statusEl = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");
const apiUrl = document.querySelector("#apiUrl");
const apiBtn = document.querySelector("#apiBtn");

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
  const headers = lines[0].split(",").map(v => v.trim());
  const numeric = headers.slice(1).findIndex((_, i) => lines.slice(1).some(line => Number.isFinite(Number(line.split(",")[i + 1]))));
  if (numeric < 0) throw new Error("Não encontramos uma coluna numérica.");
  const signalIndex = numeric + 1;
  const rows = lines.slice(1).map(line => line.split(",")).map(parts => ({ timestamp: parts[0], value: Number(parts[signalIndex]) })).filter(r => Number.isFinite(r.value));
  if (rows.length < 3) throw new Error("Precisamos de pelo menos 3 valores numéricos.");
  return { name: headers[signalIndex] || "signal", rows };
}

function parseSignals(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e dados.");
  const headers = lines[0].split(",").map(v => v.trim());
  const rows = lines.slice(1).map(line => line.split(","));
  const signals = headers.slice(1).map((name, offset) => ({
    name,
    values: rows.map(parts => Number(parts[offset + 1])).filter(Number.isFinite)
  })).filter(signal => signal.values.length >= 3);
  if (!signals.length) throw new Error("Não encontramos sinais numéricos suficientes.");
  return { headers, signals };
}

function compareSignals(text) {
  const { signals } = parseSignals(text);
  return signals.map(signal => {
    const rows = signal.values.map((value, index) => ({ timestamp: String(index + 1), value }));
    const result = analyze(rows);
    return { name: signal.name || "signal", values: signal.values, ...result };
  });
}

function analyze(rows) {
  const values = rows.map(r => r.value);
  const recent = values.slice(-Math.min(5, values.length));
  const deltas = recent.slice(1).map((v,i) => v - recent[i]);
  const avgDelta = deltas.reduce((a,b)=>a+b,0) / Math.max(deltas.length,1);
  const prediction = values.at(-1) + avgDelta;
  const volatility = Math.sqrt(deltas.reduce((a,b)=>a+(b-avgDelta)**2,0)/Math.max(deltas.length,1));
  const scale = Math.max(Math.abs(values.at(-1)), 1);

  const trend = Math.abs(avgDelta) < scale*0.01 ? "Estável" : avgDelta > 0 ? "Subindo" : "Caindo";
  const recentValues = values.slice(-Math.min(8, values.length));
  const recentDeltas = recentValues.slice(1).map((v,i)=>v-recentValues[i]);
  const directionChanges = recentDeltas.slice(1).filter((d,i)=>Math.sign(d)!==Math.sign(recentDeltas[i]) && Math.abs(d)>1e-9).length;
  const meanAbsDelta = recentDeltas.reduce((a,d)=>a+Math.abs(d),0)/Math.max(recentDeltas.length,1);
  const acceleration = recentDeltas.length >= 2 ? recentDeltas.at(-1)-recentDeltas.at(-2) : 0;
  let behavior = "Estável";
  if (volatility > meanAbsDelta * 0.8 && directionChanges >= 2) behavior = "Oscilatório";
  else if (Math.abs(acceleration) > Math.max(meanAbsDelta * 0.5, 1e-9)) behavior = acceleration > 0 ? "Acelerando" : "Desacelerando";
  else if (trend !== "Estável") behavior = trend;

  const windowSize = Math.min(7, values.length);
  const anomalies = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1).filter(Number.isFinite);
    if (window.length < 4) continue;
    const sorted = [...window].sort((a,b)=>a-b);
    const mid = Math.floor(sorted.length/2);
    const median = sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
    const deviations = sorted.map(v=>Math.abs(v-median)).sort((a,b)=>a-b);
    const madMid = Math.floor(deviations.length/2);
    const mad = deviations.length%2 ? deviations[madMid] : (deviations[madMid-1]+deviations[madMid])/2;
    const robustZ = mad > 1e-9 ? Math.abs(values[i]-median)/(1.4826*mad) : 0;
    if (robustZ >= 3.5) anomalies.push(i);
  }

  const anomalyDetails = anomalies.map(i => {
    const start = Math.max(0, i-windowSize+1);
    const window = values.slice(start, i+1);
    const sorted = [...window].sort((a,b)=>a-b);
    const mid = Math.floor(sorted.length/2);
    const median = sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
    const deviation = values[i]-median;
    const direction = deviation > 0 ? "acima" : "abaixo";
    const relative = Math.abs(deviation)/Math.max(Math.abs(median),1)*100;
    return {index:i,timestamp:rows[i]?.timestamp||String(i+1),value:values[i],median,deviation,direction,relative};
  });

  const latestDetail = anomalyDetails.at(-1) || null;
  return {
    current: values.at(-1), prediction, avgDelta, volatility, trend, behavior,
    anomalyIndexes: anomalies, anomalyDetails, anomalyCount: anomalies.length,
    latestAnomaly: anomalies.includes(values.length-1), latestDetail
  };
}
function drawMultiChart(comparison) {
  const canvas = document.querySelector("#multiChart");
  if (!canvas || !comparison?.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 900, height = 300;
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const pad={l:45,r:20,t:20,b:30}, w=width-pad.l-pad.r, h=height-pad.t-pad.b;
  ctx.font="11px DM Mono, monospace";
  ctx.strokeStyle="rgba(255,255,255,.08)";
  for(let i=0;i<4;i++){const y=pad.t+h*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();}
  comparison.forEach((signal, index) => {
    const values = signal.values || [];
    if (!values.length) return;
    const min=Math.min(...values), max=Math.max(...values);
    ctx.strokeStyle = index % 2 ? "#b4bcff" : "#72e6ff";
    ctx.lineWidth=1.5;
    ctx.beginPath();
    values.forEach((v,i)=>{
      const x=pad.l+w*i/Math.max(values.length-1,1);
      const y=pad.t+h-(v-min)/Math.max(max-min,1e-9)*h;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    ctx.stroke();
    ctx.fillStyle=ctx.strokeStyle;
    ctx.fillText(signal.name, pad.l + 8, pad.t + 15 + index*15);
  });
}

function correlation(a,b) {
  const n = Math.min(a.length,b.length);
  if (n < 3) return 0;
  const aa=a.slice(0,n), bb=b.slice(0,n);
  const meanA=aa.reduce((s,v)=>s+v,0)/n, meanB=bb.reduce((s,v)=>s+v,0)/n;
  let num=0, denA=0, denB=0;
  for(let i=0;i<n;i++){const da=aa[i]-meanA, db=bb[i]-meanB; num+=da*db; denA+=da*da; denB+=db*db;}
  const den=Math.sqrt(denA*denB);
  return den > 1e-12 ? num/den : 0;
}

function parseAlignedSignals(text) {
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2) return [];
  const headers=lines[0].split(",").map(v=>v.trim());
  const rows=lines.slice(1).map(line=>line.split(","));
  return headers.slice(1).map((name,offset)=>({name,values:rows.map(parts=>Number(parts[offset+1]))}));
}

function lagCorrelation(a,b,lag){
  const x=[],y=[];
  if(lag>=0){for(let i=lag;i<a.length;i++){if(Number.isFinite(a[i])&&Number.isFinite(b[i-lag])){x.push(a[i]);y.push(b[i-lag]);}}}
  else {const k=-lag;for(let i=k;i<a.length;i++){if(Number.isFinite(a[i-k])&&Number.isFinite(b[i])){x.push(a[i]);y.push(b[i]);}}}
  return x.length>=3?correlation(x,y):0;
}
function detectLagRelationships(text){
  const signals=parseAlignedSignals(text), pairs=[];
  for(let i=0;i<signals.length;i++) for(let j=i+1;j<signals.length;j++){
    const a=signals[i].values,b=signals[j].values;
    let best={r:-Infinity,lag:0,n:0};
    for(let lag=-3;lag<=3;lag++){
      const r=lagCorrelation(a,b,lag);
      if(Math.abs(r)>Math.abs(best.r)) best={r,lag,n:Math.min(a.length,b.length)-Math.abs(lag)};
    }
    if(Number.isFinite(best.r)&&best.n>=3) pairs.push({a:signals[i].name,b:signals[j].name,...best});
  }
  return pairs;
}
function drawSignalNetwork(text){
  const canvas=document.querySelector("#networkChart"); if(!canvas)return;
  const signals=parseAlignedSignals(text);
  const nodes=signals.filter(s=>s.values.filter(Number.isFinite).length>=3);
  const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,width=canvas.clientWidth||900,height=360;
  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  if(nodes.length<2){ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="12px DM Mono, monospace";ctx.fillText("Adicione pelo menos dois sinais numéricos.",30,50);return;}
  const cx=width/2,cy=height/2,rx=Math.min(width*.36,260),ry=Math.min(height*.31,105);
  const pos=nodes.map((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/nodes.length;return{x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry};});
  const edges=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=[],b=[];
    for(let k=0;k<Math.min(nodes[i].values.length,nodes[j].values.length);k++)if(Number.isFinite(nodes[i].values[k])&&Number.isFinite(nodes[j].values[k])){a.push(nodes[i].values[k]);b.push(nodes[j].values[k]);}
    if(a.length>=3)edges.push({i,j,r:correlation(a,b)});
  }
  edges.forEach(e=>{
    const p=pos[e.i],q=pos[e.j],strength=Math.abs(e.r);
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
    ctx.strokeStyle="rgba(124,140,255,"+(.12+.55*strength)+")";ctx.lineWidth=1+4*strength;ctx.stroke();
  });
  pos.forEach((p,i)=>{
    ctx.beginPath();ctx.arc(p.x,p.y,24,0,Math.PI*2);ctx.fillStyle="rgba(11,15,24,.95)";ctx.fill();ctx.strokeStyle="rgba(180,188,255,.55)";ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle="#eef2ff";ctx.font="11px DM Mono, monospace";ctx.textAlign="center";ctx.fillText(nodes[i].name.slice(0,18),p.x,p.y+4);
  });
}
function renderLagRelationships(text){
  const el=document.querySelector("#lagList"); if(!el)return;
  const pairs=detectLagRelationships(text);
  if(!pairs.length){el.innerHTML='<div class="relation-empty">São necessários pelo menos dois sinais com dados alinhados.</div>';return;}
  el.innerHTML=pairs.map(p=>{
    const relation=p.r>0.1?"positiva":p.r<-0.1?"negativa":"próxima de zero";
    const lag=p.lag===0?"sem atraso":p.lag>0?p.lag+" passo(s) de atraso no segundo sinal":Math.abs(p.lag)+" passo(s) de atraso no primeiro sinal";
    return '<div class="lag-card"><span class="eyebrow">'+p.a+' × '+p.b+'</span><strong>r = '+p.r.toFixed(2)+'</strong><small>Relação '+relation+' · '+lag+' · '+p.n+' pontos</small></div>';
  }).join("");
}

function renderRelationships(text) {
  const el=document.querySelector("#relationshipList");
  if(!el) return;
  const signals=parseAlignedSignals(text);
  const pairs=[];
  for(let i=0;i<signals.length;i++) for(let j=i+1;j<signals.length;j++){
    const a=[],b=[];
    for(let k=0;k<Math.min(signals[i].values.length,signals[j].values.length);k++){
      if(Number.isFinite(signals[i].values[k]) && Number.isFinite(signals[j].values[k])){a.push(signals[i].values[k]);b.push(signals[j].values[k]);}
    }
    if(a.length>=3) pairs.push({a:signals[i].name,b:signals[j].name,r:correlation(a,b),n:a.length});
  }
  if(!pairs.length){el.innerHTML='<div class="relation-empty">Envie pelo menos dois sinais numéricos alinhados para analisar relações.</div>';return;}
  el.innerHTML=pairs.map(p=>{
    const abs=Math.abs(p.r);
    const strength=abs>=.7?"Forte":abs>=.4?"Moderada":"Fraca";
    const direction=p.r>0.1?"positiva":p.r<-0.1?"negativa":"próxima de zero";
    return '<div class="relationship-card"><div><span class="eyebrow">'+p.a+' × '+p.b+'</span><strong>'+p.r.toFixed(2)+'</strong></div><p>Relação '+strength.toLowerCase()+' e '+direction+' · '+p.n+' pontos alinhados</p></div>';
  }).join("");
}

function detectSynchronizedEvents(text) {
  const signals = parseAlignedSignals(text).filter(s => s.values.filter(Number.isFinite).length >= 4);
  if (signals.length < 2) return [];

  const rows = Math.min(...signals.map(s => s.values.length));
  const events = [];
  for (let i = 1; i < rows; i++) {
    const changes = signals.map(s => {
      const prev = s.values[i - 1], curr = s.values[i];
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null;
      const delta = curr - prev;
      const scale = Math.max(Math.abs(prev), 1);
      return { name: s.name, delta, direction: Math.abs(delta) < scale * 0.005 ? "stable" : delta > 0 ? "up" : "down" };
    }).filter(Boolean);

    const moving = changes.filter(c => c.direction !== "stable");
    if (moving.length < 2) continue;

    const up = moving.filter(c => c.direction === "up");
    const down = moving.filter(c => c.direction === "down");
    const group = up.length >= down.length ? up : down;
    const agreement = group.length / moving.length;
    if (group.length >= 2 && agreement >= 0.66) {
      events.push({
        index: i,
        direction: group[0].direction === "up" ? "subida conjunta" : "queda conjunta",
        signals: group.map(c => c.name),
        changed: moving.length,
        agreement
      });
    }
  }

  const compact = [];
  events.forEach(event => {
    const last = compact.at(-1);
    if (last && event.direction === last.direction && event.index <= last.end + 2) {
      last.end = event.index;
      last.indices.push(event.index);
      last.signals = [...new Set([...last.signals, ...event.signals])];
      last.agreement = Math.max(last.agreement, event.agreement);
    } else {
      compact.push({ ...event, end: event.index, indices: [event.index] });
    }
  });
  return compact;
}

function renderSynchronizedEvents(text) {
  const list = document.querySelector("#syncList");
  const summary = document.querySelector("#syncSummary");
  if (!list || !summary) return;

  const events = detectSynchronizedEvents(text);
  summary.innerHTML = `
    <div class="sync-stat"><strong>${events.length}</strong><span>eventos conjuntos</span></div>
    <div class="sync-stat"><strong>${events.filter(e => e.direction === "subida conjunta").length}</strong><span>subidas</span></div>
    <div class="sync-stat"><strong>${events.filter(e => e.direction === "queda conjunta").length}</strong><span>quedas</span></div>
  `;

  if (!events.length) {
    list.innerHTML = '<div class="relation-empty">Nenhum evento conjunto foi identificado nesta janela.</div>';
    return;
  }

  list.innerHTML = events.slice(-12).map((event, index) => `
    <div class="sync-card">
      <div class="sync-marker">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <strong>${event.direction}</strong>
        <span>${event.signals.join(" · ")}</span>
        <small>pontos ${event.index + 1}–${event.end + 1} · concordância máxima ${Math.round(event.agreement * 100)}%</small>
      </div>
    </div>
  `).join("");
}

function buildEventTimeline(text) {
  const signals = parseAlignedSignals(text).filter(s => s.values.filter(Number.isFinite).length >= 4);
  if (!signals.length) return [];

  const rows = Math.min(...signals.map(s => s.values.length));
  const points = [];
  for (let i = 1; i < rows; i++) {
    let moving = 0, up = 0, down = 0, anomaly = false;
    signals.forEach(s => {
      const prev=s.values[i-1], curr=s.values[i];
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) return;
      const delta=curr-prev, scale=Math.max(Math.abs(prev),1);
      if (Math.abs(delta) >= scale*0.005) {
        moving++;
        delta>0 ? up++ : down++;
      }
    });
    if (!moving) continue;
    const majority=Math.max(up,down);
    const syncRatio=majority/moving;
    const sync = moving >= 2 && syncRatio >= .66;
    points.push({index:i, moving, up, down, sync, syncRatio});
  }
  return points;
}

function generateEventInterpretation(text) {
  const signals=parseAlignedSignals(text).filter(s=>s.values.filter(Number.isFinite).length>=4);
  const events=detectSynchronizedEvents(text);
  if(!signals.length) return {headline:"Aguardando dados.",details:[]};

  const details=[];
  events.slice(-5).forEach((event,i)=>{
    const names=event.signals.join(", ");
    const direction=event.direction;
    const span=event.index===event.end ? `no ponto ${event.index+1}` : `entre os pontos ${event.index+1} e ${event.end+1}`;
    details.push(`Evento ${i+1}: ${names} apresentaram ${direction} ${span}, com concordância máxima de ${Math.round(event.agreement*100)}%.`);
  });

  const latest=events.at(-1);
  let headline="Não foram encontrados eventos conjuntos recentes.";
  if(latest) {
    headline=`O evento conjunto mais recente foi uma ${latest.direction} envolvendo ${latest.signals.join(", ")}.`;
  } else if(signals.length>=2) {
    headline="Os sinais disponíveis não apresentaram um evento conjunto forte na janela analisada.";
  }

  return {headline,details};
}

function renderEventInterpretation(text) {
  const headline=document.querySelector("#eventInterpretation");
  const list=document.querySelector("#eventInterpretationList");
  if(!headline || !list) return;
  const result=generateEventInterpretation(text);
  headline.textContent=result.headline;
  list.innerHTML=result.details.length
    ? result.details.map(d=>`<li>${d}</li>`).join("")
    : "<li>Nenhum evento conjunto suficiente para gerar uma interpretação.</li>";
}


function scoreEvent(event, signals) {
  const rows = Math.min(...signals.map(s => s.values.length));
  const i = event.index;
  let magnitudes = [], anomalyHits = 0;
  signals.forEach(s => {
    if (i < 1 || i >= s.values.length) return;
    const prev=s.values[i-1], curr=s.values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) return;
    const delta=Math.abs(curr-prev);
    magnitudes.push(delta/Math.max(Math.abs(prev),1));
  });
  const intensity = Math.min((magnitudes.reduce((a,b)=>a+b,0)/Math.max(magnitudes.length,1))/0.05,1);
  const coverage = Math.min(event.signals.length/Math.max(signals.length,1),1);
  const agreement = event.agreement;
  const score = Math.round(coverage*25 + agreement*35 + intensity*25 + anomalyHits*15);
  const level = score >= 75 ? "Muito relevante" : score >= 50 ? "Relevante" : "Comum";
  return {score,level};
}

function renderEventScores(text) {
  const list=document.querySelector("#eventScoreList");
  const summary=document.querySelector("#eventScoreSummary");
  if(!list || !summary) return;
  const signals=parseAlignedSignals(text).filter(s=>s.values.filter(Number.isFinite).length>=4);
  const events=detectSynchronizedEvents(text);
  if(!signals.length || !events.length){
    summary.innerHTML='<div class="relation-empty">Nenhum evento conjunto suficiente para pontuar.</div>';
    list.innerHTML="";
    return;
  }
  const scored=events.map(event=>({...event,...scoreEvent(event,signals)}));
  const counts={
    "Muito relevante":scored.filter(e=>e.level==="Muito relevante").length,
    "Relevante":scored.filter(e=>e.level==="Relevante").length,
    "Comum":scored.filter(e=>e.level==="Comum").length
  };
  summary.innerHTML=Object.entries(counts).map(([level,count])=>
    `<div class="score-stat"><strong>${count}</strong><span>${level}</span></div>`
  ).join("");
  list.innerHTML=scored.slice(-10).reverse().map(event=>`
    <div class="event-score-card">
      <div><span class="eyebrow">PONTO ${event.index+1}</span><strong>${event.score}/100</strong></div>
      <div><b>${event.level}</b><small>${event.direction} · ${event.signals.join(" · ")} · concordância ${Math.round(event.agreement*100)}%</small></div>
    </div>
  `).join("");
}


function buildEventAlerts(text) {
  const signals=parseAlignedSignals(text).filter(s=>s.values.filter(Number.isFinite).length>=4);
  const events=detectSynchronizedEvents(text);
  return events.map(event=>{
    const scored=scoreEvent(event,signals);
    const severity=scored.score>=75?"alta":scored.score>=50?"média":"baixa";
    const message=severity==="alta"
      ? `Evento de alta relevância no ponto ${event.index+1}: ${event.signals.join(", ")} apresentaram ${event.direction}.`
      : severity==="média"
        ? `Evento relevante no ponto ${event.index+1}: ${event.signals.join(", ")} apresentaram ${event.direction}.`
        : `Mudança conjunta detectada no ponto ${event.index+1}: ${event.signals.join(", ")}.`;
    return {...event,...scored,severity,message};
  });
}

function parseTemporalDataset(text) {\n  const lines = text.trim().split(/\\r?\\n/).filter(Boolean);\n  if (lines.length < 3) return { timestamps: [], signals: [] };\n  const headers = lines[0].split(",").map(v => v.trim());\n  const rows = lines.slice(1).map(line => line.split(","));\n  const timestamps = rows.map(parts => parts[0]);\n  const signals = headers.slice(1).map((name, offset) => ({\n    name,\n    values: rows.map(parts => Number(parts[offset + 1]))\n  })).filter(s => s.values.filter(Number.isFinite).length >= 6);\n  return { timestamps, signals };\n}\n\nfunction summarizeWindow(values) {\n  const rows = values.map((value, i) => ({ timestamp: String(i + 1), value })).filter(r => Number.isFinite(r.value));\n  if (rows.length < 3) return null;\n  const result = analyze(rows);\n  const mean = rows.reduce((sum, r) => sum + r.value, 0) / rows.length;\n  return { ...result, mean };\n}\n\nfunction changeLabel(current, previous, threshold = 0.12) {\n  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "sem comparação";\n  const base = Math.max(Math.abs(previous), 1e-9);\n  const ratio = (current - previous) / base;\n  if (Math.abs(ratio) < threshold) return "sem mudança relevante";\n  return ratio > 0 ? "aumentou" : "diminuiu";\n}\n\nfunction compareHistoricalWindows(text) {\n  const { timestamps, signals } = parseTemporalDataset(text);\n  if (!signals.length) return null;\n  const primary = signals[0];\n  const finite = primary.values.map((value, index) => ({ value, timestamp: timestamps[index] })).filter(r => Number.isFinite(r.value));\n  const midpoint = Math.floor(finite.length / 2);\n  const previousValues = finite.slice(0, midpoint).map(r => r.value);\n  const currentValues = finite.slice(midpoint).map(r => r.value);\n  const previous = summarizeWindow(previousValues);\n  const current = summarizeWindow(currentValues);\n  if (!previous || !current) return null;\n  const anomalyRatePrevious = previous.anomalyCount / Math.max(previousValues.length, 1);\n  const anomalyRateCurrent = current.anomalyCount / Math.max(currentValues.length, 1);\n  const eventSource = detectSynchronizedEvents(text);\n  const splitIndex = Math.max(1, Math.floor(finite.length / 2));\n  const eventPrevious = eventSource.filter(e => e.index <= splitIndex).length;\n  const eventCurrent = eventSource.filter(e => e.index > splitIndex).length;\n  const volatilityChange = changeLabel(current.volatility, previous.volatility);\n  const anomalyChange = changeLabel(anomalyRateCurrent, anomalyRatePrevious);\n  const eventChange = changeLabel(eventCurrent, eventPrevious);\n  const meanChange = changeLabel(current.mean, previous.mean);\n  const headline = `${primary.name}: no período atual, a volatilidade ${volatilityChange} e a taxa de anomalias ${anomalyChange} em relação ao período anterior.`;\n  return {\n    signal: primary.name,\n    previous, current, previousValues, currentValues,\n    previousLabel: timestamps[0] || "início",\n    currentLabel: timestamps[splitIndex] || "segunda metade",\n    anomalyRatePrevious, anomalyRateCurrent,\n    eventPrevious, eventCurrent,\n    volatilityChange, anomalyChange, eventChange, meanChange, headline\n  };\n}\n\nfunction renderHistoricalComparison(text) {\n  const summary = document.querySelector("#historySummary");\n  const list = document.querySelector("#historyList");\n  const headline = document.querySelector("#historyHeadline");\n  if (!summary || !list || !headline) return;\n  const result = compareHistoricalWindows(text);\n  if (!result) {\n    headline.textContent = "Envie uma série com dados suficientes para comparar dois períodos.";\n    summary.innerHTML = "";\n    list.innerHTML = "";\n    return;\n  }\n  headline.textContent = result.headline;\n  const cards = [\n    ["Volatilidade", result.previous.volatility, result.current.volatility, result.volatilityChange],\n    ["Média", result.previous.mean, result.current.mean, result.meanChange],\n    ["Taxa de anomalias", result.anomalyRatePrevious * 100, result.anomalyRateCurrent * 100, result.anomalyChange],\n    ["Eventos conjuntos", result.eventPrevious, result.eventCurrent, result.eventChange]\n  ];\n  summary.innerHTML = cards.map(([label, prev, curr, change]) => `<div class="history-stat"><span>${label}</span><strong>${Number(prev).toFixed(2)} → ${Number(curr).toFixed(2)}</strong><small>${change}</small></div>`).join("");\n  list.innerHTML = `<div class="history-window"><span class="eyebrow">PERÍODO ANTERIOR</span><strong>${result.previousValues.length} pontos</strong><small>${result.previousLabel}</small></div><div class="history-window"><span class="eyebrow">PERÍODO ATUAL</span><strong>${result.currentValues.length} pontos</strong><small>${result.currentLabel}</small></div>`;\n}\n\nfunction renderEventAlerts(text) {
  const list=document.querySelector("#eventAlertList");
  const summary=document.querySelector("#eventAlertSummary");
  if(!list||!summary)return;
  const alerts=buildEventAlerts(text);
  const high=alerts.filter(a=>a.severity==="alta").length;
  const medium=alerts.filter(a=>a.severity==="média").length;
  summary.innerHTML=`
    <div class="alert-stat"><strong>${alerts.length}</strong><span>alertas gerados</span></div>
    <div class="alert-stat"><strong>${high}</strong><span>alta relevância</span></div>
    <div class="alert-stat"><strong>${medium}</strong><span>média relevância</span></div>
  `;
  list.innerHTML=alerts.length
    ? alerts.slice(-8).reverse().map(a=>`
      <div class="event-alert-card ${a.severity}">
        <div class="alert-icon">!</div>
        <div><strong>${a.message}</strong><small>Score ${a.score}/100 · concordância ${Math.round(a.agreement*100)}%</small></div>
      </div>`).join("")
    : '<div class="relation-empty">Nenhum alerta foi gerado para os eventos atuais.</div>';
}

function renderEventTimeline(text) {
  const list=document.querySelector("#eventTimeline");
  const summary=document.querySelector("#eventTimelineSummary");
  if(!list || !summary) return;

  const points=buildEventTimeline(text);
  const sync=points.filter(p=>p.sync);
  const rising=points.filter(p=>p.up>p.down);
  const falling=points.filter(p=>p.down>p.up);

  summary.innerHTML=`
    <div class="timeline-stat"><strong>${points.length}</strong><span>mudanças detectadas</span></div>
    <div class="timeline-stat"><strong>${sync.length}</strong><span>pontos sincronizados</span></div>
    <div class="timeline-stat"><strong>${rising.length}</strong><span>movimentos de alta</span></div>
    <div class="timeline-stat"><strong>${falling.length}</strong><span>movimentos de queda</span></div>
  `;

  if(!points.length){
    list.innerHTML='<div class="relation-empty">Não há mudanças suficientes para construir a linha do tempo.</div>';
    return;
  }

  list.innerHTML=points.slice(-30).map((p,idx)=>{
    const type=p.sync ? "Evento conjunto" : p.up>p.down ? "Movimento de alta" : p.down>p.up ? "Movimento de queda" : "Mudança";
    const detail=p.sync ? `Concordância ${Math.round(p.syncRatio*100)}% · ${p.moving} sinais` : `${p.moving} sinal(is) em movimento`;
    return `<div class="event-timeline-item ${p.sync ? "sync" : ""}">
      <span>${String(idx+1).padStart(2,"0")}</span>
      <div><strong>${type}</strong><small>Ponto ${p.index+1} · ${detail}</small></div>
    </div>`;
  }).join("");
}

function renderSignalSummary(comparison) {
  const el=document.querySelector("#signalSummary");
  if(!el) return;
  el.innerHTML=comparison.map(signal =>
    '<div class="signal-card"><span class="eyebrow">'+signal.name+'</span><strong>'+signal.trend+'</strong><small>'+signal.anomalyCount+' anomalia(s) · '+signal.behavior+'</small></div>'
  ).join("");
}

function drawChart(rows, anomalyIndexes = []) {
  const canvas = document.querySelector("#chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 900, height = 420;
  canvas.width = width*dpr; canvas.height = height*dpr; ctx.scale(dpr,dpr);
  const values = rows.map(r=>r.value), min=Math.min(...values), max=Math.max(...values);
  const pad={l:45,r:20,t:25,b:35}, w=width-pad.l-pad.r, h=height-pad.t-pad.b;
  ctx.clearRect(0,0,width,height);
  ctx.font="12px DM Mono, monospace"; ctx.lineWidth=1; ctx.strokeStyle="rgba(255,255,255,.12)";
  for(let i=0;i<5;i++){const y=pad.t+h*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();}
  ctx.strokeStyle="#72e6ff"; ctx.lineWidth=2;
  ctx.beginPath();
  values.forEach((v,i)=>{const x=pad.l+w*i/(values.length-1);const y=pad.t+h-(v-min)/Math.max(max-min,1e-9)*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.stroke();

  // Mark detected anomalies on the chart.
  ctx.fillStyle = "#ff6b8a";
  anomalyIndexes.forEach(i => {
    const v = values[i];
    const x = pad.l+w*i/(values.length-1);
    const y = pad.t+h-(v-min)/Math.max(max-min,1e-9)*h;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function render(result, name, rows) {
  dashboard.classList.remove("hidden");
  document.querySelector("#points").textContent=rows.length;
  document.querySelector("#current").textContent=result.current.toFixed(3);
  document.querySelector("#trend").textContent=result.trend;
  document.querySelector("#behavior").textContent=result.behavior;
  document.querySelector("#prediction").textContent=result.prediction.toFixed(3);
  document.querySelector("#mae").textContent="—";
  document.querySelector("#rmse").textContent="—";
  document.querySelector("#model").textContent="Baseline";
  document.querySelector("#lags").textContent="—";
  document.querySelector("#anomalies").textContent = result.anomalyCount;
  document.querySelector("#signalName").textContent=name;
  const anomalyText = result.latestAnomaly
    ? " O ponto mais recente foi identificado como uma possível anomalia."
    : result.anomalyCount > 0
      ? ` Foram encontrados ${result.anomalyCount} pontos fora do padrão local.`
      : " Não foram encontrados pontos fora do padrão local.";
  document.querySelector("#insight").textContent = result.trend === "Estável"
    ? "O sinal apresenta pouca variação recente." + anomalyText
    : `O sinal está ${result.trend.toLowerCase()}; a mudança média recente é ${result.avgDelta.toFixed(3)} por ponto.` + anomalyText;
  if (result.anomalyCount > 0) {
    const detail = result.latestDetail;
    const detailText = detail
      ? `O ponto ${detail.index + 1} tem valor ${detail.value.toFixed(3)}, cerca de ${detail.relative.toFixed(1)}% ${detail.direction} da mediana local (${detail.median.toFixed(3)}).`
      : "Existem pontos fora do padrão local.";
    document.querySelector("#anomalyInsight").textContent =
      detailText + " As marcações no gráfico representam possíveis desvios detectados pelo baseline robusto.";
  } else {
    document.querySelector("#anomalyInsight").textContent =
      "Nenhuma anomalia foi detectada pelo baseline robusto nesta série.";
  }
  const anomalyList = document.querySelector("#anomalyList");
  if (anomalyList) {
    if (!result.anomalyCount) {
      anomalyList.innerHTML = '<div class="anomaly-empty">Nenhum evento fora do padrão local.</div>';
    } else {
      anomalyList.innerHTML = result.anomalyDetails.map(detail => {
        const direction = detail.direction === "acima" ? "acima" : "abaixo";
        return '<div class="anomaly-event"><span class="anomaly-dot"></span><div><strong>' +
          detail.timestamp + '</strong><small>Valor ' + detail.value.toFixed(3) +
          ' · ' + detail.relative.toFixed(1) + '% ' + direction +
          ' da mediana local</small></div></div>';
      }).join("");
    }
  }

  window.__rows = rows;
  window.__anomalies = result.anomalyIndexes;

  const timeline = document.querySelector("#anomalyTimeline");
  if (timeline) {
    const steps = timeline.querySelectorAll(".timeline-step");
    steps.forEach(step => step.classList.remove("active"));
    if (result.anomalyCount === 0) {
      steps[0]?.classList.add("active");
    } else {
      steps[0]?.classList.add("active");
      steps[1]?.classList.add("active");
      steps[2]?.classList.add("active");
      steps[3]?.classList.add("active");
    }
  }

  drawChart(rows, result.anomalyIndexes);
}

function loadAnalysisSessions() {
  try { return JSON.parse(localStorage.getItem("ai4d_sessions") || "[]"); }
  catch (_) { return []; }
}

function saveAnalysisSession(text) {
  const parsed = parseCSV(text);
  const result = analyze(parsed.rows);
  const comparison = compareSignals(text);
  const sessions = loadAnalysisSessions();
  const session = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    signal: parsed.name, points: parsed.rows.length, current: result.current,
    prediction: result.prediction, trend: result.trend, behavior: result.behavior,
    anomalies: result.anomalyCount, signals: comparison.map(s => s.name), datasetId: Number(document.querySelector("#datasetSelect")?.value) || null, datasetText: text
  };
  sessions.unshift(session);
  localStorage.setItem("ai4d_sessions", JSON.stringify(sessions.slice(0, 20)));
  renderSavedSessions();
  return session;
}

async function loadProjectsFromApi() {
  const base = getConfiguredApiBase();
  if (!base || !getAuthToken()) return [];
  const response = await fetch(base + "/projects");
  if (!response.ok) throw new Error("Não foi possível carregar os projetos.");
  return response.json();
}

async function loadDatasetsFromApi(projectId) {
  const base = getConfiguredApiBase();
  if (!base || !getAuthToken() || !projectId) return [];
  const response = await fetch(base + "/datasets?project_id=" + encodeURIComponent(projectId));
  if (!response.ok) throw new Error("Não foi possível carregar os datasets.");
  return response.json();
}

async function refreshDatasetUI() {
  const select = document.querySelector("#datasetSelect");
  if (!select) return;
  const projectId = Number(localStorage.getItem("ai4d_project_id")) || null;
  if (!projectId || !getAuthToken()) {
    select.innerHTML = '<option value="">Entre e selecione um projeto</option>';
    return;
  }
  const datasets = await loadDatasetsFromApi(projectId);
  select.innerHTML = datasets.length
    ? '<option value="">Selecione um dataset</option>' + datasets.map(d => '<option value="' + d.id + '">' + d.name.replace(/</g,"&lt;") + ' · ' + d.point_count + ' pontos</option>').join("")
    : '<option value="">Nenhum dataset salvo</option>';
}

async function saveCurrentDataset() {
  const base = getConfiguredApiBase();
  const projectId = Number(localStorage.getItem("ai4d_project_id")) || null;
  const text = window.__rawText || "";
  if (!base || !getAuthToken()) throw new Error("Entre na sua conta antes de salvar um dataset.");
  if (!projectId) throw new Error("Selecione um projeto antes de salvar o dataset.");
  if (!text.trim()) throw new Error("Carregue ou gere uma análise antes de salvar o dataset.");
  const parsed = parseSignals(text);
  const name = window.prompt("Nome do dataset:", "Dataset " + new Date().toLocaleString("pt-BR"));
  if (!name?.trim()) return;
  const response = await fetch(base + "/datasets", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({project_id:projectId,name:name.trim(),content:text,signal_count:parsed.signals.length,point_count:parsed.signals[0]?.values?.length || 0})
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.detail || "Não foi possível salvar o dataset.");
  await refreshDatasetUI();
  document.querySelector("#datasetSelect").value = String(data.id);
  statusEl.textContent = "Dataset salvo no projeto.";
}

async function openDatasetFromApi(datasetId) {
  const base = getConfiguredApiBase();
  if (!base || !getAuthToken() || !datasetId) return;
  const response = await fetch(base + "/datasets/" + encodeURIComponent(datasetId));
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.detail || "Não foi possível abrir o dataset.");
  process(data.content, {saveSession:false});
  statusEl.textContent = "Dataset carregado do projeto.";
}


async function createProjectFromUI() {
  const base = getConfiguredApiBase();
  if (!base || !getAuthToken()) throw new Error("Entre na sua conta antes de criar um projeto.");
  const name = window.prompt("Nome do novo projeto:");
  if (!name?.trim()) return;
  const response = await fetch(base + "/projects", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim()})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.detail || "Não foi possível criar o projeto.");
  localStorage.setItem("ai4d_project_id", String(data.id));
  await refreshProjectUI();
}

async function refreshProjectUI() {
  const select = document.querySelector("#projectSelect");
  if (!select || !getAuthToken()) return;
  const projects = await loadProjectsFromApi();
  select.innerHTML = projects.length ? projects.map(p => '<option value="'+p.id+'">'+p.name.replace(/</g,"&lt;")+'</option>').join("") : '<option value="">Nenhum projeto</option>';
  const saved = localStorage.getItem("ai4d_project_id");
  if (saved && projects.some(p => String(p.id) === saved)) select.value = saved;
  else if (projects[0]) { select.value = String(projects[0].id); localStorage.setItem("ai4d_project_id", String(projects[0].id)); }
  await refreshDatasetUI();
}

function getConfiguredApiBase() {
  return (apiUrl?.value || "").trim().replace(/\/$/, "");
}

async function syncLatestSessionToApi() {
  const sessions = loadAnalysisSessions();
  const session = sessions[0];
  const base = getConfiguredApiBase();
  if (!session || !base) return false;
  const projectId = Number(localStorage.getItem("ai4d_project_id")) || null;
  const response = await fetch(base + "/sessions", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      project_id: projectId,
      signal: session.signal,
      points: session.points,
      current_value: session.current,
      prediction: session.prediction,
      trend: session.trend,
      behavior: session.behavior,
      anomalies: session.anomalies,
      signals: session.signals,
      dataset_id: session.datasetId || null,
      dataset_text: session.datasetText || ""
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "A API não aceitou a análise.");
  }
  return true;
}

async function loadSessionsFromApi() {
  const base = getConfiguredApiBase();
  if (!base) return false;
  const projectId = Number(localStorage.getItem("ai4d_project_id")) || null;
  const response = await fetch(base + (projectId ? "/sessions?project_id=" + projectId : "/sessions"));
  if (!response.ok) throw new Error("Não foi possível carregar o histórico da API.");
  const remote = await response.json();
  const sessions = remote.map(item => ({
    id: "api-" + item.id,
    createdAt: item.created_at,
    signal: item.signal,
    points: item.points,
    current: item.current_value,
    prediction: item.prediction,
    trend: item.trend,
    behavior: item.behavior,
    anomalies: item.anomalies,
    signals: item.signals || [],
    datasetId: item.dataset_id || null,
    datasetText: item.dataset_text || ""
  }));
  localStorage.setItem("ai4d_sessions", JSON.stringify(sessions.slice(0, 20)));
  renderSavedSessions();
  return true;
}

function addSessionSyncControls() {
  const summary = document.querySelector("#savedSessionSummary");
  if (!summary || document.querySelector("#syncSessionsBtn")) return;
  const button = document.createElement("button");
  button.id = "syncSessionsBtn";
  button.className = "button ghost";
  button.type = "button";
  button.textContent = "Sincronizar com API";
  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      button.textContent = "Sincronizando…";
      await syncLatestSessionToApi();
      await loadSessionsFromApi();
      button.textContent = "Sincronizado";
    } catch (error) {
      button.textContent = "Sincronizar com API";
      statusEl.textContent = "Sincronização: " + error.message;
    } finally {
      button.disabled = false;
    }
  });
  summary.appendChild(button);
}

async function reopenSession(sessionId) {
  const local = loadAnalysisSessions().find(session => String(session.id) === String(sessionId));
  if (local?.datasetText) { process(local.datasetText, {saveSession:false}); statusEl.textContent = "Análise reaberta do histórico local."; return; }
  const base = getConfiguredApiBase();
  const numericId = String(sessionId).replace(/^api-/, "");
  if (!base || !getAuthToken() || !numericId) { statusEl.textContent = "Não foi possível reabrir esta análise."; return; }
  const response = await fetch(base + "/sessions/" + encodeURIComponent(numericId));
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.dataset_text) { statusEl.textContent = data.detail || "Esta análise não possui os dados necessários para reabertura."; return; }
  process(data.dataset_text, {saveSession:false});
  statusEl.textContent = "Análise reaberta da API.";
}

function bindReopenButtons() {
  document.querySelectorAll(".reopen-session").forEach(button => {
    button.addEventListener("click", () => reopenSession(button.dataset.sessionId).catch(error => { statusEl.textContent = "Não foi possível reabrir: " + error.message; }));
  });
}
function renderSavedSessions() {
  const list = document.querySelector("#savedSessionList");
  const summary = document.querySelector("#savedSessionSummary");
  if (!list || !summary) return;
  const sessions = loadAnalysisSessions();
  summary.innerHTML = "<div class=\"session-stat\"><strong>" + sessions.length + "</strong><span>análises salvas</span></div><div class=\"session-stat\"><strong>" + (sessions[0]?.signals?.length || 0) + "</strong><span>sinais na última</span></div><button id=\"clearSessionsBtn\" class=\"button ghost\" type=\"button\">Limpar histórico</button>";
  addSessionSyncControls();
  const clear = document.querySelector("#clearSessionsBtn");
  clear?.addEventListener("click", () => { localStorage.removeItem("ai4d_sessions"); renderSavedSessions(); }, { once: true });
  if (!sessions.length) { list.innerHTML = '<div class="relation-empty">Nenhuma análise salva neste navegador.</div>'; return; }
  list.innerHTML = sessions.map((session, index) => {
    const date = new Date(session.createdAt).toLocaleString("pt-BR");
    return '<div class="session-card"><div><span class="eyebrow">ANÁLISE ' + String(index + 1).padStart(2, "0") + '</span><strong>' + session.signal + '</strong><small>' + date + " · " + session.points + " pontos · " + session.signals.length + ' sinal(is)</small></div><div class="session-metrics"><b>' + session.trend + '</b><span>' + session.anomalies + " anomalia(s) · previsão " + Number(session.prediction).toFixed(2) + '</span></div><button class="button ghost reopen-session" data-session-id="' + session.id + '">Reabrir análise</button></div>';
  }).join("");
  bindReopenButtons();
}

function renderSessionPanel(text) {
  try { saveAnalysisSession(text); }
  catch (_) { renderSavedSessions(); }
}
function process(text, options = {}) {
  try {
    window.__rawText=text;
    const parsed=parseCSV(text), result=analyze(parsed.rows);
    render(result, parsed.name, parsed.rows);
    const comparison = compareSignals(text);
    window.__comparison = comparison;
    renderSignalSummary(comparison);
    drawMultiChart(comparison);
    renderRelationships(text);
    renderLagRelationships(text);
    drawSignalNetwork(text);
    renderSynchronizedEvents(text);
    renderEventTimeline(text);
    renderEventInterpretation(text);
    renderEventScores(text);
    renderEventAlerts(text);
    renderHistoricalComparison(text);
    if (options.saveSession !== false) renderSessionPanel(text);
    statusEl.textContent="Análise concluída. Baseline temporal experimental.";
  } catch(error) {
    statusEl.textContent=error.message;
    dashboard.classList.add("hidden");
  }
}

renderSavedSessions();
document.addEventListener("DOMContentLoaded",()=>{
  const select=document.querySelector("#projectSelect");
  const create=document.querySelector("#newProjectBtn");
  select?.addEventListener("change",()=>{localStorage.setItem("ai4d_project_id",select.value); loadSessionsFromApi().catch(()=>{}); refreshDatasetUI().catch(()=>{});});
  create?.addEventListener("click",()=>createProjectFromUI().catch(e=>statusEl.textContent=e.message));
  document.querySelector("#saveDatasetBtn")?.addEventListener("click",()=>saveCurrentDataset().catch(e=>statusEl.textContent=e.message));
  document.querySelector("#datasetSelect")?.addEventListener("change",()=>openDatasetFromApi(document.querySelector("#datasetSelect").value).catch(e=>statusEl.textContent=e.message));
  window.addEventListener("ai4d-auth-changed",()=>refreshProjectUI().catch(()=>{}));
  refreshProjectUI().catch(()=>{});
});

input.addEventListener("change", async e => {
  const file=e.target.files?.[0]; if(!file) return;
  process(await file.text());
});

sampleBtn.addEventListener("click", async () => {
  const response=await fetch("../data/sample_timeseries.csv");
  const text = await response.text();
  process(text);
  try {
    const comparison = compareSignals(text);
    const best = comparison.slice().sort((a,b) => b.anomalyCount - a.anomalyCount)[0];
    if (comparison.length > 1) statusEl.textContent += ` ${comparison.length} sinais detectados: ${comparison.map(s => s.name).join(", ")}.`;
  } catch (_) {}
});

window.addEventListener("resize",()=>{ if(!dashboard.classList.contains("hidden")) { drawChart(window.__rows || [], window.__anomalies || []); drawMultiChart(window.__comparison || []); if(window.__rawText) drawSignalNetwork(window.__rawText); } });

apiBtn.addEventListener("click", async () => {
  const file = input.files?.[0];
  const base = apiUrl.value.trim().replace(/\\/$/, "");
  if (!file) { statusEl.textContent = "Carregue um CSV primeiro."; return; }
  if (!base) { statusEl.textContent = "Informe a URL da API, por exemplo http://localhost:8000."; return; }
  try {
    const body = new FormData(); body.append("file", file);
    statusEl.textContent = "Enviando dados para o modelo ML…";
    const response = await fetch(base + "/predict", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "A API retornou um erro.");
    document.querySelector("#mae").textContent = Number(result.mae).toFixed(3);
    document.querySelector("#rmse").textContent = Number(result.rmse).toFixed(3);
    document.querySelector("#model").textContent = result.model === "linear-regression-lag" ? "Linear Lag" : "Persistence";
    document.querySelector("#lags").textContent = result.lags ?? "—";
    document.querySelector("#prediction").textContent = Number(result.next_prediction).toFixed(3);
    document.querySelector("#signalName").textContent = result.signal;
    statusEl.textContent = "Modelo ML executado pela API. MAE e RMSE vêm do conjunto de teste."; 
  } catch (error) {
    statusEl.textContent = "Não foi possível conectar à API: " + error.message;
  }
});

