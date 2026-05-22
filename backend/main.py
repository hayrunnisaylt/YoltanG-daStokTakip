import io
import json
import re
from bs4 import BeautifulSoup
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from database import users_collection, invoices_collection, customers_collection, products_collection
from bson import ObjectId
import pdfplumber 

app = FastAPI()

# Gelişmiş ve Esnek CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.on_event("startup")
async def startup_event():
    existing_user = await users_collection.find_one({"username": "admin"})
    if not existing_user:
        await users_collection.insert_one({
            "username": "admin",
            "password": "12345",
            "name": "Ömer Faruk",
            "role": "admin"
        })

@app.post("/api/login")
async def login(request: LoginRequest):
    user = await users_collection.find_one({"username": request.username})
    if user and user["password"] == request.password:
        return {"message": "Giriş başarılı", "user": {"name": user["name"], "role": user["role"]}}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Hatalı kullanıcı adı veya şifre")

def clean_product_name(name: str) -> str:
    """
    Ürün adındaki Türkçe karakterleri İngilizceye çevirir, hacim, 
    paket ve gereksiz karakterleri temizleyerek ana kökü bulur.
    """
    # 1. TÜRKÇE HARF KALKANI: I-İ ve diğer karakter karmaşasını kökten çözer
    turkce_map = str.maketrans("İıĞğŞşÇçÖöÜü", "IiGgSsCcOoUu")
    n = name.translate(turkce_map).upper()
    
    # 330ML, 1L, 250ML, 2,5LT gibi hacim ibarelerini temizle
    n = re.sub(r'\b\d+(?:,\d+)?\s*(?:ML|L|LT|LITRE|LITRE)\b', '', n)
    # *24, 24LÜ, *20, *6 gibi paket adetlerini temizle
    n = re.sub(r'[\*xX]\d+\b', '', n)
    n = re.sub(r'\b\d+\s*(?:LU|LI|LI|LY|lU|li)\b', '', n)
    # Özel sembolleri ve gereksiz boşlukları uçur
    n = re.sub(r'[^A-Z0-9\s]', '', n)
    return " ".join(n.split()).strip()

async def find_matching_product(raw_name: str) -> str:
    """
    Veritabanındaki ürünleri tarar. Gelişmiş marka koruması ve 
    agresif alt metin (substring) eşleştirmesi ile kartları birleştirir.
    """
    incoming_upper = raw_name.strip().upper()
    incoming_clean = clean_product_name(raw_name)
    if not incoming_clean:
        return incoming_upper
        
    # MARKA KORUMA HAVUZU
    markalar = ["COCA COLA", "COCA-COLA", "TURKA", "SARIYER", "PEPSI", "LIPTON", "ULUDAG", "NIGDE", "BUZDAGI", "CAPRI", "REDBULL", "RED BULL"]
    
    async for prod in products_collection.find({}):
        db_upper = prod["urun_adi"].upper()
        db_clean = clean_product_name(prod["urun_adi"])
        
        # 1. MARKA KORUMASI
        marka_hatasi = False
        for marka in markalar:
            if (marka in incoming_upper) != (marka in db_upper):
                marka_hatasi = True
                break
        if marka_hatasi:
            continue
            
        # 2. AGRESİF ALT METİN (SUBSTRING) KONTROLÜ
        # Eğer temizlenmiş isimlerden biri diğerinin içinde tamamen geçiyorsa 
        # (Örn: "PEPSI" kelimesi "PEPSI" içinde veya "PEPSI" kelimesi "PEPSI 330ML" içinde geçiyorsa)
        if incoming_clean in db_clean or db_clean in incoming_clean:
            return prod["urun_adi"] # Eski kartın adını koru ve birleştir
            
    return incoming_upper

