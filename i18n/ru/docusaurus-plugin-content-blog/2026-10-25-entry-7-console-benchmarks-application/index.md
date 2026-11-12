---
slug: entry-7-console-benchmarks-application
title: "Запись 7: бенчмарки доехали до приставок, приложение научилось стартовать"
authors: [dmitry]
tags: [cpp, ci, cmake, testing, benchmarks, md, gba, windows, linux, macos]
date: 2026-10-25
description: >
  Седьмая запись журнала ретро-лавки. Бенчмарки дошли до GBA и Mega Drive
  и ходят в CI под эмуляторами, строковые функции оверлея MD переписаны
  на ассемблере 68000, а модуль application научился стартовать и писать
  в консоль на macOS, Linux и Windows.
image: /img/blog/2026-10-25-1.webp
sidebar_position: 1
---

Лупа с подсветкой всю неделю стояла над ремонтным столом: я читал дизассемблер и считал такты. Я пишу ToyGine2, движок для небольших игр, которые должны запускаться и на современных машинах, и на приставках с моей полки. Этот цикл ушёл на замеры и запуск: бенчмарки доехали до GBA и Mega Drive, строковые функции MD переписаны на ассемблере 68000, а приложение научилось стартовать и писать в консоль.

<!-- truncate -->

[Коротко](#short) · [Бенчмарки доехали до приставок](#consoles) · [Строки Mega Drive на ассемблере](#asm) · [Приложение научилось стартовать](#application) · [Что не вышло](#failed) · [Что дальше](#next)

## Коротко {#short}

Бенчмарки больше не только десктопные: CI гоняет их под mGBA на GBA и под BlastEm на Mega Drive, а копия отчёта ложится в SRAM картриджа — её сможет забрать флешкарта на настоящем железе. Поиск по набору символов ускорился на обеих приставках в разы, строковые функции оверлея MD переписаны на ассемблере. Модуль `application` вырос: абстрактный `BaseApplication` с `run()` и аргументами, точка входа от платформы, консольный вывод на macOS, Linux и Windows. Всё это вошло в 26.22.0, [релиз лежит на GitHub](https://github.com/ToymanInteractive/toygine2/releases/tag/26.22.0).

- Ассерты раньше не компилировались на GCC и Clang вообще: гейт `_DEBUG` задаёт только MSVC. Теперь гейт `TOYGINE_DEBUG` действует в Debug и RelWithDebInfo на всех платформах и приходит через INTERFACE-группу `toygine::compile::defines`.
- Обработчик ассерта отвечает действием — `Break`, `Ignore`, `IgnoreAlways` или `Abort` — вместо `bool`. Без обработчика провал больше не проходит молча; `IgnoreAlways` только на десктопе: на тестовых ROM он стоил +5,8 КБ на MD и +4,1 КБ на GBA.
- Флаги компиляции разложены по группам со своим охватом целей: предупреждения, ABI-безопасные оптимизации, defines. Запасные пути shipping-сборки проверяет отдельный джоб CI — он сразу нашёл несобиравшийся `linux-shipping`.
- Ревизия строк: `operator+` с не-`String` слева строится как в std, концепт хранилища требует конструирование по умолчанию и перемещение, сравнения `StringView` стали скрытыми `friend`.
- Флаговые enum: операторы находятся через ADL в неймспейсе самого enum, базовый тип обязан быть беззнаковым и не `bool`; появились `hasAny()` и `hasAll()`.
- Тесты без своей настройки берут `main` из doctest, встроенный раннер больше не линкует движок; `CodeCoverage.cmake` переехал в `thirdparty/` апстримным файлом с двумя патчами.

## Бенчмарки доехали до приставок {#consoles}

В прошлой записи я собирался начать логирование, но сначала доделал план консольных бенчмарков: от него оставались шесть задач, и все легли в один день, 12 октября: пять сессий, пять пул-реквестов. Смысл простой: цифры движка должны сниматься на том железе, где ему работать, а не только на моём Mac.

Консольный отчёт — тот же CSV, что на десктопе: строки в порядке имён, в конце `# done`. Куда его девать на приставке? У железа нет ни лога эмулятора, ни отладочного порта, ни stdout. Есть SRAM картриджа: флешкарта сбрасывает её в `.sav` на SD-карту, и тот же скрипт разбирает дамп. `SramWriter` пишет по байту на символ с шагом 1 на GBA и 2 на MD (там в память картриджа попадают только нечётные адреса), всегда с нулём на конце и местом под `# truncated`.

Время на GBA считает каскад Timer 2/3 на 16,78 МГц, на MD — строки развёртки: счётчик кадров плюс V-счётчик видеочипа, около 64 мкс на строку, 262 строки в кадре NTSC и 313 в PAL. mGBA считает таймеры из эмулированных тактов процессора, а у ARM7TDMI нет кеша, поэтому два прогона совпадают побайтно. У MD отметка в vblank отстаёт до 37 строк на NTSC и до 88 на PAL — это записано в контракте, а не спрятано.

В CI бенчмарки ходят под mgba-headless и BlastEm. Эмулятор выходит с нулём, даже если раннер умер, поэтому шаг CI проверяет `# done` в логе. Слишком длинная строка или некалиброванный ряд дают `# failed rows: N` вместо `# done` и красный фон. Ряды `std::` остались только на десктопе: во freestanding-библиотеке MD нет `<string>`, консольные отчёты несут ряды движка, а регрессии ловит история Bencher. Десктопные джобы ряды `std::` собирают, чтобы они не гнили.

Первым делом новые цифры позволили закрыть старую отложенную правку. Поиск по набору символов строит таблицу принадлежности `bool[256]` один раз за вызов, дальше O(n + m). Таблицу я уже писал и откатил: тогда не на чем было мерить консоли. Теперь замерил четыре формы на GBA, MD и macOS; `bool[256]` выиграла почти везде. `find_first_of` на MD: 6,07 → 1,94 мс, на GBA: 1,60 → 0,317 мс. Заодно `utf8_size()` стал `constexpr` и читает ровно `size()` байт — раньше он читал до терминатора, и это была мина под будущие `substr`.

<details>
<summary>Четыре формы таблицы и нарушение ODR по дороге</summary>

Любая форма быстрее прежнего `memchr` на каждый байт: на MD в 3,5–14 раз, на GBA в 4–18. `uint64_t[4]` хуже всех везде, `uint8_t[32]` примерно равна `uint32_t[8]`. `bool[256]` быстрее всех на GBA, на десктопе и на длинных строках MD; на 103 байтах MD проигрывает `uint32_t[8]` 11% — `memset` оверлея пишет по байту, около 6 000 тактов на 256 байт. Стека на MD свободно около 60 КБ, 256 байт незаметны. Помощников таблицы я сначала спрятал в анонимный неймспейс внутри `.inl` — это нарушение ODR: inline-функции с внешней связью зовут функции с внутренней, свои в каждой единице трансляции. Sonar подсветил то же правилом `cpp:S1000`; помощники переехали в `detail`.

</details>

Для того, кто пишет игру: поиск по набору на приставке подешевел в разы, и это измерено, а не обещано. Для меня важнее другое: регрессия на MD или GBA теперь видна в CI так же, как на десктопе. Оговорка честная: эмулятор — не железо. Нулевой разброс прогонов значит, что t-тест Bencher будет алертить почти на любое изменение. Порог для консольных тестбедов ещё предстоит подобрать. А сверить таймеры с настоящим железом позволит как раз копия отчёта в SRAM.

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

## Строки Mega Drive на ассемблере {#asm}

Группы флагов перевели `md-release` с `-O2` на `-O3`, и Bencher сразу показал: короткие копии строк стали на 20% медленнее. В сравнении под BlastEm 33 замера ускорились (до −68% времени), 4 просели. Причина нашлась в дизассемблере: GCC векторизовал побайтовый цикл `memcpy` оверлея до `move.l` с прологом — сохранение регистров, проверки выравнивания. Копия в 9 байт короче порога в 12 и платит пролог зря.

Я переписал `memcpy` на C со вставками ассемблера: длинные размеры выиграли, но постоянные расходы GCC вокруг вставок съедали выигрыш на малых — `moveml`, выгрузка смещения на стек, лишние чтения аргументов, до 390 тактов на вызов. Как лидер-тон кассеты: короткий блок платит за него больше, чем за сами данные. Тогда функции легли целиком на ассемблер: `memcpy`, `memset`, `memcmp` — верхнеуровневый `__asm__`, только scratch-регистры `d0`, `d1`, `a0`, `a1`, никакого пролога.

Короткие размеры прыгают в развёрнутую таблицу `move.b`: пороги замерены — 28 байт у `memcpy`, 44 у `memset`, 12 у `memcmp`. Длинные идут по 16 `move.l` на проход, счётчик `dbf` 16-битный, и старшее слово `count` служит продолжением. От 64 КиБ работают прежние C-версии: на MD такие размеры некуда класть, но контракт есть контракт. `memcmp` сравнивает `cmpm.l`: беззнаковый порядок `long` на big-endian 68000 совпадает с побайтовым.

Как образец я взял SGDK — и не взял.

<details>
<summary>Почему не SGDK</summary>

У `memcpy` и `memset` SGDK длина читается как `u16` — обрезка от 64 КиБ, возврата `dest` нет, а смещения аргументов рассчитаны на 32-битный `int`: с `-mshort` пишут не то. `memcmp` берёт знак из разности `s8`: неверный результат в 16 384 из 65 536 пар байтов, с ним падает `string/ordering`. `strncpy` пишет терминатор за `count` и не дополняет нулями — 1 641 из 1 681 случая не по стандарту. `strlen` возвращает `u16` с мусором в старшем слове `d0`. Форму цикла `strlen` я взял: постинкремент в условии, GCC собирает `tst.b (a0)+` / `bne`, 18 тактов на символ.

</details>

Против C-версии время сравнений и равенства упало на 87%, конструирования из указателя — на 31%, коротких копий — на 43%, заливок — на 16%. К прежнему `-O2` короткие копии всё равно выиграли 25% времени. Цена — размер: `memcpy` 600 байт против 316, и таблицу нельзя удлинить за 62 записи: `jmp d8(pc,dn)` дальше не дотягивается. Корректность проверял перебором всех размеров, смещений и перекрытий, `memcmp` — всеми 65 536 парами байтов.

Заходил инженер со Спектрумом, спросил, зачем писать ассемблер руками, если есть компилятор. Ответил: компилятор ставит пролог всегда, даже когда он дороже самой копии; на коротких строках это и есть вся разница.

Для того, кто пишет игру под MD: каждая операция `String` стала быстрее, потому что `std::char_traits` стоит на этих функциях. Что я понял: постоянные расходы компилятора вокруг вставки не видны в C — их видно только в дизассемблере и в замерах на цели.

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

## Приложение научилось стартовать {#application}

До этого цикла сэмпл писал свой `main()` под каждую платформу, а `BaseApplication` был конкретным `constexpr`-объектом с версией. Программе нужны аргументы и одно место, где движок строит приложение и запускает его тело. За неделю — пять пул-реквестов.

`BaseApplication` стал абстрактным: защищённый конструктор, чисто виртуальный `runInternal()`, `run(argc, argv)` сохраняет аргументы без копии. Точку входа даёт платформа: макрос `IMPLEMENT_CONSOLE_APP(App)` в `platform_config.hpp` строит приложение из `APP_VERSION_*` и зовёт `run()`. Где платформа макрос не определила, запасной вариант даёт один `static_assert` с внятным текстом, а не загадочную ошибку линковки.

Первая же сборка под MD упала на линковке: `undefined reference to free`. Виноват виртуальный деструктор базы: он кладёт в vtable наследника удаляющий деструктор, тот зовёт `operator delete`, а на MD нет кучи. Деструктор стал защищённым невиртуальным: удаление через указатель на базу теперь просто не компилируется, и это правильно — приложение живёт на стеке в `main()`. Проверил `nm` по объектникам: с `virtual` ссылка на `operator delete` есть, без — ноль. Правило записано: любая полиморфная база движка, которую не удаляют через указатель, берёт такой деструктор.

Вывод в консоль я сначала сделал через `writev`: текст и перевод строки одним системным вызовом, видно сразу, переживает падение, ничего не выделяет. Решение записал. На следующий день вывод лёг на `flockfile` + `fwrite`, а решение про `writev` так и осталось непересмотренным. Записываю как есть: код ушёл вперёд документа.

Windows достался последним. Аргументы `wmain` приходят в UTF-16, а ядро конвертирует только `char16_t`: читать `wchar_t` через `bit_cast<const char16_t *>` нельзя, это UB даже при равном размере, поэтому единицы копируются поэлементно. `WriteConsoleW` принимает куски по 511 байт строго по границе символа. Битый байт не обрывает вывод: он становится `U+FFFD`, и кусок продолжается; NUL уходит в консоль как `U+0000`. Одиночный суррогат в аргументе тоже заменяется на `U+FFFD`, аргумент остаётся целым — отказ в `argv` дал бы молчаливый `EXIT_FAILURE`. Перенаправленный вывод идёт `WriteFile` байтами как есть, без перекодировки.

<details>
<summary>Как я проверял Windows без Windows</summary>

Тулчейна Windows у меня нет, поэтому всё проверялось харнессом на хостовом clang: заглушка `windows.h`, `-fshort-wchar`, ASan и UBSan, подменённый двухбайтный `wcslen` — системный на macOS считает `wchar_t` четырёхбайтным и читает за концом. Восемнадцать случаев консоли: NUL, битый UTF-8, граница куска, «€» на 511 байтах; семь случаев аргументов и семь одиночных суррогатов. Каждая правка прогонялась и без себя — харнесс падал.

</details>

Под это в ядре появились утилиты UTF-16: `utf16ToUtf8` со счётчиком, `utf16Len`, `validateUtf16` в двух перегрузках. Счётные циклы переписаны до указателя конца: на MD, где `int` 16-битный, а `size_t` 32-битный, индексный цикл пересчитывает адрес и сравнивает со стеком — 102 такта на единицу против 68. Сборку цели взяли на себя CMake-помощники: `console_application()` собирает цель и линкует движок, `install_application()` ставит артефакт с суффиксом платформы. Ревизия Git читается при конфигурации; находку ревью про устаревающий хеш я отклонил: релизы собираются только на CI, где конфигурация всегда с нуля.

Для того, кто пишет игру: наследник `ConsoleApplication`, одна строка `IMPLEMENT_CONSOLE_APP` — и программа стартует на macOS, Linux и Windows, аргументы в UTF-8, `writeOutput()` и `writeError()` пишут в консоль. На консолях devkitPro и MD вывод пока не линкуется: это следующий цикл.

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

## Что не вышло {#failed}

MD Release с LTO так и не ожил: ROM бенчмарков зависает, а `md-shipping` с тестами не линкуется — LTO теряет `memcmp`, `strlen` и `memchr`. Было и до цикла; из-за этого откатаны отдельные пресеты `<platform>-benchmark`, и бенчмарки CI идут с ассертами.

`std::source_location` вместо `__FILE__`/`__LINE__` не пережил MSVC: 19.50+ отвергает `consteval`-вызов в рантаймовой ветке `if consteval` (C7595). Воспроизвёл на godbolt, откатил, находку Sonar отклонил с обоснованием.

Схема `utf8Len` не перенеслась на `utf16Len`: таблица ширины дала 299 нс вместо 38 на macOS и регрессии на приставках. На arm64 адрес следующего чтения ждёт только что загруженную единицу, а ветвящийся код процессор проходит спекулятивно. Вернул ветвления; заодно ветка ASCII в `utf8Len` дала 240 → 148 нс.

## Что дальше {#next}

Следующий цикл — бенчмарки на настоящем железе: флешкарта, дамп SRAM, сверка таймеров эмулятора с тактами приставки. У MD остался вопрос про `0xA130F1`: SGDK пишет его всегда, а наш патч заголовка — нет; подключит ли флешкарта SRAM без него, покажет только железо.

Приложению предстоит вывод на консолях devkitPro и MD, а ассертам на MD — отчёт без `snprintf`: сейчас проверки там компилируются, но провал молчит. Потокобезопасность ассертов отложена до job system. Логирование — `Writer` и форматтер — так и стоит в плане с прошлого цикла.