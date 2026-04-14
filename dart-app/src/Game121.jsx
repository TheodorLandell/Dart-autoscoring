import { useState, useMemo, useEffect } from "react";
import useDartVision from "./useDartVision";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  121 — Checkout Challenge — AUTO-SCORING ONLY              │
  │                                                             │
  │  Manuell dartboard borttagen. Scoring sker via kamera.     │
  │  ScoreEditor finns kvar för korrigeringar.                 │
  └─────────────────────────────────────────────────────────────┘
*/

/* ============ CHECKOUT TABLE ============ */
const CK={170:["T20 T20 Bull"],167:["T20 T19 Bull"],164:["T20 T18 Bull"],161:["T20 T17 Bull"],160:["T20 T20 D20"],158:["T20 T20 D19"],157:["T20 T19 D20"],156:["T20 T20 D18"],155:["T20 T19 D19"],154:["T20 T18 D20"],153:["T20 T19 D18"],152:["T20 T20 D16"],151:["T20 T17 D20"],150:["T20 T18 D18"],149:["T20 T19 D16"],148:["T20 T16 D20"],147:["T20 T17 D18"],146:["T20 T18 D16"],145:["T20 T15 D20"],144:["T20 T20 D12"],143:["T20 T17 D16"],142:["T20 T14 D20"],141:["T20 T19 D12"],140:["T20 T16 D16"],139:["T20 T13 D20"],138:["T20 T18 D12"],137:["T20 T19 D10"],136:["T20 T20 D8"],135:["T20 T17 D12"],134:["T20 T14 D16"],133:["T20 T19 D8"],132:["T20 T16 D12"],131:["T20 T13 D16"],130:["T20 T18 D8"],129:["T19 T16 D12"],128:["T20 T20 D4"],127:["T20 T17 D8"],126:["T19 T19 D6"],125:["T20 T15 D10"],124:["T20 T16 D8"],123:["T19 T16 D9"],122:["T18 T18 D7"],121:["T20 T11 D14"],120:["T20 S20 D20"],119:["T19 T12 D13"],118:["T20 S18 D16"],117:["T20 S17 D16"],116:["T20 S16 D16"],115:["T20 S15 D16"],114:["T20 S14 D16"],113:["T20 S13 D16"],112:["T20 S12 D16"],111:["T20 S11 D16"],110:["T20 S10 D16"],109:["T20 S9 D16"],108:["T20 S8 D16"],107:["T19 S10 D16"],106:["T20 S6 D16"],105:["T20 S5 D16"],104:["T20 S4 D16"],103:["T20 S3 D16"],102:["T20 S2 D16"],101:["T20 S1 D16"],100:["T20 D20"],99:["T19 S10 D16"],98:["T20 D19"],97:["T19 D20"],96:["T20 D18"],95:["T19 D19"],94:["T18 D20"],93:["T19 D18"],92:["T20 D16"],91:["T17 D20"],90:["T18 D18"],89:["T19 D16"],88:["T20 D14"],87:["T17 D18"],86:["T18 D16"],85:["T15 D20"],84:["T20 D12"],83:["T17 D16"],82:["T14 D20"],81:["T19 D12"],80:["T16 D16"],79:["T13 D20"],78:["T18 D12"],77:["T15 D16"],76:["T20 D8"],75:["T13 D18"],74:["T14 D16"],73:["T19 D8"],72:["T16 D12"],71:["T13 D16"],70:["T18 D8"],69:["T19 D6"],68:["T20 D4"],67:["T17 D8"],66:["T10 D18"],65:["T19 D4"],64:["T16 D8"],63:["T13 D12"],62:["T10 D16"],61:["T15 D8"],60:["S20 D20"],59:["S19 D20"],58:["S18 D20"],57:["S17 D20"],56:["T16 D4"],55:["S15 D20"],54:["S14 D20"],53:["S13 D20"],52:["S20 D16"],51:["S19 D16"],50:["S10 D20"],49:["S9 D20"],48:["S16 D16"],47:["S15 D16"],46:["S6 D20"],45:["S5 D20"],44:["S4 D20"],43:["S3 D20"],42:["S10 D16"],41:["S9 D16"],40:["D20"],39:["S7 D16"],38:["D19"],37:["S5 D16"],36:["D18"],35:["S3 D16"],34:["D17"],33:["S17 D8"],32:["D16"],31:["S15 D8"],30:["D15"],29:["S13 D8"],28:["D14"],27:["S11 D8"],26:["D13"],25:["S17 D4"],24:["D12"],23:["S7 D8"],22:["D11"],21:["S5 D8"],20:["D10"],19:["S3 D8"],18:["D9"],17:["S9 D4"],16:["D8"],15:["S7 D4"],14:["D7"],13:["S5 D4"],12:["D6"],11:["S3 D4"],10:["D5"],9:["S1 D4"],8:["D4"],7:["S3 D2"],6:["D3"],5:["S1 D2"],4:["D2"],3:["S1 D1"],2:["D1"]};

