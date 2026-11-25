/*
 * Хоррор: две крошечные тёмно-красные точки в темноте.
 *
 * Появляются редко и в разных местах, медленно проявляются, коротко «моргают»
 * и исчезают. Никаких белков и зрачков — только намёк на чужой взгляд.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

registerEffect({
    id: 'eyes',
    name: 'Точки в темноте',
    icon: '·',
    group: 'ambient',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '156,24,28';
        const every = p.every || [8, 20];
        const alpha = p.alpha ?? 0.75;
        let list = [];
        let next = rnd(2, 6);

        function spawn() {
            const eye = rnd(1.1, 2.3);
            list.push({
                x: rnd(0.08, 0.92) * w,
                y: rnd(0.16, 0.76) * h,
                eye,
                gap: eye * rnd(1.8, 3.2),
                life: rnd(3, 7),
                age: 0,
                blink: rnd(0.4, 1.1),
                ph: rnd(0, Math.PI * 2),
            });
            if (list.length > 2) list.shift();
        }

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t, dt) {
                next -= dt;
                if (next <= 0) {
                    spawn();
                    next = env.lite ? rnd(16, 34) : rnd(every[0], every[1]);
                }

                for (let i = list.length - 1; i >= 0; i--) {
                    const e = list[i];
                    e.age += dt;
                    if (e.age >= e.life) {
                        list.splice(i, 1);
                        continue;
                    }

                    const fade = Math.min(1, e.age / 1.2, (e.life - e.age) / 1.4);
                    /* короткое моргание: почти мгновенное гашение */
                    const lid = Math.pow(Math.max(0, Math.sin(t * e.blink + e.ph)), 8);
                    const a = clamp(alpha * fade * (1 - lid), 0, 1);
                    if (a <= 0.02) continue;

                    ctx.fillStyle = `rgba(${color},${a})`;
                    for (const dir of [-1, 1]) {
                        ctx.beginPath();
                        ctx.arc(e.x + dir * e.gap, e.y, e.eye, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            },
        };
    },
});
