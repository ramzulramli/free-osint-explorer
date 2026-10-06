const API_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept"
};

const APIMS_CURRENT = "https://apims.doe.gov.my/data/public_v2/CAQM/last24hours.json";
const APIMS_HISTORICAL = "https://apims.doe.gov.my/data/public_v2/CAQM/hours24";

const KLANG_VALLEY_STATIONS = [
  "Batu Muda",
  "Cheras",
  "Petaling Jaya",
  "Shah Alam",
  "Klang",
  "Kuala Lumpur",
  "Putrajaya"
];

function cleanNumber(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseApiTable(payload) {
  const matrix = payload?.["24hour_api_apims"] || payload?.["24hour_api"];
  if (!Array.isArray(matrix) || matrix.length < 2) return [];

  const headers = matrix[0].map(String);
  return matrix.slice(1).map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function timeToMinutes(label) {
  const match = String(label || "").match(/^(\d{1,2}):00(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const ampm = match[2].toUpperCase();
  if (ampm === "AM" && hour === 12) hour = 0;
  if (ampm === "PM" && hour !== 12) hour += 12;
  return hour * 60;
}

function localDateTime(dateString, timeLabel) {
  const minutes = timeToMinutes(timeLabel);
  if (minutes === null) return null;
  const [year, month, day] = dateString.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMinutes(minutes);
  return date.toISOString();
}

function stationMatches(location) {
  const name = String(location || "").trim().toLowerCase();
  return KLANG_VALLEY_STATIONS.some(station => name === station.toLowerCase());
}

function normalizeRows(rows, sourceDate) {
  const output = [];
  for (const row of rows) {
    const location = String(row.Location || "").trim();
    if (!stationMatches(location)) continue;

    for (const [key, raw] of Object.entries(row)) {
      if (!/^\d{1,2}:00(?:AM|PM)$/i.test(key)) continue;
      const api = cleanNumber(raw);
      if (api === null) continue;
      output.push({
        date: sourceDate,
        time: key,
        timestamp: localDateTime(sourceDate, key),
        state: String(row.State || "").trim(),
        location,
        api
      });
    }
  }
  return output;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "SSOAA-AirQuality/1.0"
    }
  });
  if (!response.ok) throw new Error(`APIMS HTTP ${response.status}`);
  return response.json();
}

function datePath(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

async function loadAirQuality() {
  const now = new Date();
  const requests = [getJson(APIMS_CURRENT)];

  // Current 24-hour feed + seven previous calendar days.
  for (let offset = 1; offset <= 7; offset++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    requests.push(getJson(`${APIMS_HISTORICAL}/${datePath(date)}/0000.json`));
  }

  const results = await Promise.allSettled(requests);
  const rows = [];

  // The current feed is already labelled by its own time columns.
  if (results[0].status === "fulfilled") {
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    rows.push(...normalizeRows(parseApiTable(results[0].value), currentDate));
  }

  for (let i = 1; i < results.length; i++) {
    if (results[i].status !== "fulfilled") continue;
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    rows.push(...normalizeRows(
      parseApiTable(results[i].value),
      datePath(date)
    ));
  }

  rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const stationNames = [...new Set(rows.map(row => row.location))].sort();

  return {
    status: "success",
    source: "Jabatan Alam Sekitar (DOE) / APIMS",
    fetchedAt: new Date().toISOString(),
    stations: stationNames,
    records: rows,
    historyDays: 7,
    note: "Current APIMS feed plus seven previous calendar days. Historical files may occasionally be unavailable."
  };
}

function pageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Klang Valley Air Quality | SSOAA</title>
<style>
:root{color-scheme:dark;--bg:#070b12;--panel:#101927;--line:#26364c;--text:#edf4ff;--muted:#8fa1b8;--blue:#3b82f6;--green:#22c55e;--yellow:#eab308;--orange:#f97316;--red:#ef4444}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -15%,#17253b 0,#070b12 48%);font:14px system-ui,-apple-system,Segoe UI,sans-serif;color:var(--text)}
.wrap{max-width:1250px;margin:auto;padding:28px 20px 60px}.top{display:flex;justify-content:space-between;align-items:center;gap:15px}.brand{font-size:19px;font-weight:800}.sub{font-size:12px;color:var(--muted);margin-top:3px}.updated{font-size:11px;color:var(--muted);text-align:right}
.hero{padding:38px 0 22px}.hero h1{margin:0 0 8px;font-size:34px;letter-spacing:-1px}.hero p{margin:0;color:var(--muted);max-width:800px;line-height:1.6}
.controls{display:flex;gap:10px;align-items:center;margin:18px 0;flex-wrap:wrap}.select{background:#0d1726;border:1px solid #304159;color:var(--text);padding:10px 12px;border-radius:9px}
.legend{display:flex;gap:7px;flex-wrap:wrap}.legend span{padding:6px 9px;border-radius:999px;font-size:11px;font-weight:700}.good{background:var(--blue)}.moderate{background:var(--green)}.unhealthy{background:var(--yellow);color:#211700}.very{background:var(--orange)}.hazardous{background:var(--red)}
.panel{background:linear-gradient(180deg,#101a29,#0b1421);border:1px solid var(--line);border-radius:15px;padding:18px;margin-top:16px;overflow:auto}.panel h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 15px;color:#b8c6d8}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.station{border:1px solid #2a3a51;border-radius:12px;padding:13px;background:#0b1421}.station-name{font-weight:750;margin-bottom:8px}.value{font-size:32px;font-weight:850;line-height:1}.status{font-size:11px;margin-top:7px;font-weight:750}.stamp{font-size:10px;color:var(--muted);margin-top:7px}
.heatmap{width:100%;border-collapse:separate;border-spacing:3px;min-width:780px}.heatmap th{font-size:10px;color:var(--muted);font-weight:600;padding:3px}.heatmap td{height:32px;text-align:center;border-radius:5px;font-size:10px;font-weight:750;min-width:48px}.station-cell{text-align:left!important;background:#0b1421!important;color:#c7d3e3!important;position:sticky;left:0}
.hourly{width:100%;border-collapse:collapse;min-width:760px}.hourly th,.hourly td{padding:8px;border-bottom:1px solid #1d2a3d;text-align:right;font-size:12px}.hourly th:first-child,.hourly td:first-child{text-align:left}.hourly th{color:var(--muted);font-weight:600}.api-cell{font-weight:800;border-radius:5px}
.note{color:var(--muted);font-size:11px;line-height:1.5;margin-top:12px}.error{border-color:#713242;color:#fecdd3}.loading{text-align:center;color:var(--muted);padding:35px}
@media(max-width:700px){.wrap{padding:20px 12px 45px}.top{align-items:flex-start}.updated{display:none}.hero h1{font-size:28px}.panel{padding:13px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><div><div class="brand">SSOAA · Air Quality</div><div class="sub">Klang Valley Air Pollutant Index (API)</div></div><div class="updated" id="updated">Loading…</div></header>
<section class="hero"><h1>Klang Valley air quality</h1><p>Official Malaysian API readings from the Department of Environment's Air Pollutant Index Management System (APIMS). Current readings are shown first, followed by a seven-day historical view.</p></section>
<div class="controls">
<select id="station" class="select"><option value="ALL">All stations</option></select>
<div class="legend"><span class="good">0–50 Good</span><span class="moderate">51–100 Moderate</span><span class="unhealthy">101–200 Unhealthy</span><span class="very">201–300 Very Unhealthy</span><span class="hazardous">&gt;300 Hazardous</span></div>
</div>
<section id="app"><div class="loading">Loading official APIMS data…</div></section>
<div class="note">Source: Jabatan Alam Sekitar (DOE), APIMS. API categories follow the official Malaysian bands. Historical availability depends on APIMS archive files.</div>
</div>
<script>
const state={records:[],station:'ALL'};
const esc=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
function band(v){v=Number(v);if(v<=50)return['Good','good'];if(v<=100)return['Moderate','moderate'];if(v<=200)return['Unhealthy','unhealthy'];if(v<=300)return['Very Unhealthy','very'];return['Hazardous','hazardous']}
function bg(v){return getComputedStyle(document.documentElement).getPropertyValue('--'+band(v)[1]).trim()}
function latestByStation(records){const m=new Map();for(const r of records){const old=m.get(r.location);if(!old||r.timestamp>old.timestamp)m.set(r.location,r)}return [...m.values()].sort((a,b)=>a.location.localeCompare(b.location))}
function render(){
 const selected=state.station;
 const records=selected==='ALL'?state.records:state.records.filter(r=>r.location===selected);
 const latest=latestByStation(records);
 const dates=[...new Set(records.map(r=>r.date))].sort().slice(-8);
 let html='<section class="panel"><h2>Current / latest reading</h2><div class="cards">';
 for(const r of latest){const b=band(r.api);html+='<div class="station"><div class="station-name">'+esc(r.location)+'</div><div class="value">'+r.api+'</div><div class="status '+b[1]+'">'+b[0]+'</div><div class="stamp">'+esc(r.time)+' · '+esc(r.date)+'</div></div>'}
 html+='</div></section>';
 html+='<section class="panel"><h2>7-day history · daily maximum API</h2><table class="heatmap"><thead><tr><th>Station</th>'+dates.map(d=>'<th>'+esc(d.slice(5).replaceAll('/','-'))+'</th>').join('')+'</tr></thead><tbody>';
 const stations=selected==='ALL'?[...new Set(records.map(r=>r.location))].sort():[selected];
 for(const s of stations){html+='<tr><td class="station-cell">'+esc(s)+'</td>';for(const d of dates){const vals=records.filter(r=>r.location===s&&r.date===d).map(r=>r.api);const v=vals.length?Math.max(...vals):null;html+=v===null?'<td>—</td>':'<td style="background:'+bg(v)+'">'+v+'</td>'}html+='</tr>'}
 html+='</tbody></table></section>';
 const hourly=records.slice(-24*4).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
 html+='<section class="panel"><h2>Recent hourly readings</h2><table class="hourly"><thead><tr><th>Station</th><th>Date</th><th>Time</th><th>API</th><th>Status</th></tr></thead><tbody>';
 for(const r of hourly.slice(0,120)){const b=band(r.api);html+='<tr><td>'+esc(r.location)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.time)+'</td><td class="api-cell" style="background:'+bg(r.api)+'">'+r.api+'</td><td>'+b[0]+'</td></tr>'}
 html+='</tbody></table></section>';
 document.getElementById('app').innerHTML=html;
}
async function load(){try{const r=await fetch('/api/air-quality');const data=await r.json();if(!r.ok||data.status!=='success')throw new Error(data.message||'Unable to load APIMS');state.records=data.records||[];const sel=document.getElementById('station');for(const s of data.stations||[]){const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o)}document.getElementById('updated').textContent='Fetched '+new Date(data.fetchedAt).toLocaleString();render()}catch(e){document.getElementById('app').innerHTML='<section class="panel error"><b>Unable to load APIMS data.</b><div style="margin-top:6px">'+esc(e.message)+'</div></section>'}}
document.getElementById('station').addEventListener('change',e=>{state.station=e.target.value;render()});load();
</script>
</body></html>`;
}

export async function airQualityResponse(request) {
  const url = new URL(request.url);
  if (url.pathname === "/air-quality") {
    return new Response(pageHtml(), {
      status: 200,
      headers: {
        ...API_CORS,
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store"
      }
    });
  }

  if (url.pathname === "/api/air-quality") {
    try {
      const data = await loadAirQuality();
      return Response.json(data, {
        status: 200,
        headers: { ...API_CORS, "cache-control": "max-age=300" }
      });
    } catch (error) {
      return Response.json(
        { status: "error", message: error?.message || String(error) },
        { status: 502, headers: API_CORS }
      );
    }
  }

  return null;
}