function getCheckout(s){const c=CK[s];if(!c||!c.length)return null;return c[0];}

/* ============ SCORE EDITOR (för korrigeringar) ============ */
function ScoreEditor({onSelect,onUndo,onClose}){
  const [tab,setTab]=useState("S");
  const mk=(z,v,l,m,n)=>({zone:z,value:v,label:l,multiplier:m,number:n});
  const tabs=[{id:"S",label:"Single",mult:1,color:"rgba(255,255,255,0.7)"},{id:"D",label:"Double",mult:2,color:"#F59E0B"},{id:"T",label:"Treble",mult:3,color:"#A78BFA"}];
  const mult=tabs.find(t=>t.id===tab)?.mult||1;
  const rows=[[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20]];
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden" style={{background:"#1b2b1b",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}>
        <div className="flex" style={{borderBottom:"2px solid #10B981"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
              style={{background:tab===t.id?"rgba(16,185,129,0.15)":"transparent",color:tab===t.id?t.color:"rgba(255,255,255,0.35)",borderBottom:tab===t.id?`2px solid ${t.color}`:"2px solid transparent"}}>
              {t.label}
            </button>
          ))}
          <button onClick={()=>onSelect(mk("D-Bull",50,"D-Bull",2,25))} className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150" style={{color:"#EF4444"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.12)"} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Bull<span className="block text-[10px]" style={{color:"rgba(239,68,68,0.6)"}}>50</span>
          </button>
          <button onClick={()=>onSelect(mk("Bull",25,"Bull",1,25))} className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150" style={{color:"#10B981"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.12)"} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Outer<span className="block text-[10px]" style={{color:"rgba(16,185,129,0.6)"}}>25</span>
          </button>
        </div>
        {rows.map((row,ri)=>(
          <div key={ri} className="grid grid-cols-5">
            {row.map(n=>{const v=n*mult;const l=`${tab}${n}`;return(
              <button key={n} onClick={()=>onSelect(mk(l,v,l,mult,n))} className="py-4 text-center text-xl font-bold transition-all duration-100"
                style={{background:"transparent",color:"rgba(255,255,255,0.85)",borderBottom:"1px solid rgba(255,255,255,0.06)",borderRight:"1px solid rgba(255,255,255,0.06)"}}
                onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(16,185,129,0.15)";e.currentTarget.style.color="#10B981";}}
                onMouseLeave={(e)=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.85)";}}>{n}</button>
            );})}
          </div>
        ))}
        <div className="grid grid-cols-2" style={{borderTop:"2px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>{onClose();onUndo();}} className="py-4 text-center text-sm font-bold uppercase tracking-widest" style={{background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}
            onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>↩ Ångra</button>
          <button onClick={()=>onSelect(mk("Miss",0,"Miss",0,0))} className="py-4 text-center text-sm font-bold uppercase tracking-widest" style={{background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(16,185,129,0.1)";e.currentTarget.style.color="#10B981";}}
            onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>MISS</button>
        </div>
      </div>
    </div>
  );
}

/* ============ MAIN 121 GAME — AUTO-SCORING ONLY ============ */
export default function Game121({navigate}){
  const [level,setLevel]=useState(121);
  const [score,setScore]=useState(121);
  const [maxDarts,setMaxDarts]=useState(9);
  const [dartsUsed,setDartsUsed]=useState(0);
  const [history,setHistory]=useState([]);
  const [undoStack,setUndoStack]=useState([]);
  const [msg,setMsg]=useState(null);
  const [showSettings,setShowSettings]=useState(false);
  const [showEditor,setShowEditor]=useState(false);
  const [highestLevel,setHighestLevel]=useState(121);
  const [settingDarts,setSettingDarts]=useState("9");
  const [settingLevel,setSettingLevel]=useState("121");

  const dartsLeft=maxDarts-dartsUsed;
  const checkout=useMemo(()=>getCheckout(score),[score]);

  const flash=(text,type)=>{setMsg({text,type});setTimeout(()=>setMsg(null),2500);};

  const saveSnap=(label)=>{
    setUndoStack(p=>{const n=[...p,{level,score,dartsUsed,label}];if(n.length>15)n.shift();return n;});
  };

  const handleThrow=(di)=>{
    if(dartsUsed>=maxDarts)return;
    saveSnap(di.label);

    const newScore=score-di.value;

    /* Checkout! */
    if(newScore===0&&di.multiplier===2){
      setDartsUsed(d=>d+1);
      const newLevel=level+1;
      flash(`Checkade ut ${level}! Nivå ${newLevel} — kör!`,"good");
      setHistory(p=>[{level,success:true,ts:new Date().toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})},...p].slice(0,15));
      if(newLevel>highestLevel)setHighestLevel(newLevel);
      setLevel(newLevel);setScore(newLevel);setDartsUsed(0);setUndoStack([]);
      return;
    }

    /* Bust */
    if(newScore<0||newScore===1||(newScore===0&&di.multiplier!==2)){
      flash(newScore<0?"Bust! Under noll":newScore===1?"Bust! Kvar: 1":"Bust! Måste sluta på dubbel","bad");
      setDartsUsed(d=>d+1);
      if(dartsUsed+1>=maxDarts){
        const newLevel=Math.max(2,level-1);
        flash(`Alla pilar slut — ner till nivå ${newLevel}`,"bad");
        setHistory(p=>[{level,success:false,ts:new Date().toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})},...p].slice(0,15));
        setLevel(newLevel);setScore(newLevel);setDartsUsed(0);setUndoStack([]);
      }
      return;
    }

    /* Normal kast */
    setScore(newScore);
    setDartsUsed(d=>d+1);

    if(dartsUsed+1>=maxDarts){
      const newLevel=Math.max(2,level-1);
      flash(`Alla ${maxDarts} pilar utan checkout — ner till ${newLevel}`,"bad");
      setHistory(p=>[{level,success:false,ts:new Date().toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})},...p].slice(0,15));
      setTimeout(()=>{setLevel(newLevel);setScore(newLevel);setDartsUsed(0);setUndoStack([]);},300);
    }
  };

  /* ===== LIVE AUTO-SCORING (alltid aktiverad) ===== */
  const handleLiveThrow = (dartInfo) => {
    if(dartsUsed>=maxDarts) return;
    handleThrow(dartInfo);
  };

  const { connected, resetBackend } = useDartVision({
    onThrow: handleLiveThrow,
    enabled: true,
  });

  useEffect(() => {
    resetBackend();
  }, [resetBackend]);

  const handleUndo=()=>{
    if(!undoStack.length)return;
    const snap=undoStack[undoStack.length-1];
    setUndoStack(p=>p.slice(0,-1));
    setLevel(snap.level);setScore(snap.score);setDartsUsed(snap.dartsUsed);
    flash(`↩ Ångrade: ${snap.label}`,"info");
  };

  const resetRound=()=>{setScore(level);setDartsUsed(0);setUndoStack([]);flash("Omgång återställd","info");};

  const applySettings=()=>{
    const d=parseInt(settingDarts);const l=parseInt(settingLevel);
    if(!isNaN(d)&&d>=1&&d<=30)setMaxDarts(d);
    if(!isNaN(l)&&l>=2&&l<=170){setLevel(l);setScore(l);}
    setDartsUsed(0);setUndoStack([]);setShowSettings(false);
    flash("Inställningar sparade!","good");
  };

  return(
    <div className="relative min-h-screen overflow-hidden" style={{background:"linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",fontFamily:"'Rajdhani','Segoe UI',sans-serif"}}>
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,backgroundSize:"60px 60px"}}/>

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-3">
        <button onClick={()=>navigate("lobby")} className="flex items-center gap-2 transition-colors duration-200 w-20" style={{color:"rgba(255,255,255,0.3)"}}
          onMouseEnter={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.7)"} onMouseLeave={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6"/></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-2xl font-extrabold" style={{color:"#10B981"}}>1<span style={{color:"rgba(255,255,255,0.9)"}}>2</span>1</span>
        </div>
        <div className="w-20 flex justify-end gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{background:connected?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:connected?"1px solid rgba(16,185,129,0.25)":"1px solid rgba(239,68,68,0.25)"}}>
            <div className="w-1.5 h-1.5 rounded-full" style={{background:connected?"#10B981":"#EF4444",animation:connected?"none":"pulse 1.5s ease-in-out infinite"}}/>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{color:connected?"#10B981":"#EF4444"}}>{connected?"Live":"..."}</span>
          </div>
          <button onClick={()=>setShowSettings(!showSettings)} className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-200"
            style={{color:"rgba(255,255,255,0.3)",border:"1px solid rgba(255,255,255,0.06)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.color="rgba(255,255,255,0.7)";e.currentTarget.style.borderColor="rgba(255,255,255,0.15)";}}
            onMouseLeave={(e)=>{e.currentTarget.style.color="rgba(255,255,255,0.3)";e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";}}>
            ⚙
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pb-12">

        {/* ===== SCOREBOARD ===== */}
        <div className="grid grid-cols-3 gap-3 mb-4 w-full max-w-md">
          <div className="p-4 rounded-xl text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Nivå</span>
            <span className="text-4xl font-extrabold" style={{color:"#10B981"}}>{level}</span>
          </div>
          <div className="p-4 rounded-xl text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Poäng kvar</span>
            <span className="text-4xl font-extrabold" style={{color:"rgba(255,255,255,0.95)"}}>{score}</span>
          </div>
          <div className="p-4 rounded-xl text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Pilar</span>
            <span className="text-4xl font-extrabold" style={{color:dartsLeft<=2?"#EF4444":"rgba(255,255,255,0.7)"}}>{dartsLeft}</span>
            <span className="text-[10px] block" style={{color:"rgba(255,255,255,0.15)"}}>av {maxDarts}</span>
          </div>
        </div>

        <div className="mb-3 text-xs" style={{color:"rgba(255,255,255,0.2)"}}>
          Högsta nivå: <span className="font-bold" style={{color:"#10B981"}}>{highestLevel}</span>
        </div>

        {/* ===== CHECKOUT ===== */}
        {checkout&&(
          <div className="mb-4 px-5 py-3 rounded-xl w-full max-w-md text-center" style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}>
            <span className="text-[10px] uppercase tracking-widest block mb-1" style={{color:"rgba(255,255,255,0.3)"}}>Checkout</span>
            <div className="flex items-center justify-center gap-2">
              {checkout.split(" ").map((c,i)=>(
                <span key={i} className="px-3 py-1.5 rounded-lg text-base font-bold" style={{background:"rgba(139,92,246,0.15)",color:"#A78BFA"}}>{c}</span>
              ))}
            </div>
          </div>
        )}
        {!checkout&&score>1&&(
          <div className="mb-4 px-5 py-2 rounded-xl text-center" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
            <span className="text-xs" style={{color:"rgba(255,255,255,0.2)"}}>Ingen checkout — kasta för att justera</span>
          </div>
        )}

        {/* Message */}
        {msg&&(
          <div className="mb-3 px-6 py-2.5 rounded-xl" style={{
            background:msg.type==="good"?"rgba(16,185,129,0.15)":msg.type==="bad"?"rgba(239,68,68,0.15)":"rgba(255,255,255,0.05)",
            border:`1px solid ${msg.type==="good"?"rgba(16,185,129,0.3)":msg.type==="bad"?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)"}`,
          }}>
            <span className="text-sm font-bold" style={{color:msg.type==="good"?"#10B981":msg.type==="bad"?"#EF4444":"rgba(255,255,255,0.6)"}}>{msg.text}</span>
          </div>
        )}

        {/* Dart indicators */}
        <div className="flex gap-1.5 mt-3 mb-4">
          {Array.from({length:maxDarts}).map((_,i)=>(
            <div key={i} className="w-3 h-3 rounded-full transition-all duration-200" style={{background:i<dartsUsed?"#10B981":"rgba(255,255,255,0.08)"}}/>
          ))}
        </div>

        {/* Väntar-indikator */}
        {dartsLeft>0&&(
          <div className="mb-4 p-6 rounded-2xl w-full max-w-md text-center" style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)"}}>
            <div className="w-3 h-3 rounded-full mx-auto mb-3" style={{background:connected?"#10B981":"#EF4444",animation:"pulse 1.5s ease-in-out infinite"}}/>
            <span className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>
              {connected?"Väntar på kast...":"Ansluter till kamera..."}
            </span>
          </div>
        )}

        {/* ===== ACTIONS ===== */}
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <button onClick={handleUndo} disabled={!undoStack.length}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200"
            style={{background:undoStack.length?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.01)",color:undoStack.length?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)",border:undoStack.length?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(255,255,255,0.03)"}}
            onMouseEnter={(e)=>{if(undoStack.length){e.currentTarget.style.color="#10B981";}}}
            onMouseLeave={(e)=>{if(undoStack.length){e.currentTarget.style.color="rgba(255,255,255,0.4)";}}}>
            ↩ Ångra
          </button>
          <button onClick={()=>handleThrow({zone:"Miss",value:0,label:"Miss",multiplier:0,number:0})}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200"
            style={{background:"rgba(239,68,68,0.08)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.2)"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.15)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}>
            Miss
          </button>
          <button onClick={resetRound} className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200"
            style={{background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
            onMouseEnter={(e)=>{e.currentTarget.style.color="rgba(255,255,255,0.7)";}}
            onMouseLeave={(e)=>{e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>
            ↺ Reset
          </button>
          <button onClick={()=>setShowEditor(true)} className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200"
            style={{background:"rgba(16,185,129,0.1)",color:"#10B981",border:"1px solid rgba(16,185,129,0.25)"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.2)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.1)"}>
            Korrigera
          </button>
        </div>

        {/* ===== SETTINGS ===== */}
        {showSettings&&(
          <div className="mt-4 p-5 rounded-xl w-full max-w-md" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <span className="text-xs font-bold uppercase tracking-widest block mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Inställningar</span>
            <div className="flex gap-4 mb-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{color:"rgba(255,255,255,0.2)"}}>Pilar per omgång</label>
                <input type="number" value={settingDarts} onChange={(e)=>setSettingDarts(e.target.value)} min="1" max="30"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.8)"}}/>
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{color:"rgba(255,255,255,0.2)"}}>Hoppa till nivå</label>
                <input type="number" value={settingLevel} onChange={(e)=>setSettingLevel(e.target.value)} min="2" max="170"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.8)"}}/>
              </div>
            </div>
            <button onClick={applySettings} className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest"
              style={{background:"rgba(16,185,129,0.15)",color:"#10B981",border:"1px solid rgba(16,185,129,0.3)"}}>
              Spara
            </button>
          </div>
        )}

        {/* ===== HISTORY ===== */}
        {history.length>0&&(
          <div className="mt-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08))"}}/>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{color:"rgba(255,255,255,0.2)"}}>Historik</span>
              <div className="h-px flex-1" style={{background:"linear-gradient(90deg, rgba(255,255,255,0.08), transparent)"}}/>
            </div>
            <div className="flex flex-col gap-1.5">
              {history.map((h,i)=>(
                <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)"}}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{color:"rgba(255,255,255,0.2)"}}>{h.ts}</span>
                    <span className="text-sm font-semibold" style={{color:"rgba(255,255,255,0.6)"}}>Nivå {h.level}</span>
                  </div>
                  <span className="text-xs font-bold" style={{color:h.success?"#10B981":"#EF4444"}}>
                    {h.success?"↑ Gick upp":"↓ Gick ner"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showEditor&&(
        <ScoreEditor
          onSelect={(di)=>{setShowEditor(false);handleThrow(di);}}
          onUndo={()=>{setShowEditor(false);handleUndo();}}
          onClose={()=>setShowEditor(false)}
        />
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}