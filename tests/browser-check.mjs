import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.APP_URL || 'http://127.0.0.1:4173/';
const executablePath=process.env.CHROME_PATH || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const browser=await chromium.launch({headless:true,executablePath});
const wav=Buffer.alloc(44+8000*12*2);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const fixture='https://media.example.test/lesson.wav';
const contexts=[];
const errors=[];
async function newPage(){const context=await browser.newContext({viewport:{width:1440,height:960}});contexts.push(context);await context.route(fixture,route=>route.fulfill({status:200,contentType:'audio/wav',headers:{'access-control-allow-origin':'*'},body:wav}));const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));return page;}
const ready=page=>page.waitForSelector('[data-field="title"]');
const flush=page=>page.waitForFunction(()=>revision===durableRevision);
const click=(page,action)=>page.locator(`[data-action="${action}"]`).first().click();
const mode=(page,value)=>page.locator(`.mode-nav [data-mode="${value}"]`).click();
async function save(page){await click(page,'save');await page.waitForFunction(()=>!dirty() && revision===durableRevision);}
async function fill(page,title='실제 수업 문제'){await page.locator('[data-field="title"]').fill(title);await page.locator('[data-field="lyrics"]').fill('가나 다\n라 마바!');}
async function upload(page,name='lesson.wav'){await page.locator('#audio-file').setInputFiles({name,mimeType:'audio/wav',buffer:wav});await page.waitForFunction(name=>document.querySelector('.file-picker').innerText.includes(name),name);await flush(page);}
async function clip(page){await page.locator('[data-time="start"]').fill('00:01');await page.locator('[data-time="start"]').press('Tab');await page.locator('[data-time="end"]').fill('00:04');await page.locator('[data-time="end"]').press('Tab');}
try{
  const page=await newPage();await page.goto(base);await ready(page);
  assert.equal(await page.locator('.problem-item').count(),1);assert.equal(await page.locator('[data-field="title"]').inputValue(),'');
  assert.equal(await page.locator('.reference-links a').count(),3);assert.match(await page.locator('.brand-credit').innerText(),/현수토리/);
  assert.equal(await page.locator('.source-link').getAttribute('href'),'https://m.blog.naver.com/PostList.naver?blogId=kimhsu1');
  await fill(page);await upload(page);await clip(page);await save(page);await page.reload();await ready(page);
  assert.equal(await page.locator('[data-field="title"]').inputValue(),'실제 수업 문제');assert.match(await page.locator('.file-picker').innerText(),/lesson.wav/);
  assert.equal(await page.locator('[data-time="start"]').inputValue(),'00:01');assert.equal(await page.locator('[data-time="end"]').inputValue(),'00:04');
  await mode(page,'run');await click(page,'play');await page.waitForFunction(()=>media.time>1.5);
  await page.evaluate(()=>window.mediaNode=document.querySelector('#local-media'));
  const before=await page.evaluate(()=>media.time);await click(page,'random-letter');await click(page,'timer');await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>media.time)>before+0.4);assert.equal(await page.evaluate(()=>window.mediaNode===document.querySelector('#local-media')),true);
  await page.waitForFunction(()=>!playing && media.time>=4);assert.ok(await page.evaluate(()=>media.time)<4.3);
  await click(page,'play');await page.waitForFunction(()=>playing && media.time>=1 && media.time<3);
  await click(page,'play');assert.equal(await page.evaluate(()=>media.local.paused),true);
  await click(page,'initials');assert.ok(await page.locator('.tile.initial').count()>0);await click(page,'undo');assert.equal(await page.locator('.tile.initial').count(),0);
  await mode(page,'prepare');await click(page,'duplicate');await flush(page);assert.equal(await page.locator('.problem-item').count(),2);await save(page);
  await page.reload();await ready(page);assert.match(await page.locator('[data-field="title"]').inputValue(),/복사/);assert.match(await page.locator('.file-picker').innerText(),/lesson.wav/);
  page.once('dialog',dialog=>dialog.accept());await click(page,'delete');await page.waitForFunction(()=>problems.length===1);await flush(page);await page.reload();await ready(page);
  assert.equal(await page.locator('.problem-item').count(),1);assert.match(await page.locator('.file-picker').innerText(),/lesson.wav/);
  await mode(page,'rules');await click(page,'edit-rules');await page.locator('[data-rule="0"][data-part="body"]').fill('직접 고친 규칙');await click(page,'edit-rules');await flush(page);await page.reload();await ready(page);await mode(page,'rules');assert.equal(await page.locator('.rule-card p').first().innerText(),'직접 고친 규칙');
  await mode(page,'prepare');await page.evaluate(()=>{window.originalSave=store.save.bind(store);store.save=async()=>{throw new DOMException('quota','QuotaExceededError');};});
  await page.locator('[data-field="title"]').fill('실패 후 복구');await click(page,'save');await page.waitForFunction(()=>!document.querySelector('#storage-error').hidden);
  assert.equal(await page.locator('#save-status').innerText(),'변경사항 있음');
  assert.equal(await page.evaluate(async()=>(await store.load()).workspace.problems[0].title),'실제 수업 문제');
  await page.evaluate(()=>store.save=window.originalSave);await click(page,'retry-save');await flush(page);await save(page);await page.reload();await ready(page);assert.equal(await page.locator('[data-field="title"]').inputValue(),'실패 후 복구');
  await click(page,'add');await fill(page,'링크 음원');await page.locator('[data-action="source"][data-source="link"]').click();await page.locator('[data-field="url"]').fill(fixture);await page.locator('[data-field="url"]').press('Tab');await page.waitForFunction(()=>current().duration===12);await clip(page);await save(page);await page.reload();await ready(page);await mode(page,'run');await click(page,'play');await page.waitForFunction(()=>media.time>1.5);assert.ok(await page.evaluate(()=>playing));
  await mode(page,'prepare');await page.locator('[data-field="url"]').fill('javascript:alert(1)');await page.locator('[data-field="url"]').press('Tab');await click(page,'open-link');assert.match(await page.locator('#toast').innerText(),/올바른/);
  await page.locator('[data-field="url"]').fill(fixture);await page.locator('[data-field="url"]').press('Tab');await flush(page);
  for(const width of [1440,1041,817,650,390,320]){await page.setViewportSize({width,height:827});for(const value of ['prepare','rules','run']){await mode(page,value);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px ${value}`);assert.ok(await page.locator('.source-link').isVisible());}}
  console.log('PASS: production CRUD persistence, file restore, actual clipped WAV playback, hint/timer continuity, copy/delete audio isolation, persistent rules, quota failure/retry, direct media URL playback, URL validation, source links and responsive layouts.');

  const legacy=await newPage();await legacy.goto(base);await ready(legacy);
  const dataUrl='data:audio/wav;base64,'+wav.toString('base64');
  const old={lesson:{title:'놀라운 수요일',unit:'이전 수업',songUrl:''},savedProblems:[{id:'old-a',title:'저장한 원본',lyrics:'가나 다',timeRange:'00:01 - 00:04',sourceType:'file'}],customProblem:{savedId:'old-a',title:'수정 중인 문제',lyrics:'가나 다\n라 마바',timeRange:'00:01 - 00:04',sourceType:'file'},selectedProblemId:'custom-problem',rulesText:'규칙 A\n직접 적은 규칙\n\n규칙 B\n나머지 규칙',timer:{defaultSeconds:75}};
  await legacy.evaluate(async({old,dataUrl})=>{
    store.db.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase('wow-wednesday-app');request.onsuccess=resolve;request.onerror=()=>reject(request.error);});
    localStorage.setItem('wow-wednesday-maker-v4',JSON.stringify(old));
    await new Promise((resolve,reject)=>{const request=indexedDB.open('wow-wednesday-audio',1);request.onupgradeneeded=()=>request.result.createObjectStore('audio-files',{keyPath:'id'});request.onsuccess=()=>{const db=request.result;const tx=db.transaction('audio-files','readwrite');tx.objectStore('audio-files').put({id:'old-a',audioName:'old.wav',audioDataUrl:dataUrl});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});
  },{old,dataUrl});
  await legacy.reload();await ready(legacy);assert.equal(await legacy.locator('[data-field="title"]').inputValue(),'수정 중인 문제');assert.match(await legacy.locator('.file-picker').innerText(),/old.wav/);assert.equal(await legacy.evaluate(()=>saved.get('old-a').title),'저장한 원본');
  assert.equal(await legacy.evaluate(()=>localStorage.getItem('wow-wednesday-maker-v4')),JSON.stringify(old));assert.equal(await legacy.evaluate(()=>timerDefault),75);
  await mode(legacy,'run');await click(legacy,'play');await legacy.waitForFunction(()=>media.time>1.5);assert.ok(await legacy.evaluate(()=>playing));await mode(legacy,'rules');assert.equal(await legacy.locator('.rule-card p').first().innerText(),'직접 적은 규칙');await flush(legacy);await legacy.reload();await ready(legacy);assert.equal(await legacy.locator('[data-field="title"]').inputValue(),'수정 중인 문제');assert.match(await legacy.locator('.file-picker').innerText(),/old.wav/);
  console.log('PASS: legacy localStorage/IndexedDB import retains saved and unsaved versions, audio, selected problem, custom rules and timer; original localStorage remains byte-for-byte unchanged; migrated audio plays after reload.');
  const youtube=await newPage();
  await youtube.context().route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:`
    window.youtubeCalls=[];
    window.YT={Player:class {
      constructor(mount,options){this.options=options;this.clip={startSeconds:options.playerVars.start,endSeconds:options.playerVars.end};this.clock=0;this.state=5;this.node=document.createElement('iframe');this.node.title='YouTube API test';mount.replaceWith(this.node);setTimeout(()=>options.events.onReady({target:this}),0);}
      cueVideoById(options){this.clip=options;this.clock=options.startSeconds;this.pauseVideo();window.youtubeCalls.push(['cue',options]);this.options.events.onStateChange({data:5,target:this});}
      loadVideoById(options){this.clip=options;this.clock=options.startSeconds;window.youtubeCalls.push(['play',options]);this.playVideo();}
      getDuration(){return this.revealDuration?12:0;}getCurrentTime(){return this.clock;}
      playVideo(){clearInterval(this.interval);this.revealDuration=true;this.state=1;this.options.events.onStateChange({data:1,target:this});this.interval=setInterval(()=>{this.clock+=0.1;},100);}
      pauseVideo(){clearInterval(this.interval);this.state=2;this.options.events.onStateChange({data:2,target:this});}
      destroy(){clearInterval(this.interval);this.node.remove();}
    }};window.onYouTubeIframeAPIReady();
  `}));
  await youtube.goto(base);await ready(youtube);await fill(youtube,'YouTube 문제');await youtube.locator('[data-action="source"][data-source="link"]').click();await youtube.locator('[data-field="url"]').fill('https://youtu.be/IR-YUXrNyn0');await youtube.locator('[data-field="url"]').press('Tab');await youtube.waitForFunction(()=>media.player?.clip);await click(youtube,'play');await youtube.waitForFunction(()=>current().duration===12&&playing&&media.time>0.3);await click(youtube,'play');await clip(youtube);await save(youtube);
  await mode(youtube,'run');await click(youtube,'play');await youtube.waitForFunction(()=>playing&&media.time>1.4);
  await youtube.evaluate(()=>{window.iframeNode=document.querySelector('#youtube-media iframe');window.iframeWindow=window.iframeNode.contentWindow;});
  const youtubeBefore=await youtube.evaluate(()=>media.time);await click(youtube,'initials');await click(youtube,'timer');await youtube.waitForTimeout(650);
  assert.ok(await youtube.evaluate(()=>media.time)>youtubeBefore+0.4);assert.equal(await youtube.evaluate(()=>window.iframeNode===document.querySelector('#youtube-media iframe')&&window.iframeWindow===window.iframeNode.contentWindow),true);
  assert.equal(await youtube.evaluate(()=>window.youtubeCalls.filter(([name])=>name==='play').length),2);
  await youtube.waitForFunction(()=>!playing&&media.time>=4);
  const youtubeClip=await youtube.evaluate(()=>window.youtubeCalls.filter(([name])=>name==='play').at(-1)[1]);assert.equal(youtubeClip.startSeconds,1);assert.equal(youtubeClip.endSeconds,4);
  await mode(youtube,'prepare');assert.equal(await youtube.evaluate(()=>window.iframeNode===document.querySelector('#youtube-media iframe')),true);
  await youtube.reload();await ready(youtube);assert.equal(await youtube.locator('[data-field="url"]').inputValue(),'https://youtu.be/IR-YUXrNyn0');await mode(youtube,'run');await click(youtube,'play');await youtube.waitForFunction(()=>playing&&media.time>1.4);
  console.log('PASS: YouTube IFrame API contract (stubbed): saved link restoration, exact start/end arguments, player/iframe identity and playback survive hints/timer and mode changes, end-of-clip pause.');
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
