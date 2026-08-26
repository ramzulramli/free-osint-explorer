// Evidence helpers for Free OSINT Explorer.
// Keeps extracted signals tied to their source and provides UI-safe labels.

const PUBLIC_CONTACT_TYPES = new Set(["email", "phone"]);

export function buildEvidenceItem(entity, source) {
  return {
    type: entity?.type || "unknown",
    value: String(entity?.value || "").trim(),
    confidence: Number(entity?.confidence || 0),
    evidence: entity?.evidence || "Signal extracted from publicly accessible page content",
    source: {
      title: source?.title || "Untitled source",
      url: source?.url || ""
    },
    publicContact: PUBLIC_CONTACT_TYPES.has(entity?.type || "")
  };
}

export function signalLabel(type) {
  const labels = {
    person_candidate: "Person",
    organisation_candidate: "Organisation",
    location_candidate: "Location",
    username: "Username",
    email: "Email",
    phone: "Phone"
  };
  return labels[type] || type;
}

export function signalPriority(type) {
  const priorities = {
    person_candidate: 100,
    username: 90,
    organisation_candidate: 80,
    location_candidate: 70,
    email: 60,
    phone: 60
  };
  return priorities[type] || 0;
}

export function buildSignalCards(entities = []) {
  return entities
    .filter(entity => entity && entity.value)
    .map(entity => ({
      ...entity,
      label: signalLabel(entity.type),
      priority: signalPriority(entity.type),
      confidence: Number(entity.score ?? entity.confidence ?? 0)
    }))
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
}

export function isPublicContactSignal(entity) {
  return Boolean(entity && PUBLIC_CONTACT_TYPES.has(entity.type));
}

export function redactContactForPreview(entity) {
  if (!isPublicContactSignal(entity)) return entity?.value || "";
  const value = String(entity.value || "");
  if (entity.type === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return "[email]";
    return `${(local || "").slice(0, 2)}***@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••• ${digits.slice(-4)}` : "[phone]";
}
