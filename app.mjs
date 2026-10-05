import {Game, MISTAKES, summary, unitPrice, validatePack, ROUND_COUNT, displayPriceManwon} from './engine.mjs';
import {GAME_NAME, formatTime, loadRecords, saveRecord, shareText, recordImage, modeLabel, mascotPath, mascotAlt} from './records.mjs';

// Match the dashboard's escaped templates, Korean system fonts and native controls.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const num = (v, n = 0) => Number(v).toLocaleString('ko-KR', {maximumFractionDigits: n});
const crown = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m4 9 6 5 6-9 6 9 6-5-3 15H7L4 9Z" fill="currentColor"/><path d="M8 28h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const house = i => `<svg class="house-art" viewBox="0 0 280 130" aria-hidden="true"><path d="M18 114h244" stroke="currentColor" opacity=".2"/><path d="M${55+i*8} 112V${35-i*5}h${80+i*20}v${77+i*5}" fill="currentColor" opacity=".13"/><path d="M${55+i*8} ${35-i*5}h${80+i*20}v${77+i*5}H${55+i*8}Z" fill="none" stroke="currentColor" stroke-width="2"/>${Array.from({length: 12}, (_, k) => `<path d="M${67+i*8+(k%4)*(16+i*4)} ${49-i*5+Math.floor(k/4)*19}h8v9h-8Z" fill="currentColor" opacity=".7"/>`).join('')}<path d="M${89+i*17} 112V94h16v18" fill="currentColor"/><circle cx="226" cy="84" r="16" fill="currentColor" opacity=".2"/><path d="M226 90v23" stroke="currentColor" stroke-width="2"/><circle cx="39" cy="97" r="10" fill="currentColor" opacity=".25"/></svg>`;
const main = document.querySelector('#main');
let pack, game, seed = new URLSearchParams(location.search).get('seed') || `G032-${crypto.getRandomValues(new Uint32Array(1))[0]}`, reviewMode = false, selectedMode = 'easy';
let calculator = {price: '', priceUnit: 'manwon', area: '', areaUnit: 'm2', households: '', result: ''};
const label = id => String.fromCharCode(65 + game.question.cards.findIndex(c => c.id === id));
const labels = ids => ids.map(label).join(' · ');
const setFocus = selector => main.querySelector(selector)?.focus();
const assetText = v => `${num(v / 10000, 2)}억`;
const priceText = c => `${(displayPriceManwon(c.price_manwon) / 10000).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})}억`;
const mascot = (text, happy = false) => `<div class="mascot-guide">${happy?'<img src="./assets/mascot-smile.png" alt="활짝 웃는 펭귄 마스코트">':'<span class="mascot-sprite" role="img" aria-label="안경 쓴 펭귄 마스코트"></span>'}<p>${text}</p></div>`;
const scoreMascot = (score, text) => `<div class="mascot-guide"><img src="${mascotPath(score)}" alt="${mascotAlt(score)}"><p>${text}</p></div>`;
const isHard = () => game.gameMode === 'hard';
const quotaText = () => isHard() ? '직접 입력 <strong>계산 횟수 무제한</strong>' : `남은 기회 <strong>${game.calculatorRemaining} / 2회</strong>`;
const browserStorage = {getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
let recordState = loadRecords(browserStorage), currentRecord = null, selectedRecordId = recordState.records[0]?.id;
let sharingBusy = false;

function selectedRecord() { return recordState.records.find(r=>r.id===selectedRecordId) || recordState.records[0]; }
function recordPreview(record) {
  if(!record) return '';
  return `<div class="record-preview ${record.gameMode==='hard'?'hard-record':''}"><img src="${mascotPath(record.score)}" alt="${mascotAlt(record.score)}"><div><p>${modeLabel(record.gameMode)} · ${record.mode==='review'?'복습':'본 게임'} · ${esc(new Date(record.createdAt).toLocaleString('ko-KR'))}</p><strong>${record.score}<small> / 100점</small></strong><p>${formatTime(record.elapsedSeconds)}</p><p class="small">총액 왕 ${record.totalCorrect}/5 · 평당가 왕 ${record.unitCorrect}/5</p></div></div>`;
}
function recordBoard() {
  const bests=['easy','hard'].map(gameMode=>({gameMode,record:recordState.records.find(r=>r.mode==='normal' && r.gameMode===gameMode)}));
  return `<section class="record-board" aria-labelledby="record-title"><div class="record-heading"><div><p class="eyebrow">나의 도전 기록</p><h2 id="record-title">내 레코드판</h2></div>${bests.map(({gameMode,record})=>record?`<p>${modeLabel(gameMode)} 본 게임 최고 <strong>${record.score}점 · ${formatTime(record.elapsedSeconds)}</strong></p>`:'').join('')}</div><p class="small">이 브라우저에만 최대 100개 저장됩니다. 쉬움·어려움별로 점수 우선, 동점이면 짧은 시간 순. 복습 기록은 구분하며, 브라우저 데이터를 지우면 사라져요.</p>${recordState.warning?`<p role="status" class="storage-warning">${esc(recordState.warning)}</p>`:''}${recordState.records.length?`<label for="record-select">이미지·공유에 사용할 기록 선택</label><select id="record-select">${recordState.records.map(r=>`<option value="${esc(r.id)}" ${r.id===(selectedRecord()?.id)?'selected':''}>${modeLabel(r.gameMode)} · ${r.mode==='review'?'복습':'본 게임'} · ${r.score}점 · ${formatTime(r.elapsedSeconds)} · ${esc(new Date(r.createdAt).toLocaleString('ko-KR'))}</option>`).join('')}</select><div id="record-preview">${recordPreview(selectedRecord())}</div><div class="record-actions"><button data-action="download">선택한 기록 이미지 다운로드</button><button data-action="share">게임 링크·기록 공유 문구 복사</button></div><p id="share-status" role="status"></p><div id="copy-fallback"></div>`:'<p class="empty-records">아직 기록이 없어요. 본 게임 5판을 마치면 점수와 시간이 여기에 자동 저장됩니다.</p>'}</section>`;
}
function updateRecordPreview() {
  const el=main.querySelector('#record-preview');
  if(el) el.innerHTML=recordPreview(selectedRecord());
  const status=main.querySelector('#share-status');if(status) status.textContent='';
  main.querySelector('#copy-fallback')?.replaceChildren();
}
function rememberRecord(stats) {
  if(currentRecord || game.results.length!==ROUND_COUNT || game.finishedAt===null) return;
  currentRecord={id:crypto.randomUUID(),score:stats.score,totalCorrect:stats.total[0],unitCorrect:stats.unit[0],
    elapsedSeconds:game.elapsedSeconds,createdAt:new Date().toISOString(),mode:reviewMode?'review':'normal',gameMode:game.gameMode,
    packVersion:pack.version,seed,roundIds:game.questions.map(q=>q.id)};
  const latest=loadRecords(browserStorage);
  const merged=[...new Map([...recordState.records,...latest.records].map(r=>[r.id,r])).values()];
  recordState=saveRecord(merged,currentRecord,browserStorage);selectedRecordId=currentRecord.id;
}
async function shareRecord(action) {
  if(sharingBusy) return;
  const record=selectedRecord();if(!record) return;
  const status=main.querySelector('#share-status');sharingBusy=true;
  main.querySelectorAll('.record-actions button').forEach(b=>{b.disabled=true;});
  try {
    if(action==='download') {
      status.textContent='선택한 기록 이미지를 만들고 있어요…';
      const blob=await recordImage(record), url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`apt-king-${record.gameMode}-${record.score}-${record.id.slice(0,8)}.png`;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
      status.textContent=`${record.score}점 · ${formatTime(record.elapsedSeconds)} 기록 이미지를 다운로드했어요.`;
    } else {
      const text=shareText(record);
      try {
        await navigator.clipboard.writeText(text);
        status.textContent='게임 링크와 선택한 기록의 공유 문구를 복사했어요.';
        main.querySelector('#copy-fallback').replaceChildren();
      } catch {
        status.textContent='자동 복사가 허용되지 않았어요. 아래 문구를 직접 복사해 주세요.';
        const box=main.querySelector('#copy-fallback');box.innerHTML='<label for="manual-copy">공유 문구</label><textarea id="manual-copy" readonly rows="5"></textarea>';
        const field=box.querySelector('textarea');field.value=text;field.focus();field.select();
      }
    }
  } catch { status.textContent='기록 이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'; }
  finally { sharingBusy=false; main.querySelectorAll('.record-actions button').forEach(b=>{b.disabled=false;}); }
}

function sourceNote() {
  return `<details class="source"><summary>어떤 단지와 가격을 비교하나요?</summary><p><strong>총액 왕 = 단지 전체 자산총액 1위</strong>, <strong>평당가 왕 = 카드의 17·18·25·26평형 전용 평당가 1위</strong>입니다. 두 기준은 다른 대상을 비교해요.</p><p>카드의 1채 가격 × 전체 세대수는 힌트용 약식 추정입니다. 정답은 기존 시장 지도의 계산처럼 <strong>모든 평형의 실제 전용면적별 추정가격 × 해당 세대수</strong>를 합산합니다. 큰 평형이 얼마나 있는지 등 단지의 구성에 따라 값이 달라져요. 이유 선택 점수는 없으며 두 왕관은 각 10점, 5판 100점 만점입니다.</p><p>${esc(pack.source.market_label)} · ${esc(pack.source.reference_date)} 기준. 매 판 같은 시도·매매 시장·기준일의 세 단지를 비교하며, 각 카드에 지역을 표시합니다. 세대수는 기존 검증된 재고 스냅샷을 사용합니다.</p><p>1채 가격과 전용면적은 기존 모형의 표준주택 추정값이며 실제 매물 호가가 아닙니다. 1평 = ${pack.pyeong_m2}㎡, 1억 = 10,000만원. 표시는 반올림하지만 정답은 원정밀도로 비교하고, 1채 가격 표시는 천만원 단위로 반올림합니다. 공동 1위는 모두 인정합니다.</p></details>`;
}
function intro() {
  main.innerHTML = `<section class="intro"><div class="intro-copy"><p class="eyebrow">${GAME_NAME}</p><h1 tabindex="-1">규모가 큰 단지와<br><span>비싼 한 평.</span><br>왕관의 주인은?</h1><p class="lead">세 단지의 <strong>자산총액 1등</strong>과 카드에 나온 집의 <strong>전용 평당가 1등</strong>을 골라보세요. 한 채 가격에 세대수를 곱하면, 단지의 규모가 보입니다.</p><div class="pills"><span>서울·경기 랜덤 5판</span><span>5단계 난이도</span><span>시간 제한 없음</span></div><fieldset class="mode-picker"><legend>플레이 모드</legend><div><label><input type="radio" name="gameMode" value="easy" ${selectedMode==='easy'?'checked':''}><span><strong>쉬움</strong><small>1채 가격 힌트 · 계산기 판당 2회</small></span></label><label><input type="radio" name="gameMode" value="hard" ${selectedMode==='hard'?'checked':''}><span><strong>어려움</strong><small>가격 힌트 없음 · 직접 계산 무제한</small></span></label></div><p class="small">어려움은 주소·단지·면적·세대수로 가격을 추정하는 도전이에요. 정답 공개 뒤 실제 수치로 확인합니다.</p></fieldset><button class="primary start" data-action="start">연습부터 시작하기 <span aria-hidden="true">→</span></button><button class="skip-practice" data-action="skip">연습 건너뛰고 바로 도전</button><p class="small">연습은 선택 · 본 게임 5판 · 100점 만점 · 기록은 모드별로 구분</p></div><div class="intro-art">${mascot("단지 전체를 볼까, 한 평을 볼까? 내가 안내해 줄게!",true)}<div class="art-heading">총액 왕 <span>vs.</span> 평당가 왕</div><div class="demo-cards"><div class="demo total"><span class="crown">${crown}</span>${house(2)}<b>단지 전체의 가치</b><span>모든 평형의 자산가치 합계</span></div><div class="demo unit"><span class="crown">${crown}</span>${house(0)}<b>전용 1평의 가격</b><span>카드의 1채 가격 ÷ 전용 평수</span></div></div><p>한 채 가격은 힌트일 뿐.<br>세대수까지 함께 보고 왕관을 골라주세요.</p></div></section><section class="intro-bottom"><div><h2>처음은 뚜렷하게, 마지막은 더 섬세하게.</h2><p>17·18·25·26평형만 비교합니다. 쉬운 문제부터 차이가 작은 문제까지, 자동으로 뽑아드려요.</p><p>단지의 규모와 한 평의 가격은 별개의 축입니다. 시간은 본 게임 시작부터 마지막 정답 공개까지 기록하며, 점수에는 영향을 주지 않아요.</p></div></section>${recordBoard()}${sourceNote()}`;
}
function card(c, i) {
  return `<article class="home-card"><div class="home-art tone-${i}"><span class="letter">${String.fromCharCode(65+i)}</span>${house(i)}</div><div class="home-body"><p class="address">${esc(c.region_label)} ${esc(c.dong_name)} ${esc(c.jibun)}</p><h3>${esc(c.name)}</h3><p class="small metadata">${game.question.hideYear ? '이번 판은 건축연도 없이 비교해요' : `${esc(c.build_year)}년 건축`}</p><div class="household-hint"><span>단지 전체</span><strong>${num(c.households)}세대</strong></div><dl><div><dt>이 평형 1채 추정가격 · 힌트</dt><dd class="price-hint">${isHard()?'가격 비공개':priceText(c)}</dd></div><div class="area-line"><dt>전용면적</dt><dd>${c.unit_type}평</dd></div></dl><p class="small">${num(c.area_m2,4)}㎡ · 모형 기준면적</p><button class="load-calc" data-load="${i}" ${isHard()?'disabled aria-label="어려움에서는 숫자 자동 입력을 사용할 수 없습니다"':''}>${String.fromCharCode(65+i)} 숫자를 계산기에 넣기 <span aria-hidden="true">↗</span></button></div></article>`;
}
function choices(metric, title, description) {
  return `<fieldset class="choice-group ${metric}"><legend><span class="crown">${crown}</span>${title}<span class="points">10점</span></legend><p>${description}</p><div class="choice-options">${game.question.cards.map((c,i) => `<label><input type="radio" name="${metric}" value="${esc(c.id)}" ${game.selection[metric]===c.id?'checked':''} ${game.phase!=='selecting'?'disabled':''}><span>${String.fromCharCode(65+i)}<small>${esc(c.name)}</small></span></label>`).join('')}</div></fieldset>`;
}
function calculatorPanel() {
  return `<aside class="calculator" aria-labelledby="calc-title"><div class="calc-head"><span class="eyebrow">YOUR WORKSPACE</span><span class="free">${isHard()?'무제한':'판당 2회'}</span></div><h2 id="calc-title">곱하고 나누기</h2><p class="calc-quota" id="calc-quota" role="status">${quotaText()}</p><p>세대수를 곱해 단지 규모를,<br>전용 평수로 나눠 한 평의 가격을.</p><form id="calc-form"><label for="calc-price">1채 가격</label><div class="input-row"><input id="calc-price" name="price" type="text" inputmode="decimal" pattern="[0-9]*[.]?[0-9]+" autocomplete="off" value="${esc(calculator.price)}" required><select name="priceUnit" aria-label="가격 단위"><option value="manwon" ${calculator.priceUnit==='manwon'?'selected':''}>만원</option><option value="eok" ${calculator.priceUnit==='eok'?'selected':''}>억</option></select></div><label for="calc-households">× 단지 전체 세대수</label><input id="calc-households" name="households" type="text" inputmode="numeric" pattern="[0-9]+" autocomplete="off" value="${esc(calculator.households)}" required><label for="calc-area">÷ 전용면적</label><div class="input-row"><input id="calc-area" name="area" type="text" inputmode="decimal" pattern="[0-9]*[.]?[0-9]+" autocomplete="off" value="${esc(calculator.area)}" required><select name="areaUnit" aria-label="면적 단위"><option value="m2" ${calculator.areaUnit==='m2'?'selected':''}>㎡</option><option value="pyeong" ${calculator.areaUnit==='pyeong'?'selected':''}>평</option></select></div><button type="submit" class="calc-button" ${game.calculatorRemaining===0?'disabled':''}>${game.calculatorRemaining===0?'이번 판 기회 모두 사용':'곱셈·나눗셈 계산하기'}</button><output id="calc-result" aria-live="polite">${calculator.result || (isHard()?'예상 가격과 세대수·면적을 직접 입력해 보세요.':'카드의 숫자를 불러와 비교해 보세요.')}</output></form><div class="formula"><strong>약식 단지 총액 = 1채 가격 × 전체 세대수</strong><span>평당가 = 1채 가격 ÷ 전용 평수</span><span>1평 = ${pack.pyeong_m2}㎡ · 1억 = 10,000만원</span></div><p class="small">${isHard()?'예상하는 1채 가격을 직접 입력해 여러 번 비교해 보세요. 횟수 제한이 없고 가격 자동 입력은 제공하지 않아요.':'계산 버튼 1번에 두 결과를 함께 확인합니다. 숫자 불러오기와 잘못된 입력은 기회를 쓰지 않아요.'} 약식 총액은 정답 자체가 아닙니다. 실제 자산총액은 전체 평형별 가격과 세대수를 합산해요.</p></aside>`;
}
function scoreLine(title, correct, chosen, correctIds) {
  return `<div class="score-line"><span>${title}</span><strong class="${correct?'good':'wrong'}">${correct?'정답 +10':'다시 확인 +0'}</strong><span>내 선택 ${label(chosen)} · ${correctIds.length>1?'공동 ':''}1위 ${labels(correctIds)}</span></div>`;
}
function resultView() {
  const r = game.result, q = game.question;
  const total = q.cards.find(c => c.id === r.key.total[0]), unit = q.cards.find(c => c.id === r.key.unit[0]);
  const explanation = r.key.reversal
    ? `${labels(r.key.total)}는 ${num(total.households)}세대의 모든 평형 가치를 합쳐 자산총액 ${assetText(total.asset_manwon)}으로 1위지만, 카드의 1평당 가격은 ${labels(r.key.unit)}의 ${unit.unit_type}평형이 ${num(unitPrice(unit,pack.pyeong_m2),1)}만원으로 더 높습니다.`
    : `${labels(r.key.total)}가 단지 전체 자산총액 1위이고, ${labels(r.key.unit)}가 카드 평형의 전용 평당가 1위로 두 기준의 1위에 같은 단지가 포함됩니다.`;
  const winner = (c,metric,title) => r.key[metric].includes(c.id) ? `<span class="winner ${metric}">${r.key[metric].length>1?'공동 ':''}${title}</span>` : '';
  return `<section class="result" aria-labelledby="result-title"><div class="result-heading"><div><p class="eyebrow">왕관 공개</p><h2 id="result-title" tabindex="-1">두 왕관의 주인을 확인하세요.</h2></div><strong class="round-score">${r.score}<small> / 20점${game.index<0?' · 연습':''}</small></strong></div>${scoreMascot(r.score*5,explanation)}<div class="result-table-wrap" role="region" aria-label="세 단지의 결과 비교" tabindex="0"><table><caption>단지 전체 가치와 카드 평형의 한 평 가격</caption><thead><tr><th scope="col">단지</th><th scope="col">전체 세대수</th><th scope="col">약식 총액 (억)</th><th scope="col">단지 추정 자산총액 (억)</th><th scope="col">카드 전용 평당가 (만원/평)</th></tr></thead><tbody>${q.cards.map(c=>`<tr><th scope="row">${label(c.id)} ${esc(c.name)}<br><span class="small">${priceText(c)} / ${c.unit_type}평</span></th><td>${num(c.households)}</td><td>${num(displayPriceManwon(c.price_manwon)*c.households/10000,2)}</td><td>${num(c.asset_manwon/10000,2)}${winner(c,'total','총액 왕')}</td><td>${num(unitPrice(c,pack.pyeong_m2),1)}${winner(c,'unit','평당가 왕')}</td></tr>`).join('')}</tbody></table></div><p class="reason-answer">단지 전체 자산총액에는 세대수와 전체 평형 구성이 영향을 줍니다. 평당가는 카드 1채의 가격을 전용 평수로 나눈 값이에요. 서로 다른 기준이므로 왕관의 주인도 달라질 수 있습니다.</p><details class="asset-evidence"><summary>약식 계산과 실제 총액은 왜 다를까요? 평형별 근거 보기</summary><p class="small">정답 자산총액은 모든 평형별 추정가격 × 해당 세대수를 합산한 값입니다. 카드 평형과 다른 면적도 포함되며, 아래의 면적은 재고 자료의 실제 전용면적입니다. 표시만 반올림합니다.</p>${q.cards.map(c=>`<h3>${label(c.id)} ${esc(c.name)}</h3><p class="small">${c.priority?.dashboard300?'대시보드 자산총액 300개 선정 · ':''}${c.priority?.asset_top300?'전체 자산총액 상위 300위 · ':''}${c.priority?.asset_rank?`전체 자산총액 ${num(c.priority.asset_rank)}위`:''}${c.priority?.daejang_quarters?.length?`<br>지역 대장 선정 이력(탐색): ${esc(c.priority.daejang_quarters.join(', '))}`:''}</p><p class="small">재고 스냅샷 ${esc(c.stock_snapshot)} · ${c.asset_components.length}개 면적 · 가격 산정 ${num(c.households)}/${num(c.households)}세대</p><div class="result-table-wrap" tabindex="0" role="region" aria-label="${label(c.id)} 평형별 자산 근거"><table><thead><tr><th scope="col">전용면적 ㎡</th><th scope="col">세대수</th><th scope="col">면적별 1채 가격 (억)</th><th scope="col">자산 기여 (억)</th></tr></thead><tbody>${c.asset_components.map(x=>`<tr><th scope="row">${num(x.area_m2,4)}</th><td>${num(x.households)}</td><td>${(displayPriceManwon(x.amount)/10000).toFixed(1)}${x.estimate_method==='nearest_area'?'<br>인접 평형 보완':''}</td><td>${num(x.value/10000,4)}</td></tr>`).join('')}</tbody></table></div>`).join('')}</details>${scoreLine('총액 왕',r.total,r.selection.total,r.key.total)}${scoreLine('평당가 왕',r.unit,r.selection.unit,r.key.unit)}${r.mistakes.length?`<div class="learning"><h3>이번에 돌아볼 판단 기준</h3><p class="small">선택에서 추정한 복습 힌트예요. 실제로 생각한 이유와 다를 수 있어요.</p>${r.mistakes.map(type=>`<p><strong>${MISTAKES[type].label}</strong><br>${MISTAKES[type].tip}</p>`).join('')}</div>`:'<p class="learning success">두 기준을 정확히 구분했어요. 단지의 규모와 한 평의 가격은 별개의 축입니다.</p>'}</section>`;
}
function renderRound() {
  const practice = game.index < 0;
  main.dataset.gameMode=game.gameMode;
  main.innerHTML = `<div class="round-top"><div><p class="mode-label">${modeLabel(game.gameMode)} 모드</p><p class="eyebrow">${reviewMode?'REVIEW LAB':'TWO CROWNS'} / ${practice?'PRACTICE':`ROUND ${String(game.index+1).padStart(2,'0')}`}</p><h1 id="round-title" tabindex="-1">${practice?'먼저, 세 단지로 연습해 볼까요?':'두 왕관을 각각 골라주세요.'}</h1><p>${game.question.cards[0].region.startsWith('11')?'서울':'경기'} · 매매 <span aria-hidden="true">·</span> ${esc(pack.source.reference_date)} 기준 <span class="basis">난이도 ${game.question.difficulty} / 5</span></p></div><div class="progress-info"><strong>${practice?'연습':`${game.index+1} / 5`}</strong><span>${practice?'점수에 포함되지 않아요':`누적 ${summary(game.results).score}점`}</span><div class="progress-dots" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${!practice&&i<=game.index?'filled':''}"></i>`).join('')}</div></div></div><div class="workspace"><div class="play-area"><div class="steps" aria-label="현재 단계"><span ${game.phase==='selecting'?'aria-current="step"':''}>1 선택</span><span ${game.phase==='locked'?'aria-current="step"':''}>2 답안 잠금</span><span ${game.phase==='revealed'?'aria-current="step"':''}>3 결과 · 다음 판</span></div>${practice?'<p class="practice-note">총액은 단지 전체의 가치! 1채 가격 × 세대수로 가늠해 보세요. 평당가는 1채 가격 ÷ 전용 평수입니다.</p>':''}${mascot(isHard()?'가격표 없이 도전! 내가 예상한 가격을 직접 입력하면 계산은 무제한이야.':practice?'연습 계산기도 2번! 본 게임에 가면 기회가 다시 채워져.':`도전 ${game.index+1}판! 계산 기회는 딱 2번이야. 한 채 가격은 천만원 단위 힌트야.`)}<div class="cards">${game.question.cards.map(card).join('')}</div><section class="answer-section" aria-label="두 왕관 선택">${choices('total','총액 왕','모든 세대의 자산가치를 합치면 가장 큰 단지는?')}${choices('unit','전용 평당가 왕','카드에 나온 평형의 1평이 가장 비싼 곳은?')}</section>${game.phase==='revealed'?resultView():''}<div class="action-bar">${game.phase==='selecting'?`<p id="selection-status" role="status"></p><button class="primary" data-action="lock" ${!game.complete?'disabled':''}>선택 확정 · 답안 잠금</button>`:game.phase==='locked'?`<p id="locked-title" tabindex="-1"><strong>답안이 잠겼어요.</strong> 이제 선택을 바꿀 수 없어요.</p><button class="primary" data-action="reveal">결과 공개하기</button>`:`<p>${practice?'연습 완료! 본 게임은 5판이에요.':'계산 결과와 내 판단을 비교했나요?'}</p><button class="primary" data-action="next">${practice?'본 게임 시작하기':game.index===4?'최종 결과 보기':'다음 판으로'} <span aria-hidden="true">→</span></button>`}</div></div>${calculatorPanel()}</div><p class="keyboard-note">Tab으로 이동 · 방향키로 왕관 선택 · Enter / Space로 확정 · 시간 제한 없음</p>${sourceNote()}`;
  updateSelectionStatus();
}
function updateSelectionStatus() {
  const status = main.querySelector('#selection-status');
  if (!status) return;
  status.textContent = game.complete ? '선택 완료! 확정하면 수정할 수 없어요.' : '총액 왕과 전용 평당가 왕을 하나씩 골라주세요.';
  main.querySelector('[data-action="lock"]').disabled = !game.complete;
}
function renderSummary() {
  const s = summary(game.results);
  rememberRecord(s);
  const rate = ([correct, count]) => count ? `${num(correct/count*100)}% <small>${correct}/${count}</small>` : '해당 없음';
  main.innerHTML = `<section class="summary"><p class="eyebrow">${reviewMode?'REVIEW COMPLETE':'FIVE ROUNDS COMPLETE'}</p><h1 tabindex="-1">단지의 규모와 한 평의 가격은<br><span>별개의 축이다.</span></h1><p class="lead">다섯 번의 비교로, 가격을 보는 기준이 하나 더 생겼어요.</p><div class="final-score">${s.score}<span> / ${s.max}점</span></div><p class="finish-time">기록 <strong>${formatTime(game.elapsedSeconds)}</strong> · ${modeLabel(game.gameMode)} · ${reviewMode?'복습':'본 게임'}</p>${scoreMascot(s.score,'왕관을 향한 도전 완료! 내 기록을 골라 이미지로 간직하거나 친구에게 공유해 봐.')}<div class="stats"><div><span>총액 왕 정답률</span><strong>${rate(s.total)}</strong></div><div><span>평당가 왕 정답률</span><strong>${rate(s.unit)}</strong></div></div><p class="small">두 왕관 각 10점, 5판 100점 만점. 연습은 제외됩니다. 이유는 해설로 확인해요.</p><section class="review-box"><h2>내 판단 습관 돌아보기</h2>${s.mistakes.length?`<p>선택에서 추정한 유형을 많이 나온 순서대로 모았어요.</p>${s.mistakes.map(([type,count])=>`<div class="review-item"><span class="review-count">${count}회</span><div><h3>${MISTAKES[type].label}</h3><p>${MISTAKES[type].tip}</p></div></div>`).join('')}`:'<p>모든 판단이 정확했어요! 새로운 카드 순서로 다시 확인해 보세요.</p>'}<div class="summary-actions">${s.missed.length?'<button class="primary" data-action="review">틀린 유형 · 유사 문제 5판 복습</button>':''}<button data-action="new">새 문제로 다시 도전</button></div>${s.missed.length?'<p class="small">각 난이도에서 틀린 문제와 유사한 유형을 우선해요. 복습도 쉬운 문제부터 시작합니다.</p>':''}</section><details class="round-review"><summary>5판의 선택과 결과 펼쳐보기</summary>${game.results.map((r,i)=>`<p>${i+1}판 · ${r.score}/${r.max}점 · 총액 ${r.total?'정답':'오답'} / 평당가 ${r.unit?'정답':'오답'}</p>`).join('')}</details><p class="small">서울·경기 자동 출제 · 1채 가격은 천만원 단위 반올림</p>${recordBoard()}</section>${sourceNote()}`;
  setFocus('h1');
}
function newGame(newSeed, review = null) {
  seed = newSeed; currentRecord = null; reviewMode = Boolean(review); calculator = {price:'',priceUnit:'manwon',area:'',areaUnit:'m2',households:'',result:''};
  game = new Game(pack,seed,review,undefined,selectedMode);
  if (review) { game.start(true); renderRound(); setFocus('#round-title'); } else { intro(); setFocus('h1'); }
}
main.addEventListener('change', event => {
  if(event.target.name==='gameMode' && game.phase==='start') { selectedMode=event.target.value; game=new Game(pack,seed,null,undefined,selectedMode); main.dataset.gameMode=selectedMode; }
  if(event.target.id==='record-select'){ selectedRecordId=event.target.value; updateRecordPreview(); }
  const {name,value} = event.target;
  if (['total','unit'].includes(name) && game.choose(name,value)) {
    updateSelectionStatus();
  }
});
main.addEventListener('input', event => {
  if (event.target.closest('#calc-form')) {
    calculator[event.target.name] = event.target.value;
    calculator.result = '';
    main.querySelector('#calc-result').textContent = '값이 바뀌었어요. 다시 계산해 주세요.';
  }
});
// Numeric keyboards on mobile; reject nonnumeric typing/paste while preserving editing keys.
for (const type of ['beforeinput','paste']) main.addEventListener(type, event => {
  const field=event.target;
  if(!field.matches('#calc-form input')) return;
  const inserted=type==='paste'?event.clipboardData?.getData('text'):event.data;
  if(!inserted) return;
  const next=field.value.slice(0,field.selectionStart)+inserted+field.value.slice(field.selectionEnd);
  if(!(field.name==='households'?/^[0-9]*$/:/^[0-9]*\.?[0-9]*$/).test(next)) event.preventDefault();
});
main.addEventListener('click', async event => {
  const load = event.target.closest('[data-load]');
  if (load && !isHard()) {
    const c = game.question.cards[Number(load.dataset.load)];
    calculator = {price:String(displayPriceManwon(c.price_manwon)),priceUnit:'manwon',area:String(c.area_m2),areaUnit:'m2',households:String(c.households),result:''};
    const form=main.querySelector('#calc-form');
    for(const key of ['price','priceUnit','area','areaUnit','households']) form.elements[key].value=calculator[key];
    main.querySelector('#calc-result').textContent = `${label(c.id)}의 천만원 단위 힌트를 불러왔어요. 계산 버튼을 눌러야 기회가 사용돼요.`;
    form.elements.price.focus(); return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action==='skip' && game.start(true)) { renderRound(); setFocus('#round-title'); }
  if (action==='download' || action==='share') { await shareRecord(action); return; }
  if (action==='start' && game.start()) { renderRound(); setFocus('#round-title'); }
  if (action==='lock' && game.lock()) { renderRound(); setFocus('#locked-title'); }
  if (action==='reveal' && game.reveal()) { if(game.finishedAt!==null) rememberRecord(summary(game.results)); renderRound(); setFocus('#result-title'); }
  if (action==='next' && game.next()) {
    calculator = {price:'',priceUnit:'manwon',area:'',areaUnit:'m2',households:'',result:''};
    if (game.phase==='summary') renderSummary(); else { renderRound(); setFocus('#round-title'); }
  }
  if (action==='new') newGame(`G032-${crypto.getRandomValues(new Uint32Array(1))[0]}`);
  if (action==='review') newGame(seed,summary(game.results).missed);
});
main.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id==='calc-form') {
    for (const [key,value] of new FormData(event.target)) calculator[key]=value;
    try {
      const r=game.useCalculator(calculator.price,calculator.priceUnit,calculator.area,calculator.areaUnit,pack.pyeong_m2,calculator.households);
      calculator.result=`<span>약식 단지 총액 · 힌트</span><strong>${assetText(r.approximateAsset)}</strong><span>${num(r.amount/10000,6)}억 × ${num(calculator.households)}세대</span><hr><span>전용 평당가</span><strong>${num(r.perPyeong, 6)} <small>만원/평</small></strong><span>${num(r.amount,6)}만원 ÷ ${num(r.pyeong,6)}평</span>`;
    } catch (error) { calculator.result=esc(error.message); }
    main.querySelector('#calc-result').innerHTML=calculator.result;
    main.querySelector('#calc-quota').innerHTML=quotaText();
    const button=main.querySelector('.calc-button');button.disabled=game.calculatorRemaining===0;
    if(button.disabled) button.textContent='이번 판 기회 모두 사용';
  }
});
try {
  const response=await fetch('./pack.json');
  if (!response.ok) throw Error('문제 파일을 읽지 못했어요.');
  pack=validatePack(await response.json()); game=new Game(pack,seed); intro();
} catch (error) {
  main.innerHTML=`<section class="error"><h1>문제 팩을 불러오지 못했어요.</h1><p>${esc(error.message)}</p><p>네트워크 연결을 확인한 뒤 다시 불러와 주세요. 문제가 계속되면 잠시 후 다시 시도해 주세요.</p><a href="./">다시 불러오기</a></section>`;
}
