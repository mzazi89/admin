#!/usr/bin/env python3
"""
Make ALL bot menu commands look like the main menu (menu6):
box banner + menu picture + '𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂' title/footer + interactive
buttons (single_select with every command of the menu, 🏠 Main Menu quick
reply, 🌐 mzazi.shop CTA).

Rebuilt:
- category menus: generalmenu, downloadmenu, funmenu, groupmenu, ownermenu,
  protectionmenu, utilitymenu  -> their category's FULL command list
- allmenu, menu7               -> EVERY command (paginated, multi-message)
- curated menus: faithmenu, languagemenu, lifestylemenu, searchmenu,
  settingsmenu, automenu       -> keyword-selected commands
- menu0, menun, menup, menuv   -> clone of the main menu (menu6)
"""
import json, re

SRC = 'data/bot-commands.json'
d = json.load(open(SRC))
cmds = d['commands']
by_name = {c['name']: c for c in cmds}
total_all = len(cmds)

ROW_LIMIT = 20
SECTION_LIMIT = 10
MAX_SECTIONS_MSG = 10

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

def esc(s):
    return (s.replace('\\', '\\\\').replace("'", "\\'")
             .replace('"', '\\"').replace('\n', '\\n'))

def rows_for(items):
    rows = []
    for c in items:
        n = c['name']
        if n.startswith('sub') or n.endswith('menu'):
            continue
        desc = (c.get('description') or '').strip()
        if len(desc) > 34: desc = desc[:33] + '…'
        desc_expr = f"prefix + '{n}'" + (f" + ' — ' + '{esc(desc)}'" if desc else "")
        rows.append(f'{{"id": prefix + \'{n}\', "title": "{esc(n)}", "description": {desc_expr}}}')
    return rows

def sections_from(rows):
    sections = []
    for i in range(0, len(rows), ROW_LIMIT):
        chunk = rows[i:i + ROW_LIMIT]
        page = i // ROW_LIMIT + 1
        sections.append('{"title": "' + esc(f'Commands • Part {page}') + '", "rows": [' + ', '.join(chunk) + ']}')
    return sections

