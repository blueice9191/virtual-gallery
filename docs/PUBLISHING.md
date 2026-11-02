# Updating a gallery without Codex

Codex is optional. You can build and publish this project with Node.js and your hosting provider's dashboard. Visitors only need a browser.

## First installation

1. Download the repository using Code → Download ZIP, or clone it with Git.
2. Install Node.js 22.12 or newer.
3. Open a terminal in the extracted project folder and run:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:5180/. To use Cloudinary, connect your own account in Settings with cloud name, API key, and API secret, then click Resync collection. Keep credentials out of source control. The local server retains credentials only in memory, so reconnect after a restart.

## Each collection update

1. Add, rename, move, or remove images in Cloudinary.
2. Run the local server, connect Cloudinary if needed, and click Resync collection.
3. Check the local albums and exhibition. Resync writes the new snapshot to `public/gallery.json` and regenerates `public/albums.json`.
4. Run `npm run build` in the project folder.
5. Upload the contents of `dist/` to your static host, replacing the previous deployment. Use a domain-root deployment, as described in the README.
6. Reload your public gallery to receive the updated catalog.

If your host builds from a Git repository, instead commit and push the updated public catalog files. Configure the host to run `npm ci` and `npm run build`, and serve `dist/`. Pushing source alone does not deploy unless you have configured that integration.

Local-root-folder mode is different: its files remain on your device. To publish those files, create a public catalog with web-accessible image URLs or include the images under `public/artwork/`. Folder permission in your browser does not upload them.

## What the online Resync button does

The public site reads a deployed catalog snapshot; it does not use your Cloudinary API secret or scan your account on each visit. A configured public catalog URL can be refreshed online, but that URL must already contain an updated catalog. Static hosting cannot run the local Cloudinary administration connector.

This release's bundled GitHub Actions workflow only builds and tests. It does **not** sync Cloudinary or deploy the website.

## Could everything be updated online?

Yes, but this is not implemented in this release. Two possible extensions are:

- A GitHub Actions workflow that uses repository secrets to regenerate a Cloudinary catalog and deploy to a chosen host. Owners could trigger it online or schedule it without running a local copy.
- An authenticated owner-admin backend that stores credentials server-side and provides online sync and publishing controls.

Either approach needs explicit hosting and credential setup. Never place API secrets in browser JavaScript, public JSON, or the repository. The current local workflow does not require any code changes or AI tools for ordinary collection updates.
