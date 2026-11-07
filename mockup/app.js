const $ = (selector) => document.querySelector(selector);
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  music: '<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;
const parseTime = (value) => {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};
const isLetter = (char) => /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(char);
const initialConsonant = (char) => /^[가-힣]$/u.test(char) ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor((char.codePointAt(0)-0xac00)/588)] : '';
const referenceLessons = [
  {subject:'역사',teacher:'현수토리 선생님',url:'https://blog.naver.com/kimhsu1/222817823493'},
  {subject:'사회',teacher:'초읍중 주연지 선생님',url:'https://band.us/band/61332773/post/5885'},
  {subject:'사회',teacher:'무극중 최주영 선생님',url:'https://band.us/band/61332773/post/5713'}
];
const examples = [
  {id:'manor',title:'장원과 농노의 생활',lyrics:'장원 안에서 농노는\n땅을 경작하며 살았어',start:42,end:62,duration:210,source:'link',url:'',audioName:''},
  {id:'feudal',title:'봉건 사회의 약속',lyrics:'주군은 봉토를 주고\n봉신은 충성을 맹세해',start:24,end:41,duration:185,source:'link',url:'',audioName:''},
  {id:'city',title:'도시와 상인의 성장',lyrics:'도시에 모인 상인들\n시장을 열고 교역했어',start:65,end:84,duration:198,source:'link',url:'',audioName:''}
];
let problems = structuredClone(examples);
const saved = new Map(problems.map((problem) => [problem.id, structuredClone(problem)]));
const rules = [
  {title:'노래를 들어요',body:'문제 구간을 듣고, 들리는 문장을\n각자의 받쓰판에 적어 보세요.'},
  {title:'함께 받아써요',body:'모둠원과 3분 동안 의논하고\n모둠의 답을 하나로 모아 보세요.'},
  {title:'힌트를 골라요',body:'초성, 랜덤 글자, 단어 힌트를 골라요.\n정답을 0.3초 동안 볼 수도 있어요.'},
  {title:'정답을 맞혀요',body:'한 번 더 듣고 최종 답을 제출해요.\n정답은 10점, 가장 가까운 답은 5점!'}
];
let selectedId = problems[0].id;
let mode = 'prepare';
let previewAnswer = false;
let answerVisible = false;
let revealed = new Set();
let revealHistory = [];
let initialsVisible = false;
let remaining = 180;
let timerDefault = 180;
let timerRunning = false;
let playing = false;
let playhead = problems[0].start;
let rulesEditing = false;
let rulesPresenting = false;
let flashTimeout;
let toastTimeout;
let search = '';
const files = new Map();
const audio = new Audio();
const current = () => problems.find((problem) => problem.id === selectedId);
const index = () => problems.findIndex((problem) => problem.id === selectedId);
const dirty = () => JSON.stringify(current()) !== JSON.stringify(saved.get(selectedId));
const button = (action, text, name='', cls='', extra='') => `<button class="${cls}" data-action="${action}" ${extra}>${name ? icon(name) : ''}${text}</button>`;

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}

function stopPlayback() { playing = false; audio.pause(); }
function resetStage() {
  stopPlayback();
  revealed = new Set();
  revealHistory = [];
  initialsVisible = false;
  answerVisible = false;
  timerRunning = false;
  remaining = timerDefault;
  playhead = current().start;
  clearTimeout(flashTimeout);
  if ($('#flash').open) $('#flash').close();
}

