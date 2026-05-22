# ContentFlow — Foydalanuvchi Qo'llanmasi

> GitHub: [https://github.com/devAsliddin/contentflow](https://github.com/devAsliddin/contentflow)

---

## ContentFlow nima?

**ContentFlow** — bu ijtimoiy tarmoqlarga kontent joylashtirishni avtomatlashtiruvchi vosita.  
Bir joydan Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube va Twitter'ga post rejalashtirish va yuborish imkonini beradi.  
Bundan tashqari, AI yordamida kontent g'oyalari, sarlavhalar va haftalik rejalar tayyorlaydi.

---

## Kirish va Ro'yxatdan o'tish

### Ro'yxatdan o'tish
1. Saytni oching va **"Sign up"** tugmasini bosing
2. To'liq ismingizni kiriting (kamida 2 ta harf)
3. Email manzilingizni kiriting
4. Kuchli parol o'ylab toping — parol quyidagi talablarga javob berishi kerak:
   - Kamida **8 ta belgi**
   - Kamida **1 ta bosh harf** (A–Z)
   - Kamida **1 ta raqam** (0–9)
   - Kamida **1 ta maxsus belgi** (`!@#$%` va h.k.)
5. Parolni qayta kiriting (tasdiqlash uchun)
6. **"Create account"** tugmasini bosing

> Parolni kiritayotganda ko'z belgisi (`👁`) orqali parolni ko'rsatish/yashirish mumkin.

### Kirish (Login)
1. **"Sign in"** sahifasiga o'ting
2. Email va parolni kiriting
3. **"Sign in"** tugmasini bosing

> Agar 10 marta noto'g'ri urinish bo'lsa, 1 daqiqaga bloklash amalga oshadi.

---

## Asosiy Sahifalar

### Dashboard (Bosh sahifa)
- Joriy haftadagi post statistikasi
- Yaqin soatdagi rejalashtirilgan postlar
- AI tomonidan taklif qilingan g'oyalar
- Platformalar bo'yicha ko'rsatkichlar

### Yangi Post Yaratish

1. Chap menuda **"New Post"** tugmasini bosing
2. Sarlavha (caption) yozing yoki AI'dan so'rang
3. Rasm yoki video yuklang:
   - Rasm: JPG, PNG, WebP — max **20 MB**
   - Video: MP4, MOV — max **500 MB**
4. Platformalarni tanlang (Instagram, Telegram, TikTok va h.k.)
5. Vaqt belgilang:
   - **Hozir yuborish** — "Post now" ni tanlang
   - **Keyin yuborish** — sanani va vaqtni tanlang
6. **"Schedule"** tugmasini bosing

### Postlar ro'yxati
- **Drafts** — saqlab qo'yilgan, yuborilmagan postlar
- **Calendar** — kontent kalendari ko'rinishi
- **Approval** — tasdiqlash kutayotgan postlar

### Hisoblar (Accounts)
Ijtimoiy tarmoq hisoblarini ulash:
1. **"Accounts"** sahifasiga o'ting
2. **"Connect account"** tugmasini bosing
3. Platformani tanlang va kerakli ma'lumotlarni kiriting:
   - **Telegram**: Bot token va kanal ID
   - **Instagram**: Access token va hisob ID
   - **TikTok**: Access token va Open ID
4. **"Connect"** tugmasini bosing

### Analytics (Tahlil)
- Haftalik/oylik post statistikasi
- Har bir platforma bo'yicha muvaffaqiyat/xato ko'rsatkichlari
- Eng ko'p ishlagan vaqtlar va platformalar

### AI Asistant

#### Kontent Rejasi
1. **"AI Plan"** sahifasiga o'ting
2. Niche (soha) kiriting: masalan, "cooking", "fitness", "tech"
3. Haftalik post sonini belgilang
4. Ton tanlang: Professional / Casual / Humorous / Educational
5. Platformalarni tanlang
6. **"Generate Plan"** tugmasini bosing
7. AI 7 kunlik kontent rejasi tayyorlaydi

#### Caption Yaratish
- Post yaratishda **"AI Caption"** tugmasini bosing
- Mavzu va ton kiriting — AI avtomatik sarlavha tayyorlaydi

#### AI Chat
- **"AI Chat"** sahifasida istalgan savol bering
- Kontent strategiyasi, hashtag taklifi, post g'oyalari haqida so'rang

### Shablonlar (Templates)
- Ko'p ishlatiladigan post formatlarini shablon sifatida saqlash
- Bir tugmachada shablondan yangi post yaratish

### Sozlamalar (Settings)
- Profilni tahrirlash (ism)
- Bildirishnomalar sozlash

---

## Postlar Holatlari

| Holat | Ma'nosi |
|-------|---------|
| `draft` | Saqlab qo'yilgan, rejalashtirilmagan |
| `scheduled` | Rejalashtirilgan, vaqt kutilmoqda |
| `publishing` | Hozir yuborilmoqda |
| `published` | Muvaffaqiyatli yuborildi |
| `failed` | Yuborishda xato yuz berdi |

---

## Tez-tez so'raladigan savollar

**Postim "failed" bo'lib qoldi — nima qilishim kerak?**  
Hisoblar (Accounts) sahifasiga o'ting va hisob haqiqiyligini tekshiring. Token eskirgan bo'lishi mumkin — qayta ulang.

**AI kontent rejasi tuzib bermaydi?**  
Server AI modeli (Ollama) ishlamasligi mumkin. Administrator bilan bog'laning.

**Bir vaqtda nechta platformaga post joylashim mumkin?**  
Cheklov yo'q — barcha ulangan platformalarni bir vaqtda tanlash mumkin.

**Video yuklanmayapti?**  
Video 500 MB dan oshmasligi va MP4 yoki MOV formatida bo'lishi kerak.

---

## Qo'llab-quvvatlash

Muammo yuzaga kelsa — GitHub'da issue oching:  
[https://github.com/devAsliddin/contentflow/issues](https://github.com/devAsliddin/contentflow/issues)
