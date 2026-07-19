---
slug: first-post
title: This Time It's Personal (and Also About Games)
authors: [dmitry]
tags: []
date: 2026-07-19
---

Here is a fact: I am a mobile developer with a wife, three sons, and a perfectly adequate career. And I just started writing a game engine from scratch. In C++. In 2026. If you are waiting for the punchline, there is not one. This is something I have wanted to do for years, and this blog is how I keep myself honest about it.

The plan is simple. Write the engine. Ship games on it. Write about the whole thing as I go. If you are here for hot takes on Unity vs. Unreal or a tutorial on how to make a game in a weekend, you are in the wrong place. If you want to watch somebody crawl through the guts of a software renderer at 1 AM and genuinely enjoy it, stick around.

## The Kilobytes That Started Everything

I grew up with a ZX Spectrum 128K. If you know what that is, you probably just smiled or winced, depending on how many hours you lost waiting for a tape to load. If you do not know: imagine a computer with 128 kilobytes of RAM, a rubber keyboard that felt like dead flesh, and, in my case, an actual 5.25-inch floppy disk drive. I was practically living in the future. It was glorious.

A group of friends and I got into the demoscene. For those who missed this particular corner of computing history, the demoscene is a subculture where people compete to create the most impressive audiovisual demos on extremely limited hardware. A few kilobytes of code, a handful of pixels, a sound chip with three channels, and you try to make something that makes people say "how is that even possible."

This was my first real taste of programming. Not tutorials. Not homework. Just the raw thrill of understanding hardware well enough to push it past what anyone thought it could do. I learned assembly because I had to. I learned about memory layout because there was no room for waste. Everything mattered.

That feeling never left me.

## ROM Hacking the Game Boy Advance

In university, I got my hands on a Game Boy Advance. The GBA was not just a handheld console to me. It was a tightly designed piece of hardware with a 16 MHz ARM7 processor, 384 kilobytes of RAM, and a 240x160 screen. Modest specs, even for the time. But the games on it were magic.

I joined a fan translation group. We picked games that fascinated us and translated them into Russian, so people who did not know English could still get lost in those worlds. I handled the technical side. I would take a ROM file, a binary blob containing the entire game, and I would find the text inside it. Just raw bytes. I had to locate the font data, figure out the encoding, find the string tables, decode the graphics. Then I would patch in the translated text, repack everything, and test it.

There is a specific kind of joy in this. You open a file you did not create, in a format nobody documented, and you figure out how it works from the inside. The dialogue strings were at an offset you had to hunt for, the font was a bitmap buried somewhere in the binary, and if you got the pointer table wrong by two bytes the whole game crashed on the title screen. I loved every second of it.

I learned more about how games actually work from ROM hacking than from any book. Not how to use a game engine, but how a game is built. How resources are stored. How text rendering works at the bitmap level. How the CPU and the graphics chip talk to each other. These things have stayed with me.

## Systems Programming, or How I Learned to Love Bare Metal

After university I became a systems programmer. C and C++. Firmware for embedded boards. No operating system to cushion your mistakes. No garbage collector. No heap, just a fixed memory footprint you designed before the thing ever ran. If you wrote past the end of a buffer, the hardware told you nothing. No crash, no error. Things just behaved wrong, and you had to figure out why.

To some people this sounds like a nightmare. To me it was a continuation of what I had been used to since the ZX Spectrum. Understanding the machine. Working at the level where a register write changes a voltage on a pin.

This period is when I really learned C++. Not the modern template-metaprogramming-everything-is-a-concept C++. The C++ where you care about cache lines and data layout and whether your virtual function dispatch is going to tank your frame budget. The C++ you need when you write a game engine.

## Toyman Interactive and the First ToyGine

In 2012 my wife, a couple of friends, and I opened Toyman Interactive. We were small. A handful of people, a shared vision, and a lot of enthusiasm. I wrote the first version of ToyGine. On it we built and released five games in the MOAI series.

MOAI was a resource management series set on an uncharted island. You helped a hero and a native princess restore their ravaged land. There was an active volcano. There were hordes of ghosts attacking your workers. You gathered resources, rebuilt villages, and used Moai statues to protect your people while they worked. The games had comic book style story interludes and a pile of achievements for players who optimized every task. Not bad for a custom engine written by someone who learned to code on a ZX Spectrum.

Simple on the surface, but a lot of moving parts under the hood. Discrete event simulation, animation blending, UI, sound management, resource loading. A real engine had to handle all of it.

We shipped those games. Five titles, designed, developed, and released. I am not going to pretend they changed the world, but they were real games that real people played. Making something from nothing, putting it into the hands of strangers, and watching them have fun with it. That is a high that does not fade.

Then life happened. The casual games market shifted. The economics of making games as a small independent studio got harder. I moved into web development, then mobile development. Toyman Interactive went quiet. ToyGine went into a drawer.

## The Long Pause

For the better part of a decade, game development was not part of my life. I wrote Angular. I debugged Android and iOS builds. I sat in standups. I got good at it. I have nothing bad to say about the work. But the thought of building something of my own, at the metal, never fully went away.

It would surface at odd moments. Reading about a new rendering technique. Watching a GDC talk on retro console emulation. Randomly opening my old engine code at midnight and staring at it like it was a letter from a younger version of myself.

After a while, you stop ignoring those moments.

## Why Another Engine

So here we are. I am writing ToyGine2. A game engine. From scratch. In C++. On purpose.

Why not use an existing engine? Unity is right there. Godot is open source and excellent. Unreal does everything. The honest answer is that I do not want an engine. I want to build an engine. I want to understand every decision. Why this memory allocator and not that one. Why this render pipeline. Why this entity model. When you use someone else's engine, you work inside their decisions. When you write your own, you own the decisions. The tradeoffs are yours to make and yours to live with.

This is not a commercial project. ToyGine2 is a hobby. But it is a hobby with teeth. I have a list of goals. The engine will reach a state where you can build and ship complete games on it. This blog is how I hold myself to that.

## What Comes Next

The next post will dig into the actual code. Architecture decisions. Why software rendering (yes, really). The compile-time reflection system that turned out way better than I expected. Maybe some screenshots, if you are into colored rectangles moving across other colored rectangles.

If any of this sounds interesting, subscribe to the RSS feed or star the GitHub repo. This train is leaving the station. It is not fast, but it is not stopping either.
