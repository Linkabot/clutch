# Clutch

Clutch is an offline-first, gamified UK learner-driver companion, built as an installable home-screen web app (PWA) for iPhone. It covers theory, road signs, the Highway Code, hazard perception, learning to drive and "My Car" — built for Lincoln first, shareable later.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173/clutch/
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm test          # unit tests (Vitest)
npm run e2e       # build + e2e tests (Playwright, WebKit, iPhone profile)
```

Live at https://linkabot.github.io/clutch/. See `docs/IPHONE-SETUP.md` for
installing the app on an iPhone.

## Licence and attribution

The code is under the MIT License (`LICENSE`). gov.uk content — the Highway Code, the National Standard, and the Know Your Traffic Signs pictures and captions — is used under the Open Government Licence v3.0, not the MIT License. The OGL does not cover the third-party emblems in three sign pictures (National Trust, English Heritage, England). `public/ATTRIBUTION.md` lists every source and those exceptions. See `docs/CONTENT-GUIDE.md` and `docs/DECISIONS.md` for the full rules on sources and attribution.
