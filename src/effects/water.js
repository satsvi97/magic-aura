/* Вода: пузыри и планктон. */
import { registerEffect, rnd, clamp, budget } from '../engine.js';

registerEffect({
    id: 'bubbles',
    name: 'Пузыри',
    icon: '🫧',
    group: 'water',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '176,226,255';
        let list = [];

        function make(init) {
            const r = rnd(1.4, 5.5);
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : h + rnd(6, 80),
                r,
                v: rnd(22, 62) * (1.4 - r / 10),
                sway: rnd(6, 22),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.4, 1.3),
                o: rnd(0.18, 0.5),
            };
        }

        function seed() {
            list = Array.from({ length: budget(w, h, 18000, 14, 90, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                for (const b of list) {
                    b.y -= b.v * dt;
                    b.x += Math.sin(t * b.sp + b.ph) * b.sway * dt;
                    if (b.y < -12) {
                        Object.assign(b, make(false));
                        continue;
                    }
                    ctx.strokeStyle = `rgba(${color},${b.o})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = `rgba(255,255,255,${b.o * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, Math.max(0.4, b.r * 0.28), 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});

registerEffect({
    id: 'plankton',
    name: 'Планктон',
    icon: '🦠',
    group: 'water',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '120,235,210';
        let list = [];

        function make() {
            return {
                x: rnd(0, w),
                y: rnd(0, h),
                r: rnd(0.5, 1.6),
                vx: rnd(-6, 6),
                vy: rnd(-9, 3),
                sp: rnd(0.3, 1.4),
                ph: rnd(0, Math.PI * 2),
                o: rnd(0.2, 0.8),
            };
        }
        list = Array.from({ length: budget(w, h, 12000, 20, 140, env) }, make);

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                list = Array.from({ length: budget(w, h, 12000, 20, 140, env) }, make);
            },
            draw(ctx, t, dt) {
                for (const m of list) {
                    m.x += (m.vx + Math.sin(t * m.sp + m.ph) * 5) * dt;
                    m.y += m.vy * dt;
                    if (m.x < -8) m.x = w + 8;
                    if (m.x > w + 8) m.x = -8;
                    if (m.y < -8) m.y = h + 8;
                    if (m.y > h + 8) m.y = -8;

                    const a = m.o * (0.4 + 0.6 * Math.sin(t * m.sp + m.ph * 2));
                    ctx.fillStyle = `rgba(${color},${clamp(a, 0, 1)})`;
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});
