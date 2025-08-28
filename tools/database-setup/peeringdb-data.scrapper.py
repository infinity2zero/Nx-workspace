import os
import json
import requests
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration ---
OUTPUT_DIR = "peeringdb_data_new"
API_BASE_URL = "https://www.peeringdb.com/api"

# UPDATED: Added 'ixlan' and 'netixlan' to get speed data.
ENDPOINTS_TO_FETCH = ["fac", "net", "ix", "org", "netfac", "ixfac", "ixlan", "netixlan"]

MAX_WORKERS = 5  # Number of parallel downloads

# --- Setup Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler("peeringdb_scraper_full.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def fetch_endpoint_data(endpoint: str) -> dict:
    """
    Fetches all data for a given PeeringDB API endpoint.
    Handles pagination by following the 'next' URL until all data is retrieved.
    """
    all_data = []
    url = f"{API_BASE_URL}/{endpoint}?depth=2" 
    
    logger.info(f"Starting download for endpoint: '{endpoint}' from {url}")
    
    try:
        while url:
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            
            data = response.json()
            
            if "data" in data and isinstance(data["data"], list):
                all_data.extend(data["data"])
                logger.info(f"  -> Fetched {len(data['data'])} records from {url} (Total: {len(all_data)})")
            else:
                logger.warning(f"  -> No 'data' list found in response from {url}")
                break

            if "meta" in data and "next" in data["meta"] and data["meta"]["next"]:
                url = data["meta"]["next"]
            else:
                url = None

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch data for endpoint '{endpoint}'. Error: {e}")
        return None
        
    logger.info(f"✅ Finished download for endpoint: '{endpoint}'. Total records: {len(all_data)}")
    return {"endpoint": endpoint, "data": all_data}

def main():
    """
    Main function to orchestrate the download and saving of PeeringDB data.
    """
    start_time = time.time()
    logger.info(f"🚀 Starting PeeringDB data scraper for endpoints: {ENDPOINTS_TO_FETCH}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    all_results = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_endpoint = {executor.submit(fetch_endpoint_data, ep): ep for ep in ENDPOINTS_TO_FETCH}
        
        for future in as_completed(future_to_endpoint):
            endpoint = future_to_endpoint[future]
            try:
                result = future.result()
                if result and result["data"]:
                    all_results[endpoint] = result["data"]
            except Exception as exc:
                logger.error(f"Endpoint '{endpoint}' generated an exception: {exc}")

    if not all_results:
        logger.error("❌ No data was successfully downloaded. Exiting.")
        return

    for endpoint, data in all_results.items():
        file_path = os.path.join(OUTPUT_DIR, f"{endpoint}.json")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"💾 Successfully saved {len(data)} records to {file_path}")
        except IOError as e:
            logger.error(f"Failed to write to file {file_path}. Error: {e}")

    duration = time.time() - start_time
    logger.info(f"🎉 All tasks completed in {duration:.2f} seconds.")

if __name__ == "__main__":
    main()



# ```
# source venv/bin/activate
### How to Use the Script

# 1.  **Prerequisites:** You need to have Python installed, along with the `requests` library. If you don't have it, install it with pip:
#     `pip install requests`

# 2.  **Save the Code:** Save the script above as a Python file (e.g., `peeringdb_scraper.py`).

# 3.  **Run from Terminal:** Open your terminal or command prompt, navigate to where you saved the file, and run it:
#     `python peeringdb_scraper.py`

# 4.  **Check the Output:** The script will create a new folder named `peeringdb_data` in the same directory. Inside, you will find the JSON files:
#     * `fac.json`: A list of all facilities (data centers), including their names, addresses, and latitude/longitude.
#     * `net.json`: A list of all registered networks (ISPs, content providers, etc.).
#     * `ix.json`: A list of all Internet Exchange Points.

# ### Next Steps: Using the Data

# This script gives you the raw, real-world data. To use it in your project, you'll need to write another script to transform this data into your `sites.json` format.

# * **For Sites:** Iterate through `fac.json`. Each entry is a potential "site." You can use its `name`, `city`, `country`, `lat`, and `lon`.
# * **For Networks/Platforms:** You can use the data in `net.json` to get realistic network names to assign to your sit