/*
 * Atmosphere для SillyTavern.
 *
 * Идея: сцена = небо (CSS) + частицы (canvas) + грейд (заливка/виньетка/зерно).
 * Ничего не переписывает сообщения, не лезет в промпт и не требует API.
 */
import { Engine } from './src/engine.js';
import { SCENES, SCENE_BY_ID, findScene, matchScene, OFF_RE } from './src/scenes.js';
import { createUI } from './src/ui.js';
import { readPanelState, deriveAtmosphere, panelKey, auraHint } from './src/scenepanel.js';

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
    /* Отдельные выключатели для публичного расширения: слабый телефон не должен
       платить за параллакс и интерактив, которые никто не просил. */
    parallax: true,
    interactive: true,
    dayCycle: true,
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
        '../../../../script.js', // <root>/script.js из third-party
        '/script.js',
    ];

    for (const rel of candidates) {
        try {
            const mod = await import(new URL(rel, here).href);
            const fn = mod.getContext || mod.default;
            if (typeof fn !== 'function') continue;
            const c = fn();
            if (c?.eventSource) {
                rememberHostModule(mod);
                return c;
            }
        } catch {
            /* следующий кандидат */
        }
    }
    return null;
}

/*
 * `chat_metadata` в script.js — это `export let`, который ST пересоздаёт
 * (chat_metadata = {}) при каждой смене чата. Значение, снятое через
 * getContext(), после этого мёртвое. Живой биндинг модуля всегда указывает
 * на актуальный объект, поэтому для чтения/записи держим ссылку на модуль.
 */
let hostModule = null;

const META_CANDIDATES = [
    '../../../../script.js', // <root>/script.js из third-party
    '/script.js', // на случай нестандартного монтирования
];

async function loadHostModule() {
    const here = import.meta.url;
    for (const rel of META_CANDIDATES) {
        try {
            const mod = await import(new URL(rel, here).href);
            if ('chat_metadata' in mod) return mod;
        } catch {
            /* следующий кандидат */
        }
    }
    return null;
}

/* Модуль ST, откуда берём живой chat_metadata (script.js) и сохранение. */
function rememberHostModule(mod) {
    if (mod && 'chat_metadata' in mod) hostModule = mod;
}

/** Актуальные метаданные чата: живой биндинг, иначе снимок из контекста. */
function chatMeta() {
    const live = hostModule?.chat_metadata;
    return live && typeof live === 'object' ? live : ctx?.chatMetadata || null;
}

function saveMetadata() {
    try {
        const save = hostModule?.saveMetadataDebounced || ctx?.saveMetadataDebounced;
        if (typeof save === 'function') save();
    } catch {
        /* метаданные сохранит ST при следующем действии */
    }
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
    const meta = chatMeta();
    if (!meta) return;
    meta[STORE] = { scene: settings.scene };
    saveMetadata();
}

/* ---------- движок и интерфейс ---------- */

const engine = new Engine();

const VERSION = '0.6.0';

