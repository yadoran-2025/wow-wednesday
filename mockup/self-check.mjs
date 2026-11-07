import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise formatting and board generation without adding a test dependency.
const app = { innerHTML: '' };
const context = vm.createContext({
  document: { querySelector: () => app, addEventListener() {} },
  window: { addEventListener() {} },
  Audio: class { addEventListener() {} },
  structuredClone,
  setInterval() {},
});
vm.runInContext(readFileSync(new URL('./app.js', import.meta.url), 'utf8'), context);
const evaluate = (source) => vm.runInContext(source, context);

assert.equal(evaluate('time(180)'), '03:00');
assert.equal(evaluate('parseTime("01:02")'), 62);
for (const invalid of ['abc', '1:60', '-1:20', '1:2', '']) {
  assert.ok(Number.isNaN(evaluate(`parseTime(${JSON.stringify(invalid)})`)));
}
assert.equal(evaluate('esc("<img src=x onerror=alert(1)>")'), '&lt;img src=x onerror=alert(1)&gt;');
evaluate('current().lyrics = "가나 다\\n라 마바!"');
const board = evaluate('renderBoard(false, true)');
assert.equal((board.match(/class="tile /g) || []).length, 6);
assert.match(board, /data-index="5" aria-label="4번째 글자 공개"/);
evaluate('revealed.add(5)');
assert.match(evaluate('renderBoard(false, true)'), /class="tile open" disabled>라<\/button>/);
assert.doesNotMatch(evaluate('renderBoard(false, false)'), /class="tile open"/);
assert.equal((evaluate('renderBoard(true, false)').match(/class="tile open"/g) || []).length, 6);
for (const [char,initial] of [['가','ㄱ'],['까','ㄲ'],['땅','ㄸ'],['힣','ㅎ'],['A',''],['7',''],['ㄱ','']]) {
  assert.equal(evaluate(`initialConsonant(${JSON.stringify(char)})`),initial);
}
assert.equal(evaluate('JSON.stringify(letterGroups())'),'[[0,1],[3],[5],[7,8]]');
evaluate('revealed.clear();revealHistory=[];revealLetters([0]);revealLetters([0,1]);undoHint()');
assert.equal(evaluate('JSON.stringify([...revealed])'),'[0]');
evaluate('undoHint();undoHint()');
assert.equal(evaluate('revealed.size'),0);
evaluate('initialsVisible=true');
assert.match(evaluate('renderBoard(false,true)'), /class="tile initial"[^>]*>ㄱ<\/button>/);
assert.doesNotMatch(evaluate('renderBoard(false,false)'), /class="tile initial"/);
evaluate('revealHistory.push({type:"initials",visible:false});undoHint()');
assert.equal(evaluate('initialsVisible'),false);
evaluate('current().lyrics="가 A7\\n나";initialsVisible=true');
assert.equal((evaluate('renderBoard(false,true)').match(/class="tile initial"/g)||[]).length,2);
assert.doesNotMatch(evaluate('renderBoard(false,true)'), />A<|>7<\/button>/);
evaluate('current().lyrics="  !\\n   "');
assert.equal(evaluate('letterGroups().length'),0);
console.log('PASS: timestamps, escaping, multiline indices, preview isolation, consonants, word groups, undo preserving previous letters, mixed-language masking.');
