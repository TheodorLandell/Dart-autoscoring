/*
  dartBot.js — Bot-logik för Match-läget (501/301)

  avgScore (15-80) = snitt per RUNDA (3 pilar totalt).
  Skalanivåer i MatchSetup:
    15-25  Nybörjare
    26-40  Casual
    41-55  Medel
    56-70  Bra
    71-80  Pro

  Exporterar:
    generateBotThrow(avgPerRound, currentScore)  → dart-objekt
    generateBotBullThrow(avgScore)               → { x_mm, y_mm, dist }

  Kalibrerade förväntade poäng per pil (E/dart):
    Nybörjare  avgPerDart < 8   → E ≈  5.5/pil = ~16/runda
    Casual     avgPerDart 8-13  → E ≈ 11/pil   = ~33/runda
    Medel      avgPerDart 13-18 → E ≈ 16.5/pil = ~50/runda
    Bra        avgPerDart 18-23 → E ≈ 21/pil   = ~63/runda
    Pro        avgPerDart ≥ 23  → E ≈ 25/pil   = ~75/runda
*/

const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

function randn() {
  // Box-Muller — normalfördelad slumpvariabel
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function makeDart(zone, value, multiplier, number) {
  return { zone, value, label: zone, multiplier, number };
}

function adjacentSector(num) {
  const i = SECTORS.indexOf(num);
  if (i === -1) return num;
  const left  = SECTORS[(i + SECTORS.length - 1) % SECTORS.length];
  const right = SECTORS[(i + 1) % SECTORS.length];
  return Math.random() < 0.5 ? left : right;
}

function randomSector() {
  return SECTORS[Math.floor(Math.random() * SECTORS.length)];
}

// Slumpar ett sektornummer i heltalsintervallet [lo, hi]
function sNum(lo, hi) {
  return clamp(Math.round(Math.random() * (hi - lo) + lo), lo, hi);
}

/* ─────────────────────────────────────────────────────────
   CHECKOUT-TABELL (identisk med MatchGame.jsx)
   ───────────────────────────────────────────────────────── */
const CK = {170:["T20","T20","D-Bull"],167:["T20","T19","D-Bull"],164:["T20","T18","D-Bull"],161:["T20","T17","D-Bull"],160:["T20","T20","D20"],158:["T20","T20","D19"],157:["T20","T19","D20"],156:["T20","T20","D18"],155:["T20","T19","D19"],154:["T20","T18","D20"],153:["T20","T19","D18"],152:["T20","T20","D16"],151:["T20","T17","D20"],150:["T20","T18","D18"],149:["T20","T19","D16"],148:["T20","T20","D14"],147:["T20","T17","D18"],146:["T20","T18","D16"],145:["T20","T19","D14"],144:["T20","T20","D12"],143:["T20","T17","D16"],142:["T20","T14","D20"],141:["T20","T19","D12"],140:["T20","T20","D10"],139:["T20","T13","D20"],138:["T20","T18","D12"],137:["T20","T19","D10"],136:["T20","T20","D8"],135:["T20","T17","D12"],134:["T20","T14","D16"],133:["T20","T19","D8"],132:["T20","T16","D12"],131:["T20","T13","D16"],130:["T20","T18","D8"],129:["T19","T16","D12"],128:["T18","T14","D16"],127:["T20","T17","D8"],126:["T19","T15","D12"],125:["T20","T15","D10"],124:["T20","T16","D8"],123:["T19","T16","D9"],122:["T18","T20","D4"],121:["T20","T11","D14"],120:["T20","S20","D20"],119:["T19","T12","D13"],118:["T20","S18","D20"],117:["T20","S17","D20"],116:["T20","S16","D20"],115:["T20","S15","D20"],114:["T20","S14","D20"],113:["T20","S13","D20"],112:["T20","S12","D20"],111:["T20","S11","D20"],110:["T20","S10","D20"],109:["T20","S9","D20"],108:["T20","S8","D20"],107:["T19","S10","D20"],106:["T20","S6","D20"],105:["T20","S5","D20"],104:["T20","S4","D20"],103:["T19","S6","D20"],102:["T20","S2","D20"],101:["T20","S1","D20"],100:["T20","D20"],99:["T19","S2","D20"],98:["T20","D19"],97:["T19","D20"],96:["T20","D18"],95:["T19","D19"],94:["T18","D20"],93:["T19","D18"],92:["T20","D16"],91:["T17","D20"],90:["T18","D18"],89:["T19","D16"],88:["T20","D14"],87:["T17","D18"],86:["T18","D16"],85:["T19","D14"],84:["T20","D12"],83:["T17","D16"],82:["T14","D20"],81:["T19","D12"],80:["T20","D10"],79:["T13","D20"],78:["T18","D12"],77:["T19","D10"],76:["T20","D8"],75:["T17","D12"],74:["T14","D16"],73:["T19","D8"],72:["T16","D12"],71:["T13","D16"],70:["T18","D8"],69:["T15","D12"],68:["T20","D4"],67:["T17","D8"],66:["T10","D18"],65:["T19","D4"],64:["T16","D8"],63:["T13","D12"],62:["T10","D16"],61:["T15","D8"],60:["S20","D20"],59:["S19","D20"],58:["S18","D20"],57:["S17","D20"],56:["S16","D20"],55:["S15","D20"],54:["S14","D20"],53:["S13","D20"],52:["S12","D20"],51:["S11","D20"],50:["D-Bull"],49:["S9","D20"],48:["S8","D20"],47:["S7","D20"],46:["S6","D20"],45:["S5","D20"],44:["S4","D20"],43:["S3","D20"],42:["S2","D20"],41:["S1","D20"],40:["D20"],38:["D19"],36:["D18"],34:["D17"],32:["D16"],30:["D15"],28:["D14"],26:["D13"],24:["D12"],22:["D11"],20:["D10"],18:["D9"],16:["D8"],14:["D7"],12:["D6"],10:["D5"],8:["D4"],6:["D3"],4:["D2"],2:["D1"]};

function parseZoneStr(zoneStr) {
  if (!zoneStr) return null;
  if (zoneStr === "D-Bull") return { zone:"D-Bull", value:50, multiplier:2, number:25 };
  if (zoneStr === "Bull")   return { zone:"Bull",   value:25, multiplier:1, number:25 };
  const m = zoneStr.match(/^([STD])(\d+)$/);
  if (!m) return null;
  const mult = m[1]==="S"?1:m[1]==="D"?2:3;
  const num  = parseInt(m[2],10);
  return { zone:zoneStr, value:num*mult, multiplier:mult, number:num };
}

/* Försök träffa checkout-pilen. Returnerar alltid ett dart-objekt. */
function tryCheckoutDart(zoneStr, hitChance) {
  const target = parseZoneStr(zoneStr);
  if (!target) return null;
  const r = Math.random();
  if (r < hitChance) {
    return makeDart(target.zone, target.value, target.multiplier, target.number);
  }
  // Miss — angränsande singel eller ren miss
  if (r < hitChance + 0.25) {
    const adj = adjacentSector(target.number);
    return makeDart(`S${adj}`, adj, 1, adj);
  }
  return makeDart("Miss", 0, 0, 0);
}

/* ─────────────────────────────────────────────────────────
   NORMAL-KAST
   avgPerDart = avgPerRound / 3  (dvs. 5–26.7)

   Kalibrerade förväntade värden per nivå:
     Nybörjare (<8):   E ≈  5.5/pil → ~16/runda
     Casual    (8-13): E ≈ 11.2/pil → ~34/runda
     Medel    (13-18): E ≈ 16.5/pil → ~50/runda
     Bra      (18-23): E ≈ 21.2/pil → ~64/runda
     Pro       (≥23):  E ≈ 25.2/pil → ~76/runda
   ───────────────────────────────────────────────────────── */
function normalThrow(avgPerDart) {
  const r = Math.random();

  /* ── PRO ── avgPerDart ≥ 23 (avgPerRound ≥ 69)
     E = 0.06·0 + 0.15·3 + 0.15·20 + 0.10·19 + 0.15·34 + 0.08·9
         + 0.12·60 + 0.08·57 + 0.02·50 + 0.09·14 ≈ 25.2/pil          */
  if (avgPerDart >= 23) {
    if (r < 0.06) return makeDart("Miss",   0,  0, 0);
    const adjS = adjacentSector(20);              // S1 eller S5 (avg 3)
    if (r < 0.21) return makeDart(`S${adjS}`, adjS, 1, adjS);
    if (r < 0.36) return makeDart("S20",    20,  1, 20);
    if (r < 0.46) return makeDart("S19",    19,  1, 19);
    const dn  = sNum(14, 20);
    if (r < 0.61) return makeDart(`D${dn}`, dn*2, 2, dn);   // D14-D20 (avg 34)
    const adjT = adjacentSector(20);              // T1 eller T5 (avg 9)
    if (r < 0.69) return makeDart(`T${adjT}`, adjT*3, 3, adjT);
    if (r < 0.81) return makeDart("T20",    60,  3, 20);
    if (r < 0.89) return makeDart("T19",    57,  3, 19);
    if (r < 0.91) return makeDart("D-Bull", 50,  2, 25);
    const sn = sNum(10, 18);
    return makeDart(`S${sn}`, sn, 1, sn);
  }

  /* ── BRA ── avgPerDart 18-23 (avgPerRound 54-69)
     E = 0.05·0 + 0.15·3 + 0.22·20 + 0.13·19 + 0.20·32 + 0.15·13.5
         + 0.06·57 + 0.04·60 ≈ 21.2/pil                               */
  if (avgPerDart >= 18) {
    if (r < 0.05) return makeDart("Miss",   0,  0, 0);
    const adjS = adjacentSector(20);
    if (r < 0.20) return makeDart(`S${adjS}`, adjS, 1, adjS);
    if (r < 0.42) return makeDart("S20",    20,  1, 20);
    if (r < 0.55) return makeDart("S19",    19,  1, 19);
    const dn  = sNum(12, 20);
    if (r < 0.75) return makeDart(`D${dn}`, dn*2, 2, dn);   // D12-D20 (avg 32)
    const tn  = sNum(1, 8);
    if (r < 0.90) return makeDart(`T${tn}`, tn*3, 3, tn);   // T1-T8 (avg 13.5)
    if (r < 0.96) return makeDart("T19",    57,  3, 19);
    return                makeDart("T20",    60,  3, 20);
  }

  /* ── MEDEL ── avgPerDart 13-18 (avgPerRound 39-54)
     E = 0.08·0 + 0.20·12 + 0.20·18.75 + 0.20·20 + 0.20·21
         + 0.10·10.5 + 0.02·57 ≈ 16.5/pil                             */
  if (avgPerDart >= 13) {
    if (r < 0.08) return makeDart("Miss",   0,  0, 0);
    const sm  = sNum(8, 16);
    if (r < 0.28) return makeDart(`S${sm}`, sm, 1, sm);     // S8-S16 (avg 12)
    const sh  = sNum(17, 20);
    if (r < 0.48) return makeDart(`S${sh}`, sh, 1, sh);     // S17-S20 (avg 18.75)
    if (r < 0.68) return makeDart("S20",    20,  1, 20);
    const dn  = randomSector();
    if (r < 0.88) return makeDart(`D${dn}`, dn*2, 2, dn);   // D_random (avg 21)
    const tn  = sNum(1, 6);
    if (r < 0.98) return makeDart(`T${tn}`, tn*3, 3, tn);   // T1-T6 (avg 10.5)
    return                makeDart("T19",    57,  3, 19);    // sällsynt bra kast
  }

  /* ── CASUAL ── avgPerDart 8-13 (avgPerRound 24-39)
     E = 0.08·0 + 0.22·4.5 + 0.25·11.5 + 0.15·20 + 0.13·19
         + 0.17·11 ≈ 11.2/pil                                          */
  if (avgPerDart >= 8) {
    if (r < 0.08) return makeDart("Miss",   0,  0, 0);
    const sl  = sNum(1, 8);
    if (r < 0.30) return makeDart(`S${sl}`, sl, 1, sl);     // S1-S8 (avg 4.5)
    const sm  = sNum(8, 15);
    if (r < 0.55) return makeDart(`S${sm}`, sm, 1, sm);     // S8-S15 (avg 11.5)
    if (r < 0.70) return makeDart("S20",    20,  1, 20);
    if (r < 0.83) return makeDart("S19",    19,  1, 19);
    const dn  = sNum(1, 10);
    return                makeDart(`D${dn}`, dn*2, 2, dn);  // D1-D10 (avg 11)
  }

  /* ── NYBÖRJARE ── avgPerDart < 8 (avgPerRound < 24)
     E = 0.25·0 + 0.30·3 + 0.25·7 + 0.20·14 ≈ 5.45/pil              */
  if (r < 0.25) return makeDart("Miss",   0,  0, 0);
  const sl  = sNum(1, 5);
  if (r < 0.55) return makeDart(`S${sl}`, sl, 1, sl);       // S1-S5 (avg 3)
  const sm  = sNum(4, 10);
  if (r < 0.80) return makeDart(`S${sm}`, sm, 1, sm);       // S4-S10 (avg 7)
  const sh  = sNum(10, 18);
  return              makeDart(`S${sh}`, sh, 1, sh);         // S10-S18 (avg 14)
}

/* ─────────────────────────────────────────────────────────
   HUVUDFUNKTION
   generateBotThrow(avgPerRound, currentScore)

   avgPerRound (15-80) = snitt per RUNDA (3 pilar).
   Varje enskilt pil-anrop representerar 1 av de 3 pilarna.
   ───────────────────────────────────────────────────────── */
export function generateBotThrow(avgPerRound, currentScore) {
  const avg = clamp(avgPerRound, 15, 80);

  // ±15% slumpmässig variation per kast (realistisk spridning)
  const variedAvg  = avg * (1 + (Math.random() - 0.5) * 0.3);
  const avgPerDart = variedAvg / 3;

  // Checkout-läge (≤170): boten försöker checka ut smart
  if (currentScore <= 170 && currentScore > 1) {
    const ck = CK[currentScore];
    if (ck && ck.length >= 1) {
      // Träffchans: avg 80 → ~74%, avg 40 → ~32%, avg 15 → ~8%
      const hitChance = clamp((avg - 10) / 95, 0.08, 0.74);
      const dart = tryCheckoutDart(ck[0], hitChance);
      if (dart) return dart;
    }
  }

  return normalThrow(avgPerDart);
}

/* ─────────────────────────────────────────────────────────
   BULL-KAST för ThrowForBull
   Returnerar { x_mm, y_mm, dist }
   Hög avg → nära centrum; låg avg → längre bort
   ───────────────────────────────────────────────────────── */
export function generateBotBullThrow(avgScore) {
  const avg    = clamp(avgScore, 15, 80);
  // mean-distans: avg 80 → ~40 mm, avg 15 → ~170 mm
  const mean   = 200 - avg * 2;
  const stddev = 30 + (80 - avg) * 0.5;
  const dist   = clamp(mean + randn() * stddev, 0, 340);
  const angle  = Math.random() * 2 * Math.PI;
  return {
    x_mm: dist * Math.cos(angle),
    y_mm: dist * Math.sin(angle),
    dist,
  };
}
