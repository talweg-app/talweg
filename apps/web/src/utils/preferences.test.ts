import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, normalizePreferences } from "./preferences.js";
describe("workspace preferences",()=>{
  it("keeps free movement and existing wheel behavior as defaults",()=>{
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences({guestLimit:80,wheel:"unknown",grid:false})).toMatchObject({guestLimit:8,wheel:"auto",grid:false,snapToGrid:false});
    expect(normalizePreferences({guestLimit:0})).toMatchObject({guestLimit:1});
  });
  it("preserves spaces while a participant types their name and limits its length",()=>{
    expect(normalizePreferences({displayName:"Ivan "}).displayName).toBe("Ivan ");
    expect(normalizePreferences({displayName:"x".repeat(100)}).displayName).toHaveLength(40);
  });
  it("allows secure relays and local development relays without embedded credentials",()=>{
    expect(normalizePreferences({relayUrl:"wss://relay.example/join"}).relayUrl).toBe("wss://relay.example/join");
    expect(normalizePreferences({relayUrl:"ws://localhost:5173/relay"}).relayUrl).toContain("localhost");
    for(const relayUrl of ["https://example.org","ws://example.org","wss://user:password@example.org","javascript:alert(1)","wss://relay.example/?token=private"])
      expect(()=>normalizePreferences({relayUrl})).toThrow();
  });
  it("validates ICE arrays and restricts them to actual STUN and TURN endpoints",()=>{
    expect(normalizePreferences({iceServers:[{urls:"turns:example.org:5349",username:"user",credential:"secret"}]}).iceServers).toEqual([{urls:["turns:example.org:5349"],username:"user",credential:"secret"}]);
    for(const iceServers of [{},[null],[{urls:"https://example.org"}],Array.from({length:9},()=>({urls:"stun:example.org"}))])
      expect(()=>normalizePreferences({iceServers})).toThrow();
  });
});
