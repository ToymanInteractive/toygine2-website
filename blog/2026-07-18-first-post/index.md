---
slug: first-post
title: The Long Way Back to the Metal
authors: [dmitry]
tags: [personal, retro, demoscene, romhacking, gba, cpp]
date: 2026-07-18
description: >
  Where ToyGine2 came from: a ZX Spectrum and the demoscene, ROM hacking
  fan translations on the Game Boy Advance, firmware with no operating
  system, five MOAI games on a homemade engine, and ten years off.
image: /img/blog/2026-07-18-1.webp
sidebar_position: 1
---

I am a mobile developer. A wife, three sons, an ordinary career, and in 2026 I sat down to write a game engine in C++ from scratch, for machines like the Game Boy Advance and the Sega Mega Drive.

There is no punchline coming. This is not a startup, not a portfolio piece, not an attempt to outrun anybody. It is the thing I have been walking toward for twenty years, and this blog is how I keep myself from quitting halfway.

<!-- truncate -->

![A dark room at night: a demo with raster bars runs on the TV, a rubber-keyed home computer and a floppy drive sit in front of it](/img/blog/2026-07-18-1.webp)

## The kilobytes where it started

My first computer was a ZX Spectrum 128K. A rubber keyboard that felt like dead flesh, a television set instead of a monitor and, a luxury at the time, a real 5.25-inch floppy drive. I did not spend five minutes waiting for a tape to load, and I was convinced I lived in the future.

Inside, it was cramped, and the cramping was inventive. The screen held 256 by 192 pixels, but colour was stored apart from the pixels: each 8 by 8 cell got two colours, ink and paper. A sprite crossing somebody else's cell repainted the whole cell. This was called attribute clash, and half the graphical tricks of that era grew out of working around it, or at least pretending it was on purpose. Sound was three channels. Time was fifty interrupts a second. Everything else you counted yourself, in clock cycles.

Some friends and I got into the demoscene. For anyone who walked past this corner of computing history: the demoscene is a subculture where people compete over who can wring the most impressive audiovisual piece out of limited hardware. A couple of kilobytes of code, a handful of pixels, three sound channels, and you try to build something that makes the viewer ask how that is even possible.

The size categories are their own kind of joy. There are demos, and then there are intros, where everything including music and graphics has to fit in four kilobytes, or in 256 bytes. You cannot draw a picture or record a melody in that space. You compute them on the fly, from a formula. The line between code and data disappears completely: the unpacker is the content.

That was my first real programming. Not textbooks, not homework, but the thrill of understanding a machine well enough to make it do more than it owed you. I learned Z80 assembly with no love for assembly involved, because otherwise the effect fit neither in memory nor in the frame. I worked out how memory was laid out because there were no spare bytes.

From the outside it looked like coloured stripes and two minutes of music. From the inside it was arithmetic: how many cycles until the next interrupt, how many bytes until the page boundary, what could be computed in advance and stored in a table. That is where I picked up an idea I never managed to shake: a constraint is not an obstacle but the statement of the problem. When you have 128 kilobytes, the question "what if we add one more system here" never comes up.

## ROM hacking on the Game Boy Advance

At university I got my hands on a Game Boy Advance. A processor a little over 16 MHz, a 240 by 160 screen, 384 kilobytes of memory split into three unequal pieces: fast internal, slow external, and video RAM. Modest even then. But the games on it were magic, and I wanted to know what the magic was made of.

I joined a fan translation group. We picked games that fascinated us and translated them into Russian, so that people who did not read English could get lost in those worlds too. The technical side was mine.

Here is what that looks like. You have a ROM, a single binary image holding absolutely everything: code, graphics, music, text. No tools, no documentation, and the author is not going to explain anything. First you hunt for the font, stored as tiles, which you have to recognise by eye among thousands of other bytes. Then the encoding, different in every game, usually cracked by relative search: you look not for the bytes themselves but for the distances between them, because the distance from "a" to "b" stays the same however the table is shifted. Then the pointer table, because strings are not stored back to back. Each one has an address, and if you write your translation in without fixing the addresses, the game starts reading text from the middle of the previous line.

Then the real work starts. A Russian sentence is almost always longer than the English one, and the space for it is exactly the space that was there. So the text moves into free room at the tail of the ROM and the pointers get rewritten to the new addresses. So the font really wants variable width, or the line will not fit the dialogue box. So you need to work out whether the block is compressed and with what. Every one of those edits gets verified by running the game: a pointer table off by two bytes drops it on the title screen, silently, with no explanation.

Part of the job had nothing to do with programming. The translators were people, not machines, and they had to be told when a line would not fit: not because the translation was bad, but because the dialogue box is a fixed width and there is no room for another line. Half of what a technical person does in a group like that is not poking at bytes, it is giving an honest answer to "can we do this?"

I loved every second of it. You open a file you did not write, in a format nobody documented, and you work it out from the inside, from indirect evidence, like an archaeologist. ROM hacking taught me more about how games are built than any book: how resources are stored, how text turns into pixels, how the processor negotiates with the video chip. A book describes the interface. ROM hacking shows the implementation, and those are different kinds of knowledge.

The player, meanwhile, just saw Russian subtitles. The rest of the work is only visible when it is done badly.

![Three panels: a dense grid of bytes, a pixel font emerging from it, and a dialogue box on a handheld console screen](/img/blog/2026-07-18-2.webp)

## Bare metal

After university I became a systems programmer. C and C++, firmware for embedded boards. No operating system, so nobody covers for your mistake. No garbage collector. No heap either: you write out the memory budget before the code ever runs, and then you live inside that budget.

