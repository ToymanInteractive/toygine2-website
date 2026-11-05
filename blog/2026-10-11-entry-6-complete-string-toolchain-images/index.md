---
slug: entry-6-complete-string-toolchain-images
title: "Entry 6: The String Is Finished and CI Moves into Its Own Images"
authors: [dmitry]
tags: [cpp, ci, docker, testing, benchmarks, linux, md, switch]
date: 2026-10-11
description: >
  The sixth entry in the retro shop journal. toy::String gained the full set of
  operations and was checked against std::string by exhaustive comparison, the
  Linux builds moved into the engine's own toolchain Docker images, and a new
  application module brought pid(), sleep() and yield() to every target.
image: /img/blog/2026-10-11-1.webp
sidebar_position: 1
---

The soldering iron sat in its stand the whole two weeks. I'm writing ToyGine2, an engine for small games that should run on modern machines and on retro hardware. This cycle `toy::String` gained the full set of operations, the Linux builds moved into toolchain images of their own, and the engine got an `application` module.

<!-- truncate -->

[In short](#short) · [The string is finished](#string) · [Our own toolchain images](#images) · [The application module](#application) · [What didn't work](#failed) · [Numbers](#numbers) · [What's next](#next)

## In short {#short}

`toy::String` is done: every group of operations is modelled on `std::string` and verified against it by exhaustive comparison, with no discrepancies left. The Linux jobs no longer install compilers on the runner: builds, tests, coverage, static analysis and documentation all run in containers with GCC 16.2.0 and Clang 23.1.2. A new `application` module appeared: `BaseApplication` with a version, plus `pid()`, `sleep()` and `yield()` on every target. All of this went into 26.21.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.21.0).

- The `video` module started with `Color32`: one byte order for R, G, B and A on every target, big-endian consoles included, and conversion into platform formats is an explicit step.
- Logging gained `log::Record`, `log::ISink` and the v1 pipeline specification: a message is formatted at the moment of output, not on the stack of every call site.
- Third-party dependencies moved up: Vulkan-Headers and volk to 1.4.365, libpng to 1.6.59, zlib to a fresh `develop` commit.

## The string is finished {#string}

Two entries ago `StringView` gained search and comparison; the last one gave `FixedString` assignment. This time I was finishing `toy::String` itself, working through the cppreference list group by group: element access, iterators, size and capacity, modifiers, search and comparison, free functions. Four days, six pull requests.

The first fork in the road was about overloads. The iterator of `String` is a `char *`, and the positional overloads from the standard collide with the index ones on the literal `0`: `s.erase(0)` becomes ambiguous. The standard libraries don't have this problem, because libstdc++, libc++ and the MSVC STL wrap the pointer in a class. I measured what the wrapper costs.

<details>
<summary>Measuring the iterator wrapper on eight targets</summary>

The wrapper modelled `std::contiguous_iterator`. Measurements ran on Apple clang 21, clang 23, GCC 16 (x64 and arm64), m68k, PowerPC, ARM7 and MSVC. libc++ and the MSVC STL unfold the wrapper, and the code matches the raw pointer. libstdc++ loses the `memcmp` in `std::equal` and the `memmove` in `std::ranges::copy` even at `-O2` and `-Os`, on every GCC target, retro ones included: at `-O3` on m68k it produced 145 instructions against 16 with a `memmove` call. In a debug build the hand-written loop is 3–4 times slower, and `std::equal` on GCC is 155 times slower.

</details>

There would be no wrapper: the positional overloads became a constrained template, `template <std::convertible_to<const char *> PositionIterator>`. A separate ban on integers isn't needed, since `int` doesn't convert to a pointer implicitly.

Inserts and erases all funnel into one private `_replace()`. A source inside the string is remembered as an offset, not a pointer: `reserve()` on growing storage relocates the buffer, and the old pointer goes stale. It works like bank switching in a cartridge: the address stays the same, but a different chunk of data is connected behind it. Review made me rewrite the single-pass replace: the first characters of the source are written over the region being replaced, and the peak length equals the final one.

Search and comparison moved into the shared `toy::string_utils`, functions over a pointer-and-length pair; both `String` and `StringView` call them. The view no longer recomputes the length or truncates the string at an embedded `'\0'`.

I checked the result against the standard by exhaustive comparison under ASan, UBSan and GCC 16.2: search ran 8.4 million comparisons against `std::string`, modifiers four million, free functions 3.2 million. No discrepancies.

