export function createVisit(catalog, random = Math.random) {
  const assignments = {};
  for (const theme of [...new Set(catalog.photos.map(p=>p.theme||'collection'))]) {
    const ids = catalog.photos.filter(p => (p.theme||'collection') === theme).map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    assignments[theme] = ids;
  }
  return { version: catalog.version, assignments, created: Date.now() };
}
export function validVisit(visit, catalog) {
  if (!visit || visit.version !== catalog.version) return false;
  const themes=[...new Set(catalog.photos.map(p=>p.theme||'collection'))];
  if(JSON.stringify(Object.keys(visit.assignments||{}).sort())!==JSON.stringify([...themes].sort()))return false;
  return themes.every(theme => {
    const expected = catalog.photos.filter(p => (p.theme||'collection') === theme).map(p => p.id).sort();
    const actual = visit.assignments?.[theme];
    return Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify(expected);
  });
}
