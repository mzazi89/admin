#!/usr/bin/env python3
"""
Re-categorize bot commands (conservative v2):
- Match on NAME + ALIASES only, with word-boundary regexes (no raw code
  sniffing — code text contains too many false positives).
- Owner = ownerOnly flag (authoritative).
- Protection / Utility extraction is the main goal (menu buttons exist but
  the categories were empty).
- Unmatched commands KEEP their original category (never force 'General').
"""
import json, re

SRC = 'data/bot-commands.json'
d = json.load(open(SRC))
cmds = d['commands']

def words(c):
    return ' ' + c.get('name', '').lower() + ' ' + ' '.join(c.get('aliases') or []).lower() + ' '

def has(c, keys):
    w = words(c)
    return any(re.search(r'(?<![a-z0-9])' + re.escape(k) + r'(?![a-z0-9])', w) for k in keys)

def has_prefix(c, prefixes):
    w = words(c)
    return any(re.search(r'(?<![a-z0-9])' + re.escape(p), w) for p in prefixes)

# Owner: authoritative flag only
OWNER_FLAG = lambda c: bool(c.get('ownerOnly'))

PROTECTION = ['anti', 'protect', 'welcome', 'goodbye', 'farewell', 'lockgc', 'unlockgc', 'warn',
              'nsfw', 'viewonce', 'filter', 'virus', 'mute', 'kickall', 'autoblock', 'spam', 'banned']
PROTECTION_PREFIX = ['anti', 'autoanti']

DOWNLOADS = ['ytmp3', 'ytmp4', 'ytsearch', 'ytplay', 'tiktok', 'igdl', 'ig', 'instagram', 'fbdl', 'facebook',
             'twitter', 'twdl', 'mediafire', 'mega', 'terabox', 'soundcloud', 'spotify', 'mp3', 'mp4', 'play',
             'lyric', 'tomp3', 'tomp4', 'toaudio', 'tovideo', 'apk', 'mod', 'pinterest', 'reddit', 'thread',
             'sfile', 'pixeldrain', 'zippyshare', 'gif', 'dl', 'download', 'song', 'music']

AI = ['ai', 'gpt', 'gemini', 'chatgpt', 'dalle', 'imagine', 'img', 'imgen', 'stablediffusion', 'openai',
      'deepseek', 'llama', 'claude', 'bard', 'copilot', 'remini', 'upscale', 'enhance', 'ocr', 'removebg',
      'waifu', 'caption', 'translate', 'tts', 'summarize', 'blackbox', 'flux', 'midjourney', 'text2img',
      'aiimg', 'aichat', 'imgen', 'imagine', 'draw', 'bing', 'photogpt', 'imagegen', 'image']
AI_PREFIX = ['ai', 'img']

GAMES = ['game', 'quiz', 'rps', 'ttt', 'c4', 'hangman', 'scramble', 'wordchain', 'guess', 'fastmath',
         'gacha', 'casino', 'blackjack', 'slot', 'poker', 'werewolf', 'mafia', 'hunt', 'fish', 'duel',
         'fight', 'battle', 'race', 'ludo', 'chess', 'sudoku', 'wordle', 'family100', 'tebak', 'kuis',
         'trivia', 'challenge', 'fillblank', 'suit', 'capcai', 'leaderboard']
GAMES_PREFIX = ['endc4', 'endfastmath', 'endguess', 'endhangman', 'endquiz', 'endrps', 'endscramble', 'endttt', 'endwordchain']

UTILITY = ['calc', 'calcula', 'kalkulator', 'math', 'countdown', 'timer', 'stopwatch', 'base64', 'binary',
           'binar', 'hex', 'unicode', 'font', 'bold', 'italic', 'lowercase', 'uppercase', 'textpro',
           'photooxy', 'short', 'bitly', 'tinyurl', 'whois', 'uuid', 'hash', 'md5', 'sha', 'passgen',
           'password', 'qr', 'weather', 'cuaca', 'clock', 'date', 'currency', 'exchange', 'crypto',
           'sticker', 'emojimix', 'emoji', 'color', 'colour', 'copy', 'screenshot', 'barcode', 'birthday',
           'age', 'ascii', 'attp', 'contact', 'forward', 'downloadfile', 'paste', 'bin', 'json', 'toimg',
           'cek', 'check', 'lookup', 'domain', 'ssl', 'dns', 'geoip', 'location', 'fake', 'hilih', 'alay',
           'ss', 'translate', 'tts', 'ip', 'getpp', 'getgpp', 'chatid', 'idch', 'bug', 'changelog', 'clearwarn']
UTILITY_PREFIX = ['base64']

GROUP = ['group', 'gc', 'gclink', 'grouplink', 'linkgroup', 'promote', 'demote', 'kick', 'tagall',
         'mentionall', 'hidetag', 'admin', 'member', 'join', 'invite', 'approve', 'reject', 'setname',
         'setdesc', 'rename', 'topic', 'participants', 'announce', 'desc', 'subject', 'who', 'open',
         'close', 'add', 'del', 'remove', 'restrict', 'unrestrict', 'everyone', 'all', 'calladmin',
         'kickme', 'kickmember', 'groupid', 'groupinfo', 'groupmembers', 'groupname', 'groupowner']
GROUP_PREFIX = ['gc', 'group']

FUN = ['joke', 'meme', 'quote', 'fact', 'fakta', 'flirt', 'dare', 'truth', 'wouldyourather', 'ship', 'love',
       'marry', 'couple', 'hug', 'kiss', 'slap', 'punch', 'pat', 'insult', 'roast', 'howgay', 'howcute',
       'howrich', 'howstupid', 'howugly', 'iq', '8ball', 'advice', 'fortune', 'horoscope', 'zodiac',
       'catfact', 'dogfact', 'chucknorris', 'compliment', 'clap', 'choose', 'imba', 'fun', 'riddle', 'pun',
       'sad', 'galau', 'bucin', 'motivasi', 'quotes', 'gombal', 'pickup', 'laugh', 'greetings',
       'goodafternoon', 'goodevening', 'goodmorning', 'goodnight', 'flirt', 'friends', 'christmas', 'eid',
       'dua', 'hadith', 'bible', 'advice', 'random']
