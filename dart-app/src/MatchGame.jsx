import { useState, useRef, useMemo } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  MATCH GAMEPLAY v3                                         │
  │                                                             │
  │  Fixes:                                                     │
  │  - Scoreboard: MYCKET STÖRRE text, tydlig avg              │
  │  - Score editor: Exakt som referensbild — kompakt grid     │
  │    5 kolumner × 4 rader, Bull/Outer, Ångra/Miss            │
  │    Centrad modal, inte fullskärm                           │
  └─────────────────────────────────────────────────────────────┘
*/

/* ============ CHECKOUT TABLE ============ */
const CK={170:["T20","T20","D-Bull"],167:["T20","T19","D-Bull"],164:["T20","T18","D-Bull"],161:["T20","T17","D-Bull"],160:["T20","T20","D20"],158:["T20","T20","D19"],157:["T20","T19","D20"],156:["T20","T20","D18"],155:["T20","T19","D19"],154:["T20","T18","D20"],153:["T20","T19","D18"],152:["T20","T20","D16"],151:["T20","T17","D20"],150:["T20","T18","D18"],149:["T20","T19","D16"],148:["T20","T20","D14"],147:["T20","T17","D18"],146:["T20","T18","D16"],145:["T20","T19","D14"],144:["T20","T20","D12"],143:["T20","T17","D16"],142:["T20","T14","D20"],141:["T20","T19","D12"],140:["T20","T20","D10"],139:["T20","T13","D20"],138:["T20","T18","D12"],137:["T20","T19","D10"],136:["T20","T20","D8"],135:["T20","T17","D12"],134:["T20","T14","D16"],133:["T20","T19","D8"],132:["T20","T16","D12"],131:["T20","T13","D16"],130:["T20","T18","D8"],129:["T19","T16","D12"],128:["T18","T14","D16"],127:["T20","T17","D8"],126:["T19","T15","D12"],125:["T20","T15","D10"],124:["T20","T16","D8"],123:["T19","T16","D9"],122:["T18","T20","D4"],121:["T20","T11","D14"],120:["T20","S20","D20"],119:["T19","T12","D13"],118:["T20","S18","D20"],117:["T20","S17","D20"],116:["T20","S16","D20"],115:["T20","S15","D20"],114:["T20","S14","D20"],113:["T20","S13","D20"],112:["T20","S12","D20"],111:["T20","S11","D20"],110:["T20","S10","D20"],109:["T20","S9","D20"],108:["T20","S8","D20"],107:["T19","S10","D20"],106:["T20","S6","D20"],105:["T20","S5","D20"],104:["T20","S4","D20"],103:["T19","S6","D20"],102:["T20","S2","D20"],101:["T20","S1","D20"],100:["T20","D20"],99:["T19","S2","D20"],98:["T20","D19"],97:["T19","D20"],96:["T20","D18"],95:["T19","D19"],94:["T18","D20"],93:["T19","D18"],92:["T20","D16"],91:["T17","D20"],90:["T18","D18"],89:["T19","D16"],88:["T20","D14"],87:["T17","D18"],86:["T18","D16"],85:["T19","D14"],84:["T20","D12"],83:["T17","D16"],82:["T14","D20"],81:["T19","D12"],80:["T20","D10"],79:["T13","D20"],78:["T18","D12"],77:["T19","D10"],76:["T20","D8"],75:["T17","D12"],74:["T14","D16"],73:["T19","D8"],72:["T16","D12"],71:["T13","D16"],70:["T18","D8"],69:["T15","D12"],68:["T20","D4"],67:["T17","D8"],66:["T10","D18"],65:["T19","D4"],64:["T16","D8"],63:["T13","D12"],62:["T10","D16"],61:["T15","D8"],60:["S20","D20"],59:["S19","D20"],58:["S18","D20"],57:["S17","D20"],56:["S16","D20"],55:["S15","D20"],54:["S14","D20"],53:["S13","D20"],52:["S12","D20"],51:["S11","D20"],50:["D-Bull"],49:["S9","D20"],48:["S8","D20"],47:["S7","D20"],46:["S6","D20"],45:["S5","D20"],44:["S4","D20"],43:["S3","D20"],42:["S2","D20"],41:["S1","D20"],40:["D20"],38:["D19"],36:["D18"],34:["D17"],32:["D16"],30:["D15"],28:["D14"],26:["D13"],24:["D12"],22:["D11"],20:["D10"],18:["D9"],16:["D8"],14:["D7"],12:["D6"],10:["D5"],8:["D4"],6:["D3"],4:["D2"],2:["D1"]};

