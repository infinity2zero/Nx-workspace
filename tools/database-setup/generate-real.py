#!/usr/bin/env python3
import os
import json
import math
import random
import logging
import multiprocessing as mp
from datetime import datetime
from typing import List, Tuple, Dict, Any

# --------------------
# Logging
# --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(processName)s %(message)s",
    handlers=[logging.FileHandler("data_generation_real.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# --------------------
# Config
# --------------------
random.seed(42)

OUTPUT_DIR = "data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Sites per city
HOT_CITIES = {"London", "New York", "Tokyo", "Delhi", "São Paulo"}
HUB_CITIES = {
    "London","Amsterdam","Frankfurt","Paris","Zurich","New York",
    "Chicago","San Francisco","Singapore","Tokyo","Seoul","Dubai"
}
HOT_CITY_MULTIPLIER = 50          # sites per hot city
DEFAULT_SITES_PER_CITY = 20       # sites per normal city
SITE_JITTER_KM_MIN_MAX = (1, 10)   # metro spread

# Link budgets per tier (controls total link count)
LINK_BUDGET = {
    "Core Backbone":            800,
    "Regional Network":         1800,
    "Metro Network":            2600,
    "Access Network":           2800,
    "Data Center Interconnect": 400,
    "International Gateway":    200,
    # Optional legacy-like categories:
    "INTERCONNECT":             100,   # set >0 to enable
    "PATCH":                    200,   # set >0 to enable
}
TOTAL_LINKS = sum(LINK_BUDGET.values())

PLATFORMS = [
    "Cisco ASR9000","Cisco ASR1000","Cisco NCS5500","Cisco 8000",
    "Juniper MX480","Juniper MX960","Juniper MX2020","Juniper ACX7100",
    "Nokia 7750-SR","Nokia 7250-IXR","Nokia 7210-SAS",
    "Huawei NE8000","Huawei NE5000E","Huawei NE40E",
    "Arista 7280R","Arista 7500R","HPE FlexNetwork"
]

NETWORKS = [
    "Core Backbone",
    "Regional Network",
    "Metro Network",
    "Access Network",
    "Data Center",
    "International Gateway",
    "Enterprise",
    "IXP/Peering"
]

# Cities (country, city, lat, lon)
ALL_LOCATIONS: List[Tuple[str, str, float, float]] = [
    # Europe
    ("United Kingdom","London", 51.5074,-0.1278),
    ("United Kingdom","Manchester", 53.4808,-2.2426),
    ("France","Paris", 48.8566, 2.3522),
    ("France","Lyon", 45.7640, 4.8357),
    ("Germany","Berlin", 52.5200,13.4050),
    ("Germany","Munich", 48.1351,11.5820),
    ("Netherlands","Amsterdam", 52.3676, 4.9041),
    ("Italy","Rome", 41.9028,12.4964),
    ("Italy","Milan", 45.4642, 9.1900),
    ("Spain","Madrid", 40.4168,-3.7038),
    ("Spain","Barcelona", 41.3851, 2.1734),
    ("Sweden","Stockholm", 59.3293,18.0686),
    ("Poland","Warsaw", 52.2297,21.0122),
    ("Switzerland","Zurich", 47.3769, 8.5417),
    ("Belgium","Brussels", 50.8503, 4.3517),
    ("Norway","Oslo", 59.9139,10.7522),
    ("Denmark","Copenhagen", 55.6761,12.5683),
    ("Austria","Vienna", 48.2082,16.3738),
    ("Ireland","Dublin", 53.3498,-6.2603),
    ("Portugal","Lisbon", 38.7223,-9.1393),
    ("Czech Republic","Prague", 50.0755,14.4378),
    ("Finland","Helsinki", 60.1699,24.9384),
    ("Greece","Athens", 37.9838,23.7275),
    ("Hungary","Budapest", 47.4979,19.0402),

    # North America
    ("United States","New York", 40.7128,-74.0060),
    ("United States","Chicago", 41.8781,-87.6298),
    ("United States","San Francisco", 37.7749,-122.4194),
    ("United States","Dallas", 32.7767,-96.7970),
    ("United States","Los Angeles", 34.0522,-118.2437),
    ("United States","Seattle", 47.6062,-122.3321),
    ("United States","Atlanta", 33.7490,-84.3880),
    ("Canada","Toronto", 43.6532,-79.3832),
    ("Canada","Vancouver", 49.2827,-123.1207),
    ("Canada","Montreal", 45.5017,-73.5673),
    ("Mexico","Mexico City", 19.4326,-99.1332),
    ("Mexico","Guadalajara", 20.6597,-103.3496),

    # Latin America
    ("Brazil","São Paulo",-23.5505,-46.6333),
    ("Brazil","Rio de Janeiro",-22.9068,-43.1729),
    ("Argentina","Buenos Aires",-34.6037,-58.3816),
    ("Chile","Santiago",-33.4489,-70.6693),
    ("Colombia","Bogotá", 4.7110,-74.0721),
    ("Peru","Lima",-12.0464,-77.0428),

    # APAC
    ("India","Delhi", 28.7041, 77.1025),
    ("India","Mumbai", 19.0760, 72.8777),
    ("India","Bangalore", 12.9716, 77.5946),
    ("India","Chennai", 13.0827, 80.2707),
    ("Japan","Tokyo", 35.6895,139.6917),
    ("Japan","Osaka", 34.6937,135.5023),
    ("China","Beijing", 39.9042,116.4074),
    ("China","Shanghai",31.2304,121.4737),
    ("South Korea","Seoul", 37.5665,126.9780),
    ("Singapore","Singapore", 1.3521,103.8198),
    ("Malaysia","Kuala Lumpur", 3.1390,101.6869),
    ("Thailand","Bangkok", 13.7563,100.5018),
    ("Philippines","Manila", 14.5995,120.9842),
    ("Indonesia","Jakarta", -6.2088,106.8456),
    ("Australia","Sydney",-33.8688,151.2093),
    ("Australia","Melbourne",-37.8136,144.9631),
    ("New Zealand","Auckland",-36.8485,174.7633),
    ("Vietnam","Ho Chi Minh City",10.8231,106.6297),
    ("Taiwan","Taipei",25.0330,121.5654),
    ("Hong Kong","Hong Kong",22.3193,114.1694),

    # MENA
    ("UAE","Dubai", 25.2048, 55.2708),
    ("UAE","Abu Dhabi", 24.4539, 54.3773),
    ("Saudi Arabia","Riyadh", 24.7136, 46.6753),
    ("Qatar","Doha", 25.2854, 51.5310),
    ("Israel","Tel Aviv", 32.0853, 34.7818),
    ("Turkey","Istanbul", 41.0082, 28.9784),
    ("Iran","Tehran", 35.6892, 51.3890),
    ("Oman","Muscat", 23.5859, 58.4059),

    # Africa
    ("South Africa","Johannesburg",-26.2041,28.0473),
    ("South Africa","Cape Town",-33.9249,18.4241),
    ("Egypt","Cairo", 30.0444,31.2357),
    ("Kenya","Nairobi", -1.2921,36.8219),
    ("Nigeria","Lagos", 6.5244,3.3792),
    ("Morocco","Casablanca", 33.5731,-7.5898),
    ("Ethiopia","Addis Ababa", 9.1450,38.7451),
    ("Ghana","Accra", 5.6037,-0.1870),
    ("Tanzania","Dar es Salaam",-6.7924,39.2083),
    ("Uganda","Kampala", 0.3476,32.5825),
]

# Optional KDTree for faster pairing
try:
    from sklearn.neighbors import KDTree
    HAVE_SK = True
except Exception:
    HAVE_SK = False

# --------------------
# Helpers
# --------------------
def ts() -> str:
    return datetime.utcnow().isoformat()

def jitter_latlon(lat: float, lon: float, km: float=5.0) -> Tuple[float,float]:
    dlat = (km/111.0) * (random.random()-0.5) * 2
    dlon = (km/(111.0*max(0.2, math.cos(math.radians(lat))))) * (random.random()-0.5) * 2
    return lat + dlat, lon + dlon

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R=6371.0088
    dlat=math.radians(lat2-lat1)
    dlon=math.radians(lon2-lon1)
    a=math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(a))

def geodesic_points(lat1, lon1, lat2, lon2, n=10, jitter=0.0):
    pts=[]
    for i in range(1, n):
        t = i/float(n)
        lat = lat1 + t*(lat2-lat1)
        lon = lon1 + t*(lon2-lon1)
        if jitter>0:
            lat, lon = jitter_latlon(lat, lon, km=jitter)
        pts.append((lat, lon))
    return pts

def linestring_wkt(coords: List[Tuple[float,float]]) -> str:
    clean=[]
    last=None
    for lat,lon in coords:
        if last and abs(lat-last[0])<1e-7 and abs(lon-last[1])<1e-7:
            continue
        clean.append((lat,lon))
        last=(lat,lon)
    if len(clean)<2:
        clean=clean*2
    return "LINESTRING(" + ", ".join([f"{lon} {lat}" for lat,lon in clean]) + ")"

# --------------------
# Network assignment for sites
# --------------------
def assign_network_for_site(city: str, hot: bool, hub: bool) -> str:
    if hub:
        choices = [
            ("Core Backbone", 0.28),
            ("Data Center", 0.20),
            ("IXP/Peering", 0.18),
            ("International Gateway", 0.12),
            ("Regional Network", 0.10),
            ("Metro Network", 0.09),
            ("Access Network", 0.02),
            ("Enterprise", 0.01),
        ]
    elif hot:
        choices = [
            ("Core Backbone", 0.18),
            ("Regional Network", 0.20),
            ("Metro Network", 0.32),
            ("Data Center", 0.12),
            ("Access Network", 0.10),
            ("IXP/Peering", 0.04),
            ("Enterprise", 0.03),
            ("International Gateway", 0.01),
        ]
    else:
        choices = [
            ("Metro Network", 0.40),
            ("Access Network", 0.28),
            ("Regional Network", 0.18),
            ("Enterprise", 0.08),
            ("Data Center", 0.03),
            ("IXP/Peering", 0.02),
            ("Core Backbone", 0.01),
            ("International Gateway", 0.00),
        ]
    r = random.random()
    acc = 0.0
    for name, p in choices:
        acc += p
        if r <= acc:
            return name
    return choices[-1][0]

def build_sites(sites_per_city: int = DEFAULT_SITES_PER_CITY,
                hot_city_multiplier: int = HOT_CITY_MULTIPLIER) -> List[Dict[str,Any]]:
    sites=[]
    sid=1
    for country, city, lat, lon in ALL_LOCATIONS:
        count = (hot_city_multiplier if city in HOT_CITIES else sites_per_city)
        hot = city in HOT_CITIES
        hub = city in HUB_CITIES
        for _ in range(count):
            jmin, jmax = SITE_JITTER_KM_MIN_MAX
            jlat,jlon = jitter_latlon(lat, lon, km=random.uniform(jmin, jmax))
            network = assign_network_for_site(city, hot, hub)
            sites.append({
                "site_id": f"SITE_{sid:06d}",
                "site_virtual_name": f"{city}-PoP-{sid%100}",
                "site_name": f"{city}-{sid%100}",
                "country": country,
                "city": city,
                "platform": random.choice(PLATFORMS),
                "network": network,  # stable category for filtering
                "latitude": round(jlat, 6),
                "longitude": round(jlon, 6),
                "last_modified_at": ts(),
                "is_deleted": 0
            })
            sid+=1
    logger.info(f"📍 Built {len(sites)} sites")
    return sites

def build_kdtree(sites):
    if not HAVE_SK:
        return None, None
    pts = [(s["latitude"], s["longitude"]) for s in sites]
    return KDTree(pts), pts

# --------------------
# Pair picking
# --------------------
def pick_pairs_within(sites, kdtree, pts, min_km, max_km, num_pairs, forbid_same_city=True, seed=42):
    rnd = random.Random(seed)
    n = len(sites)
    out=[]
    attempts=0
    max_attempts = num_pairs*60

    while len(out)<num_pairs and attempts<max_attempts:
        i = rnd.randrange(n)
        si = sites[i]
        if forbid_same_city:
            candidates = [j for j in range(n) if not (sites[j]["city"]==si["city"] and sites[j]["country"]==si["country"])]
        else:
            candidates = list(range(n))
        if kdtree is None:
            rnd.shuffle(candidates)
            found=None
            for j in candidates[:300]:
                sj=sites[j]
                d=haversine_km(si["latitude"],si["longitude"], sj["latitude"],sj["longitude"])
                if min_km<=d<=max_km:
                    found=j; break
            if found is None:
                attempts+=1; continue
            out.append((i,found))
        else:
            rad=max_km/111.0
            idxs = kdtree.query_radius([[si["latitude"], si["longitude"]]], r=rad)[0].tolist()
            rnd.shuffle(idxs)
            found=None
            for j in idxs:
                if j==i: continue
                sj=sites[j]
                if forbid_same_city and sj["city"]==si["city"] and sj["country"]==si["country"]:
                    continue
                d=haversine_km(si["latitude"],si["longitude"], sj["latitude"],sj["longitude"])
                if min_km<=d<=max_km:
                    found=j; break
            if found is None:
                attempts+=1; continue
            out.append((i,found))
        attempts+=1
    return out

# --------------------
# Optional policy check: ensure tier vs site.network make sense
# --------------------
def link_allowed_by_network(tier: str, a_net: str, b_net: str) -> bool:
    if tier == "Core Backbone":
        return ("Core Backbone" in (a_net, b_net)) or ("Regional Network" in (a_net, b_net))
    if tier == "Regional Network":
        return ("Regional Network" in (a_net, b_net)) or ("Metro Network" in (a_net, b_net)) or ("Core Backbone" in (a_net, b_net))
    if tier == "Metro Network":
        return ("Metro Network" in (a_net, b_net)) or ("Access Network" in (a_net, b_net)) or ("Data Center" in (a_net, b_net))
    if tier == "Access Network":
        return ("Access Network" in (a_net, b_net)) or ("Metro Network" in (a_net, b_net))
    if tier == "Data Center Interconnect":
        return ("Data Center" in (a_net, b_net))
    if tier == "International Gateway":
        return ("International Gateway" in (a_net, b_net)) or ("Core Backbone" in (a_net, b_net))
    if tier == "INTERCONNECT":
        return ("IXP/Peering" in (a_net, b_net)) or ("Core Backbone" in (a_net, b_net)) or ("Regional Network" in (a_net, b_net))
    if tier == "PATCH":
        return True
    return True

# --------------------
# Link generation (per tier, for multiprocessing)
# --------------------
def gen_links_for_tier(args) -> List[Dict[str,Any]]:
    (
        tier_name,
        budget,
        min_km,
        max_km,
        jitter_km,
        pts_per_1000,
        sites,
        seed_base,
        forbid_same_city,
        enforce_policy
    ) = args

    rnd_seed = (seed_base ^ hash(tier_name)) & 0xFFFFFFFF
    random.seed(rnd_seed)

    kdtree, pts = build_kdtree(sites)
    pairs = pick_pairs_within(
        sites, kdtree, pts,
        min_km, max_km, budget,
        forbid_same_city=forbid_same_city,
        seed=rnd_seed
    )

    links=[]
    lid = 1
    for (i,j) in pairs:
        A=sites[i]; B=sites[j]
        if enforce_policy and not link_allowed_by_network(tier_name, A["network"], B["network"]):
            continue
        d=haversine_km(A["latitude"],A["longitude"],B["latitude"],B["longitude"])
        n_mid = max(2, min(18, int((d/1000.0)*pts_per_1000)))
        mids = geodesic_points(A["latitude"],A["longitude"],B["latitude"],B["longitude"], n=n_mid, jitter=jitter_km)
        coords = [(A["latitude"],A["longitude"]), *mids, (B["latitude"],B["longitude"])]
        links.append({
            "link_id": f"{tier_name}__TMP_{lid:06d}",
            "site_a_id": A["site_id"],
            "site_b_id": B["site_id"],
            "link_type": tier_name,
            "link_distance": round(d,1),
            "link_kmz_no": "0",
            "link_wkt": linestring_wkt(coords),
            "last_modified_at": ts(),
            "is_deleted": 0
        })
        lid+=1

    logger.info(f"✅ Tier {tier_name}: requested={budget}, generated={len(links)}")
    return links

# --------------------
# Main
# --------------------
def main(
    sites_per_city: int = DEFAULT_SITES_PER_CITY,
    hot_city_multiplier: int = HOT_CITY_MULTIPLIER,
    processes: int = max(2, mp.cpu_count()-1),
    enforce_policy: bool = True
):
    logger.info("🚀 Generating realistic sites & links (multiprocessing)")
    logger.info(f"⚙️  processes={processes}, sites_per_city={sites_per_city}, hot_multiplier={hot_city_multiplier}, policy={enforce_policy}")
    sites = build_sites(sites_per_city, hot_city_multiplier)

    # (budget, min_km, max_km, jitter_km, pts_per_1000km, forbid_same_city)
    tier_spec: Dict[str, tuple] = {
        "Core Backbone":            (LINK_BUDGET["Core Backbone"],            600, 6000, 15, 6, True),
        "International Gateway":    (LINK_BUDGET["International Gateway"],    800, 9000, 20, 6, True),
        "Regional Network":         (LINK_BUDGET["Regional Network"],          80, 1200,  8, 6, True),
        "Metro Network":            (LINK_BUDGET["Metro Network"],              8,   80,  2, 4, False),
        "Access Network":           (LINK_BUDGET["Access Network"],             1,   12,0.8, 3, False),
        "Data Center Interconnect": (LINK_BUDGET["Data Center Interconnect"],   1,    6,0.4, 3, False),
        "INTERCONNECT":             (LINK_BUDGET["INTERCONNECT"],             200, 3000,  6, 4, True),
        "PATCH":                    (LINK_BUDGET["PATCH"],                    0.5,    2,0.3, 3, False),
    }

    work = []
    seed_base = 42
    for tier, (budget, min_km, max_km, jitter_km, pts_per_1000, forbid_same_city) in tier_spec.items():
        if budget and budget > 0:
            work.append((
                tier, int(budget), float(min_km), float(max_km),
                float(jitter_km), int(pts_per_1000),
                sites, seed_base, bool(forbid_same_city), bool(enforce_policy)
            ))

    logger.info(f"🧮 Total link targets across tiers: {sum(b for _,b, *_ in work)}")

    links=[]
    if work:
        with mp.Pool(processes=processes) as pool:
            results = pool.map(gen_links_for_tier, work)
        lid=1
        for lst in results:
            for L in lst:
                L["link_id"] = f"LINK_{lid:06d}"
                lid+=1
                links.append(L)

    logger.info(f"📈 Generated totals: sites={len(sites)} links={len(links)} (target {TOTAL_LINKS})")

    with open(os.path.join(OUTPUT_DIR,'sites.json'),'w') as f:
        json.dump(sites, f, indent=2)
    with open(os.path.join(OUTPUT_DIR,'links.json'),'w') as f:
        json.dump(links, f, indent=2)

    logger.info(f"💾 Wrote {OUTPUT_DIR}/sites.json and {OUTPUT_DIR}/links.json")
    logger.info("🎉 Generation complete")

if __name__ == "__main__":
    try:
        main(
            sites_per_city=DEFAULT_SITES_PER_CITY,
            hot_city_multiplier=HOT_CITY_MULTIPLIER,
            processes=max(2, mp.cpu_count()-1),
            enforce_policy=True   # set False to allow all pairings irrespective of site.network
        )
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        raise
