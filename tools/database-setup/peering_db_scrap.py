#!/usr/bin/env python3
import os, json, math, time, random, argparse, logging
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

import requests

try:
    from shapely.geometry import LineString, Point, shape
    from fastkml import kml as fastkml
    HAVE_KML = True
except Exception:
    HAVE_KML = False

random.seed(42)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("open-isp-pipeline")

PDB_API = "https://www.peeringdb.com/api"

OUTPUT_DIR = "dataV2PeeringDB"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Tiers and ranges (km)
TIER_RANGES = {
    "Core Backbone": (500, 6000),
    "Regional Network": (80, 1500),
    "Metro Network": (5, 80),
    "Access Network": (1, 15),
    "Data Center Interconnect": (0.5, 10),
    "International Gateway": (800, 12000),
    "INTERCONNECT": (1, 30),  # facility <-> IXP in metro
    "PATCH": (0.05, 1.0),
}

# Caps to avoid starbursts
DEGREE_CAPS = {
    "Core Backbone": 6,
    "International Gateway": 3,
    "INTERCONNECT": 6,
    "Regional Network": 8,
    "Metro Network": 12,
    "Data Center Interconnect": 16,
    "Access Network": 20,
}

PAIR_CAPS = {
    "Core Backbone": 2,
    "International Gateway": 2,
    "INTERCONNECT": 6,
    "Regional Network": 4,
    "Metro Network": 6,
    "Data Center Interconnect": 10,
}

SECTOR_DEG = 30
SECTOR_CAPS = {
    "Core Backbone": 2,
    "International Gateway": 2,
    "Regional Network": 3,
}

# Simple platform list
PLATFORMS = [
    "Cisco ASR9000","Cisco ASR1000","Cisco NCS5500","Cisco 8000",
    "Juniper MX480","Juniper MX960","Juniper MX2020","Juniper ACX7100",
    "Nokia 7750-SR","Nokia 7250-IXR","Nokia 7210-SAS",
    "Arista 7280R","Arista 7500R","HPE FlexNetwork"
]

def ts() -> str:
    import datetime
    return datetime.datetime.utcnow().isoformat()

def haversine_km(a_lat, a_lon, b_lat, b_lon) -> float:
    R = 6371.0088
    dlat = math.radians(b_lat - a_lat)
    dlon = math.radians(b_lon - a_lon)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def jitter_latlon(lat: float, lon: float, km: float=1.0) -> Tuple[float,float]:
    dlat = (km/111.0) * (random.random()-0.5) * 2
    dlon = (km/(111.0*max(0.2, math.cos(math.radians(lat))))) * (random.random()-0.5) * 2
    return lat + dlat, lon + dlon

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
    clean=[]
    last=None
    for lat,lon in coords:
        if last and abs(lat-last[0])<1e-8 and abs(lon-last[1])<1e-8:
            continue
        clean.append((lat,lon))
        last=(lat,lon)
    if len(clean) < 2:
        clean = clean*2
    return "LINESTRING(" + ", ".join([f"{lon} {lat}" for lat,lon in clean]) + ")"

def per_tier_segment_params(tier: str) -> Tuple[int,float]:
    if tier in ("Core Backbone","International Gateway"):
        return 8, 1.8
    if tier == "Regional Network":
        return 5, 1.2
    if tier in ("Metro Network","Access Network"):
        return 3, 0.5
    if tier == "Data Center Interconnect":
        return 2, 0.3
    return 3, 1.0

def make_geometry(tier: str, A: Dict[str,Any], B: Dict[str,Any]) -> Tuple[float,str]:
    d = haversine_km(A["latitude"],A["longitude"],B["latitude"],B["longitude"])
    dmin, dmax = TIER_RANGES.get(tier,(1,1e5))
    if not (dmin <= d <= dmax*1.25):
        return -1.0, ""
    n_mid, jitter = per_tier_segment_params(tier)
    mids = interpolate_points(A["latitude"],A["longitude"],B["latitude"],B["longitude"], n_mid, jitter)
    coords = [(A["latitude"],A["longitude"]), *mids, (B["latitude"],B["longitude"])]
    return round(d,1), linestring_wkt(coords)