One run wasn't clean: Clang 23 on x86_64 broke the search over a character set containing a byte above ASCII, and two runtime checks had to be disabled until LLVM fixes it.

<details>
<summary>A compiler bug in Clang 23, and how I found it</summary>

The `string_utils` test failed on Clang 23 under x86_64: `find_first_not_of("a\xff")` over `"a\xffb"` returned 1 instead of 2. UBSan and ASan were clean, and `char` signedness had nothing to do with it: `-fsigned-char` and `-funsigned-char` give the same result. Bisecting the optimizer passes with `-opt-bisect-limit` pointed at `instcombine`. I reduced everything to a C program with no engine and no libc++: `opt-22` produces `icmp ult i64 %i, 2`, while `opt-23` and `opt-24` produce `icmp eq i64 %i, 0`. Version 22.1.8 is correct; 23.1.2, 23.1.3 and trunk 24 are wrong; GCC 16.2 is correct; and on arm64 the C program doesn't reproduce the bug. I filed [llvm/llvm-project#228213](https://github.com/llvm/llvm-project/issues/228213) and disabled the two checks under Clang 23 on x86_64. The condition deliberately tests `__clang_major__ == 23`: when we move to 24, the checks switch back on and will show whether the bug is fixed.

</details>

Then the Mega Drive failed, and it failed oddly: only the runtime checks fell over, while the `static_assert`s passed. I looked at the SDK's `memmove` from `libc.a` in a disassembler: it is an unrolled `move.b (a1)+,(a0)+` loop, forward-only copying. If the destination is to the right of the source and the ranges overlap, the tail gets overwritten before it gets read, and an insert shifts the tail exactly that way. In the previous cycle I had checked that the overlay wins at link time, but not the functions that stayed in the SDK. Now the overlay replaces `memcpy`, `memmove` and `memset` together: they live in one `string.o`, and replacing `memmove` alone would give a `multiple definition`.

The collector dropped by and asked whether tests that pass in an emulator can be trusted. I said not fully: I read the `memmove` in a disassembler, the ROM ran only in BlastEm, and nothing ran on real hardware this cycle.

For someone writing a game, one thing changed: `toy::String` covers the whole `std::string` operation set except the numeric conversions. The freestanding MD build has neither `<charconv>` nor `<cstdio>`. Together with `FixedString`, the string still never touches the heap.

<!--
ДЛЯ ЧЕЛОВЕКА: заглавный кадр темы про toy::String. С первого взгляда должно
читаться, что в ряд одинаковых картриджей вставляют ещё один, весь хвост ряда
уезжает в одну сторону, а последний картридж уже выдавлен за край. Пропорции
2:1, минимум 1200 x 630. Если генерация не сложится, кадр заменяется снимком
ряда картриджей на столе с одним лишним сбоку.

ALT RU: Ряд одинаковых серых картриджей на ремонтном столе: в середину вставляют ещё один, все правее сдвинуты на ячейку, последний выдавлен за край
ALT EN: A row of identical grey cartridges on the repair bench: one more is going into the middle, everything to the right has shifted a slot, the last one is pushed over the edge

ДЛЯ AI:
Seen from directly above at a slight angle, the repair bench at the back of
the shop holds a straight row of twelve identical pale grey game cartridges
lying on their sides, edge to edge, on a dark work mat. The shopkeeper's
hands, sleeves pushed up, are inserting a thirteenth cartridge into the
middle of the row: the gap is open at the sixth position, the six cartridges
to the right of it have all slid one slot along, and the last cartridge of
the row has been pushed off its end and now lies tilted on the bare bench,
half over the edge of the mat. The lit magnifier on its articulated bracket
is swung low over the open gap, its round lens catching one warm highlight.
Behind the bench, softly out of focus, wooden shelves hold boxed games and
cassettes. The row of cartridges runs across the middle of the frame and
dominates it, and the fallen cartridge at the right edge shows what the
shift cost.

FORMAT: 2:1 aspect ratio, at least 1200 x 630 pixels, white border included.
CAPTION: "October 2026"

