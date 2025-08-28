#!/usr/bin/env python3
import os, json, math, random, logging, multiprocessing as mp
from datetime import datetime
from typing import List, Tuple, Dict, Any
from collections import defaultdict, deque

# -------------------- Logging --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(processName)s %(message)s",
    handlers=[logging.FileHandler("data_generation_real_v4.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# -------------------- Config --------------------
random.seed(42)
OUTPUT_DIR = "data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HOT_CITIES = {"London","New York","Tokyo","Delhi","São Paulo"}
HUB_CITIES = {
    "London","Amsterdam","Frankfurt","Paris","Zurich","New York",
    "Chicago","San Francisco","Singapore","Tokyo","Seoul","Dubai",
    "Mumbai","Delhi","Bangalore","Hong Kong","Frankfurt","Madrid","Milan"
}
COASTAL_GATEWAYS = {
    "Mumbai","Chennai","Kochi","Singapore","Hong Kong","Tokyo","Osaka",
    "Los Angeles","San Francisco","New York","Miami",
    "Lisbon","Barcelona","Marseille","Athens","Istanbul","Dubai"
}

# Region buckets (very coarse) for hub hierarchy
REGIONS = {
    "Europe": {"United Kingdom","France","Germany","Netherlands","Italy","Spain","Sweden","Poland","Switzerland","Belgium","Norway","Denmark","Austria","Ireland","Portugal","Czech Republic","Finland","Greece","Hungary"},
    "North America": {"United States","Canada","Mexico"},
    "Latin America": {"Brazil","Argentina","Chile","Colombia","Peru"},
    "APAC": {"India","Japan","China","South Korea","Singapore","Malaysia","Thailand","Philippines","Indonesia","Australia","New Zealand","Vietnam","Taiwan","Hong Kong"},
    "MENA": {"UAE","Saudi Arabia","Qatar","Israel","Turkey","Iran","Oman"},
    "Africa": {"South Africa","Egypt","Kenya","Nigeria","Morocco","Ethiopia","Ghana","Tanzania","Uganda"},
}

HOT_CITY_MULTIPLIER = 80
DEFAULT_SITES_PER_CITY = 30
SITE_JITTER_KM_MIN_MAX = (2, 30)

# Link budgets per tier
LINK_BUDGET = {
    "Core Backbone":            1500,
    "Regional Network":         1800,
    "Metro Network":            2600,
    "Access Network":           2800,
    "Data Center Interconnect": 400,
    "International Gateway":    200,
    "INTERCONNECT":             100,
    "PATCH":                    200,
}
TOTAL_LINKS = sum(LINK_BUDGET.values())

# Limits to quell starbursts and redundant parallels
DEGREE_CAPS = {
    "Core Backbone": 10, "International Gateway": 4, "INTERCONNECT": 6,
    "Regional Network": 10, "Metro Network": 16,
    "Access Network": 24, "Data Center Interconnect": 12, "PATCH": 60
}
PAIR_CAPS = {  # per tier, per metro city-pair (unordered)
    "Core Backbone": 3, "International Gateway": 2, "INTERCONNECT": 3,
    "Regional Network": 4, "Metro Network": 6
}
SECTOR_DEG = 30  # bearing bucket size
SECTOR_CAPS = {  # per site, per tier, per sector
    "Core Backbone": 2, "International Gateway": 2, "INTERCONNECT": 2,
    "Regional Network": 3, "Metro Network": 4
}

PLATFORMS = [
    "Cisco ASR9000","Cisco ASR1000","Cisco NCS5500","Cisco 8000",
    "Juniper MX480","Juniper MX960","Juniper MX2020","Juniper ACX7100",
    "Nokia 7750-SR","Nokia 7250-IXR","Nokia 7210-SAS",
    "Huawei NE8000","Huawei NE5000E","Huawei NE40E",
    "Arista 7280R","Arista 7500R","HPE FlexNetwork"
]
PLATFORM_WEIGHTS_HUB = {
    "Cisco ASR9000":1.0,"Cisco ASR1000":0.5,"Cisco NCS5500":1.0,"Cisco 8000":1.0,
    "Juniper MX480":0.9,"Juniper MX960":1.0,"Juniper MX2020":0.8,"Juniper ACX7100":0.4,
    "Nokia 7750-SR":0.9,"Nokia 7250-IXR":0.7,"Nokia 7210-SAS":0.4,
    "Huawei NE8000":0.8,"Huawei NE5000E":0.7,"Huawei NE40E":0.5,
    "Arista 7280R":0.7,"Arista 7500R":0.6,"HPE FlexNetwork":0.3
}
PLATFORM_WEIGHTS_HOT = {
    "Cisco ASR9000":0.8,"Cisco ASR1000":0.7,"Cisco NCS5500":0.7,"Cisco 8000":0.6,
    "Juniper MX480":0.8,"Juniper MX960":0.7,"Juniper MX2020":0.5,"Juniper ACX7100":0.6,
    "Nokia 7750-SR":0.7,"Nokia 7250-IXR":0.6,"Nokia 7210-SAS":0.6,
    "Huawei NE8000":0.6,"Huawei NE5000E":0.5,"Huawei NE40E":0.6,
    "Arista 7280R":0.6,"Arista 7500R":0.5,"HPE FlexNetwork":0.4
}
PLATFORM_WEIGHTS_NORMAL = {
    "Cisco ASR9000":0.3,"Cisco ASR1000":0.7,"Cisco NCS5500":0.3,"Cisco 8000":0.2,
    "Juniper MX480":0.5,"Juniper MX960":0.3,"Juniper MX2020":0.2,"Juniper ACX7100":0.7,
    "Nokia 7750-SR":0.5,"Nokia 7250-IXR":0.6,"Nokia 7210-SAS":0.7,
    "Huawei NE8000":0.4,"Huawei NE5000E":0.3,"Huawei NE40E":0.6,
    "Arista 7280R":0.4,"Arista 7500R":0.3,"HPE FlexNetwork":0.6
}

NETWORKS = [
    "Core Backbone","Regional Network","Metro Network","Access Network",
    "Data Center","International Gateway","Enterprise","IXP/Peering"
]

# -------------- Locations --------------
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

# Optional KDTree
try:
    from sklearn.neighbors import KDTree
    HAVE_SK = True
except Exception:
    HAVE_SK = False

# -------------------- Helpers --------------------
def ts() -> str:
    return datetime.utcnow().isoformat()

def weighted_choice(weight_map: Dict[str, float], rnd: random.Random) -> str:
    items = list(weight_map.items())
    total = sum(max(0.0, w) for _, w in items) or 1.0
    r = rnd.random() * total
    acc = 0.0
    for name, w in items:
        acc += max(0.0, w)
        if r <= acc:
            return name
    return items[-1][0]

def jitter_latlon(lat: float, lon: float, km: float=5.0) -> Tuple[float,float]:
    dlat = (km/111.0) * (random.random()-0.5) * 2
    dlon = (km/(111.0*max(0.2, math.cos(math.radians(lat))))) * (random.random()-0.5) * 2
    return lat + dlat, lon + dlon

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0088
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def interpolate_points(a_lat, a_lon, b_lat, b_lon, n_mid: int, jitter_km: float) -> List[Tuple[float,float]]:
    pts=[]
    for i in range(1, n_mid+1):
        t = i / (n_mid + 1)
        lat = a_lat + t*(b_lat - a_lat)
        lon = a_lon + t*(b_lon - a_lon)
        if jitter_km > 0:
            lat, lon = jitter_latlon(lat, lon, km=jitter_km)
        pts.append((lat, lon))
    return pts

def linestring_wkt(coords: List[Tuple[float,float]]) -> str:
    clean=[]; last=None
    for lat,lon in coords:
        if last and abs(lat-last[0])<1e-7 and abs(lon-last[1])<1e-7:
            continue
        clean.append((lat,lon)); last=(lat,lon)
    if len(clean)<2: clean=clean*2
    return "LINESTRING(" + ", ".join([f"{lon} {lat}" for lat,lon in clean]) + ")"

# -------------------- Tiers & ranges --------------------
TIER_RANGES = {
    "Core Backbone": (600, 6000),
    "Regional Network": (80, 1200),
    "Metro Network": (8, 80),
    "Access Network": (1, 12),
    "Data Center Interconnect": (1, 6),
    "International Gateway": (800, 9000),
    "INTERCONNECT": (200, 3000),
    "PATCH": (0.1, 2.0),
}

# -------------------- Sites --------------------
def assign_network_for_site(city: str, hot: bool, hub: bool) -> str:
    if hub:
        choices = [("Core Backbone",0.28),("Data Center",0.20),("IXP/Peering",0.18),
                   ("International Gateway",0.12),("Regional Network",0.10),
                   ("Metro Network",0.09),("Access Network",0.02),("Enterprise",0.01)]
    elif hot:
        choices = [("Core Backbone",0.18),("Regional Network",0.20),("Metro Network",0.32),
                   ("Data Center",0.12),("Access Network",0.10),("IXP/Peering",0.04),
                   ("Enterprise",0.03),("International Gateway",0.01)]
    else:
        choices = [("Metro Network",0.40),("Access Network",0.28),("Regional Network",0.18),
                   ("Enterprise",0.08),("Data Center",0.03),("IXP/Peering",0.02),
                   ("Core Backbone",0.01),("International Gateway",0.00)]
    r = random.random(); acc = 0.0
    for name, p in choices:
        acc += p
        if r <= acc: return name
    return choices[-1][0]

def ensure_platform_network_coverage(sites: List[Dict[str,Any]]):
    by_city_role = sorted(sites, key=lambda s: (s["city"] in HUB_CITIES, s["city"] in HOT_CITIES), reverse=True)
    have = set((s["platform"], s["network"]) for s in sites)
    missing=[]
    for p in PLATFORMS:
        for n in NETWORKS:
            if (p,n) not in have: missing.append((p,n))
    changed=0; idx=0
    for p,n in missing:
        while idx < len(by_city_role) and (by_city_role[idx]["platform"], by_city_role[idx]["network"]) in have:
            idx+=1
        cand = by_city_role[idx % len(by_city_role)]
        cand["platform"] = p; cand["network"] = n
        have.add((p,n)); changed+=1; idx+=1
    if changed: logger.info(f"🧩 Adjusted {changed} sites to ensure full PLATFORM×NETWORK coverage")

def weighted_platform_for(city: str, sid: int, hub: bool, hot: bool) -> str:
    if sid <= len(PLATFORMS):
        return PLATFORMS[(sid - 1) % len(PLATFORMS)]
    if hub: return weighted_choice(PLATFORM_WEIGHTS_HUB, random)
    if hot: return weighted_choice(PLATFORM_WEIGHTS_HOT, random)
    return weighted_choice(PLATFORM_WEIGHTS_NORMAL, random)

def build_sites(sites_per_city: int, hot_city_multiplier: int) -> List[Dict[str,Any]]:
    sites=[]; sid=1
    for country, city, lat, lon in ALL_LOCATIONS:
        count = (hot_city_multiplier if city in HOT_CITIES else sites_per_city)
        hot = city in HOT_CITIES; hub = city in HUB_CITIES
        for _ in range(count):
            jlat,jlon = jitter_latlon(lat, lon, km=random.uniform(*SITE_JITTER_KM_MIN_MAX))
            network = assign_network_for_site(city, hot, hub)
            platform = weighted_platform_for(city, sid, hub, hot)
            sites.append({
                "site_id": f"SITE_{sid:06d}",
                "site_virtual_name": f"{city}-PoP-{sid%100}",
                "site_name": f"{city}-{sid%100}",
                "country": country, "city": city,
                "platform": platform, "network": network,
                "latitude": round(jlat, 6), "longitude": round(jlon, 6),
                "last_modified_at": ts(), "is_deleted": 0
            }); sid+=1
    ensure_platform_network_coverage(sites)
    logger.info(f"📍 Built {len(sites)} sites (coverage ensured)")
    return sites

def build_kdtree(sites):
    if not HAVE_SK: return None, None
    pts = [(s["latitude"], s["longitude"]) for s in sites]
    return KDTree(pts), pts

# -------------------- Hub hierarchy --------------------
def region_of(country: str) -> str:
    for name, countries in REGIONS.items():
        if country in countries: return name
    return "Other"

def pick_super_hubs(sites: List[Dict[str,Any]], per_region: int = 4) -> Dict[str, List[str]]:
    # Choose up to N super-hub cities per region from HUB_CITIES (by presence count)
    by_city = defaultdict(list)
    for s in sites: by_city[(s["country"], s["city"])].append(s)
    city_scores = []
    for (country, city), lst in by_city.items():
        score = len(lst) + (10 if city in HUB_CITIES else 0) + (5 if city in HOT_CITIES else 0)
        city_scores.append(((country, city), score))
    city_scores.sort(key=lambda x: -x[1])

    region_hubs = defaultdict(list)
    for (country, city), _ in city_scores:
        reg = region_of(country)
        if len(region_hubs[reg]) < per_region and city in HUB_CITIES:
            region_hubs[reg].append(city)
    return region_hubs  # map region -> [city names]

# -------------------- Pair picking --------------------
def pick_pairs_within(sites, kdtree, pts, min_km, max_km, num_pairs, forbid_same_city=True, seed=42):
    rnd = random.Random(seed); n=len(sites); out=[]; attempts=0; max_attempts=num_pairs*80
    while len(out)<num_pairs and attempts<max_attempts:
        i = rnd.randrange(n); si = sites[i]
        if forbid_same_city:
            candidates = [j for j in range(n) if not (sites[j]["city"]==si["city"] and sites[j]["country"]==si["country"])]
        else:
            candidates = list(range(n))
        if kdtree is None:
            rnd.shuffle(candidates); found=None
            for j in candidates[:400]:
                sj=sites[j]
                d=haversine_km(si["latitude"],si["longitude"], sj["latitude"],sj["longitude"])
                if min_km<=d<=max_km: found=j; break
            if found is None: attempts+=1; continue
            out.append((i,found))
        else:
            rad=max_km/111.0
            idxs = kdtree.query_radius([[si["latitude"], si["longitude"]]], r=rad)[0].tolist()
            rnd.shuffle(idxs); found=None
            for j in idxs:
                if j==i: continue
                sj=sites[j]
                if forbid_same_city and sj["city"]==si["city"] and sj["country"]==si["country"]: continue
                d=haversine_km(si["latitude"],si["longitude"], sj["latitude"],sj["longitude"])
                if min_km<=d<=max_km: found=j; break
            if found is None: attempts+=1; continue
            out.append((i,found))
        attempts+=1
    return out

# -------------------- Policy & geometry --------------------
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
    if tier == "PATCH": return True
    return True

def choose_hub_waypoints(tier: str, A: Dict[str,Any], B: Dict[str,Any], sites: List[Dict[str,Any]],
                         super_hubs_by_region: Dict[str, List[str]],
                         rng: random.Random = random) -> List[Tuple[float,float]]:
    # choose 0..N hub waypoints based on tier; prefer super-hubs & coastal gateways
    max_hubs_by_tier = {
        "Access Network":(0,1),"Data Center Interconnect":(0,1),"PATCH":(0,1),
        "Metro Network":(1,1),"Regional Network":(2,3),
        "Core Backbone":(2,4),"INTERCONNECT":(1,3),"International Gateway":(3,5)
    }
    min_h,max_h = max_hubs_by_tier.get(tier,(0,2))
    if max_h<=0: return []

    by_city = defaultdict(list)
    for s in sites: by_city[s["city"]].append(s)

    def nearest_city_site(city: str, lat0: float, lon0: float):
        if city not in by_city: return None
        best=None; bd=1e9
        for s in by_city[city]:
            d=haversine_km(lat0,lon0,s["latitude"],s["longitude"])
            if d<bd: bd=d; best=s
        return (best["latitude"], best["longitude"]) if best else None

    a_lat,a_lon = A["latitude"],A["longitude"]
    b_lat,b_lon = B["latitude"],B["longitude"]
    candidates=[]

    # Prefer super-hubs in origin/destination regions
    regA = region_of(A["country"]); regB = region_of(B["country"])
    for city in super_hubs_by_region.get(regA, [])[:2]:
        p = nearest_city_site(city, a_lat, a_lon);  candidates += [p] if p else []
    for city in super_hubs_by_region.get(regB, [])[:2]:
        p = nearest_city_site(city, b_lat, b_lon);  candidates += [p] if p else []

    # Coastal gateways
    if tier in ("International Gateway","INTERCONNECT","Core Backbone"):
        for city in COASTAL_GATEWAYS:
            p = nearest_city_site(city, (a_lat+b_lat)/2, (a_lon+b_lon)/2)
            if p: candidates.append(p)

    # Regional mid-course anchors
    mid_lat=(a_lat+b_lat)/2; mid_lon=(a_lon+b_lon)/2
    for km in (20,60,120): candidates.append(jitter_latlon(mid_lat, mid_lon, km=km))

    # Destination hub again
    if B["city"] in HUB_CITIES:
        p = nearest_city_site(B["city"], b_lat, b_lon)
        if p: candidates.append(p)

    # Pick dispersed subset
    seen=set(); dedup=[]
    for p in candidates:
        key=(round(p[0],3), round(p[1],3))
        if key not in seen:
            seen.add(key); dedup.append(p)

    straight=haversine_km(a_lat,a_lon,b_lat,b_lon)
    def proj_t(lat,lon): return (haversine_km(a_lat,a_lon,lat,lon))/max(straight,1e-6)
    scored=[(abs(proj_t(lat,lon)-t)+(rng.random()*0.05),(lat,lon))
            for (lat,lon) in dedup
            for t in ([1/3,2/3] if max_h<=2 else [0.25,0.5,0.75])]
    rng.shuffle(scored); scored.sort(key=lambda x: x[0])
    k=rng.randint(min_h,max_h)
    picked=[]; used=set()
    for _,p in scored:
        b=int(proj_t(p[0],p[1])*10)
        if b in used: continue
        picked.append(p); used.add(b)
        if len(picked)>=k: break
    return picked[:k]

def make_routed_geometry(tier_name: str, A: Dict[str,Any], B: Dict[str,Any], sites: List[Dict[str,Any]],
                         super_hubs_by_region: Dict[str, List[str]]) -> Tuple[float,str]:
    dmin,dmax = TIER_RANGES.get(tier_name,(1,20000))
    hubs = choose_hub_waypoints(tier_name, A, B, sites, super_hubs_by_region)

    # per-segment density
    if tier_name in ("Core Backbone","International Gateway","INTERCONNECT"): per_mid, jitter = 6, 2.2
    elif tier_name=="Regional Network": per_mid, jitter = 4, 1.6
    elif tier_name in ("Metro Network","Access Network"): per_mid, jitter = 2, 0.6
    elif tier_name=="Data Center Interconnect": per_mid, jitter = 1, 0.3
    else: per_mid, jitter = 2, 1.0

    path=[(A["latitude"],A["longitude"])] + hubs + [(B["latitude"],B["longitude"])]
    coords=[path[0]]; total=0.0
    for u,v in zip(path[:-1], path[1:]):
        a_lat,a_lon=u; b_lat,b_lon=v
        mids = interpolate_points(a_lat,a_lon,b_lat,b_lon, n_mid=per_mid, jitter_km=jitter)
        coords += mids + [(b_lat,b_lon)]
        total += haversine_km(a_lat,a_lon,b_lat,b_lon)

    straight=haversine_km(A["latitude"],A["longitude"],B["latitude"],B["longitude"])
    total=max(total, straight)
    if total < dmin or total > dmax*1.25 or straight < dmin or straight > dmax*1.5:
        return -1.0, ""
    return round(total,1), linestring_wkt(coords)

# -------------------- Metro ring builder --------------------
def build_metro_links(sites: List[Dict[str,Any]], k_neighbors: int = 4) -> List[Tuple[int,int]]:
    # Return index pairs of same-city nearest-neighbor ring/ladder connections
    by_city = defaultdict(list)
    for idx,s in enumerate(sites): by_city[(s["country"],s["city"])].append(idx)
    pairs=[]
    for key, idxs in by_city.items():
        if len(idxs) < 3: continue
        # compute k nearest within city
        pts=[(sites[i]["latitude"], sites[i]["longitude"]) for i in idxs]
        if HAVE_SK:
            tree=KDTree(pts)
            for pos,i in enumerate(idxs):
                neigh = tree.query([pts[pos]], k=min(k_neighbors+1,len(idxs)))[1][0].tolist()
                for nnpos in neigh[1:]:
                    j = idxs[nnpos]
                    if i<j: pairs.append((i,j))
        else:
            for ai,i in enumerate(idxs):
                dists=[]
                for bj,j in enumerate(idxs):
                    if i==j: continue
                    d=haversine_km(sites[i]["latitude"],sites[i]["longitude"],sites[j]["latitude"],sites[j]["longitude"])
                    dists.append((d,j))
                dists.sort(key=lambda x:x[0])
                for _,j in dists[:k_neighbors]:
                    if i<j: pairs.append((i,j))
    return pairs

# -------------------- Caps bookkeeping --------------------
def bearing_deg(a: Dict[str,Any], b: Dict[str,Any]) -> float:
    dy=b["latitude"]-a["latitude"]; dx=b["longitude"]-a["longitude"]
    return (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0

def ok_by_caps(tier: str, A: Dict[str,Any], B: Dict[str,Any],
               deg_by_tier: Dict[str,Dict[str,int]],
               pair_counts: Dict[Tuple[str,Tuple[str,str]], int],
               sector_counts: Dict[Tuple[str,str,int], int]) -> bool:
    # degree caps
    if deg_by_tier[tier].get(A["site_id"],0) >= DEGREE_CAPS.get(tier, 1e9): return False
    if deg_by_tier[tier].get(B["site_id"],0) >= DEGREE_CAPS.get(tier, 1e9): return False
    # city-pair caps (unordered city names)
    pair_key = (tier, tuple(sorted((A["city"], B["city"]))))
    cap = PAIR_CAPS.get(tier, 1e9)
    if pair_counts.get(pair_key,0) >= cap: return False
    # sector caps (origin only for speed; you can enable for B as well)
    if tier in SECTOR_CAPS:
        secA = int(bearing_deg(A,B) // SECTOR_DEG)
        if sector_counts.get((tier, A["site_id"], secA),0) >= SECTOR_CAPS[tier]: return False
    return True

def bump_caps(tier: str, A: Dict[str,Any], B: Dict[str,Any],
              deg_by_tier: Dict[str,Dict[str,int]],
              pair_counts: Dict[Tuple[str,Tuple[str,str]], int],
              sector_counts: Dict[Tuple[str,str,int], int]):
    deg_by_tier[tier][A["site_id"]] = deg_by_tier[tier].get(A["site_id"],0) + 1
    deg_by_tier[tier][B["site_id"]] = deg_by_tier[tier].get(B["site_id"],0) + 1
    pair_key = (tier, tuple(sorted((A["city"], B["city"]))))
    pair_counts[pair_key] = pair_counts.get(pair_key,0) + 1
    if tier in SECTOR_CAPS:
        secA = int(bearing_deg(A,B) // SECTOR_DEG)
        sector_counts[(tier, A["site_id"], secA)] = sector_counts.get((tier, A["site_id"], secA),0) + 1

# -------------------- Tier generation (MP) --------------------
def gen_links_for_tier(args) -> List[Dict[str,Any]]:
    (tier_name, budget, min_km, max_km, jitter_km, _pts_per_1000,
     sites, seed_base, forbid_same_city, enforce_policy, super_hubs_by_region) = args

    rnd_seed = (seed_base ^ hash(tier_name)) & 0xFFFFFFFF
    random.seed(rnd_seed)
    kdtree, pts = build_kdtree(sites)
    # produce many candidates; we’ll filter by caps
    pairs = pick_pairs_within(sites, kdtree, pts, min_km, max_km, int(budget*2),
                              forbid_same_city=forbid_same_city, seed=rnd_seed)

    # cap bookkeeping
    deg_by_tier = defaultdict(dict)
    pair_counts: Dict[Tuple[str,Tuple[str,str]], int] = {}
    sector_counts: Dict[Tuple[str,str,int], int] = {}

    links=[]; lid=1
    for (i,j) in pairs:
        if len(links) >= budget: break
        A=sites[i]; B=sites[j]
        if enforce_policy and not link_allowed_by_network(tier_name, A["network"], B["network"]):
            continue
        if not ok_by_caps(tier_name, A, B, deg_by_tier, pair_counts, sector_counts):
            continue
        dist, wkt = make_routed_geometry(tier_name, A, B, sites, super_hubs_by_region)
        if dist < 0: continue
        bump_caps(tier_name, A, B, deg_by_tier, pair_counts, sector_counts)
        links.append({
            "link_id": f"{tier_name}__TMP_{lid:06d}",
            "site_a_id": A["site_id"], "site_b_id": B["site_id"],
            "link_type": tier_name, "link_distance": round(dist,1),
            "link_kmz_no": "0", "link_wkt": wkt,
            "last_modified_at": ts(), "is_deleted": 0
        }); lid+=1

    logger.info(f"✅ Tier {tier_name}: target={budget}, built={len(links)} (range {min_km}-{max_km} km)")
    return links

# -------------------- Graph utils & healing --------------------
def build_adjacency(links, sites_by_id):
    adj = defaultdict(set)
    for L in links:
        a, b = L["site_a_id"], L["site_b_id"]
        if a in sites_by_id and b in sites_by_id and a != b:
            adj[a].add(b); adj[b].add(a)
    return adj

def connected_components(adj, site_ids):
    seen=set(); comps=[]
    for s in site_ids:
        if s in seen: continue
        comp=[]; q=deque([s]); seen.add(s)
        while q:
            u=q.popleft(); comp.append(u)
            for v in adj[u]:
                if v not in seen: seen.add(v); q.append(v)
        comps.append(comp)
    return comps

def pick_best_neighbor(site_id, sites_by_id, candidates, tier_name, avoid_set):
    A = sites_by_id[site_id]; a= (A["latitude"], A["longitude"])
    dmin,dmax = TIER_RANGES.get(tier_name,(1,2000))
    scored=[]
    for bid in candidates:
        if bid == site_id or bid in avoid_set: continue
        B = sites_by_id[bid]; d=haversine_km(a[0],a[1],B["latitude"],B["longitude"])
        if d < dmin or d > dmax: continue
        scored.append((abs(d-(dmin+dmax)/2), bid, d))
    scored.sort(key=lambda x:x[0])
    return scored[0] if scored else None

def heal_isolated_and_low_degree(sites, links, min_degree=1, important_min_degree=2, super_hubs_by_region=None):
    sites_by_id = {s["site_id"]: s for s in sites}
    adj = build_adjacency(links, sites_by_id)
    site_ids = [s["site_id"] for s in sites]

    by_city = defaultdict(list)
    for s in sites: by_city[(s["country"], s["city"])].append(s["site_id"])

    new_links=[]
    def add_link(aid, bid, tier):
        A=sites_by_id[aid]; B=sites_by_id[bid]
        dist, wkt = make_routed_geometry(tier, A, B, sites, super_hubs_by_region)
        if dist < 0: return False
        L = {"site_a_id": aid, "site_b_id": bid, "link_type": tier,
             "link_distance": dist, "link_kmz_no": "0",
             "link_wkt": wkt, "last_modified_at": ts(), "is_deleted": 0}
        new_links.append(L); adj[aid].add(bid); adj[bid].add(aid); return True

    for sid in site_ids:
        deg = len(adj[sid]); s = sites_by_id[sid]
        imp = s["network"] in ("Core Backbone","Regional Network","Metro Network","Data Center")
        target_deg = important_min_degree if imp else min_degree
        attempts=0
        while deg < target_deg and attempts < 6:
            same_city = by_city[(s["country"], s["city"])]
            tier_try = "Metro Network" if len(same_city) > 1 else "Regional Network"
            cand = [x for x in same_city if x != sid]
            best=None
            if cand: best = pick_best_neighbor(sid, sites_by_id, cand, tier_try, avoid_set=set())
            if not best:
                others = [x for x in site_ids if x != sid]
                for tier_try2 in ("Regional Network","Core Backbone"):
                    best = pick_best_neighbor(sid, sites_by_id, others, tier_try2, avoid_set=set())
                    if best: tier_try = tier_try2; break
            if best:
                _, bid, _ = best
                if add_link(sid, bid, tier_try): deg += 1
            else:
                others = [x for x in site_ids if x != sid]
                if others and add_link(sid, random.choice(others), "Regional Network"):
                    deg += 1
            attempts += 1

    logger.info(f"🔧 Healing added {len(new_links)} links for degree/connectivity")
    return new_links

def connect_components(sites, links, super_hubs_by_region):
    sites_by_id = {s["site_id"]: s for s in sites}
    adj = build_adjacency(links, sites_by_id)
    site_ids = [s["site_id"] for s in sites]
    comps = connected_components(adj, site_ids)
    if len(comps) <= 1: return []

    def pick_rep(comp):
        pref=("Core Backbone","Regional Network","Metro Network","Data Center")
        csites=[sites_by_id[x] for x in comp]
        for p in pref:
            m=[s for s in csites if s["network"]==p]
            if m: return m[0]["site_id"]
        return csites[0]["site_id"]

    reps=[pick_rep(c) for c in comps]; bridges=[]
    for i in range(len(reps)-1):
        a=reps[i]; b=reps[i+1]; A=sites_by_id[a]; B=sites_by_id[b]
        d=haversine_km(A["latitude"],A["longitude"],B["latitude"],B["longitude"])
        tier="Regional Network" if d<1200 else "Core Backbone"
        dist,wkt = make_routed_geometry(tier, A, B, sites, super_hubs_by_region)
        if dist<0: continue
        bridges.append({"site_a_id":a,"site_b_id":b,"link_type":tier,
                        "link_distance":dist,"link_kmz_no":"0",
                        "link_wkt":wkt,"last_modified_at":ts(),"is_deleted":0})
    logger.info(f"🧵 Component connect added {len(bridges)} bridge links (components={len(comps)})")
    return bridges

# -------------------- Main --------------------
def main(
    sites_per_city: int = DEFAULT_SITES_PER_CITY,
    hot_city_multiplier: int = HOT_CITY_MULTIPLIER,
    processes: int = max(2, mp.cpu_count()-1),
    enforce_policy: bool = True
):
    logger.info("🚀 Generating realistic sites & links (v4, structured)")
    logger.info(f"⚙️ processes={processes}, sites_per_city={sites_per_city}, hot_multiplier={hot_city_multiplier}, policy={enforce_policy}")
    sites = build_sites(sites_per_city, hot_city_multiplier)

    # Super-hub hierarchy by region (drives long-haul routing)
    super_hubs_by_region = pick_super_hubs(sites, per_region=4)
    logger.info(f"🏛️ Super-hubs selected: {dict(super_hubs_by_region)}")

    # Pre-build metro ring candidates for cleaner metro layer
    metro_pairs = build_metro_links(sites, k_neighbors=4)

    # Spec: (budget, min_km, max_km, jitter_km, pts_per_1000, forbid_same_city)
    tier_spec: Dict[str, tuple] = {
        "Core Backbone":            (LINK_BUDGET["Core Backbone"],            *TIER_RANGES["Core Backbone"],            15, 6, True),
        "International Gateway":    (LINK_BUDGET["International Gateway"],    *TIER_RANGES["International Gateway"],    20, 6, True),
        "Regional Network":         (LINK_BUDGET["Regional Network"],         *TIER_RANGES["Regional Network"],          8, 6, True),
        "Metro Network":            (LINK_BUDGET["Metro Network"],            *TIER_RANGES["Metro Network"],             2, 4, False),
        "Access Network":           (LINK_BUDGET["Access Network"],           *TIER_RANGES["Access Network"],          0.8, 3, False),
        "Data Center Interconnect": (LINK_BUDGET["Data Center Interconnect"], *TIER_RANGES["Data Center Interconnect"], 0.4, 3, False),
        "INTERCONNECT":             (LINK_BUDGET["INTERCONNECT"],             *TIER_RANGES["INTERCONNECT"],              6, 4, True),
        "PATCH":                    (LINK_BUDGET["PATCH"],                    *TIER_RANGES["PATCH"],                   0.3, 3, False),
    }

    # Launch tier generation in parallel
    work=[]; seed_base=42
    for tier,(budget,min_km,max_km,jitter_km,pts_per_1000,forbid_same_city) in tier_spec.items():
        if budget>0:
            work.append((tier,int(budget),float(min_km),float(max_km),
                         float(jitter_km),int(pts_per_1000),
                         sites, seed_base, bool(forbid_same_city), bool(enforce_policy),
                         super_hubs_by_region))

    links=[]
    if work:
        with mp.Pool(processes=processes) as pool:
            results = pool.map(gen_links_for_tier, work)
        for lst in results: links.extend(lst)

    # Add metro ring edges first (as Metro Network) but respect ranges/caps
    deg_by_tier = defaultdict(dict); pair_counts={}; sector_counts={}
    add_count=0
    for i,j in metro_pairs:
        if add_count >= int(LINK_BUDGET["Metro Network"] * 0.3): break  # allocate ~30% to clean rings
        A=sites[i]; B=sites[j]
        if not ok_by_caps("Metro Network", A, B, deg_by_tier, pair_counts, sector_counts): continue
        dist,wkt = make_routed_geometry("Metro Network", A, B, sites, super_hubs_by_region)
        if dist<0: continue
        bump_caps("Metro Network", A, B, deg_by_tier, pair_counts, sector_counts)
        links.append({"link_id": f"MetroSeed__TMP_{add_count+1:06d}",
                      "site_a_id":A["site_id"],"site_b_id":B["site_id"],
                      "link_type":"Metro Network","link_distance":dist,
                      "link_kmz_no":"0","link_wkt":wkt,
                      "last_modified_at":ts(),"is_deleted":0})
        add_count+=1
    if add_count: logger.info(f"🏙️ Seeded {add_count} metro ring links")

    # Assign clean sequential IDs
    for idx,L in enumerate(links, start=1): L["link_id"]=f"LINK_{idx:06d}"

    # Healing and component connectivity
    healed = heal_isolated_and_low_degree(sites, links, min_degree=1, important_min_degree=2, super_hubs_by_region=super_hubs_by_region)
    links.extend(healed)
    bridges = connect_components(sites, links, super_hubs_by_region)
    links.extend(bridges)

    # Re-ID after additions
    for idx,L in enumerate(links, start=1): L["link_id"]=f"LINK_{idx:06d}"

    logger.info(f"📈 Final totals: sites={len(sites)} links={len(links)} (target {TOTAL_LINKS})")
    with open(os.path.join(OUTPUT_DIR,'sites.json'),'w') as f: json.dump(sites, f, indent=2)
    with open(os.path.join(OUTPUT_DIR,'links.json'),'w') as f: json.dump(links, f, indent=2)
    logger.info(f"💾 Wrote {OUTPUT_DIR}/sites.json and {OUTPUT_DIR}/links.json")
    logger.info("🎉 Generation complete")

if __name__ == "__main__":
    try:
        main(
            sites_per_city=DEFAULT_SITES_PER_CITY,
            hot_city_multiplier=HOT_CITY_MULTIPLIER,
            processes=max(2, mp.cpu_count()-1),
            enforce_policy=True
        )
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        raise
