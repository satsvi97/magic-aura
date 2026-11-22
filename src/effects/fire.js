/* Огонь и пыль: искры, пылинки, светлячки. Все — аддитивные, поэтому blend: 'lighter'. */
import { registerEffect, rnd, clamp, budget } from '../engine.js';

/* Мягкое свечение: спрайт рисуется один раз, в кадре — один drawImage. */
function glowSprite(color, stops = 3) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${color},1)`);
    grd.addColorStop(stops === 3 ? 0.28 : 0.5, `rgba(${color},.6)`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
}

/* ---------- искры ---------- */
registerEffect({
    id: 'embers',
    name: 'Искры',
    icon: '🔥',
    group: 'particles',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,186,120';
        const scale = p.size ?? 1;
        const sprite = glowSprite(color, 2);
        let list = [];
        /* вспышки от интерактива: живут пару секунд, гаснут и исчезают */
        let flares = [];

        function make(init) {
            const r = rnd(0.7, 2) * scale;
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : h + rnd(0, h * 0.15),
                r,
                v: rnd(26, 90),
                sway: rnd(8, 34),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.5, 1.7),
                o: rnd(0.35, 1),
                fade: rnd(0.06, 0.22),
            };
        }

        function seed() {
            list = Array.from({ length: budget(w, h, 12000, 26, 150, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            /** Вспышка искр: входящее — у нижней кромки, исходящее — по всему низу. */
            burst(kind) {
                const n = env.lite ? 8 : kind === 'receive' ? 16 : 24;
                for (let i = 0; i < n; i++) {
                    flares.push({
                        x: rnd(w * 0.15, w * 0.85),
                        y: h - rnd(0, h * 0.12),
                        r: rnd(1.2, 3.2) * scale,
                        vx: rnd(-38, 38),
                        vy: rnd(-190, -70),
                        life: rnd(0.9, 1.9),
                        age: 0,
                        o: rnd(0.5, 1),
                    });
                }
            },
            draw(ctx, t, dt) {
                for (const e of list) {
                    e.y -= e.v * dt;
                    e.x += Math.sin(t * e.sp + e.ph) * e.sway * dt;
                    if (e.y < -20) {
                        Object.assign(e, make(false));
                        continue;
                    }
                    const k = clamp((e.y / h) * 0.9 + 0.1, 0, 1) * e.o;
                    const s = e.r * 4.5;
                    ctx.globalAlpha = clamp(k, 0, 1);
                    ctx.drawImage(sprite, e.x - s / 2, e.y - s / 2, s, s);
                }

                for (let i = flares.length - 1; i >= 0; i--) {
                    const f = flares[i];
                    f.age += dt;
                    if (f.age >= f.life) {
                        flares.splice(i, 1);
                        continue;
                    }
                    f.x += f.vx * dt;
                    f.y += f.vy * dt;
                    f.vy += 120 * dt;
                    f.vx *= 1 - 0.6 * dt;
                    const k = 1 - f.age / f.life;
                    const s = f.r * 6 * (0.6 + k * 0.8);
                    ctx.globalAlpha = clamp(k * f.o, 0, 1);
                    ctx.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});

/* ---------- пыль / золотые пылинки ---------- */
registerEffect({
    id: 'motes',
    name: 'Пылинки',
    icon: '✧',
    group: 'particles',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '230,214,170';
        const scale = p.size ?? 1;
        let list = [];

        function make(init) {
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : rnd(0, h),
                r: rnd(0.5, 1.9) * scale,
                vx: rnd(-11, 11),
                vy: rnd(-13, 5),
                sp: rnd(0.2, 1.1),
                ph: rnd(0, Math.PI * 2),
                o: rnd(0.25, 0.85),
            };
        }
        list = Array.from({ length: budget(w, h, 15000, 16, 110, env) }, () => make(true));

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                list = Array.from({ length: budget(w, h, 15000, 16, 110, env) }, () => make(true));
            },
            draw(ctx, t, dt) {
                for (const m of list) {
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                    if (m.x < -10) m.x = w + 10;
                    if (m.x > w + 10) m.x = -10;
                    if (m.y < -10) m.y = h + 10;
                    if (m.y > h + 10) m.y = -10;

                    const a = m.o * (0.45 + 0.55 * Math.sin(t * m.sp + m.ph));
                    ctx.fillStyle = `rgba(${color},${clamp(a, 0, 1)})`;
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});

/* ---------- светлячки ---------- */
registerEffect({
    id: 'fireflies',
    name: 'Светлячки',
    icon: '🪰',
    group: 'magic',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '198,255,170';
        const count = p.count ?? 26;
        const sprite = glowSprite(color);
        let list = [];

        function make() {
            return {
                x: rnd(0, w),
                y: rnd(h * 0.25, h),
                r: rnd(1.1, 2.4),
                a: rnd(0, Math.PI * 2),
                v: rnd(9, 26),
                turn: rnd(-0.9, 0.9),
                blink: rnd(0.6, 2.2),
                ph: rnd(0, Math.PI * 2),
                o: rnd(0.4, 0.95),
            };
        }
        list = Array.from({ length: Math.round(count * (env.lite ? 0.5 : 1)) }, make);

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t, dt) {
                for (const f of list) {
                    f.a += f.turn * dt * 0.8;
                    f.x += Math.cos(f.a) * f.v * dt;
                    f.y += Math.sin(f.a) * f.v * dt * 0.6;
                    if (f.x < -20) f.x = w + 20;
                    if (f.x > w + 20) f.x = -20;
                    if (f.y < h * 0.15) f.y = h * 0.15 + 4;
                    if (f.y > h + 20) f.y = h * 0.9;

                    const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * f.blink + f.ph), 2);
                    const a = clamp(f.o * (0.12 + 0.88 * pulse), 0, 1);
                    const s = f.r * 10;
                    ctx.globalAlpha = a;
                    ctx.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
