<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/models/Banner.webp">
    <img alt="نظام البث الشامل لديسكورد" src="public/models/Banner.webp" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://discord.com/users/1188494987520909422">
    <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/>
  </a>
  <a href="https://github.com/kaennn9">
    <img src="https://img.shields.io/badge/GitHub-171515?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/>
  </a>
  <a href="https://github.com/YOUR_USERNAME/discord-broadcast-system/stargazers">
    <img src="https://img.shields.io/github/stars/YOUR_USERNAME/discord-broadcast-system?style=for-the-badge&color=FFD700&labelColor=1A1A1A" alt="Stars"/>
  </a>
</p>

<h1 align="center">نظام البث الشامل لديسكورد</h1>

<p align="center">
  <strong>نظام Full-Stack احترافي لإدارة وتشغيل عدة بوتات ديسكورد مع توزيع ذكي لحمل الرسائل الخاصة (DMs)</strong>
</p>

<p align="center">
  <img src="https://img.icons8.com/fluency/48/node-js.png" width="38" alt="Node.js"/> 
  <strong>Node.js • Express • Socket.io</strong> • 
  <img src="https://img.icons8.com/fluency/48/discord.png" width="38" alt="Discord"/> 
  <strong>discord.js</strong>
</p>

---

## ✨ المميزات الرئيسية

- **تشغيل متعدد البوتات**: بوت أساسي + بوتات مساعدة (Helper Bots)
- **توزيع حمل ذكي**: 3 أنماط (Smart • Random • Both)
- **حماية من Rate Limits** والباند
- **لوحة تحكم مظلمة** بتصميم Discord-like + Glassmorphism
- **نظام أمان قوي**: Owner + Guest Access مع **Device Fingerprint Lock**
- **كونسول ذكي** مع شريط تقدم وتقدير وقت ذكي (ETA)
- **مراقبة أخطاء متقدمة** (BotFailureL) مع Webhook ونسخ احتياطية
- **دعم كامل للغة العربية** (RTL)

---

## 📂 هيكل المجلدات

```text
ejs/
├── data/db.db
├── public/
│   ├── css/style.css
│   ├── models/Banner.webp
│   └── models/views.png
├── src/
│   ├── BotFailureL.js
│   ├── botManager.js
│   ├── db.js
│   ├── index.js
│   ├── routes.js
│   └── utils.js
├── views/
│   ├── index.ejs
│   ├── server.ejs
│   ├── login.ejs
│   └── invite.ejs
├── .env
├── package.json
└── README.md
```

---

## 🛠️ نظرة تقنية على الملفات

### `src/index.js`
تهيئة Express + Socket.io + Auto-start للبوتات عند تشغيل السيرفر.

### `src/botManager.js`
إدارة كاملة للبوتات (تشغيل/إيقاف/Avatar/Presence).

### `src/utils.js`
- `SmartTimeEstimator` (تقدير الوقت الذكي)
- `SmartConsoleLogger` (تحديث ذكي كل 6 ثوانٍ)

### `src/BotFailureL.js`
نظام مراقبة الأخطاء الحرجة مع تسجيل، نسخ احتياطية، وإشعارات.

### `src/routes.js`
جميع الـ APIs مع حماية Owner/Guest + Blacklist + Invite System.

### `views/server.ejs`
أقوى لوحة تحكم تحتوي على:
- Chart.js إحصائيات
- نموذج البث
- إدارة Helper Bots
- كونسول حي
- Blacklist
- نظام دعوات الضيوف

---

## ⚡ آلية البث

```mermaid
graph TD
    A[بدء البث] --> B[تصفية + Blacklist]
    B --> C[تحديد البوتات]
    C --> D{نمط التوزيع}
    D --> E[Smart / Random / Both]
    E --> F[Workers متوازية]
    F --> G[تأخير + Socket.io]
```

---

## 🚀 التثبيت والتشغيل

```bash
git clone https://github.com/YOUR_USERNAME/discord-broadcast-system.git
cd discord-broadcast-system

npm install

# إعداد الملفات البيئية
cp .env.example .env
```

**`.env` مثال:**
```env
PORT=3000
MASTER_PASSWORD=admin123admin123
# WEBHOOK_URL=your_webhook_here
```

```bash
# تشغيل التطوير
npm run dev

# تشغيل الإنتاج
npm start
```

ثم افتح: `http://localhost:3000`

---

## 📸 لقطات الشاشة

![لوحة التحكم](public/models/views.png)

*(أضف المزيد من الصور هنا بعد رفعها)*

---

<p align="center">
  <a href="https://github.com/kaennn9/discord-broadcast-system">
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
    <strong>إذا أعجبك المشروع، لا تنسَ تعطيه ⭐</strong>
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
  </a>
</p>

<p align="center">
  <strong>صنع بحب لمجتمع ديسكورد العربي</strong>
</p>

**License**: MIT © [YOUR NAME](https://github.com/kaennn9)
```

---"Known Issues" أو أي تعديل آخر؟
