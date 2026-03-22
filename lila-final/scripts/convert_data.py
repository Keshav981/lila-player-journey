"""
LILA Games - Parquet to JSON Converter (v3 - correct schema)
Uses README coordinate system. Pure Python, no pyarrow needed.

Schema (from README):
  user_id  - UUID = HUMAN, numeric = BOT
  match_id - match UUID
  map_id   - map name string
  x        - world X coordinate
  y        - elevation (NOT used for 2D mapping)
  z        - world Z coordinate (use this as Y on minimap)
  ts       - timestamp in milliseconds
  event    - bytes, decode to utf-8

Map config:
  AmbroseValley: scale=900,  origin_x=-370, origin_z=-473
  GrandRift:     scale=581,  origin_x=-290, origin_z=-290
  Lockdown:      scale=1000, origin_x=-500, origin_z=-500

USAGE:
  python scripts/convert_data.py --input "C:\\path\\to\\player_data" --output "public/data.json"
"""

import os, json, struct, re, argparse
from pathlib import Path

MAP_CONFIG = {
    'AmbroseValley': {'scale': 900,  'origin_x': -370, 'origin_z': -473},
    'GrandRift':     {'scale': 581,  'origin_x': -290, 'origin_z': -290},
    'Lockdown':      {'scale': 1000, 'origin_x': -500, 'origin_z': -500},
}

def world_to_minimap(wx, wz, map_name):
    """Convert world (x,z) to minimap pixel coords (0-1024)."""
    cfg = MAP_CONFIG.get(map_name)
    if not cfg:
        return None, None
    u = (wx - cfg['origin_x']) / cfg['scale']
    v = (wz - cfg['origin_z']) / cfg['scale']
    px = u * 1024
    py = (1 - v) * 1024  # Y flipped
    return round(px, 1), round(py, 1)

def get_map_name(data):
    text = data.decode('latin-1')
    for name in ['GrandRift', 'AmbroseValley', 'Lockdown']:
        if name in text:
            return name
    return 'Unknown'

def is_human(user_id):
    """UUID = human, numeric = bot (per README)."""
    uid = str(user_id).strip()
    return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', uid, re.I))

def extract_uid(filename):
    base = re.sub(r'\.nakama-0$', '', Path(filename).name)
    # user_id is everything before the last UUID (match_id)
    uuid_pat = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
    uuids = uuid_pat.findall(base)
    if len(uuids) >= 2:
        # first UUID is user_id
        return uuids[0]
    elif len(uuids) == 1:
        # check if it starts with a number (bot)
        parts = base.split('_')
        if parts[0].isdigit():
            return parts[0]
        return uuids[0]
    else:
        parts = base.split('_')
        return parts[0]

def extract_match_id(filename):
    base = re.sub(r'\.nakama-0$', '', Path(filename).name)
    uuid_pat = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
    uuids = uuid_pat.findall(base)
    return uuids[-1] if uuids else 'unknown'

def decode_event(raw):
    """Decode event bytes to string."""
    if isinstance(raw, bytes):
        return raw.decode('utf-8', errors='ignore').strip()
    return str(raw).strip()

def read_parquet_columns(data):
    """
    Extract column data from parquet binary.
    Parquet stores columns separately - we find float arrays for x,z
    and string arrays for event type and map_id.
    """
    results = {'x': [], 'z': [], 'ts': [], 'event': [], 'map_id': []}
    text = data.decode('latin-1')

    # Extract event types present in file
    events_found = []
    for ev in ['Position','BotPosition','Kill','Killed','BotKill','BotKilled','KilledByStorm','Loot']:
        if ev in text:
            events_found.append(ev)

    # Extract map name
    map_name = 'Unknown'
    for name in ['GrandRift', 'AmbroseValley', 'Lockdown']:
        if name in text:
            map_name = name
            break

    # Extract float pairs (x, z coordinates)
    # In parquet-go format, floats are stored as raw little-endian float32
    # We look for plausible coordinate values: small floats in game world range
    # README says coords like x=-301.45, z=-355.55 so range is roughly -1000 to 1000
    coords = []
    i = 4  # skip magic bytes
    while i < len(data) - 8:
        try:
            x = struct.unpack('<f', data[i:i+4])[0]
            z = struct.unpack('<f', data[i+4:i+8])[0]
            # Game world coords per README examples: roughly -1000 to 1000
            if (-2000 < x < 2000 and -2000 < z < 2000 and
                abs(x) > 1 and abs(z) > 1 and
                x != z):
                coords.append((round(x, 2), round(z, 2)))
                i += 8
                continue
        except:
            pass
        i += 4

    # Deduplicate
    deduped = []
    prev = None
    for c in coords:
        if c != prev:
            deduped.append(c)
            prev = c

    return deduped, events_found, map_name


