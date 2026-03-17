import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings,SettingsConfigDict

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



class Settings(BaseSettings):
    TEST_URI: str
    LIVE_URI: str
    INVENTORY_URI: str
    PURCHASE_URI: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

settings = Settings()