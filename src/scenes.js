/*
 * Сцены. Сцена — это не «включить эффект», а собранная картинка:
 * небо (CSS-градиенты) + частицы + грейд (затемнение и цветной налёт).
 */
import { registerSky } from './engine.js';
import './effects/weather.js';
import './effects/skyfx.js';
import './effects/fire.js';
import './effects/water.js';
import './effects/sand.js';
import './effects/leaves.js';
import './effects/magic.js';
import './effects/ash.js';
import './effects/rays.js';

/* ---------- небо ---------- */

registerSky('night', 'radial-gradient(125% 95% at 68% 6%, #2f2452 0%, #191231 40%, #0a0714 100%)');
registerSky('moon', 'radial-gradient(circle 118px at 68% 13%, rgba(255,253,244,.92) 0 20%, rgba(255,250,235,.42) 22%, rgba(230,230,250,.09) 58%, transparent 100%)');
registerSky('storm', 'linear-gradient(180deg, #2a2b40 0%, #171826 46%, #0a0a12 100%)');
registerSky('snow', 'linear-gradient(180deg, #2c3552 0%, #1a2134 48%, #0b0e16 100%)');
registerSky('dawn', 'linear-gradient(180deg, #3b3049 0%, #221b30 42%, #0e0a14 100%)');
registerSky('warm', 'radial-gradient(110% 85% at 50% 74%, #63422a 0%, #2d1a20 48%, #0f0812 100%)');
registerSky('candle', 'radial-gradient(95% 70% at 50% 76%, #60381c 0%, #2e1720 44%, #0d0710 100%)');
registerSky('deep', 'radial-gradient(130% 100% at 50% 0%, #1b5e77 0%, #0d2f45 42%, #05121e 100%)');
registerSky('neon', 'radial-gradient(130% 95% at 30% 74%, #4f1d74 0%, #251143 44%, #0d0818 100%)');
registerSky('forest', 'radial-gradient(120% 95% at 50% 100%, #1a4a38 0%, #132a2e 45%, #080d14 100%)');
registerSky('overcast', 'linear-gradient(180deg, #2e3040 0%, #1b1c28 50%, #0c0c14 100%)');
registerSky('desert', 'radial-gradient(120% 92% at 50% 78%, #8a5a2c 0%, #40281a 46%, #150e10 100%)');
registerSky('desert-night', 'linear-gradient(180deg, #1c2039 0%, #2a2430 56%, #4a3222 100%)');
registerSky('autumn', 'radial-gradient(112% 86% at 50% 92%, #5b3620 0%, #2b1d18 48%, #100b0c 100%)');
registerSky('garden', 'radial-gradient(118% 92% at 42% 88%, #1b4a2c 0%, #132a24 46%, #080c10 100%)');
registerSky('sakura', 'radial-gradient(120% 95% at 50% 84%, #4c2442 0%, #2a1730 46%, #0e0812 100%)');
registerSky('arcane', 'radial-gradient(125% 100% at 50% 28%, #2f1c5c 0%, #180f30 46%, #080610 100%)');
registerSky('sunny', 'radial-gradient(120% 100% at 50% 2%, #5c432a 0%, #33241a 44%, #120d10 100%)');
registerSky('birthday', 'radial-gradient(90% 75% at 50% 80%, #6a3a20 0%, #341c30 46%, #0e0812 100%)');
registerSky('candlelight', 'radial-gradient(circle 260px at 50% 74%, rgba(255,210,140,.85) 0 10%, rgba(255,186,110,.3) 34%, rgba(255,170,96,.08) 62%, transparent 82%)');

/* ---------- сцены ---------- */

