export function levenshtein(a:string,b:string){const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const n=[i];for(let j=1;j<=b.length;j++)n[j]=Math.min(n[j-1]+1,d[j]+1,d[j-1]+(a[i-1]===b[j-1]?0:1));d.splice(0,d.length,...n)}return d[b.length]}
export function normalizeAnswer(value:string){return value.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"").toLocaleLowerCase().trim()}
export function similarity(a:string,b:string){
 const compactA=normalizeAnswer(a), compactB=normalizeAnswer(b);
 if(compactA===compactB && compactA) return 1;
 if(!compactA||!compactB)return 0;
 const tokenA=a.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").trim().split(/\s+/).filter(Boolean);
 const tokenB=b.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").trim().split(/\s+/).filter(Boolean);
 if(tokenA.join("")===tokenB.join("")) return 1;
 let matched=0; for(const x of tokenA) if(tokenB.some(y=>x===y||levenshtein(x,y)/Math.max(x.length,y.length)<=.2))matched++;
 return matched/Math.max(tokenA.length,tokenB.length);
}
export function scoreAge(g:string,c:string){const a=Number(String(g).replace(/\s/g,"")),b=Number(String(c).replace(/\s/g,""));if(!Number.isFinite(a)||!Number.isFinite(b)||b<=0)return 0;return Math.max(0,1-Math.abs(a-b)/b)}
export function isCorrect(k:string,g:string,c:string){return(k==="age"?scoreAge(g,c):similarity(g,c))>=.9}