STYLE (identical across all images, so the set reads as one series):
  a hand-painted illustration in the style of Studio Ghibli films:
  watercolour-like painted backgrounds, soft cel shading, clean
  confident linework and warm diffuse shadows. It must read at once as
  a drawing, not a photograph. The illustration is presented as a
  colour print from a late 1980s or 1990s family photo album: a glossy
  paper print with a plain white border on all four sides. The image is
  the scanned print itself: the white border runs to the edges of the
  image, with no table, album page or background around it. Inside the
  border is a cosy, cluttered-but-ordered retro game shop in the spirit
  of the antique shop in Whisper of the Heart, where every object has
  its place: wooden shelves of boxed games, cartridges and cassettes,
  old consoles and home computers, a repair bench at the back. Game
  consoles, computers and media are drawn true to the shape and colour
  described in the scene above, recognisable by form alone, with no
  lettering or logos on their shells. The only writing anywhere is the CAPTION text, handwritten in
  blue ballpoint ink in small neat letters on the bottom white border,
  left of centre. Unless the scene above states otherwise, the only
  person in frame is the shopkeeper, seen from behind or as hands at
  the repair bench: a knitted cardigan over a plain shirt, sleeves
  pushed up.
PALETTE: faded warm print colours: walnut wood, beige and grey console
  plastic, creamy highlights and slightly lifted blacks, with a cool
  teal-green accent from old CRT glow; the white border slightly
  yellowed with age.
LIGHT AND TEXTURE: warm lamplight from one side, soft painted shadows,
  a gentle glow around lamps and the CRT screen, light film grain over
  the whole print, soft vignetting.
NEGATIVE: no legible text, lettering, labels or numerals inside the
  picture, including on screens, cartridges, boxes and console shells;
  no logos, brand marks or watermarks; no real brand or model names
  anywhere; no readable code on screens; no writing on the border
  other than the caption; no torn or ragged
  edges, no album page, table or background around the print; no
  photorealism or photographic rendering of the scene; no 3D render or
  CGI look; no flat vector or modern digital illustration look; no HDR
  or oversaturated colour; no neon or cyberpunk palette; no close-up
  human faces; no clutter that hides the subject.
-->

![A row of identical grey cartridges on the repair bench: one more is going into the middle, everything to the right has shifted a slot, the last one is pushed over the edge](/img/blog/2026-10-11-1.webp)

## Our own toolchain images {#images}

The engine's Linux jobs installed compilers on the runner every time: `gcc-16` through apt, `clang-23` from apt.llvm.org. I wanted a fresh stable Clang in CI, started digging, and found something unpleasant: `gcc-16` in Ubuntu 26.04 is a snapshot built before the 16.1 release. CI had been building the engine with something other than a stable GCC.

That is how two new images appeared in the image repository. I built GCC 16.2.0 from source, C and C++ only: no bootstrap and no multilib, since three stages would have tripled the build time for the same result. A cold build on an arm64 Mac took 547 seconds, and the image weighs 547 MB. Clang 23.1.2 came from the LLVM release archive with selective extraction, and with its own libc++ 23: without a standard library, Clang on trixie would take libstdc++ from the system GCC 14 and lose part of C++23. The engine is now tested against two STL implementations, libstdc++ in the GCC image and libc++ in the Clang image. apt.llvm.org was no good: a third-party repository where the patch version can't be pinned. From the archive I only had to rebuild lld, which is statically linked against libxml2 from Ubuntu 22.04 and demands ICU 70, while trixie has ICU 76 with versioned symbols.

The defaults (lld, compiler-rt, libunwind, libc++) are baked into `clang.cfg` and `clang++.cfg` next to the binaries, so the engine's CMake asks for no flags and no `CC` or `CXX`. Two weekly workflows move the pins: GCC takes the top directory on ftp.gnu.org and verifies the tarball signature through `gpgv`; LLVM reads the hashes from the release's `digest` asset and moves the pin forward only.

After that the images grew. `python3` went into four Debian images, because the benchmark script needs `csv` and `statistics`. lcov 2.5 came from the upstream release: the Debian package would have pulled in GCC 14 and 251 MB, and in the Clang image it would have defeated the whole point. `clang-tidy` and `clang-format` were extracted from the same LLVM archive; after `llvm-strip`, clang-tidy shrank from 177 to 116 MB. All eleven images got the GitHub CLI, an upstream release downloaded without emulating the target architecture. The GCC image also took `gpg` and `gpg-agent`, since without them codecov can't verify its CLI's signature. I set `git safe.directory` in every image: a local run with the repository mounted fell over on `dubious ownership`. Later the set grew to three images: the documentation is built by Doxygen 1.18.0 from source on top of the GCC image.

Next to `latest` and the build date, the images got a compiler version tag, `gcc-16.2.0` or `clang-23.1.2`, and a workflow can pin to it. The tag is applied only after a check: the image is pushed by digest, runners on both platforms print the compiler version, and the tags are published only when they match.