FUN_PREFIX = ['how']

# Precise overrides for commands whose names don't self-describe
OVERRIDES = {
    # Protection (anti-spam / welcomes / locks / warn family / toggles)
    'lockgroup': 'Protection', 'unlockgroup': 'Protection', 'goodbye1': 'Protection',
    'welcome1': 'Protection', 'bye2': 'Protection', 'mywarn': 'Protection',
    'resetwarn': 'Protection', 'warnlist': 'Protection', 'clearwarn': 'Protection',
    'unmute': 'Protection', 'unmute2': 'Protection',
    'toggleaudio': 'Protection', 'togglebadword': 'Protection', 'toggleflood': 'Protection',
    'togglegif': 'Protection', 'toggleimage': 'Protection', 'togglensfw': 'Protection',
    'togglesticker': 'Protection', 'togglevideo': 'Protection',
    # Utility (text tools, converters, lookups)
    'morse': 'Utility', 'unmorse': 'Utility', 'mono': 'Utility', 'reverse': 'Utility',
    'zalgo': 'Utility', 'vaporwave': 'Utility', 'ascii3': 'Utility', 'asc': 'Utility',
    'shorten': 'Utility', 'sha1': 'Utility', 'sha256': 'Utility', 'time': 'Utility',
    'timezone': 'Utility', 'url': 'Utility', 'vcard': 'Utility', 'stickertoimg': 'Utility',
    'ttp': 'Utility', 'unhex': 'Utility', 'pdf2': 'Utility', 'definition': 'Utility',
    'synonym': 'Utility', 'char': 'Utility', 'speed': 'Utility', 'ping': 'Utility',
    'ping0': 'Utility', 'ping100': 'Utility', 'ping11': 'Utility', 'ping2': 'Utility',
    'ipinfo': 'Utility', 'country': 'Utility', 'strike': 'Utility', 'take': 'Utility',
    'link': 'Utility',
    # Downloads (music / video)
    'play10': 'Downloads', 'play11': 'Downloads', 'play2': 'Downloads', 'playclear': 'Downloads',
    'playdl': 'Downloads', 'playdoc': 'Downloads', 'lyrics': 'Downloads', 'lyrics2': 'Downloads',
    'ytinfo': 'Downloads', 'p10dl': 'Downloads', 'p3dl': 'Downloads', 'video': 'Downloads',
    # Games
    'coinflip': 'Games', 'dice': 'Games', 'rps1v1': 'Games', 'nhie': 'Games', 'nhie2': 'Games',
    'word': 'Games', 'leaderboard': 'Games',
    # Fun
    'rank': 'Fun', 'ngl': 'Fun', 'fact2': 'Fun', 'dayfact': 'Fun', 'numberfact': 'Fun',
    'poem': 'Fun', 'story': 'Fun', 'tod': 'Fun',
    # Group (join requests, polls, tags, links)
    'joinrequest': 'Group', 'pendingrequests': 'Group', 'approve': 'Group', 'acceptall': 'Group',
    'rejectreq': 'Group', 'rejectall': 'Group', 'tagadmin': 'Group', 'tagbots': 'Group',
    'invitegroup': 'Group', 'memberscount': 'Group', 'revoke': 'Group', 'poll': 'Group',
    # AI
    'chatbot': 'AI', 'chemistryai': 'AI', 'mathgpt': 'AI', 'gemini2': 'AI', 'wiki': 'AI',
    # General (bot info/settings)
    'public': 'General', 'self': 'General', 'setmode': 'General', 'owner': 'General',
}

def classify(c):
    name = c.get('name', '')
    if name in OVERRIDES: return OVERRIDES[name]
    # Functional category FIRST (so owner-only toggles still land in their
    # menu, e.g. welcome/lockgc/warn -> Protection) ...
    if has_prefix(c, PROTECTION_PREFIX) or has(c, PROTECTION): return 'Protection'
    if has(c, DOWNLOADS): return 'Downloads'
    if has_prefix(c, AI_PREFIX) or has(c, AI): return 'AI'
    if has_prefix(c, GAMES_PREFIX) or has(c, GAMES): return 'Games'
    if has_prefix(c, UTILITY_PREFIX) or has(c, UTILITY): return 'Utility'
    if has_prefix(c, GROUP_PREFIX) or has(c, GROUP): return 'Group'
    if has_prefix(c, FUN_PREFIX) or has(c, FUN): return 'Fun'
    # ... then the owner flag for pure owner-management tools
    if OWNER_FLAG(c): return 'Owner'
    # Keep whatever the admin already assigned
    return c.get('category') or 'General'

from collections import Counter
new_cats = Counter()
changes = Counter()
for c in cmds:
    old = c.get('category', 'General')
    new = classify(c)
    if old != new:
        changes[(old, new)] += 1
    c['category'] = new
    new_cats[new] += 1

print('NEW distribution:', dict(new_cats.most_common()))
print('\nMoves (old -> new: count):')
for (o, n), cnt in changes.most_common():
    print(f'  {o} -> {n}: {cnt}')

d['meta'] = {**d.get('meta', {}), 'updatedAt': '2026-08-31T00:00:00Z', 'reclassified': True}
json.dump(d, open(SRC, 'w'), ensure_ascii=False, indent=1)
print('\nSaved. Total:', len(cmds))