def parse_html_invoice(content: bytes):
    soup = BeautifulSoup(content.decode('utf-8', errors='ignore'), 'html.parser')
    invoice_data = {"fatura_no": "", "fatura_tarihi": "", "musteri_unvani": "Bilinmeyen Firma/Cari", "toplam_tutar": 0.0, "kalemler": []}

    customer_table = soup.find('table', id='customerPartyTable')
    if customer_table:
        cells_text = [td.text.strip() for td in customer_table.find_all('td') if td.text.strip()]
        for idx, text in enumerate(cells_text):
            if text.upper() == "SAYIN":
                if idx + 1 < len(cells_text):
                    invoice_data["musteri_unvani"] = cells_text[idx + 1].replace('\xa0', ' ')
                    break
        else:
            if cells_text: invoice_data["musteri_unvani"] = cells_text[0].replace('\xa0', ' ')

    despatch_table = soup.find('table', id='despatchTable')
    if despatch_table:
        for row in despatch_table.find_all('tr'):
            cells = row.find_all('td')
            if len(cells) == 2:
                label = cells[0].text.strip()
                val = cells[1].text.strip().replace('\xa0', ' ')
                if "Fatura No:" in label: invoice_data["fatura_no"] = val
                elif "Fatura Tarihi:" in label:
                    tarih_kismi = val.split()[0]
                    parts = tarih_kismi.split('-')
                    if len(parts) == 3: invoice_data["fatura_tarihi"] = f"{parts[2]}-{parts[1]}-{parts[0]}"

    budget_table = soup.find('table', id='budgetContainerTable')
    if budget_table:
        for row in budget_table.find_all('tr'):
            if "Ödenecek Tutar" in row.text:
                cells = row.find_all('td')
                if cells:
                    val_str = cells[-1].text.replace('TL', '').strip().replace('\xa0', '')
                    val_str = val_str.replace('.', '').replace(',', '.')
                    try: invoice_data["toplam_tutar"] = float(val_str)
                    except: pass

    line_table = soup.find('table', id='lineTable')
    if line_table:
        for row in line_table.find_all('tr')[1:]:
            cols = row.find_all('td')
            if len(cols) >= 5:
                urun_adi = cols[1].text.strip().replace('\xa0', ' ')
                urun_adi_lower = urun_adi.lower()
                parazit_kelimeler = ["sıra", "no", "kdv", "oran", "tutarı", "tutar", "toplam", "iskonto", "matrah", "vergi", "dahil"]
                if not urun_adi or any(kelime in urun_adi_lower for kelime in parazit_kelimeler): continue
                urun_adi = re.sub(r'^\s+|\s+$', '', urun_adi)
                
                miktar = 0.0
                birim_fiyat = 0.0
                toplam = 0.0
                
                for cell in cols[2:]:
                    cell_text = cell.text.strip().replace('\xa0', '')
                    if any(u in cell_text for u in ["Adet", "Koli", "KG"]):
                        m_str = cell_text.replace('Adet', '').replace('Koli', '').replace('KG', '').strip().replace('.', '').replace(',', '.')
                        try: miktar = float(m_str)
                        except: pass
                    elif "TL" in cell_text:
                        p_str = cell_text.replace('TL', '').strip().replace('.', '').replace(',', '.')
                        try:
                            val = float(p_str)
                            if birim_fiyat == 0.0: birim_fiyat = val
                            else: toplam = val
                        except: pass

                if toplam == 0.0 and miktar > 0 and birim_fiyat > 0: toplam = miktar * birim_fiyat
                if miktar > 0 or toplam > 0:
                    invoice_data["kalemler"].append({"urun_adi": urun_adi, "miktar": miktar, "birim_fiyat": birim_fiyat, "toplam": toplam})
                
    return invoice_data

