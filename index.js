/*
 * Atmosphere для SillyTavern.
 *
 * Идея: сцена = небо (CSS) + частицы (canvas) + грейд (заливка/виньетка/зерно).
 * Ничего не переписывает сообщения, не лезет в промпт и не требует API.
 */
import { Engine } from './src/engine.js';
import { SCENES, SCENE_BY_ID, findScene, matchScene, OFF_RE } from './src/scenes.js';
import { createUI } from './src/ui.js';
import { readPanelState, deriveAtmosphere, panelKey } from './src/scenepanel.js';

const STORE = 'atmos';

const DEFAULTS = {
    enabled: true,
    scene: 'night',
    lite: false,
    autoMood: false,
    perChat: true,
    showFab: true,
    fabPos: 'right',
    layer: 'behind',
    debug: false,
    syncPanel: true,
    look: { density: 1, opacity: 0.9, speed: 1, size: 1, shade: 0.28, sky: 0.45 },
};

const clone = (v) => JSON.parse(JSON.stringify(v));

function merge(base, patch) {
    const out = clone(base);
    if (!patch || typeof patch !== 'object') return out;
    for (const [k, v] of Object.entries(patch)) {
        if (k === 'look' && v && typeof v === 'object') out.look = { ...out.look, ...v };
        else if (v !== undefined) out[k] = v;
    }
    return out;
}

/* Контекст ST: в новых версиях есть window.SillyTavern, в 1.12.x — только модуль.
   Поэтому пробуем по очереди несколько путей, а не гадаем. */
async function loadContext() {
    try {
        if (window.SillyTavern?.getContext) return window.SillyTavern.getContext();
    } catch {
        /* пусто */
    }

    const here = import.meta.url;
    const candidates = [
        '../../../extensions.js', // public/scripts/extensions/third-party/<name>/
        '../../extensions.js', // data/<user>/extensions/<name>/
        '../../../script.js',
        '../../script.js',
    ];

    for (const rel of candidates) {
        try {
            const mod = await import(new URL(rel, here).href);
            const fn = mod.getContext || mod.default;
            if (typeof fn !== 'function') continue;
            const c = fn();
            if (c?.eventSource) return c;
        } catch {
            /* следующий кандидат */
        }
    }
    return null;
}

function toast(message) {
    try {
        window.toastr?.info(message);
    } catch {
        /* пусто */
    }
}

/* ---------- состояние ---------- */

let ctx = null;
let settings = merge(DEFAULTS, {});

function persist() {
    if (!ctx) return;
    ctx.extensionSettings[STORE] = settings;
    ctx.saveSettingsDebounced?.();
}

function rememberChat() {
    if (!ctx || !settings.perChat) return;
    if (!ctx.chatMetadata) return;
    ctx.chatMetadata[STORE] = { scene: settings.scene };
    ctx.saveMetadataDebounced?.();
}

/* ---------- движок и интерфейс ---------- */

const engine = new Engine();

const VERSION = '0.3.1';

const ui = createUI({
    version: VERSION,
    scenes: SCENES,
    getSettings: () => settings,
    setScene: (id) => applyScene(id, { user: true }),
    patch: (key, value) => {
        settings[key] = value;
        persist();
        afterChange(key);
    },
    patchLook: (key, value) => {
        settings.look[key] = value;
        engine.setLook(settings.look);
        if (key === 'density') engine.rebuild();
        persist();
        ui.refresh();
    },
    reset: () => {
        const scene = settings.scene;
        settings = merge(DEFAULTS, { scene });
        persist();
        engine.setLite(settings.lite);
        engine.setLook(settings.look);
        afterChange('enabled');
    },
});

