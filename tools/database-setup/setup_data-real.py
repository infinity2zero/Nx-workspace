#!/usr/bin/env python3
import subprocess
import sys
import os
import time
import logging
import sqlite3

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler("setup_database.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

DB_REL_PATH = "../../db/network.sqlite"
GEN_SCRIPT = "generate-realV3.py"  # rename to your generator_realistic.py if needed "generate-realV2.py"
LOAD_SCRIPT = "load-data-real.py"
SITES_JSON = "data/sites.json"
LINKS_JSON = "data/links.json"


def run_subprocess(cmd):
    logger.info("▶ " + " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.stdout:
        logger.info(res.stdout.strip())
    if res.returncode != 0:
        logger.error(res.stderr.strip())
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")
    return res


def verify_db(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM sites;")
        sites_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM links;")
        links_count = cur.fetchone()[0]

        logger.info("📊 Database contents:")
        logger.info(f"   Sites: {sites_count}")
        logger.info(f"   Links: {links_count}")

        logger.info("📋 Sample sites:")
        cur.execute("""
            SELECT site_id, site_name, country, city
            FROM sites
            ORDER BY RANDOM()
            LIMIT 3
        """)
        for site_id, site_name, country, city in cur.fetchall():
            logger.info(f"   {site_id}: {site_name} ({country}, {city})")

        logger.info("📋 Sample links:")
        cur.execute("""
            SELECT l.link_id, l.link_type, l.link_distance,
                   sa.site_name AS site_a, sb.site_name AS site_b
            FROM links l
            JOIN sites sa ON sa.site_id = l.site_a_id
            JOIN sites sb ON sb.site_id = l.site_b_id
            ORDER BY RANDOM()
            LIMIT 3
        """)
        for lid, ltype, dist, sa, sb in cur.fetchall():
            logger.info(f"   {lid}: {ltype} ({dist} km) - {sa} -> {sb}")

        logger.info("📊 Link type distribution:")
        cur.execute("""
            SELECT link_type, COUNT(*)
            FROM links
            GROUP BY link_type
            ORDER BY COUNT(*) DESC
        """)
        for ltype, cnt in cur.fetchall():
            logger.info(f"   {ltype}: {cnt} links")

        final_db_size = os.path.getsize(db_path) / 1024 / 1024
        logger.info(f"💾 Final database size: {final_db_size:.2f} MB")

        conn.close()
    except Exception as e:
        logger.warning(f"⚠️ Verification skipped/failed: {e}")


def main():
    start_ts = time.time()
    logger.info("🚀 Starting ISP Network Database Setup")
    logger.info("=" * 60)
    logger.info(f"🐍 Python: {sys.version.splitlines()[0]}")
    logger.info(f"📁 CWD: {os.getcwd()}")

    db_path = os.path.abspath(DB_REL_PATH)
    if os.path.exists(db_path):
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        logger.info(f"✅ Found existing database: {db_path} ({size_mb:.2f} MB)")
    else:
        logger.error(f"❌ Database not found at: {db_path}")
        logger.error("Ensure the database exists at ../../db/network.sqlite")
        return 1

    # 1) Generate data
    logger.info("=" * 60)
    logger.info("1️⃣ GENERATING DATA")
    logger.info("=" * 60)
    gen_start = time.time()
    try:
        run_subprocess([sys.executable, GEN_SCRIPT])
    except Exception as e:
        logger.error(f"❌ Data generation failed: {e}")
        return 1
    gen_dur = time.time() - gen_start
    logger.info(f"✅ Data generation completed in {gen_dur:.2f}s")

    if not os.path.exists(SITES_JSON) or not os.path.exists(LINKS_JSON):
        logger.error("❌ Generated JSON files not found (data/sites.json, data/links.json).")
        return 1

    s_size = os.path.getsize(SITES_JSON) / (1024 * 1024)
    l_size = os.path.getsize(LINKS_JSON) / (1024 * 1024)
    logger.info("📂 Generated files:")
    logger.info(f"   Sites: {SITES_JSON} ({s_size:.2f} MB)")
    logger.info(f"   Links: {LINKS_JSON} ({l_size:.2f} MB)")

    # 2) Load into SQLite
    logger.info("=" * 60)
    logger.info("2️⃣ LOADING INTO SQLITE")
    logger.info("=" * 60)
    load_start = time.time()
    try:
        run_subprocess([sys.executable, LOAD_SCRIPT])
    except Exception as e:
        logger.error(f"❌ Data loading failed: {e}")
        return 1
    load_dur = time.time() - load_start
    logger.info(f"✅ Data loading completed in {load_dur:.2f}s")

    # 3) Verify
    logger.info("=" * 60)
    logger.info("3️⃣ FINAL VERIFICATION")
    logger.info("=" * 60)
    verify_db(db_path)

    total_dur = time.time() - start_ts
    logger.info("=" * 60)
    logger.info("🎉 DATABASE SETUP COMPLETED SUCCESSFULLY")
    logger.info("=" * 60)
    logger.info("📊 Summary:")
    logger.info(f"   Data generation: {gen_dur:.2f}s")
    logger.info(f"   Data loading:    {load_dur:.2f}s")
    logger.info(f"   Total:           {total_dur:.2f}s")
    logger.info(f"📍 DB: {db_path}")
    logger.info("📝 Logs: setup_database.log, data_generation.log, data_loading.log")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        logger.warning("⚠️ Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"❌ Fatal: {e}", exc_info=True)
        sys.exit(1)
