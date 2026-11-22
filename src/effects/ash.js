/* Пепел и низкий туман — «после пожара» и «кладбищенское утро». */
import { registerEffect, rnd, clamp, budget, gust, radialSprite } from '../engine.js';

/* ---------- пепел ---------- */
registerEffect({
    id: 'ash',
    name: 'Пепел',
    group: 'particles',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '188,184,192';
        const sizeK = p.size ?? 1;
        let list = [];

        function make(init) {
            const r = rnd(1, 3.2) * sizeK;
            return {
                x: rnd(-0.1, 1.1) * w,
                y: init ? rnd(0, h) : rnd(-h * 0.2, -8),
                r,
                v: rnd(12, 34) * (1.6 - r / 4),
                drift: rnd(-8, 8),
                sway: rnd(10, 34),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.25, 0.9),
                rot: rnd(0, Math.PI * 2),
                spin: rnd(-1.4, 1.4),
                o: rnd(0.18, 0.6),
            };
        }

        function seed() {
            list = Array.from({ length: budget(w, h, 15000, 25, 170, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                const g = 1 + gust(t, 1.7) * 1.1;
                for (const a of list) {
                    a.y += a.v * dt;
                    a.x += (a.drift + Math.sin(t * a.sp + a.ph) * a.sway) * g * dt;
                    a.rot += a.spin * dt;

                    if (a.y - a.r > h + 10) {
                        Object.assign(a, make(false));
                        continue;
                    }
                    if (a.x < -20) a.x = w + 20;
                    if (a.x > w + 20) a.x = -20;

                    const o = clamp(a.o * (0.7 + 0.3 * Math.sin(t * 0.8 + a.ph)), 0.04, 0.8);
                    ctx.fillStyle = `rgba(${color},${o})`;
                    ctx.beginPath();
                    ctx.ellipse(a.x, a.y, a.r, a.r * 0.72, a.rot, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});

/* ---------- туман у земли ---------- */
registerEffect({
    id: 'groundm',
    name: 'Туман у земли',
    group: 'air',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '196,200,220';
        const level = p.level ?? 0.32; // насколько высоко поднимается
        const sprite = radialSprite(color, 96, 0.4);
        let bands = [];
        let veil = null;

        function seed() {
            const n = env.lite ? 4 : 7;
            bands = Array.from({ length: n }, () => ({
                x: rnd(-0.2, 1.2) * w,
                y: h * rnd(1 - level * 0.5, 1 + level * 0.35),
                r: rnd(0.18, 0.42) * Math.max(w, h),
                a: rnd(0.05, 0.12),
                v: rnd(-18, -4),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.05, 0.16),
            }));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                veil = null;
                seed();
            },
            draw(ctx, t, dt) {
                /* общая дымка по нижней трети: градиент строим один раз, а не каждый кадр */
                if (!veil) {
                    veil = ctx.createLinearGradient(0, h * (1 - level), 0, h);
                    veil.addColorStop(0, `rgba(${color},0)`);
                    veil.addColorStop(0.65, `rgba(${color},0.05)`);
                    veil.addColorStop(1, `rgba(${color},0.11)`);
                }
                ctx.fillStyle = veil;
                ctx.fillRect(0, h * (1 - level), w, h * level);

                for (const b of bands) {
                    b.x += b.v * (1 + gust(t, 2.3) * 0.9) * dt;
                    b.y += Math.sin(t * b.sp + b.ph) * 3 * dt;
                    if (b.x < -b.r) b.x = w + b.r;
                    if (b.x > w + b.r) b.x = -b.r;

                    ctx.globalAlpha = b.a;
                    ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
