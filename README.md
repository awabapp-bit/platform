# منصة أواب الإلكترونية — موقع المستخدم

هذا موقع مستقل بالكامل (لا يعتمد على أي ملفات خارج هذا المجلد غير Firebase). صفحاته:

| الملف | الوظيفة |
|---|---|
| `index.html` | تسجيل الدخول (نقطة الدخول) |
| `register.html` | إنشاء حساب |
| `home.html` | الرئيسية: كل المسابقات |
| `account.html` | الحساب الشخصي |
| `competition.html?id=...` | صفحة الكورس: صورة + اسم + محاضرات أكورديون |
| `video.html` | فيديو واحد + تعليقات + مشاركة |
| `exam.html` | اختبار واحد (محاولة وحيدة) |

## الملفات المطلوبة بجانب الصفحات (كل حاجة في نفس المستوى، مفيش مجلدات فرعية)
```
awab-user-site/
├── logo.png
├── style.css
├── firebase-config.js
├── icons.js
├── password-rules.js
├── app-shell.js
└── *.html (index, register, home, account, competition, video, exam)
```

## ⚠️ قبل الاستخدام
1. Firebase Console ← Authentication ← Settings ← Authorized domains ← أضف نطاق نشر هذا الموقع.
2. Firebase Console ← Realtime Database ← Rules ← الصق محتوى `firebase-rules.json` الموجود في موقع لوحة التحكم (نفس القواعد تخدم الموقعين لأنهما يشتركان في نفس مشروع Firebase).

## روابط تحتاج تحديثها لاحقًا
داخل `app-shell.js` بدالة `renderFooter()`: رابط قناة الواتساب ورابط تحميل التطبيق حاليًا `href="#"`.
داخل نفس الملف بدالة `renderBlockedNotice()`: رابط "تواصل مع الدعم الفني" حاليًا `href="#"`.

## النشر
ارفع محتويات هذا المجلد كاملة (بما فيها `css/` و`js/` و`logo.png`) كموقع مستقل (GitHub Pages، Netlify، إلخ). هذا الموقع منفصل تمامًا عن موقع لوحة تحكم المسؤول — كل واحد بريبو/استضافة خاصة به.
