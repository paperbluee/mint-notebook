export const english = value => value.normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑–]/g,'-').replace(/\s+/g,' ');
const chinese = value => value.normalize('NFKC').toLowerCase().replace(/\b(?:adj|adv|prep|conj|pron|interj|vt|vi|n|v|a)\./g,'').replace(/的(?=$|[\s\p{P}])/gu,'').replace(/[\p{P}\p{Z}\s…]/gu,'');
const parts = value => value.split(/[、；;，,\/\n]+/u).map(chinese).filter(Boolean);
export function correct(value, word, meanings, kind) {
  if (kind === 0) {
    const options = [word, ({catalogue:'catalog',caliber:'calibre',authorize:'authorise',criticize:'criticise',emphasize:'emphasise',specialize:'specialise',organize:'organise',behavior:'behaviour',labor:'labour',honor:'honour',endeavor:'endeavour',fiber:'fibre',defense:'defence'})[word]].filter(Boolean);
    return options.some(option => english(value) === english(option));
  }
  const alternatives = new Set(meanings.flatMap(m => [chinese(m), ...parts(m)]));
  const submitted = parts(value);
  return submitted.length > 0 && (alternatives.has(chinese(value)) || submitted.every(v => alternatives.has(v)));
}
