from pathlib import Path
import pandas as pd
import geopandas
import typing
import difflib
import main
import topojson
import json


RO_DATE_RANGES = {
    1867: [pd.to_datetime("1867-01-01"), pd.to_datetime("1872-07-19")],
    1872: [pd.to_datetime("1872-07-20"), pd.to_datetime("1882-06-19")],
    1882: [pd.to_datetime("1882-06-20"), pd.to_datetime("1896-06-22")],
    1892: [pd.to_datetime("1896-06-23"), pd.to_datetime("1904-11-02")],
    1903: [pd.to_datetime("1904-11-03"), pd.to_datetime("1908-10-25")],
    1905: [pd.to_datetime("1908-10-26"), pd.to_datetime("1917-12-16")],
    1914: [pd.to_datetime("1917-12-17"), pd.to_datetime("1925-10-28")],
    1924: [pd.to_datetime("1925-10-29"), pd.to_datetime("1935-10-13")],
    1933: [pd.to_datetime("1935-10-14"), pd.to_datetime("1949-06-26")],
    1947: [pd.to_datetime("1949-06-27"), pd.to_datetime("1953-08-09")],
    1952: [pd.to_datetime("1953-08-10"), pd.to_datetime("1968-06-24")],
    1966: [pd.to_datetime("1968-06-25"), pd.to_datetime("1979-05-21")],
    1976: [pd.to_datetime("1979-05-22"), pd.to_datetime("1988-11-20")],
    1987: [pd.to_datetime("1988-11-21"), pd.to_datetime("1997-06-01")],
    1996: [pd.to_datetime("1997-06-02"), pd.to_datetime("2000-11-26")],
    1999: [pd.to_datetime("2000-11-27"), pd.to_datetime("2004-06-27")],
    2003: [pd.to_datetime("2004-06-28"), pd.to_datetime("2015-10-18")],
    2013: [pd.to_datetime("2015-10-19"), pd.to_datetime("2024-12-31")],
}


PROVINCE_CODE_TO_FED_ID_PREFIX = {
    0: "48",
    1: "59",
    2: "46",
    3: "13",
    4: "10",
    5: "61",
    6: "12",
    7: "62",
    8: "35",
    9: "11",
    10: "24",
    11: "47",
    12: "60"
}


def get_ro(edate: pd.Timestamp):
    for k, v in RO_DATE_RANGES.items():
        if edate >= v[0] and edate <= v[1]:
            return k
    assert(f"Candidate found with edate {edate}")
    return 0


def log(string: str, logfile: typing.TextIO, verbose: bool = False):
    logfile.write(string + '\n')
    if verbose:
        print(string)


def get_ro_year(filepath: Path):
    return int(filepath.name[6:10])


def process_choices(choices: list[str]):
    for i, choice in enumerate(choices):
        print(f" {i}: {choice}")
    raw_in = input('select a replacement option: ')
    if not raw_in:
        return None, None
    raw_split = raw_in.split('_')
    if len(raw_split) >= 1:
        try:
            selection = int(raw_split[0])
            ret_choice = choices[selection]
        except:
            ret_choice = raw_split[0]
    apply_recurring = True
    if len(raw_split) > 1:
        apply_recurring = False
    return ret_choice, apply_recurring


def identify_orphaned_feds(candidates: pd.DataFrame, shp_files: list[Path], logfile: typing.TextIO):
    unmatched_candidate_feds_to_map_log = main.LOG_DIR / "mismatched_feds_name_map.txt"
    with open(unmatched_candidate_feds_to_map_log, 'w') as map_log:
        for ro_path in shp_files:
            start_year = get_ro_year(ro_path)
            edate_range = RO_DATE_RANGES[start_year]

            filtered_candidates = candidates[candidates['ro'] == start_year]
            unique_candidate_feds = set(filtered_candidates['riding'].unique())

            ro_df = geopandas.read_file(ro_path, encoding='utf-8')
            ro_df['fedname'] = ro_df['fedname'].str.upper()
            ro_feds = set(ro_df['fedname'].unique())

            log(str(start_year), logfile)
            log(f"{edate_range[0]}-{edate_range[1]}: {len(unique_candidate_feds)} candidate FEDs, {len(ro_feds)} RO FEDs", logfile, True)

            fed_overlap = ro_feds.intersection(unique_candidate_feds)
            log(f"  Overlap: {len(fed_overlap)} FEDs", logfile, True)

            orphaned_candidate_feds = unique_candidate_feds.difference(ro_feds)
            log(f"  Candidates with no matching FED: {len(orphaned_candidate_feds)}", logfile, True)
            log(repr(orphaned_candidate_feds), logfile)
            for i in orphaned_candidate_feds:
                map_log.write(f"{i},\n")
            orphaned_ro_feds = ro_feds.difference(unique_candidate_feds)
            log(f"  RO FEDs with no matching candidates: {len(orphaned_ro_feds)}", logfile, True)
            log(repr(orphaned_ro_feds), logfile)
            log("", logfile)


