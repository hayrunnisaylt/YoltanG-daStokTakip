import io
import json
import re
from bs4 import BeautifulSoup
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from database import users_collection, invoices_collection, customers_collection, products_collection
from bson import ObjectId
import pdfplumber 
from contextlib import asynccontextmanager

# 1. LIFESPAN (UYGULAMA YAŞAM DÖNGÜSÜ) TANIMLAMASI
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- YUKARISI STARTUP (BAŞLANGIÇ) ---
    print("Sistem başlatılıyor...")
    
    yield # Uygulamanın çalıştığı an
    
    # --- AŞAĞISI SHUTDOWN (KAPANIŞ) ---
    print("Sistem kapanıyor...")

# 2. FASTAPI UYGULAMASINI BAŞLATMA (Lifespan ile)
app = FastAPI(lifespan=lifespan)

# 3. Gelişmiş ve Esnek CORS Ayarları (Mutlaka app tanımlandıktan sonra olmalı)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELLER ---
class LoginRequest(BaseModel):
    username: str
    password: str

class FinalInvoiceSaveRequest(BaseModel):
    fatura_no: str
    fatura_tarihi: str
    musteri_unvani: str
    toplam_tutar: float
    invoice_type: str
    kalemler: list 

class StockUpdateRequest(BaseModel):
    amount: float

class StockSetRequest(BaseModel):
    new_stock: float

class ProductNameUpdateRequest(BaseModel):
    new_name: str

class ProductAddRequest(BaseModel):
    urun_adi: str
    stok_miktari: float = 0.0
    birim_fiyat: float = 0.0
    kritik_esik: int = 10

# --- YARDIMCI FONKSİYONLAR ---
def clean_product_name(name: str) -> str:
    """
    Ürün adındaki Türkçe karakterleri İngilizceye çevirir, hacim, 
    paket ve gereksiz karakterleri temizleyerek ana kökü bulur.
    """
    turkce_map = str.maketrans("İıĞğŞşÇçÖöÜü", "IiGgSsCcOoUu")
    n = name.translate(turkce_map).upper()
    
    n = re.sub(r'\b\d+(?:,\d+)?\s*(?:ML|L|LT|LITRE|LITRE)\b', '', n)
    n = re.sub(r'[\*xX]\d+\b', '', n)
    n = re.sub(r'\b\d+\s*(?:LU|LI|LI|LY|lU|li)\b', '', n)
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
        
    markalar = ["COCA COLA", "COCA-COLA", "TURKA", "SARIYER", "PEPSI", "LIPTON", "ULUDAG", "NIGDE", "BUZDAGI", "CAPRI", "REDBULL", "RED BULL"]
    
    async for prod in products_collection.find({}):
        db_upper = prod["urun_adi"].upper()
        db_clean = clean_product_name(prod["urun_adi"])
        
        marka_hatasi = False
        for marka in markalar:
            if (marka in incoming_upper) != (marka in db_upper):
                marka_hatasi = True
                break
        if marka_hatasi:
            continue
            
        if incoming_clean in db_clean or db_clean in incoming_clean:
            return prod["urun_adi"]
            
    return incoming_upper

def parse_tr_float(val_str) -> float:
    if not val_str:
        return 0.0
    s = str(val_str).strip().replace("TL", "").replace("tl", "").replace("₺", "").replace("\xa0", "").strip()
    for unit in ["Adet", "adet", "ADET", "Koli", "koli", "KOLİ", "KG", "kg", "Kg", "LT", "lt", "L"]:
        s = re.sub(rf"\b{unit}\b", "", s).strip()
    if not s:
        return 0.0
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s:
        parts = s.split(".")
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            s = "".join(parts)
    s = re.sub(r"[^\d.-]", "", s)
    try:
        return float(s)
    except:
        return 0.0

