/* NIRCam rigid SIAF attitude geometry. PA is North through East to V3. */
(function(root){
'use strict';
const rad=Math.PI/180;
const mul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((v,x,k)=>v+x*b[k][j],0)));
const turn=(axis,degrees)=>{const c=Math.cos(degrees*rad),s=Math.sin(degrees*rad);return axis===1?[[1,0,0],[0,c,-s],[0,s,c]]:axis===2?[[c,0,s],[0,1,0],[-s,0,c]]:[[c,-s,0],[s,c,0],[0,0,1]];};
const unit=(a,d)=>[Math.cos(a*rad)*Math.cos(d*rad),Math.sin(a*rad)*Math.cos(d*rad),Math.sin(d*rad)];
const apply=(m,v)=>m.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
const angles=v=>[(Math.atan2(v[1],v[0])/rad+360)%360,Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad];
function attitude(g,ra,dec,pa){return [turn(3,ra),turn(2,-dec),turn(1,-pa),turn(2,g.v3/3600),turn(3,-g.v2/3600)].reduce(mul);}
function polygons(g,ra,dec,pa){const m=attitude(g,ra,dec,pa);return g.detectors.map(d=>({name:d.name,channel:d.channel,points:d.corners.map(c=>angles(apply(m,unit(c[0]/3600,c[1]/3600))))}));}
function pointIn(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function selector(g,ra,dec,pa,coverage='joint'){const m=attitude(g,ra,dec,pa);const inv=m[0].map((_,i)=>m.map(row=>row[i]));return row=>{const a=angles(apply(inv,row.unit||unit(row.ra,row.dec)));const p=[(a[0]>180?a[0]-360:a[0])*3600,a[1]*3600];let sw=false,lw=false;for(const d of g.detectors){if(pointIn(p,d.corners)){if(d.channel==='SW')sw=true;else lw=true;}}return coverage==='SW'?sw:coverage==='LW'?lw:sw&&lw;};}
function filter(rows,options){return rows.filter(r=>{if(options.membership==='members'&&r.member!=='Y')return false;if(options.membership==='possible'&&!['Y','?'].includes(r.member))return false;if(options.membership==='probable'&&!(r.member==='Y'||r.probability>=options.probability))return false;if(options.screen&&(!Number.isFinite(r.K)||r.K<options.kmin))return false;return true;});}
function merge(deep,wide){const byId=new Map(deep.map(r=>[r.id,{...r}]));const extra=[];for(const w of wide){if(w.deepMatch&&byId.has(w.deepMatch)){const d=byId.get(w.deepMatch);if(Number.isFinite(w.probability))d.probability=Math.max(d.probability||0,w.probability);d.gaiaID=w.id;}else extra.push(w);}return [...byId.values(),...extra];}
root.SkyGeometry={attitude,polygons,selector,pointIn,unit,filter,merge};if(typeof module!=='undefined')module.exports=root.SkyGeometry;
})(typeof window==='undefined'?globalThis:window);