function renderHeader() {
  return `<header class="topbar">
    <div class="brand-group"><a class="brand" href="./index.html" aria-label="놀라운 수요일 목업 처음으로"><span class="brand-mark" aria-hidden="true">수</span><span class="brand-name">놀라운 수요일</span></a><span class="brand-credit">by 현수토리 선생님</span></div>
    <nav class="mode-nav" aria-label="수업 모드">${[['prepare','수업 준비'],['rules','수업 규칙'],['run','수업 진행']].map(([value,label]) => `<button data-action="mode" data-mode="${value}" ${mode===value ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
    <div class="top-right"><a class="source-link" href="https://m.blog.naver.com/PostList.naver?blogId=kimhsu1" target="_blank" rel="noopener noreferrer" aria-label="출처: 현수토리 선생님 블로그 (새 탭)">출처 ${icon('external')}</a><span class="mockup-label">클릭 목업</span>${mode==='prepare' ? '<a class="exit-link" href="https://yadoran-2025.github.io/booong/" target="_blank" rel="noopener noreferrer">대시보드 '+icon('external')+'</a>' : ''}</div>
  </header>
  <nav class="reference-bar" aria-label="문제 자료 사이트"><strong>문제 자료</strong><div class="reference-links">${referenceLessons.map((lesson)=>`<a href="${esc(lesson.url)}" target="_blank" rel="noopener noreferrer"><span class="reference-subject">${esc(lesson.subject)}</span><span>${esc(lesson.teacher)}</span>${icon('external')}</a>`).join('')}</div></nav>`;
}

function renderList() {
  const filtered = problems.filter((problem) => problem.title.includes(search));
  return filtered.map((problem) => `<button class="problem-item" data-action="select" data-id="${esc(problem.id)}" aria-current="${selectedId===problem.id}">
    <span class="problem-number">${String(problems.indexOf(problem)+1).padStart(2,'0')}</span>
    <span class="problem-copy"><strong>${esc(problem.title || '제목 없는 문제')}</strong><span>${time(problem.start)} – ${time(problem.end)} · ${problem.end-problem.start}초</span></span>
  </button>`).join('') || '<p class="empty-search">찾는 문제가 없습니다.</p>';
}

function renderSidebar() {
  return `<aside class="sidebar" aria-label="문제 목록">
    <div class="side-heading">수업 문제 <span class="count">${problems.length}개</span></div>
    <div class="search-box">${icon('search')}<input id="search" aria-label="문제 검색" placeholder="문제 검색" value="${esc(search)}"></div>
    <div class="problem-list">${renderList()}</div>
    ${button('add','새 문제','plus','new-problem')}
    <div class="side-foot">${icon('music')}중세 서유럽 사회</div>
  </aside>`;
}

function renderBoard(answer=false, interactive=false) {
  const lyrics = current().lyrics;
  if (!lyrics.trim()) return '<p class="board-empty">문장을 입력하면<br>받쓰판이 만들어져요.</p>';
  let charIndex = 0;
  let number = 0;
  return lyrics.split('\n').map((line) => {
    const row = `<div class="board-line">${line.split(/(\s+)/).map((word) => {
    if (/^\s+$/.test(word)) {charIndex += Array.from(word).length; return '';}
    return `<span class="word">${Array.from(word).map((char) => {
      const position = charIndex++;
      if (!isLetter(char)) return `<span>${esc(char)}</span>`;
      number++;
      const open = answer || (interactive && revealed.has(position));
      const initial = !open && interactive && initialsVisible ? initialConsonant(char) : '';
      return `<button class="tile ${open?'open':initial?'initial':''}" ${interactive && !open ? `data-action="letter" data-index="${position}" aria-label="${number}번째 글자${initial?' 초성 '+initial+',':''} 공개"` : 'disabled'}>${open?esc(char):initial || number}</button>`;
    }).join('')}</span>`;
    }).join('')}</div>`;
    charIndex++;
    return row;
  }).join('');
}

function stageMarkup(live=false) {
  return `<section class="preview-stage ${live?'live-stage':''}" aria-label="${live?'수업 받쓰판':'학생 화면 미리보기'}">
    <div class="stage-top"><span class="stage-brand">놀라운 수요일</span><span class="stage-round">${String(index()+1).padStart(2,'0')} / ${String(problems.length).padStart(2,'0')}</span></div>
    <h2 class="stage-problem-title">${esc(current().title || '새 문제')}</h2>
    <div class="board">${renderBoard(live?answerVisible:previewAnswer,live)}</div>
    <div class="stage-footer"><span>${live?'잘 듣고, 함께 채워 보세요.':'중세 서유럽 사회'}</span>${live?`<span class="stage-time">${time(remaining)}</span>`:'<span class="sound-bars" aria-hidden="true"><i style="height:6px"></i><i style="height:14px"></i><i style="height:9px"></i><i style="height:16px"></i><i style="height:7px"></i></span>'}</div>
  </section>`;
}

function renderWaveform() {
  const problem = current();
  return `<div class="waveform" aria-hidden="true">${Array.from({length:74},(_,i)=>`<i class="${i/74>=problem.start/problem.duration && i/74<=problem.end/problem.duration?'selected-wave':''}" style="height:${7+((i*17+Math.floor(i/4)*11)%34)}px"></i>`).join('')}
    <span class="wave-selection" style="left:${problem.start/problem.duration*100}%;width:${(problem.end-problem.start)/problem.duration*100}%"></span>
    <span class="wave-playhead" style="left:${playhead/problem.duration*100}%"></span>
  </div>`;
}

function renderSource() {
  const problem = current();
  return `${problem.source==='link' ? `<div class="link-field"><input type="url" data-field="url" aria-label="음원 링크" placeholder="YouTube 또는 음원 링크 붙여넣기" value="${esc(problem.url)}">${button('open-link','', 'external','icon-button','aria-label="음원 링크 열기"')}</div>` : `<input class="sr-only" type="file" id="audio-file" accept="audio/*,video/*"><button class="file-picker" data-action="upload">${icon('upload')}<span>${esc(problem.audioName || '음원 파일 선택')}</span></button>`}
  <div class="wave-editor">
    <div class="wave-header"><strong>${files.has(problem.id)&&problem.source==='file' ? '첨부 음원 · 파형은 예시' : '예시 음원 · 무음 시뮬레이션'}</strong>${button('play','',playing?'pause':'play','icon-button','aria-label="'+(playing?'구간 일시정지':'구간 재생')+'"')}</div>
    <div id="wave">${renderWaveform()}</div>
    <div class="range-row"><label class="time-control">시작 <input data-time="start" aria-label="시작 시간" value="${time(problem.start)}" inputmode="numeric"></label><label class="time-control">끝 <input data-time="end" aria-label="끝 시간" value="${time(problem.end)}" inputmode="numeric"></label></div>
    <div class="range-sliders"><input type="range" data-range="start" min="0" max="${problem.duration-1}" value="${problem.start}" aria-label="구간 시작 조절"><input type="range" data-range="end" min="1" max="${problem.duration}" value="${problem.end}" aria-label="구간 끝 조절"></div>
  </div>`;
}

function renderPrepare() {
  const problem = current();
  return `<div class="layout">${renderSidebar()}<main class="main">
    <div class="page-heading"><div><h1>오늘의 수업을 준비해요</h1><p class="lesson-line"><span>예시 수업</span> · 중세 서유럽 사회</p></div><div class="heading-actions">${button('mode','수업 시작','play','primary','data-mode="run"')}</div></div>
    <div class="workspace"><section class="card editor" aria-label="문제 편집">
      <div class="card-heading"><h2>문제 편집</h2><span id="save-status" class="status ${dirty()?'dirty':''}">${dirty()?'변경사항 있음':'저장됨'}</span></div>
      <label class="field"><span class="field-label">문제 제목</span><input data-field="title" value="${esc(problem.title)}" placeholder="어떤 내용을 받아쓸까요?" maxlength="60"></label>
      <div class="editor-section"><div class="source-heading"><h3>음원</h3><div class="button-group" aria-label="음원 추가 방식">${['link','file'].map((source) => button('source',source==='link'?'링크':'파일','','',`data-source="${source}" aria-pressed="${problem.source===source}"`)).join('')}</div></div><div id="source-panel">${renderSource()}</div></div>
      <div class="editor-section"><label class="field"><span class="field-label">받쓰판 정답 <span id="answer-count" class="answer-count">${Array.from(problem.lyrics).filter(isLetter).length}글자</span></span><textarea data-field="lyrics" placeholder="들려줄 구간의 정답 문장을 입력하세요." maxlength="160">${esc(problem.lyrics)}</textarea></label></div>
      <div class="editor-actions"><div class="editor-actions-left">${button('duplicate','복제','copy','quiet')}${button('delete','삭제','trash','quiet danger')}</div>${button('save','문제 저장','check','primary')}</div>
    </section><div class="preview-column">
      <div class="preview-top"><span class="preview-title">${icon('screen')}학생 화면 미리보기</span><div class="button-group" aria-label="미리보기 내용">${button('preview','받쓰판','','',`data-answer="false" aria-pressed="${!previewAnswer}"`)}${button('preview','정답','','',`data-answer="true" aria-pressed="${previewAnswer}"`)}</div></div>
      <div id="stage">${stageMarkup()}</div>
    </div></div>
  </main></div>`;
}

function renderRun() {
  const hidden = letterGroups().flat().filter((position)=>!revealed.has(position));
  const canReveal = !answerVisible && hidden.length > 0;
  const canShowInitials = !answerVisible && (initialsVisible || hidden.some((position)=>initialConsonant(Array.from(current().lyrics)[position])));
  return `<main class="run-main"><div class="page-heading"><div><h1>함께 채우는 받쓰판</h1><p class="lesson-line">중세 서유럽 사회 · ${index()+1}번째 문제</p></div><div class="heading-actions">${button('mode','문제 수정','','quiet','data-mode="prepare"')}${button('fullscreen','전체 화면','expand')}</div></div>
    <div class="run-body"><div><div id="stage">${stageMarkup(true)}</div><section class="card stage-controls" aria-label="힌트 조작"><div class="hint-options" aria-label="힌트 선택">${button('flash','0.3초 보기','bolt','',answerVisible?'disabled':'')}${button('initials',initialsVisible?'초성 가리기':'초성 보기','','',`aria-pressed="${initialsVisible}" ${canShowInitials?'':'disabled'}`)}${button('random-letter','랜덤 한 글자','','',canReveal?'':'disabled')}${button('random-word','단어 하나 공개','','',canReveal?'':'disabled')}</div><div class="hint-actions">${button('undo','힌트 되돌리기','reset','quiet',revealHistory.length && !answerVisible?'':'disabled')}${button('answer',answerVisible?'정답 다시 가리기':'정답 공개','eye','answer-button')}</div></section>
      <div class="run-navigation">${button('previous','이전 문제','left','',index()===0?'disabled':'')}<span>${index()+1} / ${problems.length} 문제</span>${button('next','다음 문제','arrow','',index()===problems.length-1?'disabled':'')}</div>
    </div><aside class="run-rail">
      <section class="card timer-card"><h2>모둠 의논 시간</h2><p class="timer-digits ${remaining===0?'ended':''}" role="timer" aria-label="남은 의논 시간">${time(remaining)}</p><div class="timer-presets" aria-label="의논 시간">${[60,180,300].map((seconds)=>button('preset',`${seconds/60}분`,'','',`data-seconds="${seconds}" aria-pressed="${timerDefault===seconds}"`)).join('')}</div><div class="timer-actions">${button('timer',timerRunning?'일시정지':'타이머 시작',timerRunning?'pause':'play','primary')}${button('timer-reset','','reset','icon-button','aria-label="타이머 초기화"')}</div></section>
      <section class="card run-player"><h2>문제 구간</h2><div class="player-info"><div class="music-icon">${icon('music')}</div><div><strong>${esc(current().audioName || current().title)}</strong><span>${time(current().start)} – ${time(current().end)}</span></div></div>${button('play',playing?'일시정지':'구간 다시 듣기',playing?'pause':'play','primary play-large')}<progress class="play-progress" max="${current().end-current().start}" value="${Math.max(0,playhead-current().start)}" aria-label="문제 구간 재생 진행"></progress><p class="simulation-note">${files.has(selectedId)&&current().source==='file'?'첨부한 음원 재생':current().url?'목업 재생은 무음 시뮬레이션입니다.':'예시 음원 · 무음 시뮬레이션'}</p>${current().url?button('open-link','원본 링크 열기','external','quiet'):''}</section>
    </aside></div></main>`;
}

function renderRules() {
  const cards = `<div class="rules-grid">${rules.map((rule,i)=>`<section class="card rule-card"><span class="rule-no">${String(i+1).padStart(2,'0')}</span><div class="rule-body">${rulesEditing?`<input data-rule="${i}" data-part="title" aria-label="${i+1}번 규칙 제목" value="${esc(rule.title)}" maxlength="50"><textarea data-rule="${i}" data-part="body" aria-label="${i+1}번 규칙 내용" maxlength="400">${esc(rule.body)}</textarea>`:`<h2>${esc(rule.title)}</h2><p>${esc(rule.body)}</p>`}</div></section>`).join('')}</div>`;
  return `<main class="rules-main"><div class="page-heading"><div><h1>우리 반의 수업 규칙</h1><p class="lesson-line">듣고, 의논하고, 함께 맞혀요.</p></div><div class="heading-actions">${!rulesPresenting?button('edit-rules',rulesEditing?'수정 완료':'규칙 수정'):button('present-rules','돌아가기')}${rulesEditing?'':button('present-rules',rulesPresenting?'문제 시작':'규칙 보여주기',rulesPresenting?'play':'screen','primary')}</div></div>${rulesPresenting?`<div class="rule-screen">${cards}</div>`:cards}
    </main>`;
}

function render() {
  $('#app').innerHTML = renderHeader() + (mode==='prepare'?renderPrepare():mode==='run'?renderRun():renderRules());
}

function updateDraftUI() {
  const status = $('#save-status');
  if (status) {status.textContent = dirty()?'변경사항 있음':'저장됨';status.classList.toggle('dirty',dirty());}
  if ($('#answer-count')) $('#answer-count').textContent = `${Array.from(current().lyrics).filter(isLetter).length}글자`;
  if ($('#stage')) $('#stage').innerHTML = stageMarkup(mode==='run');
  if ($('.problem-list')) $('.problem-list').innerHTML = renderList();
}

function setMode(next) {
  if (next==='run' && (!current().title.trim() || !current().lyrics.trim())) {
    notify('제목과 받쓰판 정답을 입력해 주세요.');
    const field = $('[data-field="'+(!current().title.trim()?'title':'lyrics')+'"]');
    field?.focus();
    return;
  }
  stopPlayback();
  timerRunning = false;
  mode = next;
  render();
}

function selectProblem(id) {
  if (id===selectedId) return;
  selectedId = id;
  resetStage();
  render();
}

function letterGroups() {
  const groups = [];
  let word = [];
  Array.from(current().lyrics).forEach((char, position)=>{
    if (/\s/u.test(char)) {
      if (word.length) groups.push(word);
      word = [];
    } else if (isLetter(char)) word.push(position);
  });
  if (word.length) groups.push(word);
  return groups;
}

function revealLetters(positions) {
  const added = positions.filter((position)=>!revealed.has(position));
  if (!added.length) return;
  added.forEach((position)=>revealed.add(position));
  revealHistory.push({type:'letters',positions:added});
}

function undoHint() {
  const previous = revealHistory.pop();
  if (previous?.type==='letters') previous.positions.forEach((position)=>revealed.delete(position));
  if (previous?.type==='initials') initialsVisible = previous.visible;
}

function togglePlay() {
  if (playing) {stopPlayback();renderPlayState();return;}
  const file = files.get(selectedId);
  if (current().source==='file' && file) {
    if (audio.src!==file.url) audio.src = file.url;
    if (playhead<current().start || playhead>=current().end) playhead=current().start;
    audio.currentTime = playhead;
    audio.play().then(()=>{playing=true;renderPlayState();}).catch(()=>notify('음원을 재생하지 못했습니다. 다른 파일을 선택해 주세요.'));
  } else {
    if (playhead>=current().end) playhead=current().start;
    playing=true;
    renderPlayState();
  }
}

function renderPlayState() {
  document.querySelectorAll('[data-action="play"]').forEach((element)=>{
    element.innerHTML=icon(playing?'pause':'play')+(element.classList.contains('play-large')?(playing?'일시정지':'구간 다시 듣기'):'');
    element.setAttribute('aria-label',playing?'구간 일시정지':'구간 재생');
  });
}

function openLink() {
  let url;
  try {url=new URL(current().url);if(!['https:','http:'].includes(url.protocol))throw Error();}
  catch {notify('https://로 시작하는 올바른 음원 링크를 입력해 주세요.');$('[data-field="url"]')?.focus();return;}
  window.open(url.href,'_blank','noopener,noreferrer');
}

document.addEventListener('click',async (event)=>{
  const target=event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action=target.dataset.action;
  if(action==='mode')setMode(target.dataset.mode);
  if(action==='select')selectProblem(target.dataset.id);
  if(action==='preview'){previewAnswer=target.dataset.answer==='true';render();}
  if(action==='source'){stopPlayback();current().source=target.dataset.source;render();}
  if(action==='play')togglePlay();
  if(action==='open-link')openLink();
  if(action==='upload')$('#audio-file').click();
  if(action==='add'){
    const problem={id:crypto.randomUUID(),title:'',lyrics:'',start:0,end:20,duration:180,source:'link',url:'',audioName:''};
    problems.push(problem);selectedId=problem.id;search='';resetStage();render();$('[data-field="title"]').focus();
  }
  if(action==='duplicate'){
    const original=current();
    const problem={...original,id:crypto.randomUUID(),title:`${original.title || '새 문제'} (복사)`};
    const sourceFile=files.get(original.id);
    if(sourceFile)files.set(problem.id,{url:URL.createObjectURL(sourceFile.file),file:sourceFile.file});
    problems.splice(index()+1,0,problem);selectedId=problem.id;search='';resetStage();render();notify('문제를 복제했습니다.');
  }
  if(action==='delete'){
    if(problems.length===1){notify('수업에 사용할 문제를 하나 이상 남겨 주세요.');return;}
    if(!confirm(`‘${current().title || '새 문제'}’ 문제를 삭제할까요?`))return;
    const oldIndex=index();
    const file=files.get(selectedId);
    if(file)URL.revokeObjectURL(file.url);
    files.delete(selectedId);saved.delete(selectedId);problems.splice(oldIndex,1);selectedId=problems[Math.min(oldIndex,problems.length-1)].id;
    resetStage();render();notify('문제를 삭제했습니다.');
  }
  if(action==='save'){
    if(!current().title.trim()||!current().lyrics.trim()){
      notify('제목과 받쓰판 정답을 입력해 주세요.');$('[data-field="'+(!current().title.trim()?'title':'lyrics')+'"]').focus();return;
    }
    saved.set(selectedId,structuredClone(current()));updateDraftUI();notify('목업에 저장했습니다. 새로고침하면 초기화됩니다.');
  }
  if(action==='previous'&&index()>0)selectProblem(problems[index()-1].id);
  if(action==='next'&&index()<problems.length-1)selectProblem(problems[index()+1].id);
  if(action==='letter'){
    const position=Number(target.dataset.index);revealLetters([position]);render();
    const next=$(`[data-action="letter"][data-index="${position+1}"]`)||$('[data-action="undo"]');next?.focus({preventScroll:true});
  }
  if(action==='initials'){
    revealHistory.push({type:'initials',visible:initialsVisible});initialsVisible=!initialsVisible;render();$('[data-action="initials"]').focus({preventScroll:true});
  }
  if(action==='random-letter'||action==='random-word'){
    const groups = letterGroups().filter((group)=>group.some((position)=>!revealed.has(position)));
    const choices = action==='random-letter' ? groups.flat().filter((position)=>!revealed.has(position)).map((position)=>[position]) : groups;
    if(choices.length)revealLetters(choices[Math.floor(Math.random()*choices.length)]);
    render();const control=$(`[data-action="${action}"]`);(control.disabled?$('[data-action="undo"]'):control).focus({preventScroll:true});
  }
  if(action==='undo'){undoHint();render();$('[data-action="undo"]')?.focus({preventScroll:true});}
  if(action==='flash'){
    clearTimeout(flashTimeout);$('#flash p').textContent=current().lyrics;$('#flash').showModal();flashTimeout=setTimeout(()=>$('#flash').close(),300);
  }
  if(action==='answer'){
    if(answerVisible){answerVisible=false;render();}
    else $('#answer-confirm').showModal();
  }
  if(action==='cancel-answer')$('#answer-confirm').close();
  if(action==='confirm-answer'){answerVisible=true;$('#answer-confirm').close();render();$('[data-action="answer"]').focus({preventScroll:true});}
  if(action==='preset'){timerDefault=Number(target.dataset.seconds);remaining=timerDefault;timerRunning=false;render();}
  if(action==='timer'){
    if(remaining===0)remaining=timerDefault;
    timerRunning=!timerRunning;updateTimerUI();
  }
  if(action==='timer-reset'){timerRunning=false;remaining=timerDefault;updateTimerUI();}
  if(action==='fullscreen'){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{notify('이 브라우저에서는 전체 화면 전환이 지원되지 않습니다.');}
  }
  if(action==='edit-rules'){rulesEditing=!rulesEditing;render();}
  if(action==='present-rules'){
    if(rulesPresenting&&target.classList.contains('primary')){rulesPresenting=false;setMode('run');}
    else{rulesPresenting=!rulesPresenting;render();}
  }
});

document.addEventListener('input',(event)=>{
  const target=event.target;
  if(target.id==='search'){search=target.value;$('.problem-list').innerHTML=renderList();}
  if(target.dataset.field){
    current()[target.dataset.field]=target.value;
    if(target.dataset.field==='lyrics'){revealed.clear();revealHistory=[];initialsVisible=false;answerVisible=false;}
    updateDraftUI();
  }
  if(target.dataset.range){
    stopPlayback();
    const problem=current();
    if(target.dataset.range==='start')problem.start=Math.min(Number(target.value),problem.end-1);
    else problem.end=Math.max(Number(target.value),problem.start+1);
    playhead=problem.start;
    document.querySelectorAll('[data-time]').forEach((input)=>input.value=time(problem[input.dataset.time]));
    document.querySelectorAll('[data-range]').forEach((input)=>input.value=problem[input.dataset.range]);
    $('#wave').innerHTML=renderWaveform();renderPlayState();updateDraftUI();
  }
  if(target.dataset.rule!==undefined)rules[Number(target.dataset.rule)][target.dataset.part]=target.value;
});

document.addEventListener('change',(event)=>{
  const target=event.target;
  if(target.dataset.time){
    const value=parseTime(target.value);
    const problem=current();
    const valid=Number.isFinite(value) && value>=0 && (target.dataset.time==='start'?value<problem.end:value>problem.start&&value<=problem.duration);
    if(!valid){notify('시작은 끝보다 빠르게, 음원 길이 안에서 분:초로 입력해 주세요.');target.value=time(problem[target.dataset.time]);return;}
    problem[target.dataset.time]=value;stopPlayback();playhead=problem.start;render();
  }
  if(target.id==='audio-file'){
    const file=target.files[0];
    if(!file)return;
    if(!/^(audio|video)\//.test(file.type)){notify('음원 또는 영상 파일을 선택해 주세요.');return;}
    const id=selectedId;
    const url=URL.createObjectURL(file);
    const probe=new Audio();
    probe.preload='metadata';
    const release=()=>{probe.removeAttribute('src');probe.load();};
    probe.addEventListener('loadedmetadata',()=>{
      const duration=Math.floor(probe.duration);
      if(!Number.isFinite(duration)||duration<1){URL.revokeObjectURL(url);release();notify('재생 가능한 길이의 음원을 선택해 주세요.');return;}
      const problem=problems.find((item)=>item.id===id);
      if(!problem){URL.revokeObjectURL(url);release();return;}
      const previous=files.get(id);if(previous)URL.revokeObjectURL(previous.url);
      files.set(id,{file,url});problem.audioName=file.name;problem.duration=duration;problem.start=0;problem.end=Math.min(20,duration);
      release();if(selectedId===id){stopPlayback();playhead=0;render();}notify('음원을 연결했습니다. 파형 그림은 예시입니다.');
    },{once:true});
    probe.addEventListener('error',()=>{URL.revokeObjectURL(url);release();notify('이 파일을 읽지 못했습니다. 다른 음원을 선택해 주세요.');},{once:true});
    probe.src=url;
  }
});

function updateTimerUI() {
  document.querySelectorAll('.timer-digits,.stage-time').forEach((element)=>{element.textContent=time(remaining);element.classList.toggle('ended',remaining===0);});
  const control=$('[data-action="timer"]');
  if(control)control.innerHTML=icon(timerRunning?'pause':'play')+(timerRunning?'일시정지':'타이머 시작');
}

// Update only time and playback indicators so hints and audio never rebuild on a timer tick.
setInterval(()=>{
  if(timerRunning){remaining=Math.max(0,remaining-1);if(remaining===0){timerRunning=false;notify('의논 시간이 끝났습니다.');}updateTimerUI();}
},1000);
setInterval(()=>{
  if(!playing)return;
  playhead=current().source==='file'&&files.has(selectedId)?audio.currentTime:playhead+0.1;
  if(playhead>=current().end){playhead=current().end;stopPlayback();renderPlayState();}
  const head=$('.wave-playhead');if(head)head.style.left=`${playhead/current().duration*100}%`;
  const progress=$('.play-progress');if(progress)progress.value=playhead-current().start;
},100);
audio.addEventListener('error',()=>{stopPlayback();renderPlayState();notify('음원 재생 중 오류가 발생했습니다. 파일을 다시 선택해 주세요.');});
audio.addEventListener('ended',()=>{stopPlayback();renderPlayState();});
document.addEventListener('fullscreenchange',()=>{const control=$('[data-action="fullscreen"]');if(control)control.innerHTML=icon('expand')+(document.fullscreenElement?'전체 화면 종료':'전체 화면');});
window.addEventListener('beforeunload',()=>files.forEach((file)=>URL.revokeObjectURL(file.url)));
render();
