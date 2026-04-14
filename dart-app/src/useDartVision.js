import { useState, useEffect, useRef, useCallback } from "react";

/*
  useDartVision — WebSocket hook för live auto-scoring
  
  React 19 compliant:
  - Inga ref-uppdateringar under render
  - Inga synkrona setState i effect-body
  - All setState sker i WS-callbacks (externt system)
  - Cleanup nollställer handlers innan close
*/

const WS_URL = "ws://localhost:8000/ws/scoring";
const API_BASE = "http://localhost:8000";

function parseThrow(zone, score) {
  if (zone === "D-BULL") return { zone: "D-Bull", value: 50, label: "D-Bull", multiplier: 2, number: 25 };
  if (zone === "S-BULL") return { zone: "Bull", value: 25, label: "Bull", multiplier: 1, number: 25 };
  if (zone === "MISS") return { zone: "Miss", value: 0, label: "Miss", multiplier: 0, number: 0 };
  const prefix = zone[0];
  const num = parseInt(zone.substring(1));
  const multiplier = prefix === "T" ? 3 : prefix === "D" ? 2 : 1;
  return { zone, value: score, label: zone, multiplier, number: num };
}

export default function useDartVision({ onThrow, enabled = false }) {
  const [wsConnected, setWsConnected] = useState(false);
  const [wsDarts, setWsDarts] = useState([]);

  const onThrowRef = useRef(onThrow);
  const readyRef = useRef(false);
  const connectedAtRef = useRef(0);

  /* Synka onThrow-ref via effect (inte under render) */
  useEffect(() => { onThrowRef.current = onThrow; }, [onThrow]);

  /* ── Huvud-effect: WS-livscykel ── */
  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let ws = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    function connect() {
      if (disposed) return;

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (disposed) { ws.close(); return; }
        setWsConnected(true);
        connectedAtRef.current = Date.now();
        readyRef.current = false;
        reconnectAttempt = 0;
        console.log("🎯 DartVision WS ansluten");
      };

      ws.onclose = () => {
        if (disposed) return;
        setWsConnected(false);
        readyRef.current = false;
        console.log("❌ DartVision WS frånkopplad");
        const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempt), 15000);
        reconnectAttempt++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("DartVision WS error:", err);
        if (disposed) return;
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      };

      ws.onmessage = (e) => {
        if (disposed) return;
        try {
          const data = JSON.parse(e.data);

          if (data.type === "state") {
            setWsDarts(data.darts || []);
            if (!readyRef.current) readyRef.current = true;
          }

          if (data.type === "throw" && readyRef.current) {
            if (Date.now() - connectedAtRef.current < 500) return;
            const dartInfo = parseThrow(data.zone, data.score);
            dartInfo.is_edge = data.is_edge;
            dartInfo.cam = data.cam;
            onThrowRef.current?.(dartInfo);
          }

          if (data.type === "reset") {
            setWsDarts([]);
          }
        } catch (err) {
          console.error("DartVision WS parse error:", err);
        }
      };
    }

    connect();

    /* Cleanup: stäng WS utan att trigga reconnect */
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      }
    };
  }, [enabled]);

  const resetBackend = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/reset`, { method: "POST" });
      readyRef.current = false;
      connectedAtRef.current = Date.now();
    } catch (err) {
      console.error("DartVision reset error:", err);
    }
  }, []);

  /*
    Härledd output: om inte enabled → aldrig connected, inga darts.
    Undviker att behöva setState synkront i effect-body vid disable.
  */
  return {
    connected: enabled && wsConnected,
    darts: enabled ? wsDarts : [],
    resetBackend,
  };
}