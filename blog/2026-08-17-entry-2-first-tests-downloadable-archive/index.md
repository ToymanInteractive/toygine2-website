---
slug: entry-2-first-tests-downloadable-archive
title: "Entry 2: First Tests and an Archive You Can Download"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, windows, macos, linux]
date: 2026-08-17
description: >
  The second entry in the retro shop journal. The engine got its first real
  tests, coverage made it to Codecov, and every pull request now publishes
  archives with the library and a sample.
image: /img/blog/2026-08-17-1.webp
sidebar_position: 1
---

For two weeks the lit magnifier over the repair bench stayed on: the cycle went into hunting for things that kept silent. I'm writing ToyGine2, an engine for small games that should run on modern machines and on retro hardware. This cycle it got its first real tests, coverage, and archives you can download from a pull request.

<!-- truncate -->

[In short](#short) · [Checks that kept silent](#silent) · [Coverage all the way to Codecov](#coverage) · [An archive you can download](#archive) · [What's next](#next)

## In short {#short}

The engine's tests are registered with CTest and run in CI on every desktop configuration, and an empty run now counts as a failure. CI collects coverage and sends it to Codecov along with the test results. Every pull request publishes nine archives with the library, the headers, the license and a console sample. All of this went into version 26.17.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.17.0).

- Windows ARM64 got presets and a CI build on a native ARM64 runner.
- `ENABLE_BITWISE_OPERATORS` enables bitwise operators for a scoped enum. A plain enum now gets a clear error; before, `|` silently changed the type of the result.
- The `toy::assertion` API appeared, for handlers of failed checks. Its documentation keeps only the claims the code backs up.
- CI runs SonarCloud analysis, and CodeQL no longer analyzes third-party code pulled in through `FetchContent`.
- Configuration prints the final compiler and linker flags for every build.
- Nearly every pull request added an MSVC flag: `/favor:blend`, `/Ox`, `/Oy`, `/arch:SSE2`, `/fp`, `/fpcvt:IA`, `/GA` and more.
- Doxygen 1.18 builds the documentation.

## Checks that kept silent {#silent}

Before writing the first test, I took apart the harness that was supposed to run it. Test registration with CTest sat inside `if (CTEST_SUPPORT)`, and nothing anywhere set `CTEST_SUPPORT`. You could write a test, build it and put it next to the others, and it would never make it into the CTest list. I removed the guard.

The second gap came right after. CTest that found no tests at all exited with code 0, and CI went green. I added `noTestsAction: error` to the test preset, and an empty run now fails with code 8 and `No tests were found!!!`.

The documentation had the same kind of problem. The Doxygen build was set to fail on any warning, yet it didn't fail on undocumented symbols. The cause was `EXTRACT_ALL = YES`: with it, Doxygen treats everything as documented and never warns about gaps. I checked on Doxygen 1.17: with `YES` there was silence, with `NO` it printed `error: Compound Foo is not documented.` right away.

Another dead branch turned up in the MSVC flags. The condition `MATCHES "x86"` waited for a name the Visual Studio generator never uses, because the platform there is called `Win32`. The x86 build never got the flags from its own branch.

All four places looked like they worked and didn't do what they were written for. None of them failed, so none of them ever caught my eye.

The first real test file, `bitwise_enum.test.cpp`, failed to build on Windows with error `C2064`. The chain from cause to error had five links, and none of them mentioned the next:

1. `cmake/ConfigureCompiler.cmake` clears `CMAKE_CXX_FLAGS`.
2. That takes away `/EHsc`, which CMake itself puts there.
3. Without `/EHsc`, MSVC doesn't define `_CPPUNWIND`.
4. doctest's autodetection decides exceptions are off and swaps `REQUIRE` for a stub with `static_assert(false)` inside.
5. The compiler reports only the last link: `C2064`, "term does not evaluate to a function".

A dried-out capacitor in an old console's power circuit shows itself the same way, as a hum from the speaker. The fault sits in one part and shows up in another, and the hum says nothing about the power supply.

My first attempt to bring the flag back was dead too: I put it in `MSVC_CXX_FLAGS`, a variable the project never reads. The flag came back to the tests through the directory's `CMAKE_CXX_FLAGS`, and all seven cases passed.

A check is code like everything else, and I trust it only after I've seen it fail at least once. For someone writing a game on the engine, this is what changed: tests run on every pull request, missing tests turn CI red, and a public symbol without documentation breaks the build.

![An opened console power supply under a lit magnifier, its fuse holder bridged with a twist of bare wire instead of a fuse](/img/blog/2026-08-17-1.webp)

## Coverage all the way to Codecov {#coverage}

The `TOYGINE_TESTS_ENABLE_COVERAGE` option turns coverage on, and the `CodeCoverage.cmake` module computes it with gcov and lcov. The first thing the option did was break configuration where nobody expected it. The GBA has no test target at all, and CMake complained that it couldn't set flags on a target that didn't exist. Under MSVC the module stopped configuration itself with `Compiler is not GNU or Flang!`. I added two guards: the coverage block runs only where a test target exists, and on an unsuitable compiler configuration warns and carries on.

A review found that the test target was compiled with `--coverage` twice and suggested removing the "extra" `append_coverage_compiler_flags()` call. I removed it, and linking on AppleClang failed with `Undefined symbols: "_llvm_gcda_emit_arcs"`. That call's flags also end up in the link command, while `append_coverage_compiler_flags_to_target()` links gcov only under GCC. The call came back with a comment explaining why it's needed. It also took down an earlier estimate of mine, that everything links on AppleClang without it: it had been linking precisely because of that call.

I removed `-j 0` from the CTest run inside the coverage target. Each doctest case is a separate process of the same binary, and parallel processes would merge their counters into the same `.gcda` files.

Then the reports went to Codecov, and that step had silent breakages of its own. When I moved the JUnit upload from an artifact to Codecov, the `if: always()` condition got lost. A failing `ctest` stopped the job, so the test report went out only when everything was green, which is exactly when nobody needs it. Now it's `if: ${{ !cancelled() }}`. In the same step, the path `$GITHUB_WORKSPACE/out/junit/junit.xml` didn't expand, because values under `with:` don't go through a shell. I replaced `$GITHUB_WORKSPACE` with `${{ github.workspace }}`.

lcov itself failed last: `ERROR: (unused) 'exclude' pattern … is unused`. The exclusion list had an `external/` directory that doesn't exist in the repository and never did, and lcov 2.x treats any pattern that matches no file as an error. I put together a synthetic `.info`: with the pattern lcov exited with code 2, without it with code 0. I deleted the pattern. I turned down `--ignore-errors unused`, since it would also hide the next stale pattern.

<details>
<summary>The first lcov reproductions, which proved nothing</summary>

The first attempt took the exit code from `tail` instead of lcov and always got 0. In the second, the synthetic `.info` had no function records, and lcov failed on a different error, `empty`, before it got to checking patterns. Only the third try reproduced the CI error character for character.

</details>

Every step that joins two tools can break silently. So I check a joint by watching it actually fail. For someone writing a game, this means every pull request sends coverage and test results to Codecov, and the results go out even when the tests fail.

![An opened 8-bit computer on the repair bench: nearly every key carries a green dot of paint, a few keys are still unmarked](/img/blog/2026-08-17-2.webp)

## An archive you can download {#archive}

At the start of the cycle `CMakePresets.json` already had a package preset, but it had nothing to package. A search through the project found not a single `install()` and not a single `include(CPack)`: the preset would have built an empty archive and reported success. I went for the full setup: install rules, CPack and presets. ZIP everywhere, so CI doesn't need any external packagers. The consoles wait for now: their build result is a ROM, not an archive.

The first question was the name. CI passed CMake the configuration and a short commit hash, such as `linux-x64-a131ded`, and that used to be the whole archive name. The version, though, lives in `project()`, and CI doesn't know it before configuration. I turned the meaning of `PACKAGE_FILE_NAME` around: CI supplies only the tail, and CMake, which already has the project name and version, adds them in front. `macos-ninja-arm64-abc1234.zip` became `ToyGine2-26.16.0-macos-ninja-arm64-abc1234.zip`.

At first the sample wasn't in the archive, even though the package description promised it. A review suggested adding `runtime` to the component list. I checked: there's no such component in the project, the sample installs into the `samples` component, and CPack accepts a component that doesn't exist without complaint, prints `Install component: runtime` and packs zero files. The patch would have looked like a fix and fixed nothing. `samples` went into the list, and the four components were put into a `runtime` group, one archive per group. There's only one group for now, but a future group with debug symbols will get its own archive instead of being glued onto this one. The unpacked sample prints `Hello world from Console sample app` and exits with code 0.

The last step sent the archives to the pull request. This is where a risk I'd written down a little earlier came true. Three presets each serve two matrix rows, one per architecture: `macos-xcode` and `macos-release` build for arm64 and Intel, `linux-release` for x64 and arm64. Without a separate build identifier, the two builds in each pair would get the same artifact name, and the upload would fail on the duplicate. The nine desktop rows got their `artifact_id` key back. The archive is uploaded before the tests run, so a failing test doesn't leave the reviewer without a binary.

A packaging tool happily reports success after packing nothing, so the check ends only with `unzip -l` and running what's inside. For anyone who wants to try the engine, every pull request carries nine archives, each with the library, the headers, the license and a sample that runs right after unpacking.

The boy with the Game Boy came in and asked whether the game would be ready soon. There's no game yet. But for the first time there's something to download: an archive whose sample prints one line and exits.

![An open game box on the shop counter, with the cartridge, the manual, a card and a folded insert each in its own compartment](/img/blog/2026-08-17-3.webp)

## What's next {#next}

Next comes teaching CI to delete the artifacts once a pull request is closed, and checking the whole chain on a live pull request. After that the consoles follow the archives: they produce a ROM instead, and I'd like to download that straight from a pull request too.