const ui = createUI({
    version: VERSION,
    scenes: SCENES,
    getSettings: () => settings,
    setScene: (id) => applyScene(id, { user: true }),
    panelNote: () => panelNoteText(),
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
    repair: () => {
        engine.refreshLayout();
        ui.refresh();
        toast('Слой перерисован');
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
    if (key === 'parallax') {
        engine.setParallax(settings.parallax);
    }
    if (key === 'dayCycle') {
        engine.setDayCycle(settings.dayCycle);
        syncHour();
    }
    if (key === 'perChat' && !settings.perChat) {
        const meta = chatMeta();
        if (meta) {
            delete meta[STORE];
            saveMetadata();
        }
    }
    if (key === 'syncPanel' && settings.syncPanel) {
        syncFromPanel(true);
    }
    ui.refresh();
    announceState();
}

/**
 * @param {string|null} id
 * @param {{save?: boolean, user?: boolean}} [opts]
 */
function applyScene(id, opts = {}) {
    const scene = id && SCENE_BY_ID.has(id) ? SCENE_BY_ID.get(id) : null;
    settings.scene = scene ? scene.id : null;

    /* ручной выбор сцены главнее всего: и Scene Panel, и реакции на текст.
       Иначе выбранная картинка живёт до следующего сообщения — а потом
       таверна снова перекрашивается «сама по себе». */
    if (opts.user) {
        const wasSync = settings.syncPanel;
        const wasAuto = settings.autoMood;
        settings.syncPanel = false;
        settings.autoMood = false;
        if (wasSync || wasAuto) {
            persist();
            toast('Сцена закреплена: синхронизация и реакция на текст выключены');
        }
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
    announceState();
}

/* ---------- Scene Panel ---------- */

let panelKeyCache = '';
let lastAuraHint = null;

/**
 * Час суток из панели: точные часы сессии, если они есть, иначе — по тексту
 * «ночь / рассвет / день / закат». Без панели час не задаём, и небо не трогаем.
 */
function panelHour(state) {
    if (!state) return null;
    const h = Number(state.sessionHour);
    if (Number.isFinite(h) && state.sessionHour !== '' && state.sessionHour != null) {
        return h + (Number(state.sessionMinute) || 0) / 60;
    }
    const t = String(state.timeOfDay || '').toLowerCase();
    if (!t) return null;
    if (/ноч|полноч|night|natt|ніч/.test(t)) return 23;
    if (/рассвет|утр|dawn|morning|morgon|ранок/.test(t)) return 6;
    if (/закат|вечер|сумерк|sunset|evening|dusk|kväll|вечір/.test(t)) return 19;
    if (/день|полдень|day|noon/.test(t)) return 12;
    return null;
}

function syncHour(state) {
    if (!settings.dayCycle) {
        engine.setHour(null);
        return;
    }
    engine.setHour(panelHour(state || readPanelState(chatMeta())));
}

function syncFromPanel(force = false, fresh = false) {
    if (!ctx || !settings.enabled || !settings.syncPanel) return;
    const state = readPanelState(chatMeta());
    if (!state) return;

    /* Сутки обновляем всегда: час может смениться без смены погоды и места. */
    syncHour(state);

    const key = panelKey(state);
    if (!force && !fresh && key === panelKeyCache) return;
    panelKeyCache = key;

    /* аура=… в доп. полях — указание конкретной сцены. Применяется, когда
       его назвали заново (fresh), при принудительном чтении или при смене
       значения; в остальное время снова решают погода и место. */
    const hint = auraHint(state);
    const useExplicit = force || fresh || hint !== lastAuraHint;
    lastAuraHint = hint;

    const derived = deriveAtmosphere(state, { useExplicit });
    if (!derived) {
        if (settings.debug) {
            console.debug('[Magic Aura] панель: ничего не распознано, сцену не трогаем', {
                weather: state.weather,
                place: state.place,
                time: state.timeOfDay,
            });
        }
        return;
    }

    if (settings.debug) {
        console.debug('[Magic Aura] панель →', derived.sceneId, {
            weather: state.weather,
            place: state.place,
            time: state.timeOfDay,
            mood: state.mood,
        });
    }

    engine.setMood({ shadeK: derived.shadeK });
    if (derived.sceneId && derived.sceneId !== settings.scene) {
        applyScene(derived.sceneId, { save: false });
    }
}

/* ---------- публичное API ---------- */

/* Соседние расширения (Scene Panel) могут спросить состояние и попросить
   перечитать сцену. Это единственная точка входа: window.MagicAura. */

function apiState() {
    return {
        version: VERSION,
        ready: true,
        enabled: !!settings.enabled,
        scene: settings.scene || null,
        sceneName: settings.scene ? SCENE_BY_ID.get(settings.scene)?.name || null : null,
        layer: settings.layer,
        syncPanel: !!settings.syncPanel,
        parallax: !!settings.parallax,
        interactive: !!settings.interactive,
        dayCycle: !!settings.dayCycle,
        panel: Boolean(readPanelState(chatMeta())),
    };
}

let stateQueued = false;

/* Сообщаем о смене состояния один раз за тик — без шторма событий на ползунках. */
function announceState() {
    if (stateQueued) return;
    stateQueued = true;
    queueMicrotask(() => {
        stateQueued = false;
        try {
            window.dispatchEvent(new CustomEvent('magic-aura:state', { detail: apiState() }));
        } catch {
            /* пусто */
        }
    });
}

const api = {
    version: VERSION,
    getState: apiState,
    /* Ручной выбор сцены: синхронизация со Scene Panel выключается — как и в UI. */
    setScene(id) {
        settings.enabled = true;
        applyScene(id, { user: true });
        return settings.scene;
    },
    /* Перечитать состояние Scene Panel сейчас, не дожидаясь опроса.
       fresh=true — сцену назвали только что, применить её даже без изменений. */
    sync(force = false, fresh = false) {
        syncFromPanel(force === true, fresh === true);
        return apiState();
    },
    /* Включить или выключить чтение Scene Panel. */
    setSyncPanel(on) {
        settings.syncPanel = !!on;
        persist();
        if (settings.syncPanel) syncFromPanel(true);
        ui.refresh();
        announceState();
        return settings.syncPanel;
    },
    /* Что именно Aura прочитала из панели и во что это превратилось. */
    panelNote: panelNoteText,
    /* Открыть быстрый выбор сцены у кнопки в углу. */
    open() {
        ui.togglePop(true);
    },
};

/* Строка-подсказка в настройках: что прочитано из Scene Panel и что из этого вышло. */
function panelNoteText() {
    const state = readPanelState(chatMeta());
    if (!state) return 'Scene Panel: нет данных';
    if (!settings.syncPanel) return 'Scene Panel: синхронизация выключена';
    const bits = [state.weather, state.place, state.timeOfDay].map((v) => String(v ?? '').trim()).filter(Boolean);
    if (!bits.length) return 'Scene Panel: пусто — заполни погоду, место или время';
    const derived = deriveAtmosphere(state);
    const name = derived ? SCENE_BY_ID.get(derived.sceneId)?.name || derived.sceneId : '';
    return 'Scene Panel: ' + bits.join(' · ') + (name ? ' → ' + name : ' → не распознано');
}

/* Scene Panel шлёт это событие после каждого изменения сцены.
   detail.fresh — сцену аура=… назвали именно сейчас. */
function onPanelUpdate(e) {
    syncFromPanel(false, Boolean(e?.detail?.fresh));
}

/* ---------- события ST ---------- */

/* Смена чата: ST заменяет и chat_metadata, и массив chat — перечитываем контекст,
   иначе реакции на текст смотрят в старый чат. */
async function refreshContext() {
    try {
        const c = await loadContext();
        if (c) ctx = c;
    } catch {
        /* остаёмся на старом контексте — метаданные всё равно живые */
    }
}

function chatLines() {
    const live = hostModule?.chat;
    if (Array.isArray(live)) return live;
    return ctx?.chat || [];
}

function onChatChanged() {
    refreshContext();
    /* Scene Panel пишет состояние уже после смены чата — даём ему дочитать */
    setTimeout(() => syncFromPanel(true), 400);
    if (!settings.perChat) return;
    const meta = chatMeta();
    const saved = meta?.[STORE]?.scene ?? settings.scene;
    if (saved !== settings.scene) applyScene(saved ?? null, { save: false });
    else if (meta && !meta[STORE]) rememberChat();
}

let lastMoodAt = 0;
const MOOD_COOLDOWN = 20000;

function onMessageReceived(messageId) {
    /* вспышка на входящее: тёплый ореол снизу, если интерактив включён */
    if (settings.enabled && settings.interactive) engine.burst('receive');

    /* Scene Panel разбирает тег [[scene: ...]] из этого же сообщения;
       ждём немного, чтобы прочитать уже обновлённое состояние */
    setTimeout(() => syncFromPanel(), 600);

    if (!settings.enabled || !settings.autoMood || settings.syncPanel) return;
    /* антидребезг: сцена не переключается чаще, чем раз в 20 с.
       Иначе окрашивание «гуляет» на каждом сообщении и читается как глюк. */
    const now = Date.now();
    if (now - lastMoodAt < MOOD_COOLDOWN) return;

    const chat = chatLines();
    const mes = chat?.[messageId]?.mes || chat?.[chat.length - 1]?.mes || '';
    if (!mes) return;

    const scene = matchScene(mes);
    if (!scene || scene.id === settings.scene) return;
    lastMoodAt = now;
    applyScene(scene.id);
}

function bindEvents() {
    window.addEventListener('scene-panel:update', onPanelUpdate);
    if (!ctx?.eventSource) return;
    const types = ctx.eventTypes || {};
    if (types.CHAT_CHANGED) ctx.eventSource.on(types.CHAT_CHANGED, onChatChanged);
    if (types.MESSAGE_RECEIVED) ctx.eventSource.on(types.MESSAGE_RECEIVED, onMessageReceived);
    /* Порыв ветра на отправку: листва летит, снег и дождь забирают вбок. */
    if (types.MESSAGE_SENT) {
        ctx.eventSource.on(types.MESSAGE_SENT, () => {
            if (settings.enabled && settings.interactive) engine.burst('send');
        });
    }
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
    hostModule = (await loadHostModule()) || hostModule;
    if (!ctx) {
        console.warn('[Magic Aura] не удалось получить контекст SillyTavern — расширение не запустится.');
        return;
    }
    settings = merge(DEFAULTS, ctx.extensionSettings?.[STORE] || {});

    engine.mount();
    engine.setLite(settings.lite);
    engine.setLook(settings.look);
    engine.setDebug(settings.debug);
    engine.setParallax(settings.parallax);
    engine.setDayCycle(settings.dayCycle);

    const host = await waitForHost();
    ui.mountPanel(host);
    ui.mountFab();
    bindEvents();
    bindCommands();

    applyScene(settings.scene, { save: false });
    syncHour();
    syncFromPanel(true);
    startPanelWatch();
    ui.refresh();

    /* Публичное API и оповещение соседей — после загрузки настроек и чата. */
    window.MagicAura = api;
    try {
        window.dispatchEvent(new CustomEvent('magic-aura:ready', { detail: apiState() }));
    } catch {
        /* пусто */
    }
    announceState();

    console.log('[Magic Aura] готово. Сцен:', SCENES.length);
}

boot();

/* на случай, если ST захочет перезагрузить расширение без перезапуска страницы */
export function unload() {
    stopPanelWatch();
    window.removeEventListener('scene-panel:update', onPanelUpdate);
    if (window.MagicAura === api) delete window.MagicAura;
    engine.destroy();
    document.getElementById('atmos-settings')?.remove();
    document.getElementById('atmos-ui')?.remove();
}

