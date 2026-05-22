@echo off
echo =======================================
echo Yoltan Gida Stok Takip - Baslatiliyor
echo =======================================

:: Frontend bagimliliklarini kur (eger yoksa)
echo [1/3] Frontend paketleri kontrol ediliyor...
call npm install

:: Backend bagimliliklarini kur
echo [2/3] Backend (Python) bagimliliklari kuruluyor...
cd backend
pip install -r requirements.txt

:: Sunuculari baslat
echo [3/3] Sunucular baslatiliyor...
echo Lutfen MongoDB'nin (mongodb://localhost:27017) calistigindan emin olun!
echo (Kapatmak icin bu pencereyi kapatmaniz yeterli)

:: Uvicorn'u ayri bir pencerede baslat
start cmd /k "title Backend API && uvicorn main:app --reload --port 8000"

:: Frontend'i (Vite) ayni pencerede baslat
cd ..
npm run dev
