/* Осадки: дождь и снег. Оба эффекта живут в общем canvas движка. */
import { registerEffect, rnd, clamp, budget } from '../engine.js';

/* ---------- дождь ---------- */
registerEffect({
    id: 'rain',
    name: 'Дождь',
    icon: '🌧',
    group: 'precip',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '186,214,255';
        const wind = p.wind ?? 0.22;
        const lenK = p.len ?? 1;
        let drops = [];

        function seed() {
            const n = budget(w, h, 8600, 40, 260, env);
            drops = Array.from({ length: n }, () => make(true));
        }

        function make(init) {
            const v = rnd(760, 1400) * (env.lite ? 0.9 : 1);
            return {
                x: rnd(-0.25, 1.15) * w,
                y: init ? rnd(0, h) : rnd(-h * 0.4, 0),
                v,
                l: rnd(10, 38) * lenK,
                o: rnd(0.14, 0.46),
                w: rnd(0.7, 1.4),
            };
        }

        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                ctx.lineCap = 'round';
                for (const d of drops) {
                    d.y += d.v * dt;
                    d.x += d.v * wind * dt;
                    if (d.y - d.l > h + 20) {
                        Object.assign(d, make(false));
                        continue;
                    }
                    if (d.x > w + 40) d.x -= w + 80;
                    if (d.x < -40) d.x += w + 80;

                    const k = d.l / Math.hypot(wind, 1);
                    ctx.strokeStyle = `rgba(${color},${d.o})`;
                    ctx.lineWidth = d.w;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x - wind * k, d.y - k);
                    ctx.stroke();
                }
            },
        };
    },
});

/* ---------- снег ---------- */
registerEffect({
    id: 'snow',
    name: 'Снег',
    icon: '❄️',
    group: 'precip',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '236,240,255';
        const wind = p.wind ?? 0.06;
        const sizeK = p.size ?? 1;
        let flakes = [];

        function make(init) {
            return {
                x: rnd(-0.1, 1.1) * w,
                y: init ? rnd(0, h) : rnd(-h * 0.3, 0),
                r: rnd(0.8, 2.6) * sizeK,
                v: rnd(24, 78),
                sway: rnd(6, 26),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.3, 1.1),
                o: rnd(0.25, 0.8),
            };
        }

        function seed() {
            flakes = Array.from({ length: budget(w, h, 11000, 30, 220, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                ctx.fillStyle = `rgb(${color})`;
                for (const f of flakes) {
                    f.y += f.v * dt;
                    f.x += (Math.sin(t * f.sp + f.ph) * f.sway + f.v * wind) * dt;
                    if (f.y > h + 6) {
                        Object.assign(f, make(false));
                        continue;
                    }
                    if (f.x > w + 8) f.x -= w + 16;
                    if (f.x < -8) f.x += w + 16;
                    ctx.globalAlpha = clamp(f.o, 0.05, 1);
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});

/* ---------- туман: медленные полосы, нарисованные мягкими градиентами ---------- */
registerEffect({
    id: 'mist',
    name: 'Туман',
    icon: '🌫',
    group: 'air',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '200,205,235';
        let bands = [];

        function seed() {
            const n = env.lite ? 4 : 7;
            bands = Array.from({ length: n }, (_, i) => ({
                x: rnd(-0.3, 1.3) * w,
                y: rnd(0.1, 1) * h,
                r: rnd(0.35, 0.75) * Math.max(w, h),
                a: rnd(0.03, 0.09),
                vx: rnd(-14, 14),
                vy: rnd(-4, 4),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.05, 0.18),
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
                for (const b of bands) {
                    b.x += (b.vx + Math.sin(t * b.sp + b.ph) * 6) * dt;
                    b.y += b.vy * dt;
                    if (b.x < -b.r) b.x = w + b.r;
                    if (b.x > w + b.r) b.x = -b.r;
                    if (b.y < -b.r) b.y = h + b.r;
                    if (b.y > h + b.r) b.y = -b.r;

                    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
                    g.addColorStop(0, `rgba(${color},${b.a})`);
                    g.addColorStop(0.55, `rgba(${color},${b.a * 0.45})`);
                    g.addColorStop(1, `rgba(${color},0)`);
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});
