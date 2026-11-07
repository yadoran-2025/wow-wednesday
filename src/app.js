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
const emptyProblem = () => ({id:crypto.randomUUID(),title:'',lyrics:'',category:'',start:0,end:20,duration:null,source:'file',url:'',audioName:''});
let problems = [];
const saved = new Map();
let lesson = {unit:''};
const store = new WorkspaceStore();
let storageReady = false;
let revision = 0;
let durableRevision = 0;
let persistTimeout;
let saveQueue = Promise.resolve();
const audioChanges = new Map();
const rules = [
  {title:'노래를 들어요',body:'문제 구간을 듣고, 들리는 문장을\n각자의 받쓰판에 적어 보세요.'},
  {title:'함께 받아써요',body:'모둠원과 3분 동안 의논하고\n모둠의 답을 하나로 모아 보세요.'},
  {title:'힌트를 골라요',body:'초성, 랜덤 글자, 단어 힌트를 골라요.\n정답을 0.3초 동안 볼 수도 있어요.'},
  {title:'정답을 맞혀요',body:'한 번 더 듣고 최종 답을 제출해요.\n정답은 10점, 가장 가까운 답은 5점!'}
];
let selectedId;
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
let playhead = 0;
let rulesEditing = false;
let rulesPresenting = false;
let flashTimeout;
let toastTimeout;
let search = '';
const files = new Map();
const current = () => problems.find((problem) => problem.id === selectedId);
const index = () => problems.findIndex((problem) => problem.id === selectedId);
const comparable = (problem) => {if(!problem)return '';const {duration,...fields}=problem;return JSON.stringify(fields);};
const dirty = () => comparable(current()) !== comparable(saved.get(selectedId));
const button = (action, text, name='', cls='', extra='') => `<button class="${cls}" data-action="${action}" ${extra}>${name ? icon(name) : ''}${text}</button>`;

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}

