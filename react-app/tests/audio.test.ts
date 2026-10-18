import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokerAudio, readSoundPreferences } from '../src/audio/pokerAudio.ts';
import { soundEvents, type SoundSnapshot } from '../src/audio/soundEvents.ts';

const base: SoundSnapshot = {actions:[], boardCount:0, handOver:false, heroTurn:false, heroWon:false};
test('initial deal has exactly two deal cues; blind posts are silent', () => {
  const result = soundEvents(null,{...base, actions:[{action:'sb'},{action:'bb'}],heroTurn:true},true);
  assert.deepEqual(result.map(e=>e.kind),['deal','deal','turn']);
});
test('rerenders and resuming unchanged state do not replay sounds', () => {
  const state = {...base,actions:[{action:'call'}],heroTurn:true};
  assert.deepEqual(soundEvents(state,state),[]);
});
test('only new actions play, and returning hero gets one turn cue', () => {
  const previous = {...base,actions:[{action:'call'}]};
  const next = {...base,actions:[{action:'call'},{action:'raise'}],heroTurn:true};
  assert.deepEqual(soundEvents(previous,next).map(e=>e.kind),['raise','turn']);
});
test('flop plays three flips, river one; settlement waits for flips', () => {
  assert.equal(soundEvents(base,{...base,boardCount:3}).filter(e=>e.kind==='flip').length,3);
  const events = soundEvents({...base,boardCount:4},{...base,boardCount:5,handOver:true,heroWon:true});
  assert.deepEqual(events.map(e=>e.kind),['flip','win']);
  assert.ok(events[1].delay > events[0].delay);
});
test('fold then loss uses neutral settlement; does not emit your-turn', () => {
  const events=soundEvents(base,{...base,actions:[{action:'fold'}],handOver:true});
  assert.deepEqual(events.map(e=>e.kind),['fold','end']);
});
function fakeContext() {
  const sources: Array<{stops:number;starts:number;onended: (()=>void)|null;frequency:unknown}> = [];
  const automation: number[] = [];
  const parameter = () => ({value:0,setValueAtTime:(v:number)=>automation.push(v),linearRampToValueAtTime:(v:number)=>automation.push(v),exponentialRampToValueAtTime:(v:number)=>automation.push(v)});
  const node = () => ({connect:()=>{},disconnect:()=>{}});
  const source = () => {const s={...node(),frequency:parameter(),type:'sine',buffer:null,onended:null as (()=>void)|null,starts:0,stops:0,start:()=>{s.starts++;},stop:(when?:number)=>{s.stops++;if(when === undefined)s.onended?.();}}; sources.push(s);return s;};
  const context = {
    state:'running', currentTime:0, sampleRate:8000,destination:{},
    createGain:()=>({...node(),gain:parameter()}),createOscillator:source,createBufferSource:source,
    createBiquadFilter:()=>({...node(),type:'bandpass',frequency:parameter(),Q:parameter()}),
    createBuffer:(_channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)}),
    resume:async()=>{},close:async()=>{context.state='closed';},
  };
  return {context:context as unknown as AudioContext,sources,automation};
}
test('all cues schedule sources; mute immediately stops queued nodes and prevents further sound', async () => {
  const fake=fakeContext();
  const audio=new PokerAudio({createContext:()=>fake.context,visible:()=>true});
  audio.configure({enabled:true,volume:0.4});
  assert.equal(await audio.unlock(),true);
  for (const kind of ['deal','flip','call','raise','check','fold','turn','win','end'] as const) audio.play(kind,0.5);
  assert.ok(fake.sources.length>=15); assert.ok(fake.sources.every(s=>s.starts===1));
  const before = fake.sources.map(s=>s.stops);
  audio.configure({enabled:false,volume:0.4});
  assert.ok(fake.sources.every((s,i)=>s.stops>before[i]));
  const count=fake.sources.length; audio.play('turn'); assert.equal(fake.sources.length,count);
  await audio.dispose(); assert.equal(fake.context.state,'closed');
});
test('hidden pages and zero volume schedule no sound', async () => {
  const fake=fakeContext();let visible=false;
  const audio=new PokerAudio({createContext:()=>fake.context,visible:()=>visible});
  audio.configure({enabled:true,volume:0.4});await audio.unlock();audio.play('raise');
  assert.equal(fake.sources.length,0);visible=true;audio.configure({enabled:true,volume:0});audio.play('turn');assert.equal(fake.sources.length,0);await audio.dispose();
});
test('unsupported audio degrades safely', async () => {
  const audio=new PokerAudio({createContext:()=>{throw new Error('unavailable');},visible:()=>true});
  audio.configure({enabled:true,volume:0.5});assert.equal(await audio.unlock(),false);assert.doesNotThrow(()=>audio.play('turn'));await audio.dispose();
});
test('invalid local preference storage uses safe defaults', () => {
  assert.deepEqual(readSoundPreferences(),{enabled:true,volume:0.4});
});
