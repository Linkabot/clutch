# Decisions

Locked 10 Sep 2026. Copied verbatim from the "Decisions locked" table in
`handoffs/master-plan/plan.md`. Do not edit without updating that table too.

## 1. Delivery

Choice: Home-screen web app (PWA). Capacitor wrap + cloud Mac build + Apple Developer account later, as an optional Phase 7 item.
Why: Only route buildable from this Windows PC; free; no Apple account; wrapping later is packaging, not a rewrite.

## 2. Name

Choice: Clutch
Why: User's pick. Folder `projects/clutch`.

## 3. Content sources

Choice: Highway Code, Know Your Traffic Signs, show-me/tell-me, National Standard for Driving, test-format facts: all from gov.uk under the Open Government Licence v3, with attribution shipped in-app. Sign images from gov.uk or Wikimedia Commons, licence checked per file. Everything else original.
Why: Legal to reuse and to distribute later.

## 4. Not used

Choice: Official DVSA revision question bank, official hazard perception clips, _Driving – The Essential Skills_, any YouTube/video download, any other app's questions.
Why: Commercially licensed / copyrighted / against YouTube terms. Links out to videos are allowed as an online extra only.

## 5. No video

Choice: Interactive animations, simulators and mini-games replace video everywhere, including hazard perception.
Why: User preference; offline-friendly; original.

## 6. Source of truth first

Choice: The Highway Code is ingested in Phase 1, before any question is written. Every question, sign and lesson cites rule numbers that must resolve against the ingested text.
Why: Makes correctness and coverage mechanical.

## 7. Coverage guarantee

Choice: DVSA bases theory questions on three books (Highway Code, Know Your Traffic Signs, Driving – The Essential Skills). We carry the first two; for the third we write to its public syllabus, the National Standard for Driving Cars. A coverage test fails the build if any of the 14 DVSA topics, or any syllabus learning point, has fewer than the minimum number of questions.
Why: Parity with the official app's scope, proven by a test rather than assumed.

## 8. Audience

Choice: Lincoln first, other people later: clean licensing only, attribution in-app, no personal data collected, no analytics, distribution-ready code.
Why: User's stated intent for everything they build.

## 9. Models

Choice: Primary (orchestrator) = Opus 5. Planner = Opus 5 (set globally in PRIMARY.md § Model tiering, 15 Sep 2026). Executor = Sonnet; Opus 5 for interactive/animation/game components (override). Scout = Haiku, except a web-research lane whose findings decide a sourcing or licensing question: that lane runs on Sonnet and answers with counts printed by a script it ran, never by reading pages (PRIMARY.md § Model tiering, 16 Sep 2026). Reviewer = Sonnet. From 15 Sep 2026, Fable 5.1 is a specialist tier chosen by Primary and used sparingly: for sub-tasks where a miss is expensive and no mechanical check can prove the work right (security or licensing reviews, work only a human can judge later, a step that already failed its retries on Opus 5), within the weekly pool it shares with every other model, of which at most half may go to Fable (PRIMARY.md § Model tiering, 16 Sep 2026); never for plans. The planner ran on Fable 5.1 until 14 Sep 2026.
Why: User's instructions. 14 Sep 2026: no Fable credits, so Opus 5 was the highest model. 15 Sep 2026: Fable 5.1 is on the subscription again; Opus 5 stays Primary, and Primary picks Fable with judgement rather than behind a hard guard. 16 Sep 2026: Phase 2's two Haiku web-research scouts got every decisive sourcing fact wrong (among them, that Know Your Traffic Signs was PDF-only), and correcting them cost Primary about 1,200 live requests (Phase 2 suggestion PS2). The general tiers live in PRIMARY.md § Model tiering; this entry records Clutch's overrides.

## 10. Hosting

Choice: Public GitHub repository + GitHub Pages.
Why: Free, automatic deploys. Content is original/OGL so public is fine. A private repo would need a different free host (Cloudflare Pages/Netlify).

## 11. Scope fences

Choice: UK (GB) rules only, with England/Scotland/Wales differences stated in content. English only. No accounts, no cloud sync. Other countries: a `region` field on the content pack, nothing more.
Why: Keep the build focused; don't add structure speculatively.

