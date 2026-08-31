---
slug: day-3-mallet-our-own-wood
title: "День 3: Колотушка из своего дерева"
authors: [dmitry]
tags: [cpp, testing, cmake, ci, gba, md, platforms]
date: 2026-08-30
description: >
  Третий день хроники Строителя. Привозная колотушка не звучала на самой
  тесной земле, и я вырезал свою — для всех дальних разом. К концу цикла
  первый дальний тотем отозвался вживую.
image: /img/blog/2026-08-30-1.webp
vibe: carver
---

ToyGine2 — движок для ретро-консолей: от Mega Drive и Game Boy Advance до Windows, macOS и Linux. К началу этого цикла обереги стояли и отзывались на трёх ровных землях, а на дальних их не то что не били — их там даже не вырезали.

<!-- truncate -->

## Что случилось

Прошлый цикл я закончил вопросом, ответа на который не знал: как сторожить дворы, куда дозор не доходит. В этот я вырезал колотушку из своего дерева. Привозная, выменянная у союзного племени, звучала везде, кроме самой тесной земли, и я делал свою сразу для всех дальних — девятью заходами, и в каждом обереги шли впереди ритуала. К концу цикла первый дальний тотем отозвался вживую: прошивка Game Boy Advance теперь сама понимает, стоит она на земле или в отражении, и её вердикт доходит до маяка. Табличка вырезана и отнесена в дом знания — [вот полка, на которой она лежит](https://github.com/ToymanInteractive/toygine2/releases/tag/26.18.0).

**План цикла:**

- Выяснить, собирается ли doctest под devkitARM и ClownMDSDK, и решить, где нужен свой раннер
- Написать раннер девятью задачами по TDD, с побитовым паритетом `Approx` с doctest
- Развести точку входа, вывод и экран по платформенным файлам вместо `#ifdef`
- Гонять GBA ROM в mGBA и регистрировать прогон в CTest

<!--
ДЛЯ ЧЕЛОВЕКА: заглавный кадр. Две колотушки рядом — привозная светлая и
своя тёмная, только что вырезанная, — и ряд тотемов, ждущих удара. С первого
взгляда должно читаться: инструментов два, и один сделан здесь.
2:1, минимум 1200 × 630. Альтернатива: скриншот раскладки каталога раннера.

ALT RU: Вечер у навеса: резчик держит тёмную колотушку, рядом на циновке лежит светлая привозная, вдоль берега стоят восемь тотемов
ALT EN: Evening under a shelter: a carver holds a dark mallet, a pale traded one lies on the mat beside it, eight totems stand along the shore

ДЛЯ AI:
Evening on a low shore under a woven shelter. A seated carver has just
finished shaping a dark hardwood mallet and holds it up, turning it in the
light to judge the head. On the pandanus mat beside the knee lies a second
mallet, clearly a different object: paler wood, smoother, worn from long use,
plainly made somewhere else and carried here. Wood chips and a small adze lie
between them. Behind the shelter, running away into perspective along the
water's edge, stand eight carved wooden totems of different heights, each with
its own ornamental banding, all of them untouched and waiting. The viewpoint is
low and close to the carver, so the two mallets dominate the foreground and the
row of totems recedes into the middle distance; the horizon sits in the upper
third with open water beyond.

FORMAT: 2:1 aspect ratio, at least 1200 × 630 pixels.

STYLE (identical across all images, so the set reads as one series):
  hand-drawn editorial illustration; clean confident linework in the spirit of
  Studio Ghibli background art; silhouette clarity and iconographic readability
  of a Zelda adventure map; ornamented like an old Polynesian navigational
  chart, with wave motifs and tattoo-like geometric banding along the borders.
  Unless the scene above states otherwise, every person in frame is an ancient
  Polynesian islander, dressed in the spirit of the costume design in Moana:
  tapa cloth and woven plant fibre, barkcloth wraps and skirts, shell, bone and
  feather ornaments, cord-bound or loose hair, wave-like tattoos, bare feet or
  plaited sandals, and nothing modern on them.
  The whole illustration sits on a torn sheet: the parchment ends in ragged
  deckle edges with visible paper fibres, and outside those edges the image is
  fully transparent alpha, never a white, coloured or rectangular fill.
PALETTE: turquoise and deep ocean blue, terracotta and coral, warm gold
  accents, on an aged parchment ground.
LIGHT AND TEXTURE: low warm sun, long soft shadows, visible paper grain,
  watercolor bleed at the edges, faint pencil under-drawing left showing.
NEGATIVE: no legible text, lettering, glyph captions or numerals anywhere;
  no logos or watermarks; no modern objects (screens, cables, vehicles);
  no modern clothing, uniforms, boots or headgear on the islanders; no straight
  cropped edges and no opaque background behind the torn sheet; no flat
  corporate vector style; no neon or cyberpunk palette; no photorealism
  or 3D render look; no lens flare; no close-up human faces; no clutter.
-->

## Колотушка из своего дерева

Я начинал с уверенности, что дальние земли слишком тесны для привозной колотушки, и собирался померить, насколько именно. Проверка перевернула вопрос. Под devkitARM doctest собрался и слинковался в картридж Game Boy Advance: 444 912 байт `.text` при 256 КБ EWRAM. А под ClownMDSDK не собрался вовсе: у Mega Drive нет ни `<signal.h>`, ни `<ctime>` — ничего из того обжитого дома, который doctest считает данностью. Граница проходила не там, где я её рисовал: не между ровной землёй и дальней, а между hosted и freestanding, и своя колотушка формально требовалась одной земле из восьми.

Я всё равно сделал её для всех восьми: неоднородность дороже своего кода. Отсюда и главный инвариант, за который пришлось платить всей остальной работой: один и тот же оберег обязан отзываться одинаково под обеими колотушками. `Approx` поэтому повторяет `doctest::Approx` дословно, вплоть до строгого неравенства `difference < epsilon * (1 + larger)`, а допуск по умолчанию остался единой константой для всех типов, потому что вывод из `numeric_limits<T>` сжал бы его для `double` с `1.19e-05` до `2.22e-14`. Рукояток у колотушки тоже оказалось девять, а не одна: у Mega Drive нет `main` вовсе, `cartridge.ld` объявляет `ENTRY(_EntryPoint)`, и пока точка входа была общей, картридж линковался с `cannot find entry symbol _EntryPoint` — собранный по форме и незапускаемый по сути. Точка входа переехала в файл своей земли, и внутри раннера не осталось ни одного `#ifdef` по имени платформы: выбор делает CMake, а ветка `else ()` в этом выборе — `message(FATAL_ERROR)`.

Житель движка не увидит колотушки вовсе: она живёт под `tests/` и не попадает ни в свёрток, ни в договор. Снаружи изменилось одно: свитки перестали врать. `tests/AGENTS.md` давно обещал, что обереги проверяются на всех землях, и теперь это правда, проверяемая тем же способом, каким добывалась: набор собирается дважды, `toygine-units` привозной колотушкой и `toygine-units-builtin` своей. Семь зарубок и восемнадцать проверок в обеих руках; поменяй `0xFF` на `0xFE` в одной, и краснеют обе.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про отражение. Каменная чаша с водой, в которой
отражён дальний остров с тотемом; над водой рука с колотушкой; от чаши уходит
нить света к маяку. За спиной — настоящий остров на горизонте, тёмный и
молчащий. С первого взгляда должно читаться: бьют по отражению, а не по земле.
16:9, минимум 1600 × 900. Альтернатива: скриншот вывода отчёта в mGBA.

ALT RU: Каменная чаша с водой на скале: в отражении остров с тотемом, над водой рука с колотушкой, нить света уходит к маяку, настоящий остров тёмен
ALT EN: A stone water bowl on a cliff: an island with a totem reflected in it, a hand with a mallet above the water, a thread of light running to the beacon

ДЛЯ AI:
A wide stone bowl of still water set into a cliff ledge at dusk. The water
holds a complete reflection of a small distant island with a single carved
totem standing on it, sharp and bright as if it were the real place. A hand
holding a dark mallet reaches over the bowl from the right, about to strike
the reflected totem. From the rim of the bowl a thin thread of golden light
rises and runs away to the left, toward a tall stone beacon burning on a
headland. Behind the bowl and far beyond it, across open water on the horizon,
the same island stands for real: dark, flat, unlit, giving nothing back. The
viewpoint is level with the rim of the bowl so that the bright reflection and
the dark real island sit in the same frame, the bowl filling the lower half
and the horizon crossing the upper third.

FORMAT: 16:9 aspect ratio, at least 1600 × 900 pixels.

STYLE (identical across all images, so the set reads as one series):
  hand-drawn editorial illustration; clean confident linework in the spirit of
  Studio Ghibli background art; silhouette clarity and iconographic readability
  of a Zelda adventure map; ornamented like an old Polynesian navigational
  chart, with wave motifs and tattoo-like geometric banding along the borders.
  Unless the scene above states otherwise, every person in frame is an ancient
  Polynesian islander, dressed in the spirit of the costume design in Moana:
  tapa cloth and woven plant fibre, barkcloth wraps and skirts, shell, bone and
  feather ornaments, cord-bound or loose hair, wave-like tattoos, bare feet or
  plaited sandals, and nothing modern on them.
  The whole illustration sits on a torn sheet: the parchment ends in ragged
  deckle edges with visible paper fibres, and outside those edges the image is
  fully transparent alpha, never a white, coloured or rectangular fill.
PALETTE: turquoise and deep ocean blue, terracotta and coral, warm gold
  accents, on an aged parchment ground.
LIGHT AND TEXTURE: low warm sun, long soft shadows, visible paper grain,
  watercolor bleed at the edges, faint pencil under-drawing left showing.
NEGATIVE: no legible text, lettering, glyph captions or numerals anywhere;
  no logos or watermarks; no modern objects (screens, cables, vehicles);
  no modern clothing, uniforms, boots or headgear on the islanders; no straight
  cropped edges and no opaque background behind the torn sheet; no flat
  corporate vector style; no neon or cyberpunk palette; no photorealism
  or 3D render look; no lens flare; no close-up human faces; no clutter.
-->

## Отражение отвечает на оклик

Тотемы на дальних землях к середине цикла стояли, но по ним никто не бил: у всех консольных строк матрицы висело `run_test: "false"`. Свёрток с прошивкой уезжал на пристань, а жив ли внутри хоть один оберег — не знал никто. Я взялся заводить прогон в отражении и первым делом стал строить саму чашу: расписал шаг, клонирующий mGBA и собирающий `mgba-rom-test`. Потом заглянул в свой же тулчейн-образ и нашёл там `/usr/local/bin/mgba-headless`.

Оставалось научить прошивку понимать, где она находится. Она спрашивает вслух: кладёт `0xC0DE` по адресу `0x04FFF780` и ждёт `0x1DEA`; на железе этот диапазон не отвечает. Услышав ответ, прошивка ведёт себя иначе: отчёт на экране режется до тридцати колонок, а в отладочный лог уходит целиком, строка за строкой. Прошивка при этом одна: отдельной эмуляторной сборки нет, иначе я сторожил бы не то, что уношу. Выход пришлось выкладывать ассемблером — `swi 3` с вердиктом в `r0`, две ветки по `__thumb__`: готовый `Stop()` из libgba объявляет `r0` в clobber-списке и затирает код по дороге.

Признак «я в отражении» едет по тому же шву, что и весь отчёт: через `writerData`, который писатель получает снаружи. Соблазн завести переменную на уровне файла я знал в лицо — ровно такое состояние три задачи подряд вычищал из раннера. У Mega Drive голос устроен по-своему смешно: она печатает в неиспользуемый регистр VDP `0x9E`, который эмуляторы показывают как консоль, а на железе это безвредный `no-op`.

С земли всё это выглядит как одна новая строка у ворот: там, где стояло `run_test: "false"`, теперь идёт прогон и возвращается вердикт. Я переписал и смысл старой проверки на входе: `TOYGINE_TARGET_PLATFORM_SUPPORT_CTEST` больше не значит «здесь есть тесты» — он значит «здесь хозяин запускает бинарь сам». Край образа я держу и в голове, и в комментарии: отражение отвечает на оклик, а земля молчит, и различает их изнутри сам ритуал, а не чаша.

<!--
ДЛЯ ЧЕЛОВЕКА: кадр темы про мутационную проверку. Ряд тотемов, у одного
основание подпилено, и подпил виден зрителю, но не тому, кто бьёт: тотем стоит
ровно, как остальные. Строитель заносит колотушку. С первого взгляда должно
читаться: оберег повреждён и всё равно выглядит целым.
16:9, минимум 1600 × 900. Альтернатива: скриншот таблицы «инъекция — упавший тест».

ALT RU: Пять тотемов в ряд на берегу, у второго основание подпилено почти насквозь, но он стоит ровно; человек с колотушкой заносит руку над первым
ALT EN: Five totems in a row on the shore, the second sawn nearly through at the base yet standing straight; a figure raises a mallet over the first

ДЛЯ AI:
Morning light on a stony shore. Five carved wooden totems stand in a row,
evenly spaced, each with its own ornamental banding, all of them upright and
identical in bearing. The second totem from the left has been cut almost
all the way through at its base: a clean fresh notch shows pale inner wood and
a scatter of sawdust on the stones, yet the totem stands as straight as the
others and nothing about its posture gives it away. A standing figure at the
left, seen from behind and slightly below, raises a dark mallet over the first
totem, attention on that one, the damaged base outside their line of sight.
The viewpoint is low, so the row runs across the frame into perspective, the
cut base sits near the centre at eye level, and the horizon crosses the
upper third with open water beyond.

FORMAT: 16:9 aspect ratio, at least 1600 × 900 pixels.

STYLE (identical across all images, so the set reads as one series):
  hand-drawn editorial illustration; clean confident linework in the spirit of
  Studio Ghibli background art; silhouette clarity and iconographic readability
  of a Zelda adventure map; ornamented like an old Polynesian navigational
  chart, with wave motifs and tattoo-like geometric banding along the borders.
  Unless the scene above states otherwise, every person in frame is an ancient
  Polynesian islander, dressed in the spirit of the costume design in Moana:
  tapa cloth and woven plant fibre, barkcloth wraps and skirts, shell, bone and
  feather ornaments, cord-bound or loose hair, wave-like tattoos, bare feet or
  plaited sandals, and nothing modern on them.
  The whole illustration sits on a torn sheet: the parchment ends in ragged
  deckle edges with visible paper fibres, and outside those edges the image is
  fully transparent alpha, never a white, coloured or rectangular fill.
PALETTE: turquoise and deep ocean blue, terracotta and coral, warm gold
  accents, on an aged parchment ground.
LIGHT AND TEXTURE: low warm sun, long soft shadows, visible paper grain,
  watercolor bleed at the edges, faint pencil under-drawing left showing.
NEGATIVE: no legible text, lettering, glyph captions or numerals anywhere;
  no logos or watermarks; no modern objects (screens, cables, vehicles);
  no modern clothing, uniforms, boots or headgear on the islanders; no straight
  cropped edges and no opaque background behind the torn sheet; no flat
  corporate vector style; no neon or cyberpunk palette; no photorealism
  or 3D render look; no lens flare; no close-up human faces; no clutter.
-->

## Оберег, который стоит и не сторожит

Один оберег я переписывал четыре раза. Он должен был доказывать, что каждая ветвь обряда проходится ровно однажды, и первые три раза не доказывал, горя при этом зелёным. Сначала он опирался на счётчики уровня файла. Потом — на имя ветви, которое сам же и читал: раннер, входящий всякий раз в первую ветвь, даёт то же число проходов и ту же тройку имён, и убедился я в этом не рассуждением, а подпилив основание вставкой `if (index != 0)`. Потом он писал имена в `std::array`, храня только последнее вошедшее, и прогон, побывавший в обеих ветвях, выглядел как побывавший только во второй. Тоже прошёл. И лишь когда каждый прогон стал записывать `RunRecord { name, count }`, второй вход перестал прятаться за первым.

Отсюда правило, ради которого стоило потратить три вечера: зелёный прогон не говорит ничего о сторожевой силе оберега — он говорит лишь, что сегодня беды не случилось. Спросить оберег напрямую можно одним способом: подпилить то, что он сторожит, и посмотреть, закричит ли. Таблица «какой подпил — какой оберег упал» трижды за цикл поймала меня самого. Первый подпил уронил не оберег, а сборку: `ninja` оставил прежний бинарь, и «зелёный» прогон оказался вчерашним. Второй сломал сортировку списка, и зарубка «порядок постановки не выживает» прошла случайно: имена шли `zulu, mike, alpha`, а вставка всегда в голову даёт ровно ту же последовательность, так что зарубка, отрицавшая порядок регистрации, его же и повторяла. Третий обрушил оберег целиком: незащищённая цепочка `head->next()->next()->name()` дала `SIGSEGV`, а на дальней земле сигнал ловить некому. Тем же способом развалилось правило, вписанное в план заранее: сторож на прямое включение doctest оказался лишним, двойная сборка ловит это сама, громко и локально.

Жителю ничего из этого не видно. Он видит число: шестьдесят четыре оберега вместо семи, что стояли в начале цикла. Число красивое, и правдиво оно ровно настолько, насколько каждый из них выдержал подпил. Про свои я знаю, что выдержали не все и не сразу.

## Остальное за цикл

Семь дальних земель получили по пробному поселению: Nintendo DS, 3DS, Switch, GameCube, Wii, Wii U и Mega Drive встали рядом с Game Boy Advance, и свёртков за правку стало семнадцать вместо девяти. Wii U при этом долго числилась землёй, которой не существовало: ветка регистрации спрашивала `DEVKITPRO_WII_U_FOUND`, а модуль отдавал `DEVKITPRO_WIIU_FOUND`. GameCube отдала духа, которого я принял за косметического: проверка на входе спрашивала `__GAMECUBE__`, а libogc, единственная из инструментов предков, объявляет имя строчными, и `nm` не находил в собранном образе ни `VIDEO_Init`, ни `SYS_MainLoop`.

Самый дорогой дух за цикл жил в имени места. Обереги модулей отбирались фильтром, отбрасывающим пути со словом `runner`. На моей машине это работало, а в гавани нет: чекаут там лежит в `/home/runner/work/`, и слово стоит в пути каждого файла. Гавань собирала ноль оберегов, честно печатала `1..0` и оставалась зелёной. Заметил пропажу только дозор: он вернулся с пустым донесением и отказался его подписывать.

## Тупиковые тропы

<details>
<summary>Чаша, которую я собрался выточить сам</summary>

Полвечера ушло на чертёж шага, который клонирует mGBA и собирает `mgba-rom-test`. Готового инструмента не нашлось ни в `apt`, ни в релизах, ни в основном русле апстрима, и вывод «придётся собирать самому» был честным по добытым сведениям и неверным по факту: `mgba-headless` уже лежал в моём же тулчейн-образе. Я не проверил ближайшее место, прежде чем идти в дальние.

</details>

<details>
<summary>Разворот на следующее утро</summary>

Мне предложили расширить шов репортёра так, чтобы он мог нести чужое состояние. Я отказал, сославшись на будущую задачу: там репортёр держит своё состояние на уровне файла, значит, автор плана взвесил и выбрал. Наутро я перечитал то место внимательнее. Рядом стоял комментарий: «the reporter has no other way to know». Это не выбор архитектуры, а признание в отсутствии шва: мой довод «против» опирался ровно на то место, которое доказывает «за».

</details>

## Здоровье рифа

| Что я мерил                                  | Было                             | Стало                        |
| -------------------------------------------- | -------------------------------- | ---------------------------- |
| Оберегов в прогоне на ровной земле, всего    | 7                                | 64                           |
| Из них модульных, доходящих до гавани        | 0, съедены фильтром              | 7 зарубок и 18 проверок      |
| Колотушек в городе                           | 1 привозная                      | 2, звук сверяется между ними |
| Строк матрицы, где тестовый образ собирается | 9                                | 17                           |
| Строк матрицы, где обереги вправду бьют      | 9                                | 10                           |
| Точек входа у раннера                        | 1 общая, Mega Drive не линкуется | 9 платформенных              |
| Свёртков на пристани за правку               | 9                                | 17                           |

## Кохау

Табличка этого цикла — первая, на которой вырезано то, чего житель не увидит никогда. Снаружи видно одну строку «прогон пройден» напротив земли, где раньше стоял прочерк. Резать такое непривычно: обычно на табличку идёт то, что можно взять руками.

## Земли за горизонтом

Дальше я собирался довести до отражения остальные семь земель: у каждой своя чаша и свой голос, а Mega Drive, ради которой всё затевалось, оставалась непроверенной вживую.

Ещё я записал тогда, что обвязка прогона выродилась в условие `if [ "true" != "true" ]`, а отчёт дальней земли на зелёном прогоне не виден вовсе. Читаю это сейчас и вижу человека, который очень хотел закончить цикл.

## Вопрос к общине

Своя колотушка обошлась мне в девять заходов и в целый цикл, и я до сих пор не знаю, правильно ли посчитал. Формально она была нужна одной земле из восьми, а я взял на себя чужую ношу ради того, чтобы не держать в голове две разные привычки.

Вопрос к тем, кто строит сейчас на тесной земле: где у вас проходит эта граница? Терпите разнобой и держите два инструмента там, где каждый хорош, или тоже режете своё, чтобы весь город жил по одному обычаю? Я выбрал второе и до конца не уверен, что заплатил не слишком много.
