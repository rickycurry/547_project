import json
from pathlib import Path

CURRENT_DIR = Path(__file__).parent.resolve()
DATA_DIR = CURRENT_DIR.parent / "data"
BASE_JSON = DATA_DIR / "feds_hierarchy_base.json"
OUT_FILE = DATA_DIR / "fed_hierarchy_complete.json"
LAST_RO_GEOJSON = DATA_DIR / "feds" / "mapshaper_simplified_rewound_4326" / "ro_2013.geojson"
PROVINCE_LOOKUP = {
    "10": "Newfoundland and Labrador",
    "11": "Prince Edward Island",
    "12": "Nova Scotia",
    "13": "New Brunswick",
    "24": "Quebec",
    "35": "Ontario",
    "46": "Manitoba",
    "47": "Saskatchewan",
    "48": "Alberta",
    "59": "British Columbia"
}

last_ro_json = json.load(LAST_RO_GEOJSON.open())
# print(last_ro_json)
base_json = json.load(BASE_JSON.open())
# print(base_json)

# We have two jobs to do here.
# 1. Fill in names for FEDs that are indicated in each sub-region
# 2. Add in the rest of the FEDs under their appropriate provinces

all_feds_dict = {}
for fed in last_ro_json['features']:
    all_feds_dict[fed['properties']['id']] = fed['properties']['fedname'].title()
# print(all_feds_dict)

remaining_fed_ids = set(all_feds_dict.keys())

# 1. Fill in names.
for province in base_json['provinces']:
    if not 'regions' in province:
        continue
    for region in province['regions']:
        for fed in region['regions']:
            fed['name'] = all_feds_dict[fed['id']]
            remaining_fed_ids.remove(fed['id'])
# print(base_json)

# 2. Add the rest of the FEDs to the appropriate provinces
# print(remaining_fed_ids)
for remaining_id in remaining_fed_ids:
    province_key = remaining_id[:2]
    if not province_key in PROVINCE_LOOKUP:
        continue
    province_name = PROVINCE_LOOKUP[province_key]
    for province in base_json['provinces']:
        if province['name'] == province_name:
            province['regions'].append(
                {'name': all_feds_dict[remaining_id],
                 'id': remaining_id})
            break

json.dump(base_json, OUT_FILE.open('w'), ensure_ascii=False, indent=2)
# print(base_json)