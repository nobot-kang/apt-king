try {
  const response=await fetch('./pack.json');
  if(!response.ok) throw Error('pack unavailable');
  const pack=await response.json();
  document.querySelector('#data-date').textContent=pack.source.reference_date;
} catch {
  document.querySelector('#data-date').textContent='게임의 기준일 표시 확인';
}