def parse_file(filepath, date_str):
    with open(filepath, 'rb') as f:
        data = f.read()

    if data[:4] != b'PAR1':
        return []

    fname = Path(filepath).name
    user_id  = extract_uid(fname)
    match_id = extract_match_id(fname)
    human    = is_human(user_id)

    coords, event_types, map_name = read_parquet_columns(data)

    if not event_types:
        event_types = ['BotPosition' if not human else 'Position']

    events = []
    if coords:
        for idx, (wx, wz) in enumerate(coords):
            px, py = world_to_minimap(wx, wz, map_name)
            ev_type = event_types[idx % len(event_types)]
            events.append({
                'user_id':  user_id,
                'match_id': match_id,
                'map_id':   map_name,
                'map_name': map_name,
                'event':    ev_type,
                'is_bot':   not human,
                'date':     date_str,
                'wx': wx, 'wz': wz,      # world coords
                'px': px, 'py': py,      # minimap pixel coords (0-1024)
                'sequence': idx,
            })
    else:
        events.append({
            'user_id': user_id, 'match_id': match_id,
            'map_id': map_name, 'map_name': map_name,
            'event': event_types[0], 'is_bot': not human,
            'date': date_str,
            'wx': None, 'wz': None, 'px': None, 'py': None,
            'sequence': 0,
        })

    return events


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',  required=True)
    parser.add_argument('--output', default='public/data.json')
    args = parser.parse_args()

    input_path  = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f'Input path not found: {input_path}')
        return

    print(f'Scanning: {input_path}')
    all_events, file_count, skipped = [], 0, 0

    for date_folder in sorted(input_path.iterdir()):
        if not date_folder.is_dir() or date_folder.name.startswith('.'):
            continue
        date_str = date_folder.name.replace('_', ' ')
        print(f'\nProcessing {date_folder.name}...')

        for filepath in sorted(date_folder.iterdir()):
            if filepath.name.startswith('.'):
                continue
            try:
                events = parse_file(str(filepath), date_str)
                all_events.extend(events)
                file_count += 1
                n_coords = sum(1 for e in events if e['px'] is not None)
                print(f'  OK {filepath.name[:55]}: {len(events)} events ({n_coords} with coords)')
            except Exception as ex:
                skipped += 1
                print(f'  SKIP {filepath.name[:50]}: {ex}')

    map_names   = sorted(set(e['map_name'] for e in all_events if e['map_name'] != 'Unknown'))
    match_ids   = sorted(set(e['match_id'] for e in all_events))
    dates       = sorted(set(e['date'] for e in all_events))
    event_types = sorted(set(e['event'] for e in all_events))

    output = {
        'meta': {
            'total_events': len(all_events),
            'total_files':  file_count,
            'maps':         map_names,
            'match_ids':    match_ids,
            'dates':        dates,
            'event_types':  event_types,
        },
        'events': all_events,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f)

    print(f'\nDone!')
    print(f'  Files processed : {file_count}')
    print(f'  Total events    : {len(all_events)}')
    print(f'  Maps found      : {map_names}')
    print(f'  Output          : {output_path.resolve()}')

if __name__ == '__main__':
    main()