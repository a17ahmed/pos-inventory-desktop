#!/usr/bin/env node
// Design guard rails (design/ROADMAP.md 10.3). Runs before every build and fails it when screen code
// goes around the design system:
//   1. raw Tailwind palette colours  (bg-slate-100, text-red-500, border-amber-200 …) → use tokens
//   2. the removed Stage-1 classes    (text-d-muted, bg-d-card, bg-primary-500 …)
//   3. pixel font sizes               (text-[13px]) → use a type role (text-body, text-caption …)
//   4. gradients                      (bg-gradient-to-r …) → buttons and cards are flat
//   5. hex colours in screen code     ('#f59e0b', bg-[#fff]) → use a token / var(--…)
//
// Escapes, for the rare real need:
//   • a line containing `design-ok` (say why: `// design-ok: paper is always white`)
//   • a region between `design-check: print-start` and `design-check: print-end` comments —
//     HTML built for printing / PDF, which is always black on white paper
//   • whole files in PRINT_FILES (receipt and statement templates)
//
// Usage: node scripts/check-design.mjs        (exit 1 on problems)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const PRINT_FILES = new Set([
    'src/utils/receiptTemplate.js',
    'src/utils/customerStatement.js',
    'src/utils/downloadReceipt.js',
    'src/utils/printReceipt.js',
]);

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PROPS = 'bg|text|border|border-[trblxy]|divide|ring|ring-offset|outline|placeholder|from|via|to|shadow|decoration|accent|caret|fill|stroke';
const B = `(?<=^|[\\s"'\`:{(])`; // start of a class token (after a variant prefix too)

const RULES = [
    {
        id: 'palette',
        re: new RegExp(`${B}(?:${PROPS})-(?:${PALETTE})-\\d{2,3}(?:\\/\\d+)?\\b`, 'g'),
        why: 'raw palette colour — use a token (text-muted-foreground, bg-destructive-chip, border-hairline …)',
    },
    {
        id: 'legacy',
        re: new RegExp(`${B}(?:${PROPS})-(?:d-[a-z-]+|primary-\\d{2,3})\\b`, 'g'),
        why: 'removed Stage-1 class — use the token it pointed at',
    },
    { id: 'text-px', re: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/g, why: 'pixel font size — use a type role (text-body, text-caption, text-h4 …)' },
    { id: 'gradient', re: /\bbg-gradient-to-[a-z]+\b/g, why: 'gradient — the design is flat (bg-primary, bg-card …)' },
    {
        id: 'hex',
        // a quoted hex colour ('#f59e0b'), or one inside an arbitrary class (bg-[#fff]); bill numbers like "#1042" don't match
        re: /(['"`])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1|\[#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\]/g,
        why: 'hex colour — use a token or var(--…)',
        skipPrint: true,
    },
];

const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
    });

const problems = [];
for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let inPrint = false;
    lines.forEach((line, i) => {
        if (line.includes('design-check: print-start')) inPrint = true;
        if (line.includes('design-check: print-end')) {
            inPrint = false;
            return;
        }
        if (line.includes('design-ok')) return;
        for (const rule of RULES) {
            if (rule.skipPrint && (inPrint || PRINT_FILES.has(rel))) continue;
            for (const m of line.matchAll(rule.re)) {
                problems.push({ rel, line: i + 1, col: m.index + 1, text: m[0], rule });
            }
        }
    });
}

if (problems.length) {
    console.error(`\n✗ Design check: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n`);
    for (const p of problems) console.error(`  ${p.rel}:${p.line}:${p.col}  ${p.text}  — ${p.rule.why}`);
    console.error('\n  Rules and escapes: scripts/check-design.mjs\n');
    process.exit(1);
}
console.log('✓ Design check passed');
