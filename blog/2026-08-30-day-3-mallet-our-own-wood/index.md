---
slug: day-3-mallet-our-own-wood
title: "Day 3: A Mallet from Our Own Wood"
authors: [dmitry]
tags: [cpp, testing, cmake, ci, gba, md, platforms]
date: 2026-08-30
description: >
  The third day of the Builder's chronicle. The traded mallet had no voice
  on the tightest land, so I carved my own for every far land at once. By
  the end of the cycle the first far totem answered for real.
image: /img/blog/2026-08-30-1.webp
vibe: carver
---

ToyGine2 is a game engine for retro consoles, from the Mega Drive and the Game Boy Advance to Windows, macOS and Linux. By the start of this cycle the charms stood and answered on three level lands, and on the far ones nobody had even carved them.

<!-- truncate -->

## What happened

I ended the last cycle on a question I had no answer to: how do you guard the yards the patrol never reaches. This one I spent carving a mallet from our own wood. The traded one, bartered from an allied tribe, had a voice everywhere except the tightest land, so I made mine for every far land at once, nine passes, the charms going in ahead of the rite each time. By the end of the cycle the first far totem answered for real: the Game Boy Advance firmware now knows on its own whether it stands on the land or in the reflection, and its verdict reaches the beacon. A tablet has been carved and carried into the house of knowledge. [Here is the shelf it rests on](https://github.com/ToymanInteractive/toygine2/releases/tag/26.18.0).

**Plan for the cycle:**

- Find out whether doctest builds under devkitARM and ClownMDSDK, and decide where an own runner is needed
- Write that runner across nine tasks, TDD throughout, with `Approx` matching doctest bit for bit
- Move the entry point, the output and the screen into per-platform files instead of `#ifdef`
- Run the GBA ROM under mGBA and register the run with CTest

![Evening under a shelter: a carver holds a dark mallet, a pale traded one lies on the mat beside it, eight totems stand along the shore](/img/blog/2026-08-30-1.webp)

## A mallet from our own wood

I started out certain the far lands were too tight for the traded mallet, and set out to measure by how much. The measurement turned the question over. Under devkitARM doctest built and linked into a Game Boy Advance cartridge: 444,912 bytes of `.text` against 256 KB of EWRAM. Under ClownMDSDK it would not build at all. The Mega Drive has no `<signal.h>`, no `<ctime>`, none of the settled house doctest treats as given. The border did not run where I had drawn it: not between level land and far land but between hosted and freestanding, and by that reading my own mallet was needed on one land out of eight.

I made it for all eight anyway, because a mixed set of tools costs more than code of my own. That choice carries one invariant, and the rest of the work went into paying for it: the same charm must answer identically under either mallet. So `Approx` reproduces `doctest::Approx` to the letter, strict inequality `difference < epsilon * (1 + larger)` included, and the default tolerance stayed a single constant for every type, because deriving it from `numeric_limits<T>` would squeeze it for `double` from 1.19e-05 down to 2.22e-14. The mallet turned out to need nine handles as well: the Mega Drive has no `main` at all, `cartridge.ld` declares `ENTRY(_EntryPoint)`, and while the entry point was shared the cartridge linked with `cannot find entry symbol _EntryPoint`: assembled in form, unrunnable in fact. The entry point moved into the file of its own land, and not one `#ifdef` on a platform name remains inside the runner: CMake makes the choice, and the `else ()` branch of that choice is `message(FATAL_ERROR)`.

The settler who takes the engine never sees the mallet. It lives under `tests/` and reaches neither the bundle nor the treaty. One thing changed on the outside: the scrolls stopped lying. `tests/AGENTS.md` had long promised that charms are checked on every land, and now that is true, and true in the way it was found out: the set builds twice, `toygine-units` under the traded mallet and `toygine-units-builtin` under mine. Seven notches and eighteen checks in both hands; change `0xFF` to `0xFE` in one of them and both go red.

![A stone water bowl on a cliff: an island with a totem reflected in it, a hand with a mallet above the water, a thread of light running to the beacon](/img/blog/2026-08-30-2.webp)

## The reflection answers when called

By mid-cycle the totems on the far lands stood, and nobody struck them: every console row of the matrix carried `run_test: "false"`. The bundle with the firmware left for the pier, and whether a single charm inside it was alive nobody knew. I set out to run the charms in the reflection and started by building the bowl itself: I drafted a step that clones mGBA and builds `mgba-rom-test`. Then I looked into my own toolchain image and found `/usr/local/bin/mgba-headless` sitting there.

What remained was teaching the firmware where it stands. It asks out loud: it writes `0xC0DE` to `0x04FFF780` and waits for `0x1DEA`; on hardware that range does not answer. Once it hears back, the firmware behaves differently: the report still gets cut to thirty columns on screen, while the debug log takes it whole, line by line. There is only one firmware: no separate emulator build, or I would be guarding something other than what I ship. The exit had to be laid out in assembly too, `swi 3` with the verdict in `r0` and two branches on `__thumb__`, because libgba's own `Stop()` lists `r0` among its clobbers and wipes the code on the way out.

The "I am in the reflection" flag travels the same seam as the whole report, through the `writerData` the writer receives from outside. I knew the temptation to keep it in a file-level variable by sight: that is exactly the state I had spent three tasks clearing out of the runner. The Mega Drive has a voice of its own kind of funny. It prints into unused VDP register `0x9E`, which emulators show as a console and hardware treats as a harmless `no-op`. From the land all of this shows up as one new line by the gate: where `run_test: "false"` stood, a run now happens and a verdict comes back. The old check at the entrance changed meaning too: `TOYGINE_TARGET_PLATFORM_SUPPORT_CTEST` no longer says "there are tests here" but "the host runs the binary itself." I keep the edge of the image in mind and in a comment: the reflection answers when called and the land stays silent, and what tells them apart from the inside is the rite, not the bowl.

![Five totems in a row on the shore, the second sawn nearly through at the base yet standing straight; a figure raises a mallet over the first](/img/blog/2026-08-30-3.webp)

## A charm that stands and guards nothing

One charm I rewrote four times. It was supposed to prove that every branch of the rite is walked exactly once, and the first three times it proved nothing while burning green. First it leaned on file-level counters. Then on the branch name it read itself. A runner that enters the first branch every single time yields the same number of passes and the same three names, and I learned that not by reasoning but by cutting the base with an `if (index != 0)`. Then it wrote names into a `std::array`, keeping only the last one entered, so a pass that visited both branches looked like a pass that visited only the second. That went green too. Only when each pass began recording a `RunRecord { name, count }` did the second entry stop hiding behind the first.

Hence the rule three evenings paid for: a green run says nothing about a charm's guarding power, only that no calamity happened today. There is one way to ask a charm directly: cut into the thing it guards and see whether it cries out. The table of "which cut, which charm fell" caught me out three times in one cycle. The first cut felled the build rather than a charm: `ninja` kept the previous binary, and the "green" run turned out to be yesterday's. The second broke the list sorting, and the case named "registration order does not survive" passed by luck: its names ran `zulu, mike, alpha`, and always inserting at the head yields exactly that sequence, so a case that denied registration order was reproducing it. The third brought a charm down entirely: an unguarded `head->next()->next()->name()` gave `SIGSEGV`, and on a far land there is nobody to catch the signal. A rule I had written into the plan in advance came apart the same way: the sentry against a direct doctest include turned out to be surplus, because the double build catches that on its own, loudly and locally.

None of this is visible from the land. The settler sees a number: sixty-four charms where seven stood at the start of the cycle. It is a fine number, and it is true exactly as far as each of those charms held up under a cut. About mine I know that not all of them held, and not on the first try.

## The rest of the cycle

Seven far lands got a trial settlement each: the Nintendo DS, 3DS, Switch, GameCube, Wii, Wii U and the Mega Drive took their place beside the Game Boy Advance, and the bundles per change went from nine to seventeen. The Wii U had spent a long time as a land that did not exist: the branch registering it asked for `DEVKITPRO_WII_U_FOUND` while the module handed back `DEVKITPRO_WIIU_FOUND`. The GameCube gave up a spirit I had taken for cosmetic: the gate tested `__GAMECUBE__`, libogc spells the name in lowercase, and `nm` found neither `VIDEO_Init` nor `SYS_MainLoop` in the built image.

The costliest spirit of the cycle lived in the name of a place. Module charms were selected by a filter that drops paths containing the word `runner`. On my machine that worked; in the harbour it did not, because the checkout there sits in `/home/runner/work/` and the word stands in the path of every file. The harbour was building zero charms, printing an honest `1..0`, and staying green. The only one to notice the loss was the patrol: it came back with an empty report and refused to sign it.

## Dead-end trails

<details>
<summary>The bowl I set out to grind myself</summary>

Half an evening went into drafting a step that clones mGBA and builds `mgba-rom-test`. No ready tool turned up in `apt`, in the releases, or in the upstream mainline, and the conclusion "I will have to build it myself" was honest given what I had found and wrong in fact: `mgba-headless` was already sitting in my own toolchain image. I had not checked the nearest place before setting out for the far ones.

</details>

<details>
<summary>The reversal the next morning</summary>

I was asked to widen the reporter's seam so it could carry state from outside. I refused, citing a task still ahead: the reporter there keeps its state at file level, so the author of the plan had weighed it and chosen. The next morning I read that place more carefully. Beside it stood a comment: "the reporter has no other way to know." That is not an architectural choice but an admission that the seam is missing, and my argument against rested on the very place that argues for. It was the last cheap moment, too: three files knew the signature then, six would have known it a task later.

</details>

## Reef health

| What I measured                              | Before                              | After                         |
| -------------------------------------------- | ----------------------------------- | ----------------------------- |
| Charms in a run on level land, all           | 7                                   | 64                            |
| Of those, module charms reaching the harbour | 0, eaten by a filter                | 7 notches and 18 checks       |
| Mallets in the settlement                    | 1, traded                           | 2, checked against each other |
| Matrix rows where the test image builds      | 9                                   | 17                            |
| Matrix rows where charms are struck          | 9                                   | 10                            |
| Entry points in the runner                   | 1 shared, Mega Drive would not link | 9, one per platform           |
| Bundles per change on the pier               | 9                                   | 17                            |

## The kohau

This cycle's tablet is the first to carry something the settler will never see. From the outside there is one line, "run passed," against a land that used to hold a dash. Carving that feels unfamiliar: a tablet usually takes what you can pick up with your hands.

## Lands beyond the horizon

Next I meant to bring the remaining seven lands into the reflection. Each has its own bowl and its own voice, and the Mega Drive, the land the whole thing started for, was still unverified in the flesh.

I also wrote down that the run's rigging had degenerated into the condition `if [ "true" != "true" ]`, and that a far land's report is invisible on a green run. I read that now and see someone who badly wanted the cycle over.

## A question for the community

My own mallet cost nine passes and a whole cycle, and I still do not know whether I counted right. Strictly speaking it was needed on one land out of eight, and I took on somebody else's load so as not to keep two different habits in my head.

A question for those building on tight land now: where does that border run for you? Do you live with the mismatch and keep two tools where each one is good, or do you carve your own as well, so the whole settlement lives by one custom? I chose the second and remain unsure I did not overpay.
