/*
 * Связь со Scene Panel.
 *
 * Scene Panel держит состояние сцены в chat_metadata.scene_panel:
 *   { weather, place, timeOfDay, mood, custom{}, present[], open[] }
 * Мы его только читаем — никаких правок в чужом расширении.
 */

import { matchScene, findScene } from './scenes.js';

const STATE_KEY = 'scene_panel';

/** Состояние сцены из метаданных чата (или null, если Scene Panel не активен). */
export function readPanelState(ctx) {
    try {
        const s = ctx?.chatMetadata?.[STATE_KEY];
        return s && typeof s === 'object' ? s : null;
    } catch {
        return null;
    }
}

const norm = (v) => String(v ?? '').toLowerCase().trim();

function matchRow(table, text) {
    if (!text) return null;
    for (const [id, words] of table) {
        for (const w of words) {
            if (text.includes(w)) return id;
        }
    }
    return null;
}

/* Погода решает частицы. Порядок важен: гроза раньше дождя, метель раньше снега. */
const WEATHER_MAP = [
    ['storm', ['гроз', 'thunder', 'åsk', 'storm']],
    ['hail', ['град', 'hail']],
    ['blizzard', ['метел', 'метёл', 'вьюг', 'пург', 'blizzard', 'snowstorm']],
    ['snow', ['снег', 'snow', 'snö']],
    ['rainy', ['дожд', 'ливн', 'rain', 'shower', 'regn']],
    ['cloudy', ['облачн', 'пасмурн', 'хмур', 'cloudy', 'overcast', 'mulen', 'moln']],
    ['sunny', ['солнечн', 'ясн', 'sunny', 'clear', 'solig']],
];

/* Место решает облик, если погода нейтральная. */
const PLACE_MAP = [
    ['desert', ['пустын', 'песок', 'песч', 'бархан', 'дюн', 'desert', 'sand', 'dune', 'öken']],
    ['deep', ['море', 'морск', 'океан', 'подводн', 'глубин', 'sea ', 'ocean', 'underwater', 'havet']],
    ['forest', ['лес', 'чащ', 'полян', 'рощ', 'forest', 'wood', 'skog']],
    ['neon', ['город', 'улиц', 'переул', 'неон', 'city', 'street', 'alley', 'stad']],
    ['candle', ['храм', 'дворец', 'зал', 'комнат', 'свеч', 'библиотек', 'кабинет', 'temple', 'palace', 'hall', 'room', 'candle', 'rum']],
    ['garden', ['сад', 'garden', 'trädgård']],
    ['sakura', ['сакур', 'вишн', 'sakura', 'cherry']],
    ['autumn', ['осен', 'парк', 'autumn', 'park']],
    ['campfire', ['костер', 'костёр', 'лагер', 'привал', 'campfire', 'camp ']],
];

const NIGHT = ['ночь', 'ночн', 'полночь', 'night', 'natt', 'ніч'];
const DAWN = ['рассвет', 'рассветн', 'утро', 'утр', 'dawn', 'morning', 'morgon', 'ранок'];
const SUNSET = ['закат', 'вечер', 'сумерк', 'sunset', 'evening', 'dusk', 'kväll', 'вечір'];

/* Поле-подсказка в доп. полях Scene Panel: аура=сакура.
   Открывает любую сцену Aura по id, имени или слову — включая новые,
   которым ещё не нашлось места в картах выше. */
const AURA_KEYS = ['аура', 'aura', 'аура сцены', 'aura scene', 'сцена ауры'];

function explicitScene(state) {
    const bag = Object.assign({}, state.custom || {});
    if (state.aura) bag.aura = state.aura;
    for (const [key, value] of Object.entries(bag)) {
        if (!AURA_KEYS.includes(norm(key))) continue;
        const scene = findScene(value);
        if (scene) return scene.id;
    }
    return null;
}

/** Подсказка аура=… как есть: по её изменению видно, что сцену назвали заново. */
export function auraHint(state) {
    if (!state) return '';
    const bag = Object.assign({}, state.custom || {});
    if (state.aura) bag.aura = state.aura;
    for (const [key, value] of Object.entries(bag)) {
        if (AURA_KEYS.includes(norm(key))) return norm(value);
    }
    return '';
}

/* Запасной путь: любая сцена каталога по её keywords.
   Новую сцену достаточно добавить в scenes.js — здесь править нечего. */
function keywordScene(state) {
    const custom = state.custom && typeof state.custom === 'object' ? Object.values(state.custom) : [];
    const text = [state.place, state.timeOfDay, state.mood, state.weather, ...custom]
        .filter((v) => typeof v === 'string' && v.trim())
        .join(' ');
    return matchScene(text)?.id || null;
}

function timeScene(t) {
    if (NIGHT.some((w) => t.includes(w))) return 'night';
    if (DAWN.some((w) => t.includes(w))) return 'fog';
    if (SUNSET.some((w) => t.includes(w))) return 'sunny';
    return 'cloudy';
}

/** Тон сцены правит затемнением. */
export function moodShade(mood) {
    const m = norm(mood);
    if (!m) return 1;
    if (['тревог', 'напряж', 'страх', 'злост', 'тревож', 'anxious', 'tense', 'fear', 'anger'].some((w) => m.includes(w))) return 1.25;
    if (['мрачн', 'тьма', 'темн', 'gloom', 'dark', 'dyster'].some((w) => m.includes(w))) return 1.3;
    if (['нежн', 'романт', 'любов', 'тепл', 'tender', 'roman', 'love', 'warm', 'kärlek'].some((w) => m.includes(w))) return 0.85;
    if (['спокой', 'уютн', 'тихо', 'calm', 'cozy', 'peace', 'lugn'].some((w) => m.includes(w))) return 0.95;
    return 1;
}

/**
 * Что показать по состоянию сцены.
 * @param {object} state
 * @param {{useExplicit?: boolean}} [opts] useExplicit=false — не брать аура=…,
 *   когда это же значение уже применялось (погода и место снова главные).
 * @returns {{sceneId: string, shadeK: number}|null}
 */
export function deriveAtmosphere(state, opts = {}) {
    if (!state) return null;
    const weather = norm(state.weather);
    const place = norm(state.place);
    const time = norm(state.timeOfDay);

    const shadeK = moodShade(state.mood);

    /* Явная просьба главнее догадок: аура=акейн, аура=сакура, аура=торт.
       Но только в тот момент, когда её назвали: иначе одна старая строка
       навсегда перекрыла бы погоду и место. */
    if (opts.useExplicit !== false) {
        const explicit = explicitScene(state);
        if (explicit) return { sceneId: explicit, shadeK };
    }

    let sceneId = matchRow(WEATHER_MAP, weather);
    if (!sceneId) {
        sceneId = matchRow(PLACE_MAP, place);
        if (sceneId === 'desert' && NIGHT.some((w) => time.includes(w))) sceneId = 'desert_night';
    }
    /* Всё, что не попало в карты, ищем по словам самих сцен: так новые сцены
       начинают работать без единой правки в этом файле. */
    if (!sceneId) sceneId = keywordScene(state);
    if (!sceneId) sceneId = timeScene(time);

    return { sceneId, shadeK };
}

/** Ключ состояния: по нему видно, изменилась ли сцена. */
export function panelKey(state) {
    if (!state) return '';
    const custom = state.custom && typeof state.custom === 'object'
        ? Object.keys(state.custom)
              .sort()
              .map((k) => k + '=' + state.custom[k])
              .join(',')
        : '';
    return [state.weather, state.place, state.timeOfDay, state.mood, custom].map(norm).join('|');
}
