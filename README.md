# 📱 Mobile Hub — نظام إدارة محلات الموبايل

نظام متكامل لإدارة محلات بيع وصيانة الموبايل في الأردن.  
مبني بـ Vanilla JS + Firebase Firestore.

---

## 🗂️ هيكل المشروع

```
mobilehub/
├── index.html              ← صفحة تسجيل الدخول
├── app.html                ← الواجهة الرئيسية
├── track.html              ← تتبع الأجهزة (عامة للزبائن)
│
├── src/
│   ├── css/
│   │   ├── variables.css   ← متغيرات التصميم
│   │   ├── base.css        ← إعادة الضبط والأساسيات
│   │   ├── components.css  ← المكونات المشتركة
│   │   ├── sidebar.css     ← الشريط الجانبي
│   │   └── responsive.css  ← التجاوب مع الشاشات
│   └── js/
│       ├── firebase.js     ← تهيئة Firebase
│       ├── auth.js         ← المصادقة والصلاحيات
│       ├── router.js       ← التنقل بين الموديولات
│       ├── state.js        ← الحالة المشتركة
│       └── utils.js        ← أدوات مساعدة
│
└── modules/
    ├── maintenance/        ← الصيانة
    ├── pos/                ← نقطة البيع
    ├── purchases/          ← المشتريات
    ├── warehouse/          ← المستودع
    ├── hr/                 ← الموارد البشرية
    ├── reports/            ← التقارير
    └── settings/           ← الإعدادات
```

---

## 🚀 التشغيل المحلي

```bash
# تحتاج web server لأن الملفات ES Modules
# الخيار الأسهل:
npx serve .

# أو مع Python:
python -m http.server 8000

# أو VS Code Live Server
```

> ⚠️ لا تفتح `index.html` مباشرة في المتصفح — ES Modules تحتاج HTTP server.

---

## 🔥 Firebase Setup

1. فعّل **Authentication → Email/Password**
2. أنشئ **Firestore Database**
3. طبّق الـ Rules الموجودة في `firestore.rules`
4. أنشئ أول مستخدم مدير عبر Firebase Console أو سكريبت الإعداد

---

## 👤 الأدوار

| الدور | الصلاحيات |
|-------|-----------|
| `admin` | كامل الصلاحيات |
| `tech` | صيانة — أجهزته فقط |
| `cashier` | POS + صيانة |

---

## 📦 الموديولات

| الموديول | الوصف |
|----------|-------|
| 🔧 الصيانة | استقبال الأجهزة، تتبع الإصلاح، إشعار الزبون |
| 🛒 POS | نقطة البيع، الفواتير، إدارة السلة |
| 📦 مشتريات البضاعة | تسجيل البضاعة الواردة |
| 🏪 مشتريات أخرى | مصروفات المحل التشغيلية |
| 🏭 المستودع | إدارة المخزون، تنبيهات النفاد، حركة البضاعة |
| 👥 HR | رواتب، حضور، ضمان اجتماعي |
| 📈 التقارير | P&L شامل، KPIs، أفضل المنتجات |
| ⚙️ الإعدادات | بيانات المحل، إدارة الموظفين |

---

## 🛠️ التقنيات

- **Frontend:** Vanilla JS (ES Modules), CSS Variables
- **Backend:** Firebase Firestore (realtime)
- **Auth:** Firebase Authentication
- **Fonts:** Cairo (Arabic), JetBrains Mono
- **Hosting:** GitHub Pages / Firebase Hosting

---

## 📝 ملاحظات مهمة

- جميع السنوات تبدأ من **2026**
- العملة: **دينار أردني (د.أ)**
- الضمان الاجتماعي: موظف **7.5%** + صاحب عمل **14.25%**
- البيانات تُحفظ تلقائياً في Firestore
- يعمل offline ويتزامن عند عودة الاتصال

---

© 2026 Mobile Hub — باسل
