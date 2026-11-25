/*
 * Поленья в камине: два тёмных бревна и тёплая кайма от огня.
 * Статичный слой — рисуется один раз в буфер, в кадре только drawImage.
 */
import { registerEffect, rnd } from '../engine.js';

registerEffect({
    id: 'logs',
    name: 'Поленья',
    icon: '🪵',
    group: 'ground',
    motion: false,
    create(env) {
        let w = env.w;
        let h = env.h;
        let dpr = env.dpr || 1;
        const p = env.params || {};
        const color = p.color || '20,12,9';
        const rim = p.rim || '255,150,80';
        const level = p.level ?? 0.9; // где по высоте лежат поленья
        const widthK = p.width ?? 0.34;
        let layer = null;

        function log(g, cx, cy, len, thick, angle, alpha) {
            g.save();
            g.translate(cx, cy);
            g.rotate(angle);

            const r = thick;
            const body = () => {
                g.beginPath();
                g.moveTo(-len / 2 + r, -thick);
                g.lineTo(len / 2 - r, -thick);
                g.quadraticCurveTo(len / 2, 0, len / 2 - r, thick);
                g.lineTo(-len / 2 + r, thick);
                g.quadraticCurveTo(-len / 2, 0, -len / 2 + r, -thick);
                g.closePath();
            };

            /* тело бревна: почти чёрное, без бликов */
            g.fillStyle = `rgba(${color},${alpha})`;
            body();
            g.fill();

            /* тёплый ободок только по верхней кромке — его и подсвечивает огонь */
            const rimGrd = g.createLinearGradient(0, -thick, 0, thick * 0.2);
            rimGrd.addColorStop(0, `rgba(${rim},${0.34 * alpha})`);
            rimGrd.addColorStop(1, `rgba(${rim},0)`);
            g.fillStyle = rimGrd;
            body();
            g.fill();

            /* спил на торце */
            g.fillStyle = `rgba(${color},${alpha})`;
            g.beginPath();
            g.ellipse(-len / 2 + r, 0, r * 0.55, thick, 0, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = `rgba(${rim},${0.22 * alpha})`;
            g.lineWidth = 1;
            g.beginPath();
            g.ellipse(-len / 2 + r, 0, r * 0.55, thick, 0, 0, Math.PI * 2);
            g.stroke();

            /* трещины, в которых видно угли */
            g.strokeStyle = `rgba(${rim},${0.45 * alpha})`;
            g.lineWidth = Math.max(1, thick * 0.07);
            for (let i = -1; i <= 1; i++) {
                const x = i * len * 0.18 + rnd(-6, 6);
                g.beginPath();
                g.moveTo(x, -thick * 0.3);
                g.lineTo(x + rnd(-8, 8), thick * 0.3);
                g.stroke();
            }
            g.restore();
        }

        function build() {
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * dpr));
            c.height = Math.max(1, Math.round(h * dpr));
            const g = c.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);

            const len = Math.min(w * 0.3, h * 0.45);
            const thick = Math.max(6, len * 0.075);
            const cx = w * 0.5;
            const cy = h * level;

            log(g, cx - len * 0.1, cy, len, thick, rnd(0.06, 0.12), 0.95);
            log(g, cx + len * 0.08, cy + thick * 1.15, len * 0.92, thick * 0.9, -rnd(0.05, 0.1), 0.9);
            log(g, cx, cy + thick * 2.05, len * 0.8, thick * 0.8, rnd(-0.03, 0.03), 0.82);

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
