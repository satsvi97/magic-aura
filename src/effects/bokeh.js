/*
 * Боке: мягкие расфокусированные круги света.
 *
 * Для романтики и «красного вечера»: крупные пятна, плывущие медленно, с
 * параллаксом. Рисуются спрайтами — один drawImage на круг.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

function blob(color) {
    const S = 96;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, `rgba(${color},.95)`);
    grd.addColorStop(0.35, `rgba(${color},.5)`);
    grd.addColorStop(0.72, `rgba(${color},.14)`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();
    /* тонкий светлый ободок — «линза» */
    g.strokeStyle = `rgba(${color},.28)`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.stroke();
    return c;
}

registerEffect({
    id: 'bokeh',
    name: 'Боке',
    icon: '◍',
    group: 'particles',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const colors = Array.isArray(p.colors) && p.colors.length
            ? p.colors
            : ['255,196,206', '255,168,186', '255,214,196'];
        const sprites = colors.map(blob);
        const wanted = p.count ?? (env.lite ? 9 : 18);
        const sizeK = p.size ?? 1;
        let list = [];

        function make(init) {
            const depth = rnd(0.45, 1.3);
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : rnd(0, h),
                r: rnd(14, 46) * sizeK * depth,
                sp: sprites[(Math.random() * sprites.length) | 0],
                vx: rnd(-7, 7),
                vy: init ? rnd(-6, 3) : rnd(-8, -2),
                ph: rnd(0, Math.PI * 2),
                pulse: rnd(0.12, 0.4),
                o: rnd(0.08, 0.3) * (0.6 + depth * 0.5),
                depth,
            };
        }

        function seed() {
            list = Array.from({ length: wanted }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            draw(ctx, t, dt) {
                const shift = env.shift ? env.shift(1.1) : { x: 0, y: 0 };
                for (const b of list) {
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    if (b.x < -b.r) b.x = w + b.r;
                    if (b.x > w + b.r) b.x = -b.r;
                    if (b.y < -b.r) b.y = h + b.r;
                    if (b.y > h + b.r) b.y = -b.r;

                    const a = b.o * (0.55 + 0.45 * Math.sin(t * b.pulse + b.ph));
                    const s = b.r * 2;
                    ctx.globalAlpha = clamp(a, 0, 1);
                    ctx.drawImage(
                        b.sp,
                        b.x - s / 2 + shift.x * b.depth,
                        b.y - s / 2 + shift.y * b.depth,
                        s,
                        s,
                    );
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
