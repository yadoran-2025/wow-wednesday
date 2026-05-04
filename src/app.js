const STORAGE_KEY = "wow-wednesday-maker-v4";
const CUSTOM_PROBLEM_ID = "custom-problem";

const phaseLabels = [
  { mode: "make", label: "제작하기" },
  { mode: "rules", label: "룰 설명" },
  { mode: "run", label: "진행하기" },
];

const revealLabels = {
  blank: "받쓰판",
  letterPick: "한 글자 보기",
  spacing: "띄어쓰기 보기",
  answer: "정답 공개",
};

const referenceLessons = [
  {
    id: "history-hyeonsutory",
    subject: "역사",
    teacher: "현수토리 선생님",
    url: "https://blog.naver.com/kimhsu1/222817823493",
  },
  {
    id: "social-choeup",
    subject: "사회",
    teacher: "초읍중 주연지 선생님",
    url: "https://band.us/band/61332773/post/5885",
  },
  {
    id: "social-mugeuk",
    subject: "사회",
    teacher: "무극중 최주영 선생님",
    url: "https://band.us/band/61332773/post/5713",
  },
];

const defaultRulesText = `1. 노래를 듣자
선생님이 제시하는 노래를 듣습니다.
문제 부분은 카운트다운 후 제시됩니다.

2. 노래를 쓰자
문제 부분을 듣고 먼저 개별 받쓰판을 채웁니다.
개별로 채운 답은 모둠원과 공유하며 3분간 의논합니다.
의논이 끝나면 각 조 잼보드에 답을 써서 제출합니다.

3. 힌트를 얻자
첫 번째 기회에서 받아쓰기판을 오픈한 뒤, 가장 많이 막힌 조에게 힌트를 줍니다.
원하는 받은 조부터 차례로 힌트를 받을 수 있습니다.

4. 답을 맞히자
첫 번째 받아쓰기판을 오픈하고 힌트를 받은 뒤, 문제 구간을 다시 한 번 더 듣습니다.
최종 받아쓰기판을 3분간 조별로 논의하여 채웁니다.
한 라운드당 두 번의 기회를 주고, 정답을 맞힌 조는 10점, 가장 근접한 조는 5점을 줍니다.`;

let problemLibrary = [];
let problemLibraryStatus = "loading";
let problemLibraryError = "";

