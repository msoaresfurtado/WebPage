#!/usr/bin/env python3
"""
SALT Data Import Tool (Dropbox Version)
Parses SALT data downloads and builds catalog with Dropbox-relative paths.

Usage:
    # Import a single night
    python salt_import.py 231205
    
    # Import all nights
    python salt_import.py --all
    
    # Preview without making changes
    python salt_import.py 231205 --dry-run
"""

import os
import re
import json
import argparse
from pathlib import Path
from datetime import datetime


def parse_observation_sequence(html_path):
    """
    Parse the ObservationSequence HTML to extract file-to-target mappings.
    """
    with open(html_path, 'r', encoding='latin-1') as f:
        content = f.read()
    
    pre_match = re.search(r'<pre[^>]*>(.*?)</pre>', content, re.DOTALL)
    if not pre_match:
        print("  Warning: Could not find observation table in HTML")
        return {}
    
    table_text = pre_match.group(1)
    observations = {}
    
    for line in table_text.split('\n'):
        if not line.strip() or line.strip().startswith('-') or line.strip().startswith('File'):
            continue
        
        if not re.match(r'^\s*[HRSP]\d{12}', line):
            continue
        
        upper_line = line.upper()
        if any(cal in upper_line for cal in ['BIAS', 'ARC ', 'FLAT']):
            continue
        
        parts = line.split()
        file_id = parts[0]
        if not file_id.startswith(('H', 'R')):
            continue
        
        if 'Gaia DR3' not in line:
            continue
        
        # Find coordinates
        ra_str = None
        dec_str = None
        for i, p in enumerate(parts):
            if re.match(r'\d{2}:\d{2}:\d{2}\.\d', p):
                ra_str = p
                if i + 1 < len(parts) and re.match(r'[+-]?\d{2}:\d{2}:\d{2}', parts[i+1]):
                    dec_str = parts[i+1]
                break
        
        if not ra_str or not dec_str:
            continue
        
        # Find exposure time
        exp_time = None
        for p in parts:
            try:
                val = float(p)
                if 1 < val < 10000 and '.' in p:
                    exp_time = val
            except ValueError:
                continue
        
        # Find proposal
        proposal = None
        pi = None
        for i, p in enumerate(parts):
            if re.match(r'\d{4}-\d-[A-Z]+-\d+', p):
                proposal = p
                if i + 1 < len(parts):
                    pi = parts[i + 1]
                break
        
        # Extract partial Gaia ID
        gaia_partial = None
        for i, p in enumerate(parts):
            if p == 'Gaia' and i + 2 < len(parts) and parts[i+1] == 'DR3':
                gaia_partial = parts[i + 2]
                break
        
        ra_deg = sexagesimal_to_degrees(ra_str, is_ra=True)
        dec_deg = sexagesimal_to_degrees(dec_str, is_ra=False)
        
        observations[file_id] = {
            'gaia_partial': gaia_partial,
            'ra_deg': ra_deg,
            'dec_deg': dec_deg,
            'exposure': exp_time,
            'proposal': proposal,
            'pi': pi,
            'instrument': 'HRS'
        }
    
    return observations


def sexagesimal_to_degrees(coord_str, is_ra=True):
    """Convert sexagesimal coordinates to decimal degrees."""
    try:
        parts = coord_str.replace('+', '').split(':')
        if len(parts) != 3:
            return None
        
        d = float(parts[0])
        m = float(parts[1])
        s = float(parts[2])
        
        sign = -1 if coord_str.startswith('-') else 1
        degrees = sign * (abs(d) + m/60 + s/3600)
        
        if is_ra:
            degrees *= 15
        
        return round(degrees, 6)
    except (ValueError, IndexError):
        return None