function stopPlayback() { playing = false; media.pause(); }
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
    <div class="brand-group"><a class="brand" href="./index.html" aria-label="놀라운 수요일 처음으로"><span class="brand-mark" aria-hidden="true">수</span><span class="brand-name">놀라운 수요일</span></a><span class="brand-credit">by 현수토리 선생님</span></div>
    <nav class="mode-nav" aria-label="수업 모드">${[['prepare','수업 준비'],['rules','수업 규칙'],['run','수업 진행']].map(([value,label]) => `<button data-action="mode" data-mode="${value}" ${mode===value ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
    <div class="top-right"><a class="source-link" href="https://m.blog.naver.com/PostList.naver?blogId=kimhsu1" target="_blank" rel="noopener noreferrer" aria-label="출처: 현수토리 선생님 블로그 (새 탭)">출처 ${icon('external')}</a>${mode==='prepare' ? '<a class="exit-link" href="https://yadoran-2025.github.io/booong/" target="_blank" rel="noopener noreferrer">대시보드 '+icon('external')+'</a>' : ''}</div>
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
    <div class="side-foot">${icon('music')}${esc(lesson.unit || '내 수업')}</div>
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
    <div class="stage-footer"><span>${live?'잘 듣고, 함께 채워 보세요.':esc(lesson.unit || '내 수업')}</span>${live?`<span class="stage-time">${time(remaining)}</span>`:'<span class="sound-bars" aria-hidden="true"><i style="height:6px"></i><i style="height:14px"></i><i style="height:9px"></i><i style="height:16px"></i><i style="height:7px"></i></span>'}</div>
  </section>`;
}

function rangeMax(problem=current()) {return problem.duration || Math.max(120,problem.end);}
function renderWaveform() {
  const problem=current();
  const max=rangeMax(problem);
  return `<div class="waveform timeline" aria-hidden="true"><span class="timeline-track"></span><span class="wave-selection" style="left:${problem.start/max*100}%;width:${(problem.end-problem.start)/max*100}%"></span><span class="wave-playhead" style="left:${playhead/max*100}%"></span></div>`;
}

function renderSource() {
  const problem = current();
  return `${problem.source==='link' ? `<div class="link-field"><input type="url" data-field="url" aria-label="음원 링크" placeholder="YouTube 또는 직접 음원 링크" value="${esc(problem.url)}">${button('open-link','', 'external','icon-button','aria-label="음원 링크 열기"')}</div>` : `<input class="sr-only" type="file" id="audio-file" accept="audio/*,video/*"><button class="file-picker" data-action="upload">${icon('upload')}<span>${esc(problem.audioName || '음원 파일 선택')}</span></button>`}
  <div data-media-slot></div>
  <div class="wave-editor">
    <div class="wave-header"><strong id="media-duration">${problem.duration?'전체 '+time(problem.duration):'음원을 연결해 구간을 정하세요'}</strong>${button('play','',playing?'pause':'play','icon-button','aria-label="'+(playing?'구간 일시정지':'구간 재생')+'"')}</div>
    <div id="wave">${renderWaveform()}</div>
    <div class="range-row"><label class="time-control">시작 <input data-time="start" aria-label="시작 시간" value="${time(problem.start)}" inputmode="numeric"></label><label class="time-control">끝 <input data-time="end" aria-label="끝 시간" value="${time(problem.end)}" inputmode="numeric"></label></div>
    <div class="range-sliders"><input type="range" data-range="start" min="0" max="${rangeMax(problem)-1}" value="${problem.start}" aria-label="구간 시작 조절" ${problem.duration?'':'disabled'}><input type="range" data-range="end" min="1" max="${rangeMax(problem)}" value="${problem.end}" aria-label="구간 끝 조절" ${problem.duration?'':'disabled'}></div>
  </div>`;
}

function renderPrepare() {
  const problem = current();
  return `<div class="layout">${renderSidebar()}<main class="main">
    <div class="page-heading"><div><h1>오늘의 수업을 준비해요</h1><p class="lesson-line">${esc(lesson.unit || '내 수업')}</p></div><div class="heading-actions">${button('mode','수업 시작','play','primary','data-mode="run"')}</div></div>
    <div class="workspace"><section class="card editor" aria-label="문제 편집">
      <div class="card-heading"><h2>문제 편집</h2><span id="save-status" class="status ${dirty()?'dirty':''}">${dirty()?'변경사항 있음':'저장됨'}</span></div>
      <label class="field"><span class="field-label">문제 제목</span><input data-field="title" value="${esc(problem.title)}" placeholder="어떤 내용을 받아쓸까요?" ></label>
      <div class="editor-section"><div class="source-heading"><h3>음원</h3><div class="button-group" aria-label="음원 추가 방식">${['link','file'].map((source) => button('source',source==='link'?'링크':'파일','','',`data-source="${source}" aria-pressed="${problem.source===source}"`)).join('')}</div></div><div id="source-panel">${renderSource()}</div></div>
      <div class="editor-section"><label class="field"><span class="field-label">받쓰판 정답 <span id="answer-count" class="answer-count">${Array.from(problem.lyrics).filter(isLetter).length}글자</span></span><textarea data-field="lyrics" placeholder="들려줄 구간의 정답 문장을 입력하세요." >${esc(problem.lyrics)}</textarea></label></div>
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
  return `<main class="run-main"><div class="page-heading"><div><h1>함께 채우는 받쓰판</h1><p class="lesson-line">${esc(lesson.unit || '내 수업')} · ${index()+1}번째 문제</p></div><div class="heading-actions">${button('mode','문제 수정','','quiet','data-mode="prepare"')}${button('fullscreen','전체 화면','expand')}</div></div>
    <div class="run-body"><div><div id="stage">${stageMarkup(true)}</div><section class="card stage-controls" aria-label="힌트 조작"><div class="hint-options" aria-label="힌트 선택">${button('flash','0.3초 보기','bolt','',answerVisible?'disabled':'')}${button('initials',initialsVisible?'초성 가리기':'초성 보기','','',`aria-pressed="${initialsVisible}" ${canShowInitials?'':'disabled'}`)}${button('random-letter','랜덤 한 글자','','',canReveal?'':'disabled')}${button('random-word','단어 하나 공개','','',canReveal?'':'disabled')}</div><div class="hint-actions">${button('undo','힌트 되돌리기','reset','quiet',revealHistory.length && !answerVisible?'':'disabled')}${button('answer',answerVisible?'정답 다시 가리기':'정답 공개','eye','answer-button')}</div></section>
      <div class="run-navigation">${button('previous','이전 문제','left','',index()===0?'disabled':'')}<span>${index()+1} / ${problems.length} 문제</span>${button('next','다음 문제','arrow','',index()===problems.length-1?'disabled':'')}</div>
    </div><aside class="run-rail">
      <section class="card timer-card"><h2>모둠 의논 시간</h2><p class="timer-digits ${remaining===0?'ended':''}" role="timer" aria-label="남은 의논 시간">${time(remaining)}</p><div class="timer-presets" aria-label="의논 시간">${[60,180,300].map((seconds)=>button('preset',`${seconds/60}분`,'','',`data-seconds="${seconds}" aria-pressed="${timerDefault===seconds}"`)).join('')}</div><div class="timer-actions">${button('timer',timerRunning?'일시정지':'타이머 시작',timerRunning?'pause':'play','primary')}${button('timer-reset','','reset','icon-button','aria-label="타이머 초기화"')}</div></section>
      <section class="card run-player"><h2>문제 구간</h2><div class="player-info"><div class="music-icon">${icon('music')}</div><div><strong>${esc(current().audioName || current().title)}</strong><span>${time(current().start)} – ${time(current().end)}</span></div></div>${button('play',playing?'일시정지':'구간 다시 듣기',playing?'pause':'play','primary play-large')}<progress class="play-progress" max="${current().end-current().start}" value="${Math.max(0,playhead-current().start)}" aria-label="문제 구간 재생 진행"></progress><div data-media-slot></div>${current().url?button('open-link','원본 링크 열기','external','quiet'):''}</section>
    </aside></div></main>`;
}

function renderRules() {
  const cards = `<div class="rules-grid">${rules.map((rule,i)=>`<section class="card rule-card"><span class="rule-no">${String(i+1).padStart(2,'0')}</span><div class="rule-body">${rulesEditing?`<input data-rule="${i}" data-part="title" aria-label="${i+1}번 규칙 제목" value="${esc(rule.title)}" maxlength="50"><textarea data-rule="${i}" data-part="body" aria-label="${i+1}번 규칙 내용" maxlength="400">${esc(rule.body)}</textarea>`:`<h2>${esc(rule.title)}</h2><p>${esc(rule.body)}</p>`}</div></section>`).join('')}</div>`;
  return `<main class="rules-main"><div class="page-heading"><div><h1>우리 반의 수업 규칙</h1><p class="lesson-line">듣고, 의논하고, 함께 맞혀요.</p></div><div class="heading-actions">${!rulesPresenting?button('edit-rules',rulesEditing?'수정 완료':'규칙 수정'):button('present-rules','돌아가기')}${rulesEditing?'':button('present-rules',rulesPresenting?'문제 시작':'규칙 보여주기',rulesPresenting?'play':'screen','primary')}</div></div>${rulesPresenting?`<div class="rule-screen">${cards}</div>`:cards}
    </main>`;
}

function render() {
  media.park();
  $('#app').innerHTML = renderHeader() + (mode==='prepare'?renderPrepare():mode==='run'?renderRun():renderRules());
  media.mount($('[data-media-slot]'));
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
  syncMedia();
  changed();
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

async function togglePlay() {
  if (playing) {stopPlayback();renderPlayState();return;}
  try {
    if (!mediaSpec()) {notify('먼저 음원 파일을 첨부하거나 음원 링크를 입력해 주세요.');return;}
    await syncMedia();
    await media.play(current().start,current().end);
  } catch(error) {notify(error.message);}
}

function renderPlayState() {
  document.querySelectorAll('[data-action="play"]').forEach((element)=>{
    element.innerHTML=icon(playing?'pause':'play')+(element.classList.contains('play-large')?(playing?'일시정지':'구간 다시 듣기'):'');
    element.setAttribute('aria-label',playing?'구간 일시정지':'구간 재생');
  });
}

function openLink() {
  try {window.open(mediaLink(current().url).href,'_blank','noopener,noreferrer');}
  catch {notify('http:// 또는 https://로 시작하는 올바른 음원 링크를 입력해 주세요.');$('[data-field="url"]')?.focus();}
}

document.addEventListener('click',async (event)=>{
  try {
  const target=event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action=target.dataset.action;
  if(action==='mode')setMode(target.dataset.mode);
  if(action==='select')selectProblem(target.dataset.id);
  if(action==='preview'){previewAnswer=target.dataset.answer==='true';render();}
  if(action==='source'){stopPlayback();current().source=target.dataset.source;playhead=current().start;changed();syncMedia();render();}
  if(action==='play')await togglePlay();
  if(action==='open-link')openLink();
  if(action==='upload')$('#audio-file').click();
  if(action==='add'){
    const problem=emptyProblem();
    problems.push(problem);selectedId=problem.id;search='';resetStage();changed();syncMedia();render();$('[data-field="title"]').focus();
  }
  if(action==='duplicate'){
    const original=current();
    const problem={...original,id:crypto.randomUUID(),title:`${original.title || '새 문제'} (복사)`};
    const sourceFile=files.get(original.id);
    if(sourceFile){const copy={...sourceFile,url:URL.createObjectURL(sourceFile.file)};files.set(problem.id,copy);audioChanges.set(problem.id,copy);}
    problems.splice(index()+1,0,problem);selectedId=problem.id;search='';resetStage();changed();syncMedia();render();await persistNow();notify('문제를 복제했습니다.');
  }
  if(action==='delete'){
    if(!confirm(`‘${current().title || '새 문제'}’ 문제를 삭제할까요?`))return;
    const oldProblems=problems.slice(),oldId=selectedId,oldSaved=saved.get(oldId),file=files.get(oldId);
    const oldIndex=index();stopPlayback();files.delete(oldId);saved.delete(oldId);problems.splice(oldIndex,1);audioChanges.set(oldId,null);
    if(!problems.length)problems.push(emptyProblem());selectedId=problems[Math.min(oldIndex,problems.length-1)].id;
    changed();
    try {await persistNow();if(file)URL.revokeObjectURL(file.url);notify('문제를 삭제했습니다.');}
    catch {problems=oldProblems;selectedId=oldId;if(oldSaved)saved.set(oldId,oldSaved);if(file)files.set(oldId,file);audioChanges.set(oldId,file || null);return;}
    resetStage();syncMedia();render();
  }
  if(action==='save'){
    if(!current().title.trim()||!current().lyrics.trim()){
      notify('제목과 받쓰판 정답을 입력해 주세요.');$('[data-field="'+(!current().title.trim()?'title':'lyrics')+'"]').focus();return;
    }
    if(current().source==='link' && current().url){try{mediaLink(current().url);}catch(error){notify(error.message);return;}}
    const id=selectedId,previous=saved.get(id),snapshot=structuredClone(current());
    saved.set(id,snapshot);changed();
    target.disabled=true;
    try {await persistNow();notify('문제와 연결한 음원을 이 브라우저에 저장했습니다.');}
    catch {if(saved.get(id)===snapshot){if(previous)saved.set(id,previous);else saved.delete(id);}}
    finally {target.disabled=false;updateDraftUI();}
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
  if(action==='preset'){timerDefault=Number(target.dataset.seconds);remaining=timerDefault;timerRunning=false;changed();render();}
  if(action==='timer'){
    if(remaining===0)remaining=timerDefault;
    timerRunning=!timerRunning;updateTimerUI();
  }
  if(action==='timer-reset'){timerRunning=false;remaining=timerDefault;updateTimerUI();}
  if(action==='fullscreen'){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{notify('이 브라우저에서는 전체 화면 전환이 지원되지 않습니다.');}
  }
  if(action==='edit-rules'){rulesEditing=!rulesEditing;render();if(!rulesEditing)try{await persistNow();}catch{}}
  if(action==='present-rules'){
    if(rulesPresenting&&target.classList.contains('primary')){rulesPresenting=false;setMode('run');}
    else{rulesPresenting=!rulesPresenting;render();}
  }
  } catch(error) {notify(error.message || '변경 내용을 저장하지 못했습니다. 다시 시도해 주세요.');}
});

document.addEventListener('input',(event)=>{
  const target=event.target;
  if(target.id==='search'){search=target.value;$('.problem-list').innerHTML=renderList();}
  if(target.dataset.field){
    current()[target.dataset.field]=target.value;
    if(target.dataset.field==='lyrics'){revealed.clear();revealHistory=[];initialsVisible=false;answerVisible=false;}
    changed();
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
    media.setRange(problem.start,problem.end);$('#wave').innerHTML=renderWaveform();renderPlayState();updateDraftUI();changed();
  }
  if(target.dataset.rule!==undefined){rules[Number(target.dataset.rule)][target.dataset.part]=target.value;changed();}
});

document.addEventListener('change',async (event)=>{
  if(event.target.dataset.field==='url'){stopPlayback();current().duration=null;playhead=current().start;await syncMedia();}
  const target=event.target;
  if(target.dataset.time){
    const value=parseTime(target.value);
    const problem=current();
    const valid=Number.isFinite(value) && value>=0 && (target.dataset.time==='start'?value<problem.end:value>problem.start&&(!problem.duration||value<=problem.duration));
    if(!valid){notify('시작은 끝보다 빠르게, 음원 길이 안에서 분:초로 입력해 주세요.');target.value=time(problem[target.dataset.time]);return;}
    problem[target.dataset.time]=value;stopPlayback();playhead=problem.start;media.setRange(problem.start,problem.end);changed();render();
  }
  if(target.id==='audio-file'){
    const file=target.files[0];if(!file)return;
    const genericType=!file.type || file.type==='application/octet-stream';
    if(!/^(audio|video)\//.test(file.type) && !(genericType && /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|mp4|m4v|webm|mov)$/i.test(file.name))){notify('음원 또는 영상 파일을 선택해 주세요.');return;}
    const id=selectedId,url=URL.createObjectURL(file),probe=document.createElement('video');
    probe.preload='metadata';
    try {
      const duration=await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('음원 파일을 읽는 시간이 초과됐습니다.')),15000);
        probe.onloadedmetadata=()=>{clearTimeout(timeout);resolve(probe.duration);};
        probe.onerror=()=>{clearTimeout(timeout);reject(new Error('이 음원을 읽지 못했습니다. 다른 파일을 선택해 주세요.'));};
        probe.src=url;
      });
      if(!Number.isFinite(duration)||duration<=0)throw new Error('재생 가능한 길이의 음원을 선택해 주세요.');
      const problem=problems.find((item)=>item.id===id);if(!problem){URL.revokeObjectURL(url);return;}
      const previous=files.get(id),previousProblem={...problem};
      const record={file,url,name:file.name};files.set(id,record);audioChanges.set(id,record);
      problem.audioName=file.name;problem.duration=duration;problem.start=0;problem.end=Math.min(20,duration);
      changed();
      try {await persistNow();}
      catch {Object.assign(problem,previousProblem);if(previous)files.set(id,previous);else files.delete(id);audioChanges.set(id,previous || null);URL.revokeObjectURL(url);return;}
      if(selectedId===id){stopPlayback();playhead=0;syncMedia();render();}
      if(previous)URL.revokeObjectURL(previous.url);notify('음원을 첨부하고 저장했습니다.');
    }catch(error){URL.revokeObjectURL(url);notify(error.message);}
    finally {probe.onloadedmetadata=null;probe.onerror=null;probe.removeAttribute('src');probe.load();}
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
  if(!current() || !media.spec)return;
  if(playing){
    playhead=media.time;
    if(playhead>=current().end){playhead=current().end;stopPlayback();renderPlayState();}
  }
  if(media.spec.videoId && media.duration>0 && current().duration!==media.duration)applyMediaDuration(media.duration,media.spec.key);
  const head=$('.wave-playhead');if(head)head.style.left=`${playhead/rangeMax()*100}%`;
  const progress=$('.play-progress');if(progress)progress.value=Math.max(0,playhead-current().start);
},100);
document.addEventListener('fullscreenchange',()=>{const control=$('[data-action="fullscreen"]');if(control)control.innerHTML=icon('expand')+(document.fullscreenElement?'전체 화면 종료':'전체 화면');});
window.addEventListener('beforeunload',(event)=>{if(revision>durableRevision){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden && revision>durableRevision)persistNow().catch(()=>{});});

function workspaceSnapshot() {
  return structuredClone({problems,saved:[...saved],selectedId,rules,lesson,timerDefault});
}

function showStorageError(message) {
  const banner=$('#storage-error');banner.hidden=false;
  banner.replaceChildren(document.createTextNode(message+' 입력한 내용은 화면에 남아 있습니다. '));
  const retry=document.createElement('button');retry.dataset.action='retry-save';retry.textContent='다시 저장';banner.appendChild(retry);
}

function changed() {
  revision++;
  clearTimeout(persistTimeout);
  persistTimeout=setTimeout(()=>persistNow().catch(()=>{}),250);
}

function persistNow() {
  clearTimeout(persistTimeout);
  if(!storageReady)return Promise.reject(new Error('저장소를 읽지 못했습니다. 새로고침 후 다시 시도해 주세요.'));
  const snapshot=workspaceSnapshot(),changes=[...audioChanges],targetRevision=revision;
  const operation=saveQueue.catch(()=>{}).then(()=>store.save(snapshot,changes)).then(()=>{
    durableRevision=Math.max(durableRevision,targetRevision);
    for(const [id,record] of changes)if(audioChanges.get(id)===record)audioChanges.delete(id);
    $('#storage-error').hidden=true;
  }).catch((error)=>{
    showStorageError('저장 공간이 부족하거나 브라우저 저장소에 접근할 수 없어 저장하지 못했습니다.');
    throw error;
  });
  saveQueue=operation;
  return operation;
}

function mediaSpec() {
  const problem=current();if(!problem)return null;
  if(problem.source==='file'){
    const file=files.get(problem.id);if(!file)return null;
    return {key:`${problem.id}:file:${file.url}`,url:file.url,audioOnly:!file.file.type.startsWith('video/'),start:problem.start,end:problem.end};
  }
  if(!problem.url.trim())return null;
  const url=mediaLink(problem.url).href,videoId=youtubeId(url);
  return {key:`${problem.id}:link:${url}`,url,videoId,audioOnly:!videoId,start:problem.start,end:problem.end};
}

function syncMedia() {
  try {
    const promise=media.load(mediaSpec());
    media.mount($('[data-media-slot]'));
    return promise.catch(()=>{});
  }catch(error){media.load(null);notify(error.message);return Promise.resolve();}
}

function applyMediaDuration(duration,key) {
  if(!Number.isFinite(duration) || duration<=0 || key!==media.spec?.key || !current())return;
  const problem=current();
  if(problem.duration===duration)return;
  problem.duration=duration;
  if(problem.start>=duration)problem.start=0;
  problem.end=Math.min(problem.end,duration);
  if(problem.end<=problem.start)problem.end=duration;
  // Duration can arrive after playback starts; updating bounds must not re-cue it.
  media.spec.start=problem.start;media.spec.end=problem.end;
  playhead=Math.max(problem.start,Math.min(playhead,problem.end));
  const label=$('#media-duration');if(label)label.textContent='전체 '+time(duration);
  document.querySelectorAll('[data-range]').forEach((input)=>{input.max=String(input.dataset.range==='start'?Math.max(0,duration-0.01):duration);input.step='0.01';input.disabled=false;input.value=problem[input.dataset.range];});
  document.querySelectorAll('[data-time]').forEach((input)=>input.value=time(problem[input.dataset.time]));
  if($('#wave'))$('#wave').innerHTML=renderWaveform();
  updateDraftUI();changed();
}

const media=new LessonMedia({
  onState:(value)=>{playing=value;renderPlayState();},
  onDuration:applyMediaDuration,
  onError:(message)=>notify(message)
});

document.addEventListener('click',async(event)=>{
  if(event.target.closest('[data-action="retry-save"]')){
    try{await persistNow();notify('다시 저장했습니다.');}catch{}
  }
});

async function startApp() {
  $('#app').innerHTML='<main class="rules-main">저장한 문제를 불러오는 중입니다.</main>';
  try{
    const stored=await store.load();
    const imported=stored.workspace?null:await importLegacy(rules);
    const workspace=stored.workspace || imported.workspace;
    if(!Array.isArray(workspace.problems) || !Array.isArray(workspace.saved) || !Array.isArray(workspace.rules) || !workspace.rules.length)throw new Error('저장한 수업 데이터 형식을 확인해 주세요.');
    for(const problem of workspace.problems){
      if(!problem || typeof problem.id!=='string' || typeof problem.title!=='string' || typeof problem.lyrics!=='string' || !Number.isFinite(problem.start) || !Number.isFinite(problem.end) || problem.start<0 || problem.end<=problem.start || !['link','file'].includes(problem.source) || typeof problem.url!=='string' || typeof problem.audioName!=='string' || (problem.duration!==null && (!Number.isFinite(problem.duration) || problem.duration<=0)))throw new Error('저장한 문제 형식을 확인해 주세요.');
    }
    if(new Set(workspace.problems.map((problem)=>problem.id)).size!==workspace.problems.length || workspace.rules.some((rule)=>!rule || typeof rule.title!=='string' || typeof rule.body!=='string'))throw new Error('저장한 수업 데이터 형식을 확인해 주세요.');
    problems=workspace.problems;
    if(!problems.length)problems.push(emptyProblem());
    for(const [id,problem] of workspace.saved)saved.set(id,problem);
    selectedId=problems.some((problem)=>problem.id===workspace.selectedId)?workspace.selectedId:problems[0].id;
    lesson={unit:'',...workspace.lesson};
    rules.splice(0,rules.length,...workspace.rules);
    timerDefault=Math.max(10,Number(workspace.timerDefault)||180);remaining=timerDefault;
    const records=imported?[...imported.audio].map(([id,record])=>({id,blob:record.file,name:record.name})):stored.audio;
    for(const record of records){
      if(!problems.some((problem)=>problem.id===record.id))continue;
      if(!(record.blob instanceof Blob))throw new Error('저장한 음원 파일을 읽을 수 없습니다.');
      files.set(record.id,{file:record.blob,name:record.name,url:URL.createObjectURL(record.blob)});
    }
    if(imported)await store.save(workspaceSnapshot(),[...files]);
    storageReady=true;playhead=current().start;
    syncMedia();render();
  }catch(error){
    storageReady=false;
    $('#app').innerHTML=renderHeader()+`<main class="rules-main"><h1>저장한 수업을 불러오지 못했습니다</h1><p>${esc(error.message)} 기존 데이터는 삭제하지 않았습니다. 새로고침 후 다시 시도해 주세요.</p><button onclick="location.reload()">다시 불러오기</button></main>`;
    document.querySelectorAll('.mode-nav button').forEach((button)=>button.disabled=true);
  }
}
startApp();