def parse_html_invoice(content: bytes, invoice_type: str = "gelen"):
    soup = BeautifulSoup(content.decode('utf-8', errors='ignore'), 'html.parser')
    invoice_data = {"fatura_no": "", "fatura_tarihi": "", "musteri_unvani": "Bilinmeyen Firma/Cari", "toplam_tutar": 0.0, "kalemler": []}

    # 1. Cari / Tedarikçi Unvanı
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

    # 2. Fatura No ve Tarih (despatchTable veya genel arama)
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
    
    # Fallback Fatura No & Tarih
    if not invoice_data["fatura_no"]:
        m = re.search(r'Fatura No:?\s*([A-Z0-9]+)', soup.text)
        if m: invoice_data["fatura_no"] = m.group(1).strip()
    if not invoice_data["fatura_tarihi"]:
        m = re.search(r'Fatura Tarihi:?\s*(\d{2})[-./](\d{2})[-./](\d{4})', soup.text)
        if m: invoice_data["fatura_tarihi"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"

    # 3. Toplam Tutar
    budget_table = soup.find('table', id='budgetContainerTable')
    if budget_table:
        for row in budget_table.find_all('tr'):
            if "Ödenecek Tutar" in row.text or "Vergiler Dahil" in row.text:
                cells = row.find_all('td')
                if cells:
                    parsed_tot = parse_tr_float(cells[-1].text)
                    if parsed_tot > 0:
                        invoice_data["toplam_tutar"] = parsed_tot

    if invoice_data["toplam_tutar"] == 0.0:
        m = re.search(r'(?:Ödenecek\s*Tutar|Vergiler\s*Dahil\s*Toplam\s*Tutar)[:]?\s*([\d\.,]+)\s*TL', soup.text)
        if m:
            invoice_data["toplam_tutar"] = parse_tr_float(m.group(1))

    # 4. Kalemler (lineTable veya Genel Tablo Taraması)
    tables_to_check = []
    line_table = soup.find('table', id='lineTable')
    if line_table:
        tables_to_check.append(line_table)
    else:
        tables_to_check = soup.find_all('table')

    for table in tables_to_check:
        rows = table.find_all('tr')
        if len(rows) < 2:
            continue
            
        header_idx = -1
        name_idx = -1
        qty_idx = -1
        price_idx = -1
        total_idx = -1
        
        for r_idx, row in enumerate(rows[:3]):
            cells = [td.text.lower().replace('\n', ' ').strip() for td in row.find_all(['th', 'td'])]
            for c_idx, cell in enumerate(cells):
                if any(k in cell for k in ["mal hizmet", "mal/hizmet", "ürün adı", "stok adı", "açıklama"]):
                    if not any(k in cell for k in ["tutar", "kdv", "oran", "iskonto"]):
                        name_idx = c_idx
                if "miktar" in cell:
                    qty_idx = c_idx
                if any(k in cell for k in ["birim fiyat", "b.fiyat"]):
                    price_idx = c_idx
                if any(k in cell for k in ["mal hizmet tutar", "tutar"]) and not any(x in cell for x in ["kdv", "iskonto", "vergi"]):
                    total_idx = c_idx
                    
            if name_idx != -1 and qty_idx != -1:
                header_idx = r_idx
                break
                
        if header_idx != -1:
            for row in rows[header_idx + 1:]:
                cols = row.find_all(['td', 'th'])
                if len(cols) <= max(name_idx, qty_idx):
                    continue
                name_cell = cols[name_idx].text.strip().replace('\xa0', ' ')
                name_lower = name_cell.lower()
                if not name_cell or any(k in name_lower for k in ["toplam", "ödenecek", "kdv", "matrah", "genel", "mal hizmet toplam"]):
                    continue
                
                qty = parse_tr_float(cols[qty_idx].text)
                price = parse_tr_float(cols[price_idx].text) if price_idx != -1 and price_idx < len(cols) else 0.0
                total = parse_tr_float(cols[total_idx].text) if total_idx != -1 and total_idx < len(cols) else 0.0
                if total == 0.0 and qty > 0 and price > 0:
                    total = round(qty * price, 2)
                    
                if name_cell and qty > 0:
                    clean_name = " ".join(name_cell.split()).upper()
                    if not any(k["urun_adi"] == clean_name for k in invoice_data["kalemler"]):
                        invoice_data["kalemler"].append({"urun_adi": clean_name, "miktar": qty, "birim_fiyat": price, "toplam": total})
            if len(invoice_data["kalemler"]) > 0:
                break

    # Genel Fallback
    if len(invoice_data["kalemler"]) == 0 and line_table:
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
                    m = parse_tr_float(cell_text)
                    if any(u in cell_text for u in ["Adet", "Koli", "KG"]):
                        miktar = m
                    elif "TL" in cell_text:
                        if birim_fiyat == 0.0: birim_fiyat = m
                        else: toplam = m

                if toplam == 0.0 and miktar > 0 and birim_fiyat > 0: toplam = round(miktar * birim_fiyat, 2)
                if miktar > 0 or toplam > 0:
                    invoice_data["kalemler"].append({"urun_adi": urun_adi.upper(), "miktar": miktar, "birim_fiyat": birim_fiyat, "toplam": toplam})

    return invoice_data

def parse_pdf_invoice(content: bytes, invoice_type: str = "gelen"):
    invoice_data = {
        "fatura_no": "",
        "fatura_tarihi": "",
        "musteri_unvani": "",
        "toplam_tutar": 0.0,
        "kalemler": []
    }
    
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        full_text = ""
        all_tables = []
        for page in pdf.pages:
            p_text = page.extract_text() or ""
            full_text += p_text + "\n"
            all_tables.extend(page.extract_tables() or [])
            
        # 1. TABLOLARDAN VERİ ÇIKARMA (Öncelikli Başlık Eşleştirme)
        for table in all_tables:
            if not table or len(table) < 2:
                continue
                
            header_idx = -1
            name_idx = -1
            qty_idx = -1
            price_idx = -1
            total_idx = -1
            
            for r_idx, row in enumerate(table[:3]):
                clean_row = [str(c).lower().replace("\n", " ").strip() if c else "" for c in row]
                for c_idx, cell in enumerate(clean_row):
                    if any(k in cell for k in ["mal hizmet", "mal/hizmet", "ürün adı", "stok adı", "açıklama"]):
                        if not any(k in cell for k in ["tutar", "kdv", "oran", "iskonto"]):
                            name_idx = c_idx
                    if "miktar" in cell:
                        qty_idx = c_idx
                    if any(k in cell for k in ["birim fiyat", "b.fiyat"]):
                        price_idx = c_idx
                    if any(k in cell for k in ["mal hizmet tutar", "tutar"]) and not any(x in cell for x in ["kdv", "iskonto", "vergi"]):
                        total_idx = c_idx
                            
                if name_idx != -1 and qty_idx != -1:
                    header_idx = r_idx
                    break
                    
            if header_idx != -1:
                for row in table[header_idx + 1:]:
                    if not row or len(row) <= max(name_idx, qty_idx):
                        continue
                    name_cell = str(row[name_idx] or "").strip().replace("\n", " ")
                    if not name_cell or any(k in name_cell.lower() for k in ["toplam", "ödenecek", "kdv", "matrah", "genel", "mal hizmet toplam"]):
                        continue
                    
                    qty = parse_tr_float(row[qty_idx])
                    price = parse_tr_float(row[price_idx]) if price_idx != -1 and price_idx < len(row) else 0.0
                    total = parse_tr_float(row[total_idx]) if total_idx != -1 and total_idx < len(row) else 0.0
                    if total == 0.0 and qty > 0 and price > 0:
                        total = round(qty * price, 2)
                        
                    if name_cell and qty > 0:
                        clean_name = " ".join(name_cell.split()).upper()
                        if not any(k["urun_adi"] == clean_name for k in invoice_data["kalemler"]):
                            invoice_data["kalemler"].append({
                                "urun_adi": clean_name,
                                "miktar": qty,
                                "birim_fiyat": price,
                                "toplam": total
                            })
                            
            # Tablo içinde Fatura No, Tarih veya Ödenecek Tutar arama
            for row in table:
                for i, c in enumerate(row):
                    if not c:
                        continue
                    c_clean = str(c).replace("\n", " ").strip()
                    if "Fatura No:" in c_clean or "Fatura No" in c_clean:
                        if i + 1 < len(row) and row[i+1]:
                            invoice_data["fatura_no"] = str(row[i+1]).replace("\n", "").strip()
                        else:
                            m = re.search(r"Fatura No:?\s*([A-Z0-9]+)", c_clean)
                            if m: invoice_data["fatura_no"] = m.group(1).strip()
                            
                    if "Fatura Tarihi" in c_clean:
                        val_str = str(row[i+1]).strip() if i + 1 < len(row) and row[i+1] else c_clean
                        m = re.search(r"(\d{2})[-./](\d{2})[-./](\d{4})", val_str)
                        if m:
                            invoice_data["fatura_tarihi"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
                            
                    if "Ödenecek Tutar" in c_clean or "Vergiler Dahil Toplam Tutar" in c_clean:
                        val_str = str(row[i+1]).strip() if i + 1 < len(row) and row[i+1] else c_clean
                        val_parsed = parse_tr_float(val_str)
                        if val_parsed > 0:
                            invoice_data["toplam_tutar"] = val_parsed

        # 2. TABLO EŞLEŞMESİ OLMADIYSA SATIR BAZLI FALLBACK
        if len(invoice_data["kalemler"]) == 0:
            for table in all_tables:
                for row in table:
                    split_row_cells = []
                    for cell in row:
                        if cell:
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
                                m = parse_tr_float(cell_clean)
                                if m > 0: miktar = m
                            elif "TL" in cell_clean:
                                p = parse_tr_float(cell_clean)
                                if birim_fiyat == 0.0: birim_fiyat = p
                                else: toplam = p
                            elif len(cell_clean) > 2 and "%" not in cell_clean and not cell_clean.replace(".","").replace(",","").isdigit():
                                urun_adi = cell_clean

                        if toplam == 0.0 and miktar > 0 and birim_fiyat > 0: toplam = round(miktar * birim_fiyat, 2)
                        if urun_adi and miktar > 0:
                            final_name = urun_adi.upper().strip()
                            if not any(k["urun_adi"] == final_name for k in invoice_data["kalemler"]):
                                invoice_data["kalemler"].append({"urun_adi": final_name, "miktar": miktar, "birim_fiyat": birim_fiyat, "toplam": toplam})

        # 3. FATURA NO VE TARİH FALLBACK (Metinden)
        if not invoice_data["fatura_no"]:
            fatura_no_match = re.search(r'Fatura No:\s*([A-Z0-9]+)', full_text)
            if fatura_no_match: invoice_data["fatura_no"] = fatura_no_match.group(1).strip()
            
        if not invoice_data["fatura_tarihi"]:
            fatura_tarihi_match = re.search(r'Fatura Tarihi:\s*(\d{2})\s*[-./]\s*(\d{2})\s*[-./]\s*(\d{4})', full_text)
            if fatura_tarihi_match:
                gun, ay, yil = fatura_tarihi_match.groups()
                invoice_data["fatura_tarihi"] = f"{yil}-{ay}-{gun}"
            else:
                m2 = re.search(r'(\d{2})[-./](\d{2})[-./](\d{4})', full_text)
                if m2:
                    invoice_data["fatura_tarihi"] = f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"
                    
        # 4. TOPLAM TUTAR FALLBACK
        if invoice_data["toplam_tutar"] == 0.0:
            odenecek_text = "".join(full_text.split())
            odenecek_match = re.search(r'(?:ÖdenecekTutar|VergilerDahilToplamTutar)[:]?([\d\.,]+)TL', odenecek_text)
            if odenecek_match:
                invoice_data["toplam_tutar"] = parse_tr_float(odenecek_match.group(1))
            else:
                invoice_data["toplam_tutar"] = round(sum(k["toplam"] for k in invoice_data["kalemler"]), 2)

        # 5. CARİ / TOPTANCI UNVANI
        if "ÖZ BA" in full_text: 
            invoice_data["musteri_unvani"] = "ÖZ BA TOPLU TÜKETİM GID.SAN.VE TİC.A.Ş."
        elif "ÖZHAMUR" in full_text: 
            invoice_data["musteri_unvani"] = "ÖZHAMUR GIDA MADDELERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ"
        elif "KERİM KARABACAK" in full_text or "İBRAHİM KERİM" in full_text: 
            invoice_data["musteri_unvani"] = "İBRAHİM KERİM KARABACAK"
        else:
            lines = [l.strip() for l in full_text.split("\n") if l.strip()]
            if invoice_type == "gelen":
                for l in lines:
                    if any(skip in l.lower() for skip in ["e-arşiv", "tarih", "saat", "sayfa", "fatura", "ettn", "subeno"]):
                        continue
                    if len(l) > 3 and not l.isdigit():
                        invoice_data["musteri_unvani"] = l
                        break
            else:
                for i, l in enumerate(lines):
                    if l.upper() == "SAYIN" and i + 1 < len(lines):
                        invoice_data["musteri_unvani"] = lines[i+1]
                        break
                        
        if not invoice_data["musteri_unvani"]:
            invoice_data["musteri_unvani"] = "Bilinmeyen Tedarikçi / Cari"

    return invoice_data


# --- ENDPOINTLER (ROUTELER) ---

@app.post("/api/login")
async def login(request: LoginRequest):
    user = await users_collection.find_one({"username": request.username})
    if user and user["password"] == request.password:
        return {"message": "Giriş başarılı", "user": {"name": user["name"], "role": user["role"]}}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Hatalı kullanıcı adı veya şifre")

@app.post("/api/upload-invoice")
async def upload_invoice(file: UploadFile = File(...), invoice_type: str = "gelen"):
    try:
        content = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith('.html'): invoice_data = parse_html_invoice(content, invoice_type)
        elif filename_lower.endswith('.pdf'): invoice_data = parse_pdf_invoice(content, invoice_type)
        else: raise HTTPException(status_code=400, detail="Sadece HTML veya PDF desteklenir.")
        
        if not invoice_data["fatura_no"] or len(invoice_data["kalemler"]) == 0:
            raise HTTPException(status_code=400, detail="Fatura şablonu tanınmadı.")
        
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
            products.append({"id": str(prod["_id"]), "urun_adi": prod.get("urun_adi", "Bilinmeyen Ürün"), "stok_miktari": prod.get("stok_miktari", 0), "birim_fiyat": prod.get("son_birim_fiyat", 0.0), "kritik_esik": prod.get("kritik_esik", 10)})
        return products
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/add-product")
async def add_product(request: ProductAddRequest):
    try:
        urun_adi_upper = request.urun_adi.strip().upper()
        if not urun_adi_upper:
            raise HTTPException(status_code=400, detail="Ürün adı boş olamaz.")
        
        # Check if already exists
        existing = await products_collection.find_one({"urun_adi": urun_adi_upper})
        if existing:
            raise HTTPException(status_code=400, detail="Bu isimde bir ürün zaten mevcut.")
            
        new_prod = {
            "urun_adi": urun_adi_upper,
            "stok_miktari": request.stok_miktari,
            "son_birim_fiyat": request.birim_fiyat,
            "kritik_esik": request.kritik_esik
        }
        result = await products_collection.insert_one(new_prod)
        return {"message": "Ürün başarıyla eklendi.", "id": str(result.inserted_id)}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/save-final-invoice")
async def save_final_invoice(request: FinalInvoiceSaveRequest):
    try:
        invoice_data = request.dict()
        
        await invoices_collection.insert_one(invoice_data)
        if "_id" in invoice_data: del invoice_data["_id"]
        
        if request.invoice_type == "giden":
            await customers_collection.update_one(
                {"musteri_unvani": request.musteri_unvani}, 
                {"$set": {"musteri_unvani": "Silinmiş Müşteri" if request.musteri_unvani == "Silinmiş Müşteri (Geçmiş Kayıt)" else request.musteri_unvani}}, 
                upsert=True
            )

        for item in request.kalemler:
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

@app.put("/api/update-product-name/{product_id}")
async def update_product_name(product_id: str, request: ProductNameUpdateRequest):
    try:
        product = await products_collection.find_one({"_id": ObjectId(product_id)})
        if not product:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        
        new_name_upper = request.new_name.strip().upper()
        await products_collection.update_one(
            {"_id": ObjectId(product_id)}, 
            {"$set": {"urun_adi": new_name_upper}}
        )
        
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

@app.put("/api/set-stock/{product_id}")
async def set_stock(product_id: str, request: StockSetRequest):
    try:
        product = await products_collection.find_one({"_id": ObjectId(product_id)})
        if not product: raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        new_val = request.new_stock
        if new_val < 0: new_val = 0.0
        await products_collection.update_one({"_id": ObjectId(product_id)}, {"$set": {"stok_miktari": new_val}})
        return {"message": "Stok başarıyla güncellendi", "new_stock": new_val}
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

def turkish_search_regex(search_text: str) -> str:
    escaped = re.escape(search_text.strip())
    char_map = {
        "c": "[cçCÇ]", "ç": "[cçCÇ]",
        "g": "[gğGĞ]", "ğ": "[gğGĞ]",
        "i": "[iıİI]", "ı": "[iıİI]",
        "o": "[oöOÖ]", "ö": "[oöOÖ]",
        "s": "[sşSŞ]", "ş": "[sşSŞ]",
        "u": "[uüUÜ]", "ü": "[uüUÜ]",
    }
    result = []
    i = 0
    while i < len(escaped):
        if escaped[i] == "\\" and i + 1 < len(escaped):
            ch = escaped[i+1].lower()
            if ch in char_map:
                result.append(char_map[ch])
                i += 2
                continue
            else:
                result.append(escaped[i:i+2])
                i += 2
                continue
        ch = escaped[i].lower()
        if ch in char_map:
            result.append(char_map[ch])
        else:
            result.append(escaped[i])
        i += 1
    return "".join(result)

@app.get("/api/search-gelen-invoices")
async def search_gelen_invoices(q: str = "", toptanci: Optional[str] = None):
    try:
        query = {"invoice_type": "gelen"}
        if toptanci and toptanci.strip():
            query["musteri_unvani"] = toptanci.strip()
            
        if q and q.strip():
            pattern = turkish_search_regex(q)
            search_regex = {"$regex": pattern, "$options": "i"}
            query["$or"] = [
                {"kalemler.urun_adi": search_regex},
                {"kalemler.db_urun_adi": search_regex},
                {"fatura_no": search_regex},
                {"musteri_unvani": search_regex}
            ]
            
        invoices = []
        async for inv in invoices_collection.find(query).sort("_id", -1):
            if "_id" in inv: 
                inv["_id"] = str(inv["_id"])
            invoices.append(inv)
        return invoices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))