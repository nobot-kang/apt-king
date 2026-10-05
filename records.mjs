export const GAME_NAME = '내가 왕이 될 상인가?';
export const GAME_URL = 'https://nobot-kang.github.io/apt-king/';
export const STORAGE_KEY = 'apt-king.records.v1';
export const MAX_RECORDS = 100;
export const modeLabel = mode => mode === 'hard' ? '어려움' : '쉬움';
export const mascotMood = score => score >= 100 ? 'smile' : score >= 50 ? 'neutral' : 'sad';
export const mascotPath = score => `./assets/mascot-${mascotMood(score)}.png`;
export const mascotAlt = score => score >= 100 ? '활짝 웃는 펭귄 마스코트' : score >= 50 ? '평범한 표정의 펭귄 마스코트' : '시무룩한 펭귄 마스코트';
export function formatTime(seconds) {
  const whole = Math.floor(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}분 ${String(whole % 60).padStart(2,'0')}초`;
}
export function validRecord(r) {
  return Boolean(r && typeof r.id==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(r.id) &&
    Number.isInteger(r.score) && r.score>=0 && r.score<=100 &&
    Number.isInteger(r.totalCorrect) && r.totalCorrect>=0 && r.totalCorrect<=5 &&
    Number.isInteger(r.unitCorrect) && r.unitCorrect>=0 && r.unitCorrect<=5 &&
    r.score===10*(r.totalCorrect+r.unitCorrect) && Number.isSafeInteger(r.elapsedSeconds) && r.elapsedSeconds>=0 &&
    ['easy','hard'].includes(r.gameMode) && ['normal','review'].includes(r.mode) && typeof r.createdAt==='string' && Number.isFinite(Date.parse(r.createdAt)) &&
    typeof r.packVersion==='string' && typeof r.seed==='string' && Array.isArray(r.roundIds) && r.roundIds.length===5 && r.roundIds.every(x=>typeof x==='string'));
}
export function rankRecords(records) {
  return [...records].filter(validRecord).sort((a,b)=>Number(a.gameMode==='hard')-Number(b.gameMode==='hard') || Number(a.mode==='review')-Number(b.mode==='review') || b.score-a.score || a.elapsedSeconds-b.elapsedSeconds || b.createdAt.localeCompare(a.createdAt));
}
export function loadRecords(storage) {
  try {
    const raw=storage.getItem(STORAGE_KEY);
    if(!raw) return {records:[],warning:''};
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) throw Error('invalid');
    // Preserve older local scores while discarding their subsecond precision.
    let migrated=false;
    const data=parsed.map(r=>{
      if(r && Number.isSafeInteger(r.elapsedMs) && r.elapsedMs>=0) {
        const {elapsedMs,...rest}=r;migrated=true;
        r={...rest,elapsedSeconds:rest.elapsedSeconds ?? Math.floor(elapsedMs/1000)};
      }
      if(r && r.gameMode===undefined) {migrated=true;r={...r,gameMode:'easy'};}
      return r;
    });
    if(!data.every(validRecord)) throw Error('invalid');
    const unique=[...new Map(data.map(r=>[r.id,r])).values()];
    const records=rankRecords(unique).slice(0,MAX_RECORDS);
    let warning='';
    if(migrated) {
      try {storage.setItem(STORAGE_KEY,JSON.stringify(records));}
      catch {warning='변환된 기록을 저장하지 못했어요. 현재 화면에서는 변환된 기록을 확인할 수 있어요.';}
    }
    return {records,warning};
  } catch {
    return {records:[],warning:'저장된 기록을 읽지 못했어요. 이번 기록은 현재 화면에서 확인할 수 있어요.'};
  }
}
export function saveRecord(records, record, storage) {
  if(!validRecord(record)) throw Error('완료된 5판 기록만 저장할 수 있어요.');
  const ranked=rankRecords([...records.filter(r=>r.id!==record.id),record]);
  const retained=new Map([[record.id,record]]);
  for(const gameMode of ['easy','hard']) for(const mode of ['normal','review']) {
    const best=ranked.find(r=>r.gameMode===gameMode && r.mode===mode);
    if(best) retained.set(best.id,best);
  }
  for(const r of ranked) {if(retained.size>=MAX_RECORDS) break;retained.set(r.id,r);}
  const result=rankRecords([...retained.values()]);
  try { storage.setItem(STORAGE_KEY,JSON.stringify(result)); return {records:result,warning:''}; }
  catch { return {records:result,warning:'브라우저 저장 공간에 기록하지 못했어요. 이 화면을 닫기 전에 기록 이미지를 내려받아 주세요.'}; }
}
export function shareText(record) {
  const promo = record.gameMode==='hard'
    ? '가격표를 가리고, 안목으로 왕관을 겨루다. 입지와 규모를 읽는 다섯 번의 선택—당신의 부동산 감각도 도전해 보세요!'
    : '단지 총액 왕과 평당가 왕, 5판으로 내 집값 감각을 확인해 보세요. 계산기는 판당 딱 2번!';
  return `${GAME_NAME}\n[${modeLabel(record.gameMode)}${record.mode==='review'?' · 복습':''}] 나는 ${record.score}/100점 · ${formatTime(record.elapsedSeconds)}!\n${promo}\n${GAME_URL}`;
}
export async function recordImage(record) {
  if(!validRecord(record)) throw Error('기록을 확인해 주세요.');
  await document.fonts.ready;
  const mascot=new Image(); mascot.src=new URL(mascotPath(record.score),import.meta.url).href;
  await mascot.decode();
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=650;
  const ctx=canvas.getContext('2d');
  const hard=record.gameMode==='hard';
  const ink=hard?'#fff4d6':'#172e31', muted=hard?'#c9c9e7':'#526362', accent=hard?'#ffdb7d':'#17635b';
  if(hard) {
    const bg=ctx.createLinearGradient(0,0,1000,650);
    bg.addColorStop(0,'#111b3d');bg.addColorStop(.55,'#34225d');bg.addColorStop(1,'#123c4b');
    ctx.fillStyle=bg;ctx.fillRect(0,0,1000,650);
    ctx.strokeStyle='#caaa61';ctx.lineWidth=2;ctx.strokeRect(20,20,960,610);
    ctx.save();ctx.translate(765,272);
    for(let i=0;i<18;i++) {ctx.rotate(Math.PI/9);ctx.strokeStyle='#ffffff16';ctx.beginPath();ctx.moveTo(170,0);ctx.lineTo(290,0);ctx.stroke();}
    ctx.strokeStyle='#eccc7866';ctx.lineWidth=2;
    for(const radius of [188,205]){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    for(const [x,y] of [[548,99],[911,121],[930,411],[524,379]]) {
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x+3,y-2);ctx.lineTo(x+8,y);ctx.lineTo(x+3,y+2);ctx.lineTo(x,y+7);ctx.lineTo(x-3,y+2);ctx.lineTo(x-8,y);ctx.lineTo(x-3,y-2);ctx.closePath();ctx.fill();
    }
  } else {
    ctx.fillStyle='#f7f6f0';ctx.fillRect(0,0,1000,650);
    ctx.fillStyle=ink;ctx.fillRect(0,0,1000,12);
  }
  const text=(content,x,y,size,color=ink,weight='700')=>{
    ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;ctx.fillText(content,x,y);
  };
  text(GAME_NAME,52,83,36);
  text(`${modeLabel(record.gameMode)} · ${record.mode==='review'?'복습 기록':'도전 기록'}${hard?'  /  가격표 없는 승부':''}`,54,137,19,muted);
  text(String(record.score),46,292,126,accent);text('/ 100점',315,285,34,muted);
  text(formatTime(record.elapsedSeconds),54,353,38);
  text(`총액 왕 ${record.totalCorrect}/5  ·  평당가 왕 ${record.unitCorrect}/5`,54,410,24);
  ctx.drawImage(mascot,580,100,370,370);
  ctx.strokeStyle=hard?'#caaa61':'#d6ddd6';ctx.beginPath();ctx.moveTo(52,468);ctx.lineTo(948,468);ctx.stroke();
  text(hard?'가격표 너머의 가치를 읽다.':'단지의 규모와 한 평의 가격은 별개의 축!',54,511,24);
  text(hard?'단지의 규모와 입지, 당신의 안목으로 왕관에 도전하세요.':'나도 왕이 될 상인지, 5판으로 확인해 보세요.',54,548,20,muted);
  text(GAME_URL,54,588,21,accent);
  const date=new Date(record.createdAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});
  text(date,54,618,15,muted,'400');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지를 만들지 못했어요.')),'image/png'));
}
