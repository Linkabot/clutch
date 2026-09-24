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
identifications of it in any game, on any day; uncollected signs show
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

## Decision 16 — Code licence (18 September 2026)

Choice: The code is MIT (`LICENSE`); it covers the code only. gov.uk
content stays Crown copyright under the Open Government Licence v3.0,
the three emblems excepted (Decision 15); `public/ATTRIBUTION.md`
remains the record of sources.
Why: MIT was chosen as short and permissive, and because a public
repo with no licence reads as all rights reserved.

## Decision 17 — The shell, four tabs and Today (24 September 2026)

Choice: On the four tab roots (Journey, Learn, Practice, Me) the tab's
own name is the page's one `<h1>`, shown large and centred in the
header band beside the CLUTCH wordmark, with no second title in the
content below; inner pages (a sign page, a Highway Code section) keep
today's band (back button plus CLUTCH) and add their own large heading
underneath it, with real spacing above and below. The tab bar shows
four tabs, evenly spaced — Journey, Learn, Practice, Me; My Car is
hidden, and `/my-car` and any unrecognised path redirect to `/` rather
than 404ing. Journey is now "Today": the streak and XP pills, a
"Start here" card suggesting what to do next (Tap the sign while
nothing is collected yet, else whichever game was least recently
played), a Traffic signs card ("N of 195 collected"), and a muted line
"Your journey map arrives in Phase 4" — with no separate heading of
its own, since the band already carries the page's one title. Today
and Me both render their whole layout from first paint but stay
invisible until the progress store's numbers and the sign catalogue
have both settled, so nothing flashes or moves on a cold open.
Why: A single, consistent title per screen reads calmer than a
repeated one; hiding My Car until Phase 5 keeps the tab bar honest
about what is actually built; Today gives Journey a reason to open
first without promising the map before Phase 4 draws it.
Reference: handoffs/ux-foundations/decisions.md, Q1, Q16, Q17.

## Decision 18 — Sign names, Memory tips and the Decoder (24 September 2026)

Choice: A sign's trailing full stop is trimmed at display time only
(`displayName()`); `signs.json` itself stays verbatim. In the games,
STOP and GIVE WAY are named by the Highway Code's own wording —
"Stop and give way" and "Give way to traffic on major road"
(`gameName()`) — and when either is the answer, Tap the sign asks a
two-sign question naming just those two look-alikes; the sign page
keeps the KYTS name throughout. Decision 10 is reopened: a sign's
"Memory tip" row resolves the sign's own hook first, then its rule's
hook, then its family's hook, and shows nothing for the 19 C9
direction signs, which have none of their own — 176 of 195 signs show
a tip, on the sign page and the quiz sheet alike (the quiz sheet's own
tip stays unlabelled; the sign page's row is labelled "Memory tip").
Decision 22 (2B) is corrected: its DecoderB artboard DOES show how a
learner chooses a shape or colour, via a swatch row — tap-to-cycle
still stands underneath it, and two hint callouts
("Tap the sign to change its shape", "Tap to change colour") show
every time the Decoder is opened and disappear after that visit's
first change, with no persisted flag. A shape/colour pair UK signs
don't use (e.g. blue triangle) draws as a dashed, unfilled outline
under the heading "<Colour> <shape>s aren't used" and the line
"UK signs don't use this pair.", with its exceptions paragraph hidden.
Why: The Highway Code's own wording for STOP and GIVE WAY avoids
repeating KYTS's long instruction text as a game answer; resolving a
tip own → rule → family, rather than showing none whenever a sign
lacks its own, keeps almost every sign page useful for revision; the
Decoder's per-visit hints teach the controls once without nagging a
returning learner.
Reference: handoffs/ux-foundations/decisions.md, Q2, Q4, Q5, Q6, Q7.

## Decision 19 — How the games ask, end and leave (24 September 2026)

Choice: In Tap the sign and Sign Sprint, a wrong-answer candidate list
is built from every other sign whose name differs from the answer's
and from each other's (not limited to the answer's family, since the
tiers below apply the family preference themselves); it then prefers
same-family look-alikes of the same shape and colours, then
other-family look-alikes of the same shape and colours, then falls
back to the rest of the answer's family — signs with no clear shape
(`other`, 71 signs, including STOP and GIVE WAY) keep the plain
family-only pick. Tap the sign and Match Pairs now end on the same
shared `EndScreen` Sign Sprint always used: a score panel filled by
the round's band (red, orange or green, from `src/engine/score-band.ts`'s
`scoreBand()`/`sprintBandMax()` — 0.9 or higher of the maximum is
green, 0.6 or higher is orange, else red; Sign Sprint's own maxima
scale with its length at 10 a minute, and a No limit round is judged
against what it actually answered), XP, a Best chip, the streak, a
"Collected!" line, one lost-sign notice per a Decision 20 loss, an
optional gentle zero line, and a list of signs to look at again. A
game's ✕ and its end screen's Done return to the in-app screen the
game was opened from — a sign page, Today, Practice, or another end
screen's sign row — through `useExitGame()`, which asks
`src/app/back.ts`'s own rule, else falling back to Practice; Sign
Sprint's Done instead returns to its own start page. Opening a row's
sign page from an end screen and going Back shows that same end
screen again, because `src/engine/round-memory.ts` remembers each
game's last finished round in memory. When a picture game opens,
VoiceOver hears once:
"This game is visual. The sign pages have every sign's name and meaning."
Why: Distractors that really look like the answer, drawn from the
whole catalogue rather than one family, make the games harder to
guess and more useful for revision; one shared ending keeps every
game's feedback consistent; returning a learner to where they started
(not always Practice) keeps a game feeling like an aside rather than a
detour.
Reference: handoffs/ux-foundations/decisions.md, Q8, Q9, Q14, Q18, Q19.

