import sqlite3
import json
import os
import time
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('data_loading.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def create_performance_indexes(cursor):
    """Create indexes for optimal query performance"""
    logger.info("🚀 Creating performance indexes...")
    
    try:
        # Sites table indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_country ON sites(country);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_city ON sites(country, city);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_network ON sites(network);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_platform ON sites(platform);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_deleted ON sites(is_deleted);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_modified ON sites(last_modified_at);")
        
        # Links table indexes  
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_site_a ON links(site_a_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_site_b ON links(site_b_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_type ON links(link_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_distance ON links(link_distance);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_deleted ON links(is_deleted);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_modified ON links(last_modified_at);")
        
        # Composite indexes for common queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sites_country_network ON sites(country, network);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_type_distance ON links(link_type, link_distance);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_sites ON links(site_a_id, site_b_id);")
        
        logger.info("✅ Performance indexes created successfully")
        
    except sqlite3.OperationalError as e:
        logger.warning(f"⚠️  Index creation: {e}")

def load_data_to_sqlite():
    load_start_time = time.time()
    logger.info("🚀 Starting database loading process")
    
    # Database path
    db_path = '../../db/network.sqlite'
    db_abs_path = os.path.abspath(db_path)
    
    # Verify database exists
    if not os.path.exists(db_path):
        logger.error(f"❌ Database not found at: {db_abs_path}")
        logger.error("Please make sure your database exists at db/network.sqlite")
        return False
    
    logger.info(f"✅ Found database: {db_abs_path}")
    logger.info(f"📊 Database size: {os.path.getsize(db_path)/1024/1024:.2f} MB")
    
    # Connect to database
    logger.info("🔌 Connecting to database...")
    conn = sqlite3.connect(db_path)
    conn.enable_load_extension(True)
    
    # Load SpatiaLite extension
    logger.info("📡 Loading SpatiaLite extension...")
    try:
        conn.load_extension('mod_spatialite')
        logger.info("✅ SpatiaLite extension loaded (mod_spatialite)")
    except sqlite3.OperationalError:
        try:
            conn.load_extension('mod_spatialite.so')
            logger.info("✅ SpatiaLite extension loaded (mod_spatialite.so)")
        except sqlite3.OperationalError:
            logger.error("❌ Could not load SpatiaLite extension")
            return False
    
    cursor = conn.cursor()
    
    # Check spatial metadata
    logger.info("🗺️  Checking spatial metadata...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='spatial_ref_sys';")
    if not cursor.fetchone():
        logger.info("📍 Initializing spatial metadata...")
        cursor.execute("SELECT InitSpatialMetaData(1);")
        logger.info("✅ Spatial metadata initialized")
    else:
        logger.info("✅ Spatial metadata already exists")
    
    # Check and create tables
    logger.info("📋 Checking database schema...")
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sites';")
    sites_exists = cursor.fetchone()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='links';")
    links_exists = cursor.fetchone()
    
    if not sites_exists:
        logger.info("🏗️  Creating sites table...")
        create_sites_table(cursor)
        logger.info("✅ Sites table created")
    else:
        logger.info("✅ Sites table already exists")
        # Get current count
        cursor.execute("SELECT COUNT(*) FROM sites;")
        current_sites = cursor.fetchone()[0]
        logger.info(f"📊 Current sites in database: {current_sites}")
    
    if not links_exists:
        logger.info("🏗️  Creating links table...")
        create_links_table(cursor)
        logger.info("✅ Links table created")
    else:
        logger.info("✅ Links table already exists")
        # Get current count
        cursor.execute("SELECT COUNT(*) FROM links;")
        current_links = cursor.fetchone()[0]
        logger.info(f"📊 Current links in database: {current_links}")
    
    # Load and validate JSON files
    logger.info("📂 Loading JSON data files...")
    
    sites_file = 'data/sites.json'
    links_file = 'data/links.json'
    
    if not os.path.exists(sites_file):
        logger.error(f"❌ Sites file not found: {sites_file}")
        return False
    
    if not os.path.exists(links_file):
        logger.error(f"❌ Links file not found: {links_file}")
        return False
    
    logger.info(f"📊 Sites file size: {os.path.getsize(sites_file)/1024/1024:.2f} MB")
    logger.info(f"📊 Links file size: {os.path.getsize(links_file)/1024/1024:.2f} MB")
    
    # Load sites data
    logger.info("📖 Reading sites JSON...")
    with open(sites_file, 'r') as f:
        sites_data = json.load(f)
    logger.info(f"✅ Loaded {len(sites_data)} sites from JSON")
    
    # Load links data
    logger.info("📖 Reading links JSON...")
    with open(links_file, 'r') as f:
        links_data = json.load(f)
    logger.info(f"✅ Loaded {len(links_data)} links from JSON")
    
    # Clear existing data
    logger.info("🗑️  Clearing existing data...")
    cursor.execute("DELETE FROM links;")
    deleted_links = cursor.rowcount
    cursor.execute("DELETE FROM sites;")
    deleted_sites = cursor.rowcount
    logger.info(f"🗑️  Deleted {deleted_sites} existing sites, {deleted_links} existing links")
    
    # Insert sites data
    sites_start = time.time()
    logger.info("📍 Inserting sites data...")
    
    sites_insert_sql = '''
    INSERT OR REPLACE INTO sites (
        site_id, site_virtual_name, site_name, country, city, 
        platform, network, last_modified_at, is_deleted, geometry
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, MakePoint(?, ?, 4326))
    '''
    
    sites_inserted = 0
    sites_batch_size = 100
    
    for i, site in enumerate(sites_data):
        try:
            cursor.execute(sites_insert_sql, (
                site['site_id'], site['site_virtual_name'], site['site_name'],
                site['country'], site['city'], site['platform'], site['network'],
                site['last_modified_at'], site['is_deleted'],
                site['longitude'], site['latitude']
            ))
            sites_inserted += 1
            
            if (i + 1) % sites_batch_size == 0:
                logger.info(f"   📍 Inserted {i + 1}/{len(sites_data)} sites ({(i+1)/len(sites_data)*100:.1f}%)")
                
        except Exception as e:
            logger.error(f"❌ Error inserting site {site.get('site_id', 'unknown')}: {e}")
    
    sites_duration = time.time() - sites_start
    logger.info(f"✅ Sites insertion completed: {sites_inserted}/{len(sites_data)} in {sites_duration:.2f}s ({sites_inserted/sites_duration:.1f}/sec)")
    
    # Insert links data
    links_start = time.time()
    logger.info("🔗 Inserting links data...")
    
    links_insert_sql = '''
    INSERT OR REPLACE INTO links (
        link_id, site_a_id, site_b_id, link_type, link_distance,
        link_kmz_no, last_modified_at, is_deleted, geometry
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, GeomFromText(?, 4326))
    '''
    
    links_inserted = 0
    links_batch_size = 50
    link_type_counts = {}
    
    for i, link in enumerate(links_data):
        try:
            cursor.execute(links_insert_sql, (
                link['link_id'], link['site_a_id'], link['site_b_id'],
                link['link_type'], link['link_distance'], link['link_kmz_no'],
                link['last_modified_at'], link['is_deleted'],
                link['link_wkt']
            ))
            links_inserted += 1
            
            # Track link types
            link_type = link['link_type']
            link_type_counts[link_type] = link_type_counts.get(link_type, 0) + 1
            
            if (i + 1) % links_batch_size == 0:
                logger.info(f"   🔗 Inserted {i + 1}/{len(links_data)} links ({(i+1)/len(links_data)*100:.1f}%)")
                
        except Exception as e:
            logger.error(f"❌ Error inserting link {link.get('link_id', 'unknown')}: {e}")
    
    links_duration = time.time() - links_start
    logger.info(f"✅ Links insertion completed: {links_inserted}/{len(links_data)} in {links_duration:.2f}s ({links_inserted/links_duration:.1f}/sec)")
    
    # Log link type distribution
    logger.info("📊 Link type distribution:")
    for link_type, count in link_type_counts.items():
        logger.info(f"   {link_type}: {count} links")
    
    # Create spatial indexes
    logger.info("🗂️  Creating spatial indexes...")
    try:
        cursor.execute("SELECT CreateSpatialIndex('sites', 'geometry');")
        logger.info("✅ Sites spatial index created")
    except sqlite3.OperationalError as e:
        logger.warning(f"⚠️  Sites spatial index: {e}")
    
    try:
        cursor.execute("SELECT CreateSpatialIndex('links', 'geometry');")
        logger.info("✅ Links spatial index created")
    except sqlite3.OperationalError as e:
        logger.warning(f"⚠️  Links spatial index: {e}")

    # NEW: Add performance indexes
    create_performance_indexes(cursor)
     
    # Commit changes
    logger.info("💾 Committing changes to database...")
    conn.commit()
    
    # Final verification
    logger.info("🔍 Verifying data integrity...")
    
    cursor.execute("SELECT COUNT(*) FROM sites;")
    final_sites_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM links;")
    final_links_count = cursor.fetchone()
    
    # Check for orphaned links
    cursor.execute("""
        SELECT COUNT(*) FROM links 
        WHERE site_a_id NOT IN (SELECT site_id FROM sites) 
           OR site_b_id NOT IN (SELECT site_id FROM sites)
    """)
    orphaned_links = cursor.fetchone()[0]
    
    conn.close()
    
    total_duration = time.time() - load_start_time
    
    logger.info("🎉 Database loading completed successfully!")
    logger.info("📊 Final Statistics:")
    logger.info(f"   Sites in database: {final_sites_count}")
    logger.info(f"   Links in database: {final_links_count}")
    logger.info(f"   Orphaned links: {orphaned_links}")
    logger.info(f"   Database size: {os.path.getsize(db_path)/1024/1024:.2f} MB")
    logger.info(f"⏱️  Total loading time: {total_duration:.2f} seconds")
    
    return True

def create_sites_table(cursor):
    cursor.execute('''
        CREATE TABLE sites (
            site_id             TEXT PRIMARY KEY,
            site_virtual_name   TEXT,
            site_name           TEXT NOT NULL,
            country             TEXT,
            city                TEXT,
            platform            TEXT,
            network             TEXT,
            last_modified_at    TEXT NOT NULL,
            is_deleted          INTEGER NOT NULL DEFAULT 0
        );
    ''')
    cursor.execute("SELECT AddGeometryColumn('sites', 'geometry', 4326, 'POINT', 'XY');")

def create_links_table(cursor):
    cursor.execute('''
        CREATE TABLE links (
            link_id         TEXT PRIMARY KEY,
            site_a_id       TEXT NOT NULL,
            site_b_id       TEXT NOT NULL,
            link_type       TEXT,
            link_distance   REAL,
            link_kmz_no     TEXT,
            last_modified_at TEXT NOT NULL,
            is_deleted      INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (site_a_id) REFERENCES sites(site_id),
            FOREIGN KEY (site_b_id) REFERENCES sites(site_id)
        );
    ''')
    cursor.execute("SELECT AddGeometryColumn('links', 'geometry', 4326, 'LINESTRING', 'XY');")

if __name__ == "__main__":
    try:
        success = load_data_to_sqlite()
        if not success:
            exit(1)
    except Exception as e:
        logger.error(f"❌ Fatal error during loading: {e}", exc_info=True)
        exit(1)
