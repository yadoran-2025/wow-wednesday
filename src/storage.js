const APP_DB_NAME = 'wow-wednesday-app';

class WorkspaceStore {
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve,reject)=>{
      const request = indexedDB.open(APP_DB_NAME,1);
      request.onupgradeneeded = ()=>{
        request.result.createObjectStore('workspace',{keyPath:'id'});
        request.result.createObjectStore('audio',{keyPath:'id'});
      };
      request.onsuccess = ()=>resolve(request.result);
      request.onerror = ()=>reject(request.error);
      request.onblocked = ()=>reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'));
    });
    this.db.onversionchange = ()=>{this.db.close();this.db=null;};
    return this.db;
  }

  async load() {
    const db = await this.open();
    return new Promise((resolve,reject)=>{
      const transaction = db.transaction(['workspace','audio']);
      const workspace = transaction.objectStore('workspace').get('current');
      const audio = transaction.objectStore('audio').getAll();
      transaction.oncomplete = ()=>resolve({workspace:workspace.result || null,audio:audio.result});
      transaction.onabort = ()=>reject(transaction.error || new Error('저장한 문제를 읽지 못했습니다.'));
    });
  }

  async save(workspace, audioChanges=[]) {
    for(const [,record] of audioChanges)if(record && !(record.file instanceof Blob))throw new Error('저장할 음원 파일의 형식을 확인해 주세요.');
    const db = await this.open();
    return new Promise((resolve,reject)=>{
      const transaction = db.transaction(['workspace','audio'],'readwrite');
      transaction.objectStore('workspace').put({...workspace,id:'current'});
      const audio = transaction.objectStore('audio');
      for (const [id,record] of audioChanges) {
        if (record) audio.put({id,blob:record.file,name:record.name});
        else audio.delete(id);
      }
      transaction.oncomplete = ()=>resolve();
      transaction.onabort = ()=>reject(transaction.error || new Error('문제와 음원을 저장하지 못했습니다.'));
    });
  }
}

async function readLegacyAudio() {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('wow-wednesday-audio',1);
    // Opening a missing legacy database must not create an empty replacement.
    let missing = false;
    request.onupgradeneeded = ()=>{missing=true;request.transaction.abort();};
    request.onerror = ()=>missing?resolve([]):reject(request.error);
    request.onsuccess = ()=>{
      const db = request.result;
      if (!db.objectStoreNames.contains('audio-files')) {db.close();reject(new Error('기존 음원 저장소를 읽을 수 없습니다.'));return;}
      const transaction = db.transaction('audio-files');
      const records = transaction.objectStore('audio-files').getAll();
      transaction.oncomplete = ()=>{db.close();resolve(records.result);};
      transaction.onabort = ()=>{db.close();reject(transaction.error);};
    };
  });
}

function legacySeconds(value) {
  const parts = String(value || '').trim().split(':');
  if (!parts.every((part)=>/^\d+$/.test(part)) || parts.length>3) return null;
  return parts.reduce((total,part)=>total*60+Number(part),0);
}

function legacyProblem(problem, fallbackUrl='') {
  const [from,to] = String(problem.timeRange || '').split(/\s*[-~–—]\s*/);
  const start = legacySeconds(from) || 0;
  const end = legacySeconds(to);
  return {
    id:String(problem.id || crypto.randomUUID()), title:String(problem.title || ''),
    lyrics:String(problem.lyrics || ''),category:String(problem.category || ''),
    start,end:end>start?end:start+20,duration:null,
    source:problem.sourceType==='file'?'file':problem.sourceType==='link' || problem.problemUrl || fallbackUrl?'link':'file',
    url:String(problem.problemUrl || fallbackUrl),audioName:String(problem.audioName || '')
  };
}

async function importLegacy(defaultRules) {
  const raw = localStorage.getItem('wow-wednesday-maker-v4');
  const legacy = raw ? JSON.parse(raw) : {};
  if (!legacy || typeof legacy!=='object' || Array.isArray(legacy)) throw new Error('기존 수업 데이터 형식을 확인해 주세요.');
  if (legacy.savedProblems!==undefined && !Array.isArray(legacy.savedProblems)) throw new Error('기존 문제 목록의 형식을 확인해 주세요.');
  const response = await fetch('./data/problems.json');
  if (!response.ok) throw new Error('기본 문제 자료를 불러오지 못했습니다.');
  const library = await response.json();
  if (!Array.isArray(library)) throw new Error('기본 문제 자료 형식이 올바르지 않습니다.');
  const oldProblems = Array.isArray(legacy.savedProblems)?legacy.savedProblems:[];
  const problems = oldProblems.map((problem)=>legacyProblem(problem));
  const saved = problems.map((problem)=>[problem.id,structuredClone(problem)]);
  for (const problem of library) {
    const converted = legacyProblem(problem,legacy.lesson?.songUrl || '');
    if (!problems.some((item)=>item.id===converted.id)) {problems.push(converted);saved.push([converted.id,structuredClone(converted)]);}
  }
  let selectedId = legacy.selectedProblemId;
  const draft = legacy.customProblem;
  let draftId = '';
  if (draft && (draft.title || draft.lyrics || draft.problemUrl || draft.audioDataUrl || draft.savedId)) {
    const problem = legacyProblem({...draft,id:draft.savedId || 'custom-draft'});
    draftId = problem.id;
    const previous = problems.findIndex((item)=>item.id===problem.id);
    if (previous>=0) problems[previous]=problem; else problems.push(problem);
    if (selectedId==='custom-problem') selectedId=problem.id;
  }
  const audio = new Map();
  const records = raw ? await readLegacyAudio() : [];
  const byId = new Map(records.map((record)=>[record.id,record]));
  for (const problem of problems) {
    const original = oldProblems.find((item)=>item.id===problem.id);
    const record = byId.get(problem.id) || (problem.id===draftId?byId.get('custom-draft'):null);
    const dataUrl = record?.audioDataUrl || (problem.id===draftId?draft.audioDataUrl:'') || original?.audioDataUrl;
    if (!dataUrl) continue;
    if (!/^data:(?:(?:audio|video)\/[^;,]+|application\/octet-stream)[;,]/i.test(dataUrl)) throw new Error('기존 음원 파일의 형식을 확인해 주세요.');
    const blob = await (await fetch(dataUrl)).blob();
    const name = record?.audioName || original?.audioName || draft?.audioName || '기존 음원';
    problem.audioName=name;
    if (saved.some(([id])=>id===problem.id)) saved.find(([id])=>id===problem.id)[1].audioName=name;
    audio.set(problem.id,{file:blob,name});
  }
  let rules = structuredClone(defaultRules);
  if (legacy.rulesText) rules=String(legacy.rulesText).split(/\n\s*\n/).filter((block)=>block.trim()).map((block)=>{
    const [title,...body]=block.trim().split('\n');return {title,body:body.join('\n')};
  });
  return {workspace:{problems,saved,selectedId,rules,lesson:legacy.lesson || {},timerDefault:Number(legacy.timer?.defaultSeconds)||180},audio};
}
