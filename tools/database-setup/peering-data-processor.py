import os
import json
import logging
import random
import math
from collections import defaultdict

# --- Configuration ---
INPUT_DIR = "peeringdb_data"
OUTPUT_DIR = "processed_data"
# Consider a network "major" if it's present in at least this many facilities.
# This helps focus on backbone providers and reduces noise.
MAJOR_NETWORK_THRESHOLD = 10 
# To keep the graph manageable, limit links per network.
MAX_LINKS_PER_NETWORK = 200

# --- Setup Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler("peeringdb_processor.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# --- Helper Functions for Geometry ---
def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Calculates the distance between two points on Earth."""
    R = 6371.0088
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def linestring_wkt(coords: list) -> str:
    """Creates a WKT linestring from a list of (lat, lon) tuples."""
    if not coords:
        return "LINESTRING EMPTY"
    return "LINESTRING(" + ", ".join([f"{lon:.6f} {lat:.6f}" for lat, lon in coords]) + ")"

def create_curved_path(start_lat, start_lon, end_lat, end_lon, num_midpoints=5):
    """Generates a gently curved path between two points."""
    points = [(start_lat, start_lon)]
    
    vec_lat = end_lat - start_lat
    vec_lon = end_lon - start_lon
    perp_lat = -vec_lon
    perp_lon = vec_lat
    
    length = math.sqrt(perp_lat**2 + perp_lon**2)
    if length > 0:
        perp_lat /= length
        perp_lon /= length

    curve_magnitude = math.sqrt(vec_lat**2 + vec_lon**2) * 0.1

    for i in range(1, num_midpoints + 1):
        fraction = i / (num_midpoints + 1)
        mid_lat = start_lat + fraction * vec_lat
        mid_lon = start_lon + fraction * vec_lon
        offset = curve_magnitude * math.sin(math.pi * fraction)
        points.append((mid_lat + offset * perp_lat, mid_lon + offset * perp_lon))
        
    points.append((end_lat, end_lon))
    return points


# --- Main Processing Logic ---
def load_json_data(filename: str) -> list:
    """Loads a JSON file from the input directory."""
    path = os.path.join(INPUT_DIR, filename)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Could not load or parse {path}: {e}")
        return []

def process_sites(facilities: list, orgs: list, networks: list, netfacs: list, ixs: list, ixlans: list, netixlans: list) -> list:
    """
    Processes raw PeeringDB data to create a clean sites.json, now including IX connection speeds.
    """
    logger.info("Processing sites and enriching with IX connection data...")
    
    # Create lookup tables for performance
    org_lookup = {org['id']: org['name'] for org in orgs}
    net_lookup = {net['id']: net['name'] for net in networks}
    ix_lookup = {ix['id']: ix['name'] for ix in ixs}
    ixlan_to_ix_lookup = {ixlan['id']: ixlan['ix_id'] for ixlan in ixlans}
    
    # Map facilities to the networks they contain
    fac_to_nets = defaultdict(list)
    for netfac in netfacs:
        fac_id = netfac.get('fac_id')
        net_id = netfac.get('net_id')
        if fac_id and net_id in net_lookup:
            fac_to_nets[fac_id].append({
                "id": net_id,
                "name": net_lookup[net_id]
            })

    # NEW: Map facilities to their IX connection details including speed
    fac_to_ix_connections = defaultdict(list)
    for netixlan in netixlans:
        ixlan_id = netixlan.get('ixlan_id')
        net_id = netixlan.get('net_id')
        speed = netixlan.get('speed') # Speed is in Mbps (e.g., 100000 is 100G)
        
        if not all([ixlan_id, net_id, speed]):
            continue

        ix_id = ixlan_to_ix_lookup.get(ixlan_id)
        # The ixlan object contains the facility id where the connection happens
        lan_details = next((lan for lan in ixlans if lan['id'] == ixlan_id), None)
        if not lan_details or 'fac_id' not in lan_details:
            continue
        
        fac_id = lan_details['fac_id']
        
        fac_to_ix_connections[fac_id].append({
            "network_name": net_lookup.get(net_id, "Unknown Network"),
            "ix_name": ix_lookup.get(ix_id, "Unknown IX"),
            "speed_mbps": speed
        })


    processed_sites = []
    for fac in facilities:
        if not fac.get('latitude') or not fac.get('longitude'):
            continue
            
        site_id = f"SITE_PDB_{fac['id']}"
        
        processed_sites.append({
            "site_id": site_id,
            "site_name": fac['name'],
            "city": fac['city'],
            "country": fac['country'],
            "latitude": fac['latitude'],
            "longitude": fac['longitude'],
            "organization_name": org_lookup.get(fac['org_id'], "N/A"),
            "networks_present": fac_to_nets.get(fac['id'], []),
            "ix_connections": fac_to_ix_connections.get(fac['id'], []) # Add the new speed data
        })
        
    logger.info(f"✅ Processed {len(processed_sites)} sites with valid locations.")
    return processed_sites

def process_links(sites: list, netfacs: list) -> list:
    """
    Generates a links.json by connecting sites that share major networks.
    """
    logger.info("Generating links based on network co-location...")
    
    site_lookup = {site['site_id']: site for site in sites}
    
    net_to_facs = defaultdict(list)
    for netfac in netfacs:
        net_to_facs[netfac['net_id']].append(f"SITE_PDB_{netfac['fac_id']}")
        
    processed_links = []
    link_id_counter = 1
    
    for net_id, fac_ids in net_to_facs.items():
        if len(fac_ids) < MAJOR_NETWORK_THRESHOLD:
            continue

        potential_pairs = []
        hub_site_id = fac_ids[0]
        for i in range(1, len(fac_ids)):
            potential_pairs.append(tuple(sorted((hub_site_id, fac_ids[i]))))
        
        random.shuffle(potential_pairs)
        
        for site_a_id, site_b_id in potential_pairs[:MAX_LINKS_PER_NETWORK]:
            if site_a_id not in site_lookup or site_b_id not in site_lookup:
                continue

            site_a = site_lookup[site_a_id]
            site_b = site_lookup[site_b_id]
            
            distance = haversine_km(site_a['latitude'], site_a['longitude'], site_b['latitude'], site_b['longitude'])
            
            if distance > 1000:
                link_type = "Core Backbone"
            elif distance > 50:
                link_type = "Regional Network"
            else:
                link_type = "Metro Network"

            path_coords = create_curved_path(
                site_a['latitude'], site_a['longitude'],
                site_b['latitude'], site_b['longitude']
            )

            processed_links.append({
                "link_id": f"LINK_PDB_{link_id_counter}",
                "site_a_id": site_a_id,
                "site_b_id": site_b_id,
                "link_type": link_type,
                "link_distance": round(distance, 2),
                "link_wkt": linestring_wkt(path_coords),
                "generating_network_id": net_id
            })
            link_id_counter += 1
            
    logger.info(f"✅ Generated {len(processed_links)} links between sites.")
    return processed_links


def main():
    """Main function to load, process, and save the data."""
    logger.info("🚀 Starting PeeringDB data processing...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load all necessary raw data files
    facilities = load_json_data("fac.json")
    orgs = load_json_data("org.json")
    networks = load_json_data("net.json")
    netfacs = load_json_data("netfac.json")
    ixs = load_json_data("ix.json")
    ixlans = load_json_data("ixlan.json")
    netixlans = load_json_data("netixlan.json")
    
    if not all([facilities, orgs, networks, netfacs, ixs, ixlans, netixlans]):
        logger.error("❌ One or more essential data files could not be loaded. Exiting.")
        return

    # 1. Process sites
    final_sites = process_sites(facilities, orgs, networks, netfacs, ixs, ixlans, netixlans)
    
    # 2. Process links
    final_links = process_links(final_sites, netfacs)
    
    # 3. Save the final, processed files
    sites_path = os.path.join(OUTPUT_DIR, "sites.json")
    with open(sites_path, 'w', encoding='utf-8') as f:
        json.dump(final_sites, f, indent=2)
    logger.info(f"💾 Successfully saved final sites file to {sites_path}")

    links_path = os.path.join(OUTPUT_DIR, "links.json")
    with open(links_path, 'w', encoding='utf-8') as f:
        json.dump(final_links, f, indent=2)
    logger.info(f"💾 Successfully saved final links file to {links_path}")
    
    logger.info("🎉 Processing complete.")

if __name__ == "__main__":
    main()
