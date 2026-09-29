---
slug: entry-1-build-map-first-toolchains
title: "Entry 1: A Build Map and the First Toolchains"
authors: [dmitry]
tags: [cpp, ci, cmake, docker, platforms, md]
date: 2026-08-03
description: >
  The first entry in the workshop journal. The engine build was laid out
  along three axes of presets, the documentation learned to fail, and the
  Mega Drive started building in a CI container.
image: /img/blog/2026-08-03-1.webp
sidebar_position: 1
---

The first console to come down from the shelf this cycle was the Mega Drive, and it came down for the build. I'm writing ToyGine2, an engine for small games that should run on modern machines and on the consoles from that shelf. There's almost no game code in the engine yet: this cycle went into having something to build and check it with.

<!-- truncate -->

[In short](#short) · [Presets along three axes](#presets) · [Documentation that couldn't fail](#docs) · [The Mega Drive in a CI container](#md-image) · [What's next](#next)

## In short {#short}

The engine build is now described by CMake presets along three axes: build type, platform and the set of components. The documentation build became a check that fails on any Doxygen warning. The CI matrix configures and builds the engine for 15 targets, seven of them consoles in Docker containers. All of it went into 26.16.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.16.0).

- There's a macOS editor: a native Cocoa window and Vulkan on top of Metal through MoltenVK, without Qt. It has a native menu.
- The core gained `toy::int8_t` through `toy::uint64_t`.
- CI checks the license header in every changed file.
- `FindClownMDSDK.cmake` finds the Mega Drive SDK, and the `genesis` image was renamed to `md`.
- The UTF-8 lead-byte table no longer accepts `0xC0–0xC1` and `0xF5–0xFF`.
- Pull requests go through CodeQL analysis, a push to `main` starts a build, and Ubuntu runners cache APT packages.
- CI computed the image build date twice, so an image built just before midnight UTC got a tag from one day and a label from the next. The date is computed once now.

## Presets along three axes {#presets}

Before this cycle, building for another platform lived in my head: I recalled the order of the flags each time, and didn't always recall it right. I laid the CMake presets out along three axes. Build type comes from the `type-*` presets. Platform comes from 13 `platform-*` presets, from Windows on two architectures to the Mega Drive, the Nintendo 64 and the Wii. The set of components comes from `with-tests`, `with-benchmarks`, `with-samples` and `with-editor`. Where the axes cross stand 36 concrete presets such as `gba-release`. I used to build toys from standard parts the same way: a shell from one box, a movement from another, a key from a third.

The map refused to open at first. `cmake --list-presets` failed with `File version must be 3 or higher for toolchainFile preset support`: the file header said version 1, and eight presets already pointed at toolchain files.

The second break was quieter. Every concrete preset inherited the shared `base` and the presets of its axes, and `base` came first in the `inherits` list. On a conflict CMake takes the value from the preset listed earlier. So `base` overrode everything: components were switched off despite `with-*`, and Xcode and Visual Studio were silently swapped for Ninja. I moved `base` to the end of the list in all 36 presets and checked with live runs. `macos-release` turned its components on, and `macos-xcode` produced a real `ToyGine2.xcodeproj` for the first time.

Here I made a mistake of my own. Review suggested adding debug presets for MSVC and Xcode, and I said no, reasoning that those generators are multi-config. I based that on the generator the preset declared, while Ninja was the one actually running, and the script I used to compute the effective values applied the priority backwards. Now I look in `CMakeCache.txt` instead of reasoning about what ought to be there.

The Nintendo 64 turned up separately. There's no toolchain for it in `cmake/`, and `cmake --preset n64-debug` happily configured with the system `/usr/bin/c++`, posing as an N64 build. Now configuration fails with `Nintendo 64 toolchain is not integrated yet`.

A preset is code too, and the only way to check it is by what actually reached the cache. For someone building the engine it comes down to one command: `cmake --preset gba-release` builds for the GBA, and a platform without a toolchain says so instead of building something for the host.

![Three open boxes of toy shells, clockwork movements and wind-up keys, with one toy in front built from a part of each](/img/blog/2026-08-03-1.webp)

## Documentation that couldn't fail {#docs}

Doxygen builds the engine's documentation, and CI had a separate workflow for it. I broke a `\param` in a header and ran the build. The exit code was 0 and the console was empty. `WARN_AS_ERROR` was set to `NO`, and the warnings went into `doxygen.log`, which nobody read.

