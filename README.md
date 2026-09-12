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

See `docs/IPHONE-SETUP.md` for installing the app on an iPhone.

## Licence and attribution

Content sourced from gov.uk is used under the Open Government Licence v3.0; see `docs/CONTENT-GUIDE.md` and `docs/DECISIONS.md` for the full rules on sources and attribution.
