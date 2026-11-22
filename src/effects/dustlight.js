/*
 * Тёплая пыль в свете: пылинки со свечением, которые тянутся к курсору
 * и вспыхивают на входящее сообщение.
 *
 * Отличие от обычных «motes»: спрайт со свечением, мягкая пульсация,
 * параллакс и реакция на мышь. Работает в залах, у свечей, в солнечных лучах.
 */
import { registerEffect, rnd, clamp, budget } from '../engine.js';

function glow(color) {
    const S = 48;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, `rgba(${color},1)`);
    grd.addColorStop(0.22, `rgba(${color},.55)`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return c;
}

registerEffect({
    id: 'dustlight',
    name: 'Пыль в свете',
    icon: '✦',
    group: 'particles',
    blend: 'lighter',
    motion: true,
    create(env) {
        let w = env.w;
        let h = env.h;
        const p = env.params || {};
        const color = p.color || '255,214,160';
        const scale = p.size ?? 1;
        const sprite = glow(color);
        const reach = p.reach ?? 190;
        let boost = 0;
        let list = [];

        function make(init) {
            const depth = rnd(0.5, 1.4);
            return {
                x: rnd(0, w),
                y: init ? rnd(0, h) : rnd(0, h),
                r: rnd(0.5, 1.6) * scale * depth,
                vx: rnd(-7, 7),
                vy: rnd(-9, 3),
                sp: rnd(0.25, 0.9),
                ph: rnd(0, Math.PI * 2),
                o: rnd(0.12, 0.5) * depth,
                depth,
            };
        }

        function seed() {
            list = Array.from({ length: budget(w, h, 22000, 12, 80, env) }, () => make(true));
        }
        seed();

        return {
            resize(nw, nh) {
                w = nw;
                h = nh;
                seed();
            },
            burst(kind) {
                if (kind === 'receive') boost = 1;
                if (kind === 'send') boost = Math.max(boost, 0.45);
            },
            draw(ctx, t, dt) {
                boost = Math.max(0, boost - dt * 0.7);
                const shift = env.shift ? env.shift(0.9) : { x: 0, y: 0 };
                const near = typeof env.pointer === 'function' ? env.pointer() : null;

                for (const m of list) {
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                    if (m.x < -20) m.x = w + 20;
                    if (m.x > w + 20) m.x = -20;
                    if (m.y < -20) m.y = h + 20;
                    if (m.y > h + 20) m.y = -20;

                    const x = m.x + shift.x * m.depth;
                    const y = m.y + shift.y * m.depth;

                    /* тянется к курсору: вблизи — крупнее и ярче */
                    let glowK = 0;
                    if (near) {
                        const dx = near.x - x;
                        const dy = near.y - y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < reach * reach) {
                            glowK = 1 - Math.sqrt(d2) / reach;
                            glowK *= glowK;
                        }
                    }

                    const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * m.sp + m.ph), 2);
                    const a = clamp(m.o * pulse * (1 + glowK * 1.6 + boost * 0.9), 0, 1);
                    const s = m.r * (7.5 + glowK * 5 + boost * 3);

                    ctx.globalAlpha = a;
                    ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
                }
                ctx.globalAlpha = 1;
            },
        };
    },
});
