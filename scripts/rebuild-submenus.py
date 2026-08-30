#!/usr/bin/env python3
"""
Rebuild the 9 category sub-menu commands (subgeneral, subai, subdl, subgroup,
subprotect, subowner, subgames, subfun, subutil) so their selecting buttons
contain EVERY command of the category — chunked into sections of <= 20 rows
(WhatsApp list limit: 10 sections / message), each ending with a
🏠 Main Menu quick reply. Also refreshes the "All NNNN Commands" count in the
menu6 button.
"""
import json, re

SRC = 'data/bot-commands.json'
d = json.load(open(SRC))
cmds = d['commands']

CATS = [
    ('subgeneral',  'General',    '🤖 General',    '🤖 GENERAL'),
    ('subai',       'AI',         '🧠 AI',         '🧠 AI'),
    ('subdl',       'Downloads',  '📥 Downloads',  '📥 DOWNLOADS'),
    ('subgroup',    'Group',      '👥 Group',      '👥 GROUP'),
    ('subprotect',  'Protection', '🛡 Protection', '🛡 PROTECTION'),
    ('subowner',    'Owner',      '👑 Owner',      '👑 OWNER'),
    ('subgames',    'Games',      '🎮 Games',      '🎮 GAMES'),
    ('subfun',      'Fun',        '😂 Fun',        '😂 FUN'),
    ('subutil',     'Utility',    '🛠 Utility',    '🛠 UTILITY'),
]

ROW_LIMIT = 20
SECTION_LIMIT = 10

# The exact main-menu (menu6) look: box banner + picture + title/footer.
BANNER = """╔═════════════╗
║➥✦ 𝐐𝐔𝐀𝐑𝐓𝐙 𝐗𝐃 ✦
╠═════════════╣
║➥┌──────────┐
║➥│ 👤 USER    : ${bPushName}
║➥│ 📱 NUMBER  : ${botPhoneNum}
║➥│ ⏱ UPTIME  : ${bUpStr}
║➥│ 🕐 TIME    : ${bTimeStr}
║➥│ 📅 DATE    : ${bDateStr}
║➥│ 📌 VERSION : 3.2.1
║➥│ ⚙️ MODE    : ${bMode}
║➥│ 🔱 PREFIX  : ${prefix}
║➥│ OWNER : ᴍᴢᴀᴢɪ ᴛᴇᴄʜ
║➥└──────────┘
╚═════════════╝"""

def build_code(header, total, sections_json):
    return f"""try {{
  // ── Menu banner + picture (matches the main menu look) ──
  const bCustomPic = `./database/sessions/${{botPhoneNum}}/menu.jpg`;
  const bDefaultPic = "./media/menu.jpg";
  const bPicPath = fs.existsSync(bCustomPic) ? bCustomPic : bDefaultPic;
  const bUpSec = Math.floor((Date.now() - startTime) / 1000);
  const bUpStr = Math.floor(bUpSec / 86400) + 'd ' + Math.floor((bUpSec % 86400) / 3600) + 'h ' + Math.floor((bUpSec % 3600) / 60) + 'm ' + (bUpSec % 60) + 's';
  const bNow = new Date();
  const bTimeStr = bNow.toLocaleTimeString('en-US', {{ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }});
  const bDateStr = bNow.toLocaleDateString('en-US', {{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }});
  const bPushName = (m && m.pushName) || 'User';
  let bMode = '🌐 PUBLIC';
  try {{ const _s = loadJSON(settingsPath, {{ selfMode: false }}); if (_s.selfMode) bMode = '🔒 SELF'; }} catch (e) {{}}
  const bannerTxt = `{BANNER}`;
  await sendInteractiveMessage(mzazi, sender, {{
    title: "𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂",
    text: bannerTxt + '\\n\\n' + '⚡ {header} COMMANDS ({total})\\n\\nTap a command to run it:',
    footer: "Powered by MZAZI TECH INC",
    ...(fs.existsSync(bPicPath) ? {{ image: {{ buffer: fs.readFileSync(bPicPath) }} }} : {{}}),
    interactiveButtons: [
      {{ name: 'single_select', buttonParamsJson: JSON.stringify({{ title: '{header} COMMANDS', sections: {sections_json} }}) }}
    ]
  }});
}} catch (e) {{
  return mzazireply('❌ Menu error: ' + (e.message || e));
}}
return;"""

