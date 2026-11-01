# Collections and metadata

## Catalog format

`public/gallery.json` is the default catalog. For your own host, a public JSON URL can also be entered in Settings. Use a new `version` after adding/removing works so cached visit assignments are regenerated.

```json
{
  "version": "my-art-2026-11-01",
  "photos": [
    {
      "id": "ink-001",
      "folder": "Calligraphy",
      "theme": "Calligraphy",
      "title": "Autumn verse",
      "alt": "Black ink calligraphy on cream paper",
      "description": "Ink on paper, from the autumn series.",
      "dateTaken": "2026",
      "location": "Studio",
      "width": 1200,
      "height": 1800,
      "src": "/artwork/ink-001.jpg",
      "displaySrc": "/artwork/ink-001-display.jpg",
      "thumbnail": "/artwork/ink-001-thumb.jpg",
      "contentKey": "optional-identifier-for-identical-image-content"
    }
  ]
}
```

The historical internal keys `photos` and `dateTaken` also describe drawings, paintings, and other artwork. They do not restrict the medium. Required fields are a unique `id`, `src`, and positive `width` and `height`. Set `folder` and `theme` to the same collection name. Optional title, description, date, and location appear in the close-up, not as wall captions. `alt` describes the work for accessibility. Use absolute HTTPS URLs for external images or root-relative paths for files in `public/`.

Keep metadata in this catalog beside the website source. A separate metadata file per artwork is unnecessary. Cloudinary can host images while the website host serves this JSON. The connector imports folder/display names and dimensions, not editorial descriptions or dates; manually added editorial fields are not guaranteed to survive a later connector resync. Keep a backed-up metadata source and merge it after resync when needed.

For hand-authored metadata, use `favoriteFor` on a Favorite asset to identify its collection explicitly. Otherwise its title is matched to the collection name after a recognized image extension is stripped. Unmatched Favorite assets are not used as ordinary wall filler or albums.

## Cloudinary workflow

1. Upload public image assets into your own Cloudinary folders. Create ordinary collections with arbitrary names and optionally `Panorama...` and `Favorite` folders.
2. Start `npm start` locally. Enter your account credentials in Settings and connect.
3. Click Resync collection. Pagination reads all public uploaded image assets, so check the account for unrelated public assets before syncing. Private/authenticated assets are not included.
4. Review the exhibition and generated `public/gallery.json`. Verify the public URLs and metadata before committing the catalog.
5. Run `npm run build`, then upload `dist/` to your host.

Alternatively set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the local server's environment. Do not put them in source or `site.json`. Environment variables are read by the server; an `.env` file is not loaded automatically.

Resync is explicit; the gallery does not silently scan your Cloudinary account on every public visit. Public visitors initially receive the deployed catalog snapshot. A public catalog URL can be refreshed from Settings without revealing API secrets, but the catalog and images themselves are public.

## Image sizes and mobile

Provide web-sized display images and thumbnails rather than making every wall decode an original. For Cloudinary URLs the phone mode requests a 768×768 bounding box, loads at most 24 nearby displays with two concurrent requests, and releases distant textures. A close-up requests up to 2048×2048 only when opened. On other hosts, supply appropriately sized `displaySrc` assets yourself; the gallery cannot rewrite arbitrary CDN URLs. Original assets may be much larger, especially panoramas.

Albums are borderless. Wall mats can be absent, narrow, or wide inside black frames. Empty wall space is expected when the unique collection is smaller than the building capacity.
