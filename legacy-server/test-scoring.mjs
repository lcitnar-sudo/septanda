import fs from 'node:fs';
import assert from 'node:assert/strict';
import {puzzles as pool,engine as E,daily as D} from './game.mjs';
const byId=new Map(pool.map(p=>[p.id,p]));let checks=0;
function test(value,message){assert(value,message);checks++;}
const cases=[
['poem-bouquet','zemřela matak do hrobu dána, siroty po ní zůstaly',true],
['poem-bouquet','zemřela matka do hrobu dána, siroty po ní zůstaly, přicházely každičkého rána a matičku svou hledaly',true],
['poem-bouquet','Zemřela matka do hrobu dána, siroty po ní zůstaly.',true],
['poem-bouquet','Zemřela matka a do hrobu dána, siroty po ní zůstaly. přicházely každičkého rána a matičku svou hledaly.',true],
['poem-bouquet','zemřela matka do hrobu dána',false],
['poem-bouquet','Zemřela matka a do hrobu dána, siroty po ní nezůstaly.',false],
['poem-bouquet','Matka zemřela, děti teď nemají rodiče.',false],
['caesar-victory','Prisell jsem videl jsem zvitezil jsem',true],
['caesar-victory','Přišel jsem, viděl jsem a odešel.',false],
['caesar-victory','Přišel jsem, viděl jsem, prohrál jsem.',false],
['caesar-victory','Nepřišel jsem, neviděl jsem, nezvítězil jsem.',false],
['caesar-victory','Není pravda, že přišel jsem viděl jsem zvítězil jsem.',false],
['proverb-work','Bez práce jsou koláče.',false],
['proverb-work','Bez práce nejsu koláče.',true],
['proverb-pit','Kdo jinému jámu kopá, sám do ní nepadá.',false],
['proverb-pit','Kdo jinému jámu kope, sám do ní spadne.',true],
['proverb-measure','Jednou měř, dvakrát řež.',false],
['proverb-measure','Dvakrát měř, dvakrát řež.',false],
['descartes','Nemyslím, tedy nejsem.',false],
['descartes','Myslím tedy sjem.',true],
['poem-noon','U lavcie dítě stálo, z plna hrdla křičelo.',true],
['poem-noon','U lavice dítě stálo, z plna hrdla mlčelo.',false],
['poem-may','Byl pozdní večer první máj večerní máj byl lásky čas. Hrdliččin zval ku lásce hlas.',true],
['poem-may','Byl pozdní večer první prosinec večerní prosinec byl lásky čas.',false],
];
const scores=cases.map(([id,text,accepted])=>{const score=E.evaluate(text,byId.get(id));test(score.accepted===accepted,id+': '+text+' '+JSON.stringify(score));test(score.accepted===(score.total>=97),'threshold consistency');return {text,score};});
for(const p of pool){
 for(const text of [p.answer,...p.variants]){const s=E.evaluate(text,p);test(s.accepted && s.total===100,p.id+' known variant');}
 for(const text of p.paraphrases)test(!E.evaluate(text,p).accepted,p.id+' paraphrase: '+text);
 test(!E.evaluate('',p).accepted,p.id+' blank');
 test(!E.evaluate('Xylophonistický náklaďák s ananasem parkuje v galaxii.',p).accepted,p.id+' unrelated');
 test(!E.evaluate(p.answer.split(' ').reverse().join(' '),p).accepted,p.id+' shuffled words');
}
const raw=D.createState(null),day=D.ensureDay(raw,'2026-10-15'),r=D.roundFor(day);
const first='zemřela matka do hrobu dána',second=cases[0][1],third=cases[1][1];
r.attempts=[first,second,third].map((text,i)=>({text,time:i,score:{total:0}}));r.draft='další rozepsaný tip';r.hints=['clue'];
const migrated=D.sanitizeState(JSON.parse(JSON.stringify(raw))),result=migrated.days['2026-10-15'].progress['poem-bouquet'];
test(result.attempts.length===3,'all historical attempts preserved after regrading');test(result.draft===r.draft,'draft preserved');test(result.status==='won','recognized historical answer wins');test(D.totals(migrated).points===250,'award once minus actual hint');
test(D.totals(D.sanitizeState(JSON.parse(JSON.stringify(migrated)))).points===250,'no repeated award after reload');
r.status='revealed';test(D.sanitizeState(raw).days['2026-10-15'].progress['poem-bouquet'].status==='revealed','no retroactive reward on revealed puzzle');
const report={checks,scores};console.log(JSON.stringify({scoringChecks:checks,playerExamples:scores.slice(0,4)},null,2));
