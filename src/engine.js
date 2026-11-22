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
/* Потолок пиксельного буфера: 4K-монитор не должен получать канву на 8 Мпикс. */
const MAX_PIXELS = 3200000;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** rgba(...) с умноженной прозрачностью: нужно для тонировки сцены. */
export function withAlpha(color, k) {
    if (!color || color === 'transparent') return 'transparent';
    const m = /^rgba?\(([^)]+)\)$/i.exec(String(color).trim());
    if (!m) return color;
    const parts = m[1].split(',').map((s) => s.trim());
    const a = parts.length > 3 ? Number(parts[3]) : 1;
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${clamp(a * k, 0, 1)})`;
}
export const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * Порывы ветра — общая «погода» для всех падающих эффектов.
 * Возвращает 0…1.8: долгие спокойные промежутки и редкие резкие порывы.
 * @param {number} t время в секундах
 * @param {number} seed сдвиг фазы, чтобы листья и снег не дули синхронно
 */
export function gust(t, seed = 0) {
    const s = Math.sin(t * 0.21 + seed) * 0.55 + Math.sin(t * 0.07 + seed * 2.1) * 0.45;
    const k = Math.max(0, s);
    return Math.pow(k, 2.2) * 1.8;
}

const EFFECTS = new Map();
const SKIES = new Map();

/**
 * Цвет «суток» по часу: ночь — холодная синь, рассвет — медь, день — почти
 * прозрачный, закат — ржавый, вечер — фиолет. Четвёртое число — прозрачность.
 */
export function tintForHour(hour) {
    const stops = [
        [0, [24, 22, 62, 0.5]],
        [4, [38, 32, 74, 0.44]],
        [6, [122, 74, 72, 0.3]],
        [8, [92, 96, 124, 0.16]],
        [12, [104, 108, 138, 0.12]],
        [16, [110, 110, 144, 0.14]],
        [18, [152, 88, 82, 0.26]],
        [20, [104, 54, 92, 0.34]],
        [22, [38, 32, 74, 0.46]],
        [24, [24, 22, 62, 0.5]],
    ];
    const h = ((hour % 24) + 24) % 24;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (h >= stops[i][0] && h <= stops[i + 1][0]) {
            a = stops[i];
            b = stops[i + 1];
            break;
        }
    }
    const k = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
    const mix = (i) => Math.round(a[1][i] + (b[1][i] - a[1][i]) * k);
    return [mix(0), mix(1), mix(2), a[1][3] + (b[1][3] - a[1][3]) * k];
}

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
        /** Два слоя частиц: пока новый проявляется, старый гаснет. */
        this.panes = [];
        this.active = 0;
        /** @type {CanvasRenderingContext2D|null} */
        this.ctx = null;
        /** @type {object|null} */
        this.scene = null;
        this._skyKey = '';
        this._skyLayers = [];
        this._swapTimer = 0;

        this.w = 0;
        this.h = 0;
        this.dpr = 1;
        this.raf = 0;
        this.last = 0;
        this.t0 = 0;
        this.paused = true;
        this._lastDraw = 0;

        this.look = { density: 1, opacity: 0.9, speed: 1, size: 1, shade: 0.28, sky: 0.45 };
        this.lite = false;
        this.layer = 'behind';
        this.reduced = prefersReducedMotion();

        /* Параллакс и интерактив — отдельные выключатели: расширение публичное,
           и слабые телефоны не должны платить за красоту, которую не просили. */
        this.parallax = true;
        this.coarse = false;
        try {
            this.coarse = window.matchMedia('(pointer: coarse)').matches;
        } catch {
            this.coarse = false;
        }
        this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };

        /* Сутки: час 0–24 из Scene Panel (или из времени суток), затемняем небо. */
        this.dayCycle = true;
        this.hour = null;
        this.kickAmt = 0;

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
            <div class="atmos-day"></div>
            <div class="atmos-paper"></div>
            <div class="atmos-flash"></div>
        `;

        /* частицы — отдельным слоем, чтобы их можно было поднять над чатом,
           не таща за собой небо и затемнение */
        const fx = document.createElement('div');
        fx.id = 'atmos-fx';
        fx.setAttribute('aria-hidden', 'true');
        fx.className = 'atmos-fx off';
        fx.innerHTML = `
            <div class="atmos-pane"><canvas class="atmos-canvas"></canvas></div>
            <div class="atmos-pane"><canvas class="atmos-canvas"></canvas></div>
            <div class="atmos-debug"></div>
        `;

        document.body.appendChild(root);
        document.body.appendChild(fx);

        this.root = root;
        this.fx = fx;
        this.setLayer(this.layer);

        /* Два независимых слоя частиц. Переключение сцены строит новую сцену
           во втором, а CSS плавно гасит старый и проявляет новый. */
        this.panes = [...fx.querySelectorAll('.atmos-pane')].map((wrap) => {
            const canvas = wrap.querySelector('.atmos-canvas');
            return { wrap, canvas, ctx: canvas.getContext('2d', { alpha: true }), inst: [] };
        });
        this.active = 0;
        this.panes[0]?.wrap.classList.add('on');
        this.ctx = this.panes[0]?.ctx || null;

        this.nodes = {
            sky: root.querySelector('.atmos-sky'),
            day: root.querySelector('.atmos-day'),
            paper: root.querySelector('.atmos-paper'),
            flash: root.querySelector('.atmos-flash'),
            debug: fx.querySelector('.atmos-debug'),
        };

        window.addEventListener('resize', this._onResize, { passive: true });
        window.visualViewport?.addEventListener('resize', this._onResize, { passive: true });
        document.addEventListener('visibilitychange', this._onVisibility);

        /* Один слушатель на весь параллакс: только запоминаем позицию курсора,
           пересчёт — в кадре, без лишних чтений раскладки. */
        this._onPointer = (e) => {
            const p = this.pointer;
            if (!this.parallax || this.lite || this.coarse) {
                p.tx = 0;
                p.ty = 0;
                return;
            }
            const vw = this.w || window.innerWidth || 1;
            const vh = this.h || window.innerHeight || 1;
            p.tx = clamp(((e.clientX || 0) / vw) * 2 - 1, -1, 1);
            p.ty = clamp(((e.clientY || 0) / vh) * 2 - 1, -1, 1);
        };
        window.addEventListener('pointermove', this._onPointer, { passive: true });

        /* ST меняет раскладку без события resize (панели, формат окна, зум) —
           поэтому слушаем и сам документ, иначе canvas остаётся старого размера
           и по краям появляется полоса без частиц. */
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._onResize());
            this._ro.observe(document.documentElement);
        }

        this.resize();

        /* Наблюдатель за геометрией: реагирует, даже если анимация на паузе
           (скрытая вкладка, выключенная сцена) — ST любит двигать панели. */
        clearInterval(this._watch);
        this._watch = setInterval(() => this._selfCheck(), 1200);

        /* Плюс мгновенная реакция на действия в интерфейсе: после любого тапа
           ST может переехать (панели, drawer), поэтому сверяемся через полсекунды. */
        this._onUiAction = () => {
            clearTimeout(this._uiTimer);
            this._uiTimer = setTimeout(() => this._selfCheck(), 450);
        };
        document.addEventListener('pointerup', this._onUiAction, true);

        return root;
    }

    destroy() {
        this.stop();
        clearInterval(this._watch);
        this._watch = 0;
        clearTimeout(this._swapTimer);
        this._swapTimer = 0;
        if (this._onUiAction) document.removeEventListener('pointerup', this._onUiAction, true);
        this._onUiAction = null;
        clearTimeout(this._uiTimer);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pointermove', this._onPointer);
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
        this.panes = [];
        this.active = 0;
        this.ctx = null;
        this._skyKey = '';
        this._skyLayers = [];
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
        const want = Math.min(window.devicePixelRatio || 1, this.coarse ? 1.25 : DPR_CAP);
        /* Ограничиваем не только DPR, но и общий объём канвы: 4K при 1.5× —
           это 18 Мпикс, на слабом GPU это уже слайд-шоу. */
        const fit = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
        const dpr = this.lite ? 1 : Math.max(0.75, Math.min(want, fit));

        for (const el of [this.root, this.fx, document.getElementById('atmos-ui')]) {
            if (!el) continue;
            el.style.width = w + 'px';
            el.style.height = h + 'px';
        }

        /* CSS мог сделать слой выше (100dvh) — подхватываем фактический размер */
        const rect = this.root.getBoundingClientRect();
        if (rect.height > h) h = Math.round(rect.height);
        if (rect.width > w) w = Math.round(rect.width);

        /* Слой мог «съехать» после того, как ST открыл панель: если у body или
           выше появился transform, наш fixed-слой считается от него. Компенсируем. */
        this._alignToViewport(rect);

        const changed = w !== this.w || h !== this.h || dpr !== this.dpr;
        this.w = w;
        this.h = h;
        this.dpr = dpr;

        const cw = Math.round(w * dpr);
        const ch = Math.round(h * dpr);
        for (const pane of this.panes) {
            const canvas = pane.canvas;
            if (!canvas) continue;
            if (canvas.width !== cw) canvas.width = cw;
            if (canvas.height !== ch) canvas.height = ch;
            /* размер на экране задаёт CSS (100%/100%), тут только буфер */
            canvas.style.width = '';
            canvas.style.height = '';
            pane.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        this.ctx = this.panes[this.active]?.ctx || null;
        this._paintDebug();

        if (!changed) return;

        for (const pane of this.panes) {
            for (const it of pane.inst) {
                try {
                    it.inst.resize?.(w, h, dpr);
                } catch {
                    /* эффект не обязан переживать ресайз молча */
                }
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

    /**
     * Если слой отрисовывается не от (0,0) — значит выше появился transform
     * (ST так делает, когда двигает панели). Копим поправку и гасим сдвиг
     * обратным translate. Считаем приращением, иначе получаем качели:
     * применили компенсацию → слой на месте → «сдвига нет» → компенсацию сняли.
     */
    _alignToViewport(rect) {
        const s = this._shift || (this._shift = { x: 0, y: 0 });
        const dx = Math.round(rect.left);
        const dy = Math.round(rect.top);
        if (!dx && !dy) return;

        s.x -= dx;
        s.y -= dy;
        const t = s.x || s.y ? `translate(${s.x}px, ${s.y}px)` : '';
        for (const el of [this.root, this.fx, document.getElementById('atmos-ui')]) {
            if (el && el.style.transform !== t) el.style.transform = t;
        }
    }

    /** Проверка «слой на месте» — работает независимо от анимации. */
    _selfCheck() {
        if (!this.root) return;
        const vv = window.visualViewport;
        const de = document.documentElement;
        const w = Math.max(Math.round(vv?.width || 0), window.innerWidth || 0, de.clientWidth || 0);
        const h = Math.max(Math.round(vv?.height || 0), window.innerHeight || 0, de.clientHeight || 0);
        const rect = this.root.getBoundingClientRect();
        const rw = Math.max(w, Math.round(rect.width));
        const rh = Math.max(h, Math.round(rect.height));
        if (rw && rh && (rw !== this.w || rh !== this.h)) this.resize();
        else this._alignToViewport(rect);
    }

    /** Полная перерисовка слоя: размер, небо, эффекты. Кнопка «Починить слой». */
    refreshLayout() {
        if (!this.root) return;
        this._shift = { x: 0, y: 0 };
        for (const el of [this.root, this.fx]) if (el) el.style.transform = '';
        this.w = -1;
        this.h = -1;
        this.resize();
        if (this.scene) {
            this.applySky(this.scene);
            this.applyLook();
            this.rebuild();
            this.resume();
        }
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

    /* ---------- параллакс, сутки, интерактив ---------- */

    /** Параллакс от курсора. На тач-устройствах и в Lite выключен. */
    setParallax(on) {
        this.parallax = !!on;
        if (!this.parallax) {
            this.pointer.tx = 0;
            this.pointer.ty = 0;
        }
    }

    /** Сутки по часам Scene Panel: мягкий цветной налёт поверх неба. */
    setDayCycle(on) {
        this.dayCycle = !!on;
        this._applyDay();
    }

    /** @param {number|null} hour 0–24; null — не подкрашивать */
    setHour(hour) {
        const v = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : null;
        if (v === this.hour) return;
        this.hour = v;
        this._applyDay();
    }

    _applyDay() {
        const el = this.nodes?.day;
        if (!el) return;
        if (!this.dayCycle || this.hour === null) {
            el.style.opacity = '0';
            return;
        }
        const [r, g, b, a] = tintForHour(this.hour);
        el.style.background = `rgb(${r},${g},${b})`;
        el.style.opacity = String(a);
    }

    /** Порыв: краткий общий «ветер» для падающих эффектов. */
    kick(strength = 1) {
        this.kickAmt = Math.round(Math.min(1.6, Math.max(this.kickAmt, strength)) * 100) / 100;
    }

    /**
     * Интерактив на сообщения: «send» — порыв ветра, «receive» — мягкая вспышка.
     * Эффекты, которым есть что добавить, реализуют inst.burst(kind).
     */
    burst(kind = 'send') {
        if (!this.root) return;
        if (kind === 'receive') this._flash();
        if (kind === 'send') this.kick(1);
        for (const pane of this.panes) {
            for (const it of pane.inst) {
                try {
                    it.inst.burst?.(kind);
                } catch {
                    /* эффект не обязан уметь бурст */
                }
            }
        }
    }

    _flash() {
        const el = this.nodes?.flash;
        if (!el) return;
        el.style.transition = 'none';
        el.style.opacity = '0.85';
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 1.1s ease-out';
            el.style.opacity = '0';
        });
    }

    /** Настроение сцены: множитель затемнения (Scene Panel отдаёт «тон»). */
    setMood(mood) {
        const k = mood && Number.isFinite(mood.shadeK) ? clamp(mood.shadeK, 0.5, 2) : 1;
        if (k === this.moodShadeK) return;
        this.moodShadeK = k;
        this.applyLook();
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

        const shade = clamp(this.look.shade * (g.shade ?? 1) * (this.moodShadeK || 1), 0, 1);
        /* Тонировка, затемнение, виньетка и зерно — один слой: меньше
           полноэкранных проходов композитинга на каждом кадре. */
        const paper = this.nodes?.paper;
        if (paper) {
            paper.style.setProperty('--atmos-shade', `rgba(0,0,0,${shade.toFixed(3)})`);
            paper.style.setProperty('--atmos-tint', withAlpha(g.tint, g.tintOpacity ?? 1));
        }
    }

    /* ---------- сцена ---------- */

    /**
     * @param {object|null} scene
     */
    setScene(scene) {
        const prev = this.scene;
        this.scene = scene || null;
        this.mount();

        if (!scene) {
            this.stop();
            this.setOff(true);
            this._skyKey = '';
            return;
        }

        const same = Boolean(prev && prev.id === scene.id);
        this.setOff(false);
        this.applySky(scene);
        this.applyLook();
        if (same) this.rebuild();
        else this.switchTo(scene);
        this.resume();
    }

    /**
     * Смена сцены с растворением: новый набор эффектов собирается во втором
     * слое, CSS гасит старый и проявляет новый. Если сцена первая — сразу.
     */
    switchTo(scene) {
        if (!this.panes.length) {
            this.rebuild();
            return;
        }
        if (!this.scene || this.reduced || this.panes.length < 2) {
            this.rebuild();
            return;
        }

        const from = this.panes[this.active];
        const to = this.panes[1 - this.active];
        this._destroyPane(to);
        this._buildInto(to);
        this.active = 1 - this.active;
        this.ctx = this.panes[this.active]?.ctx || null;

        /* Классы меняем в следующем кадре, иначе браузер не увидит старт
           перехода и слой просто мигнёт. */
        requestAnimationFrame(() => {
            to.wrap.classList.add('on');
            from.wrap.classList.remove('on');
        });

        /* Старую сцену добиваем, когда она уже погасла. */
        clearTimeout(this._swapTimer);
        this._swapTimer = setTimeout(() => {
            if (from !== this.panes[this.active]) this._destroyPane(from);
        }, 650);
    }

    applySky(scene) {
        const sky = this.nodes?.sky;
        if (!sky) return;
        const layers = scene?.sky ? (Array.isArray(scene.sky) ? scene.sky : [scene.sky]) : [];
        const skyOn = clamp(this.look.sky ?? 0.45, 0, 1);
        const setOpacity = (el, layer) => {
            const own = layer && typeof layer === 'object' && layer.opacity != null ? layer.opacity : 1;
            el.style.opacity = String(own * skyOn);
        };

        /* Ключ неба: ползунок «фон сцены» не должен каждый тик пересобирать слои. */
        const key = JSON.stringify(
            layers.map((l) =>
                typeof l === 'string'
                    ? { id: l }
                    : { id: l.id || '', css: l.css || '', mask: l.mask || '', opacity: l.opacity ?? 1 },
            ),
        );
        if (key === this._skyKey) {
            const nodes = this._skyLayers;
            layers.forEach((layer, i) => {
                if (nodes[i]) setOpacity(nodes[i], layer);
            });
            return;
        }
        this._skyKey = key;

        const old = [...sky.children];
        const fresh = [];
        for (const layer of layers) {
            const css = typeof layer === 'string' ? skyCss(layer) : layer.css || skyCss(layer.id);
            if (!css) continue;
            const div = document.createElement('div');
            div.className = 'atmos-sky-layer';
            div.style.background = css;
            div.style.opacity = '0';
            /* необязательная маска: нужна, чтобы лучи света гасли книзу */
            if (layer && typeof layer === 'object' && layer.mask) {
                div.style.maskImage = layer.mask;
                div.style.webkitMaskImage = layer.mask;
            }
            sky.appendChild(div);
            fresh.push({ div, layer });
        }

        const reveal = () => fresh.forEach(({ div, layer }) => setOpacity(div, layer));
        this._skyLayers = fresh.map((f) => f.div);
        if (this.reduced) reveal();
        else requestAnimationFrame(reveal);

        for (const el of old) {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 900);
        }
    }

    /** Пересобрать эффекты в текущем (видимом) слое — без растворения. */
    rebuild() {
        if (!this.scene || !this.panes.length) {
            this.destroyInstances();
            return;
        }
        const pane = this.panes[this.active];
        this._destroyPane(pane);
        this._buildInto(pane);
    }

    _buildInto(pane) {
        if (!pane || !this.scene) return;
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
                /* на тач-экранах бюджеты те же, что в Lite: разница в плотности
                   там не видна, а каждая лишняя частица — это кадр, который
                   греет телефон */
                lite: this.lite || this.coarse,
                reduced,
                params: layer.params || {},
                rnd,
                clamp,
                pick,
                /* смещение от курсора для «глубины»: k — сила слоя */
                shift: (k = 1) => ({
                    x: this.pointer.x * k * Math.min(this.w, 1400) * 0.016,
                    y: this.pointer.y * k * Math.min(this.h, 900) * 0.012,
                }),
                parallaxOn: () => this.parallax && !this.lite && !this.coarse,
                /* текущий порыв (0…1.6) для осадков и листвы */
                kick: () => this.kickAmt,
                /* час суток (0–24) или null — для светила и «неба по часам» */
                hour: () => this.hour,
                /* позиция курсора в пикселях слоя (для эффектов, которые тянутся к нему) */
                pointer: () => ({
                    x: (this.pointer.x * 0.5 + 0.5) * this.w,
                    y: (this.pointer.y * 0.5 + 0.5) * this.h,
                }),
            };
            try {
                const inst = def.create(env) || {};
                pane.inst.push({ def, inst });
            } catch (e) {
                console.warn('[Magic Aura] эффект не создался:', def.id, e);
            }
        }
    }

    _destroyPane(pane) {
        if (!pane) return;
        for (const it of pane.inst) {
            try {
                it.inst.destroy?.();
            } catch {
                /* пусто */
            }
        }
        pane.inst = [];
        if (pane.ctx) pane.ctx.clearRect(0, 0, this.w, this.h);
    }

    destroyInstances() {
        for (const pane of this.panes) this._destroyPane(pane);
    }

    /* ---------- цикл ---------- */

    resume() {
        if (!this.root || !this.scene) return;
        const live = this.panes.reduce((n, p) => n + p.inst.length, 0);
        if (live === 0) return;
        if (!this.paused) return;
        this.paused = false;
        this.last = 0;
        this._lastDraw = 0;
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
        clearTimeout(this._swapTimer);
        this._swapTimer = 0;
        this.destroyInstances();
    }

    _frame(ts) {
        if (this.paused) return;
        if (!this.ctx) return;

        /* Свой лимит кадров: на 144 Гц мониторе и в неактивном окне незачем
           рисовать 200 раз в секунду. Lite — 30, обычный — 60, окно без фокуса
           и reduce-motion — 30. Экономия и батареи, и GPU. */
        let cap = this.lite ? 30 : 60;
        /* Тач-экраны: 40 кадров хватает, а композитинг поверх ST-шных blur-панелей
           на телефонах дорогой — половина экономии без видимой разницы. */
        if (this.coarse) cap = Math.min(cap, 40);
        if (this.reduced || (typeof document.hasFocus === 'function' && !document.hasFocus())) {
            /* окно не в фокусе (свернули, ушли в другую программу) — экономим кадры */
            cap = Math.min(cap, 20);
        }
        if (ts - this._lastDraw < 1000 / cap - 1.5) {
            this.raf = requestAnimationFrame(this._frame);
            return;
        }
        this._lastDraw = ts;

        /* Раз в полсекунды сверяем размеры с вьюпортом: в окнах-приложениях
           и при смене масштаба resize-событие может не прийти, а слой обязан
           совпадать с окном. Иначе картинка «съезжает». */
        if ((this._tick = (this._tick || 0) + 1) % 30 === 0) this._selfCheck();

        if (!this.last) this.last = ts;
        let dt = (ts - this.last) / 1000;
        this.last = ts;
        if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
        dt = Math.min(dt, 0.05);

        const t = (ts - this.t0) / 1000;
        const step = dt * clamp(this.look.speed, 0.05, 4);

        /* Курсор догоняем плавно, иначе параллакс дёргается на каждом движении. */
        const p = this.pointer;
        const ease = Math.min(1, dt * 6);
        p.x += (p.tx - p.x) * ease;
        p.y += (p.ty - p.y) * ease;
        if (this.kickAmt > 0) this.kickAmt = Math.max(0, this.kickAmt - dt * 0.9);

        for (const pane of this.panes) {
            const ctx = pane.ctx;
            if (!ctx) continue;
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.clearRect(0, 0, this.w, this.h);
            if (!pane.inst.length) continue;

            for (const it of pane.inst) {
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
        }

        this.raf = requestAnimationFrame(this._frame);
    }
}

/* Число частиц: зависит от площади, но с потолком — иначе на 4K браузер сходит с ума. */
export function budget(w, h, per, min, max, env) {
    const raw = (w * h) / per;
    const scaled = raw * (env.density ?? 1) * (env.intensity ?? 1) * (env.lite ? 0.5 : 1);
    return Math.round(clamp(scaled, min, max));
}

/**
 * Мягкое пятно в canvas-спрайте: туман, дымка, блики.
 *
 * Раньше такие пятна рисовались createRadialGradient в каждом кадре —
 * 5–7 градиентов на кадр на ровном месте. Один спрайт и drawImage дешевле
 * в разы, а визуально это тот же мягкий круг.
 */
export function radialSprite(color, size = 64, mid = 0.42) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${color},1)`);
    grd.addColorStop(0.55, `rgba(${color},${mid})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
}