Mistakes there are not reported. A write past the end of a buffer does not crash the program and does not print a message. It corrupts the neighbouring variable, and forty minutes later the device starts behaving strangely somewhere with no visible connection to that write. Debugging came down to holding the memory map in your head and reasoning about what else was lying nearby and who could have reached it.

To some people that sounds like a description of a nightmare. To me it was the Spectrum continued by other means. Understand the machine. Work at the level where writing to a register changes the voltage on a pin.

Those were the years I learned C++. Not the kind where everything turns into a template and a concept, but the kind where you think about data layout, structure size and the cost of a virtual call. The C++ you need when you write an engine. And the constraint turned out, again, to be the statement of the problem rather than a punishment. It was just written by a specification now instead of by Sinclair.

## Toyman Interactive and the first ToyGine

In 2012 my wife, a couple of friends and I started Toyman Interactive. There were few of us: several people, a shared sense of what we wanted to make, and a lot of enthusiasm. I wrote the first version of ToyGine, and on it we shipped five games in the MOAI series.

MOAI was a casual resource management series set on a lost island. The player helped a hero and an island princess restore a ruined land: gathering resources, rebuilding villages, raising Moai statues to shield the workers from ghosts while the work went on. A volcano smoked in the background. Comic-book interludes ran between levels, and there was a pile of achievements for anybody who likes optimising every action.

From the outside it all looked simple. Inside, a fair amount was turning: discrete event simulation, animation blending, interface, sound, resource loading. The player saw a queue of tasks and a volcano. I saw the event queue that pretends to be that queue of tasks, and watched it for drift when the player sped the game up.

That was where I understood the difference between writing a game and writing an engine. A game can be finished. It ships, and everything crooked in it stays crooked forever, but it works. An engine cannot be finished. It lives exactly as long as people make games on it, and every next game arrives with a requirement that was not there last time. I wrote the first ToyGine for one specific game and got precisely what that game asked for. By the second one I had to find out which parts of my architecture were decisions and which were coincidences.

We designed, built and released five games. I am not going to pretend they changed the world, but they were real games that real people played. Making something out of nothing, handing it to strangers and watching them enjoy it is a feeling that does not wear off.

Then the market changed. Casual games slid into a different economy, a small independent studio had nothing left to breathe in it, and by 2017 Toyman had gone quiet. I moved into web development, then mobile. ToyGine stayed in its repository.

![Above, an island with a smoking volcano, statues and workers; below, the same island reduced to a tile grid and a line of events](/img/blog/2026-07-18-3.webp)

## The long pause

For most of ten years, game development was not part of my life. I wrote Angular. I debugged Android and iOS builds. I went to standups. I got good at it, and I have nothing to hold against that work: it fed my family and taught me things I did not know, among them that people read somebody else's code far more often than they write their own.

But the thought of building something of my own, down at the metal, never went away. It came back in bouts. A talk about emulating retro consoles. An article about fitting a renderer into a frame budget in 1995. My own old engine, opened at one in the morning for no reason, read like a letter from the twenty-year-old who wrote it: half the decisions I no longer understand, the other half I remember line by line.

Ten years changed a few things, and not only in me. Compilers got noticeably smarter. C++ grew the features I had been missing in exactly the places where I used to get stuck, the ones computed at compile time that never reach the final program at all. Tools that used to cost as much as a car are sitting in the open. What we pulled off with a small team in 2012 can be carried alone now. Not easily, but it can.

After a while you stop writing those bouts off as nostalgia.

## Why another engine

So: I am writing ToyGine2. A game engine. In C++. On purpose.

The obvious question comes first. Why, when Unity, Godot and Unreal are right there? I do not want an engine, I want to write one. Working with somebody else's engine means working inside somebody else's decisions. Write your own and the decisions are yours, and so is the bill. I want to understand every one of them: why this allocator, why this entity model, why there will be no virtual call here.

There is a second answer, less romantic. ToyGine2 aims at hardware the big engines simply do not run on: Game Boy Advance, Mega Drive, Nintendo 64, GameCube, Wii, Nintendo DS, with the ordinary desktop next to them. It is not that Unity is bad. It is built on different assumptions, dynamic memory and a rich runtime and garbage collection, none of which exists on a console with a hundred kilobytes of RAM, and none of which is going to.

These machines are far more alive than they look from outside. They have current compilers and working toolchains, emulators that count cycles, and people who ship new games on them every year. A retro platform today is not a museum piece but an ordinary build target with a strict budget.

Hence the constraints I wrote down for myself at the start. No allocations in hot paths, no `new`, no `malloc`, no `std::function`. No exceptions: `std::expected` and return codes instead. Data laid out the way the cache likes it rather than the way a class diagram looks good. Composition ahead of inheritance. And determinism: the game step must not depend on frame rate or render order, or the game can be neither saved nor replayed from a recording.

It is the same conversation I was having on the Spectrum, except now it is not one machine but a shelf of them. And it does not start from a blank page: ToyGine2 grows out of the engine Toyman built MOAI on, so some of the decisions have already been tested by games that shipped.

Whoever eventually picks the engine up will need none of this. They will type one line, something like `cmake --preset gba-release`, and get a ROM that runs. The rest is my problem, and that is the whole point of the exercise.

There is no commercial plan here. ToyGine2 is a hobby, but a hobby with a target: get the engine to the state where you can build and ship a finished game on it. The blog is how I keep myself from lying about the progress.
