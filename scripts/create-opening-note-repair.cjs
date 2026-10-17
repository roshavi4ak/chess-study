/* eslint-disable @typescript-eslint/no-require-imports -- Generates a standalone script for the live Prisma runtime. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.resolve(__dirname, '../backups');
const input = process.argv[2] || 'opening-ending-repairs-2026-10-08.json';
const output = process.argv[3] || 'apply-opening-note-repair-2026-10-08.cjs';
assert.equal(path.basename(input), input, 'Input must be a filename inside backups');
assert.equal(path.basename(output), output, 'Output must be a filename inside backups');
const source = JSON.parse(fs.readFileSync(path.join(directory, input), 'utf8'));
assert(source.repairs.length > 0 && source.repairs.length <= 694);
const repairs = source.repairs.map(({ practiceId, nodeId, fen, move, lineNumber, expectedNotes, notes }) => ({ practiceId, nodeId, fen, move, lineNumber, expectedNotes, notes }));
const payload = Buffer.from(JSON.stringify(repairs)).toString('base64');
const script = `const {PrismaClient}=require('@prisma/client');
const assert=require('node:assert/strict');
const p=new PrismaClient();
const repairs=JSON.parse(Buffer.from('${payload}','base64').toString('utf8'));
const apply=process.argv.includes('--apply');
(async()=>{try{
const result=await p.$transaction(async tx=>{
 if(!apply)await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 const ids=repairs.map(r=>r.nodeId);
 const before=await tx.practiceNode.findMany({where:{id:{in:ids}},include:{_count:{select:{children:true}}}});
 assert.equal(before.length,repairs.length);
 const byId=new Map(before.map(n=>[n.id,n]));
 for(const r of repairs){const n=byId.get(r.nodeId);assert.equal(n.practiceId,r.practiceId);assert.equal(n.fen,r.fen);assert.equal(n.move,r.move);assert.equal(n.lineNumber,r.lineNumber);assert.equal(n._count.children,0);assert.equal(n.notes,r.expectedNotes,'A coach note changed since the backup; refusing to overwrite it');}
 const countsBefore={nodes:await tx.practiceNode.count(),practices:await tx.practice.count(),progress:await tx.practiceLineProgress.count(),attempts:await tx.practiceAttempt.count()};
 if(apply){for(const r of repairs){const update=await tx.practiceNode.updateMany({where:{id:r.nodeId,practiceId:r.practiceId,fen:r.fen,move:r.move,notes:r.expectedNotes,children:{none:{}}},data:{notes:r.notes}});assert.equal(update.count,1);}
 const after=await tx.practiceNode.findMany({where:{id:{in:ids}},include:{_count:{select:{children:true}}}});
 for(const n of after){const old=byId.get(n.id),r=repairs.find(r=>r.nodeId===n.id);assert.equal(n.notes,r.notes);assert.deepEqual({...n,notes:old.notes},old,'A field other than notes changed');}}
 return {mode:apply?'APPLIED':'CHECKED',terminalNotes:repairs.length,practices:new Set(repairs.map(r=>r.practiceId)).size,countsBefore};
},{maxWait:10000,timeout:60000,isolationLevel:'RepeatableRead'});
console.log(JSON.stringify(result));
}finally{await p.$disconnect()}})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1});
`;
fs.writeFileSync(path.join(directory, output), script);
console.log('Created optimistic, notes-only transactional repair script. Run without --apply to check.');
