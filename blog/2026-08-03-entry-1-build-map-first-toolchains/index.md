---
slug: entry-1-build-map-first-toolchains
title: "Entry 1: A Build Map and the First Toolchains"
authors: [dmitry]
tags: [cpp, ci, cmake, docker, platforms, md]
date: 2026-08-03
description: >
  The first entry in the retro shop journal. The engine build was laid out
  along three axes of presets, the documentation learned to fail, and the
  Mega Drive toolchain image started working in CI.
image: /img/blog/2026-08-03-1.webp
sidebar_position: 1
---

This cycle I took the Mega Drive down from the shelf, though not for a customer: the engine was being built for it. I'm writing ToyGine2, an engine for small games that should run on modern machines and on retro hardware. It has no game code yet, and the cycle went into giving it something to build with and something to check it with.

<!-- truncate -->

[In short](#short) · [Presets along three axes](#presets) · [Documentation that couldn't fail](#docs) · [The Mega Drive in a CI container](#md-image) · [What's next](#next)

## In short {#short}

The engine build is now described by CMake presets along three axes: build type, platform and component set. The documentation build became a check that fails on any Doxygen warning. The CI matrix configures and builds the engine on 15 targets, seven of them consoles built inside Docker containers. All of this went into version 26.16.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.16.0).

- A macOS editor appeared: a native Cocoa window and menu, with Vulkan on top of Metal through MoltenVK and no Qt.
- The core got fixed-width integer types, from `toy::int8_t` to `toy::uint64_t`.
- CI checks the license header in every changed file.
- `FindClownMDSDK.cmake` finds the Mega Drive SDK, and the `genesis` toolchain image was renamed to `md`.
- The UTF-8 lead-byte table no longer accepts `0xC0–0xC1` and `0xF5–0xFF`: no valid sequence starts with them.
- Pull requests go through CodeQL, a push to `main` triggers a build, and the Ubuntu runners cache their APT packages.
- CI computed an image's build date twice, so an image built just before midnight UTC got a tag from one day and a label from the next. Now the date is computed once.

## Presets along three axes {#presets}

Until this cycle, building for each platform lived in my head: which flags, in what order, with which toolchain. I recalled it from scratch every time, and not always correctly.

I laid the CMake presets out along three axes. Hidden `type-*` presets set the build type. Thirteen `platform-*` presets set the platform, from Windows on two architectures to the Mega Drive, the Nintendo 64 and the Wii. `with-tests`, `with-benchmarks`, `with-samples` and `with-editor` set the components. A visible preset such as `gba-release` is put together from presets on each axis, and there are 36 of them.

The first breakage was loud: the preset map wouldn't open at all. `cmake --list-presets` failed with `File version must be 3 or higher for toolchainFile preset support`. The file header said version 1, and eight presets already pointed at toolchain files.

The second one was quiet. Every visible preset inherited a shared `base` plus the presets for its axes, and `base` came first in the list:

```json
"inherits": ["base", "type-release", "platform-macos-xcode", "with-tests"]
```

When inherited presets disagree on a field, CMake takes the value from the one listed earlier. `base` set the Ninja generator and switched every component off, so it overrode exactly what the axes were there for. No preset built the tests or the editor, and Xcode and Visual Studio were silently replaced by Ninja. Configuration still succeeded; it just built the wrong thing. A Game Genie worked the same way: the adapter sat between the console and the cartridge, and for every address that had a code entered, the console read the adapter's value instead of the cartridge's. My `base` was an adapter with codes for every address at once.

I moved `base` to the end of the list in all 36 presets and checked with real runs. `macos-release` turned the components on, `macos-xcode` produced a real `ToyGine2.xcodeproj` for the first time, and `gba-release` stayed on `arm-none-eabi-g++`.

<details>
<summary>A right conclusion about MSVC and Xcode from a wrong argument</summary>

A reviewer suggested adding debug presets for MSVC and Xcode, and I declined: those generators are multi-config, so `CMAKE_BUILD_TYPE` means nothing to them. I based that on the generator declared in the preset, but the one actually running was Ninja from `base`. On top of that, the script I used to compute the effective values resolved priority backwards. After the fix the conclusion turned out right, but by accident, and since then I read `CMakeCache.txt` instead of reasoning about what should have ended up there.

</details>

The Nintendo 64 came up separately. There's no toolchain for it in `cmake/`, and `cmake --preset n64-debug` happily configured with the system `/usr/bin/c++`, pretending to be an N64 build. Now configuration fails with `Nintendo 64 toolchain is not integrated yet`.

A preset is code like any other, and you check it against the cache, not against what it says. For someone building the engine, it comes down to one command: `cmake --preset gba-release` builds for the GBA, and a platform with no toolchain says so plainly instead of building something for the host.

![An 8-bit home console on the repair bench with a pass-through adapter between its slot and the cartridge, under a lit magnifier](/img/blog/2026-08-03-1.webp)

## Documentation that couldn't fail {#docs}

Doxygen builds the engine documentation, and CI had a separate workflow for it. I broke a `\param` in a header on purpose and ran the build. Exit code 0, empty console. `WARN_AS_ERROR` was set to `NO`, and the warnings went to `doxygen.log`, which nobody read.

