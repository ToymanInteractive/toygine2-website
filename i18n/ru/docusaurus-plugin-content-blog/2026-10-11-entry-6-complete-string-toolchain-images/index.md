---
slug: entry-6-complete-string-toolchain-images
title: "Запись 6: строка дописана, CI переехал в свои образы"
authors: [dmitry]
tags: [cpp, ci, docker, testing, benchmarks, linux, md, switch]
date: 2026-10-11
description: >
  Шестая запись журнала ретро-лавки. toy::String получил полный набор
  операций и сверился со std::string перебором, Linux-сборки переехали
  в собственные Docker-образы тулчейнов, а у движка появился модуль
  application с pid(), sleep() и yield().
image: /img/blog/2026-10-11-1.webp
sidebar_position: 1
---

Паяльник простоял на подставке все две недели. Я пишу ToyGine2, движок для небольших игр, которые должны запускаться и на современных машинах, и на ретро-технике. В этом цикле `toy::String` получил полный набор операций, Linux-сборки переехали в собственные образы тулчейнов, а у движка появился модуль `application`.

<!-- truncate -->

[Коротко](#short) · [Строка дописана](#string) · [Свои образы тулчейнов](#images) · [Модуль application](#application) · [Что не вышло](#failed) · [Цифры](#numbers) · [Что дальше](#next)

## Коротко {#short}

`toy::String` закрыт: все группы операций собраны по образцу `std::string` и сверены с ним перебором — расхождений нет. Linux-джобы больше не ставят компиляторы на раннер: сборки, тесты, покрытие, статанализ и документация ходят в контейнерах с GCC 16.2.0 и Clang 23.1.2. Появился модуль `application`: `BaseApplication` с версией, `pid()`, `sleep()` и `yield()` на всех целях. Всё это вошло в 26.21.0, [релиз лежит на GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.21.0).

- Начат модуль `video` с `Color32`: один порядок байт R, G, B, A на всех таргетах, включая big-endian консоли, а перекодировка в платформенные форматы — явный шаг.
- У логирования появились `log::Record`, `log::ISink` и спецификация пайплайна v1: сообщение форматируется в момент вывода, а не на стеке каждого места вызова.
- Сторонние зависимости подняты: Vulkan-Headers и volk до 1.4.365, libpng до 1.6.59, zlib до свежего коммита `develop`.

## Строка дописана {#string}

Две записи назад у `StringView` появились поиск и сравнение, в прошлой — присваивание у `FixedString`. Теперь я дописывал саму `toy::String`, по списку cppreference, группами: доступ к элементам, итераторы, размеры и ёмкость, модификаторы, поиск и сравнение, свободные функции. Четыре дня, шесть пул-реквестов.

Первая развилка была про перегрузки. Итератор у `String` — это `char *`, и позиционные перегрузки из стандарта сталкиваются с индексными на литерале `0`: `s.erase(0)` становится неоднозначным. В стандартной библиотеке такого нет, потому что libstdc++, libc++ и MSVC STL оборачивают указатель в класс. Я измерил цену обёртки.

<details>
<summary>Замер обёртки итератора на восьми целях</summary>

Обёртка моделировала `std::contiguous_iterator`. Замеры шли на Apple clang 21, clang 23, GCC 16 (x64 и arm64), m68k, PowerPC, ARM7 и MSVC. libc++ и MSVC STL разворачивают обёртку, и код совпадает с указателем. libstdc++ теряет `memcmp` в `std::equal` и `memmove` в `std::ranges::copy` даже на `-O2` и `-Os`, на всех целях GCC, включая ретро: на m68k в `-O3` выходило 145 инструкций против 16 с вызовом `memmove`. В debug-сборке ручной цикл медленнее в 3–4 раза, а `std::equal` на GCC — в 155 раз.

</details>

Обёртки не будет: позиционные перегрузки стали ограниченным шаблоном `template <std::convertible_to<const char *> PositionIterator>`. Отдельного запрета целых не нужно: `int` в указатель неявно не приводится.

Вставки и удаления сведены к одному закрытому `_replace()`. Источник внутри строки запоминается смещением, а не указателем: `reserve()` у растущего хранилища переносит буфер, и старый указатель протухает. Как переключение банков в картридже: адрес тот же, а подключён за ним уже другой кусок данных. Однопроходную замену ревью заставило переписать: первые символы источника пишутся поверх заменяемого участка, и пик длины равен итоговой.

Поиск и сравнение вынесены в общие `toy::string_utils`, функции над парой «указатель, длина»: их зовут и `String`, и `StringView`. Вид больше не пересчитывает длину и не обрезает строку на встроенном `'\0'`.

Со стандартом сверялся перебором под ASan, UBSan и на GCC 16.2: поиск на 8,4 миллиона сравнений против `std::string`, модификаторы на четыре миллиона, свободные функции на 3,2 миллиона. Расхождений нет.

Один прогон чистым не вышел: Clang 23 на x86_64 ломал поиск по набору символов с байтом выше ASCII, и две runtime-проверки пришлось выключить до исправления в LLVM.

<details>
<summary>Ошибка компилятора в Clang 23 и как я её нашёл</summary>

Тест `string_utils` падал на Clang 23 под x86_64: `find_first_not_of("a\xff")` над `"a\xffb"` возвращал 1 вместо 2. UBSan и ASan чистые, знаковость `char` ни при чём: `-fsigned-char` и `-funsigned-char` дают одно и то же. Бисекция проходов оптимизатора через `-opt-bisect-limit` указала на `instcombine`. Я свёл всё к программе на C без движка и без libc++: `opt-22` даёт `icmp ult i64 %i, 2`, а `opt-23` и `opt-24` — `icmp eq i64 %i, 0`. Версия 22.1.8 верна, 23.1.2, 23.1.3 и trunk 24 неверны, GCC 16.2 верен, на arm64 программа на C баг не воспроизводит. Завёл issue [llvm/llvm-project#228213](https://github.com/llvm/llvm-project/issues/228213) и выключил две проверки под Clang 23 на x86_64. Условие нарочно проверяет `__clang_major__ == 23`: при переходе на 24 проверки включатся обратно и покажут, исправлен ли баг.

</details>

Дальше упала Mega Drive, и упала странно: падали только runtime-проверки, а `static_assert` проходили. `memmove` из `libc.a` SDK я посмотрел в дизассемблере — это развёрнутый цикл `move.b (a1)+,(a0)+`, копирование только вперёд. Если приёмник правее источника и диапазоны перекрываются, хвост затирается раньше, чем читается; вставка сдвигает хвост ровно так. В прошлом цикле я проверил, что оверлей побеждает на линковке, но не проверил функции, которые остались в SDK. Теперь оверлей заменяет и `memcpy`, и `memmove`, и `memset`: они лежат в одном `string.o`, и замена одного `memmove` дала бы `multiple definition`.

Заходил коллекционер, спросил, можно ли верить тестам, которые проходят в эмуляторе. Ответил, что не полностью: `memmove` я читал по дизассемблеру, ROM проходил только в BlastEm, а на настоящей приставке в этом цикле ничего не запускалось.

Для того, кто пишет игру, изменилось одно: `toy::String` покрывает весь набор операций `std::string`, кроме числовых преобразований — у freestanding-сборки MD нет ни `<charconv>`, ни `<cstdio>`. С `FixedString` строка по-прежнему ни разу не лезет в кучу.

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

![Ряд одинаковых серых картриджей на ремонтном столе: в середину вставляют ещё один, все правее сдвинуты на ячейку, последний выдавлен за край](/img/blog/2026-10-11-1.webp)

## Свои образы тулчейнов {#images}

Linux-джобы движка ставили компиляторы на раннер каждый раз: `gcc-16` через apt и `clang-23` с apt.llvm.org. Я хотел в CI свежий стабильный Clang, начал разведку и нашёл неприятное: `gcc-16` в Ubuntu 26.04 — снапшот, собранный до релиза 16.1. CI собирал движок не стабильным GCC.

Так в репозитории образов появились два новых. GCC 16.2.0 я собрал из исходников, только C и C++: без bootstrap и multilib, три стадии утроили бы время сборки ради того же результата. Холодная сборка на arm64 Mac заняла 547 секунд, образ весит 547 МБ. Clang 23.1.2 взят из релизного архива LLVM с выборочной распаковкой и со своей libc++ 23: без стандартной библиотеки Clang на trixie взял бы libstdc++ от системного GCC 14 и потерял часть C++23. Теперь движок проверяется на двух реализациях STL: libstdc++ в образе GCC и libc++ в образе Clang. apt.llvm.org не годился — сторонний репозиторий, где патч-версию не закрепить. Из архива пришлось пересобирать только lld: он статически слинкован с libxml2 из Ubuntu 22.04 и требует ICU 70, а в trixie ICU 76 и символы версионированы.

Умолчания — lld, compiler-rt, libunwind, libc++ — зашиты в `clang.cfg` и `clang++.cfg` рядом с бинарником: CMake движка не просит ни флагов, ни `CC` с `CXX`. Пины двигают два еженедельных workflow: GCC берёт старший каталог на ftp.gnu.org и проверяет подпись тарбола через `gpgv`, LLVM читает хэши из `digest` ассетов релиза и двигает пин только вперёд.

Потом образы обрастали. `python3` в четырёх Debian-образах: скрипту бенчмарков нужны `csv` и `statistics`. lcov 2.5 из upstream-релиза: Debian-пакет тянул бы GCC 14 и 251 МБ, а в образе Clang сломал бы весь смысл. `clang-tidy` и `clang-format` из того же архива LLVM; после `llvm-strip` clang-tidy похудел со 177 до 116 МБ. GitHub CLI во все одиннадцать образов — upstream-релиз, скачанный без эмуляции целевой архитектуры. В образ GCC встали `gpg` с `gpg-agent` — без них codecov не проверяет подпись своего CLI. Во все образы я прописал `git safe.directory`: локальный прогон с примонтированным репозиторием падал на `dubious ownership`. Позже образов стало три: документацию собирает Doxygen 1.18.0 из исходников поверх gcc-образа.

Рядом с `latest` и датой сборки образы получили тег версии компилятора — `gcc-16.2.0`, `clang-23.1.2`; workflow может его закрепить. Тег ставится только после проверки: образ пушится по digest, раннеры обеих платформ печатают версию компилятора, и теги публикуются лишь при совпадении.

Со стороны движка из workflow ушли все APT-шаги. Матрица сборок на x64 и arm64 с обоими компиляторами, проверка стиля, тесты с покрытием (211 тестов, 98,2% строк), SonarCloud, CodeQL и проверка документации ходят в контейнеры. amd64 я локально не собирал, первым его проверил CI.

Для того, кто собирает движок: раннер больше ничего не ставит, локальный запуск того же образа даёт тот же компилятор, что и в CI. Закрепить версию можно тегом `gcc-16.2.0`, а для полной воспроизводимости есть digest.

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

![Слева на столе открытая коробка, сетевой кабель и россыпь деталей, справа — деревянный ящик с тремя отсеками, в каждом свой набор инструмента](/img/blog/2026-10-11-2.webp)

## Модуль application {#application}

`application::Version` появилась две записи назад, но владел ею только сэмпл с зашитым литералом. За один день — три пул-реквеста: сам класс, идентификатор процесса, сон и уступка потока.

`BaseApplication` хранит `Version`, конструктор `explicit constexpr noexcept`, аксессор `version()`. Тесты нарочно не фиксируют копируемость: имя «Base» обещает, что класс станет владельцем подсистем, а `static_assert` закрепил бы дизайн, которого никто не заказывал.

`pid()` возвращает ноль, когда цель собрана с заглушкой или системный вызов упал. Ноль здесь сентинел, хотя конвенция движка велит предпочитать `std::optional`; вопрос я поднял, контракт не менял. На Switch системный вызов отдаёт 64 бита, и результат сужается до `uint32_t`; это задокументировано, а не исправлено.

`sleep()` на Windows и Switch делится на отрезки. У `Sleep` потолком стоит `INFINITE`, и отрезки по `INFINITE - 1` сохраняют длительность. У `svcSleepThread` аргумент в наносекундах обязан помещаться в знаковые 64 бита — там раньше переполнялось умножение. Как кассетная загрузка: блок, который не влезает целиком, читают порциями, и общая длина от этого не меняется. Цикл `do … while` сохраняет прежнее поведение `sleep(0)`. POSIX повторяет `nanosleep` при `EINTR`. На 3DS делить нечего: `size_t` там 32-битная. Wii U слезла с заглушки, у неё теперь свои `OSSleepTicks` и `OSYieldThread`.

Тулчейнов Windows и Switch у меня нет, поэтому обе реализации я проверял на хосте. Windows-файл собрался на macOS с заглушкой `windows.h`, которая записывает вызовы `Sleep`: на нуле, единице, `0xFFFFFFFF` и двадцати миллиардах миллисекунд сумма отрезков равна запросу, а `INFINITE` не передаётся. Switch-файл прогнан под UBSan от нуля до `SIZE_MAX`. На приставках ничего не запускалось, и тестов на `sleep()` с `yield()` пока нет.

Для того, кто пишет игру: появился класс приложения, который держит версию, а сон и уступка потока — один вызов на любой цели. Оговорка записана в контракте: на целях без потоков `sleep()` возвращается сразу.

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

![Две разные приставки на ремонтном столе подключены к одному разветвителю провода, а рука хозяина держит его общий конец](/img/blog/2026-10-11-3.webp)

## Что не вышло {#failed}

Doxygen с libclang 23 я собрал, но отложил: assisted parsing требует обходов в Doxyfile и теряет графы вызовов — вместо 484 их два. В образ документации лёг вариант без libclang.

Литерал `_s` я добавил и удалил в одной сессии. `String("player")` выводит `FixedString<7>`, строка из литерала рождается полной, и `"player"_s += '1'` молча оставляет `"player"`. Deduction guide остался, предупреждение переехало в его документацию.

Гейт ассертов `TOYGINE_DEBUG` лежит в ветке и не влит. Пока его нет, из тестов в main пришлось убрать четырнадцать кейсов `*_rejected`: они проверяли, что функция делает при нарушенном предусловии, а это не контракт. С гейтом они шли бы только в Release, которую CI не собирает.

Трассировку CodeQL в контейнере я не проверил прогоном. Настоящий `sleep()` на ретро-целях отложен: метод пока никто не вызывает.

## Цифры {#numbers}

Замеры `toy::String` против `std::string` на macOS:

| Операция | toy против std |
| --- | --- |
| `substr` | в 4,3 раза быстрее |
| `operator+` | в 1,37 раза быстрее |
| `replace`, `erase`, `insert` | быстрее |
| `find_first_of`, `rfind` | в 1,5 раза медленнее |
| `swap` | в 14 раз медленнее, так задумано |

Сколько весит содержимое образов, arm64, без сжатия:

| Что | Вес |
| --- | --- |
| Образ GCC 16.2.0 | 547 МБ |
| Образ Clang 23.1.2 с libc++ | 930 МБ |
| clang-tidy и clang-format в образе Clang | +119 МБ |
| Образ документации с Doxygen 1.18.0 | 739 МБ |
| `python3` | +35 МБ у GCC и Clang, +27 МБ у Mega Drive, +43 МБ у N64 |
| lcov 2.5 с Perl-модулями и `llvm-cov` | +44 МБ |
| GitHub CLI | +39 МБ |

## Что дальше {#next}

Следующий цикл начнётся с логирования. Шаг первый — `Writer` и форматтер: строка формата с `{}` и `{N}`, которые нельзя смешивать, проверки при компиляции, целые всех ширин, указатели, scoped enum и свои типы через `operator<<` с ADL. За ним спецификация `chrono`: строка вывода начинается со времени.

У плана `Color32` остались целочисленная арифметика цвета, девять упакованных форматов консолей и проверка на всех таргетах. Ветка с гейтом `TOYGINE_DEBUG` ждёт вливания. `string_utils::findFirstOf` и `rfind` надо догнать: обе операции в полтора раза медленнее стандартных. Там же тест на длительность `sleep(N)` и перевод workflow на теги версий компиляторов.
