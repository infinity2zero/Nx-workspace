import sqlite3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_all_indexes():
    db_path = '../../db/network.sqlite'
    
    if not os.path.exists(db_path):
        logger.error("Database not found!")
        return
    
    logger.info("🚀 Creating comprehensive indexes for ISP network database")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    indexes = [
        # Sites table indexes
        ("idx_sites_country", "CREATE INDEX IF NOT EXISTS idx_sites_country ON sites(country);"),
        ("idx_sites_city", "CREATE INDEX IF NOT EXISTS idx_sites_city ON sites(country, city);"),
        ("idx_sites_network", "CREATE INDEX IF NOT EXISTS idx_sites_network ON sites(network);"),
        ("idx_sites_platform", "CREATE INDEX IF NOT EXISTS idx_sites_platform ON sites(platform);"),
        ("idx_sites_deleted", "CREATE INDEX IF NOT EXISTS idx_sites_deleted ON sites(is_deleted);"),
        ("idx_sites_modified", "CREATE INDEX IF NOT EXISTS idx_sites_modified ON sites(last_modified_at);"),
        ("idx_sites_country_network", "CREATE INDEX IF NOT EXISTS idx_sites_country_network ON sites(country, network);"),
        
        # Links table indexes
        ("idx_links_site_a", "CREATE INDEX IF NOT EXISTS idx_links_site_a ON links(site_a_id);"),
        ("idx_links_site_b", "CREATE INDEX IF NOT EXISTS idx_links_site_b ON links(site_b_id);"),
        ("idx_links_type", "CREATE INDEX IF NOT EXISTS idx_links_type ON links(link_type);"),
        ("idx_links_distance", "CREATE INDEX IF NOT EXISTS idx_links_distance ON links(link_distance);"),
        ("idx_links_deleted", "CREATE INDEX IF NOT EXISTS idx_links_deleted ON links(is_deleted);"),
        ("idx_links_modified", "CREATE INDEX IF NOT EXISTS idx_links_modified ON links(last_modified_at);"),
        ("idx_links_type_distance", "CREATE INDEX IF NOT EXISTS idx_links_type_distance ON links(link_type, link_distance);"),
        ("idx_links_sites", "CREATE INDEX IF NOT EXISTS idx_links_sites ON links(site_a_id, site_b_id);"),
    ]
    
    created_count = 0
    for index_name, sql in indexes:
        try:
            cursor.execute(sql)
            logger.info(f"✅ Created: {index_name}")
            created_count += 1
        except Exception as e:
            logger.warning(f"⚠️  Failed {index_name}: {e}")
    
    # FIXED: Check spatial indexes properly
    try:
        # Check if spatial indexes exist by looking for the special R-tree tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'idx_sites_geometry%';")
        sites_spatial_tables = cursor.fetchall()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'idx_links_geometry%';")  
        links_spatial_tables = cursor.fetchall()
        
        sites_spatial_exists = len(sites_spatial_tables) > 0
        links_spatial_exists = len(links_spatial_tables) > 0
        
        logger.info(f"📊 Index Summary:")
        logger.info(f"   Regular indexes: {created_count}")
        logger.info(f"   Spatial indexes: Sites={sites_spatial_exists}, Links={links_spatial_exists}")
        
        # Show spatial index details if they exist
        if sites_spatial_exists:
            logger.info(f"   Sites spatial tables: {[t[0] for t in sites_spatial_tables]}")
        if links_spatial_exists:
            logger.info(f"   Links spatial tables: {[t for t in links_spatial_tables]}")
            
    except Exception as e:
        logger.warning(f"⚠️  Could not check spatial indexes: {e}")
    
    # Analyze tables for better query planning
    logger.info("📈 Analyzing tables for query optimization...")
    try:
        cursor.execute("ANALYZE sites;")
        cursor.execute("ANALYZE links;")
        logger.info("✅ Table analysis completed")
    except Exception as e:
        logger.warning(f"⚠️  Table analysis failed: {e}")
    
    conn.commit()
    conn.close()
    
    logger.info("🎉 Index creation completed!")

if __name__ == "__main__":
    create_all_indexes()