def parse_astronomer_log(log_path):
    """
    Parse the astronomer's log to extract Gaia IDs and observing conditions.
    """
    with open(log_path, 'r') as f:
        content = f.read()
    
    targets = {}
    blocks = content.split('======')
    
    for block in blocks:
        lines = block.strip().split('\n')
        
        gaia_id = None
        block_id = None
        conditions = []
        mode = None
        exposure = None
        guider = None
        aborted = False
        
        for line in lines:
            line = line.strip()
            
            if 'Block ID:' in line:
                match = re.search(r'Block ID:\s*(\d+)', line)
                if match:
                    block_id = match.group(1)
            
            if 'Gaia DR3' in line:
                match = re.search(r'Gaia DR3\s+(\d+)', line)
                if match:
                    gaia_id = match.group(1)
            
            if 'cloud' in line.lower():
                conditions.append(line.strip('* '))
            
            if 'Guider:' in line:
                match = re.search(r'Guider:\s*~?([\d.]+)"?', line)
                if match:
                    guider = match.group(1)
            
            if re.search(r'H/R\d+:', line):
                match = re.search(r'H/R\d+:\s*(\d+)\s*(MR|LR|HR)?', line)
                if match:
                    exposure = int(match.group(1))
                    mode = match.group(2) if match.group(2) else 'MR'
            
            if 'Aborting' in line or 'abort' in line.lower():
                aborted = True
        
        if gaia_id and not aborted:
            targets[gaia_id] = {
                'block_id': block_id,
                'conditions': '; '.join(conditions) if conditions else None,
                'mode': mode,
                'exposure': exposure,
                'seeing': guider
            }
    
    return targets


def find_product_files(product_dir, file_number):
    """Find all reduced FITS files for a given observation file number."""
    product_path = Path(product_dir)
    if not product_path.exists():
        return []
    
    pattern = f"*{file_number}*.fits"
    files = list(product_path.glob(pattern))
    
    return sorted([f.name for f in files])


def extract_date_from_dirname(dir_name):
    """Extract observation date from directory name like '231205' -> '2023-12-05'"""
    if re.match(r'^\d{6}$', dir_name):
        year_prefix = '20' if int(dir_name[:2]) < 50 else '19'
        year = int(year_prefix + dir_name[:2])
        month = int(dir_name[2:4])
        day = int(dir_name[4:6])
        return f"{year}-{month:02d}-{day:02d}"
    return None


def resolve_gaia_id(obs_data, log_targets):
    """Match partial Gaia ID from observation sequence to full ID from log."""
    partial_id = obs_data.get('gaia_partial', '')
    
    for gaia_id in log_targets.keys():
        if gaia_id.startswith(partial_id):
            return gaia_id
    
    # Fallback: match by exposure time
    obs_exp = obs_data.get('exposure')
    for gaia_id, log_data in log_targets.items():
        log_exp = log_data.get('exposure')
        if obs_exp and log_exp and abs(obs_exp - log_exp) < 5:
            return gaia_id
    
    return None


def load_catalog(catalog_path):
    """Load the observation catalog."""
    if not os.path.exists(catalog_path):
        return {
            "catalog_info": {
                "name": "Soares-Furtado Group SALT Observations",
                "description": "Spectroscopic observations from SALT HRS",
                "last_updated": datetime.now().strftime('%Y-%m-%d'),
                "contact": "soares-furtado@wisc.edu",
                "dropbox_folder": "2023-2-SCI-018"
            },
            "targets": []
        }
    
    with open(catalog_path, 'r') as f:
        return json.load(f)


def save_catalog(catalog, catalog_path):
    """Save the observation catalog."""
    catalog['catalog_info']['last_updated'] = datetime.now().strftime('%Y-%m-%d')
    with open(catalog_path, 'w') as f:
        json.dump(catalog, f, indent=2)


