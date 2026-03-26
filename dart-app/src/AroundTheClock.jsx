import { useState, useRef, useMemo } from "react";

/*
  ┌─────────────────────────────────────────────────────────────┐
  │  AROUND THE CLOCK                                          │
  │                                                             │
  │  REGLER:                                                    │
  │  - Träffa 1→20→Bull i ordning (eller omvänt/random)       │
  │  - Välj variant: Any / Single / Double / Treble            │
  │    Any = träffa valfri yta på numret                       │
  │    Single/Double/Treble = måste träffa den specifika ytan  │
  │  - Avsluta med: Single bull (25) eller Bullseye (50)       │
  │  - Stats: pilar kastade, träffar, accuracy %               │
  │                                                             │
  │  SETUP-SIDA:                                                │
  │  - Variant: Any / Single / Double / Treble                 │
  │  - Avsluta med: Single bull / Bullseye                     │
  │  - Ordning: Låg→hög / Hög→låg / Random                    │
  │  - Starta-knapp                                            │
  │                                                             │
  │  GAMEPLAY:                                                  │
  │  - Aktuellt mål (nummer + vilken yta)                      │
  │  - Dartboard — klicka för att kasta                        │
  │  - Pilar kastade / Träffar / Accuracy %                    │
  │  - Progress-indikator (vilka nummer som klarats)           │
  │                                                             │
  │  Backend:                                                   │
  │  - POST /api/game/atc/create { variant, finish, order }   │
  │  - POST /api/game/atc/{id}/throw { zone, multiplier }     │
  │  - Spara: total pilar, accuracy, tid                       │
  └─────────────────────────────────────────────────────────────┘
*/

/* ============ ZONE DETECTION ============ */
const BN=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
function getZone(x,y,cx,cy){
  const dist=Math.sqrt((x-cx)**2+(y-cy)**2);
  const angle=((Math.atan2(y-cy,x-cx)*180)/Math.PI+360+99)%360;
  const si=Math.floor(angle/18);const n=BN[si]||20;
  if(dist<=12.7)return{zone:"D-Bull",value:50,label:"D-Bull",multiplier:2,number:25};
  if(dist<=31.8)return{zone:"Bull",value:25,label:"Bull",multiplier:1,number:25};
  if(dist>=95&&dist<=99)return{zone:`T${n}`,value:n*3,label:`T${n}`,multiplier:3,number:n};
  if(dist>=53&&dist<=57)return{zone:`D${n}`,value:n*2,label:`D${n}`,multiplier:2,number:n};
  if(dist>170)return{zone:"Miss",value:0,label:"Miss",multiplier:0,number:0};
  return{zone:`S${n}`,value:n,label:`S${n}`,multiplier:1,number:n};
}

