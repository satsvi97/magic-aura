/* Пустыня: дюны (статичный слой) и летящий песок. */
import { registerEffect, rnd, clamp, budget, radialSprite } from '../engine.js';

/* ---------- дюны ---------- */
registerEffect({
    id: 'dunes',
    name: 'Дюны',
    group: 'ground',
    motion: false,
    create(env) {
        let w = env.w;
        let h = env.h;
        let dpr = env.dpr || 1;
        const p = env.params || {};
        const far = p.far || '86,58,34';
        const near = p.near || '32,22,18';
        const horizon = p.horizon ?? 0.72;
        let layer = null;

        function ridge(g, base, amp, color, alpha, freq, phase) {
            const y0 = h * base;
            const top = h * amp;
            const grd = g.createLinearGradient(0, y0 - top, 0, h);
            grd.addColorStop(0, `rgba(${color},${alpha})`);
            grd.addColorStop(1, `rgba(${color},${alpha * 0.55})`);
            g.fillStyle = grd;
            g.beginPath();
            g.moveTo(0, h);
            for (let x = 0; x <= w + 6; x += 6) {
                const k = x / w;
                /* сумма трёх волн: один синус даёт горб, три — гребни дюн */
                const y =
                    y0 -
                    top *
                        (0.62 * Math.sin(k * Math.PI * freq + phase) +
                            0.28 * Math.sin(k * Math.PI * freq * 2.7 + phase * 1.7) +
                            0.12 * Math.sin(k * Math.PI * freq * 5.1 + phase * 0.6));
                g.lineTo(x, y);
            }
            g.lineTo(w, h);
            g.closePath();
            g.fill();
        }

        function build() {
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * dpr));
            c.height = Math.max(1, Math.round(h * dpr));
            const g = c.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            ridge(g, horizon - 0.06, 0.05, far, 0.42, 1.4, 0.9);
            ridge(g, horizon, 0.085, far, 0.6, 1.9, 0.4);
            ridge(g, horizon + 0.09, 0.12, near, 0.8, 2.6, 2.2);
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
                if (layer) ctx.drawImage(layer, 0, 0, w, h);
            },
        };
    },
});

/* ---------- летящий песок ---------- */
registerEffect({
    id: 'sand',
    name: 'Песок',
    group: 'ground',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '232,200,150';
        const wind = p.wind ?? 1;
        let list = [];

        function make(init) {
            const v = rnd(150, 470) * wind;
            return {
                x: init ? rnd(0, w) : rnd(-w * 0.35, -10),
                y: rnd(-10, h + 10),
                v,
                len: rnd(9, 34) * (0.5 + v / 800),
                o: rnd(0.08, 0.34),
                w: rnd(0.6, 1.5),
                drift: rnd(-16, 24),
                ph: rnd(0, Math.PI * 2),
            };
        }

        function seed() {
            list = Array.from({ length: budget(w, h, 7000, 60, 340, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                for (const g of list) {
                    g.x += g.v * dt;
                    g.y += (g.drift + Math.sin(t * 0.8 + g.ph) * 12) * dt;
                    if (g.x - g.len > w + 30) {
                        Object.assign(g, make(false));
                        continue;
                    }
                    if (g.y < -30) g.y = h + 30;
                    if (g.y > h + 30) g.y = -30;

                    const a = clamp(g.o, 0.02, 0.5);
                    ctx.strokeStyle = `rgba(${color},${a})`;
                    ctx.lineWidth = g.w;
                    ctx.beginPath();
                    ctx.moveTo(g.x, g.y);
                    ctx.lineTo(g.x - g.len, g.y - g.len * 0.08);
                    ctx.stroke();
                }
            },
        };
    },
});

/* ---------- марево: медленные восходящие волны тепла ---------- */
registerEffect({
    id: 'shimmer',
    name: 'Марево',
    group: 'ground',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,206,150';
        const sprite = radialSprite(color, 96, 0.35);
        let waves = [];

        function seed() {
            const n = env.lite ? 3 : 5;
            waves = Array.from({ length: n }, (_, i) => ({
                x: rnd(0, w),
                y: h * (0.55 + i * 0.09),
                r: rnd(0.25, 0.5) * Math.max(w, h),
                a: rnd(0.02, 0.05),
                v: rnd(4, 11),
                ph: rnd(0, Math.PI * 2),
            }));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                for (const b of waves) {
                    b.y -= b.v * dt;
                    if (b.y < h * 0.35) b.y = h + b.r * 0.3;
                    const k = 0.6 + 0.4 * Math.sin(t * 0.6 + b.ph);
                    ctx.globalAlpha = clamp(b.a * k, 0, 1);
                    ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
                }
            },
        };
    },
});