export const SCENES = [
    {
        id: 'night',
        name: 'Ночная тишина',
        icon: '🌙',
        sky: ['night', { id: 'moon', opacity: 0.9 }],
        grade: { shade: 0.9, tint: 'rgba(44,34,86,.16)' },
        layers: [
            { effect: 'stars', params: { count: 180 } },
            { effect: 'motes', params: { color: '201,185,255', size: 0.8 }, intensity: 0.7 },
        ],
        keywords: ['ночь', 'ночн', 'полночь', 'луна', 'звёзд', 'night', 'moon', 'midnight', 'star'],
    },
    {
        id: 'storm',
        name: 'Гроза',
        icon: '⛈',
        sky: 'storm',
        grade: { shade: 1.2, tint: 'rgba(18,22,44,.2)' },
        layers: [
            { effect: 'rain', params: { wind: 0.38, len: 1.25 } },
            { effect: 'mist', params: { color: '150,160,190' }, intensity: 0.7 },
            { effect: 'lightning' },
        ],
        keywords: ['гроза', 'шторм', 'ливень', 'молния', 'дождь', 'storm', 'thunder', 'rain', 'lightning'],
    },
    {
        id: 'rainy',
        name: 'Серый дождь',
        icon: '🌧',
        sky: 'overcast',
        grade: { shade: 1.05, tint: 'rgba(30,36,52,.18)' },
        layers: [
            { effect: 'rain', params: { wind: 0.14, len: 0.9 }, intensity: 0.85 },
            { effect: 'mist', params: { color: '170,178,200' }, intensity: 0.5 },
        ],
        keywords: ['дожд', 'пасмурн', 'слякот', 'rain', 'drizzle', 'overcast', 'gloom'],
    },
    {
        id: 'snow',
        name: 'Снегопад',
        icon: '❄️',
        sky: 'snow',
        grade: { shade: 1, tint: 'rgba(44,54,86,.16)' },
        layers: [
            { effect: 'snow', params: { size: 1.1, wind: 0.08 } },
            { effect: 'motes', params: { color: '210,225,255', size: 0.7 }, intensity: 0.5 },
        ],
        keywords: ['снег', 'зима', 'зимн', 'мороз', 'вьюга', 'метел', 'snow', 'winter', 'frost', 'blizzard'],
    },
    {
        id: 'fog',
        name: 'Туманное утро',
        icon: '🌫',
        sky: 'dawn',
        grade: { shade: 0.85, tint: 'rgba(74,78,98,.2)' },
        layers: [
            { effect: 'mist', params: { color: '198,204,225' }, intensity: 1.2 },
            { effect: 'motes', params: { color: '210,214,235', size: 0.7 }, intensity: 0.55 },
        ],
        keywords: ['туман', 'утро', 'рассвет', 'дымк', 'fog', 'mist', 'dawn', 'morning'],
    },
    {
        id: 'campfire',
        name: 'Костёр',
        icon: '🏕',
        sky: 'warm',
        grade: { shade: 0.95, tint: 'rgba(74,26,12,.12)' },
        layers: [
            { effect: 'embers', params: { color: '255,186,120', size: 1.1 } },
            { effect: 'motes', params: { color: '255,214,160', size: 0.7 }, intensity: 0.5 },
        ],
        keywords: ['костёр', 'костер', 'огонь', 'пламя', 'поход', 'fire', 'campfire', 'flame', 'bonfire'],
    },
    {
        id: 'candle',
        name: 'Свечная комната',
        icon: '🕯',
        sky: 'candle',
        grade: { shade: 1.05, tint: 'rgba(86,38,16,.14)' },
        layers: [
            { effect: 'embers', params: { color: '255,170,90', size: 0.55 }, intensity: 0.55 },
            { effect: 'motes', params: { color: '255,206,150', size: 0.6 }, intensity: 0.6 },
        ],
        keywords: ['свеч', 'кабинет', 'библиотек', 'candle', 'library', 'study', 'warm light'],
    },
    {
        id: 'deep',
        name: 'Глубина',
        icon: '🌊',
        sky: 'deep',
        grade: { shade: 1.2, tint: 'rgba(0,44,66,.26)' },
        layers: [
            { effect: 'plankton', params: { color: '120,235,210' }, intensity: 0.8 },
            { effect: 'bubbles', params: { color: '176,226,255' } },
        ],
        keywords: ['под водой', 'подводн', 'океан', 'море', 'глубин', 'water', 'underwater', 'ocean', 'sea', 'deep'],
    },
    {
        id: 'neon',
        name: 'Неоновый дождь',
        icon: '🌃',
        sky: 'neon',
        grade: { shade: 1.1, tint: 'rgba(96,20,124,.2)' },
        layers: [
            { effect: 'rain', params: { color: '216,190,255', wind: 0.2, len: 1.1 } },
            { effect: 'motes', params: { color: '255,170,230', size: 0.6 }, intensity: 0.5 },
        ],
        keywords: ['неон', 'киберпанк', 'город', 'улиц', 'neon', 'cyberpunk', 'city', 'street', 'nightclub'],
    },
    {
        id: 'starfall',
        name: 'Звездопад',
        icon: '☄️',
        sky: ['night', { id: 'moon', opacity: 0.7 }],
        grade: { shade: 1.05, tint: 'rgba(40,32,80,.18)' },
        layers: [
            { effect: 'stars', params: { count: 240 } },
            { effect: 'meteors', params: { every: [1.6, 4.2] } },
        ],
        keywords: ['звездопад', 'метеор', 'комета', 'желани', 'meteor', 'shooting star', 'comet'],
    },
    {
        id: 'forest',
        name: 'Зачарованный лес',
        icon: '🌲',
        sky: 'forest',
        grade: { shade: 1.1, tint: 'rgba(10,40,32,.22)' },
        layers: [
            { effect: 'fireflies', params: { count: 28 } },
            { effect: 'mist', params: { color: '150,200,180' }, intensity: 0.6 },
            { effect: 'motes', params: { color: '190,255,210', size: 0.6 }, intensity: 0.6 },
        ],
        keywords: ['лес', 'чаща', 'поляна', 'эльф', 'фей', 'forest', 'woods', 'fairy'],
    },
    {
        id: 'desert',
        name: 'Пустыня',
        icon: '🏜',
        sky: 'desert',
        grade: { shade: 0.95, tint: 'rgba(120,74,26,.14)' },
        layers: [
            { effect: 'dunes', params: { horizon: 0.74, far: '96,64,36', near: '38,24,19' } },
            { effect: 'sand', params: { color: '234,202,152' } },
            { effect: 'shimmer', params: { color: '255,206,150' }, intensity: 0.8 },
            { effect: 'motes', params: { color: '244,216,168', size: 0.6 }, intensity: 0.45 },
        ],
        keywords: ['пустын', 'песок', 'песк', 'бархан', 'дюн', 'оазис', 'desert', 'sand', 'dune', 'wasteland'],
    },
    {
        id: 'desert_night',
        name: 'Пустыня ночью',
        icon: '🌵',
        sky: ['desert-night', { id: 'moon', opacity: 0.75 }],
        grade: { shade: 1.05, tint: 'rgba(58,44,84,.16)' },
        layers: [
            { effect: 'dunes', params: { horizon: 0.72, far: '60,52,62', near: '24,20,28' } },
            { effect: 'stars', params: { count: 170 } },
            { effect: 'sand', params: { color: '198,190,214', wind: 0.6 }, intensity: 0.55 },
        ],
        keywords: ['ночная пустыня', 'пустыня ночью', 'ночь в пустын', 'ночной песок', 'desert night'],
    },
    {
        id: 'autumn',
        name: 'Осенний листопад',
        icon: '🍂',
        sky: 'autumn',
        grade: { shade: 1, tint: 'rgba(92,42,16,.16)' },
        layers: [
            { effect: 'leaves', params: { shape: 'leaf', size: 1, count: 34 } },
            { effect: 'mist', params: { color: '164,124,96' }, intensity: 0.45 },
            { effect: 'motes', params: { color: '255,196,130', size: 0.6 }, intensity: 0.45 },
        ],
        keywords: ['осен', 'листопад', 'листь', 'листв', 'октябр', 'сентябр', 'autumn', 'fall leaves', 'october'],
    },
    {
        id: 'garden',
        name: 'Зелёный сад',
        icon: '🍃',
        sky: 'garden',
        grade: { shade: 1, tint: 'rgba(18,60,36,.16)' },
        layers: [
            { effect: 'leaves', params: { shape: 'leaf', size: 1, count: 28, colors: ['124,186,104', '92,158,82', '150,200,116', '72,132,74'] } },
            { effect: 'motes', params: { color: '190,240,180', size: 0.6 }, intensity: 0.5 },
        ],
        keywords: ['сад', 'зелён', 'зелен', 'весн', 'garden', 'green leaves', 'spring'],
    },
    {
        id: 'sakura',
        name: 'Сакура',
        icon: '🌸',
        sky: 'sakura',
        grade: { shade: 1, tint: 'rgba(122,40,82,.14)' },
        layers: [
            { effect: 'leaves', params: { shape: 'petal', size: 0.95, count: 48 } },
            { effect: 'mist', params: { color: '232,182,204' }, intensity: 0.4 },
            { effect: 'motes', params: { color: '255,214,232', size: 0.55 }, intensity: 0.5 },
        ],
        keywords: ['сакур', 'лепестк', 'вишн', 'цветёт', 'цветет', 'sakura', 'petal', 'blossom', 'cherry'],
    },
    {
        id: 'arcane',
        name: 'Магия',
        icon: '✨',
        sky: 'arcane',
        grade: { shade: 1, tint: 'rgba(64,32,116,.18)' },
        layers: [
            { effect: 'trails', params: { count: 20, tail: 34 } },
            { effect: 'spirits', params: { count: 30 }, intensity: 0.8 },
            { effect: 'motes', params: { color: '210,196,255', size: 0.6 }, intensity: 0.45 },
        ],
        keywords: ['магия', 'магическ', 'чары', 'заклят', 'заклинани', 'колдов', 'arcane', 'magic', 'spell'],
    },
    {
        id: 'cloudy',
        name: 'Облачно',
        icon: '☁️',
        sky: 'overcast',
        grade: { shade: 1.05, tint: 'rgba(44,50,66,.18)' },
        layers: [
            { effect: 'mist', params: { color: '176,182,200' }, intensity: 0.9 },
            { effect: 'motes', params: { color: '198,206,226', size: 0.6 }, intensity: 0.35 },
        ],
        keywords: ['облачн', 'пасмурн', 'хмур', 'серо', 'cloudy', 'overcast', 'mulen'],
    },
    {
        id: 'sunny',
        name: 'Солнечный день',
        icon: '☀️',
        sky: 'sunny',
        grade: { shade: 0.85, tint: 'rgba(150,96,36,.16)' },
        layers: [
            { effect: 'rays', params: { color: '255,214,150', count: 6 } },
            { effect: 'motes', params: { color: '255,224,168', size: 0.9 }, intensity: 1 },
            { effect: 'shimmer', params: { color: '255,214,150' }, intensity: 0.5 },
            { effect: 'groundm', params: { color: '255,220,170', level: 0.16 }, intensity: 0.35 },
        ],
        keywords: ['солнечн', 'солнц', 'ясн', 'жарк', 'sunny', 'sunlight', 'clear sky'],
    },
    {
        id: 'hail',
        name: 'Град',
        icon: '🧊',
        sky: 'storm',
        grade: { shade: 1.15, tint: 'rgba(30,36,58,.2)' },
        layers: [
            { effect: 'rain', params: { wind: 0.3, len: 1.1 }, intensity: 0.7 },
            { effect: 'hail', params: { wind: 0.2 } },
            { effect: 'groundm', params: { color: '180,190,214', level: 0.24 }, intensity: 0.7 },
        ],
        keywords: ['град', 'hail'],
    },
    {
        id: 'blizzard',
        name: 'Метель',
        icon: '🌬',
        sky: 'snow',
        grade: { shade: 1, tint: 'rgba(52,62,92,.2)' },
        layers: [
            { effect: 'snow', params: { wind: 0.75, size: 1.35 }, intensity: 1.35 },
            { effect: 'groundm', params: { color: '216,224,244', level: 0.34 }, intensity: 1.2 },
            { effect: 'motes', params: { color: '228,236,255', size: 0.6 }, intensity: 0.5 },
        ],
        keywords: ['метел', 'метёл', 'вьюга', 'пурга', 'blizzard', 'snowstorm'],
    },
    {
        id: 'birthday',
        name: 'Свечи и торт',
        icon: '🎂',
        sky: ['birthday', { id: 'candlelight', opacity: 0.9 }],
        grade: { shade: 1.1, tint: 'rgba(96,44,18,.16)' },
        layers: [
            { effect: 'embers', params: { color: '255,198,128', size: 0.7 }, intensity: 0.95 },
            { effect: 'motes', params: { color: '255,216,164', size: 0.8 }, intensity: 1 },
            { effect: 'shimmer', params: { color: '255,206,150' }, intensity: 0.6 },
        ],
        keywords: ['день рождени', 'днюх', 'торт', 'именин', 'birthday cake', 'birthday'],
    },
];

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]));

/** «Ночной лес, дождь» -> первая сцена, чьё слово встретилось раньше всех. */
export function matchScene(text) {
    if (!text) return null;
    const low = String(text).toLowerCase();
    let best = null;
    let bestAt = Infinity;
    for (const scene of SCENES) {
        for (const kw of scene.keywords || []) {
            const at = low.indexOf(kw);
            if (at >= 0 && at < bestAt) {
                bestAt = at;
                best = scene;
            }
        }
    }
    return best;
}

export function findScene(name) {
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    if (SCENE_BY_ID.has(key)) return SCENE_BY_ID.get(key);
    const byName = SCENES.find((s) => s.name.toLowerCase() === key);
    if (byName) return byName;
    const byIdPrefix = SCENES.find((s) => s.id.startsWith(key) || s.name.toLowerCase().includes(key));
    return byIdPrefix || matchScene(key);
}

export const OFF_RE = /^(off|none|clear|stop|выкл|выключ|выключить|стоп|нет|ничего|0|убрать)$/;

