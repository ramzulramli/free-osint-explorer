import { search } from "./search.js";

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x27;/gi,"'")
    .replace(/&#(\d+);/g,(_,code)=>{const n=Number(code);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):_;})
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>{const n=parseInt(code,16);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):_;})
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
}
function stripHtml(value){return decodeHtmlEntities(String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());}
function normalizeEntity(value){return String(value||"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().toLowerCase();}
function cleanTextForEntities(text){return decodeHtmlEntities(text).replace(/\s+/g," ").trim();}
function extractTitle(html){const match=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);return match?stripHtml(match[1]):"";}
function extractLinks(html,baseUrl){
  const links=[],seen=new Set(),regex=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let match;
  while((match=regex.exec(html))!==null){try{const url=new URL(match[1],baseUrl);if(!["http:","https:"].includes(url.protocol)||seen.has(url.toString()))continue;seen.add(url.toString());links.push({text:stripHtml(match[2]),url:url.toString()});}catch{}}
  return links;
}
function extractReadableText(html){return stripHtml(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<svg[\s\S]*?<\/svg>/gi," ").replace(/<template[\s\S]*?<\/template>/gi," ").replace(/<nav[\s\S]*?<\/nav>/gi," ").replace(/<footer[\s\S]*?<\/footer>/gi," ").replace(/<!--[\s\S]*?-->/g," "));}

