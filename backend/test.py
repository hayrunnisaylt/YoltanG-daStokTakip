import re
from pypdf import PdfReader

# Az önce bana gönderdiğin PDF dosyasının tam adı/yolu
pdf_path = r"C:/Users/My Pc/Downloads/earsiv_faturaOBA2026000001215.pdf.pdf"

reader = PdfReader(pdf_path)
full_text = ""
for page in reader.pages:
    full_text += page.extract_text() + "\n"

print("--- PDF'DEN OKUNAN HAM METİN ---")
print(full_text)
print("-" * 30)

# Fatura No Testi
fatura_no_match = re.search(r'Fatura No:\s*([A-Z0-9]+)', full_text)
print("Bulunan Fatura No:", fatura_no_match.group(1) if fatura_no_match else "BULUNAMADI")

# Fatura Tarihi Testi
fatura_tarihi_match = re.search(r'Fatura Tarihi:\s*(\d{2}-\d{2}-\d{4})', full_text)
print("Bulunan Fatura Tarihi:", fatura_tarihi_match.group(1) if fatura_tarihi_match else "BULUNAMADI")

# Satır satır ürün arama testi
print("\n--- BULUNAN ÜRÜN SATIRLARI ---")
lines = full_text.split('\n')
for line in lines:
    if "TL" in line:
        print("TL İçeren Satır:", line)