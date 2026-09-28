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
    return { name: signal.name || "signal", ...result };
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

function process(text) {
  try {
    const parsed=parseCSV(text), result=analyze(parsed.rows);
    render(result, parsed.name, parsed.rows);
    const comparison = compareSignals(text);
    window.__comparison = comparison;
    renderSignalSummary(comparison);
    drawMultiChart(comparison);
    renderRelationships(text);
    statusEl.textContent="Análise concluída. Baseline temporal experimental.";
  } catch(error) {
    statusEl.textContent=error.message;
    dashboard.classList.add("hidden");
  }
}

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

window.addEventListener("resize",()=>{ if(!dashboard.classList.contains("hidden")) { drawChart(window.__rows || [], window.__anomalies || []); drawMultiChart(window.__comparison || []); } });

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

