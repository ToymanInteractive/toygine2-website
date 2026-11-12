---
slug: entry-7-console-benchmarks-application
title: "Entry 7: Benchmarks Reach the Consoles and the Application Learns to Start"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, benchmarks, md, gba, windows, linux, macos]
date: 2026-10-25
description: >
  The seventh entry in the retro shop journal. The benchmarks reached the GBA
  and the Mega Drive and run in CI under emulators, the MD overlay's string
  routines were rewritten in 68000 assembly, and the application module learned
  to start and write to the console on macOS, Linux and Windows.
image: /img/blog/2026-10-25-1.webp
sidebar_position: 1
---

The lit magnifier stood over the repair bench all week: I was reading disassembly and counting cycles. I'm writing ToyGine2, an engine for small games that should run on modern machines and on the retro hardware on my shelf. This cycle went into measuring and starting up: the benchmarks reached the GBA and the Mega Drive, the MD string routines were rewritten in 68000 assembly, and the application learned to start and write to the console.

<!-- truncate -->

[In short](#short) · [Benchmarks reach the consoles](#consoles) · [Mega Drive strings in assembly](#asm) · [The application learns to start](#application) · [What didn't work](#failed) · [What's next](#next)

## In short {#short}

The benchmarks are no longer desktop-only: CI runs them under mGBA on the GBA and under BlastEm on the Mega Drive, and a copy of the report goes into the cartridge SRAM, where a flashcart will be able to pick it up on real hardware. Character-set search got several times faster on both consoles, and the MD overlay's string routines were rewritten in assembly. The `application` module grew up: an abstract `BaseApplication` with `run()` and arguments, an entry point provided by the platform, and console output on macOS, Linux and Windows. All of this went into 26.22.0, and [the release is on GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.22.0).

- The asserts used to not compile at all on GCC and Clang: the `_DEBUG` gate is set only by MSVC. Now the `TOYGINE_DEBUG` gate works in Debug and RelWithDebInfo on every platform and arrives through the `toygine::compile::defines` INTERFACE group.
- The assertion handler answers with an action, `Break`, `Ignore`, `IgnoreAlways` or `Abort`, instead of a `bool`. Without a handler a failure no longer passes silently; `IgnoreAlways` is desktop-only: on the test ROMs it cost +5.8 KB on the MD and +4.1 KB on the GBA.
- Compiler flags are sorted into groups, each with its own reach: warnings, ABI-safe optimizations, defines. The shipping build's fallback paths are checked by a separate CI job, which immediately found that `linux-shipping` didn't build.
- The string review: `operator+` with a non-`String` on the left is built the way std does it, the storage concept now requires default construction and moves, and `StringView` comparisons became hidden `friend`s.
- Flag enums: the operators are found through ADL in the enum's own namespace, the base type must be unsigned and not `bool`, and `hasAny()` and `hasAll()` appeared.
- Tests without their own setup take `main` from doctest, and the built-in runner no longer links the engine; `CodeCoverage.cmake` moved into `thirdparty/` as an upstream file with two patches.

## Benchmarks reach the consoles {#consoles}

In the last entry I was going to start on logging, but first I finished the console benchmark plan: six tasks were left, and all of them landed in one day, October 12, five sessions and five pull requests. The point is simple: the engine's numbers should be taken on the hardware it will work on, not only on my Mac.

The console report is the same CSV as on the desktop: rows in name order, `# done` at the end. Where does it go on a console? Real hardware has no emulator log, no debug port, no stdout. What it has is cartridge SRAM: a flashcart dumps it to a `.sav` on the SD card, and the same script parses the dump. `SramWriter` writes one byte per character with stride 1 on the GBA and 2 on the MD (only odd addresses reach the cartridge memory there), always with a trailing zero and room for `# truncated`.

Time on the GBA is counted by a Timer 2/3 cascade at 16.78 MHz; on the MD, by scanlines: a frame counter plus the video chip's V-counter, about 64 µs per line, 262 lines per NTSC frame and 313 per PAL one. mGBA counts the timers from emulated CPU cycles, and the ARM7TDMI has no cache, so two runs match byte for byte. On the MD the timestamp taken in vblank lags by up to 37 lines on NTSC and 88 on PAL; that is written into the contract, not hidden.

In CI the benchmarks run under mgba-headless and BlastEm. An emulator exits with zero even when the runner died, so the CI step checks for `# done` in the log. An overlong row or an uncalibrated one gives `# failed rows: N` instead of `# done` and a red background. The `std::` reference rows stayed on the desktop: the MD's freestanding library has no `<string>`, the console reports carry only the engine rows, and regressions are caught by the Bencher history. The desktop jobs still compile the `std::` rows so they don't rot.

The first thing the new numbers did was close an old deferred change. Character-set search builds a `bool[256]` membership table once per call, then runs in O(n + m). I had written and rolled back that table before: there was nothing to measure the consoles on then. Now I measured four table shapes on the GBA, the MD and macOS; `bool[256]` won almost everywhere. `find_first_of` on the MD went from 6.07 to 1.94 ms, on the GBA from 1.60 to 0.317 ms. Along the way `utf8_size()` became `constexpr` and reads exactly `size()` bytes; it used to read up to the terminator, a latent bug that the future `substr` would have stepped on.

<details>
<summary>Four table shapes and an ODR violation on the way</summary>

Any shape beats the old per-byte `memchr`: 3.5–14 times on the MD, 4–18 times on the GBA. `uint64_t[4]` is worst everywhere, `uint8_t[32]` is about equal to `uint32_t[8]`. `bool[256]` is fastest on the GBA, on the desktop and on long MD strings; on 103 bytes the MD loses 11% to `uint32_t[8]`, because the overlay's `memset` writes byte by byte, about 6,000 cycles per 256 bytes. The MD has about 60 KB of free stack, so 256 bytes go unnoticed. I first hid the table helpers in an anonymous namespace inside the `.inl`, which is an ODR violation: inline functions with external linkage call functions with internal linkage, one per translation unit. Sonar flagged the same thing as `cpp:S1000`; the helpers moved into `detail`.

</details>

For someone writing a game: character-set search on a console got several times cheaper, and that is measured, not promised. What matters more to me: a regression on the MD or the GBA is now visible in CI just like on the desktop. The honest caveat: an emulator is not hardware. Zero run-to-run variance means Bencher's t-test will alert on almost any change. The threshold for the console testbeds is still to be picked. And checking the timers against real hardware is exactly what the SRAM copy is for.

<!--
ДЛЯ ЧЕЛОВЕКА: заглавный кадр темы про бенчмарки на приставках. С первого
взгляда должно читаться, что две приставки разных поколений закончили
прогон: один и тот же зелёный фон на маленьком экране портативной и на
ЭЛТ рядом. Пропорции 2:1, минимум 1200 × 630. Если генерация не сложится,
кадр заменяется снимком двух приставок на ремонтном столе.

ALT RU: 32-битная портативная приставка и чёрная 16-битная домашняя на ремонтном столе: на маленьком экране и на ЭЛТ один и тот же зелёный фон
ALT EN: A 32-bit handheld and a black 16-bit home console on the repair bench: the same flat green glow on the small screen and on the CRT

ДЛЯ AI:
On the repair bench at the back of the shop, two game consoles from
different generations sit side by side, both awake and both finished with
their run. On the left lies a purple 32-bit handheld console from the
early 2000s, wide, with the screen between a direction pad on the left and
two round buttons on the right, two shoulder buttons on the top edge and a
small grey cartridge in the slot at its back edge; its screen shows a flat
green field of abstract pixels. On the right stands a compact black 16-bit
home console from the early 1990s, low and roughly square, with a rounded
top, a cartridge slot in its centre with a black cartridge inserted and
two round push buttons beside it, shown with a black six-button
controller; a cable runs from it to the old CRT television on the stand
next to the bench, and the CRT shows the same flat green field of abstract
pixels. The shopkeeper's hands, sleeves pushed up, rest on the bench
between the two machines. Seen from a low three-quarter angle, the two
consoles fill the frame left and right, the green screens are the
brightest spots, and behind them, softly out of focus, wooden shelves hold
boxed games and cassettes.

REFERENCE: draw the handheld console exactly as in this photo:
  https://upload.wikimedia.org/wikipedia/commons/0/0b/Nintendo-Game-Boy-Advance-Purple-FL.png
  (assembled). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photo shows.
REFERENCE: draw the home console exactly as in this photo:
  https://upload.wikimedia.org/wikipedia/commons/6/6a/Sega-Genesis-Mk2-6button.jpg
  (assembled). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photo shows.

FORMAT: 2:1 aspect ratio, at least 1200 x 630 pixels, white border included.
CAPTION: "32-bit handheld console, 6th generation; 16-bit home console, 4th generation, October 2026"

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

## Mega Drive strings in assembly {#asm}

The flag groups moved `md-release` from `-O2` to `-O3`, and Bencher showed at once that short string copies got 20% slower. In the BlastEm comparison 33 measurements improved (up to 68% less time) and 4 regressed. The reason showed up in the disassembler: GCC had vectorized the overlay's byte-loop `memcpy` into `move.l` with a prologue, register saves and alignment checks. A 9-byte copy is below the 12-byte threshold and pays for the prologue for nothing.

I rewrote `memcpy` in C with assembly inserts: the long sizes won, but GCC's fixed overhead around the inserts ate the gain on small ones, `moveml`, a stack spill of the offset, extra argument reads, up to 390 cycles per call. Like the leader tone on a cassette: a short block pays more for it than for the data itself. So the functions went fully into assembly: `memcpy`, `memset` and `memcmp` as top-level `__asm__`, scratch registers only, `d0`, `d1`, `a0`, `a1`, no prologue at all.

Short sizes jump into an unrolled `move.b` table; the thresholds are measured: 28 bytes for `memcpy`, 44 for `memset`, 12 for `memcmp`. Long ones go 16 `move.l` per pass, the `dbf` counter is 16-bit, and the high word of `count` serves as its continuation. From 64 KiB the old C versions take over: there is nowhere to put such sizes on the MD, but a contract is a contract. `memcmp` compares with `cmpm.l`: the unsigned order of a `long` on the big-endian 68000 matches the byte-by-byte order.

I looked at SGDK as a model and passed on it.

<details>
<summary>Why not SGDK</summary>

SGDK's `memcpy` and `memset` read the length as `u16`, truncating from 64 KiB, don't return `dest`, and their argument offsets assume a 32-bit `int`: with `-mshort` they write to the wrong place. Its `memcmp` takes the sign from an `s8` difference, which is wrong for 16,384 of the 65,536 byte pairs, and `string/ordering` fails with it. `strncpy` writes the terminator past `count` and doesn't zero-pad: 1,641 of 1,681 cases are off-standard. `strlen` returns a `u16` with garbage in the high word of `d0`. I did take the shape of its `strlen` loop: post-increment in the condition, which GCC compiles to `tst.b (a0)+` / `bne`, 18 cycles per character.

</details>

Against the C version, the time of comparisons and equality dropped by 87%, construction from a pointer by 31%, short copies by 43%, fills by 16%. Even against the old `-O2`, short copies take 25% less time. The price is size: `memcpy` is 600 bytes against 316, and the table can't grow past 62 entries, `jmp d8(pc,dn)` doesn't reach further. I checked correctness by exhaustive runs over all sizes, offsets and overlaps, and `memcmp` against all 65,536 byte pairs.

The engineer with the Spectrum dropped by and asked why write assembly by hand when there is a compiler. I answered: the compiler emits a prologue every time, even when it costs more than the copy itself; on short strings that is the whole difference.

For someone writing a game for the MD: every `String` operation got faster, because `std::char_traits` sits on these functions. What I learned: the compiler's fixed overhead around an insert is invisible in C; you can see it only in the disassembler and in measurements on the target.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про ассемблерные строки MD. С первого взгляда
должно читаться, что работа идёт руками: вскрытая чёрная 16-битная
приставка на ремонтном столе, лупа с подсветкой над крупным квадратным
процессором на плате. Пропорции 16:9, минимум 1600 × 900. Если генерация
не сложится, кадр заменяется снимком платы MD под лупой.

ALT RU: Вскрытая чёрная 16-битная приставка на ремонтном столе: лупа с подсветкой над крупным квадратным процессором на плате, рядом отвёртка и картридж
ALT EN: An opened black 16-bit console on the repair bench, the lit magnifier over the large square CPU on its board, a screwdriver and a cartridge beside it

ДЛЯ AI:
The repair bench seen from a low three-quarter angle. In the centre lies
an opened compact black 16-bit home console from the early 1990s, low and
roughly square, with a rounded top, a cartridge slot in its centre and
two round push buttons beside it: its top shell is off and rests upside
down beside the base, and the green motherboard is fully exposed. The lit
magnifier on its articulated bracket is swung low over the board, its
round lens directly above the large square CPU chip, catching one warm
highlight; the chip's legs are visible around its dark body. A small
screwdriver lies diagonally across the work mat in the foreground, and a
black cartridge rests next to the console. The shopkeeper's hands,
sleeves pushed up, hold the edges of the board steady. Behind the bench,
softly out of focus, wooden shelves hold boxed games and cassettes, and
the CRT television on its stand glows faintly at the edge of the frame.

REFERENCE: draw the console exactly as in these photos:
  https://upload.wikimedia.org/wikipedia/commons/6/6a/Sega-Genesis-Mk2-6button.jpg
  (assembled),
  https://www.leadedsolder.com/assets/japanese-megadrive-va1-motherboard.jpg
  (opened). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photos show.

FORMAT: 16:9 aspect ratio, at least 1600 x 900 pixels, white border included.
CAPTION: "16-bit home console, 4th generation, October 2026"

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

## The application learns to start {#application}

Until this cycle the sample wrote its own `main()` for each platform, and `BaseApplication` was a concrete `constexpr` object with a version. A program needs arguments and one place where the engine builds the application and runs its body. Five pull requests in a week.

`BaseApplication` became abstract: a protected constructor, a pure virtual `runInternal()`, and `run(argc, argv)` stores the arguments without copying. The platform provides the entry point: the `IMPLEMENT_CONSOLE_APP(App)` macro in `platform_config.hpp` builds the application from `APP_VERSION_*` and calls `run()`. Where the platform hasn't defined the macro, the fallback gives a single `static_assert` with a clear message instead of a cryptic link error.

The very first MD build failed at link time: `undefined reference to free`. The culprit was the base's virtual destructor: it puts a deleting destructor into the descendant's vtable, that one calls `operator delete`, and the MD has no heap. The destructor became protected and non-virtual: deleting through a base pointer now simply doesn't compile, and that is right, the application lives on the stack in `main()`. I checked with `nm` on the object files: with `virtual` there is a reference to `operator delete`, without it there are none. The rule is written down: every polymorphic engine base that is not deleted through a pointer takes such a destructor.

I first did the console output through `writev`: the text and the newline in one system call, visible immediately, survives a crash, allocates nothing. I wrote the decision down. The next day the output moved to `flockfile` + `fwrite`, and the `writev` decision was never revisited. I'm recording it as it is: the code got ahead of the document.

Windows came last. The `wmain` arguments arrive in UTF-16, while the core converts only `char16_t`: reading `wchar_t` through `bit_cast<const char16_t *>` is not allowed, it is UB even with equal sizes, so the units are copied element by element. `WriteConsoleW` takes chunks of 511 bytes strictly on a character boundary. A broken byte doesn't cut the output off: it becomes `U+FFFD` and the chunk continues; a NUL goes to the console as `U+0000`. A lone surrogate in an argument is also replaced with `U+FFFD` and the argument stays whole, since rejecting `argv` would give a silent `EXIT_FAILURE`. Redirected output goes through `WriteFile` as raw bytes, no conversion.

<details>
<summary>How I tested Windows without Windows</summary>

I have no Windows toolchain, so everything was checked with a harness on the host clang: a `windows.h` stub, `-fshort-wchar`, ASan and UBSan, and a substituted two-byte `wcslen`, since the system one on macOS treats `wchar_t` as four bytes and reads past the end. Eighteen console cases: NUL, broken UTF-8, the chunk boundary, a euro sign at 511 bytes; seven argument cases and seven lone surrogates. Each fix was also checked against the code without it, and there the harness failed.

</details>

The core grew UTF-16 utilities for this: `utf16ToUtf8` with a count, `utf16Len`, and `validateUtf16` in two overloads. The counted loops were rewritten to run to an end pointer: on the MD, where `int` is 16-bit and `size_t` is 32-bit, an index loop recomputes the address and compares against the stack, 102 cycles per unit against 68. Building the target is now handled by CMake helpers: `console_application()` assembles the target and links the engine, `install_application()` installs the artifact with the platform's suffix. The Git revision is read at configure time; I rejected the review finding about the hash going stale, because releases are built only on CI, where configuration always starts from scratch.

For someone writing a game: a `ConsoleApplication` descendant and one line of `IMPLEMENT_CONSOLE_APP`, and the program starts on macOS, Linux and Windows, the arguments are in UTF-8, and `writeOutput()` and `writeError()` write to the console. On the devkitPro consoles and the MD the output doesn't link yet: that is the next cycle.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про запуск приложения. С первого взгляда должно
читаться, что одна программа идёт на двух мирах: одна и та же абстрактная
пиксельная картинка на экране современного ноутбука и на ЭЛТ от чёрной
16-битной приставки. Пропорции 16:9, минимум 1600 × 900. Если генерация
не сложится, кадр заменяется снимком ноутбука и приставки на столе.

ALT RU: Современный ноутбук и чёрная 16-битная приставка на ремонтном столе: на экране ноутбука и на ЭЛТ одна и та же абстрактная пиксельная картинка
ALT EN: A modern laptop and a black 16-bit console on the repair bench: the same abstract pixel pattern on the laptop screen and on the CRT

ДЛЯ AI:
The repair bench seen from a low three-quarter angle. On the left stands
an open modern laptop, slim and dark grey, with a plain keyboard and no
logos anywhere; its screen shows a simple abstract pixel pattern, a bright
green square on a dark field. On the right sits a compact black 16-bit
home console from the early 1990s, low and roughly square, with a rounded
top, a cartridge slot in its centre with a black cartridge inserted and
two round push buttons beside it, shown with a black six-button
controller; a cable runs from it to the old CRT television on the stand
beside the bench, and the CRT shows the same abstract pixel pattern, a
bright green square on a dark field. The shopkeeper's hand, sleeve pushed
up, rests on the laptop keyboard. The two screens are the brightest spots
of the frame and clearly show the same picture. Behind the bench, softly
out of focus, wooden shelves hold boxed games and cassettes.

REFERENCE: draw the console exactly as in this photo:
  https://upload.wikimedia.org/wikipedia/commons/6/6a/Sega-Genesis-Mk2-6button.jpg
  (assembled). Keep its shape, proportions, colour and the layout of its
  slots, buttons and ports, redrawn in the illustration style below; leave
  out every logo, brand mark and piece of lettering the photo shows.

FORMAT: 16:9 aspect ratio, at least 1600 x 900 pixels, white border included.
CAPTION: "16-bit home console, 4th generation, October 2026"

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

## What didn't work {#failed}

The MD Release with LTO still didn't come alive: the benchmark ROM hangs, and `md-shipping` with tests doesn't link, LTO loses `memcmp`, `strlen` and `memchr`. That predates the cycle; because of it the separate `<platform>-benchmark` presets were rolled back, and the CI benchmarks run with asserts on.

`std::source_location` instead of `__FILE__`/`__LINE__` didn't survive MSVC: 19.50+ rejects a `consteval` call in the runtime branch of `if consteval` (C7595). I reproduced it on godbolt, rolled it back, and rejected the Sonar finding with the reasoning.

The `utf8Len` scheme didn't carry over to `utf16Len`: the width table gave 299 ns instead of 38 on macOS and regressions on the consoles. On arm64 the address of the next read depends on the unit just loaded, while branchy code the processor speculates through. I brought the branches back; along the way an ASCII branch in `utf8Len` took it from 240 to 148 ns.

## What's next {#next}

The next cycle is benchmarks on real hardware: a flashcart, an SRAM dump, and checking the emulator's timers against the console's cycles. The MD still has the `0xA130F1` question: SGDK always writes it and our header patch doesn't; whether a flashcart maps the SRAM without it, only hardware will show.

The application still owes output on the devkitPro consoles and the MD, and the MD asserts owe a report without `snprintf`: the checks compile there now, but a failure stays silent. Thread safety of the asserts is postponed until the job system. Logging, the `Writer` and the formatter, is still in the plan from the last cycle.