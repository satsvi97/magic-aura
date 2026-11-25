/*
 * Точечный источник света: мягкое пятно с растушёванными краями.
 *
 * Нужен свече, костру и камину: полупрозрачный градиент, который чуть «дышит»,
 * но не мигает как стробоскоп. Один спрайт — один drawImage за кадр.
 */
import { registerEffect, clamp, radialSprite } from '../engine.js';

registerEffect({
    id: 'pointlight',
    name: 'Источник света',
    icon: '🔆',
    group: 'light',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,190,120';
        const sprite = radialSprite(color, 128, 0.32);
        const alpha = p.alpha ?? 0.45;
        const sizeK = p.size ?? 0.8;
        const xf = p.x ?? 0.5;
        const yf = p.y ?? 0.78;
        const flicker = p.flicker ?? 0.25;
        const speed = p.speed ?? 1;

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t) {
                /* нерегулярное «дыхание» пламени: три несинхронные синусоиды */
                const s1 = Math.sin(t * 1.7 * speed);
                const s2 = Math.sin(t * 3.9 * speed + 1.3);
                const s3 = Math.sin(t * 7.1 * speed + 2.7);
                const k = 1 - flicker * (0.5 + 0.5 * (s1 * 0.5 + s2 * 0.3 + s3 * 0.2));
                const s = Math.min(w, h) * sizeK * 2.4;
                ctx.globalAlpha = clamp(alpha * k, 0, 1);
                ctx.drawImage(sprite, w * xf - s / 2, h * yf - s / 2, s, s);
                ctx.globalAlpha = 1;
            },
        };
    },
});