## Decision 20 — Collecting and losing a sign (24 September 2026)

Choice: An uncollected sign's page counts down
"Get it right 3 times to collect it",
"Get it right 2 more times to collect it",
"Get it right 1 more time to collect it", then shows COLLECTED at 3. A
collected sign answered wrong 3 times in a row loses its collection
(its correct count resets to 0, so re-collecting takes 3 right answers
again): "wrong" means the sign was the question's answer and the
learner picked another one, in Tap the sign or Sign Sprint only —
Match Pairs' mismatches never count, since a bad pairing doesn't say
which sign was misread; any right answer on the sign resets the count
to 0 first; the loss is never interrupted mid-round — it is told on
that round's own end screen, "You lost <sign> — 3 wrong in a row",
with the sign's picture and a "Practise signs like this" button; the
count itself lives on the sign's `signProgress` row as a new
`wrongInARow` field, read as 0 on a row written before this block.
Why: A countdown line is more encouraging than a fixed fraction; not
showing the wrong-in-a-row counter keeps the games from feeling
punitive turn to turn, while still making forgetting a sign cost
something and giving a direct way back to practising it.
Reference: handoffs/ux-foundations/decisions.md, Q3, Q12.

## Decision 21 — Sign Sprint's start page, lengths and Finish (24 September 2026)