On the engine side, every APT step left the workflows. The build matrix on x64 and arm64 with both compilers, the style check, tests with coverage (211 tests, 98.2% of lines), SonarCloud, CodeQL and the documentation check all run in containers. I didn't build amd64 locally; CI checked it first.

For anyone building the engine: the runner installs nothing anymore, and running the same image locally gives the same compiler as CI. You can pin a version with the `gcc-16.2.0` tag, and the digest is there for full reproducibility.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про образы тулчейнов, «было/стало» в одной
плоскости. Слева — то, что было: раннер каждый раз распаковывает присланное
по сети. Справа — то, что стало: один ящик с тремя отсеками, где всё уже
разложено; три отсека — три новых образа цикла (GCC, Clang, документация).
Пропорции 16:9, минимум 1600 x 900. Если генерация не сложится, кадр
заменяется снимком двух половин ремонтного стола сверху.

ALT RU: Слева на столе открытая коробка, сетевой кабель и россыпь деталей, справа — деревянный ящик с тремя отсеками, в каждом свой набор инструмента
ALT EN: On the left an open box, a network cable and loose parts on the bench; on the right a wooden crate with three compartments, each holding its own set of tools

ДЛЯ AI:
The repair bench seen from directly above, split into two halves by a seam
in the dark work mat. On the left half the bench is a mess of arrival: an
open plain cardboard box on its side, a coiled grey network cable spilled
out of it, and a scatter of loose components and small parts half unpacked
across the mat, with a crumpled sheet of packing paper. On the right half
one neat wooden crate stands with its hinged lid open and laid flat beside
it; inside, the crate is divided into three square compartments, and each
compartment holds its own distinct set of tools of different materials and
colours: heavy steel wrenches and pliers in the first, slim precision
screwdrivers with brass handles in the second, a folding magnifier and a
small spirit level in the third. Nothing on the right half lies outside its
compartment. The shopkeeper's hands, sleeves pushed up, rest on the rim of
the crate. Warm lamplight falls from the left, and behind the bench,
softly out of focus, wooden shelves hold boxed games.

FORMAT: 16:9 aspect ratio, at least 1600 x 900 pixels, white border included.
CAPTION: "October 2026"

STYLE (identical across all images, so the set reads as one series):
  a hand-painted illustration in the style of Studio Ghibli films:
  watercolour-like painted backgrounds, soft cel shading, clean
  confident linework and warm diffuse shadows. It must read at once as
  a drawing, not a photograph. The illustration is presented as a
  colour print from a late 1980s or 1990s family photo album: a glossy
  paper print with a plain white border on all four sides. The image is
  the scanned print itself: the white border runs to the edges of the
  image, with no table, album page or background around it. Inside the
  border is a cosy, cluttered-but-ordered retro game shop in the spirit
  of the antique shop in Whisper of the Heart, where every object has
  its place: wooden shelves of boxed games, cartridges and cassettes,
  old consoles and home computers, a repair bench at the back. Game
  consoles, computers and media are drawn true to the shape and colour
  described in the scene above, recognisable by form alone, with no
  lettering or logos on their shells. The only writing anywhere is the CAPTION text, handwritten in
  blue ballpoint ink in small neat letters on the bottom white border,
  left of centre. Unless the scene above states otherwise, the only
  person in frame is the shopkeeper, seen from behind or as hands at
  the repair bench: a knitted cardigan over a plain shirt, sleeves
  pushed up.
PALETTE: faded warm print colours: walnut wood, beige and grey console
  plastic, creamy highlights and slightly lifted blacks, with a cool
  teal-green accent from old CRT glow; the white border slightly
  yellowed with age.
LIGHT AND TEXTURE: warm lamplight from one side, soft painted shadows,
  a gentle glow around lamps and the CRT screen, light film grain over
  the whole print, soft vignetting.
NEGATIVE: no legible text, lettering, labels or numerals inside the
  picture, including on screens, cartridges, boxes and console shells;
  no logos, brand marks or watermarks; no real brand or model names
  anywhere; no readable code on screens; no writing on the border
  other than the caption; no torn or ragged
  edges, no album page, table or background around the print; no
  photorealism or photographic rendering of the scene; no 3D render or
  CGI look; no flat vector or modern digital illustration look; no HDR
  or oversaturated colour; no neon or cyberpunk palette; no close-up
  human faces; no clutter that hides the subject.
-->

![On the left an open box, a network cable and loose parts on the bench; on the right a wooden crate with three compartments, each holding its own set of tools](/img/blog/2026-10-11-2.webp)

