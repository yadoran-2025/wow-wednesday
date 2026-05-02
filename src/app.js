const STORAGE_KEY = "wow-wednesday-maker-v4";

const phaseLabels = [
  { mode: "make", label: "제작하기" },
  { mode: "run", label: "진행하기" },
];

const revealLabels = {
  blank: "받쓰판",
  letterPick: "한 글자 보기",
  spacing: "띄어쓰기 보기",
  answer: "정답 공개",
};

let problemLibrary = [];
let problemLibraryStatus = "loading";
let problemLibraryError = "";

const defaultState = {
  mode: "make",
  selectedProblemId: "",
  flashVisible: false,
  flashToken: 0,
  timer: {
    remaining: 90,
    defaultSeconds: 90,
    running: false,
  },
  lesson: {
    title: "놀라운 수요일",
    unit: "중세 서유럽 사회",
    songUrl: "https://www.youtube.com/watch?v=IR-YUXrNyn0",
  },
  revealed: {
    spacing: false,
    answer: false,
  },
  revealedChars: {},
};

let state = loadState();
let timerId = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone(defaultState);
    return normalizeState(JSON.parse(stored));
  } catch {
    return clone(defaultState);
  }
}

function normalizeState(value) {
  const next = { ...clone(defaultState), ...value };
  next.lesson = { ...clone(defaultState.lesson), ...(value.lesson || {}) };
  next.revealed = { ...clone(defaultState.revealed), ...(value.revealed || {}) };
  next.revealedChars = value.revealedChars || {};
  next.timer = { ...clone(defaultState.timer), ...(value.timer || {}) };
  next.selectedProblemId = value.selectedProblemId || "";
  next.mode = next.mode === "run" ? "run" : "make";
  return next;
}

