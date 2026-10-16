const {test}=require('node:test');const assert=require('node:assert/strict');
const fixture=`$timescale 1 ns $end
$scope module tb $end
$scope module dut $end
$var wire 1 ! clk $end
$var wire 4 # data [3:0] $end
$var wire 4 # alias [3:0] $end
$upscope $end
$upscope $end
$enddefinitions $end
$dumpvars
0!
bxxxx #
$end
#5
1!
b0011 #
#10
0!
bzzzz #
#15
1!
b1111 #
#20
0!
`;
test('VCD parses hierarchy, aliases, X/Z and sample values',async()=>{const {parseVcd,valueAt,edgeTimes}=await import('../shared/waveform.mjs');const wave=parseVcd(fixture);assert.equal(wave.timescale,'1 ns');assert.equal(wave.endTime,20);assert.equal(wave.signals[1].name,'tb.dut.data[3:0]');assert.equal(wave.signals[2].changes,wave.signals[1].changes);assert.equal(valueAt(wave.signals[1],4),'xxxx');assert.equal(valueAt(wave.signals[1],5),'0011');assert.equal(valueAt(wave.signals[1],10),'zzzz');assert.deepEqual(edgeTimes(wave.signals[0],'rising'),[5,15]);assert.equal(valueAt(wave.signals[1],5,'before'),'xxxx');});
test('VCD rejects invalid time, missing declarations, oversized traces and incomplete records',async()=>{const {parseVcd}=await import('../shared/waveform.mjs');assert.throws(()=>parseVcd('garbage'),/VCD/i);assert.throws(()=>parseVcd(fixture.replace('#15','#-1')),/time/i);assert.throws(()=>parseVcd(fixture,{maxChanges:2}),/limit/i);assert.throws(()=>parseVcd(fixture+'b1010'),/incomplete/i);});
test('VCD sampling returns real cursor evidence with hierarchy and previous values',async()=>{const {parseVcd,sampleWaveform}=await import('../shared/waveform.mjs');const samples=sampleWaveform(parseVcd(fixture),15,['tb.dut.data[3:0]']);assert.equal(samples.signals[0].value,'1111');assert.equal(samples.signals[0].before,'zzzz');});
test('malformed binary values are rejected rather than displayed as simulated data',async()=>{const {parseVcd}=await import('../shared/waveform.mjs');assert.throws(()=>parseVcd(fixture.replace('b0011 #','bfoo #')),/value/i);});
test('real VCD data remains decimal rather than being interpreted as binary bits',async()=>{const {parseVcd,valueAt,formatValue}=await import('../shared/waveform.mjs');const wave=parseVcd('$scope module tb $end\n$var real 1 ! threshold $end\n$upscope $end\n$enddefinitions $end\n#0\nr10 !\n');const signal=wave.signals[0];assert.equal(formatValue(valueAt(signal,0),'dec',false,signal.kind),'10');});
