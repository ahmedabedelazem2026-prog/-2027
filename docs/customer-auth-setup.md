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