function afterChange(key) {
    if (key === 'enabled' || key === 'scene') {
        applyScene(settings.scene, { save: false });
        return;
    }
    if (key === 'lite') {
        engine.setLite(settings.lite);
        engine.setLook(settings.look);
    }
    if (key === 'layer') {
        engine.setLayer(settings.layer);
    }
    if (key === 'debug') {
        engine.setDebug(settings.debug);
    }
    if (key === 'perChat' && !settings.perChat && ctx?.chatMetadata) {
        delete ctx.chatMetadata[STORE];
        ctx.saveMetadataDebounced?.();
    }
    if (key === 'syncPanel' && settings.syncPanel) {
        syncFromPanel(true);
    }
    ui.refresh();
}

/**
 * @param {string|null} id
 * @param {{save?: boolean, user?: boolean}} [opts]
 */
function applyScene(id, opts = {}) {
    const scene = id && SCENE_BY_ID.has(id) ? SCENE_BY_ID.get(id) : null;
    settings.scene = scene ? scene.id : null;

    /* ручной выбор сцены главнее Scene Panel — иначе таверна будет
       перекрашиваться под текст прямо в момент, когда выбрана картинка */
    if (opts.user && settings.syncPanel) {
        settings.syncPanel = false;
        persist();
        toast('Синхронизация со Scene Panel выключена');
    }

    engine.mount();
    engine.setLayer(settings.layer);
    if (settings.enabled && scene) {
        engine.setLook(settings.look);
        engine.setScene(scene);
    } else {
        engine.stop();
        engine.setOff(true);
        engine.scene = null;
    }

    if (opts.save !== false) {
        rememberChat();
        persist();
    }
    ui.refresh();
}

/* ---------- Scene Panel ---------- */

let panelKeyCache = '';

function syncFromPanel(force = false) {
    if (!ctx || !settings.enabled || !settings.syncPanel) return;
    const state = readPanelState(ctx);
    if (!state) return;

    const key = panelKey(state);
    if (!force && key === panelKeyCache) return;
    panelKeyCache = key;

    const derived = deriveAtmosphere(state);
    if (!derived) return;

    engine.setMood({ shadeK: derived.shadeK });
    if (derived.sceneId && derived.sceneId !== settings.scene) {
        applyScene(derived.sceneId, { save: false });
    }
}

/* ---------- события ST ---------- */

function onChatChanged() {
    /* Scene Panel пишет состояние уже после смены чата — даём ему дочитать */
    setTimeout(() => syncFromPanel(true), 400);
    if (!settings.perChat) return;
    const saved = ctx?.chatMetadata?.[STORE]?.scene ?? settings.scene;
    if (saved !== settings.scene) applyScene(saved ?? null, { save: false });
    else if (ctx?.chatMetadata && !ctx.chatMetadata[STORE]) rememberChat();
}

let lastMoodAt = 0;
const MOOD_COOLDOWN = 20000;

function onMessageReceived(messageId) {
    /* Scene Panel разбирает тег [[scene: ...]] из этого же сообщения;
       ждём немного, чтобы прочитать уже обновлённое состояние */
    setTimeout(() => syncFromPanel(), 600);

    if (!settings.enabled || !settings.autoMood || settings.syncPanel) return;
    /* антидребезг: сцена не переключается чаще, чем раз в 20 с.
       Иначе окрашивание «гуляет» на каждом сообщении и читается как глюк. */
    const now = Date.now();
    if (now - lastMoodAt < MOOD_COOLDOWN) return;

    const chat = ctx?.chat || [];
    const mes = chat?.[messageId]?.mes || chat?.[chat.length - 1]?.mes || '';
    if (!mes) return;

    const scene = matchScene(mes);
    if (!scene || scene.id === settings.scene) return;
    lastMoodAt = now;
    applyScene(scene.id);
}

function bindEvents() {
    if (!ctx?.eventSource) return;
    const types = ctx.eventTypes || {};
    if (types.CHAT_CHANGED) ctx.eventSource.on(types.CHAT_CHANGED, onChatChanged);
    if (types.MESSAGE_RECEIVED) ctx.eventSource.on(types.MESSAGE_RECEIVED, onMessageReceived);
}

