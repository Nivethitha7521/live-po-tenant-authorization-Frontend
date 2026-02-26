import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    
    # MongoDB Configuration
    MONGODB_URI = os.getenv("MONGODB_URI")
    MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "purchasetest")
    
    # Validate required configurations
    @classmethod
    def validate(cls):
        """Validate required environment variables"""
        if not cls.MONGODB_URI:
            raise ValueError("MONGODB_URI environment variable is required")
        
        print(f"MongoDB Configuration:")
        print(f"  Database: {cls.MONGODB_DATABASE}")
        print(f"  URI: {'*' * 20}")  # Hide URI for security
        print("Configuration validated successfully")