/* ============ DARTBOARD ============ */
function Board({darts,onClick,highlightNumber,highlightType}){
  const ref=useRef(null);const cx=200,cy=200,R=170;
  const click=(e)=>{const r=ref.current.getBoundingClientRect();const x=((e.clientX-r.left)/r.width)*400;const y=((e.clientY-r.top)/r.height)*400;const dist=Math.sqrt((x-cx)**2+(y-cy)**2);if(dist<=R+5)onClick({...getZone(x,y,cx,cy),x,y});};
  return(
    <svg ref={ref} viewBox="0 0 400 400" className="w-full max-w-sm cursor-crosshair" onClick={click} style={{filter:"drop-shadow(0 0 30px rgba(0,0,0,0.5))"}}>
      <circle cx={cx} cy={cy} r={R} fill="#1a1a1a" stroke="#333" strokeWidth="2"/>
      {BN.map((num,i)=>{const sa=(i*18-99)*(Math.PI/180),ea=((i+1)*18-99)*(Math.PI/180);const ev=i%2===0;
        const isTarget=num===highlightNumber&&highlightNumber<=20;
        return[{i:99,o:R,f:ev?"#1a1a1a":"#f0e6d3",type:"S"},{i:95,o:99,f:ev?"#e8373e":"#1b8a42",type:"T_outer"},{i:57,o:95,f:ev?"#1a1a1a":"#f0e6d3",type:"S"},{i:53,o:57,f:ev?"#e8373e":"#1b8a42",type:"D"}].map((r,ri)=>{
          const x1=cx+r.i*Math.cos(sa),y1=cy+r.i*Math.sin(sa),x2=cx+r.o*Math.cos(sa),y2=cy+r.o*Math.sin(sa),x3=cx+r.o*Math.cos(ea),y3=cy+r.o*Math.sin(ea),x4=cx+r.i*Math.cos(ea),y4=cy+r.i*Math.sin(ea);
          let fill=r.f;
          if(isTarget&&highlightType==="any")fill=ri===0||ri===2?"rgba(139,92,246,0.3)":ri===1?"rgba(139,92,246,0.5)":"rgba(139,92,246,0.5)";
          else if(isTarget&&highlightType==="S"&&(ri===0||ri===2))fill="rgba(139,92,246,0.4)";
          else if(isTarget&&highlightType==="D"&&ri===3)fill="rgba(139,92,246,0.5)";
          else if(isTarget&&highlightType==="T"&&ri===1)fill="rgba(139,92,246,0.5)";
          return<path key={`${i}-${ri}`} d={`M${x1} ${y1}L${x2} ${y2}A${r.o} ${r.o} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${r.i} ${r.i} 0 0 0 ${x1} ${y1}Z`} fill={fill} stroke="#333" strokeWidth="0.5"/>;
        });})}
      {/* Bull highlight */}
      <circle cx={cx} cy={cy} r={31.8} fill={highlightNumber===25?"rgba(139,92,246,0.4)":"#1b8a42"} stroke="#333" strokeWidth="0.5"/>
      <circle cx={cx} cy={cy} r={12.7} fill={highlightNumber===25?"rgba(139,92,246,0.6)":"#e8373e"} stroke="#333" strokeWidth="0.5"/>
      {BN.map((n,i)=>{const a=(i*18-90)*(Math.PI/180);const isT=n===highlightNumber;return<text key={n} x={cx+(R+18)*Math.cos(a)} y={cy+(R+18)*Math.sin(a)} textAnchor="middle" dominantBaseline="central" fill={isT?"#A78BFA":"rgba(255,255,255,0.7)"} fontSize={isT?"16":"13"} fontWeight={isT?"800":"600"} fontFamily="'Rajdhani',sans-serif">{n}</text>;})}
      {darts.map((d,i)=>{const isHit=d.hit;return(<g key={i}><circle cx={d.x+2} cy={d.y+2} r="5" fill="rgba(0,0,0,0.3)"/><circle cx={d.x} cy={d.y} r="4" fill={isHit?"#8B5CF6":"rgba(255,255,255,0.2)"} stroke={isHit?"#fff":"rgba(255,255,255,0.3)"} strokeWidth="1.5"/></g>);})}
    </svg>
  );
}

/* ============ OPTION BUTTON ============ */
function Opt({label,desc,selected,onClick,accent="#8B5CF6"}){
  return(
    <button onClick={onClick} className="px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left"
      style={{
        background:selected?accent+"15":"rgba(255,255,255,0.03)",
        border:selected?`1px solid ${accent}40`:"1px solid rgba(255,255,255,0.06)",
        color:selected?accent:"rgba(255,255,255,0.5)",
      }}>
      {label}
      {desc&&<span className="block text-[10px] font-normal mt-0.5" style={{color:selected?accent+"90":"rgba(255,255,255,0.2)"}}>{desc}</span>}
    </button>
  );
}