## The application module {#application}

`application::Version` appeared two entries ago, but until now only the sample owned it, with a hard-coded literal. Three pull requests in one day: the class itself, the process identifier, sleep and yield.

`BaseApplication` stores a `Version`, its constructor is `explicit constexpr noexcept`, and the accessor is `version()`. The tests deliberately don't pin copyability: the name "Base" promises that the class will grow to own subsystems, and a `static_assert` would freeze a design nobody ordered.

`pid()` returns zero when the target is built with the stub or the system call fails. Zero is the sentinel here, although the engine convention says to prefer `std::optional`; I raised the question and left the contract alone. On Switch the system call gives back 64 bits, and the result narrows to `uint32_t`. That is documented rather than fixed.

`sleep()` on Windows and Switch splits into chunks. `Sleep` has `INFINITE` as its ceiling, and chunks of `INFINITE - 1` preserve the duration. `svcSleepThread` takes nanoseconds in a signed 64-bit argument, and the multiplication used to overflow there. Like a cassette load, a block that doesn't fit in one piece is read in portions, and the total length doesn't change. The `do … while` loop preserves the old `sleep(0)` behaviour. POSIX retries `nanosleep` on `EINTR`. On the 3DS there is nothing to split: `size_t` is 32-bit there. The Wii U came off the stub and now has its own `OSSleepTicks` and `OSYieldThread`.

I have no Windows or Switch toolchains, so I checked both implementations on the host. The Windows file compiled on macOS with a `windows.h` stub that records `Sleep` calls: at zero, one, `0xFFFFFFFF` and twenty billion milliseconds, the sum of the chunks equals the request, and `INFINITE` is never passed through. The Switch file ran under UBSan from zero to `SIZE_MAX`. Nothing ran on the consoles, and there are no tests for `sleep()` and `yield()` yet.

For someone writing a game: there is now an application class that holds the version, and sleep and yield are one call on any target. The caveat is written into the contract: on targets without threads, `sleep()` returns at once.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про sleep() и yield() на всех целях. С первого
взгляда должно читаться, что к двум разным приставкам подходит один и тот же
провод: один вызов, разные реализации. Пропорции 16:9, минимум 1600 x 900.
Если генерация не сложится, кадр заменяется снимком двух приставок на столе
с одним разветвителем.

ALT RU: Две разные приставки на ремонтном столе подключены к одному разветвителю провода, а рука хозяина держит его общий конец
ALT EN: Two different consoles on the repair bench are wired into one splitter, and the shopkeeper's hand holds its common end

ДЛЯ AI:
On the repair bench two home consoles of different generations stand side
by side, both whole and closed. On the left, a long, slim glossy black
32-bit home console from the early 2010s lies flat, with a disc slot on its
front, beside a large black tablet-like controller with a screen in the
middle and two analogue sticks. On the right, a 64-bit hybrid console from
the late 2010s stands on its kickstand: a flat black tablet with a wide
screen, a detachable blue controller on its left side and a red one on its
right. From a single socket at the back edge of the bench one black cable
runs forward and splits at a small Y-shaped splitter into two different
plugs, one reaching the power input of each console. The shopkeeper's hand,
sleeve pushed up, holds the common end of the cable just before the split.
Both consoles are awake: two small power lights glow, and both screens stay
dark and blank. Seen from a low three-quarter angle, the two consoles fill
the frame left and right and the splitter sits in the middle, lit warmly
from the left. Behind them, softly out of focus, wooden shelves hold boxed
games and cassettes.

REFERENCE: draw the console on the left exactly as in this photo:
  https://upload.wikimedia.org/wikipedia/commons/4/4a/Wii_U_Console_and_Gamepad.png
  (assembled). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photo shows.
REFERENCE: draw the console on the right exactly as in this photo:
  https://upload.wikimedia.org/wikipedia/commons/8/88/Nintendo-Switch-wJoyCons-BlRd-Standing-FL.jpg
  (assembled). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photo shows.

FORMAT: 16:9 aspect ratio, at least 1600 x 900 pixels, white border included.
CAPTION: "32-bit home console, 8th generation; 64-bit hybrid console, 8th generation, October 2026"

