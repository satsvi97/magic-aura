/*
 * Atmos — движок атмосферы.
 *
 * Устройство намеренно простое:
 *   - один <canvas> на всю сцену (частицы), один requestAnimationFrame;
 *   - всё, что браузер умеет сам (градиенты неба, виньетка, зерно, заливка),
 *     живёт в DOM и не тратит кадры;
 *   - эффект — это фабрика create(env) -> { draw(ctx, t, dt), resize(w,h), destroy() }.
 *
 * Эффекты не чистят canvas и не трогают composite: этим управляет движок,
 * чтобы кадр собирался предсказуемо и без лишних пересчётов.
 */

const DPR_CAP = 1.5;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const EFFECTS = new Map();
const SKIES = new Map();

export function registerEffect(def) {
    if (!def || !def.id) throw new Error('Atmos: эффект без id');
    EFFECTS.set(def.id, def);
    return def;
}

export function registerSky(id, css) {
    SKIES.set(id, css);
    return css;
}

export function getEffect(id) {
    return EFFECTS.get(id) || null;
}

export function listEffects() {
    return [...EFFECTS.values()];
}

export function skyCss(id) {
    return SKIES.get(id) || '';
}

export function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

export class Engine {
    constructor() {
        /** @type {HTMLElement|null} */
        this.root = null;
        /** @type {HTMLElement|null} */
        this.fx = null;
        /** @type {HTMLCanvasElement|null} */
        this.canvas = null;
        /** @type {CanvasRenderingContext2D|null} */
        this.ctx = null;
        /** @type {Array<{def: object, inst: object}>} */
        this.instances = [];
        /** @type {object|null} */
        this.scene = null;

        this.w = 0;
        this.h = 0;
        this.dpr = 1;
        this.raf = 0;
        this.last = 0;
        this.t0 = 0;
        this.paused = true;

        this.look = { density: 1, opacity: 0.9, speed: 1, size: 1, shade: 0.28, sky: 0.45 };
        this.lite = false;
        this.layer = 'behind';
        this.reduced = prefersReducedMotion();

        this._frame = this._frame.bind(this);
        this._onResize = this._onResize.bind(this);
        this._onVisibility = this._onVisibility.bind(this);
        this._resizeTimer = 0;
        this._ro = null;
    }

    /* ---------- DOM ---------- */

