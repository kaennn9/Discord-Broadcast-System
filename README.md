<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/models/Banner.webp">
    <img alt="نظام البث الشامل لديسكورد" src="public/models/Banner.webp" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://discord.com/users/640239524361797699">
    <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/>
  </a>
  <a href="https://github.com/kaennn9/discord-broadcast-system">
    <img src="https://img.shields.io/badge/GitHub-171515?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/>
  </a>
  <a href="https://github.com/kaennn9/discord-broadcast-system/stargazers">
    <img src="https://img.shields.io/github/stars/kaennn9/discord-broadcast-system?style=for-the-badge&color=FFD700&labelColor=1A1A1A" alt="Stars"/>
  </a>
</p>

<h1 align="center">نظام البث الشامل لديسكورد</h1>

<p align="center">
  <strong>نظام Full-Stack احترافي متطور لإدارة وتشغيل عدة بوتات ديسكورد مع توزيع ذكي ومتوازي لحمل الرسائل الخاصة (DMs)</strong>
</p>

<p align="center">
  <img src="https://img.icons8.com/fluency/48/node-js.png" width="38" alt="Node.js"/> 
  <strong>Node.js • Express • Socket.io</strong> • 
  <img src="https://img.icons8.com/fluency/48/discord.png" width="38" alt="Discord"/> 
  <strong>discord.js</strong> • 
  <strong>EJS + Chart.js</strong>
</p>

---

## ✨ المميزات الرئيسية

- **تشغيل متعدد البوتات** — بوت رئيسي + عدد غير محدود من البوتات المساعدة (Helper Bots)
- **3 أنماط توزيع ذكية** — Smart • Random • Both (الأفضل لتجنب الكشف)
- **حماية متقدمة من Rate Limits** والباند
- **لوحة تحكم مظلمة فاخرة** بتصميم مستوحى من Discord + Glassmorphism + تأثيرات متحركة
- **نظام أمان قوي** — Owner Access + Guest Access مع **Device Fingerprint Lock**
- **كونسول حي ذكي** — تحديث تلقائي + شريط تقدم + تقدير وقت ذكي (ETA)
- **مراقبة أخطاء متقدمة** (BotFailureL) — تسجيل + نسخ احتياطية + Webhook Notifications
- **دعم كامل للغة العربية** (RTL) + تصميم متجاوب
- **تأثيرات متحركة** — أزرار Hover، Modals سلسة، Progress Bar متحرك، Sidebar متحرك، Glass Effects
- **Chart.js إحصائيات حية** — رسوم بيانية متحركة للأعضاء والحالة
- **Blacklist محلية** لكل سيرفر
- **نظام دعوات ضيوف آمن** (24 ساعة + قفل بصمة الجهاز)
- **Auto-Start** للبوتات عند إعادة تشغيل السيرفر
- **تحديث Avatar & Presence** مباشرة من اللوحة

---

## 📂 هيكل المجلدات

```text
ejs/
├── data/db.db
├── public/
│   ├── css/style.css
│   └── models/
│       ├── Banner.webp
│       ├── views.png
│       └── views2.png
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
تهيئة الخادم + Socket.io + Auto-start للبوتات.

### `src/botManager.js`
إدارة كاملة لدورة حياة البوتات (Start / Stop / Avatar / Presence).

### `src/utils.js`
- `SmartTimeEstimator` — تقدير وقت ذكي
- `SmartConsoleLogger` — كونسول ذكي (تحديث كل 6 ثوانٍ)

### `src/BotFailureL.js`
نظام مراقبة الأخطاء الحرجة مع إشعارات ونسخ احتياطية.

### `src/routes.js`
جميع APIs + حماية + Blacklist + Invite System + Cache.

### `views/server.ejs`
لوحة التحكم المتكاملة:
- إحصائيات Chart.js متحركة
- نموذج البث المتقدم
- إدارة Helper Bots (Modals)
- كونسول حي ملون
- Blacklist Panel
- Share Access Modal

---

## ⚡ آلية البث

```mermaid
graph TD
    A[بدء البث] --> B[تصفية الأعضاء + Blacklist]
    B --> C[تحديد البوتات النشطة]
    C --> D{نمط التوزيع}
    D --> E[Smart / Random / Both]
    E --> F[Workers متوازية]
    F --> G[تأخير ذكي + Socket.io Logs]
    G --> H[Progress + ETA + Live Console]
```

---

## 🚀 التثبيت والتشغيل

```bash
git clone https://github.com/kaennn9/discord-broadcast-system.git
cd discord-broadcast-system

npm install

# إنشاء ملف البيئة
cp .env.example .env
```

**مثال `.env`**:
```env
PORT=3000
MASTER_PASSWORD=admin123admin123
# WEBHOOK_URL=https://discord.com/api/webhooks/...
```

```bash
# تطوير (مع إعادة تحميل تلقائي)
npm run dev

# إنتاج
npm start
```

افتح المتصفح على: `http://localhost:3000`

---

## 📸 لقطات الشاشة

![لوحة التحكم الرئيسية](public/models/views.png)

![لوحة تحكم السيرفر - البث والكونسول](public/models/views2.png)

*(أضف المزيد من الصور بعد رفعها على GitHub)*

---

<p align="center">
  <a href="https://github.com/kaennn9/discord-broadcast-system">
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
    <strong>إذا أعجبك المشروع، لا تنسَ تعطيه ⭐</strong>
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
  </a>
</p>

<p align="center">
  <strong>صنع بحب لمجتمع ديسكورد العربي</strong><br>
  <img src="https://img.icons8.com/fluency/48/sparkling.png" alt="sparkles"/>
</p>

**License**: MIT © [YOUR NAME](https://github.com/kaennn9)

---