STYLE (identical across all images, so the set reads as one series):
  a hand-painted illustration in the style of Studio Ghibli films:
  watercolour-like painted backgrounds, soft cel shading, clean
  confident linework and warm diffuse shadows. It must read at once as
  a drawing, not a photograph. The illustration is presented as a
  colour print from a late 1980s or 1990s family photo album: a glossy
  paper print with a plain white border on all four sides. The image is
  the scanned print itself: the white border runs to the edges of the
  image, with no table, album page or background around it. Inside the
  border is a cosy, cluttered-but-ordered retro game shop in the spirit
  of the antique shop in Whisper of the Heart, where every object has
  its place: wooden shelves of boxed games, cartridges and cassettes,
  old consoles and home computers, a repair bench at the back. Game
  consoles, computers and media are drawn true to the shape and colour
  described in the scene above, recognisable by form alone, with no
  lettering or logos on their shells. The only writing anywhere is the CAPTION text, handwritten in
  blue ballpoint ink in small neat letters on the bottom white border,
  left of centre. Unless the scene above states otherwise, the only
  person in frame is the shopkeeper, seen from behind or as hands at
  the repair bench: a knitted cardigan over a plain shirt, sleeves
  pushed up.
PALETTE: faded warm print colours: walnut wood, beige and grey console
  plastic, creamy highlights and slightly lifted blacks, with a cool
  teal-green accent from old CRT glow; the white border slightly
  yellowed with age.
LIGHT AND TEXTURE: warm lamplight from one side, soft painted shadows,
  a gentle glow around lamps and the CRT screen, light film grain over
  the whole print, soft vignetting.
NEGATIVE: no legible text, lettering, labels or numerals inside the
  picture, including on screens, cartridges, boxes and console shells;
  no logos, brand marks or watermarks; no real brand or model names
  anywhere; no readable code on screens; no writing on the border
  other than the caption; no torn or ragged
  edges, no album page, table or background around the print; no
  photorealism or photographic rendering of the scene; no 3D render or
  CGI look; no flat vector or modern digital illustration look; no HDR
  or oversaturated colour; no neon or cyberpunk palette; no close-up
  human faces; no clutter that hides the subject.
-->

![Two different consoles on the repair bench are wired into one splitter, and the shopkeeper's hand holds its common end](/img/blog/2026-10-11-3.webp)

## What didn't work {#failed}

I built Doxygen with libclang 23 but shelved it: assisted parsing needs workarounds in the Doxyfile and loses the call graphs, 484 of them down to two. The documentation image took the variant without libclang.

I added the `_s` literal and removed it in the same session. `String("player")` deduces `FixedString<7>`, a string born from a literal is born complete, and `"player"_s += '1'` silently leaves `"player"` where it was. The deduction guide stayed, and the warning moved into its documentation.

The `TOYGINE_DEBUG` assert gate lies in a branch, unmerged. While it is missing, fourteen `*_rejected` test cases had to go from main: they checked what a function does when its precondition is violated, and that is not the contract. With the gate they would run only in Release, which CI doesn't build.

I didn't verify CodeQL tracing in a container with a real run. A real `sleep()` on the retro targets is postponed: nobody calls the method yet.

## Numbers {#numbers}

`toy::String` against `std::string`, measured on macOS:

| Operation | toy against std |
| --- | --- |
| `substr` | 4.3 times faster |
| `operator+` | 1.37 times faster |
| `replace`, `erase`, `insert` | faster |
| `find_first_of`, `rfind` | 1.5 times slower |
| `swap` | 14 times slower, by design |

What the images weigh, arm64, uncompressed:

| What | Weight |
| --- | --- |
| GCC 16.2.0 image | 547 MB |
| Clang 23.1.2 image with libc++ | 930 MB |
| clang-tidy and clang-format in the Clang image | +119 MB |
| Documentation image with Doxygen 1.18.0 | 739 MB |
| `python3` | +35 MB on GCC and Clang, +27 MB on Mega Drive, +43 MB on N64 |
| lcov 2.5 with the Perl modules and `llvm-cov` | +44 MB |
| GitHub CLI | +39 MB |

## What's next {#next}

The next cycle starts with logging. Step one is the `Writer` and the formatter: a format string with `{}` and `{N}` that can't be mixed, compile-time checks, integers of every width, pointers, scoped enums, and custom types through `operator<<` with ADL. The `chrono` specification follows it: the output line starts with the time.

The `Color32` plan still has the integer colour arithmetic, the nine packed console formats and verification on every target. The branch with the `TOYGINE_DEBUG` gate is waiting to merge. `string_utils::findFirstOf` and `rfind` need to catch up: both operations are one and a half times slower than the standard ones. A test for the duration of `sleep(N)` sits there too, and the move of the workflows onto compiler version tags.
