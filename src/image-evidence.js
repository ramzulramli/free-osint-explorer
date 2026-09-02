import { imageSearch } from "./search.js";

const IMAGE_LIMITS={maxSources:3,maxImages:15,maxImagesPerSource:5,maxSearchImages:10};

function absoluteUrl(value,base){try{if(!value||String(value).startsWith("data:"))return null;return new URL(String(value).trim(),base).toString();}catch{return null;}}
function cleanImageUrl(value,base){const url=absoluteUrl(value,base);if(!url)return null;try{const u=new URL(url);for(const k of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"])u.searchParams.delete(k);return u.toString();}catch{return url;}}
function attr(tag,name){return tag.match(new RegExp(`\\b${name}\\s*=\\s*[\\"']([^\\"']+)`,"i"))?.[1]||null;}
function bestSrcset(value){if(!value)return null;const items=String(value).split(",").map(x=>x.trim()).filter(Boolean);if(!items.length)return null;return items.map(x=>{const parts=x.split(/\\s+/);const descriptor=parts[1]||"0w";const n=parseInt(descriptor,10)||0;return{url:parts[0],n};}).sort((a,b)=>b.n-a.n)[0]?.url||null;}
function addImage(list,seen,image){if(!image?.url||list.length>=IMAGE_LIMITS.maxImages)return;const key=image.url;if(seen.has(key))return;seen.add(key);list.push(image);}
function queryTokens(query){return String(query||"").toLowerCase().replace(/[^a-z0-9]+/g," ").split(/\\s+/).filter(x=>x.length>=3&&x!=="bin"&&x!=="binti");}
function relevantImage(item,query){const tokens=queryTokens(query);if(!tokens.length)return true;const hay=`${item.title||""} ${item.sourceUrl||""} ${item.snippet||""} ${item.url||""}`.toLowerCase();const hits=tokens.filter(t=>hay.includes(t)).length;const exact=hay.includes(String(query||"").toLowerCase());return exact||hits>=Math.min(2,tokens.length);}
function extractImages(html,page){const images=[],seen=new Set(),text=String(html||"");
  for(const m of text.matchAll(/<meta\\b[^>]*>/gi)){const tag=m[0],property=(attr(tag,"property")||attr(tag,"name")||"").toLowerCase();if(property!=="og:image"&&property!=="twitter:image"&&property!=="twitter:image:src")continue;const url=cleanImageUrl(attr(tag,"content"),page.url);if(url)addImage(images,seen,{url,sourceUrl:page.url,sourceTitle:page.title||"",caption:"Social/preview image"});}
  for(const m of text.matchAll(/<img\\b[^>]*>/gi)){if(images.length>=IMAGE_LIMITS.maxImagesPerSource)break;const tag=m[0],url=cleanImageUrl(bestSrcset(attr(tag,"srcset"))||attr(tag,"data-src")||attr(tag,"data-original")||attr(tag,"src"),page.url);if(!url)continue;const width=parseInt(attr(tag,"width")||"0",10)||0,height=parseInt(attr(tag,"height")||"0",10)||0;if(width&&height&&(width<80||height<80))continue;const caption=(attr(tag,"alt")||attr(tag,"title")||"").trim();addImage(images,seen,{url,sourceUrl:page.url,sourceTitle:page.title||"",caption:caption||"Image found on source page",width:width||null,height:height||null});}
  return images.slice(0,IMAGE_LIMITS.maxImagesPerSource);
}

export async function enrichWithImages(result,env={},provider=null){const images=[],seen=new Set(),subject=result?.subject||result?.query||"";
  const queries=[`"${subject}"`,`"${subject}" LinkedIn`,`"${subject}" profile`];
  for(const query of queries){if(images.length>=IMAGE_LIMITS.maxImages)break;try{const searched=await imageSearch(query,env,IMAGE_LIMITS.maxSearchImages);for(const item of searched.results||[]){if(images.length>=IMAGE_LIMITS.maxImages)break;if(!relevantImage(item,subject))continue;const url=cleanImageUrl(item.url,item.sourceUrl||subject);if(!url)continue;addImage(images,seen,{url,thumbnail:item.thumbnail?cleanImageUrl(item.thumbnail,item.sourceUrl||url):null,sourceUrl:item.sourceUrl||url,sourceTitle:item.title||"Image search result",caption:item.title||"Related image",provider:searched.provider});}}catch{}}
  const sources=Array.isArray(result?.sources)?result.sources.slice(0,IMAGE_LIMITS.maxSources):[];
  for(const source of sources){if(images.length>=IMAGE_LIMITS.maxImages)break;try{const r=await fetch(source.url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; FreeOSINTExplorer/1.2)"}});if(!r.ok)continue;const html=await r.text();for(const image of extractImages(html,source)){if(images.length>=IMAGE_LIMITS.maxImages)break;addImage(images,seen,image);}}catch{}}
  return {...result,images,stats:{...(result.stats||{}),imagesFound:images.length}};
}

export default enrichWithImages;