    mount() {
        if (this.root && document.body.contains(this.root)) return this.root;

        for (const id of ['atmos-root', 'atmos-fx']) document.getElementById(id)?.remove();

        /* фон: небо, цвет, затемнение, виньетка, зерно */
        const root = document.createElement('div');
        root.id = 'atmos-root';
        root.setAttribute('aria-hidden', 'true');
        root.className = 'atmos-root off';
        root.innerHTML = `
            <div class="atmos-sky"></div>
            <div class="atmos-grade"></div>
            <div class="atmos-shade"></div>
            <div class="atmos-vignette"></div>
            <div class="atmos-grain"></div>
        `;

        /* частицы — отдельным слоем, чтобы их можно было поднять над чатом,
           не таща за собой небо и затемнение */
        const fx = document.createElement('div');
        fx.id = 'atmos-fx';
        fx.setAttribute('aria-hidden', 'true');
        fx.className = 'atmos-fx off';
        fx.innerHTML = '<canvas class="atmos-canvas"></canvas><div class="atmos-debug"></div>';

        document.body.appendChild(root);
        document.body.appendChild(fx);

        this.root = root;
        this.fx = fx;
        this.setLayer(this.layer);

        this.canvas = fx.querySelector('.atmos-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.nodes = {
            sky: root.querySelector('.atmos-sky'),
            grade: root.querySelector('.atmos-grade'),
            shade: root.querySelector('.atmos-shade'),
            vignette: root.querySelector('.atmos-vignette'),
            grain: root.querySelector('.atmos-grain'),
            debug: fx.querySelector('.atmos-debug'),
        };

        window.addEventListener('resize', this._onResize, { passive: true });
        window.visualViewport?.addEventListener('resize', this._onResize, { passive: true });
        document.addEventListener('visibilitychange', this._onVisibility);

        /* ST меняет раскладку без события resize (панели, формат окна, зум) —
           поэтому слушаем и сам документ, иначе canvas остаётся старого размера
           и по краям появляется полоса без частиц. */
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._onResize());
            this._ro.observe(document.documentElement);
        }

        this.resize();

        return root;
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this._onResize);
        window.visualViewport?.removeEventListener('resize', this._onResize);
        document.removeEventListener('visibilitychange', this._onVisibility);
        if (this._ro) {
            this._ro.disconnect();
            this._ro = null;
        }
        if (this.root) this.root.remove();
        if (this.fx) this.fx.remove();
        this.root = null;
        this.fx = null;
        this.canvas = null;
        this.ctx = null;
    }

    /* ---------- размеры ---------- */

    /**
     * Слой висит на fixed, но у ST на узких окнах html получает transform и нулевую
     * высоту — тогда inset:0 даёт 0px и весь слой схлопывается в линию сверху.
     * Поэтому размер задаём в пикселях руками: 100vw/100vh тут не спасают.
     */
    resize() {
        if (!this.root) return;
        /* Мобильные вебвью врут: после открытия клавиатуры visualViewport и
           innerHeight остаются заниженными, и слой обрывался над полем ввода.
           Поэтому берём максимум из всех источников и, главное, перепроверяем
           реальную высоту самого слоя (её может поднять CSS min-height:100dvh). */
        const vv = window.visualViewport;
        const de = document.documentElement;
        let w = Math.round(Math.max(vv?.width || 0, window.innerWidth || 0, de.clientWidth || 0, 360));
        let h = Math.round(Math.max(vv?.height || 0, window.innerHeight || 0, de.clientHeight || 0, 640));
        const dpr = this.lite ? 1 : Math.min(window.devicePixelRatio || 1, DPR_CAP);

        for (const el of [this.root, this.fx, document.getElementById('atmos-ui')]) {
            if (!el) continue;
            el.style.width = w + 'px';
            el.style.height = h + 'px';
        }

        /* CSS мог сделать слой выше (100dvh) — подхватываем фактический размер */
        const rect = this.root.getBoundingClientRect();
        if (rect.height > h) h = Math.round(rect.height);
        if (rect.width > w) w = Math.round(rect.width);

        const changed = w !== this.w || h !== this.h || dpr !== this.dpr;
        this.w = w;
        this.h = h;
        this.dpr = dpr;

        if (this.canvas) {
            const cw = Math.round(w * dpr);
            const ch = Math.round(h * dpr);
            if (this.canvas.width !== cw) this.canvas.width = cw;
            if (this.canvas.height !== ch) this.canvas.height = ch;
            /* размер на экране задаёт CSS (100%/100%), тут только буфер */
            this.canvas.style.width = '';
            this.canvas.style.height = '';
        }
        if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._paintDebug();

        if (!changed) return;

        for (const it of this.instances) {
            try {
                it.inst.resize?.(w, h, dpr);
            } catch {
                /* эффект не обязан переживать ресайз молча */
            }
        }
    }

    _onResize() {
        /* размер меняем сразу — иначе канва отстаёт и слой выглядит сдвинутым;
           тяжёлую пересборку эффектов откладываем */
        this.resize();
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.resize(), 160);
    }

    _onVisibility() {
        if (document.hidden) this.pause();
        else if (this.scene) this.resume();
    }

    /* ---------- вид ---------- */

    setLook(partial) {
        Object.assign(this.look, partial || {});
        this.applyLook();
        this.applySky(this.scene || {});
    }

    setLite(on) {
        this.lite = !!on;
        this.resize();
        this.applyLook();
        if (this.scene) this.rebuild();
    }

    /** 'behind' — слой под чатом (только фон), 'above' — частицы поверх текста. */
    setLayer(mode) {
        this.layer = mode === 'above' ? 'above' : 'behind';
        this.fx?.classList.toggle('above', this.layer === 'above');
    }

    /** Диагностика: рамка по границам слоя и размеры. */
    setDebug(on) {
        this.debug = !!on;
        this.root?.classList.toggle('dbg', this.debug);
        this.fx?.classList.toggle('dbg', this.debug);
        this._paintDebug();
    }

    _paintDebug() {
        const d = this.nodes?.debug;
        if (!d) return;
        d.textContent = this.debug ? `${this.w}×${this.h} · ×${Number(this.dpr.toFixed(2))}` : '';
    }

    /** Скрыть/показать оба слоя (когда сцены нет). */
    setOff(on) {
        this.root?.classList.toggle('off', !!on);
        this.fx?.classList.toggle('off', !!on);
    }

    applyLook() {
        if (!this.root) return;
        const g = this.scene?.grade || {};
        const op = String(clamp(this.look.opacity, 0.05, 1));
        this.root.style.opacity = op;
        if (this.fx) this.fx.style.opacity = op;

        const shade = clamp(this.look.shade * (g.shade ?? 1), 0, 1);
        if (this.nodes.shade) this.nodes.shade.style.opacity = String(shade);
        if (this.nodes.grade) {
            this.nodes.grade.style.background = g.tint || 'transparent';
            this.nodes.grade.style.opacity = g.tint ? String(g.tintOpacity ?? 1) : '0';
        }
    }

    /* ---------- сцена ---------- */

    /**
     * @param {object|null} scene
     */
    setScene(scene) {
        this.scene = scene || null;
        this.mount();

        if (!scene) {
            this.stop();
            this.setOff(true);
            return;
        }

        this.setOff(false);
        this.applySky(scene);
        this.applyLook();
        this.rebuild();
        this.resume();
    }

    applySky(scene) {
        const sky = this.nodes?.sky;
        if (!sky) return;
        const layers = scene.sky ? (Array.isArray(scene.sky) ? scene.sky : [scene.sky]) : [];
        sky.innerHTML = '';
        for (const layer of layers) {
            const css = typeof layer === 'string' ? skyCss(layer) : layer.css || skyCss(layer.id);
            if (!css) continue;
            const div = document.createElement('div');
            div.className = 'atmos-sky-layer';
            div.style.background = css;
            const own = layer && typeof layer === 'object' && layer.opacity != null ? layer.opacity : 1;
            div.style.opacity = String(own * clamp(this.look.sky ?? 0.45, 0, 1));
            sky.appendChild(div);
        }
    }

    rebuild() {
        this.destroyInstances();
        if (!this.scene) return;

        const reduced = this.reduced;
        for (const layer of this.scene.layers || []) {
            const def = getEffect(layer.effect);
            if (!def) continue;
            /* при reduce-motion оставляем небо и грейд, но убираем движение */
            if (reduced && def.motion !== false) continue;

            const env = {
                w: this.w,
                h: this.h,
                dpr: this.dpr,
                density: this.look.density,
                intensity: layer.intensity ?? 1,
                lite: this.lite,
                reduced,
                params: layer.params || {},
                rnd,
                clamp,
                pick,
            };
            try {
                const inst = def.create(env) || {};
                this.instances.push({ def, inst });
            } catch (e) {
                console.warn('[Magic Aura] эффект не создался:', def.id, e);
            }
        }
    }

    destroyInstances() {
        for (const it of this.instances) {
            try {
                it.inst.destroy?.();
            } catch {
                /* пусто */
            }
        }
        this.instances = [];
        if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    }

    /* ---------- цикл ---------- */

    resume() {
        if (!this.root || !this.scene) return;
        if (this.instances.length === 0) return;
        if (!this.paused) return;
        this.paused = false;
        this.last = 0;
        this.t0 = performance.now();
        this.raf = requestAnimationFrame(this._frame);
    }

    pause() {
        this.paused = true;
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
    }

    stop() {
        this.pause();
        this.destroyInstances();
    }

    _frame(ts) {
        if (this.paused) return;
        if (!this.ctx) return;

        /* Раз в полсекунды сверяем размеры с вьюпортом: в окнах-приложениях
           и при смене масштаба resize-событие может не прийти, а слой обязан
           совпадать с окном. Иначе картинка «съезжает». */
        if ((this._tick = (this._tick || 0) + 1) % 30 === 0 && this.root) {
            const vv = window.visualViewport;
            const de = document.documentElement;
            const w = Math.max(Math.round(vv?.width || 0), window.innerWidth || 0, de.clientWidth || 0);
            const h = Math.max(Math.round(vv?.height || 0), window.innerHeight || 0, de.clientHeight || 0);
            const rect = this.root.getBoundingClientRect();
            const rw = Math.max(w, Math.round(rect.width));
            const rh = Math.max(h, Math.round(rect.height));
            if (rw && rh && (rw !== this.w || rh !== this.h)) this.resize();
        }

        if (!this.last) this.last = ts;
        let dt = (ts - this.last) / 1000;
        this.last = ts;
        if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
        dt = Math.min(dt, 0.05);

        const t = (ts - this.t0) / 1000;
        const ctx = this.ctx;
        const step = dt * clamp(this.look.speed, 0.05, 4);

        ctx.clearRect(0, 0, this.w, this.h);

        for (const it of this.instances) {
            ctx.globalCompositeOperation = it.def.blend || 'source-over';
            ctx.globalAlpha = 1;
            try {
                it.inst.draw(ctx, t, step);
            } catch (e) {
                if (!it._warned) {
                    it._warned = true;
                    console.warn('[Magic Aura] эффект упал в кадре:', it.def.id, e);
                }
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        this.raf = requestAnimationFrame(this._frame);
    }
}

/* Число частиц: зависит от площади, но с потолком — иначе на 4K браузер сходит с ума. */
export function budget(w, h, per, min, max, env) {
    const raw = (w * h) / per;
    const scaled = raw * (env.density ?? 1) * (env.intensity ?? 1) * (env.lite ? 0.5 : 1);
    return Math.round(clamp(scaled, min, max));
}