def parse_pdf_invoice(content: bytes):
    invoice_data = {"fatura_no": "", "fatura_tarihi": "", "musteri_unvani": "Bilinmeyen Toptancı", "toplam_tutar": 0.0, "kalemler": []}
    
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        full_text = ""
        for page in pdf.pages:
            full_text += page.extract_text() or ""
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    split_row_cells = []
                    for cell in row:
                        if cell:
                            # \n ile alt satıra kırılan parçaları (Örn: PEPSI \n 330ML*24) yan yana boşlukla birleştiriyoruz
                            clean_cell = " ".join([c.strip() for c in cell.split('\n') if c.strip()])
                            split_row_cells.append([clean_cell])
                        else:
                            split_row_cells.append([])

                    max_sub_lines = max(len(sub_list) for sub_list in split_row_cells) if split_row_cells else 0
                    for sub_idx in range(max_sub_lines):
                        current_virtual_row = []
                        for sub_list in split_row_cells:
                            current_virtual_row.append(sub_list[sub_idx] if sub_idx < len(sub_list) else "")

                        row_cells = [c.strip() for c in current_virtual_row if c.strip()]
                        if len(row_cells) < 3: continue
                            
                        row_text_lower = " ".join(row_cells).lower()
                        parazit_kelimeler = ["toplam", "kdv", "iskonto", "matrah", "vergi", "oran", "sıra", "tutar", "mal hizmet"]
                        if any(p in row_text_lower for p in parazit_kelimeler): continue
                        
                        urun_adi = ""
                        miktar = 0.0
                        birim_fiyat = 0.0
                        toplam = 0.0
                        
                        for cell_clean in row_cells:
                            if any(u in cell_clean for u in ["Adet", "Koli", "KG"]):
                                m_str = cell_clean.replace('Adet', '').replace('Koli', '').replace('KG', '').strip().replace('.', '').replace(',', '.')
                                try: miktar = float(m_str)
                                except: pass
                            elif "TL" in cell_clean:
                                p_str = cell_clean.replace('TL', '').strip().replace('.', '').replace(',', '.')
                                try:
                                    val = float(p_str)
                                    if birim_fiyat == 0.0: birim_fiyat = val
                                    else: toplam = val
                                except: pass
                            elif len(cell_clean) > 2 and "%" not in cell_clean and not cell_clean.replace(".","").replace(",","").isdigit():
                                urun_adi = cell_clean

                        if toplam == 0.0 and miktar > 0 and birim_fiyat > 0: toplam = miktar * birim_fiyat
                        if urun_adi and miktar > 0:
                            final_name = urun_adi.upper().strip()
                            if not any(k["urun_adi"] == final_name for k in invoice_data["kalemler"]):
                                invoice_data["kalemler"].append({"urun_adi": final_name, "miktar": miktar, "birim_fiyat": birim_fiyat, "toplam": toplam})

    fatura_no_match = re.search(r'Fatura No:\s*([A-Z0-9]+)', full_text)
    if fatura_no_match: invoice_data["fatura_no"] = fatura_no_match.group(1).strip()
        
    fatura_tarihi_match = re.search(r'Fatura Tarihi:\s*(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{4})', full_text)
    if fatura_tarihi_match:
        gun, ay, yil = fatura_tarihi_match.groups()
        invoice_data["fatura_tarihi"] = f"{yil}-{ay}-{gun}"
        
    if "ÖZ BA" in full_text: invoice_data["musteri_unvani"] = "ÖZ BA TOPLU TÜKETİM GID.SAN.VE TİC.A.Ş."
    elif "ÖZHAMUR" in full_text: invoice_data["musteri_unvani"] = "ÖZHAMUR GIDA MADDELERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ"
    elif "KERİM KARABACAK" in full_text: invoice_data["musteri_unvani"] = "İBRAHİM KERİM KARABACAK"
        
    odenecek_text = "".join(full_text.split())
    odenecek_match = re.search(r'(?:ÖdenecekTutar|VergilerDahilToplamTutar)([\d\.,]+)TL', odenecek_text)
    if odenecek_match: invoice_data["toplam_tutar"] = float(odenecek_match.group(1).replace('.', '').replace(',', '.'))

    return invoice_data

