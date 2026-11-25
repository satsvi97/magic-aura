/*
 * Ветви: тёмные силуэты, свисающие с верхних углов кадра.
 *
 * Рисуются один раз в offscreen-канву (рекурсивное дерево), в кадре — drawImage.
 * Никаких ассетов: ветки процедурные, поэтому тянутся под любой размер экрана.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

/** Одна ветка: линия + рекурсивные побеги. rim — тёплый подсвет снизу (огонь). */
function branch(g, x, y, angle, len, width, depth, color, alpha, rim) {
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;

    g.lineCap = 'round';
    if (rim) {
        /* тонкая тёплая кромка чуть ниже силуэта: ветка читается на тёмном небе */
        g.strokeStyle = `rgba(${rim},${alpha * 0.3})`;
        g.lineWidth = Math.max(0.8, width + 1.1);
        g.beginPath();
        g.moveTo(x, y + 1.2);
        g.lineTo(x2, y2 + 1.2);
        g.stroke();
    }

    g.strokeStyle = `rgba(${color},${alpha})`;
    g.lineWidth = Math.max(0.35, width);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();

    if (depth <= 0 || width < 0.45) return;

    /* тонкие ветки светлее — даёт ощущение объёма, а не плоской заливки */
    const childAlpha = alpha * (depth > 2 ? 1 : 0.82);
    const kids = Math.random() < 0.38 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
        const dir = i === 0 ? -1 : 1;
        const spread = rnd(0.18, 0.5) * dir * (i === 2 ? 0.55 : 1);
        branch(
            g,
            x2,
            y2,
            angle + spread + rnd(-0.1, 0.1),
            len * rnd(0.6, 0.78),
            width * rnd(0.55, 0.68),
            depth - 1,
            color,
            childAlpha,
            rim,
        );
    }
}

registerEffect({
    id: 'branches',
    name: 'Ветви',
    group: 'ground',
    motion: false,
    create(env) {
        let w = env.w;
        let h = env.h;
        let dpr = env.dpr || 1;
        const p = env.params || {};
        const color = p.color || '16,11,14';
        const alpha = clamp(p.alpha ?? 0.55, 0.05, 1);
        const depth = Math.round(p.depth ?? 6);
        const scale = p.scale ?? 1;
        const sides = Array.isArray(p.sides) ? p.sides : ['left', 'right'];
        const rim = p.rim || '';
        let layer = null;

        function build() {
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * dpr));
            c.height = Math.max(1, Math.round(h * dpr));
            const g = c.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);

            /* Ветви — только намёк в углах, поэтому длина привязана к меньшей
               стороне и намеренно скромная: на телефоне они не должны лезть
               в чат. scale из сцены подкручивает ещё и от себя. */
            const len = Math.min(w * 0.10, h * 0.075) * scale;
            const width = Math.max(1.5, Math.min(w, h) * 0.005) * scale;

            if (sides.includes('left')) {
                branch(g, -w * 0.03, -h * 0.04, rnd(0.55, 0.8), len * 1.15, width, depth, color, alpha, rim);
                branch(g, w * 0.02, -h * 0.05, rnd(0.95, 1.2), len * 0.85, width * 0.75, depth - 1, color, alpha, rim);
                branch(g, w * 0.11, -h * 0.03, rnd(1.2, 1.45), len * 0.55, width * 0.55, depth - 2, color, alpha * 0.92, rim);
            }
            if (sides.includes('right')) {
                branch(g, w * 1.03, -h * 0.04, Math.PI - rnd(0.55, 0.8), len * 1.15, width, depth, color, alpha, rim);
                branch(g, w * 0.98, -h * 0.05, Math.PI - rnd(0.95, 1.2), len * 0.85, width * 0.75, depth - 1, color, alpha, rim);
                branch(g, w * 0.89, -h * 0.03, Math.PI - rnd(1.2, 1.45), len * 0.55, width * 0.55, depth - 2, color, alpha * 0.92, rim);
            }
            if (sides.includes('top')) {
                branch(g, w * rnd(0.3, 0.7), -h * 0.05, Math.PI / 2 + rnd(-0.3, 0.3), len * 0.8, width * 0.7, depth - 1, color, alpha * 0.9, rim);
            }

            layer = c;
        }
        build();

        return {
            resize(nw, nh, ndpr) {
                w = nw;
                h = nh;
                dpr = ndpr || dpr;
                build();
            },
            draw(ctx) {
                if (!layer) return;
                const shift = env.shift ? env.shift(0.55) : { x: 0, y: 0 };
                ctx.drawImage(layer, shift.x, shift.y, w, h);
            },
        };
    },
});
