#!/usr/bin/env python3
"""Concept art for every level (24) and every weapon effect (22) with `rundot generate image` (120 credits each).

Prompts are built from the game data so they match what is in the game: realm theme, level kind, monsters, and a fort
that grows in size and complexity with the level number. Weapon prompts describe the tap ability in action.
Output: docs/concepts/levels/level_NN.png and docs/concepts/weapons/<id>.png. Skips files that already exist.
usage (from the repo root): python tools/gen_all_concepts.py
"""
import glob
import json
import os
import subprocess
import time

R = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'Rundot', 'rundot.exe')
REF = 'docs/handoff/shots/gen/omni_arm_in_game.png'
STYLE = '16-bit SNES pixel art, side view of a slingshot siege game, crisp pixels, limited palette, no text, no UI'

REALMS = {
    'goblin_hills': 'green rolling hills, warm brown dirt, bright blue daytime sky',
    'dark_elf_wood': 'purple night forest with glowing fireflies',
    'iron_keep': 'grey stone castle walls at dusk with orange torchlight',
    'frost_peaks': 'snowy mountain ridges at blue dusk, falling snow, ice crystal blocks',
    'ember_forge': 'volcanic furnace cave, red and plum sky glowing from lava, basalt ground, drifting embers',
    'sky_citadel': 'floating stone citadel above the clouds, slate and cyan sky with gold lightning',
}
KIND = {
    'siege': 'a block fort full of monsters to topple',
    'runner': 'skeleton runners racing across the level toward an exit door while guards defend',
    'boss': 'a boss throne fortress ringed by stone and iron with the boss monster in the middle',
}
TIER = [
    'a small single tower of wood planks and stone pillars',
    'two towers with a gap between them, wood and stone',
    'a two-tier fortress of stone pillars and wood floors with a hidden treasure chest',
    'a tall three-tier fortress with iron plates, overhangs and monsters on every floor',
    'a sprawling multi-tower castle with iron-reinforced walls, bridges between towers and pits',
    'a massive layered citadel: nested walls, iron and crystal blocks, high perches and a deep moat',
]

WEAPON_FX = {
    'w_militia_blade': 'a spinning short sword that lands and rolls along the ground as a whirling sawblade, sparks flying',
    'w_iron_cleaver': 'a heavy cleaver slamming into the ground and leaving a crater with shockwave rings that throw blocks',
    'w_ashwood_staff': 'a wooden staff releasing a volley of three homing ember bolts that split on impact',
    'w_scrapheap_scattergun': 'a scrap shotgun bursting into a cone of pellets, each popping in a small blast where it lands',
    'w_hunters_pike': 'a spear piercing straight through wooden planks and monsters, then blasting the stone wall it hits',
    'w_hunters_boomerang': 'a boomerang curving back toward the slingshot, slicing everything along its return path',
    'w_blast_tube': 'a tube launcher detonating in a huge nuke-style explosion with a white flash and three shock rings',
    'w_horned_scepter': 'a horned scepter bursting in a purple curse cloud and leaving a burning fire pool on the ground',
    'w_comet_fists': 'giant stone fists dive-slamming the ground, an earthquake wave knocking monsters flat and a rock spike bursting up',
    'w_bulwark_disc': 'a round shield disc ricocheting between monsters, leaving ghost trails, its last bounce ringing out in a shield blast',
    'w_skyforge_maul': 'a war hammer calling a lightning bolt from the sky that forks to a second monster, with a crackling electric field',
    'w_steersong_arrow': 'a glowing arrow steering mid-flight and splitting into three arrows',
    'w_silkline_shooters': 'wrist shooters firing sticky web lines that pin monsters to the walls',
    'w_kinetic_palms': 'armoured gauntlets firing a repulsor blast of force that shoves a whole tower over',
    'w_brahmastra_arrow': 'a golden mythic arrow turning into a focused white-gold beam of light that cuts across the battlefield',
    'w_omnitrix_dial': 'a green and black dial flashing, then five giant alien forearms (fire claw, brute fist, crystal arm, stone arm, lightning arm) crashing down from the sky, bouncing once and rising back up',
    'w_pinata_mirv': 'a colourful paper pinata bursting mid-air into five candy bombs that rain down in a fan',
    'w_hailstorm_cauldron': 'an iron cauldron tipping over in the sky and pouring a rain of scalding green stew drops onto the fort',
    'w_rolling_millstone': 'a heavy stone millstone rolling along the ground and crushing blocks and monsters',
    'w_earthworm_drill': 'an armoured earthworm with a drill snout diving into the ground and erupting under the fort',
    'w_chain_rod': 'a copper rod releasing chain lightning that jumps from monster to monster',
    'w_black_hole_marble': 'a dark marble opening a swirling black hole that drags blocks and monsters in, then collapsing in a shock wave',
}


def gen(path, prompt):
    if os.path.exists(path):
        print('skip', path, flush=True)
        return
    for i in range(6):
        r = subprocess.run([R, 'generate', 'image', '--prompt', prompt, '--aspect-ratio', '16:9', '--reference-image', REF,
                            '--out', path, '--max-credits', '150'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode == 0 and os.path.exists(path):
            print('ok', path, flush=True)
            return
        print('retry', path, i + 1, (r.stdout + r.stderr).strip().splitlines()[-1:] if (r.stdout + r.stderr).strip() else '', flush=True)
        time.sleep(25)
    print('FAILED', path, flush=True)


def main():
    os.makedirs('docs/concepts/levels', exist_ok=True)
    os.makedirs('docs/concepts/weapons', exist_ok=True)
    content = json.load(open('game/public/data/content.json', encoding='utf-8'))
    names = {m['id']: m['name'] for m in content['monsters']}
    for f in sorted(glob.glob('game/public/data/levels/level_*.json')):
        lv = json.load(open(f, encoding='utf-8'))
        n = lv['id']
        if not 1 <= n <= 24:
            continue
        mons = sorted({names.get(m['t'], m['t']) for m in lv['monsters']})
        tier = TIER[min(len(TIER) - 1, (n - 1) // 4)]
        step = ['simple', 'a bit harder', 'complex', 'the hardest of the realm'][(n - 1) % 4]
        prompt = (f"{STYLE}. Level {n} concept, '{lv['name']}': {REALMS.get(lv['realm'], '')}. A wooden slingshot on the far left; "
                  f"{KIND.get(lv['kind'], '')}; the fort is {tier}, {step} for this realm. Monsters: {', '.join(mons)}.")
        gen(f'docs/concepts/levels/level_{n:02d}.png', prompt)
    for w in content['weapons']:
        fx = WEAPON_FX.get(w['id'])
        if not fx:
            continue
        prompt = f"{STYLE}. Weapon ability effect concept for '{w['name']}': {fx}. Bright readable effect over a monster fort, dramatic action frame."
        gen(f"docs/concepts/weapons/{w['id']}.png", prompt)
    print('DONE', flush=True)


if __name__ == '__main__':
    main()
