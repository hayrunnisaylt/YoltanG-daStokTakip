import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# .env dosyasını hem backend hem de üst klasör (ana dizin) için yükle
load_dotenv()
load_dotenv(dotenv_path="../.env")


MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_DETAILS)


database = client.yoltangida_db

# Koleksiyonlar
users_collection = database.get_collection("users")
invoices_collection = database.get_collection("invoices")
products_collection = database.get_collection("products")
customers_collection = database.get_collection("customers")