/* ============ SETUP PAGE ============ */
function ATCSetup({onStart,navigate}){
  const [variant,setVariant]=useState("any");
  const [finish,setFinish]=useState("single-bull");
  const [order,setOrder]=useState("low-high");

  return(
    <div className="relative min-h-screen overflow-hidden" style={{background:"linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",fontFamily:"'Rajdhani','Segoe UI',sans-serif"}}>
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,backgroundSize:"60px 60px"}}/>

      <header className="relative z-10 flex items-center px-6 py-3">
        <button onClick={()=>navigate("lobby")} className="flex items-center gap-2 w-20 transition-colors duration-200" style={{color:"rgba(255,255,255,0.3)"}}
          onMouseEnter={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.7)"} onMouseLeave={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6"/></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Tillbaka</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-xl font-extrabold uppercase tracking-wider" style={{color:"#8B5CF6"}}>Around the Clock</span>
        </div>
        <div className="w-20"/>
      </header>

      <main className="relative z-10 max-w-md mx-auto px-6 pb-16 pt-6">
        <div className="p-6 rounded-2xl mb-6" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <p className="text-sm mb-6" style={{color:"rgba(255,255,255,0.4)"}}>
            Träffa varje nummer på darttavlan i ordning, från 1 till 20, avsluta med bull. Antal pilar och träffsäkerhet räknas.
          </p>

          {/* Variant */}
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-widest block mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Variant</span>
            <div className="grid grid-cols-2 gap-2">
              <Opt label="Any" desc="Valfri yta" selected={variant==="any"} onClick={()=>setVariant("any")}/>
              <Opt label="Single" desc="Bara single" selected={variant==="single"} onClick={()=>setVariant("single")}/>
              <Opt label="Double" desc="Bara dubbel" selected={variant==="double"} onClick={()=>setVariant("double")}/>
              <Opt label="Treble" desc="Bara trippel" selected={variant==="treble"} onClick={()=>setVariant("treble")}/>
            </div>
          </div>

          {/* Finish */}
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-widest block mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Avsluta med</span>
            <div className="grid grid-cols-2 gap-2">
              <Opt label="Single bull" desc="Outer bull (25)" selected={finish==="single-bull"} onClick={()=>setFinish("single-bull")}/>
              <Opt label="Bullseye" desc="Inner bull (50)" selected={finish==="bullseye"} onClick={()=>setFinish("bullseye")}/>
            </div>
          </div>

          {/* Order */}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest block mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Ordning</span>
            <div className="grid grid-cols-3 gap-2">
              <Opt label="1 → 20" desc="Låg till hög" selected={order==="low-high"} onClick={()=>setOrder("low-high")}/>
              <Opt label="20 → 1" desc="Hög till låg" selected={order==="high-low"} onClick={()=>setOrder("high-low")}/>
              <Opt label="Random" desc="Slumpad" selected={order==="random"} onClick={()=>setOrder("random")}/>
            </div>
          </div>
        </div>

        <button onClick={()=>onStart({variant,finish,order})}
          className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200"
          style={{background:"linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",color:"#fff",boxShadow:"0 4px 20px rgba(139,92,246,0.3)"}}
          onMouseEnter={(e)=>{e.target.style.boxShadow="0 4px 30px rgba(139,92,246,0.5)";e.target.style.transform="translateY(-2px)";}}
          onMouseLeave={(e)=>{e.target.style.boxShadow="0 4px 20px rgba(139,92,246,0.3)";e.target.style.transform="translateY(0)";}}>
          Starta spel
        </button>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}

