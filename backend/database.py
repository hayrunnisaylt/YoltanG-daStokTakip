from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB Atlas'tan kopyaladığınız adresi buraya yapıştırın.
# <username> ve <password> alanlarını kendi belirlediğiniz bilgilerle doldurun.
# Şifrenizde özel karakterler (@, /, : vb.) varsa sorun yaşamamak için şifrenizi sade seçebilir veya url-encode edebilirsiniz.
MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_DETAILS)

# Veritabanını seçiyoruz
database = client.yoltangida_db

# Koleksiyonlar
users_collection = database.get_collection("users")
invoices_collection = database.get_collection("invoices")
products_collection = database.get_collection("products")
customers_collection = database.get_collection("customers")