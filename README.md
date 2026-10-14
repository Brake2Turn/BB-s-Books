# BB's Books

A little online library for BB's books. Scan a book's barcode or its front cover and it goes straight onto the shelf. Tap a cover to open it full size, read the blurb, give it a rating out of five and write a review.

It's a web app you install on a phone's home screen. There's no app store, no account and no server. The library is saved on the phone itself.

## How it works

| | |
|---|---|
| **Barcode scan** | Point the camera at the ISBN barcode on the back. The book is looked up on Google Books and Open Library to get its cover and blurb. |
| **Cover scan** | Take a photo of the front cover. The app reads the title and author off the cover on the phone itself, searches for them, and asks "Which book is it?" so she can pick the right edition. If no picture of the cover exists online, her photo becomes the cover. |
| **The big reveal** | A mystery book whizzes onto the screen spinning, wobbles to a stop, then flips over in a burst of stars to show the cover. She chooses **Add to my library** (the book drops onto its spot on the shelf with a bounce and a puff of dust) or **Not this one** (it gets flung away). |
| **Use a photo instead** | Below the camera there's an option to pick a photo of a barcode or cover rather than using the live camera. Handy on a laptop. |
| **Library** | All her covers on one shelf. Search by title or author, and sort by newest, title, author or rating. Scanning the same book twice won't add a duplicate. |
| **Book page** | The cover opens full size, with the blurb, a 5-star rating (tap a star again to clear it) and a written review. Reviews save automatically if she closes the book without tapping Save. |
| **Back up / Restore** | The ⋮ menu saves the whole library, reviews included, to a file, and can load it back in. Use it before switching phones. |
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

> **Good to know:** the library lives in the phone's browser storage. Deleting the app or clearing Safari/Chrome website data deletes the library too, so back it up from the ⋮ menu now and then.

## Testing on a laptop

Open the same link in Chrome, Edge or Safari on your laptop. Everything works there too. Laptop webcams often can't focus on a barcode, so use **"or use a photo instead"** in the scanner and pick a photo of a barcode or cover (a phone snap you've sent yourself works fine). With no webcam at all, the photo option still works.

The laptop keeps its **own separate library**, so testing there won't put books on her phone. To copy her real library over, use **⋮ → Back up library** on her phone and **⋮ → Restore from backup** on the laptop.

## Running it locally

```sh
npx http-server -p 8080 .
# then open http://localhost:8080
```

(`localhost` counts as secure, so the camera works on a laptop webcam.)

## Project layout

```
index.html            page structure
styles.css            all styling (light and dark mode)
js/app.js             library, scanner screens, book page, backup
js/reveal.js          found-a-book animations (whizz, flip, plop)
js/scanner.js         camera, barcode reading, cover text recognition
js/lookup.js          Google Books / Open Library lookups
js/db.js              on-device storage (IndexedDB)
sw.js                 offline support
vendor/               bundled libraries: ZXing (barcodes), Tesseract.js (cover text)
```

Barcode reading uses the phone's built-in detector when it has one (Android Chrome) and falls back to the bundled ZXing library (iPhone). Cover reading uses Tesseract.js running entirely on the device. About 7 MB of its files download the first time she scans a cover, then they're cached.