def esc(s):
    # escapes for single-quoted JS strings inside the generated code
    return (s.replace('\\', '\\\\')
             .replace("'", "\\'")
             .replace('"', '\\"')
             .replace('\n', '\\n'))

by_cat = {}
for c in cmds:
    by_cat.setdefault(c['category'], []).append(c)

total_all = len(cmds)
updates = {}
for cmd_name, cat, cat_label, header in CATS:
    items = sorted(by_cat.get(cat, []), key=lambda c: c['name'])
    # exclude menu/sub commands from their own lists (avoid self-links)
    rows = []
    for c in items:
        n = c['name']
        if n.startswith('sub') or n.endswith('menu'):
            continue
        desc = (c.get('description') or '').strip()
        if len(desc) > 34: desc = desc[:33] + '…'
        title = n
        id_ = f"prefix + '{n}'"
        desc_expr = f"prefix + '{n}'" + (f" + ' — ' + '{esc(desc)}'" if desc else "")
        rows.append(f'{{"id": {id_}, "title": "{esc(title)}", "description": {desc_expr}}}')

    total = len(rows)
    sections = []
    for i in range(0, len(rows), ROW_LIMIT):
        chunk = rows[i:i + ROW_LIMIT]
        page = i // ROW_LIMIT + 1
        sections.append('{"title": "' + esc(f'{cat_label} • Part {page}') + '", "rows": [' + ', '.join(chunk) + ']}')
    # navigation row lives INSIDE the list (no extra buttons)
    sections.append("{\"title\": \"🗂 MENU\", \"rows\": [{\"id\": prefix + 'menu6', \"title\": \"🏠 Main Menu\", \"description\": prefix + 'menu6'}]}")

    sections_json = '[' + ', '.join(sections) + ']'
    if len(sections) > SECTION_LIMIT:
        raise SystemExit(f'{cmd_name}: {len(sections)} sections exceed WhatsApp limit of {SECTION_LIMIT}')

    updates[cmd_name] = {
        'category': cat,
        'description': f'{cat_label} commands menu — all {total} commands',
        'code': build_code(header, total, sections_json),
    }

# Apply to the seed
by_name = {c['name']: c for c in cmds}
missing = [n for n in updates if n not in by_name]
if missing:
    print('Adding missing sub commands:', missing)
    for n in missing:
        cmds.append({'name': n, 'aliases': [], 'description': '', 'category': 'General',
                     'usage': '', 'ownerOnly': False, 'adminOnly': False, 'groupOnly': False,
                     'enabled': True, 'code': ''})
        by_name[n] = cmds[-1]

for n, patch in updates.items():
    by_name[n].update(patch)

# Refresh the "All NNNN Commands" count in menu6
m6 = by_name.get('menu6')
if m6 and m6.get('code'):
    m6['code'] = re.sub(r'All \d+ Commands', f'All {total_all} Commands', m6['code'])

# Also refresh any remaining stale counts in other codes
for c in cmds:
    code = c.get('code') or ''
    if 'All ' in code and 'Commands' in code:
        code = re.sub(r'All \d+ Commands', f'All {total_all} Commands', code)
        c['code'] = code

d['meta'] = {**d.get('meta', {}), 'updatedAt': '2026-08-31T00:00:00Z', 'submenusRebuilt': True}
json.dump(d, open(SRC, 'w'), ensure_ascii=False, indent=1)

print('Rebuilt sub-menus:')
for n, patch in updates.items():
    print(f'  {n}: {patch["description"]} ({len(patch["code"])} chars)')
print(f'menu6 count -> All {total_all} Commands')
print('Saved.')
