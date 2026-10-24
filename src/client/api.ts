export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T> {
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data=await response.json(); if(!response.ok) throw new ApiError(response.status,data.error??'La demande a échoué.'); return data;
}
export const bytes=(value:number)=>value>=1_000_000_000?`${(value/1_000_000_000).toFixed(1)} Go`:value>=1_000_000?`${(value/1_000_000).toFixed(1)} Mo`:value>=1000?`${Math.ceil(value/1000)} ko`:`${value} o`;
export const date=(value:number)=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(value);
export const localDate=(value:number)=>{const d=new Date(value);return new Date(value-d.getTimezoneOffset()*60_000).toISOString().slice(0,16);};
export function upload(path:string,file:File,progress:(percent:number)=>void):Promise<void> {
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api'+path);
    xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-File-Size',String(file.size));
    xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve();else{let message='Le dépôt a échoué.';try{message=JSON.parse(xhr.responseText).error??message;}catch{}reject(new Error(message));}};
    xhr.onerror=()=>reject(new Error('Connexion interrompue pendant le dépôt.'));
    xhr.timeout=10*60*1000;xhr.ontimeout=()=>reject(new Error('Le dépôt a pris trop de temps. Réessayez.'));
    xhr.send(file);
  });
}