Choice: Opening Sign Sprint shows a start page (`SprintStart.tsx`)
before any question: one title, "Sign Sprint", centred in the top bar
with ✕ on the left; a score card whose kicker reads "Best at
<length>" for the length currently chosen below, over that length's
best score (with a 60-second `Roundel` at the card's corner) and, when
one exists, a "Last round" row with a coloured dot and its own length;
a streak pill; a "Which signs" row of family chips (All, or one or
more of the six families) with a live "<n> signs in this sprint"
count; a Length control (30 sec / 1 min / 5 min / No limit, with
"No limit: play until you stop." shown only while No limit is chosen);
and a full-width yellow Start at the bottom. The page always reopens on
the learner's last-used choices, and the end screen's Done returns
here (not to Practice). During a No limit round, a Finish button
stands in the top bar where the clock sits on timed rounds: tapping it
after at least one answer shows the end screen; before any answer it
returns to the start page instead. ✕ always leaves through
`useExitGame()` with no ending shown, on a No limit round exactly as
on a timed one. XP weighting and an in-round streak bonus are deferred
to Phase 4, designed together with levels.
Why: Putting the bests, the filter and the length together, defaulted
to last time, gets a learner playing again in one tap; a dedicated
Finish button (Lincoln's choice) makes ending an open-ended round a
deliberate action rather than overloading ✕ with two meanings.
Reference: handoffs/ux-foundations/decisions.md, Q10, Q11; plan.md P12.

## Decision 22 — The Highway Code hub (24 September 2026)

Choice: `/learn/code` is a hub: a "Search the Highway Code" box at the
top (search left the Learn tab), and a three-tab `SegmentedControl` —
"Rules | Signs & signals | Annexes" — kept in the URL (`?tab=`) so Back
returns to the tab last chosen; the Introduction section sits with
Rules; rule badges no longer wrap. A rule page's context line
("Rule 126 · Braking") is built by `src/features/code/interlude.ts`'s
`ruleContextHeading`, which replaces the plan's original "nearest
interlude's last line" rule: among the section's interludes at or
before the rule's own position, it takes the nearest one (ties toward
the last), then that interlude's own last bare line of text
(1–80 characters); for the 48 rules that come before their section's
first interlude (e.g. rules 1–6, 103–106), it falls back to the
section's own preamble's last bare line instead. Highway Code sections
of kind `other` sit under the Annexes tab.
Why: Splitting the page into tabs and moving search out of Learn puts
each kind of content in one obvious place; falling back to the
preamble keeps every rule's context line meaningful even before a
section's first interlude.
Reference: handoffs/ux-foundations/decisions.md, Q15; plan.md
amendment E6.

## Decision 23 — Small copy and rules chosen under the autonomy grant (24 September 2026)

Choice: The strings below are as they exist in `src/` today (never the
six the original brief misquoted, corrected in plan.md amendment
E27 (b)): `Loading…`; "This didn't load." with a `Retry` button;
"Get it right 1 more time to collect it"; Match Pairs' end screen
splits its old combined sentence into the number of pairs matched
right first time, the words "right first time", and the sub-line
"<n> pairs matched"; Sign Sprint's zero line, shown only when the
round scored 0 with at least one wrong answer, is
"No signs named this time — have a look at the ones below."; the
Sprint start page's own labels "Best at <length>", "Last round",
"Which signs" and "<n> signs in this sprint"; the rule context line
and the `other` sections under Annexes recorded in Decision 22; and a
No limit Sign Sprint round ending with Finish, never ✕ (Decision 21).
Why: Recording the strings as built, cited against `src/`, keeps this
document from drifting the way the original brief did — six of its
quoted strings had already been superseded by the time Step 12 ran.
Reference: handoffs/ux-foundations/decisions.md § "Taken under the
autonomy grant"; `facts-12-strings.out`.

## Decision 24 — What Phase 2b leaves open (24 September 2026)

Choice: Six items from the September UX review stay open, deferred to
Phase 3, because fixing them now would have widened this block past
its intended size: M01's branding half (the Add to Home Screen panel
is rebuilt from the shared primitives but not yet given the app's own
plate chrome); M08's `htmlToText` join fix (Step 4 shipped the
word-boundary truncation; the join fix that collapses the space just
inside a quote or bracket did not); M15's timestamp, file-path and
test-date extras (not added to the rendered attribution); M42's
All/Collected toggle halves (only the family chips were widened to a
44px tap target; the toggle's own two halves are still 36px); M32's
caption residue (101 of 195 sign captions are still clamped); and
M34's sign-page picture box (still 124px tall, unlike the enlarged
tile pictures the browser and the games got). Also recorded as open:
M40's shell half — the app header and the tab bar are never made
`inert` while a game's full-screen layer is mounted, only the question
region inside a game goes `inert` while its own quiz sheet is open;
M06, the 14 DVSA theory-test topic names and `content/uk/topics.json`,
moved to Phase 3's own sourcing decision, because no Open Government
Licence source names them (46 GOV.UK pages checked by script); and,
from `suggestions.md`, U9 (Tap the sign and Match Pairs still run
their end-of-round write unguarded, so a ✕ pressed while the last
write is in flight can show a stale ending — only Sign Sprint was
guarded, in Step 10) and U10 (Practice and Learn still flash a zero or
placeholder value on a cold open; only Today and Me got the
pending/settled gate).
Why: Phase 2b was scoped at about Phase 0's size; writing these six
down, rather than folding them in quietly, means Phase 3 picks them up
by decision, not by accident.
Reference: handoffs/ux-foundations/decisions.md; plan.md amendments
E14 (g), E19 (f), P12; `suggestions.md` U9, U10.
Update, 24 September 2026 (U9 closed): Tap the sign now has the same
`mountedRef` guard as Sign Sprint. Its `finish` returns at once if
the screen has unmounted, so a last write that settles after ✕ no
longer navigates back to the game or remembers the round;
`tests/unit/tap-the-sign.test.tsx` proves it and fails against the
old screen. Match Pairs never had the gap: its write continuation
only sets state, and its `rememberRound` and `navigate` run from an
effect gated on `showEnd`, which cannot run after unmount. A guard
test in `tests/unit/match-pairs.test.tsx` pins that.