I set `WARN_AS_ERROR = FAIL_ON_WARNINGS_PRINT` rather than `YES`. `YES` stops at the first warning, so I'd be fixing them one per run. This mode prints the whole list and only then fails.

The strictness immediately exposed an old breakage. CI failed with `error: clang: Failed to parse translation unit` on `src/core/utils.cpp` and `include/toygine.hpp`. Clang-assisted parsing only ran in CI: the official Doxygen binary is built with libclang and my local one isn't. The errors had been there all along; under the old setting even `error:` didn't change the exit code. I turned `CLANG_ASSISTED_PARSING` off, and since then the config has no options that depend on how Doxygen itself was built.

Two more things turned up along the way. Doxygen put a Mermaid loader from a CDN, with a floating version, into every HTML page, although the repository had no diagrams at all. With `MERMAID_RENDER_MODE = CLI` diagrams are rendered at build time, and no CDN links are left in the output. And the CI step that downloads Doxygen called `curl` without `--fail`. On a 404 curl exited with code 0 and saved the error page as `doxygen.tar.gz`, so the "download failed" check never fired. The failure surfaced a line later as a puzzling `tar: not in gzip format`.

A check that reports failure to a file instead of through the exit code checks nothing. And the first time you turn strictness on, it always drags out old debts. For someone reading the engine reference, this means every pull request rebuilds it and won't let through a broken link or a `\param` for a parameter that doesn't exist.

![A bench tester glows a steady green lamp while its paper tape of fault marks curls unread into a wastebasket below](/img/blog/2026-08-03-2.webp)

## The Mega Drive in a CI container {#md-image}

The CI matrix builds the engine on 15 targets. The eight desktop ones run on regular GitHub runners, and the seven consoles run in Docker containers with toolchains. I build those images in a separate repository and publish them to ghcr. Six are based on devkitPro; the seventh, for the Mega Drive, I build myself: `debian:bookworm-slim`, GCC for m68k from source, and ClownMDSDK. That's where the build kept failing, in a new place every time.

First, checkout failed with `EACCES`. The Mega Drive image was the only one running as a non-root user. The runner mounts its work directory into the container, creates service files there as its own user, and starts the container without `--user`. `actions/checkout` couldn't write its state. I removed the `USER` directive from the image.

<details>
<summary>First guess: the runner couldn't run anything in the container</summary>

At first I decided the runner couldn't even run `cat /etc/*release` inside the container. The log said otherwise: that command worked, and the next step, checkout, failed while writing its state. The cause had to be found in who creates files in the mounted directory, and under which user.

</details>

Next, checkout went through but without submodules: `Input 'submodules' not supported when falling back to download using the GitHub REST API`. `actions/checkout` uses the `git` inside the image, the slim image had none, and the action silently fell back to downloading an archive through the API. I added `git` to the final stage and found two more gaps before the next run. The console presets use Ninja, and the image had no `ninja-build`. The `cmake` in Debian's main repository was 3.25 while the engine needs 3.27, so I took a newer `cmake` from `bookworm-backports`.

Then I went over the image's environment variables, and the first one I found was `ENV PREFIX=/opt/clownmdsdk`. The image exists for other people's projects: they get mounted into the container and built with the image's environment. A `PREFIX ?= /usr/local` in such a project's Makefile takes the value from the environment, and `make install` would have gone into the SDK directory. I renamed the variable to `CLOWNMDSDK`, after its SDK, the way the devkitPro images do it.

Next to it was `LANG=en_US.UTF-8`, and the slim image has no `locales` package. I checked inside the container: `locale charmap` fell back to `ANSI_X3.4-1968`, so UTF-8 was never on. `C.UTF-8` took its place: that locale is built into glibc and costs nothing.

The GBA image had a similar gap. Its build stage compiled the `mgba-headless` emulator and copied it into the final image without ever running it. I added a test run, and `mgba-headless --version` exited with code 1: without a file name, mGBA refuses to start before it even looks at the version flag. `mgba-headless --version placeholder.gba` works. The file doesn't exist, but the emulator leaves through the version branch before it looks for it. The check also compares the commit baked into the binary with the one pinned in the Dockerfile.

A toolchain container is part of the build, and the CI runner expects things from it: root, `git` inside, the generator the presets ask for. For someone building the engine for the Mega Drive, this means there's no SDK to install: the image CI runs in sits on ghcr, and you can build the engine locally in the same image.

The collector came by and asked whether the game would be on a real cartridge. I answered as things stand: there's no game yet, there's an engine, and for the Mega Drive it only builds so far; it doesn't run.

![An open carrying case with a 16-bit console, controller and cable in their foam slots; one slot is empty, its screwdriver beside it](/img/blog/2026-08-03-3.webp)

## What's next {#next}

The engine builds on 15 targets, but the build doesn't check anything yet. There are no tests, and the benchmarks option is on everywhere although there are no benchmarks either. The next line in the order book is the first tests: registering them with CTest and running them in CI.