/* ============ GAMEPLAY ============ */
function ATCGame({config,navigate}){
  const{variant,finish,order}=config;

  /* Bygg nummerlista */
  const numbers=useMemo(()=>{
    let nums=Array.from({length:20},(_,i)=>i+1);
    if(order==="high-low")nums.reverse();
    else if(order==="random")nums.sort(()=>Math.random()-0.5);
    nums.push(25); // bull sist
    return nums;
  },[order]);

  const [currentIdx,setCurrentIdx]=useState(0);
  const [totalDarts,setTotalDarts]=useState(0);
  const [hits,setHits]=useState(0);
  const [dartPos,setDartPos]=useState([]);
  const [msg,setMsg]=useState(null);
  const [completed,setCompleted]=useState(false);
  const [undoStack,setUndoStack]=useState([]);

  const currentTarget=numbers[currentIdx];
  const accuracy=totalDarts===0?0:Math.round((hits/totalDarts)*100);
  const isFinished=completed;

  /* Vilken typ av zon krävs? */
  const getHighlightType=()=>{
    if(currentTarget===25)return"any"; // bull
    if(variant==="any")return"any";
    if(variant==="single")return"S";
    if(variant==="double")return"D";
    if(variant==="treble")return"T";
    return"any";
  };

  const flash=(text,type)=>{setMsg({text,type});setTimeout(()=>setMsg(null),2000);};

  const isHit=(dartInfo)=>{
    const{number,multiplier,zone}=dartInfo;

    /* Bull target */
    if(currentTarget===25){
      if(finish==="bullseye")return zone==="D-Bull";
      return zone==="D-Bull"||zone==="Bull";
    }

    /* Number target */
    if(number!==currentTarget)return false;
    if(variant==="any")return true;
    if(variant==="single"&&multiplier===1)return true;
    if(variant==="double"&&multiplier===2)return true;
    if(variant==="treble"&&multiplier===3)return true;
    return false;
  };

  const handleThrow=(dartInfo)=>{
    if(completed)return;

    setUndoStack(p=>[...p,{currentIdx,totalDarts,hits}]);

    const hit=isHit(dartInfo);
    setTotalDarts(d=>d+1);
    if(dartInfo.x)setDartPos(p=>[...p,{x:dartInfo.x,y:dartInfo.y,hit}]);

    if(hit){
      setHits(h=>h+1);
      if(currentIdx+1>=numbers.length){
        setCompleted(true);
        flash("Klart! Alla nummer avklarade!","good");
      } else {
        const next=numbers[currentIdx+1];
        flash(`Träff! Nästa: ${next===25?"Bull":next}`,"good");
        setCurrentIdx(i=>i+1);
        setDartPos([]);
      }
    } else {
      flash("Miss!","bad");
    }
  };

  const handleUndo=()=>{
    if(!undoStack.length)return;
    const snap=undoStack[undoStack.length-1];
    setUndoStack(p=>p.slice(0,-1));
    setCurrentIdx(snap.currentIdx);setTotalDarts(snap.totalDarts);setHits(snap.hits);
    setDartPos(p=>p.slice(0,-1));
    setCompleted(false);
    flash("↩ Ångrade","info");
  };

  const variantLabel=variant==="any"?"Valfri yta":variant==="single"?"Single":variant==="double"?"Dubbel":"Trippel";

  return(
    <div className="relative min-h-screen overflow-hidden" style={{background:"linear-gradient(145deg, #0a0a10 0%, #0f0f18 40%, #0d0d14 100%)",fontFamily:"'Rajdhani','Segoe UI',sans-serif"}}>
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,backgroundSize:"60px 60px"}}/>

      <header className="relative z-10 flex items-center px-6 py-3">
        <button onClick={()=>navigate("lobby")} className="flex items-center gap-2 w-20 transition-colors duration-200" style={{color:"rgba(255,255,255,0.3)"}}
          onMouseEnter={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.7)"} onMouseLeave={(e)=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L4 8l6 6"/></svg>
          <span className="text-xs font-semibold uppercase tracking-widest">Avbryt</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-xl font-extrabold uppercase tracking-wider" style={{color:"#8B5CF6"}}>Around the Clock</span>
        </div>
        <div className="w-20"/>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pb-12">

        {/* ===== TARGET ===== */}
        {!completed&&(
          <div className="mb-4 p-5 rounded-2xl w-full max-w-md text-center" style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)"}}>
            <span className="text-[10px] uppercase tracking-widest block mb-1" style={{color:"rgba(255,255,255,0.3)"}}>Mål</span>
            <span className="text-6xl font-extrabold" style={{color:"#8B5CF6"}}>
              {currentTarget===25?"Bull":currentTarget}
            </span>
            <span className="text-sm block mt-1" style={{color:"rgba(139,92,246,0.6)"}}>
              {currentTarget===25?(finish==="bullseye"?"Bullseye (50)":"Single bull (25)"):variantLabel}
            </span>
          </div>
        )}

        {/* ===== COMPLETED ===== */}
        {completed&&(
          <div className="mb-4 p-6 rounded-2xl w-full max-w-md text-center" style={{background:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.3)"}}>
            <span className="text-sm uppercase tracking-widest block mb-2" style={{color:"rgba(255,255,255,0.3)"}}>Klart!</span>
            <span className="text-4xl font-extrabold block mb-3" style={{color:"#8B5CF6"}}>Alla nummer avklarade!</span>
            <div className="flex justify-center gap-6 mb-4">
              <span className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Pilar: <strong style={{color:"#8B5CF6"}}>{totalDarts}</strong></span>
              <span className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Accuracy: <strong style={{color:"#10B981"}}>{accuracy}%</strong></span>
            </div>
            <button onClick={()=>navigate("lobby")} className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest" style={{background:"linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",color:"#fff"}}>
              Till lobbyn
            </button>
          </div>
        )}

        {/* ===== STATS ===== */}
        <div className="grid grid-cols-3 gap-3 mb-4 w-full max-w-md">
          <div className="p-3 rounded-xl text-center" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Pilar</span>
            <span className="text-3xl font-extrabold" style={{color:"rgba(255,255,255,0.8)"}}>{totalDarts}</span>
          </div>
          <div className="p-3 rounded-xl text-center" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Träffar</span>
            <span className="text-3xl font-extrabold" style={{color:"#8B5CF6"}}>{hits}/{numbers.length}</span>
          </div>
          <div className="p-3 rounded-xl text-center" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <span className="text-[10px] uppercase tracking-widest block" style={{color:"rgba(255,255,255,0.3)"}}>Accuracy</span>
            <span className="text-3xl font-extrabold" style={{color:accuracy>=50?"#10B981":"#EF4444"}}>{accuracy}%</span>
          </div>
        </div>

        {/* Message — always reserverad plats, ingen hop */}
        <div className="w-full max-w-md" style={{minHeight:44}}>
          <div className="flex items-center justify-center" style={{height:44}}>
            {msg&&(
              <div className="px-6 py-2 rounded-xl" style={{
                background:msg.type==="good"?"rgba(139,92,246,0.12)":msg.type==="bad"?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.05)",
                border:`1px solid ${msg.type==="good"?"rgba(139,92,246,0.3)":msg.type==="bad"?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)"}`,
              }}>
                <span className="text-sm font-bold" style={{color:msg.type==="good"?"#8B5CF6":msg.type==="bad"?"#EF4444":"rgba(255,255,255,0.6)"}}>{msg.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== DARTBOARD ===== */}
        {!completed&&(
          <Board darts={dartPos} onClick={handleThrow} highlightNumber={currentTarget} highlightType={getHighlightType()}/>
        )}

        {/* Ångra */}
        {!completed&&(
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleUndo} disabled={!undoStack.length}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
              style={{background:undoStack.length?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.01)",color:undoStack.length?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)",border:undoStack.length?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(255,255,255,0.03)"}}
              onMouseEnter={(e)=>{if(undoStack.length)e.currentTarget.style.color="#8B5CF6";}}
              onMouseLeave={(e)=>{if(undoStack.length)e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>
              ↩ Ångra
            </button>
          </div>
        )}

        {/* ===== PROGRESS ===== */}
        <div className="mt-6 w-full max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08))"}}/>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{color:"rgba(255,255,255,0.2)"}}>Progress</span>
            <div className="h-px flex-1" style={{background:"linear-gradient(90deg, rgba(255,255,255,0.08), transparent)"}}/>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {numbers.map((n,i)=>{
              const done=i<currentIdx||(completed);
              const active=i===currentIdx&&!completed;
              return(
                <div key={i} className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200"
                  style={{
                    background:done?"rgba(139,92,246,0.2)":active?"rgba(139,92,246,0.1)":"rgba(255,255,255,0.02)",
                    border:active?"2px solid #8B5CF6":done?"1px solid rgba(139,92,246,0.3)":"1px solid rgba(255,255,255,0.05)",
                    color:done?"#8B5CF6":active?"#A78BFA":"rgba(255,255,255,0.15)",
                  }}>
                  {n===25?"B":n}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    </div>
  );
}

/* ============ MAIN — ROUTER ============ */
export default function AroundTheClock({navigate}){
  const [phase,setPhase]=useState("setup");
  const [config,setConfig]=useState(null);

  if(phase==="game"&&config){
    return<ATCGame config={config} navigate={navigate}/>;
  }
  return<ATCSetup navigate={navigate} onStart={(cfg)=>{setConfig(cfg);setPhase("game");}}/>;
}