def build_code(header, total, sections, multi=False):
    sections_json = '[' + ', '.join(sections) + ']'
    page_count = (len(sections) + MAX_SECTIONS_MSG - 1) // MAX_SECTIONS_MSG
    if page_count <= 1:
        msg = f"""
  const bannerTxt = `{BANNER}`;
  await sendInteractiveMessage(mzazi, sender, {{
    title: "𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂",
    text: bannerTxt + '\\n\\n' + '⚡ {header} COMMANDS ({total})\\n\\nTap a command to run it:',
    footer: "Powered by MZAZI TECH INC",
    ...(fs.existsSync(bPicPath) ? {{ image: {{ buffer: fs.readFileSync(bPicPath) }} }} : {{}}),
    interactiveButtons: [
      {{ name: 'single_select', buttonParamsJson: JSON.stringify({{ title: '{header} COMMANDS', sections: {sections_json} }}) }},
      {{ name: 'quick_reply', buttonParamsJson: JSON.stringify({{ display_text: '🏠 Main Menu', id: prefix + 'menu6' }}) }},
      {{ name: 'cta_url', buttonParamsJson: JSON.stringify({{ display_text: '🌐 mzazi.shop', url: 'https://mzazi.shop' }}) }}
    ]
  }});"""
    else:
        parts = []
        for p in range(page_count):
            chunk = sections[p * MAX_SECTIONS_MSG:(p + 1) * MAX_SECTIONS_MSG]
            chunk_json = '[' + ', '.join(chunk) + ']'
            last = p == page_count - 1
            buttons = f"""[
      {{ name: 'single_select', buttonParamsJson: JSON.stringify({{ title: '{header} COMMANDS • Part {p + 1}/{page_count}', sections: {chunk_json} }}) }},
      {{ name: 'quick_reply', buttonParamsJson: JSON.stringify({{ display_text: '🏠 Main Menu', id: prefix + 'menu6' }}) }}{'' if last else ''}
    ]"""
            if p == 0:
                parts.append(f"""
  const bannerTxt = `{BANNER}`;
  await sendInteractiveMessage(mzazi, sender, {{
    title: "𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂",
    text: bannerTxt + '\\n\\n' + '⚡ {header} COMMANDS ({total}) — Part {p + 1} of {page_count}\\n\\nTap a command to run it:',
    footer: "Powered by MZAZI TECH INC",
    ...(fs.existsSync(bPicPath) ? {{ image: {{ buffer: fs.readFileSync(bPicPath) }} }} : {{}}),
    interactiveButtons: {buttons}
  }});""")
            else:
                parts.append(f"""
  await sendInteractiveMessage(mzazi, sender, {{
    title: "𝐌𝐙𝐀𝐙𝐈 𝐓𝐄𝐂𝐇 𝐈𝐍𝐂",
    text: '⚡ {header} COMMANDS ({total}) — Part {p + 1} of {page_count}\\n\\nTap a command to run it:',
    footer: "Powered by MZAZI TECH INC",
    interactiveButtons: {buttons}
  }});""")
        msg = '\n'.join(parts)

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
{msg}
}} catch (e) {{
  return mzazireply('❌ Menu error: ' + (e.message || e));
}}
return;"""

CATEGORY_MENUS = {
    'generalmenu': 'General', 'downloadmenu': 'Downloads', 'funmenu': 'Fun',
    'groupmenu': 'Group', 'ownermenu': 'Owner', 'protectionmenu': 'Protection',
    'utilitymenu': 'Utility',
}

HEADERS = {
    'generalmenu': '🤖 GENERAL', 'downloadmenu': '📥 DOWNLOADS', 'funmenu': '😂 FUN',
    'groupmenu': '👥 GROUP', 'ownermenu': '👑 OWNER', 'protectionmenu': '🛡 PROTECTION',
    'utilitymenu': '🛠 UTILITY', 'allmenu': '📋 ALL', 'menu7': '📋 ALL',
}

# keyword filters for the curated menus (name + aliases, word-boundary)
SPECIAL_FILTERS = {
    'faithmenu': ['quran', 'dua', 'hadith', 'bible', 'pray', 'prayer', 'ramadan', 'eid',
                  'church', 'islam', 'allah', 'jesus', 'god', 'worship', 'grace', 'faith', 'surah', 'ayat', 'sholat'],
    'languagemenu': ['translate', 'trans', 'language', 'lang', 'spelling', 'hilih', 'alay',
                     'vaporwave', 'zalgo', 'mono', 'bold', 'italic', 'fancy', 'font', 'ascii',
                     'attp', 'ttp', 'unicode', 'base64', 'binary', 'binar', 'hex', 'unhex', 'reverse'],
    'lifestylemenu': ['quote', 'motivasi', 'zodiac', 'horoscope', 'dream', 'tips', 'health',
                      'life', 'galau', 'bucin', 'sad', 'advice', 'wisdom', 'motivation', 'katabijak'],
    'searchmenu': ['search', 'find', 'google', 'wiki', 'wikipedia', 'ytsearch', 'image',
                   'img', 'pinterest', 'anime', 'lookup', 'whois', 'domain', 'info', 'cek', 'check'],
    'settingsmenu': ['set', 'mode', 'self', 'public', 'toggle', 'lock', 'unlock', 'enable',
                     'disable', 'autostatus', 'autoread', 'autorecord', 'autotyping',
                     'alwaysonline', 'afk', 'botmode', 'botname', 'botpic', 'welcome', 'goodbye'],
    'automenu': ['auto'],
}

REDIRECT_MENUS = ['menu0', 'menun', 'menup', 'menuv']

def filtered_items(menu_name, filters):
    out = []
    for c in cmds:
        n = c['name']
        if n.startswith('sub') or n.endswith('menu'):
            continue
        w = ' ' + n.lower() + ' ' + ' '.join(c.get('aliases') or []).lower() + ' '
        if any(re.search(r'(?<![a-z0-9])' + re.escape(k), w) for k in filters):
            out.append(c)
    return out

by_cat = {}
for c in cmds:
    by_cat.setdefault(c['category'], []).append(c)

def sort_key(c):
    return c['name']

updates = {}

# 1) category menus
for name, cat in CATEGORY_MENUS.items():
    items = sorted(by_cat.get(cat, []), key=sort_key)
    rows = rows_for(items)
    sections = sections_from(rows)
    updates[name] = {
        'category': cat, 'description': f'{HEADERS[name]} commands menu — all {len(rows)} commands',
        'code': build_code(HEADERS[name], len(rows), sections),
    }

# 2) all-commands menus (multi-message pagination)
all_items = sorted([c for c in cmds if not c['name'].startswith('sub') and not c['name'].startswith('menu')], key=sort_key)
all_rows = rows_for(all_items)
all_sections = sections_from(all_rows)
for name in ['allmenu', 'menu7']:
    updates[name] = {
        'category': 'General', 'description': f'All commands menu — {len(all_rows)} commands',
        'code': build_code(HEADERS[name], len(all_rows), all_sections, multi=True),
    }

# 3) curated menus
for name, filters in SPECIAL_FILTERS.items():
    items = sorted(filtered_items(name, filters), key=sort_key)
    rows = rows_for(items)
    sections = sections_from(rows)
    header = name[:-4].upper()
    updates[name] = {
        'category': 'General', 'description': f'{header} commands menu — {len(rows)} commands',
        'code': build_code(header, len(rows), sections),
    }

# 4) redirect menus -> clone the main menu
main_menu_code = by_name['menu6']['code']
for name in REDIRECT_MENUS:
    updates[name] = {'category': 'General', 'description': 'Main menu (buttons)', 'code': main_menu_code}

# Apply
for n, patch in updates.items():
    if n in by_name:
        by_name[n].update(patch)
    else:
        cmds.append({'name': n, 'aliases': [], 'description': '', 'category': 'General',
                     'usage': '', 'ownerOnly': False, 'adminOnly': False, 'groupOnly': False,
                     'enabled': True, 'code': ''})
        by_name[n] = cmds[-1]
        by_name[n].update(patch)

# Refresh any stale "All NNNN Commands" counts
for c in cmds:
    code = c.get('code') or ''
    if 'All ' in code and 'Commands' in code:
        c['code'] = re.sub(r'All \d+ Commands', f'All {total_all} Commands', code)

d['meta'] = {**d.get('meta', {}), 'updatedAt': '2026-08-31T00:00:00Z', 'allMenusRebuilt': True}
json.dump(d, open(SRC, 'w'), ensure_ascii=False, indent=1)

print('Rebuilt menus:')
for n, patch in updates.items():
    code = patch['code']
    print(f'  {n}: {patch["description"]} ({len(code)} chars)')
print('Saved.')
