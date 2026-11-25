/*
 * Мягкий пульс света: очень медленное «дыхание» тёплого или красного пятна.
 * Для романтики, страсти и хоррора. Один спрайт, один drawImage за кадр.
 */
import { registerEffect, clamp, radialSprite } from '../engine.js';

registerEffect({
    id: 'pulse',
    name: 'Пульс света',
    icon: '◉',
    group: 'light',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,120,130';
        const sprite = radialSprite(color, 128, 0.28);
        const alpha = p.alpha ?? 0.12;
        const rate = p.rate ?? 0.16; // герц: 0.16 — примерно раз в 6 секунд
        const y = p.y ?? 0.72;
        const sizeK = p.size ?? 1.5;

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t) {
                const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * rate - Math.PI / 2);
                const s = Math.min(w, h) * sizeK * 2;
                ctx.globalAlpha = clamp(alpha * (0.35 + 0.65 * k), 0, 1);
                ctx.drawImage(sprite, w / 2 - s / 2, h * y - s / 2, s, s);
                ctx.globalAlpha = 1;
            },
        };
    },
});