def import_night(night_dir, catalog, dry_run=False):
    """Import a single observation night."""
    night_path = Path(night_dir)
    night_name = night_path.name
    
    doc_dir = night_path / 'doc'
    product_dir = night_path / 'product'
    
    if not doc_dir.exists():
        print(f"  Skipping {night_name}: no 'doc' directory")
        return 0
    
    # Parse observation sequence
    obs_seq_files = list(doc_dir.glob('ObservationSequence*.html'))
    if not obs_seq_files:
        print(f"  Skipping {night_name}: no ObservationSequence HTML")
        return 0
    
    observations = parse_observation_sequence(obs_seq_files[0])
    
    # Parse astronomer's log
    log_files = list(doc_dir.glob('AstronomersLogExtract*.txt'))
    log_targets = {}
    if log_files:
        log_targets = parse_astronomer_log(log_files[0])
    
    if not log_targets:
        print(f"  Skipping {night_name}: no Gaia targets in astronomer's log")
        return 0
    
    obs_date = extract_date_from_dirname(night_name)
    
    # Build index of existing targets
    existing_targets = {t['gaia_dr3_id']: t for t in catalog['targets']}
    
    added_count = 0
    processed_gaia_ids = set()
    
    for file_id, obs_data in observations.items():
        if not file_id.startswith('H'):  # Only process H (blue) files
            continue
        
        gaia_id = resolve_gaia_id(obs_data, log_targets)
        if not gaia_id or gaia_id in processed_gaia_ids:
            continue
        
        processed_gaia_ids.add(gaia_id)
        log_info = log_targets.get(gaia_id, {})
        
        # Find product files
        product_files = find_product_files(product_dir, file_id)
        r_file_id = 'R' + file_id[1:]
        product_files.extend(find_product_files(product_dir, r_file_id))
        product_files = sorted(list(set(product_files)))
        
        if not product_files:
            print(f"    {gaia_id}: no product files found")
            continue
        
        # Find main file (prefer merged)
        main_file = None
        for suffix in ['_uwm.fits', '_1wm.fits', '.fits']:
            for pf in product_files:
                if pf.endswith(suffix) and 'H20' in pf:
                    main_file = pf
                    break
            if main_file:
                break
        if not main_file:
            main_file = product_files[0]
        
        print(f"    Gaia DR3 {gaia_id}: {len(product_files)} files, {obs_data['exposure']}s")
        
        if dry_run:
            continue
        
        # Get or create target entry
        if gaia_id in existing_targets:
            target_entry = existing_targets[gaia_id]
        else:
            target_entry = {
                'gaia_dr3_id': gaia_id,
                'common_name': None,
                'ra_deg': obs_data['ra_deg'],
                'dec_deg': obs_data['dec_deg'],
                'g_mag': None,
                'program': 'Sheffler UMa Survey',
                'notes': None,
                'observations': []
            }
            catalog['targets'].append(target_entry)
            existing_targets[gaia_id] = target_entry
        
        # Check if this observation date already exists
        existing_dates = [o['date'] for o in target_entry['observations']]
        if obs_date in existing_dates:
            continue
        
        # Mode mapping
        mode_map = {'MR': 'Medium Resolution', 'LR': 'Low Resolution', 'HR': 'High Resolution'}
        
        # Create observation entry with Dropbox-relative path
        new_obs = {
            'date': obs_date,
            'instrument': 'HRS',
            'mode': mode_map.get(log_info.get('mode'), log_info.get('mode')),
            'exposure_time': int(obs_data['exposure']) if obs_data['exposure'] else None,
            'filename': main_file,
            'all_files': product_files,
            'dropbox_path': f"{night_name}/product",
            'snr': None,
            'seeing': log_info.get('seeing'),
            'conditions': log_info.get('conditions'),
            'block_id': log_info.get('block_id')
        }
        
        target_entry['observations'].append(new_obs)
        added_count += 1
    
    return added_count


def main():
    parser = argparse.ArgumentParser(
        description='Import SALT data into the query tool catalog',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python salt_import.py 231205              # Import single night
    python salt_import.py --all               # Import all nights
    python salt_import.py 231205 --dry-run    # Preview without changes
        """
    )
    
    parser.add_argument('night', nargs='?', help='Night directory name (e.g., 231205)')
    parser.add_argument('--all', action='store_true', help='Import all observation nights')
    parser.add_argument('--dry-run', '-n', action='store_true', help='Preview without making changes')
    parser.add_argument('--data-dir', default='.', help='Base directory containing night folders')
    parser.add_argument('--catalog', default='salt-query-tool/index.json', help='Path to catalog JSON')
    
    args = parser.parse_args()
    
    if not args.night and not args.all:
        parser.print_help()
        return
    
    data_path = Path(args.data_dir)
    catalog = load_catalog(args.catalog)
    
    if args.all:
        # Find all night directories
        nights = sorted([d for d in data_path.iterdir() 
                        if d.is_dir() and re.match(r'^\d{6}$', d.name)])
        print(f"Found {len(nights)} observation nights\n")
    else:
        nights = [data_path / args.night]
    
    total_added = 0
    for night_dir in nights:
        if not night_dir.exists():
            print(f"Directory not found: {night_dir}")
            continue
        
        print(f"Processing {night_dir.name}...")
        added = import_night(night_dir, catalog, dry_run=args.dry_run)
        total_added += added
    
    if not args.dry_run:
        # Ensure catalog directory exists
        Path(args.catalog).parent.mkdir(parents=True, exist_ok=True)
        save_catalog(catalog, args.catalog)
        print(f"\nCatalog saved to {args.catalog}")
    
    print(f"\nTotal: {total_added} observations from {len(catalog['targets'])} unique targets")


if __name__ == '__main__':
    main()
