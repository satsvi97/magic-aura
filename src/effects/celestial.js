/*
 * Светило: луна или солнце с ореолом.
 *
 * Положение по небу зависит от часа (Scene Panel отдаёт sessionHour), поэтому
 * диск ползёт по дуге вместе с сутками. Спрайт рисуется один раз.
 */
import { registerEffect, clamp } from '../engine.js';

function moonSprite() {
    const S = 192;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,253,246,1)');
    grd.addColorStop(0.2, 'rgba(250,249,255,.98)');
    grd.addColorStop(0.235, 'rgba(226,230,255,.42)');
    grd.addColorStop(0.5, 'rgba(200,204,255,.14)');
    grd.addColorStop(1, 'rgba(190,190,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();

    /* легкие «моря», чтобы диск не выглядел плоским */
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(196,196,230,.5)';
    for (const [x, y, r] of [[-10, -8, 13], [9, 6, 9], [-4, 14, 6], [14, -12, 5]]) {
        g.beginPath();
        g.arc(S / 2 + x, S / 2 + y, r, 0, Math.PI * 2);
        g.fill();
    }
    return c;
}

function sunSprite() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,246,222,1)');
    grd.addColorStop(0.12, 'rgba(255,226,168,.95)');
    grd.addColorStop(0.2, 'rgba(255,206,140,.55)');
    grd.addColorStop(0.55, 'rgba(255,178,110,.2)');
    grd.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();
    return c;
}

function haloSprite() {
    const S = 192;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(226,230,255,.42)');
    grd.addColorStop(0.22, 'rgba(214,218,255,.28)');
    grd.addColorStop(0.55, 'rgba(196,200,255,.1)');
    grd.addColorStop(1, 'rgba(190,190,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return c;
}

const SPRITES = { moon: null, sun: null, halo: null };

registerEffect({
    id: 'celestial',
    name: 'Светило',
    icon: '🌙',
    group: 'sky',
    blend: 'lighter',
    motion: false,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const body = p.body === 'sun' ? 'sun' : 'moon';
        /* soft — без диска: только мягкое световое пятно. Ночью и под сиянием
           яркий шар читается как лампа, поэтому там его нет. */
        const soft = !!p.soft;
        const fixedHour = Number.isFinite(p.hour) ? p.hour : body === 'sun' ? 12 : 22;
        const key = soft ? 'halo' : body;
        if (!SPRITES[key]) {
            SPRITES[key] = soft ? haloSprite() : body === 'sun' ? sunSprite() : moonSprite();
        }
        const sprite = SPRITES[key];
        const scale = p.size ?? 1;

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
            },
            draw(ctx, _t, _dt) {
                const hour = typeof env.hour === 'function' ? env.hour() : null;
                const useHour = Number.isFinite(hour) ? hour : fixedHour;

                /* Дуга: солнце идёт слева-вверх-вправо с 6 до 18, луна — наоборот,
                   справа-вверх-влево с 18 до 6 (садится на западе). */
                const frac = body === 'sun'
                    ? clamp((useHour - 6) / 12, 0, 1)
                    : clamp((((useHour - 18 + 24) % 24) / 12), 0, 1);
                const x = body === 'sun'
                    ? w * (0.16 + frac * 0.68)
                    : w * (0.84 - frac * 0.68);
                const arc = Math.sin(Math.PI * frac);
                const y = h * (Number.isFinite(p.y) ? p.y : 0.42 - arc * 0.3);
                const base = body === 'sun' ? 0.62 : soft ? 0.52 : 0.34;
                const size = Math.min(w, h) * base * scale;
                const shift = env.shift ? env.shift(0.25) : { x: 0, y: 0 };

                ctx.globalAlpha = soft
                    ? clamp((0.35 + arc * 0.45) * (p.alpha ?? 1), 0, 1)
                    : clamp(0.55 + arc * 0.45, 0, 1);
                ctx.drawImage(sprite, x - size / 2 + shift.x, y - size / 2 + shift.y, size, size);
                ctx.globalAlpha = 1;
            },
        };
    },
});
