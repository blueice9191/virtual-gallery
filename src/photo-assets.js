// Fetch once per visit. The wall, collection and close-up share the same local blob.
// This keeps an already-open visit usable even if its server is interrupted.
export function createPhotoAssets({ fetchAsset = fetch, makeObjectURL = blob => URL.createObjectURL(blob) } = {}) {
  const sources = new Map();
  return {
    dispose(){for(const pending of sources.values())pending.then(url=>URL.revokeObjectURL(url)).catch(()=>{});sources.clear();},
    source(photo) {
      if (!sources.has(photo.id)) {
        const pending = (async () => {
          const response = await fetchAsset(photo.src);
          if (!response.ok) throw new Error(`Could not load ${photo.title || photo.id} (HTTP ${response.status}).`);
          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) throw new Error(`The server did not return an image for ${photo.title || photo.id}.`);
          return makeObjectURL(blob);
        })().catch(error => { sources.delete(photo.id); throw error; });
        sources.set(photo.id, pending);
      }
      return sources.get(photo.id);
    },
  };
}
