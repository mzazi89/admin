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
    ('subgeneral',  'General',    '🤖 General'),
    ('subai',       'AI',         '🧠 AI'),
    ('subdl',       'Downloads',  '📥 Downloads'),
    ('subgroup',    'Group',      '👥 Group'),
    ('subprotect',  'Protection', '🛡 Protection'),
    ('subowner',    'Owner',      '👑 Owner'),
    ('subgames',    'Games',      '🎮 Games'),
    ('subfun',      'Fun',        '😂 Fun'),
    ('subutil',     'Utility',    '🛠 Utility'),
]

ROW_LIMIT = 20
SECTION_LIMIT = 10

def build_code(cat_label, total, sections_json):
    return f"""try {{
  const _upSec = Math.floor((Date.now() - startTime) / 1000);
  const _upStr = Math.floor(_upSec/86400)+'d '+Math.floor((_upSec%86400)/3600)+'h '+Math.floor((_upSec%3600)/60)+'m '+(_upSec%60)+'s';
  const _now = new Date();
  const _timeStr = _now.toLocaleTimeString('en-US', {{ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }});
  const _dateStr = _now.toLocaleDateString('en-US', {{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }});
  const _pushName = (m && m.pushName) || 'User';
  let _mode = '🌐 PUBLIC';
  try {{ const _s = loadJSON(settingsPath, {{ selfMode: false }}); if (_s.selfMode) _mode = '🔒 SELF'; }} catch (e) {{}}
  const _text = `👋 Hello ${{_pushName}}!\\n\\n📂 *{cat_label} Commands* ({total})\\n🕐 ${{_timeStr}} | 📅 ${{_dateStr}}\\n⏱ Uptime: ${{_upStr}} | ⚙️ ${{_mode}}\\n\\nTap a command below to use it:`;
  await sendInteractiveMessage(mzazi, sender, {{
    title: '𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂',
    text: _text,
    footer: 'Powered by MZAZI TECH INC',
    interactiveButtons: [
      {{ name: 'single_select', buttonParamsJson: JSON.stringify({{ title: '📂 {cat_label} COMMANDS', sections: {sections_json} }}) }},
      {{ name: 'quick_reply', buttonParamsJson: JSON.stringify({{ display_text: '🏠 Main Menu', id: prefix + 'menu6' }}) }}
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
for cmd_name, cat, cat_label in CATS:
    items = sorted(by_cat.get(cat, []), key=lambda c: c['name'])
    # exclude menu/sub commands from their own lists (avoid self-links)
    rows = []
    for c in items:
        n = c['name']
        if n.startswith('sub') or n.startswith('menu'):
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

    sections_json = '[' + ', '.join(sections) + ']'
    if len(sections) > SECTION_LIMIT:
        raise SystemExit(f'{cmd_name}: {len(sections)} sections exceed WhatsApp limit of {SECTION_LIMIT}')

    updates[cmd_name] = {
        'category': cat,
        'description': f'{cat_label} commands menu — all {total} commands',
        'code': build_code(cat_label, total, sections_json),
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