function getCheckout(r,d){const c=CK[r];if(!c||c.length>d)return null;return c;}

/* ============ ZONE DETECTION ============ */
const BN=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
function getZone(x,y,cx,cy){
  const dist=Math.sqrt((x-cx)**2+(y-cy)**2);
  const angle=((Math.atan2(y-cy,x-cx)*180)/Math.PI+360+99)%360;
  const si=Math.floor(angle/18);
  const n=BN[si]||20;
  if(dist<=12.7)return{zone:"D-Bull",value:50,label:"D-Bull",multiplier:2,number:25};
  if(dist<=31.8)return{zone:"Bull",value:25,label:"Bull",multiplier:1,number:25};
  if(dist>=95&&dist<=99)return{zone:`T${n}`,value:n*3,label:`T${n}`,multiplier:3,number:n};
  if(dist>=53&&dist<=57)return{zone:`D${n}`,value:n*2,label:`D${n}`,multiplier:2,number:n};
  if(dist>170)return{zone:"Miss",value:0,label:"Miss",multiplier:0,number:0};
  return{zone:`S${n}`,value:n,label:`S${n}`,multiplier:1,number:n};
}

/* ============ DARTBOARD ============ */
function Board({darts,onClick}){
  const ref=useRef(null);const cx=200,cy=200,R=170;
  const click=(e)=>{const r=ref.current.getBoundingClientRect();const x=((e.clientX-r.left)/r.width)*400;const y=((e.clientY-r.top)/r.height)*400;onClick({...getZone(x,y,cx,cy),x,y});};
  return(
    <svg ref={ref} viewBox="0 0 400 400" className="w-full max-w-sm cursor-crosshair" onClick={click} style={{filter:"drop-shadow(0 0 30px rgba(0,0,0,0.5))"}}>
      <circle cx={cx} cy={cy} r={R} fill="#1a1a1a" stroke="#333" strokeWidth="2"/>
      {BN.map((num,i)=>{const sa=(i*18-99)*(Math.PI/180),ea=((i+1)*18-99)*(Math.PI/180);const ev=i%2===0;
        return[{i:99,o:R,f:ev?"#1a1a1a":"#f0e6d3"},{i:95,o:99,f:ev?"#e8373e":"#1b8a42"},{i:57,o:95,f:ev?"#1a1a1a":"#f0e6d3"},{i:53,o:57,f:ev?"#e8373e":"#1b8a42"}].map((r,ri)=>{
          const x1=cx+r.i*Math.cos(sa),y1=cy+r.i*Math.sin(sa),x2=cx+r.o*Math.cos(sa),y2=cy+r.o*Math.sin(sa),x3=cx+r.o*Math.cos(ea),y3=cy+r.o*Math.sin(ea),x4=cx+r.i*Math.cos(ea),y4=cy+r.i*Math.sin(ea);
          return<path key={`${i}-${ri}`} d={`M${x1} ${y1}L${x2} ${y2}A${r.o} ${r.o} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${r.i} ${r.i} 0 0 0 ${x1} ${y1}Z`} fill={r.f} stroke="#333" strokeWidth="0.5"/>;
        });})}
      <circle cx={cx} cy={cy} r={31.8} fill="#1b8a42" stroke="#333" strokeWidth="0.5"/>
      <circle cx={cx} cy={cy} r={12.7} fill="#e8373e" stroke="#333" strokeWidth="0.5"/>
      {BN.map((n,i)=>{const a=(i*18-90)*(Math.PI/180);return<text key={n} x={cx+(R+18)*Math.cos(a)} y={cy+(R+18)*Math.sin(a)} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.7)" fontSize="14" fontWeight="600" fontFamily="'Rajdhani',sans-serif">{n}</text>;})}
      {darts.map((d,i)=>(<g key={i}><circle cx={d.x+2} cy={d.y+2} r="6" fill="rgba(0,0,0,0.3)"/><circle cx={d.x} cy={d.y} r="5" fill="#EF4444" stroke="#fff" strokeWidth="1.5"/><text x={d.x} y={d.y+0.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="7" fontWeight="700">{i+1}</text></g>))}
    </svg>
  );
}

/* ============ SCORE EDITOR — Exakt som referensbild ============ */
/* ============ SCORE EDITOR — Tabbar överst, nummergrid under ============ */
/* Tabbar: Single (default) | Double | Treble | Bull 50 | Outer 25
   Klicka tab → byter aktiv multiplikator
   Bull/Outer tabbar → direkt-select (50 resp 25)
   Grid: 4 rader × 5 kolumner med nummer 1-20
   Klicka nummer → registrerar med aktiv multiplikator
   Längst ner: Ångra + Miss */
function ScoreEditor({onSelect,onUndo,onClose}){
  const [activeTab,setActiveTab]=useState("S");
  const mk=(zone,value,label,multiplier,number)=>({zone,value,label,multiplier,number});
  const tabs=[
    {id:"S",label:"Single",mult:1,color:"rgba(255,255,255,0.7)"},
    {id:"D",label:"Double",mult:2,color:"#F59E0B"},
    {id:"T",label:"Treble",mult:3,color:"#A78BFA"},
  ];
  const activeMult=tabs.find(t=>t.id===activeTab)?.mult||1;
  const activeColor=tabs.find(t=>t.id===activeTab)?.color||"#fff";
  const rows=[[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20]];

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden" style={{background:"#1b2b1b",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}>

        {/* ===== TABS ===== */}
        <div className="flex" style={{borderBottom:"2px solid #EF4444"}}>
          {tabs.map((t)=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
              style={{
                background:activeTab===t.id?"rgba(239,68,68,0.15)":"transparent",
                color:activeTab===t.id?t.color:"rgba(255,255,255,0.35)",
                borderBottom:activeTab===t.id?`2px solid ${t.color}`:"2px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
          {/* Bull 50 — direkt-select */}
          <button onClick={()=>onSelect(mk("D-Bull",50,"D-Bull",2,25))}
            className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{background:"transparent",color:"#EF4444"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.12)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Bull<span className="block text-[10px] font-normal" style={{color:"rgba(239,68,68,0.6)"}}>50</span>
          </button>
          {/* Outer 25 — direkt-select */}
          <button onClick={()=>onSelect(mk("Bull",25,"Bull",1,25))}
            className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{background:"transparent",color:"#10B981"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.12)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Outer<span className="block text-[10px] font-normal" style={{color:"rgba(16,185,129,0.6)"}}>25</span>
          </button>
        </div>

        {/* ===== NUMBER GRID ===== */}
        {rows.map((row,ri)=>(
          <div key={ri} className="grid grid-cols-5">
            {row.map((n)=>{
              const val=n*activeMult;
              const label=`${activeTab}${n}`;
              return(
                <button key={n} onClick={()=>onSelect(mk(label,val,label,activeMult,n))}
                  className="py-4 text-center text-xl font-bold transition-all duration-100"
                  style={{background:"transparent",color:"rgba(255,255,255,0.85)",borderBottom:"1px solid rgba(255,255,255,0.06)",borderRight:"1px solid rgba(255,255,255,0.06)"}}
                  onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(239,68,68,0.15)";e.currentTarget.style.color="#EF4444";}}
                  onMouseLeave={(e)=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.85)";}}>
                  {n}
                </button>
              );
            })}
          </div>
        ))}

        {/* ===== ÅNGRA + MISS ===== */}
        <div className="grid grid-cols-2" style={{borderTop:"2px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>{onClose();onUndo();}}
            className="py-4 text-center text-sm font-bold uppercase tracking-widest transition-all duration-100"
            style={{background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}
            onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>
            ↩ Ångra
          </button>
          <button onClick={()=>onSelect(mk("Miss",0,"Miss",0,0))}
            className="py-4 text-center text-sm font-bold uppercase tracking-widest transition-all duration-100"
            style={{background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(239,68,68,0.1)";e.currentTarget.style.color="#EF4444";}}
            onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>
            MISS
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ DART SLOT ============ */
function DartSlot({index,dart,isCurrent,onEdit}){
  const [h,setH]=useState(false);
  return(
    <button onClick={()=>dart&&onEdit(index)} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} disabled={!dart}
      className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all duration-200 min-w-[80px]"
      style={{
        background:isCurrent?"rgba(239,68,68,0.08)":!dart?"rgba(255,255,255,0.02)":h?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.03)",
        border:isCurrent?"1px solid rgba(239,68,68,0.3)":dart&&h?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(255,255,255,0.06)",
        cursor:dart?"pointer":"default",
      }}>
      <span className="text-xs uppercase tracking-widest" style={{color:"rgba(255,255,255,0.25)"}}>Pil {index+1}</span>
      {dart?(
        <>
          <span className="text-2xl font-extrabold" style={{color:"rgba(255,255,255,0.95)"}}>{dart.value}</span>
          <span className="text-xs font-bold" style={{color:"#EF4444"}}>{dart.label}</span>
        </>
      ):(
        <span className="text-2xl font-extrabold" style={{color:"rgba(255,255,255,0.1)"}}>—</span>
      )}
    </button>
  );
}

/* ============ MAIN ============ */
export default function MatchGame({navigate,matchConfig}){
  const{players,startingScore,legs:totalLegs,format}=matchConfig;
  const legsToWin=format==="best-of"?Math.ceil(totalLegs/2):totalLegs;

  const [scores,setScores]=useState(()=>players.map(()=>startingScore));
  const [legsWon,setLegsWon]=useState(()=>players.map(()=>0));
  const [cpIdx,setCpIdx]=useState(0);
  const [cDarts,setCDarts]=useState([null,null,null]);
  const [dPos,setDPos]=useState([]);
  const [history,setHistory]=useState([]);
  const [totThrown,setTotThrown]=useState(()=>players.map(()=>0));
  const [rndCount,setRndCount]=useState(()=>players.map(()=>0));
  const [editing,setEditing]=useState(null);
  const [gameOver,setGameOver]=useState(false);
  const [winner,setWinner]=useState(null);
  const [bust,setBust]=useState(null);

  const cp=players[cpIdx];
  const cs=scores[cpIdx];
  const thrown=cDarts.filter(Boolean).length;
  const left=3-thrown;
  const rndTotal=cDarts.reduce((s,d)=>s+(d?d.value:0),0);
  const proj=cs-rndTotal;

  const checkout=useMemo(()=>{if(proj<=0)return null;return getCheckout(proj,left);},[proj,left]);
  const getAvg=(i)=>rndCount[i]===0?"–":(totThrown[i]/rndCount[i]).toFixed(1);

  /* Handle throw from board */
  const handleThrow=(di)=>{
    if(thrown>=3||gameOver)return;
    applyDart(di);
  };

  /* Apply a dart (from board click or from editor) */
  const applyDart=(di)=>{
    const nd=[...cDarts];nd[thrown]=di;
    const nt=nd.reduce((s,d)=>s+(d?d.value:0),0);
    const ns=cs-nt;

    if(ns===0&&di.multiplier===2){
      setCDarts(nd);if(di.x!==undefined)setDPos(p=>[...p,{x:di.x,y:di.y}]);
      setTotThrown(p=>{const n=[...p];n[cpIdx]+=nt;return n;});
      setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
      const nl=[...legsWon];nl[cpIdx]++;
      if(nl[cpIdx]>=legsToWin){setLegsWon(nl);setWinner(cp);setGameOver(true);return;}
      setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:false}]);
      setLegsWon(nl);setScores(players.map(()=>startingScore));setCDarts([null,null,null]);setDPos([]);setCpIdx(0);return;
    }
    if(ns<=0||ns===1){
      setBust(ns<0?"Bust! Under noll":ns===1?"Bust! Kvar: 1":"Bust! Måste sluta på dubbel");
      setTimeout(()=>setBust(null),2500);
      setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:true}]);
      setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
      setCDarts([null,null,null]);setDPos([]);setCpIdx(p=>(p+1)%players.length);return;
    }

    setCDarts(nd);if(di.x!==undefined)setDPos(p=>[...p,{x:di.x,y:di.y}]);
    if(thrown+1>=3)setTimeout(()=>confirmRound(nd),300);
  };

  const confirmRound=(d)=>{
    const ds=d||cDarts;const t=ds.reduce((s,x)=>s+(x?x.value:0),0);
    setHistory(p=>[...p,{pi:cpIdx,darts:[...ds],sb:cs,bust:false}]);
    setTotThrown(p=>{const n=[...p];n[cpIdx]+=t;return n;});
    setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
    setScores(p=>{const n=[...p];n[cpIdx]-=t;return n;});
    setCDarts([null,null,null]);setDPos([]);setCpIdx(p=>(p+1)%players.length);
  };

  const handleUndo=()=>{
    const lastIdx=cDarts.reduce((l,d,i)=>(d?i:l),-1);
    if(lastIdx>=0){const n=[...cDarts];n[lastIdx]=null;setCDarts(n);setDPos(p=>p.slice(0,-1));return;}
    if(history.length===0)return;
    const lr=history[history.length-1];setHistory(p=>p.slice(0,-1));
    setCpIdx(lr.pi);setCDarts(lr.darts);
    setDPos(lr.darts.filter(Boolean).filter(d=>d.x!==undefined).map(d=>({x:d.x,y:d.y})));
    setScores(p=>{const n=[...p];n[lr.pi]=lr.sb;return n;});
    if(!lr.bust){const t=lr.darts.reduce((s,d)=>s+(d?d.value:0),0);setTotThrown(p=>{const n=[...p];n[lr.pi]-=t;return n;});}
    setRndCount(p=>{const n=[...p];n[lr.pi]=Math.max(0,n[lr.pi]-1);return n;});
  };

  /* Score editor: user clicks a number → show S/D/T picker */
  const handleEditorSelect=(di)=>{
    if(di.multiplier!==undefined){
      /* Direct select (Bull, Miss) */
      if(editing!==null&&cDarts[editing]){
        const n=[...cDarts];n[editing]={...n[editing],...di};setCDarts(n);setEditing(null);
      } else {
        applyDart(di);
      }
      setPickingNum(null);
      return;
    }
    /* Number clicked → need multiplier */
    setPickingNum(di.number);
  };

  const handleMultiplierPick=(di)=>{
    if(editing!==null&&cDarts[editing]){
      const n=[...cDarts];n[editing]={...n[editing],...di};setCDarts(n);setEditing(null);
    } else {
      applyDart(di);
    }
    setPickingNum(null);
  };

  const PC=["#EF4444","#10B981","#8B5CF6","#F59E0B","#60A5FA","#EC4899","#14B8A6","#F97316"];
  const canUndo=thrown>0||history.length>0;

  return(
    <div className="relative min-h-screen overflow-hidden" style={{background:"linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",fontFamily:"'Rajdhani','Segoe UI',sans-serif"}}>
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,backgroundSize:"60px 60px"}}/>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3">
        <button onClick={()=>navigate("lobby")} className="flex items-center gap-2 transition-colors duration-200" style={{color:"rgba(255,255,255,0.3)"}}
          onMouseEnter={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.7)"} onMouseLeave={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6"/></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Avbryt</span>
        </button>
        <span className="text-sm font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>
          {startingScore} · {format==="best-of"?`Bäst av ${totalLegs}`:`Först till ${legsToWin}`}
        </span>
        <div style={{width:80}}/>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pb-12">

        {/* ===== GAME OVER ===== */}
        {gameOver&&winner&&(
          <div className="w-full max-w-lg mb-6 p-8 rounded-2xl text-center" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
            <span className="text-sm uppercase tracking-widest block mb-2" style={{color:"rgba(255,255,255,0.3)"}}>Match slut!</span>
            <span className="text-4xl font-extrabold block mb-3" style={{color:"#10B981"}}>{winner.name} vinner!</span>
            <div className="flex justify-center gap-6 mb-4">
              {players.map((p,i)=>(<span key={p.id} className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>{p.name}: <strong style={{color:PC[i%PC.length]}}>{getAvg(i)}</strong> avg</span>))}
            </div>
            <button onClick={()=>navigate("lobby")} className="px-10 py-3 rounded-xl text-sm font-bold uppercase tracking-widest" style={{background:"linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",color:"#fff"}}>Till lobbyn</button>
          </div>
        )}

        {/* ===== CURRENT PLAYER ===== */}
        {!gameOver&&(
          <div className="mb-3 px-8 py-3 rounded-xl flex items-center gap-4" style={{background:PC[cpIdx%PC.length]+"12",border:`1px solid ${PC[cpIdx%PC.length]}30`}}>
            <div className="w-4 h-4 rounded-full" style={{background:PC[cpIdx%PC.length]}}/>
            <span className="text-2xl font-extrabold" style={{color:PC[cpIdx%PC.length]}}>{cp.name}</span>
            <span className="text-xl font-bold ml-2" style={{color:"rgba(255,255,255,0.5)"}}>{cs}</span>
            <span className="text-sm ml-2 px-2 py-0.5 rounded-md" style={{background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.35)"}}>
              AVG {getAvg(cpIdx)}
            </span>
          </div>
        )}

        {/* Bust */}
        {bust&&(<div className="mb-3 px-6 py-2.5 rounded-xl" style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)"}}><span className="text-base font-bold" style={{color:"#EF4444"}}>{bust}</span></div>)}

        {/* ===== BOARD ===== */}
        {!gameOver&&<Board darts={dPos} onClick={handleThrow}/>}

        {/* ===== DART SLOTS ===== */}
        {!gameOver&&(
          <div className="flex items-center gap-3 mt-5">
            {cDarts.map((d,i)=>(<DartSlot key={i} index={i} dart={d} isCurrent={i===thrown} onEdit={setEditing}/>))}
          </div>
        )}

        {/* Round info */}
        {!gameOver&&thrown>0&&(
          <div className="flex items-center gap-6 mt-3">
            <span className="text-base" style={{color:"rgba(255,255,255,0.35)"}}>Runda: <strong className="text-lg" style={{color:"rgba(255,255,255,0.8)"}}>{rndTotal}</strong></span>
            <span className="text-base" style={{color:"rgba(255,255,255,0.35)"}}>Kvar: <strong className="text-lg" style={{color:proj<=0?"#EF4444":"rgba(255,255,255,0.8)"}}>{proj}</strong></span>
          </div>
        )}

        {/* ===== ACTIONS ===== */}
        {!gameOver&&(
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleUndo} disabled={!canUndo}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
              style={{background:canUndo?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.01)",color:canUndo?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)",border:canUndo?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(255,255,255,0.03)",cursor:canUndo?"pointer":"default"}}
              onMouseEnter={(e)=>{if(canUndo){e.currentTarget.style.color="#EF4444";e.currentTarget.style.borderColor="rgba(239,68,68,0.3)";}}}
              onMouseLeave={(e)=>{if(canUndo){e.currentTarget.style.color="rgba(255,255,255,0.4)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}}>
              ↩ Ångra
            </button>
            {thrown>0&&thrown<3&&(
              <button onClick={()=>confirmRound(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{background:"rgba(16,185,129,0.1)",color:"#10B981",border:"1px solid rgba(16,185,129,0.25)"}}
                onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.2)"} onMouseLeave={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.1)"}>
                Bekräfta runda
              </button>
            )}
          </div>
        )}

        {/* ===== CHECKOUT ===== */}
        {!gameOver&&checkout&&left>0&&(
          <div className="mt-4 px-6 py-3 rounded-xl w-full max-w-sm" style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)"}}>
            <span className="text-xs uppercase tracking-widest block mb-2" style={{color:"rgba(255,255,255,0.3)"}}>Checkout ({proj})</span>
            <div className="flex items-center gap-2">
              {checkout.map((c,i)=>(<span key={i} className="px-4 py-2 rounded-lg text-base font-bold" style={{background:"rgba(139,92,246,0.15)",color:"#A78BFA"}}>{c}</span>))}
            </div>
          </div>
        )}

        {/* ===== SCOREBOARD ===== */}
        <div className="w-full max-w-lg mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08))"}}/>
            <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{color:"rgba(255,255,255,0.25)"}}>Scoreboard</span>
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, rgba(255,255,255,0.08), transparent)"}}/>
          </div>

          <div className="flex flex-col gap-3">
            {players.map((p,i)=>{
              const act=i===cpIdx&&!gameOver;const c=PC[i%PC.length];
              return(
                <div key={p.id} className="flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-200" style={{
                  background:act?c+"0C":"rgba(255,255,255,0.02)",border:act?`2px solid ${c}30`:"1px solid rgba(255,255,255,0.05)",
                }}>
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full" style={{background:c,opacity:act?1:0.4}}/>
                    <div>
                      <span className="text-lg font-bold" style={{color:act?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.6)"}}>{p.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-semibold" style={{color:"rgba(255,255,255,0.3)"}}>AVG: <span style={{color:c+"CC"}}>{getAvg(i)}</span></span>
                        {act&&<span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{background:c+"20",color:c}}>Kastar</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="text-4xl font-extrabold" style={{color:act?c:"rgba(255,255,255,0.6)"}}>{scores[i]}</span>
                    <div className="flex gap-1.5">
                      {Array.from({length:legsToWin}).map((_,li)=>(
                        <div key={li} className="w-3 h-3 rounded-full" style={{background:li<legsWon[i]?c:"rgba(255,255,255,0.08)"}}/>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ===== SCORE EDITOR MODAL ===== */}
      {editing!==null&&cDarts[editing]&&(
        <ScoreEditor
          onSelect={(di)=>{
            const n=[...cDarts];n[editing]={...n[editing],...di};setCDarts(n);setEditing(null);
          }}
          onUndo={()=>{setEditing(null);handleUndo();}}
          onClose={()=>setEditing(null)}
        />
      )}

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}