from pathlib import Path
import geopandas
import pandas
import fednames
from collections import defaultdict


CURRENT_DIR = Path(__file__).parent.resolve()
DATA_DIR = CURRENT_DIR.parent / "data"
CANDIDATES_PATH = DATA_DIR / "candidates" / "candidate_data_cleaned.csv"
FEDS_RAW_DIR = DATA_DIR / "feds" / "raw"
FEDS_PROCESSED_DIR = DATA_DIR / "feds" / "processed"
LOG_DIR = CURRENT_DIR / "logs"
FEDS_FINAL_DIR = DATA_DIR / "feds" / "final"
FEDS_GEOJSON_DIR = FEDS_FINAL_DIR / "geojson_4326"
FEDS_TOPOJSON_DIR = FEDS_FINAL_DIR / "topojson_4326_simplify_coverage"


def main():
    # candidates_df = pandas.read_csv(CANDIDATES_PATH)
    # Convert edate to Pandas datetime64 format
    # candidates_df['edate'] = pandas.to_datetime(candidates_df['edate'], format='%d/%m/%Y')
    # updated_candidates_df = fednames.process_feds(candidates=candidates_df, feds_raw_dir=FEDS_RAW_DIR, log_dir=LOG_DIR)
    # updated_candidates_df.to_csv(DATA_DIR / "candidates" / "candidates_final.csv")
    fednames.convert_to_geojson(FEDS_RAW_DIR, FEDS_GEOJSON_DIR)


if __name__ == "__main__":
    main()