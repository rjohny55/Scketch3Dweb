import data from './robotCatalogData.json';
export const ROBOT_CATALOG=data;
export const robotShapeAssets=data.models.map(model=>({id:model.id,name:`${model.code} · ${model.name}`,src:model.thumbnailUrl,menuIcon:model.thumbnailUrl,kind:'mesh' as const,color:'#7b9aca'}));
export function robotCatalogModel(id:string){return data.models.find(model=>model.id===id);}
