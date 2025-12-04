import json
from pathlib import Path
import geopandas

CURRENT_DIR = Path(__file__).parent.resolve()
FEDS_DIR = CURRENT_DIR.parent / "data" / "feds"
OUT_FILE = FEDS_DIR / "historic_overlaps.json"
ROS_DIR = FEDS_DIR / "mapshaper_simplified_rewound_4326"
LAST_RO_GEOJSON = ROS_DIR / "ro_2013.geojson"

# final structure should be something like:
# {
#   ro_1: 
#     {
#       fed_a:
#         [
#           overlapping_fed_i,
#           overlapping_fed_ii,
#           etc.
#         ]
#     }
# }

# load up the last one to use as our base
last_geodf = geopandas.read_file(LAST_RO_GEOJSON)
# print(last_geodf.crs)
overlaps = {}
for file in ROS_DIR.iterdir():
    if file == LAST_RO_GEOJSON:
        continue
    current_geodf = geopandas.read_file(file)
    name = file.name[3:7]
    # print(name)
    other_ro_dict = {}
    overlaps[name] = other_ro_dict
    # other_ro_dict['a'] = 'b'
    for row in last_geodf.iterrows():
    # for geo in last_geodf.geometry:
        overlapping_ids = []
        other_ro_dict[row[1]['id']] = overlapping_ids
        geo_buffered = row[1]['geometry'].buffer(-0.001, )
        if geo_buffered.area <= 0:
            # I am dubious
            print(f"warning: geo {row[1]['fedname']} is buffered to 0 size.")
        overlaps_this_fed = geo_buffered.overlaps(current_geodf.geometry)
        for i, val in enumerate(overlaps_this_fed):
            if val:
                overlapping_ids.append(str(current_geodf.iloc[i]['id']))
    # print(overlaps)
                
json.dump(overlaps, OUT_FILE.open('w'))