def identify_orphaned_feds_advanced(candidates: pd.DataFrame, shp_files: list[Path], logfile: typing.TextIO):
    for ro_path in shp_files:
        start_year = get_ro_year(ro_path)
        edate_range = RO_DATE_RANGES[start_year]

        filtered_candidates = candidates[candidates['ro'] == start_year]

        ro_df = geopandas.read_file(ro_path, encoding='utf-8')
        ro_df['fedname'] = ro_df['fedname'].str.upper()
        ro_df['id'] = ro_df['id'].astype(str)
        ro_df['fed_key'] = ro_df.apply(lambda row: row['fedname'] + row['id'][0:2], axis=1)

        unique_candidate_feds = set(filtered_candidates['fed_key'])
        ro_feds = set(ro_df['fed_key'])

        log(str(start_year), logfile)
        log(f"{edate_range[0]}-{edate_range[1]}: {len(unique_candidate_feds)} candidate FEDs, {len(ro_feds)} RO FEDs", logfile, True)

        fed_overlap = ro_feds.intersection(unique_candidate_feds)
        log(f"  Overlap: {len(fed_overlap)} FEDs", logfile, True)

        orphaned_candidate_feds = unique_candidate_feds.difference(ro_feds)
        log(f"  Candidates with no matching FED: {len(orphaned_candidate_feds)}", logfile, True)
        log(repr(orphaned_candidate_feds), logfile)
        orphaned_ro_feds = ro_feds.difference(unique_candidate_feds)
        log(f"  RO FEDs with no matching candidates: {len(orphaned_ro_feds)}", logfile, True)
        log(repr(orphaned_ro_feds), logfile)
        log("", logfile)


def get_fed_ids(candidates: pd.DataFrame, shp_files: list[Path]):
    rename_feds_path = main.LOG_DIR / "mismatched_feds_name_map.txt"
    with open(rename_feds_path, 'r') as rename_feds_file:
        lines = rename_feds_file.readlines()
    backup_keys: dict[str, list[str]] = {}
    for line in lines:
        spl = line.strip().split(',')
        key = spl.pop(0)
        if key in backup_keys:
            for name in spl:
                backup_keys[key].append(name)
        else:
            backup_keys[key] = spl

    def get_id(ro_df: pd.DataFrame, fed_key: str, fed_name: str):
        row: pd.DataFrame = ro_df[ro_df['fed_key'] == fed_key]
        if row.empty:
            log_str = fed_key
            try:
                names = backup_keys[fed_name]
                # use backup key
                for n in names:
                    n = n.upper()
                    log_str += f" --> {n}"
                    row = ro_df[ro_df['fedname'] == n]
                    if not row.empty:
                        break
            except KeyError:
                # fed_name isn't in substitutes
                pass
        
            if row.empty:
                log_str += f" --> {fed_name}"
                row = ro_df[ro_df['fedname'] == fed_name]
                if row.empty:
                    print(log_str)
                    return None
        row.reset_index(inplace=True, drop=True)
        return row.at[0, 'id']
    
    id_series: pd.Series = pd.Series([])

    for ro_path in shp_files:
        start_year = get_ro_year(ro_path)
        print(start_year)
        filtered_candidates = candidates[candidates['ro'] == start_year]

        ro_df = geopandas.read_file(ro_path, encoding='utf-8')
        ro_df['fedname'] = ro_df['fedname'].str.upper()
        ro_df['id'] = ro_df['id'].astype(str)
        ro_df['fed_key'] = ro_df.apply(lambda row: row['fedname'] + row['id'][0:2], axis=1)
        # with pd.option_context('display.max_rows', None):
            # print(ro_df)

        filtered_candidates['fed_id'] = filtered_candidates.apply(lambda row: get_id(ro_df, row['fed_key'], row['riding']), axis=1)
        print(filtered_candidates.shape[0] - filtered_candidates['fed_id'].count())
        id_series = pd.concat([id_series, filtered_candidates['fed_id']])

    return id_series


