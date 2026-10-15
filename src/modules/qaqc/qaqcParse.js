// Ruling scale used by SpotScore.getRuling() (spotScore.py): low < good < great < excellent.
export const RULING_ORDER = ['low', 'good', 'great', 'excellent'];

export const RULING_COLORS = {
  low: '#c0392b',
  good: '#e67e22',
  great: '#2e8b57',
  excellent: '#1e8449',
};

export const RULING_LABELS = {
  low: 'Low',
  good: 'Good',
  great: 'Great',
  excellent: 'Excellent',
};

// The facets issues are grouped into, in display order (top to bottom).
export const FACETS = ['measurements', 'images', 'samples', 'trace', 'general'];

const FACET_LABELS = {
  measurements: 'Measurements',
  images: 'Images',
  samples: 'Samples',
  trace: 'Traces / Lines',
  general: 'General / Data',
};

export const facetLabel = key => FACET_LABELS[key] || 'General';

// Map one completeness factor to a facet. Order matters: the measurement regex
// runs first so a "linear" measurement isn't misrouted to the 'line' trace.
const categorizeFactor = (text) => {
  const t = (text || '').toLowerCase();
  if (/(measurement|planar|linear|strike|dip|trend|plunge|feature type)/.test(t)) return 'measurements';
  if (t.includes('image')) return 'images';
  if (t.includes('sample')) return 'samples';
  if (t.includes('trace') || t.includes('line')) return 'trace';
  return 'general';
};

// Parses the text blob in qaqc.notes into {ruling, factors}
export const parseNotes = (notes) => {
  const result = {ruling: null, factors: []};
  if (!notes || typeof notes !== 'string') return result;
  for (const rawLine of notes.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('spot completeness:')) {
      // "Spot completeness: low" -> "low"
      result.ruling = line.split(':').slice(1).join(':').trim().toLowerCase();
    }
 else if (line.toLowerCase() === 'suggestions:') {
      continue;
    }
 else if (line.startsWith('-')) {
      const factor = line.replace(/^-\s*/, '').trim();
      if (factor) result.factors.push(factor);
    }
  }
  return result;
};

// Group a flat list of factors into facets
export const groupFactorsByFacet = (factors) => {
  const grouped = {};
  for (const key of FACETS) grouped[key] = [];
  for (const f of factors || []) grouped[categorizeFactor(f)].push(f);
  return FACETS.filter(key => grouped[key].length > 0).map(key => ({
    key,
    label: facetLabel(key),
    factors: grouped[key],
  }));
};

// Resolve the structured QAQC view from a spot's `properties.qaqc` block.
// Prefers the machine-readable `structured` block but will fallback to a `notes` blob.
export const resolveQAQC = (qaqc) => {
  if (!qaqc || typeof qaqc !== 'object') {
    return {
      present: false, ruling: null, complete: null,
      completenessFactors: [], richnessFactors: [], facets: [],
      notes: null, timestamp: null, version: null, advice: null, mlModel: null,
    };
  }

  const structured = qaqc.structured;
  let ruling = null;
  let completenessFactors = [];
  let richnessFactors = [];
  let complete = null;

  if (structured && typeof structured === 'object') {
    ruling = structured.ruling || null;
    completenessFactors = structured.completeness_factors || [];
    richnessFactors = structured.richness_factors || [];
    complete = typeof structured.complete === 'boolean' ? structured.complete : null;
  }
 else if (typeof qaqc.notes === 'string') {
    const parsed = parseNotes(qaqc.notes);
    ruling = parsed.ruling;
    completenessFactors = parsed.factors;
  }

  const hasContent = completenessFactors.length > 0 || richnessFactors.length > 0 || ruling !== null;
  return {
    present: hasContent,
    ruling,
    complete,
    completenessFactors,
    richnessFactors,
    facets: groupFactorsByFacet(completenessFactors),
    notes: qaqc.notes || null,
    timestamp: qaqc.timestamp || null,
    version: qaqc.version || null,
    advice: qaqc.advice || null,
    mlModel: qaqc.ml_model || null,
  };
};

// Percentage of spots that are complete
export const completenessPercent = (qaqc) => {
  const ml = qaqc?.ml_model;
  if (ml && typeof ml.probability_complete === 'number') {
    return Math.round(ml.probability_complete * 100);
  }
  const structured = qaqc?.structured;
  if (structured && typeof structured.complete === 'boolean') {
    // If complete is True/False just return 100 or 0.
    return structured.complete ? 100 : 0;
  }
  return null;
};

export const rulingColor = ruling => RULING_COLORS[ruling] || '#888888';
export const rulingLabel = ruling => (ruling && RULING_LABELS[ruling]) ? RULING_LABELS[ruling] : 'Unknown';
