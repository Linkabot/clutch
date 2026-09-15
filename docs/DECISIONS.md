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

Choice: Primary (orchestrator) = Opus 5. Planner = Opus 5 (set globally in PRIMARY.md § Model tiering, 15 Sep 2026). Executor = Sonnet; Opus 5 for interactive/animation/game components (override). Scout = Haiku. Reviewer = Sonnet. From 15 Sep 2026, Fable 5.1 is a specialist tier chosen by Primary and used sparingly: for sub-tasks where a miss is expensive and no mechanical check can prove the work right (security or licensing reviews, work only a human can judge later, a step that already failed its retries on Opus 5), within Fable's own weekly allowance; never for plans. The planner ran on Fable 5.1 until 14 Sep 2026.
Why: User's instructions. 14 Sep 2026: no Fable credits, so Opus 5 was the highest model. 15 Sep 2026: Fable 5.1 is on the subscription again; Opus 5 stays Primary, and Primary picks Fable with judgement rather than behind a hard guard. The general tiers live in PRIMARY.md § Model tiering; this entry records Clutch's overrides.

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
Reference: See `docs/DESIGN.md` (Step 4) for the token and component reference.