def bearing_deg(a: Dict[str,Any], b: Dict[str,Any]) -> float:
    dy=b["latitude"]-a["latitude"]; dx=b["longitude"]-a["longitude"]
    return (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0

def ok_by_caps(tier: str, A: Dict[str,Any], B: Dict[str,Any],
               deg: Dict[str,int], pair_counts: Dict[Tuple[str,str,str], int],
               sector_counts: Dict[Tuple[str,str,int], int]) -> bool:
    if deg.get(A["site_id"],0) >= DEGREE_CAPS.get(tier, 1e9): return False
    if deg.get(B["site_id"],0) >= DEGREE_CAPS.get(tier, 1e9): return False
    key = (tier, A["city"], B["city"]) if A["city"] <= B["city"] else (tier, B["city"], A["city"])
    if pair_counts.get(key,0) >= PAIR_CAPS.get(tier, 1e9): return False
    if tier in SECTOR_CAPS:
        secA = int(bearing_deg(A,B) // SECTOR_DEG)
        secB = int(bearing_deg(B,A) // SECTOR_DEG)
        if sector_counts.get((tier, A["site_id"], secA),0) >= SECTOR_CAPS[tier]: return False
        if sector_counts.get((tier, B["site_id"], secB),0) >= SECTOR_CAPS[tier]: return False
    return True

def bump_caps(tier: str, A: Dict[str,Any], B: Dict[str,Any],
              deg: Dict[str,int], pair_counts: Dict[Tuple[str,str,str], int],
              sector_counts: Dict[Tuple[str,str,int], int]):
    deg[A["site_id"]] = deg.get(A["site_id"],0) + 1
    deg[B["site_id"]] = deg.get(B["site_id"],0) + 1
    key = (tier, A["city"], B["city"]) if A["city"] <= B["city"] else (tier, B["city"], A["city"])
    pair_counts[key] = pair_counts.get(key,0) + 1
    if tier in SECTOR_CAPS:
        secA = int(bearing_deg(A,B) // SECTOR_DEG)
        secB = int(bearing_deg(B,A) // SECTOR_DEG)
        sector_counts[(tier, A["site_id"], secA)] = sector_counts.get((tier, A["site_id"], secA),0) + 1
        sector_counts[(tier, B["site_id"], secB)] = sector_counts.get((tier, B["site_id"], secB),0) + 1

# PeeringDB fetch helpers
def pdb_get(endpoint: str, params=None, limit=1000) -> List[Dict[str,Any]]:
    params = params or {}
    params.setdefault("limit", limit)
    url = f"{PDB_API}/{endpoint}"
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data.get("data", [])

def fetch_peeringdb(max_fac: int, max_ixp: int) -> Tuple[List[Dict[str,Any]], List[Dict[str,Any]], List[Dict[str,Any]]]:
    log.info("Fetching PeeringDB facilities...")
    fac = pdb_get("fac", {"fields": "id,name,city,country,latitude,longitude"} , limit=max_fac)
    fac = [f for f in fac if f.get("latitude") and f.get("longitude")]
    log.info(f"Facilities: {len(fac)}")

    log.info("Fetching PeeringDB IXPs...")
    ixp = pdb_get("ix", {"fields": "id,name,city,country,latitude,longitude"}, limit=max_ixp)
    ixp = [x for x in ixp if x.get("latitude") and x.get("longitude")]
    log.info(f"IXPs: {len(ixp)}")

    log.info("Fetching PeeringDB networks (light)...")
    net = pdb_get("net", {"fields":"id,asn,name,info_prefixes,info_type"}, limit=2000)
    log.info(f"Networks: {len(net)}")

    return fac, ixp, net

def build_sites_from_pdb(fac, ixp) -> List[Dict[str,Any]]:
    sites=[]; sid=1
    # Facilities -> Data Center
    for f in fac:
        sites.append({
            "site_id": f"SITE_{sid:06d}",
            "site_virtual_name": f'FAC-{f.get("id","")}',
            "site_name": str(f.get("name",""))[:60],
            "country": str(f.get("country","")),
            "city": str(f.get("city","")),
            "platform": random.choice(PLATFORMS),
            "network": "Data Center",
            "latitude": float(f["latitude"]),
            "longitude": float(f["longitude"]),
            "last_modified_at": ts(),
            "is_deleted": 0
        }); sid+=1
    # IXPs -> IXP/Peering
    for x in ixp:
        sites.append({
            "site_id": f"SITE_{sid:06d}",
            "site_virtual_name": f'IXP-{x.get("id","")}',
            "site_name": str(x.get("name",""))[:60],
            "country": str(x.get("country","")),
            "city": str(x.get("city","")),
            "platform": random.choice(PLATFORMS),
            "network": "IXP/Peering",
            "latitude": float(x["latitude"]),
            "longitude": float(x["longitude"]),
            "last_modified_at": ts(),
            "is_deleted": 0
        }); sid+=1
    log.info(f"Sites built from PeeringDB: {len(sites)}")
    return sites

def index_by_city(sites: List[Dict[str,Any]]) -> Dict[Tuple[str,str], List[Dict[str,Any]]]:
    idx=defaultdict(list)
    for s in sites:
        idx[(s["country"], s["city"])].append(s)
    return idx

def build_links(sites: List[Dict[str,Any]], telegeo_cables: Optional[List[LineString]]=None) -> List[Dict[str,Any]]:
    links=[]
    sites_by_id = {s["site_id"]: s for s in sites}
    by_city = index_by_city(sites)

    # Degree and cap bookkeeping
    deg = defaultdict(int)
    pair_counts = {}
    sector_counts = {}

    def try_add(a: Dict[str,Any], b: Dict[str,Any], tier: str):
        if a["site_id"] == b["site_id"]: return
        if not ok_by_caps(tier, a, b, deg, pair_counts, sector_counts): return
        dist, wkt = make_geometry(tier, a, b)
        if dist < 0: return
        L = {
            "site_a_id": a["site_id"], "site_b_id": b["site_id"],
            "link_type": tier, "link_distance": dist,
            "link_kmz_no": "0", "link_wkt": wkt,
            "last_modified_at": ts(), "is_deleted": 0
        }
        links.append(L)
        bump_caps(tier, a, b, deg, pair_counts, sector_counts)

    # 1) Interconnect: facility <-> IXP in same city
    for (country, city), lst in by_city.items():
        facs=[s for s in lst if s["network"]=="Data Center"]
        ixps=[s for s in lst if s["network"]=="IXP/Peering"]
        for f in facs:
            for x in ixps:
                try_add(f, x, "INTERCONNECT")

    # 2) DCI: between facilities in same metro
    for (country, city), lst in by_city.items():
        facs=[s for s in lst if s["network"]=="Data Center"]
        facs_sorted = sorted(facs, key=lambda s:(s["latitude"],s["longitude"]))
        for i in range(len(facs_sorted)-1):
            try_add(facs_sorted[i], facs_sorted[i+1], "Data Center Interconnect")

    # 3) Regional: between nearby metros (use IXP as representative when present)
    city_reps=[]
    for (country, city), lst in by_city.items():
        # prefer an IXP as rep, else any DC
        rep = next((s for s in lst if s["network"]=="IXP/Peering"), None)
        if not rep:
            rep = next((s for s in lst if s["network"]=="Data Center"), None)
        if rep:
            city_reps.append(rep)
    # connect nearest neighbors up to cap
    for a in city_reps:
        # find ~8 nearest different-city reps
        dists=[]
        for b in city_reps:
            if b["city"]==a["city"] and b["country"]==a["country"]: continue
            d=haversine_km(a["latitude"],a["longitude"],b["latitude"],b["longitude"])
            dists.append((d,b))
        dists.sort(key=lambda x:x[0])
        for _, b in dists[:6]:
            try_add(a,b,"Regional Network")

    # 4) Core: sparse connections among top-IXP metros
    top_ixp_cities = sorted(
        [(k, sum(1 for s in v if s["network"]=="IXP/Peering")) for k,v in by_city.items()],
        key=lambda x: -x[1]
    )[:20]
    core_nodes=[]
    for (country, city), _ in top_ixp_cities:
        rep = next((s for s in by_city[(country,city)] if s["network"]=="IXP/Peering"), None)
        if rep:
            core_nodes.append(rep)
    # connect each core node to 3 nearest other core nodes
    for a in core_nodes:
        dists=[]
        for b in core_nodes:
            if b is a: continue
            d=haversine_km(a["latitude"],a["longitude"],b["latitude"],b["longitude"])
            dists.append((d,b))
        dists.sort(key=lambda x:x[0])
        for _, b in dists[:3]:
            try_add(a,b,"Core Backbone")

    # 5) International: use TeleGeography cable landings if provided (approximate)
    if HAVE_KML and telegeo_cables:
        # Build a set of coastal reps (IXP or DC) within X km of any cable line endpoint
        coast = []
        for s in city_reps:
            p = Point(s["longitude"], s["latitude"])
            close = False
            for line in telegeo_cables:
                if line.distance(p) < 0.6: # ~60km at deg scale; rough
                    close = True; break
            if close:
                coast.append(s)
        # connect coastal reps across continents (nearest 2)
        for a in coast:
            dists=[]
            for b in coast:
                if b is a: continue
                if a["country"] == b["country"]: continue
                d = haversine_km(a["latitude"],a["longitude"],b["latitude"],b["longitude"])
                dists.append((d,b))
            dists.sort(key=lambda x:x[0])
            for _, b in dists[:2]:
                try_add(a,b,"International Gateway")
    else:
        # fallback: connect top core nodes across >1500km
        for a in core_nodes:
            for b in core_nodes:
                if b is a: continue
                d=haversine_km(a["latitude"],a["longitude"],b["latitude"],b["longitude"])
                if d > 2000 and d < 9000:
                    try_add(a,b,"International Gateway")

    log.info(f"Links generated: {len(links)}")
    # Assign IDs
    for i,L in enumerate(links, start=1):
        L["link_id"] = f"LINK_{i:06d}"
    return links

def load_telegeo_kml(kml_path: str) -> List[LineString]:
    if not HAVE_KML:
        log.warning("KML libraries not available; skipping TeleGeography import")
        return []
    if not kml_path or not os.path.exists(kml_path):
        log.warning("KML path not found; skipping")
        return []
    with open(kml_path, "rb") as f:
        content = f.read()
    k = fastkml.KML()
    k.from_string(content)
    lines=[]
    def walk(feat):
        for f in feat.features():
            geom = getattr(f, "geometry", None)
            if geom is not None:
                try:
                    shp = shape(geom)
                    if hasattr(shp, "geom_type") and shp.geom_type in ("LineString","MultiLineString"):
                        if shp.geom_type == "LineString":
                            lines.append(LineString(list(shp.coords)))
                        else:
                            for part in shp.geoms:
                                lines.append(LineString(list(part.coords)))
                except Exception:
                    pass
            if hasattr(f, "features"):
                walk(f)
    for feat in k.features():
        walk(feat)
    log.info(f"Loaded {len(lines)} cable line geometries from KML")
    return lines

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-fac", type=int, default=3000)
    ap.add_argument("--max-ixp", type=int, default=800)
    ap.add_argument("--telegeo_kml", type=str, default="")
    args = ap.parse_args()

    fac, ixp, net = fetch_peeringdb(args.max_fac, args.max_ixp)
    sites = build_sites_from_pdb(fac, ixp)
    telegeo = load_telegeo_kml(args.telegeo_kml) if args.telegeo_kml else []
    links = build_links(sites, telegeo)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(OUTPUT_DIR,"sites.json"),"w") as f:
        json.dump(sites, f, indent=2)
    with open(os.path.join(OUTPUT_DIR,"links.json"),"w") as f:
        json.dump(links, f, indent=2)
    log.info("Wrote data/sites.json and data/links.json")

if __name__ == "__main__":
    main()

# this is as per our sqlite3 schema