/*
 * Световые засветки «из старой плёнки»: тёплые пятна, наползающие с краёв.
 * Для воспоминаний — очень мягко, низкая прозрачность, медленное движение.
 */
import { registerEffect, rnd, clamp, radialSprite } from '../engine.js';

registerEffect({
    id: 'leak',
    name: 'Засветка',
    icon: '◠',
    group: 'light',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,206,150';
        const sprite = radialSprite(color, 128, 0.22);
        const alpha = p.alpha ?? 0.12;
        const spots = [
            { ax: 0.06, ay: 0.18, r: 0.9, ph: 0.2, sp: 0.05, dx: 0.05, dy: 0.03 },
            { ax: 0.94, ay: 0.82, r: 1.25, ph: 3.1, sp: 0.037, dx: -0.06, dy: -0.04 },
            { ax: 0.5, ay: 1.05, r: 1.6, ph: 5.4, sp: 0.026, dx: 0.03, dy: -0.05 },
        ];

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t) {
                for (const s of spots) {
                    const x = w * (s.ax + Math.sin(t * s.sp + s.ph) * s.dx);
                    const y = h * (s.ay + Math.cos(t * s.sp * 0.8 + s.ph) * s.dy);
                    const size = Math.min(w, h) * s.r * 2;
                    const k = 0.65 + 0.35 * Math.sin(t * s.sp * 1.7 + s.ph);
                    ctx.globalAlpha = clamp(alpha * k, 0, 1);
                    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