async function loadProblemLibrary() {
  problemLibraryStatus = "loading";
  try {
    const response = await fetch("./data/problems.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("문제 JSON은 배열이어야 합니다.");

    problemLibrary = data.map(normalizeProblem).filter(Boolean);
    problemLibraryStatus = "ready";
    problemLibraryError = "";

    if (!problemLibrary.some((problem) => problem.id === state.selectedProblemId)) {
      state.selectedProblemId = problemLibrary[0]?.id || "";
      clearReveals(state);
      saveState();
    }
  } catch (error) {
    problemLibrary = [];
    problemLibraryStatus = "error";
    problemLibraryError = error?.message || "문제 JSON을 불러오지 못했습니다.";
  }
  render();
}

function normalizeProblem(problem, index) {
  if (!problem || typeof problem !== "object") return null;
  return {
    id: String(problem.id || `problem-${index + 1}`),
    category: String(problem.category || "분류 없음"),
    title: String(problem.title || `문제 ${index + 1}`),
    timeRange: String(problem.timeRange || ""),
    lyrics: String(problem.lyrics || ""),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(updater) {
  updater(state);
  if (!problemLibrary.some((problem) => problem.id === state.selectedProblemId)) {
    state.selectedProblemId = problemLibrary[0]?.id || "";
  }
  saveState();
  render();
}

function selectedProblemIndex() {
  return Math.max(0, problemLibrary.findIndex((problem) => problem.id === state.selectedProblemId));
}

function currentProblem() {
  return problemLibrary[selectedProblemIndex()] || null;
}

function isWordChar(char) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/.test(char);
}

function makeBlankBoard(lyrics) {
  return Array.from(lyrics || "").map((char) => (isWordChar(char) ? "□" : char)).join("");
}

function makeSpacingHint(lyrics) {
  return makeBlankBoard(lyrics);
}

function makeFlashText(lyrics) {
  return lyrics || "가사를 입력하면 여기에 플래시 힌트가 표시됩니다.";
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function parseTimestamp(value) {
  const parts = String(value || "").trim().split(":").map(Number);
  if (!parts.length || parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) return Math.max(0, parts[0]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function parseTimeRange(value) {
  const [startRaw, endRaw] = String(value || "").split(/\s*[-~–—]\s*/);
  const start = parseTimestamp(startRaw);
  const end = parseTimestamp(endRaw);
  return { start, end };
}

function youtubeEmbedUrl(url, timeRange) {
  const value = String(url || "");
  const watchMatch = value.match(/[?&]v=([^&]+)/);
  const shortMatch = value.match(/youtu\.be\/([^?&]+)/);
  const embedMatch = value.match(/embed\/([^?&]+)/);
  const id = watchMatch?.[1] || shortMatch?.[1] || embedMatch?.[1];
  if (!id) return "";

  const { start, end } = parseTimeRange(timeRange);
  const params = new URLSearchParams({ rel: "0" });
  if (start !== null) params.set("start", String(start));
  if (end !== null && (start === null || end > start)) params.set("end", String(end));
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderGeneratedText(text) {
  return escapeHtml(text || "").replaceAll("\n", "<br />");
}

function getRevealedCharSet(problem) {
  return new Set(state.revealedChars[problem?.id] || []);
}

function renderInteractiveBoard(problem) {
  const revealed = getRevealedCharSet(problem);
  const chars = Array.from(problem?.lyrics || "");
  const parts = [];
  let wordBuffer = [];
  let blankNumber = 0;

  const flushWord = () => {
    if (!wordBuffer.length) return;
    parts.push(`<span class="word-token">${wordBuffer.join("")}</span>`);
    wordBuffer = [];
  };

  chars.forEach((char, index) => {
    if (char === "\n") {
      flushWord();
      parts.push("<br />");
      return;
    }

    if (/\s/.test(char)) {
      flushWord();
      parts.push(escapeHtml(char));
      return;
    }

    if (!isWordChar(char)) {
      wordBuffer.push(escapeHtml(char));
      return;
    }

    blankNumber += 1;
    if (state.revealed.answer || revealed.has(index)) {
      wordBuffer.push(`<span class="char-slot is-open">${escapeHtml(char)}</span>`);
      return;
    }

    wordBuffer.push(`<button class="char-slot is-hidden" data-action="reveal-char" data-char-index="${index}" aria-label="${blankNumber}번째 글자 공개"><span class="char-slot__number">${blankNumber}</span></button>`);
  });

  flushWord();
  return parts.join("");
}

function render() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    ${renderAppBar()}
    ${state.mode === "make" ? renderMaker() : renderRunner()}
  `;
  bindEvents();
  syncTimer();
}

function renderAppBar() {
  const problem = currentProblem();
  return `
    <header class="app-bar">
      <div class="app-brand">
        <span class="section-badge">WOW</span>
        <div>
          <h1>${escapeHtml(state.lesson.title)}</h1>
          <p>${escapeHtml(state.lesson.unit)} · ${escapeHtml(problem?.title || "문제 미선택")}</p>
        </div>
      </div>
      <div class="app-actions">
        <a class="btn btn--secondary btn--sm blog-link" href="https://blog.naver.com/kimhsu1/222817823493" target="_blank" rel="noopener noreferrer">현수토리 선생님 블로그</a>
        <div class="mode-tabs" role="tablist" aria-label="작업 모드">
          ${phaseLabels
            .map(({ mode, label }) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-action="set-mode" data-mode="${mode}">${label}</button>`)
            .join("")}
        </div>
      </div>
    </header>
  `;
}

function renderMaker() {
  const problem = currentProblem();
  return `
    <main class="maker-layout">
      <section class="control-stack">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <span class="label-caps">수업 정보</span>
              <h2>노래와 기본 정보</h2>
            </div>
            <button class="btn btn--ghost btn--sm" data-action="reset-all">기본값 복원</button>
          </div>
          <div class="editor-grid">
            <label class="field">
              <span class="field__label">수업 제목</span>
              <input class="field__input" data-lesson-field="title" value="${escapeHtml(state.lesson.title)}" />
            </label>
            <label class="field">
              <span class="field__label">단원명</span>
              <input class="field__input" data-lesson-field="unit" value="${escapeHtml(state.lesson.unit)}" />
            </label>
            <label class="field editor-grid__wide">
              <span class="field__label">YouTube 링크</span>
              <input class="field__input" data-lesson-field="songUrl" value="${escapeHtml(state.lesson.songUrl)}" />
              <span class="field__helper">진행 화면에서는 선택 문제의 노래 구간이 자동으로 반영됩니다.</span>
            </label>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <span class="label-caps">문제 자료</span>
              <h2>현재 진행 문제</h2>
            </div>
            <span class="chip">${problem ? "선택됨" : "대기"}</span>
          </div>
          <label class="field">
            <span class="field__label">문제 선택</span>
            <select class="field__input" data-problem-select ${problemLibraryStatus === "ready" && problemLibrary.length ? "" : "disabled"}>
              ${problemLibrary.map(renderProblemOption).join("")}
            </select>
            <span class="field__helper">${renderProblemStatusText()}</span>
          </label>
          ${renderProblemMeta(problem)}
        </article>
      </section>

      <section class="preview-panel">
        <div class="panel-heading">
          <div>
            <span class="label-caps">자동 생성 미리보기</span>
            <h2>${escapeHtml(problem?.title || "문제를 선택하세요")}</h2>
          </div>
          <button class="btn btn--primary btn--sm" data-action="set-mode" data-mode="run" ${problem ? "" : "disabled"}>진행하기</button>
        </div>
        ${renderSelectedProblemPreview()}
      </section>
    </main>
  `;
}

function renderProblemOption(problem) {
  const selected = problem.id === state.selectedProblemId ? "selected" : "";
  return `<option value="${escapeHtml(problem.id)}" ${selected}>${escapeHtml(problem.category)} · ${escapeHtml(problem.title)}</option>`;
}

function renderProblemStatusText() {
  if (problemLibraryStatus === "loading") return "문제 JSON을 불러오는 중입니다.";
  if (problemLibraryStatus === "error") return `문제 JSON을 불러오지 못했습니다. ${problemLibraryError}`;
  if (!problemLibrary.length) return "문제 자료가 없습니다.";
  return "제작하기에서 고른 문제 1개가 진행하기 화면에 표시됩니다.";
}

function renderProblemMeta(problem) {
  if (!problem) return "";
  return `
    <div class="meta-row">
      <span class="chip">${escapeHtml(problem.category)}</span>
      <span class="chip chip--gray">${escapeHtml(problem.timeRange || "구간 미입력")}</span>
      <span class="chip chip--gray">1 / 1</span>
    </div>
  `;
}

function renderSelectedProblemPreview() {
  if (problemLibraryStatus === "loading") {
    return renderEmptyState("문제 자료를 불러오는 중", "data/problems.json을 읽고 있습니다.");
  }

  if (problemLibraryStatus === "error") {
    return renderEmptyState("문제 자료를 불러오지 못했습니다", "로컬 파일로 직접 열었다면 로컬 서버 주소로 접속해 주세요.");
  }

  const problem = currentProblem();
  if (!problem) {
    return renderEmptyState("문제 자료가 없습니다", "나중에 받은 문제 JSON을 data/problems.json에 채워 넣으면 여기에 표시됩니다.");
  }

  return `
    <div class="preview-stack">
      <article class="question board-preview">
        <span class="callout__label">받쓰판</span>
        <div class="question__prompt">${renderGeneratedText(makeBlankBoard(problem.lyrics))}</div>
      </article>
      <article class="callout">
        <span class="callout__label">한 글자 보기</span>
        <p>진행 화면에서 원하는 번호 칸을 클릭하면 해당 글자만 공개됩니다.</p>
      </article>
      <article class="question board-preview">
        <span class="callout__label">띄어쓰기 보기</span>
        <div class="question__prompt">${renderGeneratedText(makeSpacingHint(problem.lyrics))}</div>
      </article>
    </div>
  `;
}

function renderEmptyState(title, description) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon empty-state__icon--default">!</div>
      <div class="empty-state__title">${escapeHtml(title)}</div>
      <div class="empty-state__desc">${escapeHtml(description)}</div>
    </div>
  `;
}

function renderRunner() {
  const problem = currentProblem();
  const embedUrl = youtubeEmbedUrl(state.lesson.songUrl, problem?.timeRange);
  const hasPickedLetters = (state.revealedChars[problem?.id] || []).length > 0;

  return `
    <main class="run-layout">
      <section class="stage-panel">
        <div class="stage-header">
          <div>
            <span class="label-caps">현재 문제</span>
            <h2>${escapeHtml(problem?.title || "문제를 선택하세요")}</h2>
          </div>
          <div class="meta-row">
            <span class="chip">${escapeHtml(problem?.category || "분류 없음")}</span>
            <span class="chip chip--gray">${escapeHtml(problem?.timeRange || "구간 미입력")}</span>
            <span class="chip chip--gray">1 / 1</span>
          </div>
        </div>

        <article class="board">
          <div class="board__topline">
            <span>받쓰판</span>
            <strong>${escapeHtml(getActiveRevealLabel(hasPickedLetters))}</strong>
          </div>
          <div class="board__answer ${state.revealed.answer ? "is-revealed" : ""}">
            <p>${problem ? renderInteractiveBoard(problem) : "제작하기에서 문제를 선택하세요."}</p>
          </div>
          <div class="board-actions">
            <button class="btn btn--secondary btn--sm" data-action="reset-char-hints" ${problem ? "" : "disabled"}>글자 힌트 초기화</button>
            <button class="btn btn--secondary btn--sm" data-action="toggle-reveal" data-reveal="spacing" ${problem ? "" : "disabled"}>${state.revealed.spacing ? "띄어쓰기 닫기" : "띄어쓰기 보기"}</button>
            <button class="btn btn--primary btn--sm" data-action="show-flash" ${problem ? "" : "disabled"}>플래시 보기</button>
            <button class="btn btn--primary btn--sm" data-action="toggle-reveal" data-reveal="answer" ${problem ? "" : "disabled"}>${state.revealed.answer ? "정답 가리기" : "정답 공개"}</button>
          </div>
        </article>
      </section>

      <aside class="side-rail">
        <section class="panel timer-panel">
          <span class="label-caps">타이머</span>
          <strong class="timer">${formatTime(state.timer.remaining)}</strong>
          <div class="button-row">
            <button class="btn btn--primary btn--sm" data-action="toggle-timer">${state.timer.running ? "일시정지" : "시작"}</button>
            <button class="btn btn--secondary btn--sm" data-action="reset-timer">리셋</button>
          </div>
          <label class="field timer-field">
            <span class="field__label">기본 시간(초)</span>
            <input class="field__input" data-action="timer-seconds" type="number" min="10" step="5" value="${state.timer.defaultSeconds}" />
          </label>
        </section>

        <section class="panel media-panel">
          <div class="compact-heading">
            <span class="label-caps">노래 구간</span>
            <strong>${escapeHtml(problem?.timeRange || "구간 미입력")}</strong>
          </div>
          ${embedUrl ? `<iframe src="${embedUrl}" title="수업 노래 영상" allowfullscreen></iframe>` : renderEmptyState("노래 링크가 없습니다", "제작하기에서 YouTube 링크를 입력하세요.")}
          <a class="media-link" href="${escapeHtml(state.lesson.songUrl)}" target="_blank" rel="noreferrer">YouTube에서 열기</a>
        </section>
      </aside>
    </main>
    ${state.flashVisible ? `<div class="flash-overlay" role="dialog" aria-label="플래시 힌트"><p>${renderGeneratedText(makeFlashText(problem?.lyrics))}</p></div>` : ""}
  `;
}

function getActiveRevealLabel(hasPickedLetters) {
  if (state.revealed.answer) return revealLabels.answer;
  if (hasPickedLetters) return revealLabels.letterPick;
  if (state.revealed.spacing) return revealLabels.spacing;
  return revealLabels.blank;
}

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((element) => {
    const action = element.dataset.action;
    element.addEventListener(action === "timer-seconds" ? "change" : "click", onAction);
  });
  document.querySelectorAll("[data-lesson-field]").forEach((element) => {
    element.addEventListener("input", onLessonInput);
  });
  document.querySelectorAll("[data-problem-select]").forEach((element) => {
    element.addEventListener("change", onProblemSelect);
  });
}

function onAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;

  if (action === "show-flash") {
    showFlash();
    return;
  }

  setState((draft) => {
    if (action === "set-mode") draft.mode = target.dataset.mode;
    if (action === "toggle-reveal") {
      const key = target.dataset.reveal;
      draft.revealed[key] = !draft.revealed[key];
      if (key === "answer" && draft.revealed.answer) draft.revealed.spacing = false;
      if (key === "spacing" && draft.revealed[key]) draft.revealed.answer = false;
    }
    if (action === "reveal-char") {
      const problem = currentProblem();
      if (!problem) return;
      const index = Number(target.dataset.charIndex);
      const list = draft.revealedChars[problem.id] || [];
      if (!list.includes(index)) list.push(index);
      draft.revealedChars[problem.id] = list;
      draft.revealed.answer = false;
    }
    if (action === "reset-char-hints") {
      const problem = currentProblem();
      if (problem) draft.revealedChars[problem.id] = [];
    }
    if (action === "toggle-timer") draft.timer.running = !draft.timer.running;
    if (action === "reset-timer") {
      draft.timer.remaining = draft.timer.defaultSeconds;
      draft.timer.running = false;
    }
    if (action === "timer-seconds") {
      const seconds = Math.max(10, Number(target.value) || 90);
      draft.timer.defaultSeconds = seconds;
      draft.timer.remaining = seconds;
      draft.timer.running = false;
    }
    if (action === "reset-all" && confirm("수업 정보와 진행 상태를 기본값으로 되돌릴까요?")) {
      Object.assign(draft, clone(defaultState));
      draft.selectedProblemId = problemLibrary[0]?.id || "";
    }
  });
}

function onProblemSelect(event) {
  state.selectedProblemId = event.currentTarget.value;
  clearReveals(state);
  saveState();
  render();
}

function onLessonInput(event) {
  state.lesson[event.currentTarget.dataset.lessonField] = event.currentTarget.value;
  saveState();
}

function clearReveals(draft) {
  draft.revealed = { spacing: false, answer: false };
  draft.flashVisible = false;
}

function showFlash() {
  const token = Date.now();
  setState((draft) => {
    draft.flashVisible = true;
    draft.flashToken = token;
  });
  window.setTimeout(() => {
    if (state.flashToken !== token) return;
    setState((draft) => {
      draft.flashVisible = false;
    });
  }, 1200);
}

function syncTimer() {
  clearInterval(timerId);
  if (!state.timer.running) return;
  timerId = window.setInterval(() => {
    state.timer.remaining = Math.max(0, state.timer.remaining - 1);
    if (state.timer.remaining === 0) state.timer.running = false;
    saveState();
    render();
  }, 1000);
}

render();
loadProblemLibrary();