## 12. Hazard perception

Choice: Original animated scenes with defined hazard windows, scored like DVSA (5→0, anti-pattern rule = 0). App tells the user to also do official clips in the final week.
Why: Honest substitute.

## Decision 13 — Look and feel (13 September 2026)

Choice: Signage base with Playmat pictures and animations layered in; Playmat alone kept as a future alternative; Dashboard not chosen.
Why: UK road-sign vocabulary doubles as revision and reads as trustworthy; Playmat adds fun.
Constraint: Fonts must be self-hosted, bundled and precached — no Google Fonts at runtime.
Brand safety: No GDS Transport typeface, no crown/Royal Arms, no gov.uk page styling; a visible "Not an official DVSA or government app" line is shown in-app.
Scope: The Journey map, quiz sheet, confetti, XP and the animated stopping-distance road are references for Phases 2–4 only; none of them are built in Phase 1.
Reference: See `docs/DESIGN.md` for the token and component reference.

## Decision 14 — Road signs and games (15 September 2026)

Choice: Sign pictures and captions come from Know Your Traffic Signs
(KYTS), DfT's GOV.UK publication, fetched and shipped byte-for-byte under
the Open Government Licence v3.0. The committed set is 195 signs across 6
families (warning, orders, motorway, direction, information, road-works),
including STOP and GIVE WAY, each linking into the Highway Code. Shape and
colour follow the KYTS "signing system" sentences (`content/uk/signs/shape-rules.json`),
with 16 memory hooks (`content/uk/signs/hooks.json`) covering the
shape/colour rules, each family, and a handful of easily confused signs.
Four interactives teach and test the set: Tap the sign (10 questions, no
timer, on the shared quiz sheet), Sign Sprint (a 60-second clock, 4 names
per turn, best score and missed signs saved), Match Pairs (5 pairs per
round, first-try matches count) and the Shape & Colour Decoder
(build-a-sign, quoting the signing-system sentences verbatim). Sign Sprint
and Match Pairs use only captions of 60 characters or fewer, so every name
fits a four-option grid or a 104px tile; Tap the sign uses every sign, so
every sign stays collectable.
Why: KYTS is DfT's own sign reference (one of the three books DVSA bases theory questions on), Crown-copyright and OGL
licensed, so it is legal to reuse and distribute (the OGL does not cover
the third-party emblems in three pictures, see Decision 15), and it
doubles as revision the same way the Highway Code does. Shipping the real
pictures (never resized, re-encoded, recoloured or edited) rather than
redrawing them keeps the sign set trustworthy.
Constraint: The whole app's Workbox precache budget rose to 8192 KiB to
carry the sign pictures; no individual sign SVG may exceed 150 KiB, and
KYTS SVGs are content-scanned for unsafe markup before they are shipped.
Progress: +10 XP per correct answer or first-try pair; XP never goes down
and there are no levels yet. A local-midnight day streak is saved across
sessions; a missed day resets it. A sign is collected after 3 correct
identifications of it in any game, on any day; uncollected signs show a
0–3 progress dots.

## Decision 15 — Third-party emblems in sign pictures (17 September 2026)

Choice: Keep the three Know Your Traffic Signs pictures that show a
third party's emblem (`direction/national-trust.svg`,
`direction/english-heritage.svg`, `direction/england.svg`) and label
them. `content/uk/signs/selection.json` lists them in `thirdPartyMarks`;
`npm run ingest:signs` marks each `"thirdPartyMark": true` in
`signs.json` and both attribution manifests and copies gov.uk's
third-party sentence into `signs.json`'s licence block;
`npm run verify:signs` fails unless exactly these three are marked;
each one's sign page shows a notice under the attribution line; and
`public/ATTRIBUTION.md` names them.
Why: The Open Government Licence does not cover trade marks or
third-party rights the publisher is not authorised to license, and
the licence scan reads page text, so it cannot see an
emblem inside a picture. The pictures are road-sign symbols reproduced
unaltered from a government publication in a free learning app, so
labelling them keeps every tourist sign without implying the emblems
are Crown material. Dropping them (195 signs down to 192) was the
fallback.
