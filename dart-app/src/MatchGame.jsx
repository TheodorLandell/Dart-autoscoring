import { useState, useMemo, useEffect, useRef } from "react";
import useDartVision from "./useDartVision";
import { LiveBoard } from "./LiveScoring";
import { generateBotThrow, botDartToSvg } from "./dartBot";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  MATCH GAMEPLAY — AUTO-SCORING ONLY                        │
  │                                                             │
  │  Manuell dartboard borttagen. Scoring sker via kamera.     │
  │  ScoreEditor finns kvar för att korrigera felaktig scoring. │
  │  useDartVision alltid aktiverad.                            │
  │                                                             │
  │  Tournament-stöd kvar (isTournament prop).                 │
  └─────────────────────────────────────────────────────────────┘
*/

/* ============ CHECKOUT TABLE ============ */
const CK={170:["T20","T20","D-Bull"],167:["T20","T19","D-Bull"],164:["T20","T18","D-Bull"],161:["T20","T17","D-Bull"],160:["T20","T20","D20"],158:["T20","T20","D19"],157:["T20","T19","D20"],156:["T20","T20","D18"],155:["T20","T19","D19"],154:["T20","T18","D20"],153:["T20","T19","D18"],152:["T20","T20","D16"],151:["T20","T17","D20"],150:["T20","T18","D18"],149:["T20","T19","D16"],148:["T20","T20","D14"],147:["T20","T17","D18"],146:["T20","T18","D16"],145:["T20","T19","D14"],144:["T20","T20","D12"],143:["T20","T17","D16"],142:["T20","T14","D20"],141:["T20","T19","D12"],140:["T20","T20","D10"],139:["T20","T13","D20"],138:["T20","T18","D12"],137:["T20","T19","D10"],136:["T20","T20","D8"],135:["T20","T17","D12"],134:["T20","T14","D16"],133:["T20","T19","D8"],132:["T20","T16","D12"],131:["T20","T13","D16"],130:["T20","T18","D8"],129:["T19","T16","D12"],128:["T18","T14","D16"],127:["T20","T17","D8"],126:["T19","T15","D12"],125:["T20","T15","D10"],124:["T20","T16","D8"],123:["T19","T16","D9"],122:["T18","T20","D4"],121:["T20","T11","D14"],120:["T20","S20","D20"],119:["T19","T12","D13"],118:["T20","S18","D20"],117:["T20","S17","D20"],116:["T20","S16","D20"],115:["T20","S15","D20"],114:["T20","S14","D20"],113:["T20","S13","D20"],112:["T20","S12","D20"],111:["T20","S11","D20"],110:["T20","S10","D20"],109:["T20","S9","D20"],108:["T20","S8","D20"],107:["T19","S10","D20"],106:["T20","S6","D20"],105:["T20","S5","D20"],104:["T20","S4","D20"],103:["T19","S6","D20"],102:["T20","S2","D20"],101:["T20","S1","D20"],100:["T20","D20"],99:["T19","S2","D20"],98:["T20","D19"],97:["T19","D20"],96:["T20","D18"],95:["T19","D19"],94:["T18","D20"],93:["T19","D18"],92:["T20","D16"],91:["T17","D20"],90:["T18","D18"],89:["T19","D16"],88:["T20","D14"],87:["T17","D18"],86:["T18","D16"],85:["T19","D14"],84:["T20","D12"],83:["T17","D16"],82:["T14","D20"],81:["T19","D12"],80:["T20","D10"],79:["T13","D20"],78:["T18","D12"],77:["T19","D10"],76:["T20","D8"],75:["T17","D12"],74:["T14","D16"],73:["T19","D8"],72:["T16","D12"],71:["T13","D16"],70:["T18","D8"],69:["T15","D12"],68:["T20","D4"],67:["T17","D8"],66:["T10","D18"],65:["T19","D4"],64:["T16","D8"],63:["T13","D12"],62:["T10","D16"],61:["T15","D8"],60:["S20","D20"],59:["S19","D20"],58:["S18","D20"],57:["S17","D20"],56:["S16","D20"],55:["S15","D20"],54:["S14","D20"],53:["S13","D20"],52:["S12","D20"],51:["S11","D20"],50:["D-Bull"],49:["S9","D20"],48:["S8","D20"],47:["S7","D20"],46:["S6","D20"],45:["S5","D20"],44:["S4","D20"],43:["S3","D20"],42:["S2","D20"],41:["S1","D20"],40:["D20"],38:["D19"],36:["D18"],34:["D17"],32:["D16"],30:["D15"],28:["D14"],26:["D13"],24:["D12"],22:["D11"],20:["D10"],18:["D9"],16:["D8"],14:["D7"],12:["D6"],10:["D5"],8:["D4"],6:["D3"],4:["D2"],2:["D1"]};

