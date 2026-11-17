// Bot-vs-bot balance check:  node tools/balance.mjs [games]
import * as sim from '../js/sim.js';
import { packState } from '../js/net.js';
const N = +process.argv[2] || 60; const MAPID = process.argv[3] || "street"; let police = 0, secs = 0, freed = 0, escaped = 0, goals = 0, buys = 0, cash = 0, maxSnap = 0;
for (let i = 0; i < N; i++){
  sim.newMatch({ map: MAPID });
  for (let s = 0; !sim.G.over && s < 60*300; s++){ sim.step(1/60, () => null); if (s%120===0) maxSnap = Math.max(maxSnap, JSON.stringify(packState(sim.G)).length); }
  if (sim.G.over.win === 'P') police++;
  secs += sim.G.playT; escaped += sim.G.escaped; freed += sim.G.ents.reduce((a,e) => a + e.stats.rescues, 0);
  goals += sim.G.ents.reduce((a,e) => a + e.stats.goals, 0); buys += sim.G.ents.reduce((a,e) => a + e.stats.buys, 0); cash += sim.G.ents.reduce((a,e) => a + e.stats.cash, 0);
}
console.log(`police win ${police}/${N} (${Math.round(police/N*100)}%), average round ${Math.round(secs/N)}s, ${(freed/N).toFixed(1)} freed and ${(escaped/N).toFixed(1)} escaped per game`);
console.log(`per game: ${(goals/N).toFixed(2)} goals, ${(buys/N).toFixed(1)} shop buys, ₦${Math.round(cash/N)} left in pockets; biggest snapshot ${maxSnap} bytes`);
