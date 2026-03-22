"""
LILA Games - Parquet to JSON Converter (v2)
No pandas/pyarrow needed - pure Python binary parsing.

USAGE:
  python scripts/convert_data.py --input "C:\path\to\player_data" --output "public/data.json"
"""

import os, json, struct, re, argparse
from pathlib import Path


def get_map_name(data):
    text = data.decode('latin-1')
    for name in ['GrandRift', 'AmbroseValley', 'Lockdown']:
        if name in text:
            return name
    return 'Unknown'


def is_bot(user_id):
    uid = str(user_id).strip()
    return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', uid, re.I))


def extract_uid(filename):
    base = Path(filename).name
    # Remove extension
    base = re.sub(r'\.nakama-0$', '', base)
    parts = base.split('_')
    return parts[0] if parts else 'unknown'


def extract_match_id(filename):
    base = re.sub(r'\.nakama-0$', '', Path(filename).name)
    uuids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', base, re.I)
    return uuids[-1] if uuids else 'unknown'


def extract_map_id(filename):
    base = re.sub(r'\.nakama-0$', '', Path(filename).name)
    uuids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', base, re.I)
    return uuids[-1] if uuids else 'unknown'


def get_event_types(data):
    text = data.decode('latin-1')
    found = []
    for ev in ['Position','BotPosition','Kill','KHKill','xHKill','BotKill','KilledByStorm','BotKilled','Loot','LootN']:
        if ev in text:
            found.append(ev)
    return found or ['Position']


def extract_coords(data):
    """Extract x,y coordinate pairs from parquet binary data."""
    coords = []
    length = len(data)
    i = 0
    while i < length - 8:
        try:
            x = struct.unpack('<f', data[i:i+4])[0]
            y = struct.unpack('<f', data[i+4:i+8])[0]
            # Valid game world coordinates
            if (-200000 < x < 200000 and -200000 < y < 200000 and
                abs(x) > 500 and abs(y) > 500 and
                not (x == y)):
                coords.append((round(x, 1), round(y, 1)))
                i += 8
                continue
        except:
            pass
        i += 4

    # Deduplicate consecutive identical coords
    deduped = []
    prev = None
    for c in coords:
        if c != prev:
            deduped.append(c)
            prev = c
    return deduped


def parse_file(filepath, date_str):
    with open(filepath, 'rb') as f:
        data = f.read()

    if data[:4] != b'PAR1':
        return []

    fname = Path(filepath).name
    user_id  = extract_uid(fname)
    match_id = extract_match_id(fname)
    map_id   = extract_map_id(fname)
    map_name = get_map_name(data)
    ev_types = get_event_types(data)
    bot      = is_bot(user_id)
    coords   = extract_coords(data)

    events = []
    if coords:
        for idx, (x, y) in enumerate(coords):
            events.append({
                'user_id': user_id, 'match_id': match_id,
                'map_id': map_id, 'map_name': map_name,
                'event': ev_types[idx % len(ev_types)],
                'is_bot': bot, 'date': date_str,
                'x': x, 'y': y, 'z': 0.0,
                'timestamp': None, 'sequence': idx,
            })
    else:
        # Still record file so match appears in filter
        events.append({
            'user_id': user_id, 'match_id': match_id,
            'map_id': map_id, 'map_name': map_name,
            'event': ev_types[0], 'is_bot': bot, 'date': date_str,
            'x': None, 'y': None, 'z': None,
            'timestamp': None, 'sequence': 0,
        })
    return events


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
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
                n_coords = sum(1 for e in events if e['x'] is not None)
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
            'total_files': file_count,
            'maps': map_names,
            'match_ids': match_ids,
            'dates': dates,
            'event_types': event_types,
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