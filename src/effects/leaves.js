/* Листья и лепестки. Спрайт рисуется один раз на цвет, в кадре — поворот и один drawImage. */
import { registerEffect, rnd, clamp } from '../engine.js';

const S = 48;

/**
 * @param {string} color 'r,g,b'
 * @param {'leaf'|'petal'} shape
 */
function sprite(color, shape) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);

    g.fillStyle = `rgb(${color})`;
    g.beginPath();
    if (shape === 'petal') {
        /* лепесток сакуры: овал с выемкой на макушке */
        g.moveTo(0, -S * 0.4);
        g.bezierCurveTo(S * 0.3, -S * 0.3, S * 0.3, S * 0.26, 0, S * 0.36);
        g.bezierCurveTo(-S * 0.3, S * 0.26, -S * 0.3, -S * 0.3, 0, -S * 0.4);
        g.fill();

        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.arc(0, -S * 0.43, S * 0.12, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = 'source-over';

        g.strokeStyle = 'rgba(255,255,255,.28)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -S * 0.26);
        g.lineTo(0, S * 0.3);
        g.stroke();
    } else {
        /* лист: ромб с остриём, чуть асимметричный */
        g.moveTo(0, -S * 0.42);
        g.bezierCurveTo(S * 0.34, -S * 0.2, S * 0.24, S * 0.26, 0, S * 0.4);
        g.bezierCurveTo(-S * 0.26, S * 0.26, -S * 0.36, -S * 0.2, 0, -S * 0.42);
        g.fill();

        g.strokeStyle = 'rgba(0,0,0,.16)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -S * 0.36);
        g.lineTo(0, S * 0.34);
        g.stroke();

        g.strokeStyle = 'rgba(0,0,0,.1)';
        for (let i = -2; i <= 2; i++) {
            const y = i * S * 0.12;
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(S * 0.14, y + S * 0.08);
            g.stroke();
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(-S * 0.14, y + S * 0.08);
            g.stroke();
        }
    }
    return c;
}

const PALETTES = {
    leaf: ['226,128,44', '198,88,36', '238,178,84', '168,80,40', '212,112,52'],
    petal: ['255,196,216', '255,222,234', '246,164,196', '252,182,210'],
};

registerEffect({
    id: 'leaves',
    name: 'Листья',
    group: 'air',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const shape = p.shape === 'petal' ? 'petal' : 'leaf';
        const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : PALETTES[shape];
        const sprites = colors.map((c) => sprite(c, shape));
        const sizeK = (p.size ?? 1) * (shape === 'petal' ? 0.85 : 1);
        const wind = p.wind ?? 1;
        const wanted = p.count ?? (shape === 'petal' ? 34 : 26);
        let list = [];

        function make(init) {
            const depth = rnd(0.55, 1.35);
            return {
                x: init ? rnd(-0.05, 1.05) * w : rnd(-0.15, 1.05) * w,
                y: init ? rnd(-0.1, 1) * h : rnd(-h * 0.25, -20),
                sp: sprites[(Math.random() * sprites.length) | 0],
                r: rnd(19, 34) * sizeK * depth,
                v: rnd(26, 62) * (0.7 + depth * 0.5),
                drift: rnd(-10, 16) * wind,
                sway: rnd(14, 42),
                ph: rnd(0, Math.PI * 2),
                spd: rnd(0.35, 1.15),
                rot: rnd(0, Math.PI * 2),
                spin: rnd(-1.6, 1.6),
                flip: rnd(0.6, 1.8),
                flipPh: rnd(0, Math.PI * 2),
                o: rnd(0.55, 1) * (0.55 + depth * 0.35),
            };
        }

        function seed() {
            const n = Math.round(wanted * (env.lite ? 0.5 : 1) * env.density);
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
                for (const f of list) {
                    f.y += f.v * dt;
                    f.x += (f.drift + Math.sin(t * f.spd + f.ph) * f.sway) * dt;
                    f.rot += f.spin * dt;

                    if (f.y - f.r > h + 20) {
                        Object.assign(f, make(false));
                        continue;
                    }
                    if (f.x < -f.r - 40) f.x = w + f.r;
                    if (f.x > w + f.r + 40) f.x = -f.r;
                    if (f.y < -h * 0.4) continue;

                    /* «переворот» листа: сжимаем по вертикали, но не в ноль */
                    const flip = Math.cos(t * f.flip + f.flipPh);
                    const sy = Math.sign(flip) * Math.max(0.38, Math.abs(flip));

                    ctx.save();
                    ctx.translate(f.x, f.y);
                    ctx.rotate(f.rot);
                    ctx.scale(1, sy);
                    ctx.globalAlpha = clamp(f.o, 0.05, 1);
                    ctx.drawImage(f.sp, -f.r / 2, -f.r / 2, f.r, f.r);
                    ctx.restore();
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
