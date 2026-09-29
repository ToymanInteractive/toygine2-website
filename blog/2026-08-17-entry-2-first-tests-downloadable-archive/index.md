---
slug: entry-2-first-tests-downloadable-archive
title: "Entry 2: First Tests and an Archive You Can Download"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, windows, macos, linux]
date: 2026-08-17
description: >
  The second entry in the workshop journal. The engine got its first real
  tests, coverage made it to Codecov, and every pull request now publishes
  archives with the library and a sample.
image: /img/blog/2026-08-17-1.webp
sidebar_position: 1
---

For two weeks the wind-up key lay untouched on the corner of the workbench. I'm writing ToyGine2, an engine for small games that should run on modern machines and on the consoles from my shelf. This cycle it got its first real tests, coverage, and archives you can download from a pull request.

<!-- truncate -->

[In short](#short) · [Checks that stayed silent](#silent) · [Coverage all the way to Codecov](#coverage) · [An archive you can download](#archive) · [What's next](#next)

## In short {#short}

The engine's tests register with CTest and run in CI on every desktop configuration, and an empty run now counts as a failure. CI collects coverage and sends it to Codecov along with the test results. Every pull request publishes nine archives with the library, headers, license and a console sample. All of it went into 26.17.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.17.0).

- There are presets and a CI build for Windows ARM64, on a native ARM64 runner.
- `ENABLE_BITWISE_OPERATORS` turns on bitwise operators for a scoped enum. A plain enum now gets a clear error; before, its `|` silently changed the result type.
- There is a `toy::assertion` API for failed-check handlers. Its documentation keeps only the claims the code backs up.
- CI runs SonarCloud analysis, and CodeQL no longer analyzes third-party code fetched through `FetchContent`.
- Configuration prints the final compiler and linker flags for each build type.
- Almost every pull request added one MSVC flag: `/favor:blend`, `/Ox`, `/Oy`, `/arch:SSE2`, `/fp`, `/fpcvt:IA`, `/GA` and others.
- The documentation builds with Doxygen 1.18.

## Checks that stayed silent {#silent}

Before writing the first test, I went through the harness that was supposed to run it. Test registration with CTest sat inside `if (CTEST_SUPPORT)`, and nothing anywhere set `CTEST_SUPPORT`. You could write a test, build it and put it next to the others, and it would never make CTest's list. I removed the guard.

The next hole was right behind it. When CTest found no tests at all, it exited with 0 and CI went green. I added `noTestsAction: error` to the test preset, and an empty run now fails with exit code 8 and `No tests were found!!!`.

The documentation had the same problem. The Doxygen build was set to fail on any warning, yet it never failed on an undocumented symbol. The cause was `EXTRACT_ALL = YES`: with it, Doxygen treats everything as documented and doesn't warn about gaps. I checked on Doxygen 1.17: with `YES`, silence; with `NO`, straight away `error: Compound Foo is not documented.`

One more dead branch sat in the MSVC flags. The condition `MATCHES "x86"` waited for a name the Visual Studio generator never uses, since the platform is called `Win32` there, so the x86 build never got the flags from its branch.

All four looked like they worked, and none did the job it was written for. A ratchet without its pawl is like that: the wheel turns, and nobody notices it turns backwards too.

The first real test file, `bitwise_enum.test.cpp`, failed to build on Windows with `C2064`. The chain from cause to error had five links, and none of them mentioned the one before:

1. `cmake/ConfigureCompiler.cmake` clears `CMAKE_CXX_FLAGS`.
2. That takes away `/EHsc`, which CMake itself puts there.
3. Without `/EHsc`, MSVC doesn't define `_CPPUNWIND`.
4. doctest's autodetection decides exceptions are off and swaps `REQUIRE` for a stub with `static_assert(false)` inside.
5. The compiler reports only the last link: `C2064`, "term does not evaluate to a function".

My first attempt to bring the flag back was dead too: I wrote it into `MSVC_CXX_FLAGS`, a variable the project never reads. The flag came back to the tests through the directory's `CMAKE_CXX_FLAGS`, and seven cases passed.

A check is code like everything else, and I can trust it only once I've seen it fail at least once. For someone writing a game on the engine, this is what changed: the tests really run on every pull request, losing tests turns CI red, and a public symbol without documentation breaks the build.

![A brass ratchet wheel on its axle under a jeweller's loupe, while the pawl meant to lock it lies loose on the bench](/img/blog/2026-08-17-1.webp)

## Coverage all the way to Codecov {#coverage}

I turned coverage on with the `TOYGINE_TESTS_ENABLE_COVERAGE` option, and the `CodeCoverage.cmake` module computes it through gcov and lcov. The first thing the option did was break configuration where nobody expected it. The GBA has no test target at all, and CMake complained it couldn't set flags on a target that doesn't exist. Under MSVC the module stopped configuration on its own with `Compiler is not GNU or Flang!`. I added two guards: the coverage block runs only where there is a test target, and on an unsuitable compiler configuration prints a warning and carries on.

Review found that the test target was compiled with `--coverage` twice and suggested dropping the "extra" call to `append_coverage_compiler_flags()`. I dropped it, and on AppleClang the link failed with `Undefined symbols: "_llvm_gcda_emit_arcs"`. That call's flags also reach the link command, while the per-target function links gcov only under GCC. The call went back with a comment saying why it's needed. It also knocked down my own earlier estimate that AppleClang linked fine without it: it linked because of that very call.

I removed `-j 0` from the CTest run inside the coverage target. Every doctest case is a separate process of the same binary, and parallel processes would have merged their counters into the same `.gcda` files.

Then the reports went to Codecov, and that step had silent failures of its own. When the JUnit upload moved from an artifact to Codecov, the `if: always()` condition got lost. A failing `ctest` ended the job, so the test report was uploaded only when the tests were green, which is exactly when nobody needs it. Now the step has `if: ${{ !cancelled() }}`. In the same step, the path `$GITHUB_WORKSPACE/out/junit/junit.xml` never expanded, because values in `with:` don't go through a shell. I replaced `$GITHUB_WORKSPACE` with `${{ github.workspace }}`.

Last, lcov itself failed: `ERROR: (unused) 'exclude' pattern … is unused`. The exclude list named an `external/` directory that the repository doesn't have and never had, and lcov 2.x treats any pattern that matches no file as an error. I built a synthetic `.info`: with the pattern lcov exited with 2, without it with 0. I deleted the pattern and turned down `--ignore-errors unused`, which would also have hidden the next stale pattern.

<details>
<summary>The first lcov reproductions, which proved nothing</summary>

The first attempt took the exit code from `tail` instead of lcov and always got 0. In the second, the synthetic `.info` had no function records, so lcov failed on a different error, `empty`, before it ever checked the patterns. Only the third try reproduced the CI error character for character.

</details>

Every step that joins two tools can break without a sound, so I check each joint by making it fail for real. For someone writing a game, this means every pull request sends coverage and test results to Codecov, and the results go out even when the tests failed.

![An open gear train from a wind-up toy: five gears polished bright from turning, three dull and dusty](/img/blog/2026-08-17-2.webp)

## An archive you can download {#archive}

At the start of the cycle `CMakePresets.json` already had a package preset, but there was nothing for it to pack. A search of the project found no `install()` and no `include(CPack)`: the preset would have produced an empty archive and reported success. I went for the full setup: install rules, CPack and presets. The format is ZIP everywhere so CI needs no external packagers, and the consoles wait for now, since what they produce is a ROM, not an archive.

The first question was the name. CI passes CMake the configuration and a short commit hash, such as `linux-x64-a131ded`, and that was the whole archive name. The version, though, lives in `project()`, and CI doesn't know it before configuration. I flipped the meaning of `PACKAGE_FILE_NAME`: CI supplies only the tail, and CMake adds the project name and version, which it already has. `macos-ninja-arm64-abc1234.zip` became `ToyGine2-26.16.0-macos-ninja-arm64-abc1234.zip`.

At first the sample wasn't in the archive, even though the package description promised it. Review suggested adding `runtime` to the component list. I checked: the project has no such component, the sample installs into `samples`, and CPack silently accepts a component that doesn't exist, prints `Install component: runtime` and packs zero files. The patch would have looked like a fix and fixed nothing. `samples` went into the list, and the four components now form a `runtime` group, one archive per group. There's a single group today, but a future group with debug symbols will get its own archive instead of being glued to this one. The unpacked sample prints `Hello world from Console sample app` and exits with 0.

The last step put the archives on the pull request, and a risk I'd written down a session earlier came true. Three presets serve two matrix rows each, one per architecture: `macos-xcode` and `macos-release` build for arm64 and Intel, and `linux-release` for x64 and arm64. Without a separate identifier the two builds in each pair would have shared an artifact name, and the upload would have failed on the repeat. The nine desktop rows got their `artifact_id` key back. The archive uploads before the tests run, so a failing test doesn't leave the reviewer without a binary.

A packaging tool happily reports success after packing nothing, so a check isn't finished until `unzip -l` and running what's inside. For anyone who wants to try the engine, every pull request carries nine archives: the library, the headers, the license and a sample that runs straight after unpacking.

![An open box seen from above: four compartments hold a wind-up robot, a brass key, a folded manual and a warranty slip](/img/blog/2026-08-17-3.webp)

## What's next {#next}

The next step is setting up artifact deletion once a pull request closes, and checking the whole chain on a live pull request. After that the consoles follow the archives: instead of an archive they produce a ROM, and I want to download that straight from the pull request too.
