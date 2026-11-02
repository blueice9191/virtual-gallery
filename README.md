# Grant Gallery

A walkable, browser-based museum for **photography, drawings, paintings, calligraphy, illustrations, and other visual art**. Bring digital images of your work and let visitors explore an exhibition rather than scroll through an album.

The building has a twelve-sided ring with flat gallery walls, an open atrium, and three connected floors: twelve rooms on each of the first two floors and six wider rooms on the third. No Unity editor, plugin, or installation is required for visitors. The project uses JavaScript, Three.js, and Vite.

## What visitors can do

- Walk between galleries with keyboard/mouse or two transparent touch joysticks.
- Click artwork for a close-up with optional title, description, date, and location.
- Read physical albums on the atrium desk and click either side to turn pages.
- Take a smooth, pausable tour through every floor, at 0.5×, 1×, 2×, or 4× speed.
- Explore a fresh arrangement each visit; works stay assigned to the same walls during that visit.
- Customize name, subtitle, logo, sky, frame mat width, and procedural atrium sculpture.

Mobile rendering uses smaller textures, bounded nearby-display loading, and lighter rendering. The original gallery's mobile update was verified by its owner on iPhone and iPad; device capability and collection size still affect performance.

## Quick start

Install Node.js **22.12 or newer**, then:

```sh
git clone https://github.com/blueice9191/grant-gallery.git
cd grant-gallery
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:5180/**. Build once before starting the server, and rebuild after source or catalog changes. On Windows you can also use `START_MUSEUM.cmd` after installing dependencies. If port 5180 is occupied, set `MUSEUM_PORT` to another port before starting.

For development, use `npm run dev`; for a production build, `npm run build`. Live Cloudinary administration requires `npm start`, not the Vite development server. Run `npm run build` before `npm test`, because server tests inspect built assets.

The repository includes 32 original abstract SVG studies. **No personal photograph catalog, API credentials, or hosted Site identity is included.**

## Bring your artwork

### Folder conventions

```text
My Art/
  Paintings/
  Drawings/
  Calligraphy/
  Panorama_Landscapes/
  Panorama_Ink/
  Favorite/                 optional
    Paintings.jpg
    Drawings.png
```

Regular folders can have any names. Names beginning with **`Panorama`** are reserved for the third floor. `Favorite` and the `Panorama` prefix are case-sensitive.

Floors 1 and 2 each choose a regular collection, choosing different collections when available. The third floor chooses one Panorama collection per visit and does not mix other panorama collections into it. Smaller walls may use regular artwork. If there are no Panorama folders, the third floor uses regular artwork. With only panorama artwork, the first two floors remain unfilled.

The atrium panel uses a work in `Favorite` whose filename, without the image extension, matches the chosen first-floor folder name (case-insensitive). For example, `Favorite/Paintings.jpg` represents `Paintings`. If no match exists, the panel randomly selects a work from that first-floor collection. Each non-Favorite folder also becomes a desk album.

Wall images do not repeat within the visit. Spare regular walls can draw from other regular collections; when the unique eligible pool runs out, wall space remains empty. Panorama collections stay separate. Use identical `contentKey` values for copies of the same image to prevent duplicate uploads appearing twice. Local imports compute file hashes; Cloudinary imports use available ETags.

### Local folders

Open **Settings → Photo source → Local root folder** and choose your root. Files stay on your device. JPEG, PNG, WebP, and AVIF are supported by the importer, subject to browser decoding support. Browser directory permission is required; compatibility pickers may require reselecting the root to resync. A local folder is for private viewing on that device, not a way to publish files to other visitors.

### Cloudinary

Run the local Node server. In Settings choose Cloudinary, expand **Connect for live Cloudinary resync**, and enter your own cloud name, API key, and API secret. Connect, then click **Resync collection**. The connector reads public uploaded image assets across your folders and writes the catalog to `public/gallery.json` and the built copy. Rebuild before deployment. See [collection setup](docs/COLLECTIONS.md).

Cloudinary credentials stay in server memory, or can be supplied through server environment variables. They are not exported in site settings. Never commit credentials. Cloud names and public delivery URLs are visible to visitors; hiding the cloud name requires your own image proxy and a sanitized catalog.

### Static catalog and metadata

You can use any image host by editing `public/gallery.json`, or providing a public catalog URL in Settings. A public catalog and images must be reachable by visitors and allow cross-origin access when hosted elsewhere. See [catalog format and metadata](docs/COLLECTIONS.md). Albums are generated from catalog folders at runtime.

## Customize and deploy your own gallery

Change Settings, then **Export configuration** and replace `public/site.json` to make those choices defaults for everyone. Browser-only changes do not alter the published defaults. The included neutral identity is Open Gallery; use your own name and logo.

```sh
npm ci
npm run build
```

Deploy the contents of `dist/` to a static host at the **root of a domain**, for example Cloudflare Pages, Netlify, or an equivalent static server. Configure build command `npm run build` and output directory `dist`. This version uses root-relative catalog and image paths; hosting under a GitHub Pages repository subpath requires additional path configuration, and is not configured out of the box. GitHub is the source distribution location; publishing source does not automatically publish a running website.

The static gallery supports browsing and public catalog refreshes. Live authenticated Cloudinary listing is intentionally limited to the local connector; a hosted owner-admin service would need a separately secured backend. Never expose the local administration API publicly.

## Project map

| Path | Purpose |
| --- | --- |
| `src/building.js` | Shared room geometry, collision, stairs, and navigation |
| `src/exhibition.js`, `src/expanded-displays.js` | Generic collection selection and unique wall placement |
| `src/main.js` | Viewer, interaction, settings, and rendering |
| `src/books.js`, `src/preload.js` | Albums, flipping, and adjacent-page caching |
| `src/mobile-rendering.js` | Bounded mobile wall texture loading |
| `server/cloudinary.mjs` | Local Cloudinary connector |
| `public/gallery.json`, `public/site.json` | Artwork catalog and site defaults |
| `tests/` | Geometry, tour, source, settings, and resource lifecycle tests |

Floor count and polygon side count are implementation choices, not Settings controls. This release is fixed at 12/12/6 rooms; catalog changes do not require regenerating the floor plan.

## License

Code and the included abstract SVG samples are provided under the [MIT License](LICENSE). Third-party dependencies retain their own licenses. Your uploaded artwork remains yours and is not automatically licensed under this project's code license. Only publish artwork you have permission to display.

Built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/).


## Opt-in artwork titles

The launch introduction has no collection-specific tagline. Close-up and Collection titles display only for a filename beginning with `##`: `##Autumn, 2026.jpg` displays `Autumn, 2026`; `IMG_1234.jpg` displays no title. Existing descriptions and dates remain independent. Matching Favorite folder names still uses the original asset name. Local imports store the filename; Cloudinary imports store the display name (falling back to original filename/public ID). Rename the display name in Cloudinary for this convention. Resync is required after renaming because visitors read catalog snapshots, not live asset metadata. Rebuild/redeploy after a local resync to publish the change; opening a close-up alone does not fetch metadata. A public catalog URL must also serve an updated catalog.


Frame Settings offers pearl white (warm cream), silver, and black with a 4 cm border, half the previous width. New site defaults are pearl white and wide white mat. Saved browser margin preferences remain in effect; Reset to site defaults applies the new presentation. Albums remain borderless.