const COMMON_NON_PERSON_WORDS=new Set(["wikipedia","jump","navigation","main","contents","current","about","contact","contribute","help","learn","search","appearance","donate","create","account","article","talk","english","read","edit","view","history","tools","actions","general","what","from","personal","information","date","birth","place","height","position","youth","career","team","league","club","cup","season","apps","goals","total","international","statistics","reference","references","external","links","privacy","policy","creative","commons","attribution","conduct","developers","cookie","toggle","hidden","categories","malaysian","men","forward","striker","senior","junior","years","head","this","use","official","wiki","database","monster","squad","players","former","born","full","name","safety","how"]);
const COMMON_NON_PERSON_PHRASES=new Set(["penternak arnab"]);
const COMMON_ORGANISATION_WORDS=new Set(["berhad","bhd","sdn","sendirian","foundation","association","university","corporation","company","limited","ltd","fc","f.c.","fa","f.a.","team","club"]);
const MALAYSIAN_LOCATIONS=["Malaysia","Selangor","Kuala Lumpur","Terengganu","Kelantan","Johor","Penang","Perak","Pahang","Negeri Sembilan","Melaka","Sabah","Sarawak","Putrajaya","Labuan","Shah Alam","Petaling Jaya","Klang","Tumpat","Wakaf Bharu","Kota Bharu","Kuala Terengganu"];
function isLikelyPersonName(value){const words=value.trim().split(/\s+/);if(words.length<2||words.length>5||value.length<5||value.length>80)return false;const normalized=normalizeEntity(value);if(COMMON_NON_PERSON_PHRASES.has(normalized)||MALAYSIAN_LOCATIONS.some(x=>normalizeEntity(x)===normalized))return false;const lowerWords=words.map(w=>w.replace(/[^a-zA-ZÀ-ÿ'-]/g,"").toLowerCase());if(lowerWords.some(w=>COMMON_NON_PERSON_WORDS.has(w)||COMMON_ORGANISATION_WORDS.has(w)))return false;return words.filter(w=>/^[A-ZÀ-Ý][a-zà-ÿ'-]*$/.test(w)).length>=2;}
function extractPersonCandidates(text){const out=[],seen=new Set(),regex=/\b[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+(?:bin|binti|[A-ZÀ-Ý][a-zà-ÿ'-]+)){1,4}\b/g;let match;while((match=regex.exec(text))!==null){const value=match[0].trim();if(!isLikelyPersonName(value))continue;const normalized=normalizeEntity(value);if(seen.has(normalized))continue;seen.add(normalized);out.push({type:"person_candidate",value,normalized,confidence:/\b(bin|binti)\b/i.test(value)?.85:.60,evidence:"Name-like phrase found in page text"});}return out;}
function extractOrganisationCandidates(text){const out=[],seen=new Set(),regex=/\b[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*){0,2}\s+(?:Berhad|Bhd|Sdn Bhd|Foundation|Association|University|Corporation|Company|Limited|Ltd|FA|F\.A\.|FC|F\.C\.)\b/g;let match;while((match=regex.exec(text))!==null){const value=match[0].replace(/\s+/g," ").trim(),normalized=normalizeEntity(value);if(value.length<4||seen.has(normalized))continue;seen.add(normalized);out.push({type:"organisation_candidate",value,normalized,confidence:.70,evidence:"Organisation-like phrase found in page text"});}return out;}
function extractLocationCandidates(text){const out=[],seen=new Set();for(const location of MALAYSIAN_LOCATIONS){const escaped=location.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");if(!new RegExp(`\\b${escaped}\\b`,"i").test(text))continue;const normalized=normalizeEntity(location);if(seen.has(normalized))continue;seen.add(normalized);out.push({type:"location_candidate",value:location,normalized,confidence:.85,evidence:"Known Malaysian location found in page text"});}return out;}
function uniqueRegex(text,regex,mapper){const out=[],seen=new Set();let match;while((match=regex.exec(text))!==null){const entity=mapper(match[0]);if(!entity||seen.has(entity.normalized))continue;seen.add(entity.normalized);out.push(entity);}return out;}
function extractEmails(text){return uniqueRegex(text,/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,value=>({type:"email",value,normalized:normalizeEntity(value),confidence:.99,evidence:"Email address pattern found in page text"}));}
function extractPhoneNumbers(text){return uniqueRegex(text,/(?:\+?60[\s.-]?1[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}|01[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4})/g,value=>({type:"phone",value,normalized:value.replace(/\D/g,""),confidence:.90,evidence:"Malaysian phone number pattern found in page text"})).filter(x=>x.normalized.length>=10&&x.normalized.length<=12);}
function extractUrls(text){return uniqueRegex(text,/\bhttps?:\/\/[^\s<>"']+/gi,value=>{value=value.replace(/[),.;]+$/," ").trim();return {type:"url",value,normalized:normalizeEntity(value),confidence:.99,evidence:"URL found in page text"};});}
function extractUsernames(text){return uniqueRegex(text,/(^|[^\w])@([A-Za-z0-9._-]{2,30})\b/g,value=>{const username=value.replace(/^.*@/,"@");return {type:"username",value:username,normalized:normalizeEntity(username),confidence:.95,evidence:"Explicit @username found in page text"};});}
function extractDates(text){return uniqueRegex(text,/\b(?:0?[1-9]|[12][0-9]|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/g,value=>({type:"date",value,normalized:normalizeEntity(value),confidence:.90,evidence:"Date pattern found in page text"}));}
function extractYears(text){return uniqueRegex(text,/\b(?:19|20)\d{2}\b/g,value=>({type:"year",value,normalized:normalizeEntity(value),confidence:.85,evidence:"Four-digit year found in page text"}));}
function extractKeywords(text){const stopWords=new Set(["the","and","for","with","from","this","that","have","has","are","was","were","you","your","our","their","about","into","more","www","http","https"]),counts=new Map();for(const word of text.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g)||[])if(!stopWords.has(word))counts.set(word,(counts.get(word)||0)+1);return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([value,count])=>({type:"keyword",value,normalized:value,confidence:Math.min(.95,.45+count*.05),evidence:"Repeated content keyword"}));}
function deduplicateEntities(entities){const map=new Map();for(const entity of entities){const key=`${entity.type}:${entity.normalized}`,existing=map.get(key);if(!existing||entity.confidence>existing.confidence)map.set(key,entity);}return [...map.values()];}
function extractEntityCandidates(text){const cleaned=cleanTextForEntities(text);return deduplicateEntities([...extractPersonCandidates(cleaned),...extractOrganisationCandidates(cleaned),...extractLocationCandidates(cleaned),...extractEmails(cleaned),...extractPhoneNumbers(cleaned),...extractUrls(cleaned),...extractUsernames(cleaned),...extractDates(cleaned),...extractYears(cleaned),...extractKeywords(cleaned)]);}

function scorePersonCandidate(entity, query, sourceCount) {
  const q = normalizeEntity(query);
  const n = entity.normalized;
  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = n.split(" ").filter(Boolean);
  const exact = n === q;
  const tokenOverlap = qTokens.filter(t => nTokens.includes(t)).length / Math.max(qTokens.length, 1);
  const hasBin = /\b(bin|binti)\b/.test(n);
  let score = entity.confidence * 0.45 + tokenOverlap * 0.35 + Math.min(sourceCount, 4) * 0.05;
  if (exact) score += 0.15;
  if (hasBin && q.includes("bin ")) score += 0.05;
  return Math.min(1, Number(score.toFixed(4)));
}

async function readForInvestigation(url) {
  try {
    const targetUrl = new URL(url);
    if (!["http:","https:"].includes(targetUrl.protocol)) return { ok:false, url, error:"Unsupported protocol" };
    const response = await fetch(targetUrl.toString(), { headers:{"User-Agent":"Mozilla/5.0 (compatible; FreeOSINTExplorer/0.5)"} });
    const html = await response.text();
    if (!response.ok) return { ok:false, url, error:`HTTP ${response.status}` };
    const text = extractReadableText(html);
    return { ok:true, url:targetUrl.toString(), title:extractTitle(html), textLength:text.length, entities:extractEntityCandidates(text), text };
  } catch(error) { return { ok:false, url, error:error.message }; }
}

async function investigate(query, env = {}, requestedProvider = null) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Missing investigation query");
  const searchResult = await search(q, env, requestedProvider);
  const results = Array.isArray(searchResult.results) ? searchResult.results.slice(0, 5) : [];
  const pages = await Promise.all(results.slice(0, 3).map(result => readForInvestigation(result.url)));
  const successfulPages = pages.filter(page => page.ok);
  const entityMap = new Map();
  for (const page of successfulPages) {
    for (const entity of page.entities) {
      if (!["person_candidate","organisation_candidate","location_candidate","username","email","phone"].includes(entity.type)) continue;
      const key = `${entity.type}:${entity.normalized}`;
      const existing = entityMap.get(key);
      if (existing) { existing.sourceCount += 1; existing.sources.push({title:page.title,url:page.url}); }
      else entityMap.set(key,{...entity,sourceCount:1,sources:[{title:page.title,url:page.url}]});
    }
  }
  const entities = [...entityMap.values()].map(entity => ({...entity, score:scorePersonCandidate(entity,q,entity.sourceCount)})).sort((a,b)=>b.score-a.score);
  const people = entities.filter(x=>x.type==="person_candidate").slice(0,10);
  const topEntity = people[0] || entities[0] || null;
  return {
    status:"success",
    investigation:{query:q,subject:topEntity?.value || q,confidence:topEntity ? topEntity.score : 0},
    search:{provider:searchResult.provider,attemptedProviders:searchResult.attemptedProviders || [],resultCount:results.length},
    sources:successfulPages.map(page=>({title:page.title,url:page.url,httpStatus:200,textLength:page.textLength})),
    candidates:people.map(x=>({value:x.value,confidence:x.score,sourceCount:x.sourceCount,sources:x.sources.slice(0,5)})),
    related:entities.filter(x=>x!==topEntity).slice(0,15).map(x=>({type:x.type,value:x.value,confidence:x.score,sourceCount:x.sourceCount,sources:x.sources.slice(0,3)})),
    stats:{searchResults:results.length,pagesRead:successfulPages.length,pagesFailed:pages.length-successfulPages.length,entitiesFound:entities.length},
    limits:{maxSearchResults:5,maxPages:3,maxEntities:50}
  };
}

function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function appHtml(){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Free OSINT Explorer</title><style>
:root{color-scheme:dark;--bg:#070b12;--panel:#0e1624;--panel2:#121d2e;--line:#26354b;--text:#edf3fb;--muted:#91a1b8;--accent:#6ee7b7;--accent2:#60a5fa;--danger:#fb7185}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#17243a 0,#070b12 48%);font:15px system-ui,-apple-system,Segoe UI,sans-serif;color:var(--text)}.wrap{max-width:1180px;margin:auto;padding:44px 22px 70px}.brand{display:flex;align-items:center;gap:12px}.mark{width:38px;height:38px;border:1px solid #35506f;border-radius:10px;display:grid;place-items:center;color:var(--accent);font-weight:800}.brand h1{font-size:20px;margin:0}.tag{color:var(--muted);font-size:12px;margin-top:2px}.hero{text-align:center;padding:64px 0 34px}.hero h2{font-size:42px;line-height:1.05;margin:0 0 14px;letter-spacing:-1.5px}.hero p{color:var(--muted);max-width:650px;margin:0 auto 28px}.search{display:flex;gap:10px;max-width:760px;margin:auto}.search input{flex:1;background:#0b1220;border:1px solid #304158;border-radius:12px;padding:16px 18px;color:var(--text);font-size:16px;outline:none}.search input:focus{border-color:var(--accent2)}button{border:0;border-radius:12px;padding:0 22px;background:var(--accent);color:#062019;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.hint{margin-top:12px;color:#718198;font-size:12px}.status{display:none;margin:25px auto 0;max-width:760px;color:var(--muted);text-align:left}.spinner{display:inline-block;width:12px;height:12px;border:2px solid #40516a;border-top-color:var(--accent);border-radius:50%;animation:r .8s linear infinite;margin-right:8px}@keyframes r{to{transform:rotate(360deg)}}#results{margin-top:32px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.card{background:linear-gradient(180deg,#101a2a,#0c1421);border:1px solid var(--line);border-radius:16px;padding:20px}.card h3{margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#b5c2d4}.identity{display:flex;align-items:center;justify-content:space-between;gap:20px}.name{font-size:27px;font-weight:750}.confidence{font-size:13px;color:var(--accent);margin-top:4px}.meter{width:120px;height:7px;background:#1b293d;border-radius:99px;overflow:hidden}.meter i{display:block;height:100%;background:var(--accent);border-radius:99px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{background:#162337;border:1px solid #2a3c55;padding:7px 10px;border-radius:999px;font-size:13px}.chip b{color:#cbd8e8;font-weight:600}.source{padding:11px 0;border-bottom:1px solid #1d2a3d}.source:last-child{border-bottom:0}.source a{color:#9cc5ff;text-decoration:none}.source small{display:block;color:#718198;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.related{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.rel{padding:12px;background:#0b1320;border:1px solid #203048;border-radius:10px}.rel strong{display:block}.rel span{font-size:11px;color:var(--muted)}.empty{padding:32px;text-align:center;color:var(--muted)}.error{border-color:#6d2d3a;color:#fecdd3}.footer{margin-top:35px;text-align:center;color:#53627a;font-size:12px}@media(max-width:800px){.grid{grid-template-columns:1fr}.hero h2{font-size:34px}.search{flex-direction:column}.search button{height:50px}.related{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><header class="brand"><div class="mark">O</div><div><h1>Free OSINT Explorer</h1><div class="tag">On-demand public-source investigation</div></div></header><section class="hero"><h2>Find the person behind the name.</h2><p>Search public sources, discover possible identities, social accounts, locations and supporting evidence — without pretending that a name match is proof.</p><form class="search" id="form"><input id="q" autocomplete="off" placeholder="Try: Fauzi Ariffin" autofocus><button id="go">Investigate</button></form><div class="hint">Tip: full names work better. Try <b>Fauzi Ariffin</b> instead of only <b>Ahmad Fauzi</b>.</div><div class="status" id="status"><span class="spinner"></span><span id="statusText">Searching public sources…</span></div></section><main id="results"></main><div class="footer">Free OSINT Explorer · results are leads, not proof of identity</div></div><script>
const $=id=>document.getElementById(id);const esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML};
function pct(n){return Math.round((Number(n)||0)*100)}
function sourceCard(s){return '<div class="source"><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||s.url)+'</a><small>'+esc(s.url)+'</small></div>'}
function render(data){const inv=data.investigation||{};const people=data.candidates||[];const related=data.related||[];const sources=data.sources||[];let html='';html+='<div class="grid">';html+='<section class="card"><h3>Possible identity</h3>';if(people.length){const p=people[0],v=pct(p.confidence);html+='<div class="identity"><div><div class="name">'+esc(p.value)+'</div><div class="confidence">'+v+'% match signal · '+p.sourceCount+' source'+(p.sourceCount===1?'':'s')+'</div></div><div><div class="meter"><i style="width:'+v+'%"></i></div></div></div>';if(people.length>1){html+='<div style="margin-top:24px"><h3>Other candidates</h3><div class="chips">'+people.slice(1).map(x=>'<span class="chip">'+esc(x.value)+' <b>'+pct(x.confidence)+'%</b></span>').join('')+'</div></div>'}}else{html+='<div class="empty">No person candidate was extracted. Try a more specific query.</div>'}html+='</section>';
html+='<section class="card"><h3>Investigation</h3><div class="chips"><span class="chip">Query <b>'+esc(inv.query)+'</b></span><span class="chip">Results <b>'+esc(data.stats?.searchResults??0)+'</b></span><span class="chip">Pages read <b>'+esc(data.stats?.pagesRead??0)+'</b></span><span class="chip">Entities <b>'+esc(data.stats?.entitiesFound??0)+'</b></span></div><div style="margin-top:18px;color:#91a1b8;font-size:13px">Provider: '+esc(data.search?.provider||'unknown')+'</div></section></div>';
html+='<div class="grid" style="margin-top:18px"><section class="card"><h3>Related signals</h3>';if(related.length){html+='<div class="related">'+related.map(x=>'<div class="rel"><strong>'+esc(x.value)+'</strong><span>'+esc(x.type)+' · '+pct(x.confidence)+'% · '+esc(x.sourceCount)+' source'+(x.sourceCount===1?'':'s')+'</span></div>').join('')+'</div>'}else html+='<div class="empty">No additional signals.</div>';html+='</section><section class="card"><h3>Sources read</h3>';html+=sources.length?sources.map(sourceCard).join(''):'<div class="empty">No readable sources.</div>';html+='</section></div>';$('results').innerHTML=html}
$('form').addEventListener('submit',async e=>{e.preventDefault();const q=$('q').value.trim();if(!q)return;$('go').disabled=true;$('status').style.display='block';$('statusText').textContent='Searching and reading public sources…';$('results').innerHTML='';try{const r=await fetch('/investigate?q='+encodeURIComponent(q));const data=await r.json();if(!r.ok||data.status==='error')throw new Error(data.message||'Investigation failed');render(data)}catch(err){$('results').innerHTML='<section class="card error"><b>Investigation failed</b><div style="margin-top:7px">'+esc(err.message)+'</div></section>'}finally{$('go').disabled=false;$('status').style.display='none'}});
</script></body></html>`}

export { extractEntityCandidates, extractTitle, extractReadableText, extractLinks, investigate };

export default { async fetch(request,env){
  const url=new URL(request.url);

  const corsHeaders={
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type"
  };

  if(request.method==="OPTIONS"){
    return new Response(null,{status:204,headers:corsHeaders});
  }

  if(url.pathname==="/")
    return new Response(appHtml(),{
      headers:{
        "content-type":"text/html; charset=UTF-8",
        "cache-control":"no-store"
      }
    });

  if(url.pathname==="/search"){
    const query=url.searchParams.get("q")?.trim();

    if(!query)
      return Response.json(
        {error:"Missing search query",usage:"/search?q=keyword"},
        {status:400,headers:corsHeaders}
      );

    try{
      return Response.json(
        {
          status:"success",
          ...(await search(
            query,
            env,
            url.searchParams.get("provider")?.trim().toLowerCase()||null
          ))
        },
        {headers:corsHeaders}
      );
    }catch(error){
      return Response.json(
        {status:"error",message:error.message},
        {status:502,headers:corsHeaders}
      );
    }
  }

  if(url.pathname==="/investigate"){
    const query=url.searchParams.get("q")?.trim();

    if(!query)
      return Response.json(
        {
          error:"Missing investigation query",
          usage:"/investigate?q=Sabri%20Yunus"
        },
        {status:400,headers:corsHeaders}
      );

    try{
      return Response.json(
        await investigate(
          query,
          env,
          url.searchParams.get("provider")?.trim().toLowerCase()||null
        ),
        {headers:corsHeaders}
      );
    }catch(error){
      return Response.json(
        {status:"error",message:error.message},
        {status:502,headers:corsHeaders}
      );
    }
  }

  if(url.pathname==="/fetch"||url.pathname==="/read"||url.pathname==="/entities"){
    const target=url.searchParams.get("url")?.trim();

    if(!target)
      return Response.json(
        {
          error:"Missing URL",
          usage:`${url.pathname}?url=https://example.com`
        },
        {status:400,headers:corsHeaders}
      );

    try{
      const targetUrl=new URL(target);

      if(!["http:","https:"].includes(targetUrl.protocol))
        throw new Error("Only HTTP and HTTPS URLs are allowed");

      const response=await fetch(targetUrl.toString(),{
        headers:{
          "User-Agent":"Mozilla/5.0 (compatible; FreeOSINTExplorer/0.4)"
        }
      });

      const html=await response.text();

      if(!response.ok)
        throw new Error(`Target returned HTTP ${response.status}`);

      if(url.pathname==="/fetch")
        return Response.json({
          status:"success",
          url:targetUrl.toString(),
          httpStatus:response.status,
          contentType:response.headers.get("content-type"),
          contentLength:html.length,
          preview:html.substring(0,1000)
        },{headers:corsHeaders});

      const title=extractTitle(html);
      const text=extractReadableText(html);

      if(url.pathname==="/read"){
        const links=extractLinks(html,targetUrl.toString());

        return Response.json({
          status:"success",
          url:targetUrl.toString(),
          httpStatus:response.status,
          title,
          textLength:text.length,
          text:text.substring(0,10000),
          linkCount:links.length,
          links:links.slice(0,100)
        },{headers:corsHeaders});
      }

      const entities=extractEntityCandidates(text);

      return Response.json({
        status:"success",
        url:targetUrl.toString(),
        httpStatus:response.status,
        title,
        textLength:text.length,
        entityCount:entities.length,
        entities
      },{headers:corsHeaders});

    }catch(error){
      return Response.json(
        {status:"error",message:error.message},
        {status:502,headers:corsHeaders}
      );
    }
  }

  return Response.json(
    {error:"Not found"},
    {status:404,headers:corsHeaders}
  );
} };
