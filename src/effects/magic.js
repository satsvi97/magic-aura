/* Магические частицы с хвостами и искры-вихрь. */
import { registerEffect, rnd, clamp } from '../engine.js';

/** Мягкое свечение: спрайт создаётся один раз, в кадре — один drawImage. */
function glow(color) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${color},1)`);
    grd.addColorStop(0.32, `rgba(${color},.55)`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
}

const DEFAULT_COLORS = ['184,184,255', '232,195,150', '160,220,255', '214,168,255'];

/* ---------- светляки с хвостами ---------- */
registerEffect({
    id: 'trails',
    name: 'Магические трассы',
    group: 'magic',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : DEFAULT_COLORS;
        const sprites = colors.map((c) => glow(c));
        const tail = Math.round(p.tail ?? 26);
        const wanted = p.count ?? 20;
        let list = [];

        function make(init) {
            const i = (Math.random() * colors.length) | 0;
            const a = rnd(0, Math.PI * 2);
            const v = rnd(38, 92);
            return {
                x: init ? rnd(0, w) : rnd(-40, w + 40),
                y: init ? rnd(0, h) : rnd(-40, h + 40),
                ang: a,
                v,
                turn: rnd(-0.8, 0.8),
                wobble: rnd(0.3, 1.1),
                ph: rnd(0, Math.PI * 2),
                r: rnd(1.1, 2.3),
                o: rnd(0.35, 0.95),
                color: colors[i],
                sprite: sprites[i],
                pts: [],
            };
        }

        function seed() {
            const n = Math.round(wanted * (env.lite ? 0.5 : 1) * Math.min(1.6, env.density));
            list = Array.from({ length: Math.max(4, n) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                for (const s of list) {
                    /* плавный поворот: частица гуляет по экрану, а не летит по прямой */
                    s.ang += s.turn * dt * 0.6 + Math.sin(t * 0.45 + s.ph) * 0.7 * dt;

                    const px = s.x;
                    const py = s.y;
                    s.x += Math.cos(s.ang) * s.v * dt + Math.cos(t * s.wobble + s.ph) * 7 * dt;
                    s.y += Math.sin(s.ang) * s.v * dt + Math.sin(t * s.wobble + s.ph) * 7 * dt;

                    let wrapped = false;
                    if (s.x < -70) {
                        s.x = w + 70;
                        wrapped = true;
                    } else if (s.x > w + 70) {
                        s.x = -70;
                        wrapped = true;
                    }
                    if (s.y < -70) {
                        s.y = h + 70;
                        wrapped = true;
                    } else if (s.y > h + 70) {
                        s.y = -70;
                        wrapped = true;
                    }

                    /* перенос с края на край — не повод рисовать хвост через весь
                       экран: рвём историю и начинаем заново */
                    const jump = Math.hypot(s.x - px, s.y - py);
                    if (wrapped || jump > 60) {
                        s.pts.length = 0;
                        s.pts.push({ x: s.x, y: s.y });
                        continue;
                    }

                    /* хвост набираем по расстоянию, а не по кадрам: на слабом
                       железе и при просадке FPS длина остаётся одинаковой */
                    const head = s.pts[0];
                    const moved = head ? Math.hypot(s.x - head.x, s.y - head.y) : 0;
                    if (!head || moved >= 2) {
                        s.pts.unshift({ x: s.x, y: s.y });
                        if (s.pts.length > tail) s.pts.pop();
                    }
                    if (s.pts.length < 2) continue;

                    ctx.lineCap = 'round';
                    for (let i = 1; i < s.pts.length; i++) {
                        const k = 1 - i / s.pts.length;
                        ctx.strokeStyle = `rgba(${s.color},${clamp(Math.pow(k, 1.5) * s.o * 0.85, 0, 1)})`;
                        ctx.lineWidth = 0.5 + k * 2.4;
                        ctx.beginPath();
                        ctx.moveTo(s.pts[i - 1].x, s.pts[i - 1].y);
                        ctx.lineTo(s.pts[i].x, s.pts[i].y);
                        ctx.stroke();
                    }

                    const d = s.r * 7;
                    ctx.globalAlpha = clamp(s.o, 0.1, 1) * (0.75 + 0.25 * Math.sin(t * 1.7 + s.ph));
                    ctx.drawImage(s.sprite, s.x - d / 2, s.y - d / 2, d, d);
                    ctx.globalAlpha = 1;
                }
                ctx.lineCap = 'butt';
            },
        };
    },
});

/* ---------- искры-вихрь: мелкие точки, кружащие вокруг медленных центров ---------- */
registerEffect({
    id: 'spirits',
    name: 'Искры-вихрь',
    group: 'magic',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : DEFAULT_COLORS;
        const sprites = colors.map((c) => glow(c));
        let list = [];

        function make() {
            const i = (Math.random() * colors.length) | 0;
            return {
                cx: rnd(0, w),
                cy: rnd(0, h),
                vx: rnd(-5, 5),
                vy: rnd(-4, 3),
                rad: rnd(16, 80),
                a: rnd(0, Math.PI * 2),
                sp: rnd(0.22, 0.85) * (Math.random() < 0.5 ? -1 : 1),
                r: rnd(1.3, 2.8),
                o: rnd(0.25, 0.8),
                sprite: sprites[i],
                ph: rnd(0, Math.PI * 2),
            };
        }

        function seed() {
            const n = Math.round((p.count ?? 40) * (env.lite ? 0.5 : 1) * Math.min(1.6, env.density));
            list = Array.from({ length: Math.max(6, n) }, make);
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                for (const s of list) {
                    s.a += s.sp * dt;
                    s.cx += s.vx * dt;
                    s.cy += s.vy * dt;
                    if (s.cx < -s.rad) s.cx = w + s.rad;
                    if (s.cx > w + s.rad) s.cx = -s.rad;
                    if (s.cy < -s.rad) s.cy = h + s.rad;
                    if (s.cy > h + s.rad) s.cy = -s.rad;

                    const x = s.cx + Math.cos(s.a) * s.rad;
                    const y = s.cy + Math.sin(s.a) * s.rad * 0.7;
                    const a = clamp(s.o * (0.45 + 0.55 * Math.sin(t * 1.4 + s.ph)), 0.02, 1);
                    const d = s.r * 6;
                    ctx.globalAlpha = a;
                    ctx.drawImage(s.sprite, x - d / 2, y - d / 2, d, d);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