function getCheckout(r,d){const c=CK[r];if(!c||c.length>d)return null;return c;}

/* ============ SCORE EDITOR (för korrigeringar) ============ */
function ScoreEditor({onSelect,onUndo,onClose}){
  const [activeTab,setActiveTab]=useState("S");
  const mk=(zone,value,label,multiplier,number)=>({zone,value,label,multiplier,number});
  const tabs=[
    {id:"S",label:"Single",mult:1,color:"rgba(255,255,255,0.7)"},
    {id:"D",label:"Double",mult:2,color:"#F59E0B"},
    {id:"T",label:"Treble",mult:3,color:"#A78BFA"},
  ];
  const activeMult=tabs.find(t=>t.id===activeTab)?.mult||1;
  const rows=[[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20]];

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden" style={{background:"#1b2b1b",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}>
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
          <button onClick={()=>onSelect(mk("D-Bull",50,"D-Bull",2,25))}
            className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{background:"transparent",color:"#EF4444"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.12)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Bull<span className="block text-[10px] font-normal" style={{color:"rgba(239,68,68,0.6)"}}>50</span>
          </button>
          <button onClick={()=>onSelect(mk("Bull",25,"Bull",1,25))}
            className="flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{background:"transparent",color:"#10B981"}}
            onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.12)"}
            onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
            Outer<span className="block text-[10px] font-normal" style={{color:"rgba(16,185,129,0.6)"}}>25</span>
          </button>
        </div>
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

