"""
LILA Games - Parquet → JSON Converter
======================================
Run this script on YOUR laptop to convert the player data.

SETUP (run once):
  pip install pandas pyarrow

USAGE:
  python convert_data.py --input /path/to/player_data --output ../public/data.json

It will scan all subfolders (February_14, February_15, etc.) and merge everything.
"""

import os
import json
import argparse
import re
import pandas as pd
from pathlib import Path

# ─── Map name detection ───────────────────────────────────────────────────────
# We identify map names by reading the map_id field from the parquet files
# then cross-referencing with the string "GrandRift" / "AmbroseValley" / "Lockdown"
# that appears in the binary data.
MAP_NAME_CACHE = {}

def get_map_name_from_file(filepath: str) -> str:
    """Read the raw bytes to find the map name string embedded in the parquet file."""
    with open(filepath, 'rb') as f:
        raw = f.read()
    text = raw.decode('latin-1')
    for name in ['GrandRift', 'AmbroseValley', 'Lockdown']:
        if name in text:
            return name
    return 'Unknown'


def is_bot(user_id: str) -> bool:
    """
    Bots have UUID-style user IDs.
    Humans have short numeric IDs like '1379'.
    """
    uid = str(user_id).strip()
    # UUID pattern: 8-4-4-4-12 hex chars
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(uid))


def convert_parquet_file(filepath: str) -> list:
    """Convert a single .nakama-0 parquet file to a list of event dicts."""
    try:
        df = pd.read_parquet(filepath)
    except Exception as e:
        print(f"  ⚠️  Could not read {filepath}: {e}")
        return []

    if df.empty:
        return []

    # Get map name from binary content
    map_name = get_map_name_from_file(filepath)

    # Extract date from parent folder name
    parent = Path(filepath).parent.name  # e.g. "February_14"
    date_str = parent.replace('_', ' ')

    events = []
    for _, row in df.iterrows():
        try:
            uid = str(row.get('user_id', '')).strip()
            match_id = str(row.get('match_id', '')).strip()
            map_id = str(row.get('map_id', '')).strip()
            event_type = str(row.get('event', '')).strip()

            # Build event dict — coordinates may be nested or flat
            event = {
                'user_id': uid,
                'match_id': match_id,
                'map_id': map_id,
                'map_name': map_name,
                'event': event_type,
                'is_bot': is_bot(uid),
                'date': date_str,
            }

            # Extract coordinates — try common column name patterns
            for x_col in ['x', 'pos_x', 'position_x', 'X', 'PosX']:
                if x_col in row.index:
                    event['x'] = float(row[x_col])
                    break
            for y_col in ['y', 'pos_y', 'position_y', 'Y', 'PosY']:
                if y_col in row.index:
                    event['y'] = float(row[y_col])
                    break
            for z_col in ['z', 'pos_z', 'position_z', 'Z', 'PosZ']:
                if z_col in row.index:
                    event['z'] = float(row[z_col])
                    break

            # Timestamp
            for t_col in ['timestamp', 'time', 'ts', 'created_at']:
                if t_col in row.index:
                    event['timestamp'] = str(row[t_col])
                    break

            # Include ALL remaining columns as extras (for unknown schema fields)
            known = {'user_id','match_id','map_id','event','x','y','z','timestamp',
                     'pos_x','pos_y','pos_z','position_x','position_y','position_z',
                     'X','Y','Z','PosX','PosY','PosZ','time','ts','created_at'}
            for col in row.index:
                if col not in known:
                    val = row[col]
                    try:
                        # Make JSON serializable
                        if hasattr(val, 'item'):
                            val = val.item()
                        event[col] = val
                    except:
                        event[col] = str(val)

            events.append(event)
        except Exception as e:
            print(f"  ⚠️  Row error: {e}")
            continue

    return events


def main():
    parser = argparse.ArgumentParser(description='Convert LILA parquet data to JSON')
    parser.add_argument('--input', required=True, help='Path to player_data folder')
    parser.add_argument('--output', default='../public/data.json', help='Output JSON path')
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"❌ Input path not found: {input_path}")
        return

    print(f"🔍 Scanning: {input_path}")
    all_events = []
    file_count = 0

    # Walk all date subfolders
    for date_folder in sorted(input_path.iterdir()):
        if not date_folder.is_dir() or date_folder.name.startswith('.'):
            continue
        print(f"\n📅 Processing {date_folder.name}...")
        files = [f for f in date_folder.iterdir() if f.suffix == '' or f.name.endswith('.nakama-0')]
        for filepath in sorted(files):
            events = convert_parquet_file(str(filepath))
            all_events.extend(events)
            file_count += 1
            if events:
                print(f"  ✅ {filepath.name}: {len(events)} events")
            else:
                print(f"  ⬛ {filepath.name}: 0 events (empty or error)")

    # Build summary metadata
    map_names = list(set(e['map_name'] for e in all_events))
    match_ids = list(set(e['match_id'] for e in all_events))
    dates = list(set(e['date'] for e in all_events))
    event_types = list(set(e['event'] for e in all_events))

    output = {
        'meta': {
            'total_events': len(all_events),
            'total_files': file_count,
            'maps': sorted(map_names),
            'match_ids': sorted(match_ids),
            'dates': sorted(dates),
            'event_types': sorted(event_types),
        },
        'events': all_events,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f)

    print(f"\n✅ Done!")
    print(f"   Files processed : {file_count}")
    print(f"   Total events    : {len(all_events)}")
    print(f"   Maps found      : {map_names}")
    print(f"   Output          : {output_path.resolve()}")

if __name__ == '__main__':
    main()
