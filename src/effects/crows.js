/*
 * Вороны: редкие стайки силуэтов, пролетающие через кадр.
 *
 * Никаких спрайтов — птица это две дуги-крыла и тельце. Раз в 9–24 секунды
 * прилетает стайка из 2–5 штук, летит по слегка волнистой траектории и уходит
 * за край. В Lite-режиме реже и малочисленнее.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

registerEffect({
    id: 'crows',
    name: 'Вороны',
    icon: '🦅',
    group: 'ambient',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '10,8,12';
        const alpha = clamp(p.alpha ?? 0.55, 0.05, 0.95);
        const bandY = p.y ?? 0.26;

        let birds = [];
        let next = rnd(2, 8);

        function flock() {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const n = env.lite ? 2 : 2 + ((Math.random() * 4) | 0);
            const baseY = h * (bandY + rnd(-0.08, 0.1));
            const speed = rnd(46, 96) * (env.lite ? 0.8 : 1);
            for (let i = 0; i < n; i++) {
                birds.push({
                    x: dir > 0 ? -w * 0.12 - rnd(0, w * 0.1) : w * 1.12 + rnd(0, w * 0.1),
                    y: baseY + rnd(-h * 0.06, h * 0.06),
                    dir,
                    v: speed * rnd(0.85, 1.15),
                    s: rnd(0.7, 1.35),
                    ph: rnd(0, Math.PI * 2),
                    flap: rnd(4.6, 7.2),
                    wob: rnd(0.4, 1.2),
                });
            }
        }

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t, dt) {
                next -= dt;
                if (next <= 0) {
                    flock();
                    next = env.lite ? rnd(24, 48) : rnd(9, 24);
                }

                const shift = env.shift ? env.shift(0.35) : { x: 0, y: 0 };
                ctx.strokeStyle = `rgba(${color},${alpha})`;
                ctx.fillStyle = `rgba(${color},${alpha})`;
                ctx.lineCap = 'round';

                for (const b of birds) {
                    b.x += b.v * b.dir * dt;
                    b.y += Math.sin(t * b.wob + b.ph) * 5 * dt;

                    const off = b.x < -w * 0.2 || b.x > w * 1.2;
                    if (off) continue;

                    const flap = Math.sin(t * b.flap + b.ph);
                    const span = 9 * b.s;
                    const lift = 5 * b.s * flap;
                    const x = b.x + shift.x;
                    const y = b.y + shift.y;

                    ctx.lineWidth = Math.max(1, 1.5 * b.s);
                    ctx.beginPath();
                    ctx.moveTo(x - span, y - lift * 0.5);
                    ctx.quadraticCurveTo(x - span * 0.45, y - span * 0.55 - lift, x, y);
                    ctx.quadraticCurveTo(x + span * 0.45, y - span * 0.55 - lift, x + span, y - lift * 0.5);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.ellipse(x, y + 0.6, 2.1 * b.s, 1.1 * b.s, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                birds = birds.filter((b) => b.x > -w * 0.25 && b.x < w * 1.25);
            },
        };
    },
});
