# إعداد تسجيل دخول العميل

## ما أُضيف
- عميل Firebase مشترك في `packages/firebase/src/client.ts`.
- تسجيل دخول العميل بواسطة Google من واجهة تطبيق العميل.
- إنشاء ملف `users/{uid}` لأول تسجيل دخول بدور `customer` فقط.
- إعداد Firebase Functions على المنطقة `europe-west1`.

## إعداد Firebase Console
1. افتح مشروع Firebase الصحيح من Firebase Console.
2. من Authentication > Sign-in method فعّل Google.
3. من Authentication > Settings > Authorized domains أضف نطاق الموقع المنشور ونطاق المعاينة عند الحاجة.
4. أنشئ قاعدة Firestore في وضع الإنتاج، ثم راجع قواعد المستودع قبل النشر.
5. من Project settings > General > Your apps انسخ إعدادات تطبيق الويب.

## إعدادات مشروع تاكسي العاصمة

تم استلام إعدادات تطبيق الويب الأحدث للمشروع التالي:
- `projectId`: `taxi-alasema-app-2026`
- `authDomain`: `taxi-alasema-app-2026.firebaseapp.com`
- `messagingSenderId`: `343674981534`
- `appId`: `1:343674981534:web:3e4b8974e18d294407bf8f`

هذا `appId` هو الخاص بتسجيل تطبيق ويب مختلف عن `appId` الذي أُرسل سابقاً (`1:343674981534:web:da9dbe1c000999b107bf8f`). كلاهما تابع لنفس مشروع Firebase، لكن يجب استخدام `appId` المطابق لتطبيق الويب الذي تريد ربطه بالموقع. في هذا الدليل اعتمدنا الإعداد الأحدث الذي أرسلته الآن. اربط هذه القيم بمتغيرات البيئة المقابلة أدناه. لا نضع `apiKey` داخل ملفات Git؛ أضفه مباشرة في إعدادات البيئة في Vercel أو في `.env.local` على جهازك. مفتاح Firebase للويب ليس مفتاح Admin، لكن يُفضّل تقييده من Google Cloud حسب المواقع وواجهات API التي يحتاجها التطبيق.

ملاحظة: الإعداد المرسل يحتوي أيضاً `databaseURL` لـ Realtime Database، لكن الكود الحالي للموقع يستخدم **Cloud Firestore** (`getFirestore`) وليس Realtime Database؛ لذلك لا يكفي وجود رابط Realtime Database لتشغيل الرحلات. تأكد من إنشاء Firestore في مشروع Firebase نفسه.

## متغيرات البيئة
انسخ `.env.example` إلى `.env.local` محلياً، وأدخل القيم من إعدادات تطبيق الويب:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (إن وُجد)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (إن وُجد)

في Vercel أضف القيم نفسها إلى Environment Variables لكل بيئة تحتاجها، ثم أعد النشر. هذه مفاتيح إعداد عميل Firebase وليست مفاتيح خادم؛ لا تضع مفاتيح Admin SDK أو أسرار Google الخاصة بالخادم في متغيرات NEXT_PUBLIC.

## ما لم يُفعّل بعد
نجاح تسجيل الدخول لا يعني أن الحجز أصبح متاحاً. لا بد من إضافة اختيار مواقع موثوق للانطلاق والوجهة، ثم استدعاء `createTrip` ومتابعة مستند الرحلة، وإعداد App Check قبل إطلاق وظائف Callable المحمية به. لا ترسل طلبات وهمية إلى السائقين قبل إتمام هذه الخطوات واختبارها.


## بوابة السائق واستقبال العروض
- أضيفت وظيفة setDriverAvailability لتغيير حالة السائق إلى متصل أو غير متصل من الخادم فقط، مع التحقق من اعتماد الحساب.
- أصبحت العروض تُنسخ إلى driverOffers/{driverId}/items/{tripId} حتى يستطيع السائق قراءة عروضه دون استعلام غير مسموح على عروض الرحلات.
- عند قبول سائق للرحلة، تُحدّث حالة عرضه إلى مقبول وتُغلق العروض المعلقة الموجهة لباقي السائقين.
- يلزم إنشاء مستند drivers/{uid} واعتماده من الإدارة قبل أن يتمكن السائق من الاتصال واستقبال الطلبات.
- جميع وظائف Callable ما زالت تشترط App Check؛ يجب إعداد App Check قبل اختبارها من الواجهة.
