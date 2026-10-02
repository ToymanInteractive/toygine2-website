---
slug: entry-3-tests-head-for-consoles
title: "Entry 3: Tests Head for the Consoles"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, platforms, gba, md, gamecube]
date: 2026-08-30
description: >
  The third entry in the retro shop journal. The engine got its own test
  runner, a test ROM ran under a GBA emulator for the first time, and the
  console sample built for eight consoles.
image: /img/blog/2026-08-30-1.webp
sidebar_position: 1
---

In two weeks I took eight consoles down from the shelf, one per pull request. I'm writing ToyGine2, an engine for small games that should run on modern machines and on retro hardware. This cycle the engine got its own test runner, and each of the eight consoles got an image built in CI.

<!-- truncate -->

[In short](#short) · [A test runner of my own](#runner) · [Tests make it to the GBA](#gba) · [The sample on eight consoles](#samples) · [Numbers](#numbers) · [What's next](#next)

## In short {#short}

The engine got a test runner of its own. It builds where doctest can't and reaches the same verdict. On desktop the tests build under both runners at once, and on the GBA the test ROM runs in CI under mGBA. The console sample builds for eight consoles, and each has its own image in the pull request. All of this went into version 26.18.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.18.0).

- Artifacts of a closed pull request are deleted right away instead of after seven days of retention.
- A Wii U toolchain Docker image appeared. CI now checks the base image tag in `FROM` against the image label: Dependabot had bumped the tag in `Dockerfile.gba` and left the label alone.
- The Wii U didn't show up in the platform list: the find module set `DEVKITPRO_WIIU_FOUND`, and the check expected `DEVKITPRO_WII_U_FOUND`.
- Nearly every pull request brought an MSVC flag, from `/GF` to `/RTC1`.
- A CI script catches module tests that reach into the runner's internals.

## A test runner of my own {#runner}

On desktop, doctest runs the engine's unit tests. On the consoles there was no test binary at all: the test files didn't even compile under their toolchains, and the `static_assert`s in them never fired.

First I checked whether doctest would do. Under devkitARM for the GBA and 3DS it built and linked into a ROM. Under ClownMDSDK for the Mega Drive it didn't: that's a freestanding environment, without `<signal.h>`, `<ctime>` and the rest of what doctest relies on. Strictly speaking only the Mega Drive needed a runner of its own, but I wrote it for all consoles, or else every change to the tests would start with the question of which runner sits on which platform. The narrowest target set the limits: not a single heap allocation, and only the six standard library headers that ClownMDSDK has.

The runner's main rule: the same test reaches the same verdict under doctest and under the built-in runner. I tripped over that rule almost at once. I had written the `Approx` tolerance comparison from memory, and a review found it differed from the doctest 2.5.3 source:

```cpp
// before
difference <= epsilon * max(1.0, larger)
// after, exactly as in doctest
difference < epsilon * (1 + larger)
```

The formulas look alike, but near one, with a difference of one and a half epsilons, doctest says "equal" and mine said "no". No existing test changed its verdict, so the mismatch would have lived until the first test right at the threshold. Now a compile-time check guards the formula.

The review also suggested computing everything in `double`, as doctest does. I turned that down after measuring. The Mega Drive's 68000 has no FPU, and a single comparison of two `float`s would have grown from 168 to 248 bytes of code. The cost would have landed on exactly the console the runner was written for, so I documented the narrow precision difference instead of removing it.

To keep the rule from resting on good faith, the same test set builds twice on desktop: as `toygine-units` under doctest and as `toygine-units-builtin` under the built-in runner. On the first converted file the built-in runner reported `1..7` and `passed=18`, doctest `test cases: 7 | assertions: 18`. Changing `0xFF` to `0xFE` in one check broke both targets.

<details>
<summary>The subcase test that passed twice with a bug in place</summary>

The `each_subcase_runs_exactly_once` case checks that the runner enters every subcase exactly once. I rewrote it three times. The first version relied on global counters, and the next two passed with a planted bug: the second compared the context counters, the third remembered only the last subcase name per run. The fourth worked: every run gets a record with a name and an entry counter.

</details>

A green run says nothing about whether a test catches anything, so I check the runner's tests with planted bugs. For someone writing a game on the engine, it all comes down to one line: a test includes `toy_test.hpp` instead of doctest, and the same file runs on desktop and on a console with the same verdict.

![Two CRT screens on the repair bench show the same pattern, one wired to a desktop computer and the other to a 16-bit console](/img/blog/2026-08-30-1.webp)

## Tests make it to the GBA {#gba}

Once the tests built twice, CI showed something odd: 64 tests locally, 57 in CI, and the built-in runner printed `1..0`, zero cases. The only thing that failed was coverage, with `lcov: ERROR: (empty) no valid records found in tracefile`.

A filter in CMake was to blame. The runner's own files were excluded from the module tests by a `/runner/` regex over absolute paths. My project lives under `/Users/…`, while GitHub checks the code out into `/home/runner/work/…`, where `/runner/` is in the path of every file. I reproduced it on a copy of the tree under the same kind of path and switched the file search to relative paths anchored with `^`. I declined the advice to add `--ignore-errors empty` to the lcov call: the empty coverage report was the only thing that noticed the tests had gone missing.

Then the test binary had to build for the consoles, and the shared `main` didn't survive the Mega Drive. The cartridge linker script declares `_EntryPoint` as the entry point. There's no C runtime there to call `main`, and the binary built without a start address. The entry point moved into separate files, one per platform, and CMake picks the right one. On an unknown platform configuration fails instead of falling back to the desktop variant without a word.

The GBA was the first console where the tests ran. For the CI run I had already designed a step that builds `mgba-rom-test` from the mGBA sources. Then I looked inside the GBA toolchain image and found `mgba-headless` there, the same tool under another name. I threw the step out entirely.

What remained was teaching the ROM to talk to the emulator without breaking it on hardware. At startup the ROM writes `0xC0DE` to the debug register at `0x04FFF780`: mGBA answers `0x1DEA`, and hardware stays silent. A Spectrum program finds out whether a Kempston joystick is attached the same way: it reads the joystick port, the interface answers with a meaningful byte, and without it whatever happens to be on the bus comes back. Under the emulator every report line also goes to the debug log in full, while the 30-column screen gets it cut short. At the end the ROM makes the Stop system call, `swi 3`, with the verdict in register `r0`, and `mgba-headless -S 3 -R r0` turns the verdict into the process exit code. I had to write the call in assembly: `Stop()` from libgba clobbers `r0` on the way.

```cpp
asm volatile("mov r0, %0\n\tswi 3" : : "r"(code) : "r0", "r1", "r2", "r3", "memory");
```

I gave the run to CTest rather than a CI step, so the `Unit testing` step is the same for every platform. A green run is ten report lines and code 0. A broken check gives `not ok 7` with the file, line and expression, and exit code 1.

The empty lcov report looked like a coverage failure and was really a test build failure. Before you silence a signal like that, it pays to find out what it's about. For someone writing a game, this means every pull request runs the engine's tests on an emulated GBA, and the same ROM on a flash cartridge will show the report on the console's screen.

![A 32-bit handheld console with truncated lines on its screen, beside it a paper tape carrying the same lines in full](/img/blog/2026-08-30-2.webp)

## The sample on eight consoles {#samples}

At the start of the cycle only the nine desktop builds had an artifact in the pull request. The consoles built, but there was nothing to touch. Over the cycle I took one console off the shelf per pull request: GBA, NDS, 3DS, Switch, GameCube, Wii, Wii U and Mega Drive.

The sample is small: it brings up the SDK's text console, prints a line and waits in the main loop. Each console has its own loop. The GBA has nowhere to exit to, so it waits for the vertical blank interrupt forever, while the NDS spins in `pmMainLoop()` until the system asks it to quit. An SDK function turns the ELF into a console image, and `install` puts it into `bin`. Out come `.gba`, `.nds`, `.3dsx`, `.nro`, `.dol` for the GameCube and Wii, `.rpx` for the Wii U and `.bin` for the Mega Drive.

The first surprise was an archive inside an archive. `actions/upload-artifact` always packs what it's given, and it was being given a finished zip from CPack. `archive: false` uploads the file as is and takes the artifact name from the file name. I expected the `artifact_id` field in the matrix to become unnecessary, and it became more important. Without it CPack names the package after the system and processor, and the Xcode arm64 and Ninja arm64 builds get the same name, `Darwin-arm64`. Two identical names in one run break the upload.

The second was the GameCube. I guarded the sample branch with the `__GAMECUBE__` macro, everything built without a single warning, and only the review noticed that devkitPro's CMake toolchain for libogc defines `__gamecube__` in lowercase. `nm` on the ELF confirmed it: neither `VIDEO_Init` nor `SYS_MainLoop` was in there, and the desktop branch with `<iostream>` had gone into the `.dol`.

When branch selection rests on a macro, a clean build says nothing about which code ended up in it. Checking the symbols took a minute, and I now check branch selection against the binary. For anyone who wants to run the engine on their own console, every pull request carries 17 archives, eight of them with a console image. You can open the image in an emulator or flash it to a cartridge.

![A tray of eight compartments on the counter, each holding the media of a different console, from a tiny card to a large black cartridge](/img/blog/2026-08-30-3.webp)

## Numbers {#numbers}

| What I measured                            | Before                                                    | After                                                |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| Tests in the desktop set, Aug 22 to Aug 27 | 32                                                        | 64                                                   |
| Tests in CI with the `/runner/` filter     | 57, built-in runner `1..0`                                | 64, `1..7`                                           |
| Test suite run                             | 1.02 s, three separate binaries checked the runner report | 0.06 s, one doctest test checks the report           |
| Comparing two `float`s on the Mega Drive   | 168 bytes of code                                         | 168 bytes; the `double` variant (248 bytes) declined |
| Builds with a pull request artifact        | 9                                                         | 17                                                   |

## What's next {#next}

The Mega Drive is next. It already has an entry point and output through the video chip's debug register; what's left is finding an emulator that runs without a window and returns a verdict. After it, the other six consoles follow the GBA pattern: a branch in `tests/CMakeLists.txt` and `run_test: "true"` in the CI matrix.
