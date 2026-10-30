/// <reference lib="webworker" />
import {estimatePlastic,type PlasticGeometry,type PlasticOptions,type PlasticSettings} from '@/lib/plasticEstimate';
self.onmessage=(event:MessageEvent<{geometry:PlasticGeometry;settings:PlasticSettings;options?:PlasticOptions}>)=>{
 try{self.postMessage({result:estimatePlastic(event.data.geometry,event.data.settings,event.data.options)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
