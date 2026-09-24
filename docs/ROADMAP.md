# Roadmap

Status lines below are the resume point for a fresh session.

## Phase 0 — Foundation & iPhone pipeline

Goal: an installable, offline-capable empty app on the user's iPhone, with CI, deploy and all documentation skeletons in place.
Status: done

## Phase 1 — Content engine & The Highway Code offline

Goal: the source of truth on the phone before any question is written.
Status: done

## Phase 2 — Road signs & first games

Goal: the first playable slice.
Status: done (phone test passed, 18 September 2026)

## Phase 2b — UX foundations

Goal: Fix the three Phase 2 phone-test defects, then give Clutch a consistent design system, shell and screens (header band, Learn, Highway Code, Today, Me, sign pages, Decoder) and a shared question screen and end screen for the three games, exactly as Lincoln decided in `decisions.md`, so Phase 3 builds on solid foundations.
Status: built; phone test pending.

Phone test (on the installed app, at the end of the block):

1. Links: on Me, "Open Government Licence v3.0" is blue and underlined; on a rule page, "View on GOV.UK (online)" is too.
2. No text selection: pressing and holding a tab, a button, a game tile or a sign tile selects no text and shows no callout; rule text can still be selected.
3. Match Pairs: all ten tiles fit without scrolling, each sign sits level with a name in its row, no caption is cut off.
4. Header band: Journey, Learn, Practice and Me show their name large and centred in the band beside CLUTCH, with no second title below; inner pages (a sign page, the Highway Code) show Back and CLUTCH in the band and a big title under it with space above and below.
5. Tab bar: four tabs — Journey, Learn, Practice, Me — evenly spaced; no My Car.
6. Learn: no Search card; the three cards are full width with equal gaps; the Traffic signs pictures and the How signs work shapes are the same size and spacing; "Lessons — later phase" is a muted line.
7. Highway Code: a "Search the Highway Code" box at the top; tabs "Rules | Signs & signals | Annexes"; pick Annexes, open one, go Back — Annexes is still chosen; rule badges don't wrap; summaries end on a whole word with "…"; rule 126 shows "Rule 126 · Braking"; an advice rule's chip reads "Advice · not the law".
8. No full stops: sign names on tiles, the sign page title and in the games have no trailing full stop (e.g. "Crossroads").
9. Collecting line: a sign not yet collected says "Get it right 3 times to collect it", and after one right answer "Get it right 2 more times to collect it"; COLLECTED shows at 3.
10. Memory tip: most sign pages show a "Memory tip" row (176 of the 195); the Castle sign's page (Direction family) shows none.
11. Decoder: on opening, "Tap the sign to change its shape" and "Tap to change colour" show; they vanish after the first tap and come back when the Decoder is reopened; a pair that isn't used (e.g. blue triangle) shows a dashed outline, "Blue triangles aren't used" and "UK signs don't use this pair."; with VoiceOver on, the colour chip reads "Change colour, Red" (or the current colour).
12. STOP and GIVE WAY: in the games these read "Stop and give way" and "Give way to traffic on major road"; when Tap the sign asks for one of them, it offers just those two signs.
13. Look-alike answers: wrong answers in Tap the sign and Sign Sprint mostly look like the answer (same shape and colours); pictures fill their tiles and direction signs are readable. (The green tick on a right answer slightly overlaps its picture — say if that bothers you.)
14. VoiceOver note: with VoiceOver on, opening Tap the sign, Sign Sprint and Match Pairs each says once "This game is visual. The sign pages have every sign's name and meaning."
15. Score colours: end screens are red, orange or green by score (Tap 0–5, 6–8, 9–10; Pairs 0–2, 3–4, 5; Sprint per minute 0–5, 6–8, 9+); a Sprint round with 0 right and at least one wrong answer shows no "+0 XP", no pop, and the line "No signs named this time — have a look at the ones below."
16. Sprint start page: one title, "Sign Sprint", centred at the top with ✕ on the left; the best for the chosen length (e.g. "Best at 1 min") and the last round with a coloured dot and its length; "Which signs" chips with a count (e.g. "131 signs in this sprint"); lengths 30 sec / 1 min / 5 min / No limit (choosing No limit shows "No limit: play until you stop."); a big yellow Start within thumb reach; it reopens on the last choices; Done returns to it; during play the picture and all four answers are visible without scrolling; a No limit round has a Finish button that shows the results.
17. Round endings: Tap the sign and Match Pairs end like Sign Sprint (score panel, XP, streak, "Collected!" when a sign reaches 3, "Signs to look at again" / "Took more than one try"); opening a row's sign page and going Back returns to the same end screen.
18. Practise signs like this: the sign page button "Practise signs like this" starts a Tap the sign round of that sign's family.
19. Losing a sign: answer a collected sign wrong 3 times in a row (in Tap the sign or Sign Sprint): the end screen says "You lost <sign> — 3 wrong in a row" with its picture and a "Practise signs like this" button, and its sign page is back to "Get it right 3 times to collect it".
20. Close and Done: a game opened from a sign page, Today or Practice returns there on ✕ or Done (Sprint's Done goes to its start page).
21. Quiz sheet Sign page: in Tap the sign, "Sign page" then Back returns to the same question with the sheet open.
22. Today: Journey shows the streak and XP card, a white "Start here" card with a yellow outline that names a game (on a new install, "Play Tap the sign – 10 questions"), a Traffic signs card with "N of 195 collected", and "Your journey map arrives in Phase 4"; opening the app never shows 0 for a moment before your real numbers.
23. Me: three groups — Progress, Settings, About; tap Attribution: it opens in place and reads as formatted text (no # marks), with no sideways scrolling; in Safari an "Add to Home Screen" row opens the instructions and "Not now" returns to Me, and in the installed app the row is gone; a sign page's "Open Government Licence v3.0" is a link.
24. Signs grid and feel: long sign names show up to three lines; tiles and buttons darken while pressed; family chips are easy to hit.

## Phase 3 — Theory core

Goal: the whole theory course and realistic mock tests.
Status: not started

## Phase 4 — Journey & the full game

Goal: turn the content into a game — a Journey map, levels, badges and a readiness score that shows how close you are to test-ready.
Status: not started

## Phase 5 — Learning to drive & My Car

Goal: cover the practical side of driving — car control, manoeuvres and modern car features — tailored to the car you actually drive.
Status: not started

## Phase 6 — Hazard perception trainer

Goal: an original hazard perception trainer with DVSA-style scoring, since the official clips cannot be reused.
Status: not started

## Phase 7 — Polish, accessibility & seams

Goal: make it accessible, fast and ready to share, plus the seams for App Store packaging and other regions later.
Status: not started
