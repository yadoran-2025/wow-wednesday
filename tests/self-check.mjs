import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const element={innerHTML:'',addEventListener(){}};
const context=vm.createContext({
  document:{querySelector:()=>element,addEventListener(){},body:{}},
  window:{addEventListener(){}},ResizeObserver:class{observe(){}},
  structuredClone,crypto:webcrypto,setInterval(){},setTimeout(){},clearTimeout(){},URL,Blob
});
for(const file of ['storage.js','media.js','app.js']){
  let source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  if(file==='app.js')source=source.replace(/startApp\(\);\s*$/,'');
  vm.runInContext(source,context);
}
const evaluate=source=>vm.runInContext(source,context);
evaluate('problems=[emptyProblem()];selectedId=problems[0].id');
assert.equal(evaluate('time(180)'),'03:00');
for(const invalid of ['abc','1:60','-1:20','1:2',''])assert.ok(Number.isNaN(evaluate(`parseTime(${JSON.stringify(invalid)})`)));
assert.equal(evaluate('parseTime("01:02")'),62);
assert.equal(evaluate('esc("<img src=x onerror=alert(1)>")'),'&lt;img src=x onerror=alert(1)&gt;');
evaluate('current().lyrics="가나 다\\n라 마바!"');
assert.match(evaluate('renderBoard(false,true)'),/data-index="5" aria-label="4번째 글자 공개"/);
assert.equal(evaluate('JSON.stringify(letterGroups())'),'[[0,1],[3],[5],[7,8]]');
evaluate('revealLetters([0]);revealLetters([0,1]);undoHint()');
assert.equal(evaluate('JSON.stringify([...revealed])'),'[0]');
evaluate('initialsVisible=true');
assert.match(evaluate('renderBoard(false,true)'),/class="tile initial"/);
assert.doesNotMatch(evaluate('renderBoard(false,false)'),/class="tile initial"|class="tile open"/);
for(const [char,initial] of [['가','ㄱ'],['까','ㄲ'],['땅','ㄸ'],['힣','ㅎ'],['A',''],['7','']])assert.equal(evaluate(`initialConsonant(${JSON.stringify(char)})`),initial);
for(const url of ['https://youtu.be/IR-YUXrNyn0?t=42','https://www.youtube.com/watch?v=IR-YUXrNyn0','https://m.youtube.com/shorts/IR-YUXrNyn0'])assert.equal(evaluate(`youtubeId(${JSON.stringify(url)})`),'IR-YUXrNyn0');
for(const url of ['https://youtube.com.evil.test/watch?v=IR-YUXrNyn0','https://evil.test/embed/IR-YUXrNyn0','javascript:alert(1)'])assert.equal(evaluate(`youtubeId(${JSON.stringify(url)})`),'');
for(const url of ['javascript:alert(1)','data:text/html,test','https://name:password@example.com/song.mp3'])assert.throws(()=>evaluate(`mediaLink(${JSON.stringify(url)})`));
assert.equal(evaluate('legacySeconds("01:02:03")'),3723);
assert.equal(evaluate('legacySeconds("")'),null);
assert.equal(evaluate('legacyProblem({id:"old",title:"원래 문제",lyrics:"가",timeRange:"00:42 - 01:02",sourceType:"file"}).end'),62);
assert.equal(evaluate('legacyProblem({id:"old",title:"원래 문제",lyrics:"가",timeRange:"00:42 - 01:02",sourceType:"file"}).source'),'file');
console.log('PASS: timestamps, escaping, multiline hint indices, grouped undo, preview isolation, Korean initials, URL validation, YouTube IDs, legacy conversion.');