/* Scene Panel умеет менять состояние и без события (ползунки, день, погода),
   поэтому раз в две секунды сверяем короткий ключ — это дешевле обработчиков. */
let panelTimer = 0;

function startPanelWatch() {
    stopPanelWatch();
    panelTimer = setInterval(() => {
        if (document.hidden) return;
        syncFromPanel();
    }, 2000);
}

function stopPanelWatch() {
    if (panelTimer) clearInterval(panelTimer);
    panelTimer = 0;
}

/* ---------- слэш-команды ---------- */

function bindCommands() {
    const parser = ctx?.SlashCommandParser;
    const Cmd = ctx?.SlashCommand;
    const Arg = ctx?.SlashCommandArgument;
    const TYPES = ctx?.ARGUMENT_TYPE;
    if (!parser || !Cmd) return;

    const argument = Arg?.fromProps
        ? [
              Arg.fromProps({
                  description: 'id сцены или off',
                  typeList: [TYPES?.STRING || 'string'],
              }),
          ]
        : [];

    try {
        parser.addCommandObject(
            Cmd.fromProps({
                name: 'aura',
                aliases: ['atmos', 'аура', 'атмос'],
                helpString:
                    'Magic Aura: /aura storm — сцена, /aura off — выключить, /aura — что сейчас и список сцен.',
                returns: 'название сцены',
                unnamedArgumentList: argument,
                callback: async (_named, value) => {
                    const text = String(value ?? '').trim();
                    const low = text.toLowerCase();

                    if (!text) {
                        const cur = settings.enabled && settings.scene ? SCENE_BY_ID.get(settings.scene)?.name : 'выключено';
                        toast(`Сейчас: ${cur}`);
                        return cur;
                    }
                    if (OFF_RE.test(low)) {
                        applyScene(null);
                        toast('Magic Aura выключена');
                        return 'off';
                    }
                    const scene = findScene(low);
                    if (!scene) {
                        toast(`Нет такой сцены: ${text}`);
                        return '';
                    }
                    settings.enabled = true;
                    applyScene(scene.id);
                    toast(scene.icon + ' ' + scene.name);
                    return scene.name;
                },
            }),
        );
    } catch (e) {
        console.warn('[Magic Aura] команда не зарегистрировалась:', e);
    }
}

/* ---------- запуск ---------- */

function waitForHost() {
    return new Promise((resolve) => {
        const found = () => document.getElementById('extensions_settings2');
        if (found()) return resolve(found());
        let tries = 0;
        const timer = setInterval(() => {
            const el = found();
            if (el || ++tries > 40) {
                clearInterval(timer);
                resolve(el);
            }
        }, 250);
    });
}

async function boot() {
    if (document.readyState === 'loading') {
        await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }

    /* контекст грузим уже после DOM: модули ST к этому моменту точно на месте */
    ctx = await loadContext();
    if (!ctx) {
        console.warn('[Magic Aura] не удалось получить контекст SillyTavern — расширение не запустится.');
        return;
    }
    settings = merge(DEFAULTS, ctx.extensionSettings?.[STORE] || {});

    engine.mount();
    engine.setLite(settings.lite);
    engine.setLook(settings.look);
    engine.setDebug(settings.debug);

    const host = await waitForHost();
    ui.mountPanel(host);
    ui.mountFab();
    bindEvents();
    bindCommands();

    applyScene(settings.scene, { save: false });
    syncFromPanel(true);
    startPanelWatch();
    ui.refresh();

    console.log('[Magic Aura] готово. Сцен:', SCENES.length);
}

boot();

/* на случай, если ST захочет перезагрузить расширение без перезапуска страницы */
export function unload() {
    stopPanelWatch();
    engine.destroy();
    document.getElementById('atmos-settings')?.remove();
    document.getElementById('atmos-ui')?.remove();
}

