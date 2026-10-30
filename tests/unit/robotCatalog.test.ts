import {afterEach,it,expect,vi} from 'vitest';
import {loadRobotCatalogShape} from '@/lib/robotCatalogClient';
import {ROBOT_CATALOG} from '@/lib/robotCatalog';
import {shapeCatalogCategories,toolbarShapeAssets} from '@/lib/shapeCatalog';
const preset=ROBOT_CATALOG.models[0].id;
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('partitions every preset into exactly one expandable category',()=>{
 const ids=shapeCatalogCategories.flatMap(category=>category.assets.map(asset=>asset.id));
 expect(new Set(ids).size).toBe(ids.length);expect(ids.slice().sort()).toEqual(toolbarShapeAssets.map(a=>a.id).sort());
 expect(shapeCatalogCategories.map(c=>[c.id,c.assets.length])).toEqual([['basic',6],['rounded',5],['profiles',4],['mechanical',6],['text',1],['robot',51]]);
 expect(ROBOT_CATALOG.models.filter(m=>!m.meshValidation.basicChecksPass).map(m=>m.code)).toEqual(['YCL.M000823-02','YCL.M000976','YCL.M000977']);
});
function fakeWorker(){const fake={onmessage:null as null|((event:unknown)=>void),onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};vi.stubGlobal('Worker',class{constructor(){return fake;}});vi.stubGlobal('window',{location:{origin:'http://localhost'}});return fake;}
it('does not start an unknown, cancelled or expired request',async()=>{
 const fake=fakeWorker(),abort=new AbortController();abort.abort();
 await expect(loadRobotCatalogShape('unknown')).rejects.toThrow('Unknown');
 await expect(loadRobotCatalogShape(preset,abort.signal)).rejects.toMatchObject({name:'AbortError'});
 await expect(loadRobotCatalogShape(preset,undefined,Date.now()-1)).rejects.toThrow('timed out');expect(fake.postMessage).not.toHaveBeenCalled();
});
it('terminates a cancelled request and ignores its late reply',async()=>{
 const fake=fakeWorker(),abort=new AbortController(),pending=loadRobotCatalogShape(preset,abort.signal);abort.abort();
 await expect(pending).rejects.toMatchObject({name:'AbortError'});fake.onmessage!({data:{}});expect(fake.terminate).toHaveBeenCalledOnce();
});
it('times out a stalled download and releases its worker',async()=>{
 vi.useFakeTimers();const fake=fakeWorker(),pending=loadRobotCatalogShape(preset,undefined,Date.now()+1000),failure=expect(pending).rejects.toThrow('timed out');
 await vi.advanceTimersByTimeAsync(1000);await failure;expect(fake.terminate).toHaveBeenCalledOnce();
});
it('rejects a malformed worker message instead of leaving loading pending',async()=>{
 const fake=fakeWorker(),pending=loadRobotCatalogShape(preset);fake.onmessage!({data:{}});
 await expect(pending).rejects.toThrow('Invalid robot model response');expect(fake.terminate).toHaveBeenCalledOnce();
});
