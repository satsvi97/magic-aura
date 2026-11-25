/*
 * Глаза в темноте: редкие пары бледных глаз, которые появляются, моргают
 * и растворяются. Только для хоррора — спавн редкий, чтобы не превращать
 * сцену в цирк.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

registerEffect({
    id: 'eyes',
    name: 'Глаза в темноте',
    icon: '👁',
    group: 'ambient',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '190,214,196';
        const every = p.every || [7, 17];
        const alpha = p.alpha ?? 0.55;
        let list = [];
        let next = rnd(1, 3);

        function spawn() {
            const s = rnd(0.7, 1.5);
            /* по краям: центр обычно занят чатом, и глаза за ним не видны */
            const x = Math.random() < 0.5 ? rnd(0.06, 0.27) : rnd(0.73, 0.94);
            list.push({
                x: x * w,
                y: rnd(0.22, 0.72) * h,
                s,
                gap: 14 * s,
                life: rnd(4, 8),
                age: 0,
                blink: rnd(0.5, 1.3),
                ph: rnd(0, Math.PI * 2),
            });
            if (list.length > 3) list.shift();
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

                    /* проявление и растворение */
                    const fade = Math.min(1, e.age / 0.8, (e.life - e.age) / 1.1);
                    /* веко: резкий провал альфы — короткое моргание */
                    const lid = Math.pow(Math.max(0, Math.sin(t * e.blink + e.ph)), 6);
                    const a = clamp(alpha * fade * (1 - lid), 0, 1);
                    if (a <= 0.01) continue;

                    const rx = 7 * e.s;
                    const ry = 3.6 * e.s;
                    for (const dir of [-1, 1]) {
                        const x = e.x + dir * e.gap;
                        ctx.fillStyle = `rgba(${color},${a})`;
                        ctx.beginPath();
                        ctx.ellipse(x, e.y, rx, ry, 0, 0, Math.PI * 2);
                        ctx.fill();
                        /* зрачок */
                        ctx.fillStyle = `rgba(8,10,10,${a * 0.9})`;
                        ctx.beginPath();
                        ctx.arc(x, e.y, Math.max(1, ry * 0.5), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            },
        };
    },
});
