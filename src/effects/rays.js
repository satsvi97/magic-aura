/*
 * Лучи света.
 *
 * Рисуются один раз в offscreen-канву при ресайзе, в кадре — один drawImage.
 * Специально без CSS-масок и repeating-градиентов: на мобильных GPU они дают
 * прямоугольные артефакты при композитинге поверх backdrop-filter чата.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

registerEffect({
    id: 'rays',
    name: 'Лучи света',
    group: 'sky',
    motion: false,
    create(env) {
        let w = env.w;
        let h = env.h;
        let dpr = env.dpr || 1;
        const p = env.params || {};
        const color = p.color || '255,214,150';
        const count = Math.round(p.count ?? 6);
        const strength = p.strength ?? 1;
        let layer = null;

        function build() {
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * dpr));
            c.height = Math.max(1, Math.round(h * dpr));
            const g = c.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.globalCompositeOperation = 'lighter';

            for (let i = 0; i < count; i++) {
                const x = ((i + 0.5) / count) * w + rnd(-w * 0.06, w * 0.06);
                const band = rnd(w * 0.035, w * 0.11);
                const alpha = rnd(0.05, 0.1) * clamp(strength, 0.2, 2);
                const angle = rnd(-0.3, -0.12);
                const len = h * 1.45;

                g.save();
                g.translate(x, -h * 0.12);
                g.rotate(angle);
                const grd = g.createLinearGradient(0, 0, 0, len);
                grd.addColorStop(0, `rgba(${color},${alpha})`);
                grd.addColorStop(0.5, `rgba(${color},${alpha * 0.5})`);
                grd.addColorStop(1, `rgba(${color},0)`);

                /* мягкие края: несколько полос с падающей альфой */
                const steps = 7;
                for (let s = 0; s < steps; s++) {
                    const k = 1 - Math.abs((s + 0.5) / steps - 0.5) * 2;
                    g.fillStyle = grd;
                    g.globalAlpha = clamp(k, 0, 1) * 0.55;
                    g.fillRect(-band / 2 + (band / steps) * s, 0, band / steps, len);
                }
                g.restore();
            }
            g.globalAlpha = 1;
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
