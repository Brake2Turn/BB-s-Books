# BB's Books

A personal library for BB's books. Scan a book's barcode or its front cover to put it on the shelf. Tap a cover to open it full size, read the blurb, give it a rating out of five and write a review.

It's a web app you install on a phone's home screen. There's no app store, no account and no server. The library is saved on the phone itself.

## How it works

| | |
|---|---|
| **Barcode scan** | Point the camera at the ISBN barcode on the back. The book's details and blurb come from Google Books and Open Library. |
| **The right cover** | Covers are looked up by the exact ISBN on her copy (Amazon's image store, then Open Library, then Google), so the picture matches her edition. If none is found, or it's the wrong one, she can tap **"Take a photo of yours"** and her own copy becomes the cover. Any book's cover can be replaced later from its page. |
| **Cover scan** | Take a photo of the front cover. The app cleans up the photo (contrast, light-on-dark lettering), reads the words on it on the phone itself, and ignores cover clutter like "Sunday Times bestseller". It then searches several ways and puts the best match first. The words it read stay editable in case it slipped. Her photo is used as the cover by default, since it's exactly her copy. |
| **Search by title** | In the scanner, for a book whose barcode won't scan. |
| **Adding a book** | A sheet rises with the cover, title and author. The real cover fades in as it loads. **Add to library** starts a celebration: the cover springs up, confetti flies, and the book's number is called out, with special lines for the first book and milestones. Then the cover lands in its spot on the shelf. **Not this one** goes back to the camera. |
| **Genres** | Each book gets a genre from the book databases, tidied into a short list (Fantasy, Romance, Mystery & thriller, and so on). Filter by genre on Home, or change a book's genre on its page. |
| **Use a photo instead** | Pick a photo of a barcode or cover rather than using the live camera. Handy on a laptop. |
| **Home** | The library count, the book she's reading now (with progress), then every book on glass shelves of three, with search, sort and Reading / Want to read / Finished filters. Scanning a book twice won't add a duplicate. |
| **Stats** | Books finished, pages read, average rating and more. |
| **Feedback** | A message box that emails the app's maker directly (through FormSubmit, as the app has no server). |
| **Book page** | Large cover, blurb, Want to read / Reading / Finished, page progress, 5-star rating and a written review. Reviews save automatically if she closes the book without tapping Save. |
| **Back up / Restore** | On the Profile tab: saves the whole library, reviews included, to a file, and loads it back in. Use it before switching phones. |
| **Offline** | Once opened, the app and the covers she's already seen keep working without signal. Looking up new books needs internet. |

## Putting it on her phone

The camera only works on a secure (`https://`) address, so the app needs to be hosted somewhere. Any static host works because there's no build step. The files in this repo are the whole app.

**GitHub Pages** (free for public repos; private repos need a paid GitHub plan):

1. On GitHub, open **Settings → Pages**.
2. Under *Build and deployment*, pick **Deploy from a branch**, choose `main` and `/ (root)`, then save.
3. After a minute the site appears at `https://<your-username>.github.io/BB-s-Books/`.

**Netlify or Cloudflare Pages** also work if you'd rather keep the repo private. Point them at this repo and leave the build command empty.

Then on her phone:

- **iPhone:** open the link in **Safari**, tap **Share → Add to Home Screen**.
- **Android:** open the link in **Chrome**, tap **⋮ → Install app** (or *Add to Home screen*).

Open it from the home-screen icon and allow camera access when asked.

> **Good to know:** the library lives in the phone's browser storage. Deleting the app or clearing Safari/Chrome website data deletes the library too, so back it up from the Profile tab now and then.

## Feedback emails

Feedback is sent by [FormSubmit](https://formsubmit.co), a free form-to-email service, to the address in `FEEDBACK_TO` at the top of `js/app.js`. The **first** message sends an activation email to that address: click **Activate Form** in it, and every message after that arrives directly. FormSubmit's activation email also gives a random alias you can use in place of the email address, so the address doesn't sit in this public repo.

## Trying it out

Add `?demo` to the address (for example `https://brake2turn.github.io/BB-s-Books/?demo`) to open a separate sample shelf of 14 books. Ratings, reviews and scans there never touch the real library.

## Testing on a laptop

Open the same link in Chrome, Edge or Safari on your laptop. Everything works there too. Laptop webcams often can't focus on a barcode, so use **Use a photo** in the scanner and pick a photo of a barcode or cover (a phone snap you've sent yourself works fine). With no webcam at all, the photo option still works.

The laptop keeps its **own separate library**, so testing there won't put books on her phone. To copy her real library over, use **Profile → Back up library** on her phone and **Profile → Restore from backup** on the laptop.

## Running it locally

```sh
npx http-server -p 8080 .
# then open http://localhost:8080
```

(`localhost` counts as secure, so the camera works on a laptop webcam.)

## Project layout

```
index.html            page structure
styles.css            design tokens and all styling
fonts/                Fraunces and Nunito Sans, self-hosted
design/               snapshot of the style guide (brand book, tokens, component specs)
js/app.js             Home, Stats, Feedback and Profile screens, book page, backup
js/scan-flow.js       scan screen, result sheet, search, add-to-shelf motion
js/scanner.js         camera, barcode reading, cover text recognition
js/lookup.js          Google Books / Open Library lookups
js/covers.js          edition cover search, cover tiles and placeholders
js/genres.js          turns database categories into a short genre list
js/icons.js           line icons
js/demo.js            sample shelf for ?demo
js/db.js              on-device storage (IndexedDB)
sw.js                 offline support
vendor/               bundled libraries: ZXing (barcodes), Tesseract.js (cover text)
```

Barcode reading uses the phone's built-in detector when it has one (Android Chrome) and falls back to the bundled ZXing library (iPhone). Cover reading uses Tesseract.js running entirely on the device. About 7 MB of its files download the first time she scans a cover, then they're cached.

## Design

The look comes from the BB's Books design system: sorbet colour washes behind frosted glass, a white top zone, one cobalt accent, Fraunces and Nunito Sans. A copy lives in `design/`, and the live guide is at https://claude.ai/artifact/E2SRwHZcNvsaeYF65ApfRD. `CLAUDE.md` asks every future UI change to follow it, and `DESIGN_DECISIONS.md` covers what the guide leaves open.
