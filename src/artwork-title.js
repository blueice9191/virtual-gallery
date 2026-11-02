// Filenames are internal identifiers unless the owner explicitly opts into a caption.
export function artworkTitle(photo){
  const name=String(photo.filename??photo.title??'').replace(/\.(jpe?g|png|webp|avif|svg)$/i,'');
  return name.startsWith('##')?name.slice(2).trim():'';
}
