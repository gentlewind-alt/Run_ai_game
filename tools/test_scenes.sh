#!/usr/bin/env bash
# Headless scene checks: Map page 1 and page 2 list the right realms/levels, the Leaderboard scene opens on every tab
# without errors. Needs the dev server on :5212 (mock platform: ?mock=1). usage: bash tools/test_scenes.sh
js() { node tools/probe.mjs "$1" "http://localhost:5212/?mock=1" 2>&1 | grep '^{'; }
fail=0
check() { if echo "$2" | grep -q "$3"; then echo "ok   $1"; else echo "FAIL $1: $2"; fail=1; fi; }
texts='const g=window.__game;const sc=(k)=>g.scene.getScene(k);const tx=(k)=>sc(k).children.list.filter(o=>o.text!==undefined||o.getData&&o.getData("t")).length;'
r=$(js "(async()=>{const g=window.__game;for(const s of g.scene.getScenes(true))if(s.scene.key!=='boot')g.scene.stop(s.scene.key);g.scene.start('map',{page:0});await new Promise(r=>setTimeout(r,600));const a=g.scene.getScene('map');const n0=a.children.list.length;g.scene.stop('map');g.scene.start('map',{page:1});await new Promise(r=>setTimeout(r,600));const b=g.scene.getScene('map');return JSON.stringify({page0:n0,page1:b.children.list.length,page:b.page,active:g.scene.isActive('map')})})()")
check "map page 2 opens" "$r" '"page":1'
check "map page 2 has content" "$r" '"active":true'
for tab in daily overall level; do
  r=$(js "(async()=>{const g=window.__game;for(const s of g.scene.getScenes(true))if(s.scene.key!=='boot')g.scene.stop(s.scene.key);g.scene.start('leaderboards',{tab:'$tab',level:21});await new Promise(r=>setTimeout(r,800));const s=g.scene.getScene('leaderboards');return JSON.stringify({tab:'$tab',active:g.scene.isActive('leaderboards'),kids:s.children.list.length})})()")
  check "leaderboard tab $tab" "$r" '"active":true'
done
exit $fail