/* ============ MAIN — AUTO-SCORING ONLY ============ */
export default function MatchGame({ navigate, matchConfig, isTournament = false, onTournamentMatchComplete = null }) {
  const{players,startingScore,legs:totalLegs,format}=matchConfig;
  const legsToWin=format==="best-of"?Math.ceil(totalLegs/2):totalLegs;
  const PC=["#EF4444","#10B981","#8B5CF6","#F59E0B","#60A5FA","#EC4899","#14B8A6","#F97316"];

  const [scores,setScores]=useState(()=>players.map(()=>startingScore));
  const [legsWon,setLegsWon]=useState(()=>players.map(()=>0));
  const [cpIdx,setCpIdx]=useState(0);
  const [cDarts,setCDarts]=useState([null,null,null]);
  const [history,setHistory]=useState([]);
  const [totThrown,setTotThrown]=useState(()=>players.map(()=>0));
  const [rndCount,setRndCount]=useState(()=>players.map(()=>0));
  const [editing,setEditing]=useState(null);
  const [manualEntry,setManualEntry]=useState(false);
  const [gameOver,setGameOver]=useState(false);
  const confirmingRef=useRef(false);
  const cDartsRef=useRef([null,null,null]);
  const botTimeoutRef=useRef(null);
  const [botThrowing,setBotThrowing]=useState(false);  // true under hela botens tur
  const [botIndicator,setBotIndicator]=useState(false); // true medan bot kastar (döljs under 3s-paus)
  const [winner,setWinner]=useState(null);
  const [bust,setBust]=useState(null);
  const [finalLegsWon, setFinalLegsWon] = useState(null);

  const cp=players[cpIdx];
  const cs=scores[cpIdx];
  const thrown=cDarts.filter(Boolean).length;
  const left=3-thrown;
  const rndTotal=cDarts.reduce((s,d)=>s+(d?d.value:0),0);
  const proj=cs-rndTotal;

  const checkout=useMemo(()=>{if(proj<=0)return null;return getCheckout(proj,left);},[proj,left]);
  const getAvg=(i)=>rndCount[i]===0?"–":(totThrown[i]/rndCount[i]).toFixed(1);

  useEffect(()=>{cDartsRef.current=cDarts;},[cDarts]);

  const isBot = !gameOver && cp?.type === "bot";

  /* ===== BOT-TUR ===== */
  useEffect(()=>{
    if(!isBot) return;
    if(gameOver) return;
    if(cDartsRef.current.some(Boolean)) return;

    setBotThrowing(true);
    setBotIndicator(true);

    const avg = cp.avgScore ?? 40;
    const botColor = PC[cpIdx % PC.length];
    let remaining = cs;
    const nd = [null, null, null];
    let bustAtStep = -1;
    let bustNs = null;
    let checkoutAtStep = -1;

    // Generera alla pilar i förväg — inkl. SVG-position för mini-boarden
    for(let i = 0; i < 3; i++){
      if(remaining <= 1) break;
      const dart = generateBotThrow(avg, remaining);
      const pos = botDartToSvg(dart.zone);
      nd[i] = { ...dart, svg_x: pos.svg_x, svg_y: pos.svg_y, score: dart.value,
                scored: true, conf: 0.85, color: botColor, isNew: true };
      const ns = remaining - dart.value;
      if(ns === 0 && dart.multiplier === 2){ checkoutAtStep = i; break; }
      if(ns <= 0 || ns === 1){ bustAtStep = i; bustNs = ns; break; }
      remaining = ns;
    }

    const dartsCount = nd.filter(Boolean).length;
    const scored = nd.reduce((s,d)=>s+(d?d.value:0),0);
    const bustMsg = bustNs !== null ? (bustNs < 0 ? "Bust! Under noll" : "Bust! Kvar: 1") : null;
    const timers = [];

    // Visa en pil var 1000:e ms
    for(let i = 0; i < dartsCount; i++){
      const idx = i;
      timers.push(setTimeout(()=>{
        const partial = nd.map((d,j)=>j<=idx?d:null);
        cDartsRef.current = partial;
        setCDarts([...partial]);
        if(idx === dartsCount - 1){
          setBotIndicator(false); // dölj indikator — 3s-paus börjar
          if(bustMsg){ setBust(bustMsg); setTimeout(()=>setBust(null),2500); }
        }
      }, (idx + 1) * 1000));
    }

    // Bekräfta rundan efter sista pilen + 3 s
    const commitDelay = dartsCount * 1000 + 3000;
    const tCommit = setTimeout(()=>{
      botTimeoutRef.current = null;
      setBotThrowing(false);
      setBotIndicator(false);
      if(checkoutAtStep >= 0){
        setTotThrown(p=>{const n=[...p];n[cpIdx]+=scored;return n;});
        setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
        const nl=[...legsWon];nl[cpIdx]++;
        if(nl[cpIdx]>=legsToWin){
          setScores(p=>{const n=[...p];n[cpIdx]=0;return n;});
          setLegsWon(nl);setWinner(cp);setGameOver(true);setFinalLegsWon(nl);
        } else {
          setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:false}]);
          setLegsWon(nl);setScores(players.map(()=>startingScore));
          cDartsRef.current=[null,null,null];setCDarts([null,null,null]);setCpIdx(0);
        }
      } else if(bustAtStep >= 0){
        setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:true}]);
        setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
        cDartsRef.current=[null,null,null];setCDarts([null,null,null]);
        setCpIdx(p=>(p+1)%players.length);
      } else {
        setHistory(p=>[...p,{pi:cpIdx,darts:[...nd],sb:cs,bust:false}]);
        setTotThrown(p=>{const n=[...p];n[cpIdx]+=scored;return n;});
        setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
        setScores(p=>{const n=[...p];n[cpIdx]-=scored;return n;});
        cDartsRef.current=[null,null,null];setCDarts([null,null,null]);
        setCpIdx(p=>(p+1)%players.length);
      }
    }, commitDelay);

    botTimeoutRef.current = tCommit;

    return ()=>{
      timers.forEach(t=>clearTimeout(t));
      if(botTimeoutRef.current){ clearTimeout(botTimeoutRef.current); botTimeoutRef.current=null; }
      setBotThrowing(false);
      setBotIndicator(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isBot, cpIdx]);

  const applyDart=(di)=>{
    const cur=cDartsRef.current;
    const thrownNow=cur.filter(Boolean).length;
    if(thrownNow>=3)return;
    const nd=[...cur];nd[thrownNow]=di;
    cDartsRef.current=nd; // synkron uppdatering — nästa snabb-anrop ser rätt slot
    const nt=nd.reduce((s,d)=>s+(d?d.value:0),0);
    const ns=cs-nt;

    if(ns===0&&di.multiplier===2){
      setCDarts(nd);
      setTotThrown(p=>{const n=[...p];n[cpIdx]+=nt;return n;});
      setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
      const nl=[...legsWon];nl[cpIdx]++;
      if(nl[cpIdx]>=legsToWin){
        setScores(p=>{const n=[...p];n[cpIdx]=0;return n;});
        setLegsWon(nl);setWinner(cp);setGameOver(true);
        setFinalLegsWon(nl);
        return;
      }
      setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:false}]);
      setLegsWon(nl);setScores(players.map(()=>startingScore));setCDarts([null,null,null]);setCpIdx(0);return;
    }
    if(ns<=0||ns===1){
      setBust(ns<0?"Bust! Under noll":ns===1?"Bust! Kvar: 1":"Bust! Måste sluta på dubbel");
      setTimeout(()=>setBust(null),2500);
      setHistory(p=>[...p,{pi:cpIdx,darts:nd,sb:cs,bust:true}]);
      setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
      setCDarts([null,null,null]);setCpIdx(p=>(p+1)%players.length);return;
    }

    setCDarts(nd);
    if(thrownNow+1>=3)setTimeout(()=>confirmRound(nd),300);
  };

  const confirmRound=(d)=>{
    if(confirmingRef.current)return;
    confirmingRef.current=true;
    setTimeout(()=>{confirmingRef.current=false;},200);
    const ds=d||cDarts;const t=ds.reduce((s,x)=>s+(x?x.value:0),0);
    setHistory(p=>[...p,{pi:cpIdx,darts:[...ds],sb:cs,bust:false}]);
    setTotThrown(p=>{const n=[...p];n[cpIdx]+=t;return n;});
    setRndCount(p=>{const n=[...p];n[cpIdx]++;return n;});
    setScores(p=>{const n=[...p];n[cpIdx]-=t;return n;});
    setCDarts([null,null,null]);setCpIdx(p=>(p+1)%players.length);
  };

  /* ===== LIVE AUTO-SCORING (inaktiverad under botens tur) ===== */
  const handleLiveThrow = (dartInfo) => {
    if (gameOver) return;
    if (isBot) return; // ignorera WS-events under botens tur
    const currentThrown = cDarts.filter(Boolean).length;
    if (currentThrown >= 3) return;
    applyDart(dartInfo);
  };

  const { connected, darts, resetBackend } = useDartVision({
    onThrow: handleLiveThrow,
    enabled: !gameOver && !isBot,
  });

  /* Reset backend vid mount */
  useEffect(() => {
    resetBackend();
  }, [resetBackend]);

  const handleUndo=()=>{
    if(isBot||botThrowing)return; // Ångra är inaktiv under botens tur

    // Använd ref för att undvika stale closure om en pil just registrerats
    const curDarts=cDartsRef.current;
    const lastIdx=curDarts.reduce((l,d,i)=>(d?i:l),-1);
    if(lastIdx>=0){const n=[...curDarts];n[lastIdx]=null;cDartsRef.current=n;setCDarts(n);return;}

    // Alla pilar tomma — hoppa över botens rundor i historiken och återställ
    // den senaste mänskliga rundan med pilarna synliga (pil-för-pil ångra).
    if(history.length===0)return;
    const newHist=[...history];
    const newScores=[...scores];
    const newTotThrown=[...totThrown];
    const newRndCount=[...rndCount];
    let targetCpIdx=cpIdx;
    let restoredDarts=[null,null,null];
    let foundHuman=false;
    while(newHist.length>0){
      const lr=newHist.pop();
      newScores[lr.pi]=lr.sb;
      if(!lr.bust){const t=lr.darts.reduce((s,d)=>s+(d?d.value:0),0);newTotThrown[lr.pi]=Math.max(0,newTotThrown[lr.pi]-t);}
      newRndCount[lr.pi]=Math.max(0,newRndCount[lr.pi]-1);
      if(players[lr.pi]?.type!=="bot"){targetCpIdx=lr.pi;restoredDarts=lr.darts;foundHuman=true;break;}
    }
    if(!foundHuman)return;
    setHistory(newHist);
    setScores(newScores);
    setTotThrown(newTotThrown);
    setRndCount(newRndCount);
    cDartsRef.current=restoredDarts;
    setCDarts(restoredDarts);
    setCpIdx(targetCpIdx);
  };

  const canUndo=!isBot&&!botThrowing&&(thrown>0||history.some(e=>players[e.pi]?.type!=="bot"));

  // Under botens tur: visa botens pilar på mini-boarden istället för kamerans
  const liveBoardDarts = isBot ? cDarts.filter(Boolean) : darts;

  const getBotLevel=(avg)=>{
    if(avg<=25)return "Nybörjare";
    if(avg<=40)return "Casual";
    if(avg<=55)return "Medel";
    if(avg<=70)return "Bra";
    return "Pro";
  };

  const handleReturnToBracket = () => {
    if (onTournamentMatchComplete && winner && finalLegsWon) {
      onTournamentMatchComplete(winner, finalLegsWon);
    }
  };

  const handleAbortTournamentMatch = () => {
    navigate("tournament-bracket");
  };

  return(
    <div className="relative min-h-screen overflow-hidden" style={{background:"linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",fontFamily:"'Rajdhani','Segoe UI',sans-serif"}}>

      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,backgroundSize:"60px 60px"}}/>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <button onClick={()=>isTournament?handleAbortTournamentMatch():navigate("lobby")} className="flex items-center gap-2 transition-colors duration-200" style={{color:"rgba(255,255,255,0.4)"}}
          onMouseEnter={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.8)"} onMouseLeave={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.4)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6"/></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Avbryt</span>
        </button>
        <div className="flex items-center gap-3">
          {isTournament&&<span className="text-lg">🏆</span>}
          <span className="text-sm font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.5)"}}>
            {startingScore} · {format==="best-of"?`Bäst av ${totalLegs}`:`Först till ${legsToWin}`}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{background:connected?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:connected?"1px solid rgba(16,185,129,0.25)":"1px solid rgba(239,68,68,0.25)"}}>
          <div className="w-2 h-2 rounded-full" style={{background:connected?"#10B981":"#EF4444",animation:connected?"none":"pulse 1.5s ease-in-out infinite"}}/>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:connected?"#10B981":"#EF4444"}}>{connected?"Live":"Ansluter..."}</span>
        </div>
      </header>

      {/* ── TOP: Kamera + Live Board ── */}
      <div className="relative z-10 flex gap-3 px-4 pt-4 pb-3">
        <div className="relative flex-1 rounded-xl overflow-hidden" style={{height:260,border:"1px solid rgba(255,255,255,0.06)",background:"#0a0a0f"}}>
          <img src="http://localhost:8000/api/stream/camera" alt="Camera feed" className="w-full h-full object-contain"/>
          <div className="absolute top-2 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{background:"rgba(0,0,0,0.6)",color:"rgba(255,255,255,0.4)"}}>
            Kamera + YOLO
          </div>
        </div>
        <div className="w-56 rounded-xl p-3" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.25)"}}>Live Board</span>
            <span className="text-[10px] font-mono" style={{color:"rgba(255,255,255,0.15)"}}>{liveBoardDarts.length} pil{liveBoardDarts.length!==1?"ar":""}</span>
          </div>
          <LiveBoard darts={liveBoardDarts}/>
        </div>
      </div>

      {/* ── BOTTOM: Scoring ── */}
      <main className="relative z-10 px-4 pb-12">

        {/* ===== GAME OVER ===== */}
        {gameOver&&winner&&(
          <div className="mb-4 p-8 rounded-2xl text-center" style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)"}}>
            <span className="text-sm uppercase tracking-widest block mb-2" style={{color:"rgba(255,255,255,0.35)"}}>Match slut!</span>
            <span className="text-4xl font-extrabold block mb-3" style={{color:"#10B981"}}>{winner.name} vinner!</span>
            <div className="flex justify-center gap-6 mb-4">
              {players.map((p,i)=>(<span key={p.id} className="text-sm" style={{color:"rgba(255,255,255,0.45)"}}>{p.name}: <strong style={{color:PC[i%PC.length]}}>{getAvg(i)}</strong> avg</span>))}
            </div>
            <div className="flex justify-center gap-6 mb-6">
              {players.map((p,i)=>(<span key={p.id} className="text-sm" style={{color:"rgba(255,255,255,0.35)"}}>{p.name}: <strong style={{color:PC[i%PC.length]}}>{legsWon[i]}</strong> legs</span>))}
            </div>
            {isTournament?(
              <button onClick={handleReturnToBracket} className="px-10 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200" style={{background:"linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",color:"#fff",boxShadow:"0 4px 20px rgba(245,158,11,0.3)"}}
                onMouseEnter={(e)=>{e.target.style.transform="translateY(-1px)";e.target.style.boxShadow="0 4px 30px rgba(245,158,11,0.5)";}}
                onMouseLeave={(e)=>{e.target.style.transform="translateY(0)";e.target.style.boxShadow="0 4px 20px rgba(245,158,11,0.3)";}}>
                🏆 Tillbaka till bracket
              </button>
            ):(
              <button onClick={()=>navigate("lobby")} className="px-10 py-3 rounded-xl text-sm font-bold uppercase tracking-widest" style={{background:"linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",color:"#fff"}}>Till lobbyn</button>
            )}
          </div>
        )}

        {bust&&(<div className="mb-3 px-6 py-2.5 rounded-xl" style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)"}}><span className="text-base font-bold" style={{color:"#EF4444"}}>{bust}</span></div>)}

        {/* ===== DART SLOTS + KNAPPAR + CHECKOUT ===== */}
        {!gameOver&&(
          <div className="flex flex-col items-center gap-4 px-6 py-5 rounded-2xl mb-4" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
            {botIndicator&&(
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg w-full justify-center" style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)"}}>
                <span className="text-sm font-bold uppercase tracking-wider" style={{color:"rgba(255,255,255,0.55)",animation:"pulse 0.8s ease-in-out infinite"}}>
                  🤖 {cp.name} ({getBotLevel(cp.avgScore??40)}) kastar...
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              {cDarts.map((d,i)=>(<DartSlot key={i} index={i} dart={d} isCurrent={!botThrowing&&i===thrown} onEdit={!botThrowing?setEditing:()=>{}}/>))}
            </div>
            {thrown>0&&(
              <div className="flex items-center gap-6">
                <span className="text-base" style={{color:"rgba(255,255,255,0.45)"}}>Runda: <strong className="text-lg" style={{color:"rgba(255,255,255,0.9)"}}>{rndTotal}</strong></span>
                <span className="text-base" style={{color:"rgba(255,255,255,0.45)"}}>Kvar: <strong className="text-lg" style={{color:proj<=0?"#EF4444":"rgba(255,255,255,0.9)"}}>{proj}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={handleUndo} disabled={!canUndo}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{background:canUndo?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",color:canUndo?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.15)",border:canUndo?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(255,255,255,0.04)",cursor:canUndo?"pointer":"default"}}
                onMouseEnter={(e)=>{if(canUndo){e.currentTarget.style.color="#EF4444";e.currentTarget.style.borderColor="rgba(239,68,68,0.4)";}}}
                onMouseLeave={(e)=>{if(canUndo){e.currentTarget.style.color="rgba(255,255,255,0.5)";e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";}}}> ↩ Ångra
              </button>
              <button onClick={()=>setManualEntry(true)} disabled={thrown>=3||botThrowing||isBot}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{background:thrown<3&&!botThrowing&&!isBot?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",color:thrown<3&&!botThrowing&&!isBot?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.15)",border:thrown<3&&!botThrowing&&!isBot?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(255,255,255,0.04)",cursor:thrown<3&&!botThrowing&&!isBot?"pointer":"default"}}
                onMouseEnter={(e)=>{if(thrown<3&&!botThrowing&&!isBot)e.currentTarget.style.color="rgba(255,255,255,0.8)";}}
                onMouseLeave={(e)=>{if(thrown<3&&!botThrowing&&!isBot)e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>
                ⚙ Manuell
              </button>
              {thrown<3&&!isBot&&!botThrowing&&(
                <button onClick={()=>applyDart({zone:"Miss",value:0,label:"Miss",multiplier:0,number:0})}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                  style={{background:"rgba(239,68,68,0.08)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.25)"}}
                  onMouseEnter={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.15)"}
                  onMouseLeave={(e)=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}> Miss
                </button>
              )}
              {thrown>0&&!isBot&&!botThrowing&&(
                <button onClick={()=>confirmRound(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                  style={{background:"rgba(16,185,129,0.1)",color:"#10B981",border:"1px solid rgba(16,185,129,0.3)"}}
                  onMouseEnter={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.2)"} onMouseLeave={(e)=>e.currentTarget.style.background="rgba(16,185,129,0.1)"}> Bekräfta runda
                </button>
              )}
            </div>
            {checkout&&left>0&&(
              <div className="px-6 py-3 rounded-xl w-full" style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)"}}>
                <span className="text-xs uppercase tracking-widest block mb-2" style={{color:"rgba(255,255,255,0.4)"}}>Checkout ({proj})</span>
                <div className="flex items-center gap-2">
                  {checkout.map((c,i)=>(<span key={i} className="px-4 py-2 rounded-lg text-base font-bold" style={{background:"rgba(139,92,246,0.15)",color:"#A78BFA"}}>{c}</span>))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== SCOREBOARD ===== */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08))"}}/>
            <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{color:"rgba(255,255,255,0.3)"}}>Scoreboard</span>
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, rgba(255,255,255,0.08), transparent)"}}/>
          </div>
          <div className="flex flex-col gap-3">
            {players.map((p,i)=>{
              const act=i===cpIdx&&!gameOver;const c=PC[i%PC.length];
              return(
                <div key={p.id} className="flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-200" style={{
                  background:act?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
                  border:act?`2px solid ${c}40`:"1px solid rgba(255,255,255,0.06)",
                }}>
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full" style={{background:c,opacity:act?1:0.5}}/>
                    <div>
                      <span className="text-lg font-bold" style={{color:act?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.65)"}}>{p.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-semibold" style={{color:"rgba(255,255,255,0.35)"}}>AVG: <span style={{color:c+"CC"}}>{getAvg(i)}</span></span>
                        {act&&<span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{background:c+"20",color:c}}>{p.type==="bot"?"🤖 Kastar":"Kastar"}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="text-4xl font-extrabold" style={{color:act?c:"rgba(255,255,255,0.65)"}}>{act?proj:scores[i]}</span>
                    <div className="flex gap-1.5">
                      {Array.from({length:legsToWin}).map((_,li)=>(
                        <div key={li} className="w-3 h-3 rounded-full" style={{background:li<legsWon[i]?c:"rgba(255,255,255,0.12)"}}/>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {editing!==null&&cDarts[editing]&&(
        <ScoreEditor
          onSelect={(di)=>{const n=[...cDarts];n[editing]={...n[editing],...di};setCDarts(n);setEditing(null);}}
          onUndo={()=>{setEditing(null);handleUndo();}}
          onClose={()=>setEditing(null)}
        />
      )}
      {manualEntry&&thrown<3&&(
        <ScoreEditor
          onSelect={(di)=>{setManualEntry(false);applyDart(di);}}
          onUndo={()=>{setManualEntry(false);handleUndo();}}
          onClose={()=>setManualEntry(false)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes dart-pop { from { transform: scale(0); } to { transform: scale(1); } }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}