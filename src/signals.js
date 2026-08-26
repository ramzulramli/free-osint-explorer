const PUBLIC_SIGNAL_TYPES = new Set(["organisation_candidate","location_candidate","username","email","phone","url","date","year"]);

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(a, b) {
  const left = new Set(normalize(a).split(" ").filter(Boolean));
  const right = new Set(normalize(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  for (const token of left) if (right.has(token)) hits += 1;
  return hits / Math.max(left.size, right.size);
}

function associationForSignal(candidate, signal, source) {
  const title = normalize(source?.title);
  const candidateName = normalize(candidate?.value);
  const signalValue = normalize(signal?.value);
  if (candidateName && title.includes(candidateName)) return "direct_title_match";
  if (candidateName && signalValue && tokenOverlap(candidateName, signalValue) >= 0.8 && title.includes(signalValue)) return "direct_signal_match";
  return "page_mention";
}

function labelForType(type) {
  return ({
    organisation_candidate: "Organisation / affiliation",
    location_candidate: "Location signals",
    username: "Public social accounts",
    email: "Public contact channels",
    phone: "Public contact channels",
    url: "Public links",
    date: "Dates",
    year: "Years"
  })[type] || "Other public signals";
}

function buildSignalCards(candidate, entities = []) {
  const cards = new Map();
  for (const entity of entities) {
    if (!PUBLIC_SIGNAL_TYPES.has(entity.type)) continue;
    const sources = Array.isArray(entity.sources) ? entity.sources : [];
    const evidence = sources.map(source => ({
      title: source.title || source.url,
      url: source.url,
      association: associationForSignal(candidate, entity, source)
    }));
    const key = `${entity.type}:${entity.normalized || normalize(entity.value)}`;
    if (!cards.has(key)) {
      cards.set(key, {type:entity.type, group:labelForType(entity.type), value:entity.value, confidence:entity.score ?? entity.confidence ?? 0, sourceCount:entity.sourceCount || sources.length, evidence});
    } else {
      const existing = cards.get(key);
      const known = new Set(existing.evidence.map(x => x.url));
      for (const item of evidence) if (item.url && !known.has(item.url)) existing.evidence.push(item);
      existing.sourceCount = existing.evidence.length;
    }
  }
  return [...cards.values()].sort((a,b)=>b.confidence-a.confidence||b.sourceCount-a.sourceCount).map(card=>({...card,evidence:card.evidence.slice(0,5)}));
}

function buildIdentityDimensions(candidate, allEntities = []) {
  const candidateSources = new Set((candidate?.sources || []).map(x => x.url).filter(Boolean));
  return {
    nameMatch:Number((candidate?.confidence || 0).toFixed(4)),
    independentSources:candidateSources.size,
    accountSignals:allEntities.filter(x=>["username","url"].includes(x.type)).length,
    organisationSignals:allEntities.filter(x=>x.type==="organisation_candidate").length,
    locationSignals:allEntities.filter(x=>x.type==="location_candidate").length,
    publicContactSignals:allEntities.filter(x=>["email","phone"].includes(x.type)).length,
    sourceQuality:Math.min(1,candidateSources.size/3),
    note:"Dimensions are corroboration signals, not proof of identity."
  };
}

export { buildSignalCards, buildIdentityDimensions, associationForSignal, labelForType };
