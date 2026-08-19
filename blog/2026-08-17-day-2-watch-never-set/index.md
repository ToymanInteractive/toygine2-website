---
slug: day-2-watch-never-set
title: "Day 2: The Watch That Was Never Set"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, windows, macos, linux]
date: 2026-08-17
description: >
  The second day of the Builder's chronicle. The first watch totems went
  into the ground, the patrol finally carried its reports to the house of
  knowledge, and a settler got a tablet they could carry away.
image: /img/blog/2026-08-17-1.webp
sidebar_position: 1
vibe: storm-weathered
---

ToyGine2 is a game engine for retro consoles: thirteen lands, from the Mega Drive and the Game Boy Advance to Windows, macOS and Linux. By the start of this cycle the settlement had a map and a tide beacon standing over it, and not one charm along its border.

<!-- truncate -->

## What happened

This tide cycle I sank the first watch totems into the border, walked the rounds to see how far they reach, and carved a tablet a settler can carry away. The spirits this time were quiet ones: one kept the gate barred so the watch never entered at all, one lifted charms at the shipyard where I never thought to look, one spent four days dropping the patrol's reports into a pit. By the end of the cycle a tablet had been carved and carried into the house of knowledge. [Here is the shelf it rests on](https://github.com/ToymanInteractive/toygine2/releases/tag/26.17.0).

**Plan for the cycle:**

- Stand up unit tests: doctest, registration with CTest, a run on every desktop configuration
- Turn coverage on and carry the report all the way to an outside service
- Hand out an archive with the library, the headers and the license on every pull request
- Wire up outside analysis so that foreign code stays out of the report

![Sunset over the rampart: the gate barred with a beam under a lit lamp, seven carved totems lying by empty pits, a figure standing among them](/img/blog/2026-08-17-1.webp)

## The watch that was never set

The rigging for the charms reached the settlement before the charms did. Taking it apart, I found a condition wrapped around the very call that puts totems on the register, and that condition tested a variable nobody had ever set. A totem could be carved, blessed and sunk by the gate: it would not have made the register anyway.

A second one lay beside it. The patrol walking an empty border came back and reported all quiet, and it was not lying: there was nothing to walk. I told it to treat an empty round as a calamity, and that same evening it came back shouting "not a single charm." Best news of the cycle.

The first real charm, a file of tests for bitwise operations, would not build on the northern land. The chain ran five links deep and no link mentioned the one before it: the compiler configuration file blanks `CMAKE_CXX_FLAGS`, the `/EHsc` that CMake had supplied goes out with them, without it MSVC never defines `_CPPUNWIND`, doctest's autodetection concludes that exceptions are off, and it swaps `REQUIRE` for a stub with a `static_assert(false)` inside. The compiler reported the last link: `C2064`. The flag came back onto the test targets, and seven cases ran.

Out of the same corner came something I had not gone looking for: an unscoped enumeration signed up for the bitwise operators compiled in silence, and the template operator beat the built-in one and changed the type of the result with no diagnostic. A constraint alone does not fix that. The operator would drop out under it, the call would fall through to the built-in one, and again not a word. What helped was a `static_assert` inside the opt-in macro.

Whoever picks up the engine sees a steady flame above the gate and does not stop to ask how many charms stood on the border that night, zero or seven. The flame burns the same either way. A charm never planted and a charm standing but off the register look identical from outside: both are silent. There is one way to tell them apart, and that is to make the patrol treat silence as a calamity.

![Dusk: a patrolman with a bag of knotted bundles walks past a stone pit filled to the brim with the same bundles, carved totems burning along the shore](/img/blog/2026-08-17-2.webp)

## Walking the rounds

The totems stood, the patrol walked, and four evenings running I wrote the same line into my notes: the patrol's reports go nowhere. Collection was on, the report piled up in its proper file, and there it ended.

Building that path took longer than planting the totems. Two guards first: collection fell over on the Game Boy Advance land, where the test target does not exist at all, and on the northern one, where a foreign module breaks off with "Compiler is not GNU or Flang!" I did not let it refuse quietly. Then the target that assembles the report turned out to have no inputs at all: on a clean tree it would have run before the binary existed. Then the parallel run went, because every doctest case is a separate process of the same binary and the processes merge their counters into one file.

The second report, the one about the runs themselves, was written and thrown away just the same. Three traps in a row here: the old intake service is marked deprecated, the new one names its parameter differently from what its own guide promises, and the path in its settings does not expand, because values in `with:` fields never pass through a shell. Last came the "unless cancelled" condition: without it the report only left on green tests, which is exactly when nobody needs it.

Finally the patrol tripped over its own exclusion list: `lcov` refused to work, `ERROR: (unused) 'exclude' pattern … is unused`. The directory I was excluding does not exist in the repository and never did. I checked the mechanism with a minimal reproduction rather than an argument: with the pattern, exit code 2; without it, zero. I did not rename the line, I deleted it, and wrote the reason into the comment so the next person does not add a directory here for future use.

Whoever brought a change into the settlement saw two conditions at their gate: the share of the rounds across the settlement and the share on the change itself. Both had hung there unanswered, and nobody, myself included, could say what they were waiting for. The number from a round guards nothing on its own; the totems do the guarding. But a round that walks and never returns is worth nothing either.

![A pier on a clear day: woven bundles in a row, each with its own emblem, a settler carrying one toward a boat, an empty basket on the sand](/img/blog/2026-08-17-3.webp)

