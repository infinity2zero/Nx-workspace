#!/usr/bin/env python3
import sqlite3
import json
import os
import time
import logging

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler("data_loading.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

DB_REL_PATH = "../../db/network.sqlite"
# SITES_JSON = "dataV2PeeringDB/sites.json"
# LINKS_JSON = "dataV2PeeringDB/links.json"

SITES_JSON = "data/sites.json"
LINKS_JSON = "data/links.json"

# ---------- Schema helpers ----------

def create_sites_table(cur):
    cur.execute("""
        CREATE TABLE sites (
            site_id           TEXT PRIMARY KEY,
            site_virtual_name TEXT,
            site_name         TEXT NOT NULL,
            country           TEXT,
            city              TEXT,
            platform          TEXT,
            network           TEXT,
            last_modified_at  TEXT NOT NULL,
            is_deleted        INTEGER NOT NULL DEFAULT 0
        );
    """)
    cur.execute("SELECT AddGeometryColumn('sites', 'geometry', 4326, 'POINT', 'XY');")

def create_links_table(cur):
    cur.execute("""
        CREATE TABLE links (
            link_id           TEXT PRIMARY KEY,
            site_a_id         TEXT NOT NULL,
            site_b_id         TEXT NOT NULL,
            link_type         TEXT,
            link_distance     REAL,
            link_kmz_no       TEXT,
            last_modified_at  TEXT NOT NULL,
            is_deleted        INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (site_a_id) REFERENCES sites(site_id),
            FOREIGN KEY (site_b_id) REFERENCES sites(site_id)
        );
    """)
    cur.execute("SELECT AddGeometryColumn('links', 'geometry', 4326, 'LINESTRING', 'XY');")

def create_performance_indexes(cur):
    logger.info("🚀 Creating performance indexes...")
    try:
        # Sites
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_country ON sites(country);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_city ON sites(country, city);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_network ON sites(network);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_platform ON sites(platform);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_deleted ON sites(is_deleted);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_modified ON sites(last_modified_at);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sites_country_network ON sites(country, network);")

        # Links
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_site_a ON links(site_a_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_site_b ON links(site_b_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_type ON links(link_type);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_distance ON links(link_distance);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_deleted ON links(is_deleted);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_modified ON links(last_modified_at);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_type_distance ON links(link_type, link_distance);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_links_sites ON links(site_a_id, site_b_id);")
        logger.info("✅ Performance indexes created")
    except sqlite3.OperationalError as e:
        logger.info(f"ℹ️ Index creation note: {e}")

# ---------- Loader ----------

def load_data_to_sqlite():
    start_ts = time.time()
    db_path = os.path.abspath(DB_REL_PATH)

    if not os.path.exists(db_path):
        logger.error(f"❌ Database not found at: {db_path}")
        return False

    logger.info(f"✅ Database: {db_path} ({os.path.getsize(db_path)/1024/1024:.2f} MB)")

    if not os.path.exists(SITES_JSON) or not os.path.exists(LINKS_JSON):
        logger.error("❌ Missing data JSON files (data/sites.json, data/links.json)")
        return False

    logger.info(f"📂 Sites JSON: {SITES_JSON} ({os.path.getsize(SITES_JSON)/1024/1024:.2f} MB)")
    logger.info(f"📂 Links JSON: {LINKS_JSON} ({os.path.getsize(LINKS_JSON)/1024/1024:.2f} MB)")

    with open(SITES_JSON, "r") as f:
        sites = json.load(f)
    with open(LINKS_JSON, "r") as f:
        links = json.load(f)
    logger.info(f"✅ Loaded {len(sites)} sites; {len(links)} links from JSON")

    # Connect and tune PRAGMAs for bulk load
    conn = sqlite3.connect(db_path)
    conn.enable_load_extension(True)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = OFF;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA cache_size = -200000;")  # ~200MB (tune as needed)

    cur = conn.cursor()

    # Load SpatiaLite
    logger.info("📡 Loading SpatiaLite extension...")
    loaded_spatialite = False
    for name in ("mod_spatialite", "mod_spatialite.so", "mod_spatialite.dylib", "mod_spatialite.dll"):
        try:
            conn.load_extension(name)
            loaded_spatialite = True
            logger.info(f"✅ SpatiaLite loaded ({name})")
            break
        except sqlite3.OperationalError:
            continue
    if not loaded_spatialite:
        logger.error("❌ Could not load SpatiaLite extension (mod_spatialite).")
        conn.close()
        return False

    # Spatial metadata
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='spatial_ref_sys';")
    if not cur.fetchone():
        logger.info("📍 Initializing spatial metadata...")
        cur.execute("SELECT InitSpatialMetaData(1);")
        logger.info("✅ Spatial metadata initialized")

    # Ensure schema
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sites';")
    have_sites = cur.fetchone()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='links';")
    have_links = cur.fetchone()

    if not have_sites:
        logger.info("🏗️ Creating sites table...")
        create_sites_table(cur)
        logger.info("✅ Sites table created")
    else:
        cur.execute("SELECT COUNT(*) FROM sites;")
        logger.info(f"📊 Current sites: {cur.fetchone()[0]}")

    if not have_links:
        logger.info("🏗️ Creating links table...")
        create_links_table(cur)
        logger.info("✅ Links table created")
    else:
        cur.execute("SELECT COUNT(*) FROM links;")
        logger.info(f"📊 Current links: {cur.fetchone()[0]}")

    # Clear existing data (in single transaction)
    logger.info("🗑️ Clearing existing data (sites, links)...")
    conn.execute("BEGIN;")
    cur.execute("DELETE FROM links;")
    cur.execute("DELETE FROM sites;")
    conn.commit()

    # Insert sites
    logger.info("📍 Inserting sites...")
    t0 = time.time()
    conn.execute("BEGIN;")
    sites_sql = """
    INSERT OR REPLACE INTO sites (
        site_id, site_virtual_name, site_name, country, city,
        platform, network, last_modified_at, is_deleted, geometry
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, MakePoint(?, ?, 4326))
    """
    for i, s in enumerate(sites):
        cur.execute(sites_sql, (
            s["site_id"], s["site_virtual_name"], s["site_name"],
            s["country"], s["city"], s["platform"], s["network"],
            s["last_modified_at"], s["is_deleted"],
            s["longitude"], s["latitude"]
        ))
        if (i+1) % 5000 == 0:
            logger.info(f"   📍 {i+1}/{len(sites)}")
    conn.commit()
    dt = time.time() - t0
    logger.info(f"✅ Sites inserted: {len(sites)} in {dt:.2f}s ({len(sites)/max(dt,1):.1f}/s)")

    # Insert links
    logger.info("🔗 Inserting links...")
    t0 = time.time()
    conn.execute("BEGIN;")
    links_sql = """
    INSERT OR REPLACE INTO links (
        link_id, site_a_id, site_b_id, link_type, link_distance,
        link_kmz_no, last_modified_at, is_deleted, geometry
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, GeomFromText(?, 4326))
    """
    type_counts = {}
    for i, l in enumerate(links):
        cur.execute(links_sql, (
            l["link_id"], l["site_a_id"], l["site_b_id"],
            l["link_type"], l["link_distance"], l["link_kmz_no"],
            l["last_modified_at"], l["is_deleted"],
            l["link_wkt"]
        ))
        type_counts[l["link_type"]] = type_counts.get(l["link_type"], 0) + 1
        if (i+1) % 5000 == 0:
            logger.info(f"   🔗 {i+1}/{len(links)}")
    conn.commit()
    dt = time.time() - t0
    logger.info(f"✅ Links inserted: {len(links)} in {dt:.2f}s ({len(links)/max(dt,1):.1f}/s)")

    # Spatial indexes (after bulk load)
    logger.info("🗂️ Creating spatial indexes...")
    try:
        cur.execute("SELECT CreateSpatialIndex('sites', 'geometry');")
        logger.info("✅ Sites spatial index created")
    except sqlite3.OperationalError as e:
        logger.info(f"ℹ️ Sites spatial index: {e}")

    try:
        cur.execute("SELECT CreateSpatialIndex('links', 'geometry');")
        logger.info("✅ Links spatial index created")
    except sqlite3.OperationalError as e:
        logger.info(f"ℹ️ Links spatial index: {e}")

    # Perf indexes
    create_performance_indexes(cur)
    conn.commit()

    # Verify counts
    cur.execute("SELECT COUNT(*) FROM sites;")
    final_sites = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM links;")
    final_links = cur.fetchone()[0]

    # Orphan check
    cur.execute("""
        SELECT COUNT(*) FROM links
        WHERE site_a_id NOT IN (SELECT site_id FROM sites)
           OR site_b_id NOT IN (SELECT site_id FROM sites)
    """)
    orphans = cur.fetchone()[0]

    # Optional: validate geometry types
    cur.execute("SELECT COUNT(*) FROM links WHERE GeometryType(geometry) <> 'LINESTRING';")
    non_lines = cur.fetchone()[0]

    # Optional: ANALYZE (skip VACUUM unless you want compact file)
    try:
        conn.execute("ANALYZE;")
    except Exception:
        pass

    conn.close()

    dur = time.time() - start_ts
    logger.info("🎉 Data loading completed successfully!")
    logger.info("📊 Final stats:")
    logger.info(f"   Sites: {final_sites}")
    logger.info(f"   Links: {final_links}")
    logger.info(f"   Orphaned links: {orphans}")
    logger.info(f"   Non-LINESTRING links: {non_lines}")
    logger.info(f"   DB size: {os.path.getsize(db_path)/1024/1024:.2f} MB")
    logger.info(f"⏱️  Total load time: {dur:.2f}s")

    if type_counts:
        logger.info("📈 Link type distribution (loaded):")
        for k, v in sorted(type_counts.items(), key=lambda x: -x[1]):
            logger.info(f"   {k}: {v}")

    return True

if __name__ == "__main__":
    try:
        ok = load_data_to_sqlite()
        if not ok:
            raise SystemExit(1)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        raise SystemExit(1)