def replace_orphaned_names(candidates: pd.DataFrame, shp_files: list[Path]):
    recurring_replacement_dict = {}

    for ro_path in shp_files:
        start_year = get_ro_year(ro_path)

        filtered_candidates = candidates[candidates['ro'] == start_year]
        unique_candidate_feds = set(filtered_candidates['riding'].unique())

        ro_df = geopandas.read_file(ro_path, encoding='utf-8')
        ro_df['fedname'] = ro_df['fedname'].str.upper()
        ro_feds = set(ro_df['fedname'].unique())
        orphaned_candidate_feds = unique_candidate_feds.difference(ro_feds)
        orphaned_ro_feds = ro_feds.difference(unique_candidate_feds)

        for i, fed in ro_df.iterrows():
            fedname = fed['fedname']
            if fedname not in orphaned_ro_feds:
                continue
            fed_id = fed['id']
            fed_key = f"{fedname} ({str(fed_id)[0:2]})"
            if fed_key in recurring_replacement_dict:
                replacement = recurring_replacement_dict.get(fed_key)
                if replacement in unique_candidate_feds:
                    ro_df.at[i, 'fedname'] = replacement
                    print(f"auto-replaced {fed_key} with {replacement}")
                    continue
                else:
                    recurring_replacement_dict.pop(fed_key)
                    print(f"auto-REMOVED {fed_key} from cache")

            print(fed_key + " " + str(fed_id))
            closest_matches = difflib.get_close_matches(fedname, orphaned_candidate_feds, cutoff=0.2)
            choice, recurring = process_choices(choices=closest_matches)
            if choice is None:
                unmatched_feds_list = list(orphaned_candidate_feds)
                unmatched_feds_list.sort()
                choice, recurring = process_choices(choices=unmatched_feds_list)
                if choice is None:
                    continue

            try:
                orphaned_candidate_feds.remove(choice)
            except KeyError:
                pass
            ro_df.at[i, 'fedname'] = choice

            if recurring:
                recurring_replacement_dict[fed_key] = choice
                print(f"caching {fed_key} --> {choice} for future replacements")

        out_path = main.FEDS_PROCESSED_DIR / "second_pass" / ro_path.name
        ro_df.to_file(out_path)
        print(f"Saved GIS files: {out_path}")


def process_feds(candidates: pd.DataFrame, feds_raw_dir: Path, log_dir: Path):
    # Create a new attribute for candidates called "ro" to assign each candidate to the correct RO (year).
    candidates['ro'] = candidates['edate'].map(lambda edate: get_ro(edate)).astype(int)
    candidates['fed_key'] = candidates.apply(lambda row: row['riding'] + PROVINCE_CODE_TO_FED_ID_PREFIX[row['province']], axis=1)
    shp_files = [path for path in feds_raw_dir.iterdir() if (path.is_file() and path.suffix == ".shp")]
    shp_files.sort()

    # Identify orphaned feds
    # with open(log_dir / "orphaned_feds.txt", 'w') as logfile:
    #     identify_orphaned_feds(candidates=candidates, shp_files=shp_files, logfile=logfile)

    # Identify orphaned feds using more sophisticated matching
    # with open(log_dir / "orphaned_feds_advanced_match.txt", 'w') as logfile:
    #     identify_orphaned_feds_advanced(candidates=candidates, shp_files=shp_files, logfile=logfile)

    # Add a column to candidate data for the fed_id, which when combined with the ro should result in a mapping for each candidate
    candidates['fed_id'] = get_fed_ids(candidates, shp_files)
    candidates.drop('fed_key', axis=1, inplace=True)

    # candidates['riding'] = candidates['riding'].str.replace("’", "'")
    return candidates
    # replace_orphaned_names(candidates=candidates, shp_files=shp_files)


def convert_to_geojson(feds_raw_dir: Path, feds_geojson_dir: Path):
    shp_files = [path for path in feds_raw_dir.iterdir() if (path.is_file() and path.suffix == ".shp")]
    shp_files.sort()
    for ro_path in shp_files:
        start_year = get_ro_year(ro_path)
        ro_df = geopandas.read_file(ro_path, encoding='utf-8')
        print(ro_df.geometry.crs)
        ro_df.to_crs('EPSG:4326', inplace=True)
        print(ro_df)
        # ro_df['geometry'] = ro_df.simplify_coverage(tolerance=200)
        # topo = topojson.Topology(ro_df)
        # topo.to_json(fp=feds_geojson_dir / f"ro_{start_year}.json")

        # topo = topojson.Topology(ro_df, toposimplify=0.005, topology=False)
        # print(topo)
        ro_df.to_file(feds_geojson_dir / f"ro_{start_year}.geojson", driver='GeoJSON')
        # topo.to_json(fp=feds_geojson_dir / f"ro_{start_year}.json")
