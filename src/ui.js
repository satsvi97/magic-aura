/*
 * Интерфейс: панель в настройках расширений + плавающая кнопка с быстрым выбором.
 * Всё рисуется кодом, без шаблонов ST — меньше шансов разъехаться с чужими темами.
 */

const SLIDERS = [
    { key: 'density', label: 'Плотность', min: 0.2, max: 2, step: 0.05, fmt: (v) => '×' + v.toFixed(2) },
    { key: 'opacity', label: 'Прозрачность', min: 0.1, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'speed', label: 'Скорость', min: 0.2, max: 2, step: 0.05, fmt: (v) => '×' + v.toFixed(2) },
    { key: 'size', label: 'Размер частиц', min: 0.5, max: 2, step: 0.05, fmt: (v) => '×' + v.toFixed(2) },
    { key: 'sky', label: 'Фон сцены', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'shade', label: 'Затемнение', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
];

/**
 * @param {{scenes: object[], getSettings: Function, setScene: Function, patch: Function}} api
 */
export function createUI(api) {
    const nodes = { panel: null, chips: [], fab: null, pop: null, popChips: [] };

    function scenesHtml(scope) {
        const s = api.getSettings();
        const items = api.scenes
            .map(
                (sc) =>
                    `<button type="button" class="atmos-chip${s.scene === sc.id && s.enabled ? ' on' : ''}" data-atmos-scene="${sc.id}" title="${sc.name}">` +
                    `<span class="atmos-chip-ico">${sc.icon}</span><span class="atmos-chip-name">${sc.name}</span></button>`,
            )
            .join('');
        return `<div class="atmos-grid" data-atmos-scope="${scope}">${items}</div>`;
    }

    /* ---------- панель настроек ---------- */

    function mountPanel(host) {
        if (!host || nodes.panel) return;

        const panel = document.createElement('div');
        panel.id = 'atmos-settings';
        panel.className = 'atmos-wrap';
        /* Плашка — штатный inline-drawer ST: сворачивается его же обработчиком,
           поэтому выглядит и ведёт себя как остальные расширения. */
        panel.innerHTML = `
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>✦ MAGIC AURA ✦</b>
                    <span class="atmos-ver">v${api.version || '0.2.0'}</span>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="atmos-enable">
                        <span>Расширение включено</span>
                        <span class="atmos-switch" title="Включить атмосферу">
                            <input type="checkbox" data-atmos="enabled">
                            <span class="atmos-track"><span class="atmos-knob"></span></span>
                        </span>
                    </label>
                    <div class="atmos-sub">Сцена, частицы и цвет. Слой можно держать под чатом — или пустить частицы поверх текста.</div>
                    <div class="atmos-scenes">${scenesHtml('panel')}</div>
                    <div class="atmos-modes">
                        <span class="atmos-modes-label">Эффекты</span>
                        <div class="atmos-seg">
                            <button type="button" data-atmos-layer="behind">только фон</button>
                            <button type="button" data-atmos-layer="above">поверх чата</button>
                        </div>
                    </div>
                    <div class="atmos-sliders">
                        ${SLIDERS.map(
                            (sl) => `
                            <div class="atmos-slider">
                                <div class="atmos-slider-top"><span>${sl.label}</span><b data-atmos-out="${sl.key}"></b></div>
                                <input type="range" data-atmos-look="${sl.key}" min="${sl.min}" max="${sl.max}" step="${sl.step}">
                            </div>`,
                        ).join('')}
                    </div>
                    <div class="atmos-toggles">
                        <label class="atmos-check"><input type="checkbox" data-atmos="lite"><span></span>Lite-режим</label>
                        <label class="atmos-check"><input type="checkbox" data-atmos="autoMood"><span></span>Реагировать на текст</label>
                        <label class="atmos-check"><input type="checkbox" data-atmos="perChat"><span></span>Сцена у каждого чата</label>
                        <label class="atmos-check atmos-desktop-only"><input type="checkbox" data-atmos="showFab"><span></span>Кнопка на экране</label>
                        <label class="atmos-check"><input type="checkbox" data-atmos="debug"><span></span>Границы слоя (диагностика)</label>
                    </div>
                    <div class="atmos-mobile-only">На телефоне кнопка в углу скрыта, чтобы не мешать отправке. Сцены — здесь.</div>
                    <div class="atmos-foot">
                        <label class="atmos-mini atmos-desktop-only">Кнопка
                            <select data-atmos="fabPos">
                                <option value="right">справа</option>
                                <option value="left">слева</option>
                            </select>
                        </label>
                        <button type="button" class="atmos-btn" data-atmos="reset">Сброс</button>
                    </div>
                    <div class="atmos-credit">
                        вдохновлено Nimbus для Tavo · сделано с любовью Selena's Tavern
                    </div>
                </div>
            </div>
        `;

        host.appendChild(panel);
        nodes.panel = panel;

        panel.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-atmos-scene]');
            if (chip) {
                const id = chip.dataset.atmosScene;
                const s = api.getSettings();
                api.setScene(s.scene === id && s.enabled ? null : id);
                return;
            }
            const btn = e.target.closest('[data-atmos="reset"]');
            if (btn) api.reset();
            const layerBtn = e.target.closest('[data-atmos-layer]');
            if (layerBtn) api.patch('layer', layerBtn.dataset.atmosLayer);
        });

        panel.addEventListener('input', (e) => {
            const look = e.target.closest('[data-atmos-look]');
            if (look) {
                api.patchLook(look.dataset.atmosLook, Number(look.value));
                return;
            }
            const key = e.target.dataset.atmos;
            if (!key) return;
            if (e.target.type === 'checkbox') api.patch(key, e.target.checked);
            else api.patch(key, e.target.value);
        });

        refresh();
    }

    /* ---------- плавающая кнопка ---------- */

    function mountFab() {
        if (nodes.fab) return;

        /* Отдельный бокс под интерфейс: в узком окне ST ломает fixed-позиционирование
           (html с transform и нулевой высотой), поэтому кнопка и поповер живут
           внутри контейнера, которому размер выставляется в пикселях. */
        const box = document.createElement('div');
        box.id = 'atmos-ui';
        box.className = 'atmos-ui';
        document.body.appendChild(box);
        nodes.ui = box;

        const sync = () => {
            const vv = window.visualViewport;
            box.style.width = Math.round(vv?.width || window.innerWidth || 360) + 'px';
            box.style.height = Math.round(vv?.height || window.innerHeight || 640) + 'px';
        };
        sync();
        window.addEventListener('resize', sync, { passive: true });
        window.visualViewport?.addEventListener('resize', sync, { passive: true });

        const fab = document.createElement('button');
        fab.type = 'button';
        fab.id = 'atmos-fab';
        fab.className = 'atmos-fab';
        fab.title = 'MAGIC AURA';
        fab.setAttribute('aria-label', 'MAGIC AURA');
        fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.5 15.5A4.5 4.5 0 0 1 9 11a5.2 5.2 0 0 1 10-1.2A3.9 3.9 0 0 1 19.5 18H6.6a2.1 2.1 0 0 1-2.1-2.5z"/>
            <path class="atmos-spark" d="M17.6 4.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/>
        </svg>`;
        box.appendChild(fab);
        nodes.fab = fab;

        const pop = document.createElement('div');
        pop.id = 'atmos-pop';
        /* по умолчанию закрыт: открывается только кликом по кнопке */
        pop.className = 'atmos-pop hidden';
        pop.innerHTML = `
            <div class="atmos-pop-head">
                <span>✦ MAGIC AURA ✦</span>
                <button type="button" class="atmos-pop-off" data-atmos="off" title="Выключить">✕</button>
            </div>
            <div class="atmos-pop-body">${scenesHtml('pop')}</div>
        `;
        box.appendChild(pop);
        nodes.pop = pop;

        fab.addEventListener('click', () => togglePop());
        pop.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-atmos-scene]');
            if (chip) {
                api.setScene(chip.dataset.atmosScene);
                return;
            }
            if (e.target.closest('[data-atmos="off"]')) api.setScene(null);
        });

        document.addEventListener('pointerdown', (e) => {
            if (!nodes.pop || nodes.pop.classList.contains('hidden')) return;
            if (e.target.closest('#atmos-pop') || e.target.closest('#atmos-fab')) return;
            nodes.pop.classList.add('hidden');
        });

        refresh();
    }

    function togglePop(force) {
        if (!nodes.pop) return;
        const show = force ?? nodes.pop.classList.contains('hidden');
        nodes.pop.classList.toggle('hidden', !show);
        nodes.fab?.classList.toggle('open', show);
    }

    /* ---------- перерисовка ---------- */

    function refresh() {
        const s = api.getSettings();

        if (nodes.panel) {
            const p = nodes.panel;
            p.classList.toggle('off', !s.enabled);
            const en = p.querySelector('[data-atmos="enabled"]');
            if (en) en.checked = !!s.enabled;

            p.querySelectorAll('[data-atmos-scene]').forEach((chip) => {
                chip.classList.toggle('on', s.enabled && s.scene === chip.dataset.atmosScene);
            });

            for (const sl of SLIDERS) {
                const input = p.querySelector(`[data-atmos-look="${sl.key}"]`);
                const out = p.querySelector(`[data-atmos-out="${sl.key}"]`);
                const v = Number(s.look[sl.key] ?? 0);
                if (input) input.value = String(v);
                if (out) out.textContent = sl.fmt(v);
            }

            for (const key of ['lite', 'autoMood', 'perChat', 'showFab', 'debug']) {
                const el = p.querySelector(`[data-atmos="${key}"]`);
                if (el) el.checked = !!s[key];
            }
            const pos = p.querySelector('[data-atmos="fabPos"]');
            if (pos) pos.value = s.fabPos || 'right';

            p.querySelectorAll('[data-atmos-layer]').forEach((b) => {
                b.classList.toggle('on', (s.layer || 'behind') === b.dataset.atmosLayer);
            });
        }

        if (nodes.fab) {
            nodes.fab.classList.toggle('hidden', !s.showFab);
            nodes.fab.classList.toggle('on', !!s.enabled && !!s.scene);
            nodes.fab.classList.toggle('left', s.fabPos === 'left');
        }
        if (nodes.pop) {
            nodes.pop.classList.toggle('left', s.fabPos === 'left');
            nodes.pop.querySelectorAll('[data-atmos-scene]').forEach((chip) => {
                chip.classList.toggle('on', s.enabled && s.scene === chip.dataset.atmosScene);
            });
        }
    }

    return { mountPanel, mountFab, refresh, togglePop };
}
