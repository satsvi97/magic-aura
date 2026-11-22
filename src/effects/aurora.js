/*
 * Северное сияние: медленные полосы света, которые колышутся и переливаются.
 *
 * Полоса рисуется один раз в offscreen-канву (вертикальный градиент с шумным
 * профилем по горизонтали), в кадре — несколько drawImage с наклоном и сдвигом.
 * Это дешевле, чем честный градиент на каждую колонку каждый кадр.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

function curtain(top, mid, seed = 0) {
    const W = 256;
    const H = 320;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    for (let x = 0; x < W; x++) {
        const ph = (x / W) * Math.PI * 2 + seed;
        /* мягкая кромка: без неё полоса даёт прямоугольный шов на краях */
        const edge = Math.pow(Math.sin((x / W) * Math.PI), 0.85);
        const a = edge * (0.55
            + 0.22 * Math.sin(ph * 1.7)
            + 0.16 * Math.sin(ph * 3.1 + 1.2)
            + 0.1 * Math.sin(ph * 5.3 + 2.1));
        const grd = g.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, `rgba(${top},${clamp(a, 0, 0.92)})`);
        grd.addColorStop(0.38, `rgba(${mid},${clamp(a * 0.7, 0, 0.72)})`);
        grd.addColorStop(0.7, `rgba(${mid},${clamp(a * 0.2, 0, 0.3)})`);
        grd.addColorStop(1, `rgba(${mid},0)`);
        g.fillStyle = grd;
        g.fillRect(x, 0, 1, H);
    }
    return c;
}

registerEffect({
    id: 'aurora',
    name: 'Сияние',
    icon: '🌌',
    group: 'sky',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const green = p.green || '110,255,190';
        const violet = p.violet || '186,150,255';
        const layers = [
            { sprite: curtain(green, violet, 0.4), k: 0.72, y: -0.05, a: 0.95, vx: 7, ph: 0.3 },
            { sprite: curtain(violet, green, 2.2), k: 0.54, y: 0.0, a: 0.66, vx: -5, ph: 2.1 },
            { sprite: curtain(green, green, 4.1), k: 0.4, y: -0.1, a: 0.45, vx: 3, ph: 4.4 },
        ];

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t) {
                const shift = env.shift ? env.shift(0.5) : { x: 0, y: 0 };
                const bandH = h * 0.62;
                for (const L of layers) {
                    const bw = w * L.k;
                    const sway = Math.sin(t * 0.12 + L.ph) * w * 0.05;
                    const x = (w - bw) / 2 + sway + shift.x * L.k;
                    const y = h * L.y + Math.sin(t * 0.09 + L.ph * 1.7) * h * 0.015 + shift.y;
                    const pulse = 0.82 + 0.18 * Math.sin(t * 0.23 + L.ph);

                    ctx.save();
                    ctx.globalAlpha = clamp(L.a * pulse * (env.lite ? 0.6 : 1), 0, 1);
                    ctx.translate(x + bw / 2, y + bandH / 2);
                    ctx.transform(1, 0, Math.sin(t * 0.08 + L.ph) * 0.1, 1, 0, 0);
                    ctx.drawImage(L.sprite, -bw / 2, -bandH / 2, bw, bandH);
                    ctx.restore();
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