@app.post("/api/upload-invoice")
async def upload_invoice(file: UploadFile = File(...), invoice_type: str = "gelen"):
    try:
        content = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith('.html'): invoice_data = parse_html_invoice(content)
        elif filename_lower.endswith('.pdf'): invoice_data = parse_pdf_invoice(content)
        else: raise HTTPException(status_code=400, detail="Sadece HTML veya PDF desteklenir.")
        
        if not invoice_data["fatura_no"] or len(invoice_data["kalemler"]) == 0:
            raise HTTPException(status_code=400, detail="Fatura şablonu tanınmadı.")
        
        # ARTIK BURADA VERİTABANINA KAYDETMİYORUZ VE STOKLARI UÇURMUYORUZ!
        # Sadece arayüze tahmin edilen verileri önizleme olarak fırlatıyoruz.
        invoice_data["invoice_type"] = invoice_type
        return {"message": "Fatura başarıyla çözümlendi, onay bekleniyor.", "data": invoice_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard-stats")
async def get_dashboard_stats():
    try:
        total_products = await products_collection.count_documents({})
        total_customers = await customers_collection.count_documents({})
        total_invoices = await invoices_collection.count_documents({})
        total_amount = 0.0
        async for invoice in invoices_collection.find({}):
            total_amount += invoice.get("toplam_tutar", 0.0)
            
        recent_invoices = []
        async for inv in invoices_collection.find({}).sort("_id", -1).limit(5):
            if "_id" in inv: inv["_id"] = str(inv["_id"])
            recent_invoices.append(inv)
            
        return {"total_products": total_products, "total_customers": total_customers, "total_invoices": total_invoices, "total_amount": round(total_amount, 2), "recent_invoices": recent_invoices}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/customers-list")
async def get_customers_list():
    try:
        customers = []
        async for customer in customers_collection.find({}):
            if "musteri_unvani" in customer:
                invoice_count = await invoices_collection.count_documents({"musteri_unvani": customer["musteri_unvani"], "invoice_type": "giden"})
                total_spent = 0.0
                async for inv in invoices_collection.find({"musteri_unvani": customer["musteri_unvani"], "invoice_type": "giden"}):
                    total_spent += inv.get("toplam_tutar", 0.0)
                customers.append({"id": str(customer["_id"]), "musteri_unvani": customer["musteri_unvani"], "invoice_count": invoice_count, "total_spent": round(total_spent, 2)})
        return customers
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/customer-invoices/{customer_name}")
async def get_customer_invoices(customer_name: str):
    try:
        invoices = []
        async for inv in invoices_collection.find({"musteri_unvani": customer_name, "invoice_type": "giden"}):
            if "_id" in inv: inv["_id"] = str(inv["_id"])
            invoices.append(inv)
        return invoices
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-invoice/{fatura_no}")
async def delete_invoice(fatura_no: str):
    try:
        invoice = await invoices_collection.find_one({"fatura_no": fatura_no})
        if not invoice: raise HTTPException(status_code=404, detail="Fatura bulunamadı.")
        invoice_type = invoice.get("invoice_type", "gelen")
        musteri_unvani = invoice.get("musteri_unvani")
        
        for item in invoice.get("kalemler", []):
            orjinal_name = item["urun_adi"]
            nihai_name = await find_matching_product(orjinal_name)
            stok_geri_etki = -item["miktar"] if invoice_type == "gelen" else item["miktar"]
            await products_collection.update_one({"urun_adi": nihai_name}, {"$inc": {"stok_miktari": stok_geri_etki}})
            
        if invoice_type == "giden":
            remaining_count = await invoices_collection.count_documents({"musteri_unvani": musteri_unvani, "invoice_type": "giden", "fatura_no": {"$ne": fatura_no}})
            if remaining_count == 0: await customers_collection.delete_one({"musteri_unvani": musteri_unvani})
                
        await invoices_collection.delete_one({"fatura_no": fatura_no})
        return {"message": "Fatura ve tüm etkileri başarıyla sistemden kaldırıldı."}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-customer/{customer_name}")
async def delete_customer(customer_name: str):
    try:
        await invoices_collection.update_many({"musteri_unvani": customer_name, "invoice_type": "giden"}, {"$set": {"musteri_unvani": "Silinmiş Müşteri (Geçmiş Kayıt)"}})
        await customers_collection.delete_one({"musteri_unvani": customer_name})
        return {"message": "Müşteri portföyden gizlendi; geçmiş satış ve stok dataları korundu."}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products-list")
async def get_products_list():
    try:
        products = []
        async for prod in products_collection.find({}).sort("stok_miktari", -1):
            products.append({"id": str(prod["_id"]), "urun_adi": prod.get("urun_adi", "Bilinmeyen Ürün"), "stok_miktari": prod.get("stok_miktari", 0), "birim_fiyat": prod.get("son_birim_fiyat", 0.0), "kritik_esik": 10})
        return products
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-product/{product_id}")
async def delete_product(product_id: str):
    try:
        product = await products_collection.find_one({"_id": ObjectId(product_id)})
        if not product: raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        urun_adi = product.get("urun_adi")
        await invoices_collection.update_many({"kalemler.urun_adi": urun_adi}, {"$set": {"kalemler.$[elem].urun_adi": "Silinmiş Ürün (Geçmiş Kayıt)"}}, array_filters=[{"elem.urun_adi": urun_adi}])
        await products_collection.delete_one({"_id": ObjectId(product_id)})
        return {"message": "Ürün envanterden kaldırıldı, geçmiş fatura kayıtları korundu."}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

class FinalInvoiceSaveRequest(BaseModel):
    fatura_no: str
    fatura_tarihi: str
    musteri_unvani: str
    toplam_tutar: float
    invoice_type: str
    kalemler: list # İçinde urun_adi, miktar, birim_fiyat, toplam ve db_urun_adi (Seçilen Ürün) olacak

@app.post("/api/save-final-invoice")
async def save_final_invoice(request: FinalInvoiceSaveRequest):
    try:
        invoice_data = request.dict()
        
        # 1. Faturayı koleksiyona kaydet
        await invoices_collection.insert_one(invoice_data)
        if "_id" in invoice_data: del invoice_data["_id"]
        
        # 2. Cari Portföyünü Güncelle
        if request.invoice_type == "giden":
            await customers_collection.update_one(
                {"musteri_unvani": request.musteri_unvani}, 
                {"$set": {"musteri_unvani": "Silinmiş Müşteri" if request.musteri_unvani == "Silinmiş Müşteri (Geçmiş Kayıt)" else request.musteri_unvani}}, 
                upsert=True
            )

        # 3. Kullanıcının el seçimiyle eşleştirdiği DB ürünlerine göre stokları güncelle
        for item in request.kalemler:
            # Eğer kullanıcı listeden elle bir ürün seçtiyse onu baz al, seçmediyse faturadaki adı kullan
            hedef_urun_adi = item.get("db_urun_adi") if item.get("db_urun_adi") else item["urun_adi"]
            
            stok_degisimi = item["miktar"] if request.invoice_type == "gelen" else -item["miktar"]
            
            await products_collection.update_one(
                {"urun_adi": hedef_urun_adi.strip().upper()}, 
                {
                    "$inc": {"stok_miktari": stok_degisimi}, 
                    "$set": {"son_birim_fiyat": item["birim_fiyat"]}
                }, 
                upsert=True
            )
            
        return {"message": "Fatura ve seçilen ürün stokları başarıyla kaydedildi!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class StockUpdateRequest(BaseModel):
    amount: float

class ProductNameUpdateRequest(BaseModel):
    new_name: str

@app.put("/api/update-product-name/{product_id}")
async def update_product_name(product_id: str, request: ProductNameUpdateRequest):
    try:
        product = await products_collection.find_one({"_id": ObjectId(product_id)})
        if not product:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        
        new_name_upper = request.new_name.strip().upper()
        # Veritabanında ürün adını güncelle
        await products_collection.update_one(
            {"_id": ObjectId(product_id)}, 
            {"$set": {"urun_adi": new_name_upper}}
        )
        # Geçmiş faturaları da etkilemek isteniyorsa eklenebilir, şimdilik sadece stok ismini değiştirelim.
        # İhtiyaç olursa: await invoices_collection.update_many({"kalemler.urun_adi": product.get("urun_adi")}, {"$set": {"kalemler.$[elem].urun_adi": new_name_upper}}, array_filters=[{"elem.urun_adi": product.get("urun_adi")}])
        
        return {"message": "Ürün adı başarıyla güncellendi", "new_name": new_name_upper}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/update-stock/{product_id}")
async def update_stock(product_id: str, request: StockUpdateRequest):
    try:
        product = await products_collection.find_one({"_id": ObjectId(product_id)})
        if not product: raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        new_stock = product.get("stok_miktari", 0) + request.amount
        if new_stock < 0: new_stock = 0
        await products_collection.update_one({"_id": ObjectId(product_id)}, {"$set": {"stok_miktari": new_stock}})
        return {"message": "Stok başarıyla güncellendi", "new_stock": new_stock}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/toptancilar-list")
async def get_toptancilar_list():
    try:
        toptancilar = []
        pipeline = [
            {"$match": {"invoice_type": "gelen"}},
            {"$group": {
                "_id": "$musteri_unvani",
                "invoice_count": {"$sum": 1},
                "total_bought": {"$sum": "$toplam_tutar"}
            }}
        ]
        cursor = invoices_collection.aggregate(pipeline)
        async for doc in cursor:
            toptancilar.append({
                "id": str(doc["_id"]),
                "toptanci_unvani": doc["_id"],
                "invoice_count": doc["invoice_count"],
                "total_bought": round(doc["total_bought"], 2)
            })
        return toptancilar
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/toptanci-invoices/{toptanci_name}")
async def get_toptanci_invoices(toptanci_name: str):
    try:
        invoices = []
        async for inv in invoices_collection.find({"musteri_unvani": toptanci_name, "invoice_type": "gelen"}).sort("_id", -1):
            if "_id" in inv: 
                inv["_id"] = str(inv["_id"])
            invoices.append(inv)
        return invoices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))