const defaultState = {
  mode: "make",
  selectedProblemId: "",
  rulesEditing: false,
  rulesText: defaultRulesText,
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
  customProblem: {
    id: CUSTOM_PROBLEM_ID,
    savedId: "",
    category: "",
    title: "",
    timeRange: "",
    lyrics: "",
    problemUrl: "",
    audioName: "",
    audioDataUrl: "",
  },
  savedProblems: [],
  selectedSavedProblemId: "",
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
  next.customProblem = normalizeCustomProblem(value.customProblem || {});
  next.savedProblems = Array.isArray(value.savedProblems) ? value.savedProblems.map(normalizeSavedProblem).filter(Boolean) : [];
  next.selectedSavedProblemId = String(value.selectedSavedProblemId || next.savedProblems[0]?.id || "");
  next.revealed = { ...clone(defaultState.revealed), ...(value.revealed || {}) };
  next.revealedChars = value.revealedChars || {};
  next.timer = { ...clone(defaultState.timer), ...(value.timer || {}) };
  next.selectedProblemId = value.selectedProblemId || "";
  next.rulesEditing = Boolean(value.rulesEditing);
  next.rulesText = String(value.rulesText || defaultRulesText);
  next.mode = phaseLabels.some(({ mode }) => mode === next.mode) ? next.mode : "make";
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

    if (state.selectedProblemId !== CUSTOM_PROBLEM_ID && !knownProblemIds().has(state.selectedProblemId)) {
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

function normalizeCustomProblem(problem) {
  return {
    id: CUSTOM_PROBLEM_ID,
    savedId: String(problem.savedId || ""),
    category: String(problem.category || ""),
    title: String(problem.title || ""),
    timeRange: String(problem.timeRange || ""),
    lyrics: String(problem.lyrics || ""),
    problemUrl: String(problem.problemUrl || ""),
    audioName: String(problem.audioName || ""),
    audioDataUrl: String(problem.audioDataUrl || ""),
  };
}

function normalizeSavedProblem(problem) {
  if (!problem || typeof problem !== "object") return null;
  const id = String(problem.id || problem.savedId || `saved-${Date.now()}`);
  return {
    ...normalizeCustomProblem(problem),
    id,
    savedId: id,
    category: String(problem.category || "직접 만든 문제"),
    title: String(problem.title || "제목 없는 문제"),
    createdAt: String(problem.createdAt || new Date().toISOString()),
    updatedAt: String(problem.updatedAt || problem.createdAt || new Date().toISOString()),
  };
}

function knownProblemIds() {
  return new Set([...problemLibrary.map((problem) => problem.id), ...state.savedProblems.map((problem) => problem.id)]);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(updater) {
  updater(state);
  if (state.selectedProblemId !== CUSTOM_PROBLEM_ID && !knownProblemIds().has(state.selectedProblemId)) {
    state.selectedProblemId = problemLibrary[0]?.id || "";
  }
  saveState();
  render();
}

function selectedProblemIndex() {
  return Math.max(0, problemLibrary.findIndex((problem) => problem.id === state.selectedProblemId));
}

function currentProblem() {
  if (state.selectedProblemId === CUSTOM_PROBLEM_ID) return customProblem();
  const savedProblem = state.savedProblems.find((problem) => problem.id === state.selectedProblemId);
  if (savedProblem) return savedProblem;
  return problemLibrary[selectedProblemIndex()] || null;
}

function customProblem() {
  const problem = normalizeCustomProblem(state.customProblem);
  return {
    ...problem,
    category: problem.category || "직접 만든 문제",
    title: problem.title || "직접 만든 문제",
  };
}

function customProblemIsReady() {
  return Boolean(state.customProblem.title.trim() && state.customProblem.lyrics.trim());
}

function customProblemHasDraft() {
  return Boolean(
    state.customProblem.title.trim() ||
      state.customProblem.timeRange.trim() ||
      state.customProblem.problemUrl.trim() ||
      state.customProblem.audioDataUrl ||
      state.customProblem.lyrics.trim()
  );
}

function makerPreviewProblem() {
  return customProblemHasDraft() ? customProblem() : currentProblem();
}

function selectedSavedProblem() {
  return state.savedProblems.find((problem) => problem.id === state.selectedSavedProblemId) || state.savedProblems[0] || null;
}

function savedProblemFromCustom(draft) {
  const now = new Date().toISOString();
  const existingId = draft.customProblem.savedId;
  const existing = draft.savedProblems.find((problem) => problem.id === existingId);
  const id = existing?.id || existingId || `saved-${Date.now()}`;
  return normalizeSavedProblem({
    ...draft.customProblem,
    id,
    savedId: id,
    category: draft.customProblem.category || "직접 만든 문제",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
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

function renderInteractiveBoard(problem, options = {}) {
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
    if (options.forceAnswer || state.revealed.answer || revealed.has(index)) {
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
    ${renderCurrentMode()}
  `;
  bindEvents();
  syncTimer();
}

function renderCurrentMode() {
  if (state.mode === "make") return renderMaker();
  if (state.mode === "rules") return renderRules();
  return renderRunner();
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
        <div class="mode-tabs" role="tablist" aria-label="작업 모드">
          ${phaseLabels
            .map(({ mode, label }) => `<button class="mode-tab ${state.mode === mode ? "is-active" : ""}" data-action="set-mode" data-mode="${mode}">${label}</button>`)
            .join("")}
          <div class="reference-menu">
            <button class="mode-tab reference-tab" type="button">다른 수업 참고</button>
            <div class="reference-flyout" aria-label="참고할 수 있는 다른 수업">
              ${referenceLessons.map(renderReferenceButton).join("")}
            </div>
          </div>
        </div>
      </div>
      <a class="dashboard-link" href="https://yadoran-2025.github.io/booong/" target="_blank" rel="noopener noreferrer">대시보드로 이동 -&gt;</a>
    </header>
  `;
}

function renderReferenceButton(lesson) {
  return `
    <a class="reference-flyout__button" href="${escapeHtml(lesson.url)}" target="_blank" rel="noopener noreferrer">
      <span class="chip">${escapeHtml(lesson.subject)}</span>
      <strong>${escapeHtml(lesson.teacher)}</strong>
    </a>
  `;
}

function renderRules() {
  const problem = currentProblem();

  return `
    <main class="rules-layout">
      <section class="rules-sheet">
        <div class="rules-sheet__header">
          <div>
            <span class="label-caps">룰 설명</span>
            <h2>${escapeHtml(problem?.title || "수업 규칙")}</h2>
          </div>
          <div class="button-row">
            <button class="btn btn--secondary btn--sm" data-action="toggle-rules-edit">${state.rulesEditing ? "수정 완료" : "룰 수정하기"}</button>
            <button class="btn btn--primary btn--sm" data-action="set-mode" data-mode="run">진행하기</button>
          </div>
        </div>

        ${state.rulesEditing ? renderRulesEditor() : renderRulesContent()}
      </section>
    </main>
  `;
}

function renderRulesEditor() {
  return `
    <div class="rules-editor">
      <label class="field">
        <span class="field__label">룰 설명 내용</span>
        <textarea class="field__input rules-editor__textarea" data-rules-text>${escapeHtml(state.rulesText)}</textarea>
        <span class="field__helper">내용은 이 브라우저에 자동 저장됩니다. 한 줄을 비우면 문단이 나뉩니다.</span>
      </label>
      <div class="button-row form-actions">
        <button class="btn btn--secondary btn--sm" data-action="reset-rules">기본 룰로 되돌리기</button>
      </div>
    </div>
  `;
}

function renderRulesContent() {
  const blocks = state.rulesText.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return `
    <div class="rules-content">
      ${blocks.map(renderRuleBlock).join("")}
    </div>
  `;
}

function renderRuleBlock(block) {
  const [title, ...bodyLines] = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return `
    <article class="rule-card">
      <h3>${escapeHtml(title || "룰")}</h3>
      ${bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </article>
  `;
}

function renderMaker() {
  const problem = currentProblem();
  const previewProblem = makerPreviewProblem();
  return `
    <main class="maker-layout">
      <section class="control-stack">
        ${renderProblemPicker(problem)}
        ${renderSavedProblemLibrary()}

        <article class="panel">
          <div class="panel-heading">
            <div>
              <span class="label-caps">직접 만들기</span>
              <h2>새 문제 입력</h2>
            </div>
          </div>
          <div class="editor-grid">
            <label class="field editor-grid__wide">
              <span class="field__label">문제 제목</span>
              <input class="field__input" data-custom-problem-field="title" value="${escapeHtml(state.customProblem.title)}" placeholder="예: 단원명 · 핵심 개념" />
            </label>
            <label class="field">
              <span class="field__label">노래 구간</span>
              <input class="field__input" data-custom-problem-field="timeRange" value="${escapeHtml(state.customProblem.timeRange)}" placeholder="예: 00:32 - 00:48" />
            </label>
            <label class="field">
              <span class="field__label">문제 링크</span>
              <input class="field__input" data-custom-problem-field="problemUrl" value="${escapeHtml(state.customProblem.problemUrl)}" placeholder="예: https://youtu.be/..." />
            </label>
            <label class="field editor-grid__wide">
              <span class="field__label">음원 파일</span>
              <input class="field__input file-input" data-custom-audio-file type="file" accept="audio/*" />
              ${state.customProblem.audioName ? `<span class="field__helper">선택됨: ${escapeHtml(state.customProblem.audioName)}</span>` : ""}
            </label>
            <label class="field editor-grid__wide">
              <span class="field__label">받쓰판 문장</span>
              <textarea class="field__input field__textarea" data-custom-problem-field="lyrics" placeholder="받쓰판에 넣을 문장을 입력하세요.">${escapeHtml(state.customProblem.lyrics)}</textarea>
              <span class="field__helper">문장을 입력하면 오른쪽 받쓰판 미리보기에 바로 반영됩니다.</span>
            </label>
          </div>
          <div class="button-row form-actions">
            <button class="btn btn--primary btn--sm" data-action="save-custom-problem">문제 저장</button>
          </div>
        </article>
      </section>

      <section class="preview-panel">
        <div class="panel-heading">
          <div>
            <h2 data-maker-preview-title>${escapeHtml(previewProblem?.title || "문제를 선택하세요")}</h2>
          </div>
        </div>
        <div data-maker-preview-body>
          ${renderSelectedProblemPreview(previewProblem)}
        </div>
      </section>
    </main>
  `;
}

function renderSavedProblemLibrary() {
  return `
    <article class="panel saved-panel">
      <div class="panel-heading">
        <div>
          <span class="label-caps">내 문제 보관함</span>
          <h2>저장한 문제</h2>
        </div>
        <span class="chip chip--gray">${state.savedProblems.length}개</span>
      </div>
      <label class="field">
        <span class="sr-only">저장한 문제 선택</span>
        <select class="field__input" data-saved-problem-select ${state.savedProblems.length ? "" : "disabled"}>
          ${state.savedProblems.length ? state.savedProblems.map(renderSavedProblemOption).join("") : "<option>저장한 문제가 없습니다</option>"}
        </select>
        <span class="field__helper">직접 만든 문제를 저장하면 이 브라우저에만 보관됩니다.</span>
      </label>
      <div class="button-row form-actions">
        <button class="btn btn--primary btn--sm" data-action="load-saved-problem" ${state.savedProblems.length ? "" : "disabled"}>불러오기</button>
        <button class="btn btn--secondary btn--sm" data-action="delete-saved-problem" ${state.savedProblems.length ? "" : "disabled"}>삭제</button>
      </div>
    </article>
  `;
}

function renderSavedProblemOption(problem) {
  const selected = problem.id === state.selectedSavedProblemId ? "selected" : "";
  const label = `${problem.title}${problem.timeRange ? ` · ${problem.timeRange}` : ""}`;
  return `<option value="${escapeHtml(problem.id)}" ${selected}>${escapeHtml(label)}</option>`;
}

function renderProblemPicker(problem) {
  if (problemLibraryStatus === "ready" && !problemLibrary.length) return "";

  return `
    <article class="panel">
      <div class="panel-heading">
        <div>
          <h2>문제 선택</h2>
        </div>
      </div>
      <label class="field">
        <span class="sr-only">문제 선택</span>
        <select class="field__input" data-problem-select ${problemLibraryStatus === "ready" && problemLibrary.length ? "" : "disabled"}>
          ${state.selectedProblemId === CUSTOM_PROBLEM_ID ? `<option value="${CUSTOM_PROBLEM_ID}" selected>직접 만든 문제 사용 중</option>` : ""}
          ${problemLibrary.map(renderProblemOption).join("")}
        </select>
        ${renderProblemStatusText() ? `<span class="field__helper">${renderProblemStatusText()}</span>` : ""}
      </label>
      ${renderProblemMeta(problem)}
    </article>
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
  return "";
}

function renderProblemMeta(problem) {
  if (!problem) return "";
  return `
    <div class="meta-row">
      <span class="chip">${escapeHtml(problem.category)}</span>
      <span class="chip chip--gray">${escapeHtml(problem.timeRange || "구간 미입력")}</span>
    </div>
  `;
}

function renderSelectedProblemPreview(problem = makerPreviewProblem()) {
  if (customProblemHasDraft()) {
    if (!problem?.lyrics.trim()) {
      return renderEmptyState("받쓰판 문장을 입력하세요", "왼쪽에 문장을 쓰면 이곳에 미리보기가 바로 표시됩니다.");
    }
    return renderPracticeBoard(problem, { forceAnswer: true });
  }

  if (problemLibraryStatus === "loading") {
    return renderEmptyState("문제 자료를 불러오는 중", "data/problems.json을 읽고 있습니다.");
  }

  if (problemLibraryStatus === "error") {
    return renderEmptyState("문제 자료를 불러오지 못했습니다", "로컬 파일로 직접 열었다면 로컬 서버 주소로 접속해 주세요.");
  }

  if (!problem) {
    return renderEmptyState("직접 만든 문제가 없습니다", "왼쪽에서 제목과 받쓰판 문장을 입력한 뒤 직접 만든 문제를 사용해 주세요.");
  }

  return renderPracticeBoard(problem, { forceAnswer: true });
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

function renderPracticeBoard(problem, options = {}) {
  const hasPickedLetters = (state.revealedChars[problem?.id] || []).length > 0;
  const answerRevealed = options.forceAnswer || state.revealed.answer;

  return `
    <article class="board">
      <div class="board__topline">
        <span>받쓰판</span>
        ${options.forceAnswer ? "" : `<strong>${escapeHtml(getActiveRevealLabel(hasPickedLetters))}</strong>`}
      </div>
      <div class="board__answer ${answerRevealed ? "is-revealed" : ""}">
        <p>${problem ? renderInteractiveBoard(problem, { forceAnswer: answerRevealed }) : "제작하기에서 문제를 선택하세요."}</p>
      </div>
      ${options.forceAnswer ? "" : `
        <div class="board-actions">
          <button class="btn btn--secondary btn--sm" data-action="reset-char-hints" ${problem ? "" : "disabled"}>글자 힌트 초기화</button>
          <button class="btn btn--primary btn--sm" data-action="show-flash" ${problem ? "" : "disabled"}>0.5초 힌트</button>
          <button class="btn btn--primary btn--sm" data-action="toggle-reveal" data-reveal="answer" ${problem ? "" : "disabled"}>${state.revealed.answer ? "정답 가리기" : "정답 공개"}</button>
        </div>
      `}
    </article>
  `;
}

function renderRunner() {
  const problem = currentProblem();
  const media = renderProblemMedia(problem);

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

        ${renderPracticeBoard(problem)}
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
          ${media}
        </section>
      </aside>
    </main>
    ${state.flashVisible ? `<div class="flash-overlay" role="dialog" aria-label="플래시 힌트"><p>${renderGeneratedText(makeFlashText(problem?.lyrics))}</p></div>` : ""}
  `;
}

function renderProblemMedia(problem) {
  if (problem?.audioDataUrl) {
    return `
      <audio class="audio-player" controls src="${escapeHtml(problem.audioDataUrl)}"></audio>
      <span class="field__helper">${escapeHtml(problem.audioName || "업로드한 음원")}</span>
    `;
  }

  const mediaUrl = problem?.problemUrl || state.lesson.songUrl;
  const embedUrl = youtubeEmbedUrl(mediaUrl, problem?.timeRange);
  if (embedUrl) {
    return `
      <iframe src="${embedUrl}" title="수업 노래 영상" allowfullscreen></iframe>
      <a class="media-link" href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer">링크 열기</a>
    `;
  }

  if (mediaUrl) {
    return `<a class="media-link" href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer">문제 링크 열기</a>`;
  }

  return renderEmptyState("링크나 음원이 없습니다", "직접 만들기에서 문제 링크를 입력하거나 음원 파일을 선택하세요.");
}

function getActiveRevealLabel(hasPickedLetters) {
  if (state.revealed.answer) return revealLabels.answer;
  if (hasPickedLetters) return revealLabels.letterPick;
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
  document.querySelectorAll("[data-custom-problem-field]").forEach((element) => {
    element.addEventListener("input", onCustomProblemInput);
  });
  document.querySelectorAll("[data-custom-audio-file]").forEach((element) => {
    element.addEventListener("change", onCustomAudioFile);
  });
  document.querySelectorAll("[data-rules-text]").forEach((element) => {
    element.addEventListener("input", onRulesInput);
  });
  document.querySelectorAll("[data-problem-select]").forEach((element) => {
    element.addEventListener("change", onProblemSelect);
  });
  document.querySelectorAll("[data-saved-problem-select]").forEach((element) => {
    element.addEventListener("change", onSavedProblemSelect);
  });
}

function onAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;

  if (action === "show-flash") {
    showFlash();
    return;
  }

  if ((action === "use-custom-problem" || action === "save-custom-problem") && !customProblemIsReady()) {
    alert("문제 제목과 받쓰판 문장을 입력해 주세요.");
    return;
  }

  setState((draft) => {
    if (action === "set-mode") draft.mode = target.dataset.mode;
    if (action === "toggle-rules-edit") draft.rulesEditing = !draft.rulesEditing;
    if (action === "reset-rules" && confirm("룰 설명을 기본 내용으로 되돌릴까요?")) draft.rulesText = defaultRulesText;
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
    if (action === "use-custom-problem") {
      if (!customProblemIsReady()) return;
      draft.customProblem = normalizeCustomProblem(draft.customProblem);
      draft.selectedProblemId = CUSTOM_PROBLEM_ID;
      clearReveals(draft);
    }
    if (action === "save-custom-problem") {
      const savedProblem = savedProblemFromCustom(draft);
      const index = draft.savedProblems.findIndex((problem) => problem.id === savedProblem.id);
      if (index >= 0) draft.savedProblems[index] = savedProblem;
      else draft.savedProblems.unshift(savedProblem);
      draft.customProblem = normalizeCustomProblem({ ...savedProblem, id: CUSTOM_PROBLEM_ID });
      draft.selectedSavedProblemId = savedProblem.id;
      draft.selectedProblemId = CUSTOM_PROBLEM_ID;
      clearReveals(draft);
    }
    if (action === "load-saved-problem") {
      const savedProblem = selectedSavedProblem();
      if (!savedProblem) return;
      draft.customProblem = normalizeCustomProblem({ ...savedProblem, id: CUSTOM_PROBLEM_ID, savedId: savedProblem.id });
      draft.selectedSavedProblemId = savedProblem.id;
      draft.selectedProblemId = CUSTOM_PROBLEM_ID;
      clearReveals(draft);
    }
    if (action === "delete-saved-problem" && confirm("저장한 문제를 삭제할까요?")) {
      const savedProblem = selectedSavedProblem();
      if (!savedProblem) return;
      const isEditingDeletedProblem = draft.customProblem.savedId === savedProblem.id;
      draft.savedProblems = draft.savedProblems.filter((problem) => problem.id !== savedProblem.id);
      draft.selectedSavedProblemId = draft.savedProblems[0]?.id || "";
      if (isEditingDeletedProblem) draft.customProblem = clone(defaultState.customProblem);
      if (draft.selectedProblemId === savedProblem.id) draft.selectedProblemId = draft.customProblem.title.trim() && draft.customProblem.lyrics.trim() ? CUSTOM_PROBLEM_ID : "";
      if (isEditingDeletedProblem && draft.selectedProblemId === CUSTOM_PROBLEM_ID) draft.selectedProblemId = "";
      clearReveals(draft);
    }
    if (action === "clear-custom-problem") {
      draft.customProblem = clone(defaultState.customProblem);
      if (draft.selectedProblemId === CUSTOM_PROBLEM_ID) draft.selectedProblemId = problemLibrary[0]?.id || "";
      clearReveals(draft);
    }
    if (action === "clear-custom-audio") {
      draft.customProblem.audioName = "";
      draft.customProblem.audioDataUrl = "";
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

function onSavedProblemSelect(event) {
  state.selectedSavedProblemId = event.currentTarget.value;
  saveState();
  render();
}

function onCustomProblemInput(event) {
  state.customProblem[event.currentTarget.dataset.customProblemField] = event.currentTarget.value;
  saveState();
  refreshMakerPreview();
}

function refreshMakerPreview() {
  const title = document.querySelector("[data-maker-preview-title]");
  const body = document.querySelector("[data-maker-preview-body]");
  if (!title || !body) return;

  const previewProblem = makerPreviewProblem();
  title.textContent = previewProblem?.title || "문제를 선택하세요";
  body.innerHTML = renderSelectedProblemPreview(previewProblem);
}

function onCustomAudioFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.customProblem.audioName = file.name;
    state.customProblem.audioDataUrl = String(reader.result || "");
    saveState();
    render();
  });
  reader.readAsDataURL(file);
}

function onRulesInput(event) {
  state.rulesText = event.currentTarget.value;
  saveState();
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
  }, 500);
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
