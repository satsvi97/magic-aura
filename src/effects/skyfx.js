/* Небо: звёзды, метеоры, молнии. */
import { registerEffect, rnd, clamp, budget } from '../engine.js';

/* ---------- звёзды ---------- */
registerEffect({
    id: 'stars',
    name: 'Звёзды',
    icon: '✦',
    group: 'sky',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '232,232,255';
        let stars = [];
        /* Группы по яркости: один путь + один fill на группу вместо 200 вызовов.
           Мерцание остаётся, но групповое — на глаз это тот же звёздный шум. */
        const BUCKETS = 4;

        function seed() {
            const n = Math.round((p.count ?? 200) * (env.lite ? 0.55 : 1));
            stars = Array.from({ length: n }, () => {
                const o = rnd(0.25, 0.95);
                return {
                    x: Math.random(),
                    y: Math.pow(Math.random(), 1.35) * 0.92,
                    r: rnd(0.5, 2),
                    o,
                    sp: rnd(0.4, 1.8),
                    ph: rnd(0, Math.PI * 2),
                    b: Math.min(BUCKETS - 1, Math.floor(o * BUCKETS)),
                };
            });
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t) {
                for (let b = 0; b < BUCKETS; b++) {
                    const pulse = 0.6 + 0.4 * Math.sin(t * (0.5 + b * 0.28) + b * 1.7);
                    const base = ((b + 0.5) / BUCKETS) * pulse * 1.25;
                    ctx.fillStyle = `rgba(${color},${clamp(base, 0.04, 1)})`;
                    ctx.beginPath();
                    let any = false;
                    for (const s of stars) {
                        if (s.b !== b) continue;
                        any = true;
                        ctx.moveTo(s.x * w + s.r, s.y * h);
                        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
                    }
                    if (any) ctx.fill();
                }
            },
        };
    },
});

/* ---------- метеоры ---------- */
registerEffect({
    id: 'meteors',
    name: 'Метеоры',
    icon: '☄️',
    group: 'sky',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,240,210';
        const every = p.every || [2.5, 7];
        let shots = [];
        let next = rnd(0.6, 2.5);

        function shoot() {
            const sx = rnd(0.05, 0.95) * w;
            const sy = rnd(0.02, 0.4) * h;
            const ang = rnd(Math.PI * 0.16, Math.PI * 0.34);
            const sp = rnd(520, 900);
            shots.push({
                x: sx,
                y: sy,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: rnd(0.6, 1.05),
                age: 0,
            });
        }

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            /** Отправка сообщения: одна падающая звезда в ответ. */
            burst(kind) {
                if (kind === 'send') shoot();
            },
            draw(ctx, t, dt) {
                next -= dt;
                if (next <= 0) {
                    next = rnd(every[0], every[1]);
                    shoot();
                }

                for (const s of shots) {
                    s.age += dt;
                    s.x += s.vx * dt;
                    s.y += s.vy * dt;
                }
                shots = shots.filter((s) => s.age < s.life);

                for (const s of shots) {
                    const k = 1 - s.age / s.life;
                    const len = 120 * k + 30;
                    const tx = s.x - s.vx * 0.001 * len;
                    const ty = s.y - s.vy * 0.001 * len;
                    const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
                    g.addColorStop(0, `rgba(${color},${0.9 * k})`);
                    g.addColorStop(1, `rgba(${color},0)`);
                    ctx.strokeStyle = g;
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();

                    ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});

/* ---------- молнии ---------- */
registerEffect({
    id: 'lightning',
    name: 'Молнии',
    icon: '⚡',
    group: 'precip',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '238,242,255';
        const every = p.every || [7, 17];
        let next = rnd(1.5, 5);
        let bolt = null;
        let age = 0;
        let life = 0;

        function makeBolt() {
            const startX = rnd(0.12, 0.88) * w;
            const pts = [{ x: startX, y: -10 }];
            let x = startX;
            let y = -10;
            const segments = Math.round(rnd(8, 14));
            for (let i = 0; i < segments; i++) {
                y += (h + 20) / segments;
                x += rnd(-0.05, 0.05) * w;
                pts.push({ x, y });
            }
            return pts;
        }

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t, dt) {
                if (age > 0) {
                    age -= dt;
                    const k = clamp(age / life, 0, 1);
                    ctx.fillStyle = `rgba(${color},${0.05 * k})`;
                    ctx.fillRect(0, 0, w, h);
                    if (bolt && k > 0.25) {
                        ctx.strokeStyle = `rgba(${color},${0.18 * k})`;
                        ctx.lineWidth = 9;
                        path(ctx, bolt);
                        ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
                        ctx.lineWidth = 1.6;
                        path(ctx, bolt);
                    }
                    if (age <= 0) bolt = null;
                }

                next -= dt;
                if (next <= 0) {
                    next = rnd(every[0], every[1]);
                    bolt = makeBolt();
                    life = rnd(0.28, 0.5);
                    age = life;
                }
            },
        };
    },
});

function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
}
