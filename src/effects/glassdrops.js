/*
 * Запотевшее стекло: очень бледный конденсат по краям и редкие капли,
 * которые медленно сползают вниз. Как в старом кино — стекло машины,
 * пар, дождь снаружи. Задумано так, чтобы текст читался поверх без помех.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

registerEffect({
    id: 'glassdrops',
    name: 'Капли на стекле',
    icon: '💧',
    group: 'atmosphere',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '226,214,228';
        const alpha = p.alpha ?? 0.5; // общий множитель прозрачности
        const count = p.count ?? 34;
        let drops = [];
        let veil = null;

        function seed() {
            const n = Math.round(count * (env.lite ? 0.55 : 1));
            drops = Array.from({ length: n }, () => make(true));
        }

        function make(init) {
            const r = rnd(1.4, 5.2);
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : rnd(-h * 0.2, 0),
                r,
                ry: r * rnd(1.1, 1.8),
                v: rnd(0, 15), // часть капель почти стоит, часть медленно ползёт
                trail: rnd(4, 30),
                o: rnd(0.1, 0.26),
                ph: rnd(0, Math.PI * 2),
            };
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
                /* конденсат: мягкая дымка по углам, один раз создаём градиент */
                if (!veil) {
                    veil = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
                    veil.addColorStop(0, `rgba(${color},0)`);
                    veil.addColorStop(0.62, `rgba(${color},${0.03 * alpha})`);
                    veil.addColorStop(1, `rgba(${color},${0.09 * alpha})`);
                }
                ctx.fillStyle = veil;
                ctx.fillRect(0, 0, w, h);

                for (const d of drops) {
                    d.y += d.v * dt;
                    if (d.y > h + d.ry) Object.assign(d, make(false));

                    const glow = 0.75 + 0.25 * Math.sin(t * 0.7 + d.ph);
                    const a = clamp(d.o * alpha * glow, 0, 1);

                    /* след от капли */
                    if (d.v > 3) {
                        const g = ctx.createLinearGradient(0, d.y - d.trail, 0, d.y);
                        g.addColorStop(0, `rgba(${color},0)`);
                        g.addColorStop(1, `rgba(${color},${a * 0.35})`);
                        ctx.strokeStyle = g;
                        ctx.lineWidth = Math.max(0.6, d.r * 0.35);
                        ctx.beginPath();
                        ctx.moveTo(d.x, d.y - d.trail);
                        ctx.lineTo(d.x, d.y);
                        ctx.stroke();
                    }

                    ctx.fillStyle = `rgba(${color},${a})`;
                    ctx.beginPath();
                    ctx.ellipse(d.x, d.y, d.r, d.ry, 0, 0, Math.PI * 2);
                    ctx.fill();

                    /* блик */
                    ctx.fillStyle = `rgba(255,255,255,${a * 0.55})`;
                    ctx.beginPath();
                    ctx.arc(d.x - d.r * 0.3, d.y - d.ry * 0.35, Math.max(0.6, d.r * 0.3), 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    },
});
