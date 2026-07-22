#!/usr/bin/env node
// Сканирует blog/**/*.md(x), считает посты по платформенным тегам,
// пишет src/data/platformTags.json. Запускается через npm pre-хуки
// (prebuild/prestart) — см. package.json.

import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';

// Единственное место, где заводится новая платформа: добавить строку
// сюда — и она сама появится в баре, как только на неё сошлётся хотя
// бы один пост. Цвета — из custom.css, продублированы явно, чтобы
// компонент не зависел от CSS-классов.
const PLATFORM_TAGS = [
    { tag: 'gba', label: 'GBA', color: '#C98A3E', textColor: '#2C1A08' },
    { tag: 'nds', label: 'NDS', color: '#B57C38', textColor: '#2C1A08' },
    { tag: 'steamdeck', label: 'STEAMDECK', color: '#5FA8A0', textColor: '#04342C' },
    { tag: 'switch', label: 'SWITCH', color: '#4C8F88', textColor: '#04342C' },
    { tag: 'desktop', label: 'DESKTOP', color: '#3A4250', textColor: '#E4DFD3' },
];

const BLOG_DIR = path.resolve('blog');
const OUTPUT_PATH = path.resolve('src/data/platformTags.json');

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(full));
        } else if (/\.mdx?$/.test(entry.name)) {
            files.push(full);
        }
    }
    return files;
}

const counts = Object.fromEntries(PLATFORM_TAGS.map((p) => [p.tag, 0]));

for (const file of walk(BLOG_DIR)) {
    const { data } = matter(fs.readFileSync(file, 'utf8'));
    const tags = Array.isArray(data.tags) ? data.tags : [];
    for (const tag of tags) {
        if (tag in counts) counts[tag] += 1;
    }
}

// Только теги, на которые реально есть посты — не показываем
// пустые/битые ссылки на архив без единой статьи.
const result = PLATFORM_TAGS.filter((p) => counts[p.tag] > 0).map((p) => ({
    tag: p.tag,
    label: p.label,
    color: p.color,
    textColor: p.textColor,
    count: counts[p.tag],
}));

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');

console.log(
    `platformTags.json: ${result.length} tag(s) — ${result
        .map((p) => `${p.tag}=${p.count}`)
        .join(', ') || 'none yet'}`,
);
