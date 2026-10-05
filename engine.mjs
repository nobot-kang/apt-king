export const ROUND_COUNT = 5;
export const CALCULATOR_LIMIT = 2;
export const displayPriceManwon = value => Math.round(value / 1000) * 1000;
// Source decimal values are compared as rational numbers, before display rounding.
function fraction(value) {
  const [base, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, decimals = ''] = base.split('.');
  let n = BigInt(whole + decimals), d = 10n ** BigInt(decimals.length);
  const e = Number(exponent);
  if (e >= 0) n *= 10n ** BigInt(e); else d *= 10n ** BigInt(-e);
  return [n, d];
}
function value(card, metric) {
  if (metric === 'total') return fraction(card.asset_manwon);
  const [p, pd] = fraction(card.price_manwon);
  const [a, ad] = fraction(card.area_m2);
  return [p * ad, pd * a];
}
export function compare(a, b, metric) {
  const [an, ad] = value(a, metric), [bn, bd] = value(b, metric);
  const delta = an * bd - bn * ad;
  return delta > 0n ? 1 : delta < 0n ? -1 : 0;
}
export function winners(cards, metric) {
  const best = cards.reduce((a, b) => compare(a, b, metric) >= 0 ? a : b);
  return cards.filter(c => compare(c, best, metric) === 0).map(c => c.id);
}
export const unitPrice = (card, factor) => card.price_manwon / card.area_m2 * factor;
export function answers(question) {
  const total = winners(question.cards, 'total'), unit = winners(question.cards, 'unit');
  return {total, unit, reversal: !total.some(id => unit.includes(id)),
    tied: total.length > 1 || unit.length > 1};
}
export function validateQuestion(q) {
  if (q.cards.length !== 3 || new Set(q.cards.map(c => c.id)).size !== 3) throw Error('세 집의 식별자가 필요합니다.');
  for (const c of q.cards) {
    if (![c.price_manwon, c.area_m2, c.asset_manwon].every(v => Number.isFinite(v) && v > 0)) throw Error('가격·면적은 양수여야 합니다.');
    if (c.area_m2 > 500) throw Error('전용면적 범위를 확인해 주세요.');
    if (![17,18,25,26].includes(c.unit_type)) throw Error('17·18·25·26평형만 사용합니다.');
    if (!Number.isInteger(c.households) || c.households <= 0) throw Error('전체 세대수를 확인해 주세요.');
    if (c.market !== 'sale' || !/^\d{4}-\d{2}-\d{2}$/.test(c.reference_date) || !c.region) throw Error('매매 시장·기준일이 필요합니다.');
  }
  if (new Set(q.cards.map(c => `${c.market}/${c.region.slice(0,2)}/${c.reference_date}`)).size !== 1) throw Error('같은 시장·기준일만 비교합니다.');
  const result = answers(q);
  for (const metric of ['total', 'unit']) {
    const best = q.cards.find(c => c.id === result[metric][0]);
    const bestValue = metric === 'total' ? best.asset_manwon : best.price_manwon / best.area_m2;
    for (const c of q.cards.filter(c => !result[metric].includes(c.id))) {
      const v = metric === 'total' ? c.asset_manwon : c.price_manwon / c.area_m2;
      if ((bestValue - v) / bestValue < .005) throw Error('표시 정밀도에 비해 순위 차이가 너무 작습니다.');
    }
    // Ten-million-won dwelling price / four-decimal m² are the coarsest input display.
    const rounded = q.cards.map(c => ({...c, asset_manwon: Math.round(c.asset_manwon), price_manwon: displayPriceManwon(c.price_manwon), area_m2: Number(c.area_m2.toFixed(4))}));
    if (winners(rounded, metric).join() !== result[metric].join()) throw Error('표시값과 원정밀도 순위가 다릅니다.');
  }
  return result;
}
export function validatePack(pack) {
  if (!(pack.pyeong_m2 > 0) || new Set(pack.questions.map(q => q.id)).size !== pack.questions.length) throw Error('문제 팩이 올바르지 않습니다.');
  if (pack.questions.filter(q => q.practice).length !== 1) throw Error('연습 문제는 하나여야 합니다.');
  pack.questions.forEach(q => {
    validateQuestion(q);
    for (const c of q.cards) {
      if (Math.abs(c.area_m2 - c.unit_type * pack.pyeong_m2) > 1e-9) throw Error('전용 평형과 면적이 다릅니다.');
      if (c.reference_date !== pack.source.reference_date || c.market !== pack.source.market) throw Error('문제 팩의 기준일·시장이 다릅니다.');
    }
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > ROUND_COUNT) throw Error('난이도 정보가 필요합니다.');
  });
  return pack;
}
function random(seed) {
  let n = 2166136261;
  for (const ch of String(seed)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function sessionQuestions(pack, seed, review = null) {
  validatePack(pack);
  const rng = random(seed);
  const missed = new Set((review || []).map(r => r.question.id));
  const weights = {};
  (review || []).forEach(r => r.mistakes.forEach(t => { weights[t] = (weights[t] || 0) + 1; }));
  const priority = q => (missed.has(q.id) ? 100 : 0) +
    (q.pattern === 'boundary' ? weights.close_values || 0 : 0) +
    (q.pattern === 'reverse' ? (weights.single_as_asset || 0) + (weights.asset_as_unit || 0) : 0);
  const startProvince = rng() < .5 ? '11' : '41';
  const selected = Array.from({length: ROUND_COUNT}, (_, i) => {
    const province = i % 2 ? (startProvince === '11' ? '41' : '11') : startProvince;
    const pool = shuffle(pack.questions.filter(q => !q.practice && q.difficulty === i + 1 && q.cards[0].region.startsWith(province)), rng);
    pool.sort((a,b) => priority(b)-priority(a));
    if (!pool.length) throw Error('서울·경기 각 난이도 문항이 필요합니다.');
    return pool[0];
  });
  return selected.map((q, i) => ({...q, cards: shuffle(q.cards, rng), moneyUnit: 'eok', hideYear: i >= 4}));
}
export const MISTAKES = {
  single_as_asset: {label: '1채 가격을 단지 전체 자산총액으로 판단', tip: '한 채가 비싸도 세대수가 적으면 단지 전체 가치는 작을 수 있어요. 가격 × 전체 세대수를 함께 보세요.'},
  households_only: {label: '세대수만으로 단지 가치를 판단', tip: '세대수와 한 채 가격을 함께 곱해 보세요. 실제 총액은 모든 평형별 가치를 합칩니다.'},
  asset_as_unit: {label: '큰 단지의 자산총액을 높은 평당가로 판단', tip: '평당가는 카드의 1채 가격 ÷ 전용 평수입니다. 단지 세대수와는 별개예요.'},
  price_as_unit: {label: '1채 가격과 평당가를 같은 기준으로 판단', tip: '17·18평형과 25·26평형의 면적 차이를 나눗셈으로 반영하세요.'},
  close_values: {label: '근접한 수치를 대략적인 인상으로 판단', tip: '계산기로 가격 × 세대수와 가격 ÷ 전용 평수를 각각 확인하세요.'},
  check_units: {label: '가격·면적·세대수 재확인 필요', tip: '1억 = 10,000만원, 1평 = 3.3058㎡입니다. 약식 총액은 정답 자체가 아닌 힌트예요.'},
};
export function grade(question, selection) {
  const key = answers(question);
  const total = key.total.includes(selection.total), unit = key.unit.includes(selection.unit);
  const types = new Set();
  const picked = question.cards.find(c => c.id === selection.total);
  if (!total && picked?.price_manwon === Math.max(...question.cards.map(c => c.price_manwon))) types.add('single_as_asset');
  if (!total && picked?.households === Math.max(...question.cards.map(c => c.households))) types.add('households_only');
  if (!unit && key.total.includes(selection.unit)) types.add('asset_as_unit');
  if (!unit && question.cards.find(c => c.id === selection.unit)?.price_manwon === Math.max(...question.cards.map(c => c.price_manwon))) types.add('price_as_unit');
  if ((!total || !unit) && question.difficulty >= 5) types.add('close_values');
  if ((!total || !unit) && !types.size) types.add('check_units');
  return {question, selection: {...selection}, key, total, unit, mistakes: [...types],
    score: 10 * Number(total) + 10 * Number(unit), max: 20};
}
export function summary(results) {
  const counts = {};
  results.forEach(r => r.mistakes.forEach(type => { counts[type] = (counts[type] || 0) + 1; }));
  return {score: results.reduce((n, r) => n + r.score, 0), max: results.length * 20,
    total: [results.filter(r => r.total).length, results.length], unit: [results.filter(r => r.unit).length, results.length],
    mistakes: Object.entries(counts).sort((a, b) => b[1] - a[1]),
    missed: results.filter(r => r.score < r.max)};
}
export function calculate(price, priceUnit, area, areaUnit, factor, households = null) {
  if (!['eok', 'manwon'].includes(priceUnit) || !['m2', 'pyeong'].includes(areaUnit)) throw Error('단위를 확인해 주세요.');
  const amount = Number(price) * (priceUnit === 'eok' ? 10000 : 1);
  const pyeong = Number(area) / (areaUnit === 'm2' ? factor : 1);
  const result = amount / pyeong;
  if (![amount, pyeong, result].every(v => Number.isFinite(v) && v > 0)) throw Error('가격과 면적에 양수를 입력하세요.');
  let approximateAsset = null;
  if (households !== null) {
    if (!Number.isSafeInteger(Number(households)) || Number(households) <= 0) throw Error('세대수에 양의 정수를 입력하세요.');
    approximateAsset = amount * Number(households);
    if (!Number.isFinite(approximateAsset)) throw Error('계산 범위를 벗어났어요.');
  }
  return {amount, pyeong, perPyeong: result, approximateAsset};
}
export class Game {
  constructor(pack, seed, review = null, clock = () => Math.floor(performance.now() / 1000), gameMode = 'easy') {
    if (!['easy','hard'].includes(gameMode)) throw Error('게임 모드를 확인해 주세요.');
    Object.defineProperty(this,'gameMode',{value:gameMode,enumerable:true});
    this.questions = sessionQuestions(pack, seed, review);
    this.practice = {...pack.questions.find(q => q.practice), moneyUnit: 'eok', hideYear: false};
    this.clock = clock; this.startedAt = null; this.finishedAt = null; this.calculatorUses = 0;
    this.results = []; this.phase = 'start'; this.index = -1; this.selection = {};
  }
  get question() { return this.index < 0 ? this.practice : this.questions[this.index]; }
  start(skipPractice = false) {
    if (this.phase !== 'start') return false;
    if (skipPractice) { this.index = 0; this.startedAt = this.clock(); }
    this.phase = 'selecting'; return true;
  }
  get elapsedSeconds() {
    return this.startedAt === null ? 0 : Math.max(0, Math.round((this.finishedAt ?? this.clock()) - this.startedAt));
  }
  get calculatorRemaining() { return this.gameMode === 'hard' ? Infinity : CALCULATOR_LIMIT - this.calculatorUses; }
  useCalculator(...args) {
    if (!['selecting','locked','revealed'].includes(this.phase) || this.calculatorRemaining <= 0) throw Error('이번 판 계산기 기회 2회를 모두 사용했어요.');
    const result = calculate(...args);
    this.calculatorUses++;
    return result;
  }
  choose(metric, id) {
    if (this.phase !== 'selecting' || !['total', 'unit'].includes(metric)) return false;
    if (!this.question.cards.some(c => c.id === id)) return false;
    this.selection[metric] = id;
    return true;
  }
  get complete() { return Boolean(this.selection.total && this.selection.unit); }
  lock() {
    if (this.phase !== 'selecting' || !this.complete) return false;
    this.selection = Object.freeze({...this.selection}); this.phase = 'locked'; return true;
  }
  reveal() {
    if (this.phase !== 'locked') return false;
    this.result = grade(this.question, this.selection);
    if (this.index >= 0) this.results.push(this.result);
    if (this.index === ROUND_COUNT - 1) this.finishedAt = this.clock();
    this.phase = 'revealed'; return true;
  }
  next() {
    if (this.phase !== 'revealed') return false;
    if (this.index === ROUND_COUNT - 1) { this.phase = 'summary'; return true; }
    this.index++; this.calculatorUses = 0;
    if (this.index === 0) this.startedAt = this.clock();
    this.selection = {}; this.result = null; this.phase = 'selecting'; return true;
  }
}
