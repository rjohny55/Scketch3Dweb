import {afterEach,it,expect,vi} from 'vitest';
import {estimatePlasticInWorker} from '@/lib/plasticEstimateClient';
import {DEFAULT_PLASTIC_SETTINGS} from '@/lib/plasticEstimate';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('does not create a worker for aborted or expired requests',async()=>{
 const create=vi.fn();vi.stubGlobal('Worker',create);const abort=new AbortController();abort.abort();
 await expect(estimatePlasticInWorker({bodies:[],warnings:[]},DEFAULT_PLASTIC_SETTINGS,abort.signal)).rejects.toMatchObject({name:'AbortError'});
 await expect(estimatePlasticInWorker({bodies:[],warnings:[]},DEFAULT_PLASTIC_SETTINGS,undefined,Date.now()-1)).rejects.toThrow(/истёк/);expect(create).not.toHaveBeenCalled();
});
it('terminates the worker when the caller cancels a calculation',async()=>{
 const fake={onmessage:null,onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};vi.stubGlobal('Worker',class{constructor(){return fake;}});
 const abort=new AbortController(),pending=estimatePlasticInWorker({bodies:[],warnings:[]},DEFAULT_PLASTIC_SETTINGS,abort.signal);abort.abort();
 await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(fake.terminate).toHaveBeenCalledOnce();
});
it('times out a stuck calculation and releases the worker',async()=>{
 vi.useFakeTimers();const fake={onmessage:null,onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};vi.stubGlobal('Worker',class{constructor(){return fake;}});
 const pending=estimatePlasticInWorker({bodies:[],warnings:[]},DEFAULT_PLASTIC_SETTINGS,undefined,Date.now()+1000),failure=expect(pending).rejects.toThrow(/слишком много времени/);
 await vi.advanceTimersByTimeAsync(1000);await failure;expect(fake.terminate).toHaveBeenCalledOnce();
});