I switched to `WARN_AS_ERROR = FAIL_ON_WARNINGS_PRINT` rather than `YES`. `YES` stops at the first warning, while this mode prints the whole list in one run and only then fails. The strictness surfaced an old break right away: CI failed with `error: clang: Failed to parse translation unit` for `src/core/utils.cpp` and `include/toygine.hpp`. Clang-assisted parsing only ran in CI, because the official Doxygen binary is built with libclang and my local one isn't. The errors had been there all along; with the old setting they just didn't change the exit code. I turned `CLANG_ASSISTED_PARSING` off, and since then the config has no options that depend on how Doxygen itself was built.

Two more things turned up on the way. Doxygen put a Mermaid loader from a CDN into every HTML page, with a floating version, even though the repository had no diagrams at all. I switched to `MERMAID_RENDER_MODE = CLI`, which renders diagrams at build time, and no CDN links are left in the output. And the CI step that downloads Doxygen called `curl` without `--fail`. On a 404 curl exited with 0 and wrote the error page into `doxygen.tar.gz`, so the "failed to download" check never fired. The failure showed up a line later as an unhelpful `tar: not in gzip format`. Now `curl` runs with `--fail`.

A check that reports to a file rather than through its exit code checks nothing. Switching strictness on for the first time also brought out problems that had been there all along. For someone reading the engine reference, this means every pull request rebuilds it and won't let through a broken reference or a `\param` naming a parameter that doesn't exist.

![The toymaker unwinds a strip of felt from the clapper of a brass bell that lay on the bench unable to ring](/img/blog/2026-08-03-2.webp)

## The Mega Drive in a CI container {#md-image}

The CI matrix builds the engine for 15 targets. The eight desktop ones run on ordinary GitHub runners, and the seven consoles run in Docker containers with toolchains, which I build in a separate repository and publish on ghcr. Six of those images sit on devkitPro. The seventh, for the Mega Drive, I build myself: `debian:bookworm-slim`, GCC for m68k from source, and ClownMDSDK. That's where the build kept failing, each time in a new place.

First, checkout itself failed with `EACCES`. The Mega Drive image was the only one with a non-root user. The runner mounts its work directory into the container and creates bookkeeping files as its own user, then starts the container without `--user`. `actions/checkout` couldn't write its state. I removed the `USER` directive from the image.

Then checkout went through, but without submodules: `Input 'submodules' not supported when falling back to download using the GitHub REST API`. `actions/checkout` uses `git` from the image itself, the slim image had none, and the action silently switched to downloading an archive through the API. I added `git` to the final stage of the image and found two more holes before the next run. Every engine preset uses Ninja, and the image had no `ninja-build`. The `cmake` from Debian's main repository was 3.25, while the engine needs 3.27, so I took it from `bookworm-backports`.

Then I went through the image's environment variables, and the first one I found was `ENV PREFIX=/opt/clownmdsdk`. In the final image it's dangerous: someone else's project gets mounted into the container, `PREFIX ?= /usr/local` in its Makefile takes its value from the environment, and `make install` would have gone into the SDK directory. I renamed the variable to `CLOWNMDSDK`. Next to it sat `LANG=en_US.UTF-8`, while the slim image has no `locales` package. I checked inside the container: `locale charmap` fell back to `ANSI_X3.4-1968`, so UTF-8 was never on at all. I replaced it with `C.UTF-8`, a locale built into glibc itself that costs nothing.

The GBA image had a similar hole. The builder stage compiled `mgba-headless` and copied it into the final image without ever running it. I added a smoke test, and `mgba-headless --version` exited with 1: without a file name mGBA gives up before it even looks at the version flag. What works is `mgba-headless --version placeholder.gba`. The file doesn't exist, but the version branch exits before the emulator ever looks for it. The test also compares the commit baked into the binary with the one pinned in the Dockerfile, and right now they match.

<details>
<summary>Why the failing step wasn't the one I was looking at</summary>

My first guess was that the runner couldn't even run `cat /etc/*release` in the container. The log said otherwise: that command worked, and the next step, checkout, failed while writing its state. The cause had to be found in who creates files in the mounted directory, and as which user.

</details>

A toolchain container is part of the build, and the CI runner has its own expectations of it: root, `git` inside, the generator the presets ask for. For someone building the engine for the Mega Drive, this means there's no SDK to install: the image CI works in is on ghcr, and you can build the engine in it on your own machine.

![A Sega Mega Drive in an open wooden crate among tools, as the toymaker adds one more screwdriver](/img/blog/2026-08-03-3.webp)

## What's next {#next}

The engine builds for 15 targets, but the build doesn't check anything yet: it has no tests, and the benchmarks option is on everywhere even though there are no benchmarks. The next step is the first tests, their registration with CTest, and a run in CI.
