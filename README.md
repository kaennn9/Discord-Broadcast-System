<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/kaennn9/embedskaen/blob/main/assets/banner-dark.png?raw=true">
    <img alt="Discord Broadcast System Banner" src="https://github.com/kaennn9/embedskaen/blob/main/assets/banner-light.png?raw=true" width="100%">
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

<h1 align="center">
  <img src="https://img.icons8.com/fluency/48/broadcasting.png" alt="broadcast" width="38"/>
  نظام البث الشامل لديسكورد
</h1>

<p align="center">
  <strong>نظام Full-Stack احترافي لإدارة وتشغيل عدة بوتات ديسكورد مع توزيع حمل البث الخاص (DMs) بذكاء وسرعة فائقة</strong>
</p>

<p align="center">
  <img src="https://img.icons8.com/fluency/48/node-js.png" alt="Node.js" width="38"/>
  <strong>Node.js + Express + Socket.io</strong> • 
  <img src="https://img.icons8.com/fluency/48/discord.png" alt="Discord" width="38"/>
  <strong>discord.js</strong> • 
  <img src="https://img.icons8.com/fluency/48/database.png" alt="Database" width="38"/>
  <strong>Local JSON DB</strong>
</p>

---

## ✨ المميزات الرئيسية

| الميزة                        | الوصف                                              |
|-------------------------------|---------------------------------------------------|
| **بوتات متعددة**             | تشغيل بوت أساسي + بوتات مساعدة (Helpers)        |
| **توزيع ذكي للحمل**          | Smart / Random / Both Systems                     |
| **حماية من Rate Limits**     | تأخير ذكي + توزيع متوازي                           |
| **لوحة تحكم مظلمة**          | تصميم Discord-like + Glassmorphism                |
| **دخول آمن**                  | Owner + Guest Access مع Device Fingerprint Lock   |
| **كونسول ذكي**               | تحديث كل 6 ثوانٍ + شريط تقدم + ETA               |
| **مراقبة الأخطاء**           | BotFailureL مع إشعارات Webhook ونسخ احتياطية     |
| **دعم RTL**                   | واجهة عربية كاملة                                |

---

## 📂 هيكل المجلدات

```text
ejs/
├── data/
│   └── db.db                     # قاعدة البيانات المحلية (JSON)
├── public/
│   ├── css/
│   │   └── style.css
│   ├── models/                   # الصور والبنرات
│   └── uploads/                  # رفع الصور المؤقت
├── src/
│   ├── BotFailureL.js
│   ├── botManager.js
│   ├── db.js
│   ├── index.js
│   ├── routes.js
│   └── utils.js
├── views/
│   ├── index.ejs
│   ├── invite.ejs
│   ├── login.ejs
│   └── server.ejs
├── .env
├── main.py                       # ربط Spotify (اختياري)
├── package.json
└── README.md
```

---

## 🛠️ شرح الملفات البرمجية

### `src/index.js`
نقطة بداية التطبيق. يقوم بتهيئة Express + Socket.io + EJS وتشغيل البوتات تلقائياً عند إعادة تشغيل السيرفر.

### `src/db.js`
قاعدة بيانات محلية بسيطة وقوية تعتمد على JSON.

### `src/botManager.js`
مدير البوتات: تشغيل، إيقاف، تحديث الـ Avatar والـ Presence.

### `src/utils.js`
دوال مساعدة + **SmartTimeEstimator** + **SmartConsoleLogger**.

### `src/BotFailureL.js`
نظام مراقبة الأخطاء الحرجة مع تسجيل، نسخ احتياطية، وإشعارات.

### `src/routes.js`
جميع الـ APIs والمسارات مع نظام حماية Owner/Guest.

---

## ⚡ آلية البث

```mermaid
graph TD
    A[بدء البث] --> B[تصفية الأعضاء + Blacklist]
    B --> C[تحديد البوتات النشطة]
    C --> D{نمط التوزيع}
    D -->|Smart| E[تقسيم متتالي]
    D -->|Random| F[توزيع عشوائي]
    D -->|Both| G[Shuffle + تقسيم]
    E --> H[Workers متوازية]
    F --> H
    G --> H
    H --> I[تأخير + Socket.io Logs]
```

---

## 🔒 الأمان والضيوف

- **Owner Access**: كلمة مرور رئيسية.
- **Guest Access**: روابط دعوة مؤقتة (24 ساعة) مقفلة بـ **Device Fingerprint**.
- **Blacklist** محلية لكل سيرفر.

---

## 🚀 التثبيت

### المتطلبات
- Node.js v18+
- حساب Discord Developer

### خطوات التشغيل

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/discord-broadcast-system.git
cd discord-broadcast-system

# 2. تثبيت الاعتماديات
npm install

# 3. إعداد .env
cp .env.example .env
```

**مثال على `.env`**:
```env
PORT=3000
MASTER_PASSWORD=admin123admin123
# WEBHOOK_URL= (اختياري)
```

```bash
# تشغيل في وضع التطوير
npm run dev

# تشغيل الإنتاج
npm start
```

افتح المتصفح على `http://localhost:3000`

---

## 📸 صور توضيحية

*(أضف صور شاشة حقيقية هنا بعد رفعها)*

---

<p align="center">
  <a href="https://github.com/YOUR_USERNAME/discord-broadcast-system">
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
    <strong>إذا أعجبك المشروع، لا تنسَ تعطيه ⭐</strong>
    <img src="https://img.icons8.com/ios-filled/50/FFD700/star.png" alt="Star"/>
  </a>
</p>

<p align="center">
  <strong>صنع بحب لمجتمع ديسكورد العربي</strong><br>
  <img src="https://img.icons8.com/fluency/48/sparkling.png" alt="sparkles"/>
</p>

---

**License**: MIT © [YOUR NAME](https://github.com/kaennn9)
```
هل تريد تعديل أي قسم إضافي أو إضافة ميزات جديدة؟
