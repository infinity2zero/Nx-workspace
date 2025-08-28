import subprocess
import sys
import os
import time
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('setup_database.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    start_time = time.time()
    logger.info("🚀 Starting ISP Network Database Setup")
    logger.info("="*60)
    
    # Check Python version
    python_version = sys.version
    logger.info(f"🐍 Python version: {python_version}")
    
    # Check current directory
    current_dir = os.getcwd()
    logger.info(f"📁 Current directory: {current_dir}")
    
    # Check if database exists
    db_path = '../../db/network.sqlite'
    db_abs_path = os.path.abspath(db_path)
    
    if os.path.exists(db_path):
        db_size = os.path.getsize(db_path) / 1024 / 1024
        logger.info(f"✅ Found existing database: {db_abs_path}")
        logger.info(f"📊 Current database size: {db_size:.2f} MB")
    else:
        logger.error(f"❌ Database not found at: {db_abs_path}")
        logger.error("Please make sure your database exists at db/network.sqlite")
        return 1
    
    # Step 1: Generate mock data
    logger.info("="*60)
    logger.info("1️⃣ GENERATING MOCK DATA")
    logger.info("="*60)
    
    generation_start = time.time()
    logger.info("🏃 Running data generation script...")
    
    result = subprocess.run([sys.executable, "generate-data.py"], 
                          capture_output=True, text=True)
    
    generation_duration = time.time() - generation_start
    
    if result.returncode != 0:
        logger.error("❌ Data generation failed!")
        logger.error(f"Error output: {result.stderr}")
        return 1
    
    logger.info(f"✅ Data generation completed in {generation_duration:.2f} seconds")
    
    # Check generated files
    sites_file = 'data/sites.json'
    links_file = 'data/links.json'
    
    if not os.path.exists(sites_file):
        logger.error(f"❌ Sites file not generated: {sites_file}")
        return 1
    
    if not os.path.exists(links_file):
        logger.error(f"❌ Links file not generated: {links_file}")
        return 1
    
    sites_size = os.path.getsize(sites_file) / 1024 / 1024
    links_size = os.path.getsize(links_file) / 1024 / 1024
    
    logger.info(f"📂 Generated files:")
    logger.info(f"   Sites: {sites_file} ({sites_size:.2f} MB)")
    logger.info(f"   Links: {links_file} ({links_size:.2f} MB)")
    
    # Step 2: Load data into SQLite
    logger.info("="*60)
    logger.info("2️⃣ LOADING DATA INTO DATABASE")
    logger.info("="*60)
    
    loading_start = time.time()
    logger.info("🏃 Running data loading script...")
    
    result = subprocess.run([sys.executable, "load-data.py"], 
                          capture_output=True, text=True)
    
    loading_duration = time.time() - loading_start
    
    if result.returncode != 0:
        logger.error("❌ Data loading failed!")
        logger.error(f"Error output: {result.stderr}")
        return 1
    
    logger.info(f"✅ Data loading completed in {loading_duration:.2f} seconds")
    
    # Step 3: Final verification
    logger.info("="*60)
    logger.info("3️⃣ FINAL VERIFICATION")
    logger.info("="*60)
    
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Basic counts
        cursor.execute("SELECT COUNT(*) FROM sites;")
        sites_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM links;")
        links_count = cursor.fetchone()
        
        logger.info(f"📊 Database contents:")
        logger.info(f"   Sites: {sites_count}")
        logger.info(f"   Links: {links_count}")
        
        # Sample data
        logger.info("📋 Sample data:")
        
        cursor.execute("""
            SELECT site_id, site_name, country, city 
            FROM sites 
            ORDER BY RANDOM() 
            LIMIT 3
        """)
        
        logger.info("   Sample sites:")
        for row in cursor.fetchall():
            logger.info(f"     {row[0]}: {row[1]} ({row}, {row})")
        
        cursor.execute("""
            SELECT link_id, link_type, link_distance,
                   (SELECT site_name FROM sites WHERE site_id = links.site_a_id) as site_a,
                   (SELECT site_name FROM sites WHERE site_id = links.site_b_id) as site_b
            FROM links 
            ORDER BY RANDOM() 
            LIMIT 3
        """)
        
        logger.info("   Sample links:")
        for row in cursor.fetchall():
            logger.info(f"     {row[0]}: {row[1]} ({row}km) - {row} -> {row}")
        
        # Link type distribution
        cursor.execute("""
            SELECT link_type, COUNT(*) 
            FROM links 
            GROUP BY link_type 
            ORDER BY COUNT(*) DESC
        """)
        
        logger.info("   Link type distribution:")
        for row in cursor.fetchall():
            logger.info(f"     {row[0]}: {row[1]} links")
        
        # Database size
        final_db_size = os.path.getsize(db_path) / 1024 / 1024
        logger.info(f"💾 Final database size: {final_db_size:.2f} MB")
        
        conn.close()
        
    except Exception as e:
        logger.warning(f"⚠️  Could not run verification queries: {e}")
    
    # Summary
    total_duration = time.time() - start_time
    
    logger.info("="*60)
    logger.info("🎉 DATABASE SETUP COMPLETED SUCCESSFULLY!")
    logger.info("="*60)
    logger.info(f"📊 Summary:")
    logger.info(f"   Data generation: {generation_duration:.2f}s")
    logger.info(f"   Data loading: {loading_duration:.2f}s")
    logger.info(f"   Total time: {total_duration:.2f}s")
    logger.info(f"📍 Database location: {db_abs_path}")
    logger.info("📝 Log files created:")
    logger.info("   - setup_database.log")
    logger.info("   - data_generation.log") 
    logger.info("   - data_loading.log")
    
    return 0

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.warning("⚠️  Process interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        sys.exit(1)