## The tablet a settler carries away

Packing rules had appeared in the shipyard's description. I went to see what they would pack, and found no installation rules at all: not one `install()`, not one `include(CPack)` in the whole settlement. The preset would have finished successfully and produced an archive with nothing in it.

I wrote the rules from the bottom up: the library, the headers, the license, the console sample. Four components went into one group, and I set the mode to "one archive per group" straight away, even with a single group, because a future group of debug symbols would otherwise have been glued to the runtime. I had to rebuild the archive name from scratch. The value coming in from the harbor was the full file name, and it carried neither the project name nor the version, since the version lives in the project declaration and the harbor does not read it. Now it is a suffix, and the file name and the root directory inside the archive are named by different variables built from one common base.

Then came a risk written down the day before in a single line, confirmed in the first minute it mattered: three presets serve two matrix rows each, so six desktop builds would have ended up with the same name and the upload would have failed on the duplicate. The nine desktop rows got their own identifiers back; the seven console rows deliberately have none, since what comes out there is a ROM, not an archive. I put packing and upload between the build and the charm run: a failing test must not deprive a reviewer of the binary.

A settler carries away an archive, not a build, and the first thing they do is unpack it. I unpacked mine and did not immediately understand what I was looking at: `libtoyginerd.a`. Those two extra letters are a configuration postfix; I was expecting `libtoygine.a` and spent half a minute staring at a name I had set myself, I no longer remember when.

## The rest of the cycle

The northern land gained a third shore: Windows on ARM64 joined the matrix. A deferred deoptimization flag left with the same change, since it sat in the static linker's set, which does not know the option and complained on every build.

The documentation gate had been deaf through no fault of its own: the "document everything" option declares every entity documented and silences the warnings about undocumented ones. Next to it I found that Doxygen's section labels are global to the whole project, so a second class with a `usage` label would have brought the build down.

Outside analysis stopped reading foreign code, since the dependencies now land outside the working tree, and a second analyzer went up beside it, which works off the compilation command database.

## Dead-end trails

<details>
<summary>The redundant call that was holding the link together</summary>

I was told about a redundancy: the target compiled with coverage flags twice, once from the directory settings and once from the settings of the target itself. The redundancy was real, and removing it broke linking on AppleClang: `Undefined symbols: "_llvm_gcda_emit_arcs"`. Directory-level flags are read at generation time and end up in the link command as well, whereas the targeted call links the coverage library only for GNU. The call went back with a comment explaining why it looks redundant. My own earlier assessment collapsed along the way: I had believed AppleClang linked fine without it. It linked thanks to it.

</details>

<details>
<summary>A component the settlement does not have</summary>

I was advised to add one more entry to the packing component list so that the sample would land in the archive. The symptom was named correctly: the package description promised the sample and the archive had none. But no component by that name exists in the tree, and CPack does not check that a component exists: it prints `Install component: runtime` and lays down zero files. The patch would have taken the symptom off the radar and left the hole in place.

</details>

<details>
<summary>Whispers about seals, the sixth time running</summary>

For the sixth cycle in a row I am advised to call outside allies by digest rather than by version name. The advice is sound in itself and wrong in scope: all twelve allies in the settlement are called by version names, and a seal on one of the twelve closes nothing and simply drops out of the next update. That is done as a sweep across the repository, in a pass of its own.

</details>

## Reef health

| What I measured                      | Before                     | After                        |
| ------------------------------------ | -------------------------- | ---------------------------- |
| Tests registered with CTest          | 0, the guard is never true | 7                            |
| `ctest` on an empty set              | exits with zero            | fails, exit code 8           |
| Test build on MSVC                   | `C2064`                    | builds                       |
| An undocumented symbol in Doxygen    | silence                    | `error: … is not documented` |
| Test run report                      | written and thrown away    | reaches an outside service   |
| Coverage report                      | not assembled              | assembled and sent           |
| Stale `lcov` exclude pattern         | exit code 2                | 0                            |
| Foreign code in the analyzer report  | included                   | outside the working tree     |
| Desktop archives per pull request    | 0                          | 9, kept for 7 days           |
| Unique artifact names for six builds | 3                          | 6                            |

## The kohau

The tablet of this cycle came out denser than the last. For the first time something a settler can hold is carved on it: assertion reporting and bitwise operations over enumerations, and around them the machinery all of it was for. Charms along the border, a patrol that carries its news, and a bundle taken from the pier.

## Lands beyond the horizon

Next I meant to clean up after myself: sweep the bundles off the pier once a change is closed, and walk the whole path on a live pull request instead of in pieces. A nasty find was waiting its turn separately. The macro that switches the checks on is defined nowhere, so on two lands out of three a debug build quietly takes the empty branch, exactly where the sanitizers are on. Beside it a second: `NDEBUG` is not declared either, and in a release build the checks stay alive.

I am writing this down years later and I will not pretend to remember which of it turned into what.

## A question for the community

My patrol only walks level ground. The tests build and run on three desktop lands; on the seven console ones that have a toolchain image they build at best, because there is nothing to run them with. The harbor has an emulator, but I never got the charms running through it.

You who are building on tight ground now: how do you guard the yards the patrol never reaches? Do you run the charms on an emulator right there in the harbor, keep hardware tethered at the pier, or take the view that on such a land it is enough to build a test and never run it? In all these years I have not found an answer that satisfies me.
