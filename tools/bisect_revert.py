"""Bisect helper: restores one weapon (code file and data row) to the committed version. usage from game/: python ../tools/bisect_revert.py <weapon_id> <code_file>"""
import json
import subprocess
import sys

wid, code = sys.argv[1], sys.argv[2]
head = json.loads(subprocess.check_output(['git', 'show', 'HEAD:game/public/data/content.json']).decode('utf-8'))
old = next(w for w in head['weapons'] if w['id'] == wid)
p = 'public/data/content.json'
cur = json.load(open(p, encoding='utf-8'))
for i, w in enumerate(cur['weapons']):
    if w['id'] == wid:
        cur['weapons'][i] = old
json.dump(cur, open(p, 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
subprocess.check_call(['git', 'checkout', 'HEAD', '--', 'src/content/weapons/' + code])
print('reverted', wid, code)
