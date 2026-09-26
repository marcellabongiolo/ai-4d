const input = document.querySelector("#csvInput");
const sampleBtn = document.querySelector("#sampleBtn");
const statusEl = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");

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

function analyze(rows) {
  const values = rows.map(r => r.value);
  const recent = values.slice(-Math.min(5, values.length));
  const deltas = recent.slice(1).map((v,i) => v - recent[i]);
  const avgDelta = deltas.reduce((a,b)=>a+b,0) / Math.max(deltas.length,1);
  const prediction = values.at(-1) + avgDelta;
  const volatility = Math.sqrt(deltas.reduce((a,b)=>a+(b-avgDelta)**2,0)/Math.max(deltas.length,1));
  const scale = Math.max(Math.abs(values.at(-1)), 1);
  return { current: values.at(-1), prediction, avgDelta, volatility, trend: Math.abs(avgDelta) < scale*0.01 ? "Estável" : avgDelta > 0 ? "Subindo" : "Caindo" };
}

function drawChart(rows) {
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
}

function render(result, name, rows) {
  dashboard.classList.remove("hidden");
  document.querySelector("#points").textContent=rows.length;
  document.querySelector("#current").textContent=result.current.toFixed(3);
  document.querySelector("#trend").textContent=result.trend;
  document.querySelector("#prediction").textContent=result.prediction.toFixed(3);
  document.querySelector("#signalName").textContent=name;
  document.querySelector("#insight").textContent = result.trend === "Estável"
    ? "O sinal apresenta pouca variação recente."
    : `O sinal está ${result.trend.toLowerCase()}; a mudança média recente é ${result.avgDelta.toFixed(3)} por ponto.`;
  drawChart(rows);
}

function process(text) {
  try {
    const parsed=parseCSV(text), result=analyze(parsed.rows);
    render(result, parsed.name, parsed.rows);
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
  process(await response.text());
});

window.addEventListener("resize",()=>{ if(!dashboard.classList.contains("hidden")) drawChart(window.__rows || []); });