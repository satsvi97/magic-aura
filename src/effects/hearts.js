/*
 * Сердечки-искры: маленькие светящиеся сердечки, которые медленно поднимаются
 * вверх, покачиваясь. Для романтики — без сезонных лепестков.
 */
import { registerEffect, rnd, clamp } from '../engine.js';

function heart(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, 0.32);
    ctx.bezierCurveTo(-0.52, -0.1, -0.34, -0.52, 0, -0.22);
    ctx.bezierCurveTo(0.34, -0.52, 0.52, -0.1, 0, 0.32);
    ctx.fill();
    ctx.restore();
}

registerEffect({
    id: 'hearts',
    name: 'Сердечки',
    icon: '♥',
    group: 'particles',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,168,190';
        const count = p.count ?? 20;
        let list = [];

        function make(init) {
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : h + rnd(10, 80),
                s: rnd(5, 12),
                v: rnd(9, 26),
                sway: rnd(8, 26),
                ph: rnd(0, Math.PI * 2),
                sp: rnd(0.3, 0.9),
                o: rnd(0.35, 0.8),
                rot: rnd(-0.3, 0.3),
            };
        }

        function seed() {
            const n = Math.round(count * (env.lite ? 0.55 : 1));
            list = Array.from({ length: n }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, t, dt) {
                for (const e of list) {
                    e.y -= e.v * dt;
                    e.x += Math.sin(t * e.sp + e.ph) * e.sway * dt;
                    if (e.y < -30) {
                        Object.assign(e, make(false));
                        continue;
                    }
                    const pulse = 0.6 + 0.4 * Math.sin(t * 0.8 + e.ph);
                    heart(ctx, e.x, e.y, e.s, color, clamp(e.o * pulse, 0, 1));
                }
            },
        };
    },
});
