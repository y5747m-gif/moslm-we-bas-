"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  Smartphone,
  Droplets,
  Eye,
  Volume2,
  BellRing,
  Check,
  Camera,
  Download,
  Moon,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Sparkles,
  Play,
  RotateCcw,
  MapPin,
  Star,
  Timer,
  Vibrate,
  User,
  AlarmClock,
  X,
  Settings,
  Battery,
  Wifi,
  Signal,
  HardDrive,
  WifiOff,
  Bell,
  ArrowDown,
  MoreVertical,
  Sun,
  Globe,
  Heart,
} from "lucide-react";
import { verifyCapture, warmUpVerification, type VerifyTask } from "../lib/verify";
import { decideAlarm, computeNextRing, getTodayKey } from "../lib/schedule";
import { checkCritical, enforceRinging, relaxAfterRinging, openNativeAppOr } from "../lib/permissions";
import PermissionsPanel from "./components/PermissionsPanel";
import QRCode from "react-qr-code";
import type { VisionCheck } from "../lib/vision";
import {
  isNativeApp as checkNativeApp,
  isAndroidDevice,
  isIosDevice,
  nativeSpeak,
  stopNativeSpeech,
  scheduleNativeAlarm,
  cancelNativeAlarm,
  notifyNative,
  requestNativePermissions,
  guardBackButtonWhileRinging,
  onNativeAlarmTap,
  hatAlarmSchedule,
  hatAlarmCancel,
  hatAlarmStop,
  hatAlarmStart,
  hatAlarmState,
  getApkInfo,
  downloadApk,
  triggerBlobDownload,
  APK_RELEASE_URL,
  type ApkInfo,
} from "../lib/native";

type AlarmStage = "idle" | "ringing" | "annoying" | "extreme" | "verification" | "completed";
type VerificationId = "water" | "prayer" | "face";
type Language = "ar" | "en";
type Theme = "light" | "dark";

interface VerificationTask {
  id: VerificationId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  completed: boolean;
  image: string | null;
}

const translations = {
  ar: {
    appName: "هتصلي يعني هتصلي",
    appNameShort: "هتصلي",
    appSub: "منبه الفجر الذكي",
    tagline: "منبه الفجر الذكي الأول من نوعه",
    taglineInstalled: "مثبت على هاتفك ويعمل بدون إنترنت",
    taglineReady: "قابل للتثبيت على الهاتف - يعمل بدون إنترنت",
    heroTitle1: "منبه يثبت على هاتفك",
    heroTitle2: "ولا يتركك حتى تصلي",
    heroDesc: "حمّل التطبيق بضغطة واحدة، يثبت كتطبيق أصلي على هاتفك، يناديك باسمك، يتصاعد بالإزعاج، ويعمل حتى لو كان الهاتف صامت أو بدون إنترنت.",
    duaSentence: "تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍",
    feature1: "يثبت كتطبيق أصلي",
    feature2: "يعمل بدون نت",
    feature3: "ينبه حتى لو مغلق",
    featureName: "يناديك باسمك",
    featureEscalate: "تصعيد مزعج تدريجي",
    featureCamera: "تحقق بالتصوير",
    tryNow: "جرّب المنبه الآن",
    downloadPhone: "حمّل على هاتفك",
    installNow: "ثبّت المنبه على هاتفك الآن",
    installedBadge: "مثبت على هاتفك ✓ المنبه يعمل الآن حتى بدون إنترنت",
    installedShort: "مثبت ✓",
    installedOnPhone: "مثبت على الهاتف",
    readyToInstall: "جاهز للتثبيت",
    installBannerTitle: "ثبت منبه هتصلي على هاتفك الآن 📲",
    installBannerDesc: "يعمل بدون إنترنت وينبهك حتى لو المتصفح مغلق",
    installBtn: "ثبّت الآن",
    howItWorks: "كيف يعمل",
    step1Title: "ثبّت بضغطة واحدة",
    step1Desc: "اضغط زر التثبيت، سيظهر لك إشعار تثبيت التطبيق كأي تطبيق أصلي من متجر التطبيقات",
    step1Time: "تثبيت فوري",
    step2Title: "يناديك باسمك ثم يزعجك",
    step2Desc: "يبدأ بنداء لطيف باسمك، بعد 5 دقائق جرس مزعج، بعد 10 دقائق كابوس لا يحتمل حتى تستيقظ",
    step2Time: "تصعيد ذكي",
    step3Title: "يتحقق بالتصوير",
    step3Desc: "لن يتوقف حتى تصور صنبور المياه والمصلاة ووجهك وعيناك مفتوحتان لإثبات أنك مستيقظ",
    step3Time: "تحقق إجباري",
    demoTitle: "اضبط اسمك وثبّت المنبه الآن",
    demoDesc: "أدخل اسمك ووقت المنبه، ثم اضغط تثبيت - سيصبح تطبيق أصلي على هاتفك يعمل بدون إنترنت",
    settings: "إعدادات المنبه",
    fastMode: "وضع التجربة السريعة",
    maleVoice: "صوت رجل 👨",
    maleVoiceDesc: "يناديك بصوت رجل عميق وواضح - مستمر حتى التحقق",
    aiAnalyzing: "جاري التحليل بالذكاء الاصطناعي... 🤖",
    aiCheckingWater: "يفحص صنبور المياه... 🚰",
    aiCheckingPrayer: "يفحص سجادة الصلاة... 🕌",
    aiCheckingFace: "يفحص الوجه والعينين... 👁️",
    aiSuccessWater: "صنبور مياه حقيقي ✓",
    aiSuccessPrayer: "مصلاة حقيقية ✓",
    aiSuccessFace: "وجه وعينان مفتوحتان ✓",
    aiFailWater: "لا يبدو صنبور مياه، حاول مرة أخرى",
    aiFailPrayer: "لا يبدو مصلاة، حاول مرة أخرى",
    aiFailFace: "لم يتم التعرف على وجه أو العينان مغلقتان",
    aiFailNoFace: "لم يتم العثور على وجه",
    aiFailEyesClosed: "العينان مغلقتان - افتح عينيك جيداً!",
    aiConfidence: "نسبة الثقة",
    cameraPermission: "صلاحية الكاميرا مطلوبة 📷",
    cameraPermissionDesc: "يحتاج التطبيق لصلاحية الكاميرا للتحقق من استيقاظك ووضوئك",
    allowCamera: "السماح بالكاميرا",
    cameraDenied: "تم رفض صلاحية الكاميرا",
    cameraDeniedDesc: "الرجاء السماح بالكاميرا من إعدادات المتصفح",
    cameraDeniedHint: "إن كنت رفضت سابقاً: اسمح للكاميرا من إعدادات المتصفح أو التطبيق ثم أعد المحاولة",
    cameraBusy: "الكاميرا مشغولة",
    cameraBusyDesc: "تطبيق آخر يستخدم الكاميرا - أغلقه ثم أعد المحاولة",
    cameraMissing: "لا توجد كاميرا",
    cameraMissingDesc: "تعذّر العثور على كاميرا - جرّب الرفع من المعرض",
    cameraRetry: "إعادة المحاولة",
    nextRing: "الرنين القادم",
    nextRingNone: "لا رنين مجدول - راجع الأيام والمدة",
    tapToOpenCamera: "اضغط لفتح الكاميرا",
    verificationSoundOn: "🔊 الصوت مستمر حتى إكمال التحقق",
    verificationProgress: "التحقق مستمر - الصوت لن يتوقف",
    aiPowered: "فحص بالذكاء الاصطناعي",
    yourName: "اسمك (سيناديك به المنبه)",
    namePlaceholder: "مثال: أحمد، محمد، فاطمة...",
    wakeTime: "وقت الاستيقاظ",
    installApp: "ثبّت المنبه على هاتفك الآن",
    installing: "جاري التثبيت على هاتفك...",
    installedSuccess: "تم التثبيت على هاتفك ✓",
    setOnly: "اضبط فقط",
    tryRing: "جرّب الرنين",
    alarmSet: "المنبه مضبوط على",
    willWake: "سيوقظ",
    ringingNow: "يرن الآن - نداء لطيف",
    annoyingMode: "وضع الإزعاج - جرس إنذار",
    nightmareMode: "وضع الكابوس - لا يُحتمل!",
    ringingSince: "يرن منذ",
    wokeUp: "استيقظت ✓",
    snooze: "غفوة",
    sec: "ث",
    min: "د",
    hello: "مرحباً",
    heroFajr: "يا بطل الفجر",
    nextAlarm: "المنبه القادم",
    faucet: "صنبور",
    prayerMat: "المصلاة",
    face: "الوجه",
    installStatus: "حالة التثبيت",
    notInstalled: "غير مثبت",
    installOnPhone: "ثبّت المنبه على الهاتف",
    set: "مضبوط",
    setYourTime: "مثبت ✓ اضبط وقتك",
    installFirst: "ثبّت أولاً ثم اضبط",
    wakeUpName: "استيقظ يا",
    getUpNow: "قم يا",
    wakeNow: "استيقظ الآن!!",
    fajrTime: "حان وقت صلاة الفجر",
    annoyingBell: "🔔 جرس إنذار مزعج",
    nightmare: "🚨 كابوس لا يُحتمل",
    willNotStop: "لن يتوقف حتى تثبت استيقاظك بالتصوير",
    proveWake: "إثبات الاستيقاظ",
    waterTap: "صنبور المياه",
    waterDesc: "صور صنبور المياه لإثبات الوضوء",
    prayerDesc: "صور سجادة الصلاة",
    faceDesc: "التقط صورة لوجهك وعيناك مفتوحتان",
    openCamera: "فتح الكاميرا",
    uploadFromGallery: "رفع من المعرض",
    aimWater: "وجّه الكاميرا نحو صنبور المياه",
    aimPrayer: "وجّه الكاميرا نحو المصلاة",
    aimFace: "انظر للكاميرا وافتح عينيك جيداً",
    capture: "التقاط",
    cancel: "إلغاء",
    confirm: "تأكيد",
    retake: "إعادة",
    waterDetected: "تم التعرف على صنبور المياه ✓ أحسنت الوضوء",
    prayerDetected: "تم التعرف على سجادة الصلاة ✓ تقبل الله",
    faceDetected: "تم التأكد أن عينيك مفتوحتان ✓ صباح النشاط!",
    done: "تم ✓",
    mayAllahAccept: "تقبل الله يا",
    wellDone: "أحسنت! أثبت استيقاظك ووضوءك",
    nowPray: "الآن قم لصلاة الفجر، فهي خير من النوم",
    wakeTimeLabel: "وقت الاستيقاظ",
    newAlarm: "منبه جديد",
    neverStops: "لن يتوقف حتى تثبت أنك مستيقظ حقاً",
    neverStopsDesc: 'بعد أن تضغط "أنا مستيقظ"، سيطلب منك التطبيق تصوير ثلاث أشياء للتأكد أنك قمت من السرير وتوضأت',
    waterStepTitle: "صنبور المياه",
    waterStepDesc: "صوّر صنبور المياه في الحمام لإثبات أنك قمت وتوضأت. لن يقبل صورة قديمة، يجب أن تكون مباشرة من الكاميرا.",
    prayerStepTitle: "المصلاة / سجادة الصلاة",
    prayerStepDesc: "صوّر مكان صلاتك أو سجادة الصلاة. هذا يثبت أنك ذهبت لمكان الصلاة ومستعد للصلاة.",
    faceStepTitle: "وجهك وعيناك مفتوحتان",
    faceStepDesc: "التقط سيلفي لوجهك وعيناك مفتوحتان بشكل واضح. يستخدم ذكاء اصطناعي للتأكد أنك لست نائماً وعيناك مفتوحتان.",
    step1: "الخطوة 1",
    step2: "الخطوة 2",
    step3: "الخطوة 3",
    directOnly: "تصوير مباشر فقط - لا يقبل صور المعرض",
    downloadSectionTitle: "ثبّت المنبه على هاتفك",
    downloadSectionInstalledTitle: "المنبه مثبت ويعمل!",
    downloadSectionSub: "بضغطة واحدة يصبح تطبيق",
    downloadSectionInstalledSub: "يعمل حتى بدون إنترنت",
    downloadSectionDesc: "اضغط زر التثبيت، سيظهر إشعار تثبيت التطبيق. بعد التثبيت، ستجد أيقونة هتصلي على شاشتك الرئيسية، يعمل حتى لو كان الهاتف صامت وبدون إنترنت.",
    downloadSectionInstalledDesc: "ممتاز! المنبه الآن مثبت على هاتفك كتطبيق أصلي. سيوقظك حتى لو كان المتصفح مغلق أو بدون إنترنت.",
    installNowBtn: "ثبّت الآن على هاتفك",
    installedBtn: "مثبت على الهاتف ✓",
    manageAlarm: "إدارة المنبه",
    installOptions: "خيارات التثبيت",
    lightOnly: "يعمل على كل الأجهزة",
    veryLight: "من الضعيفة للقوية",
    offline: "بدون إنترنت",
    worksOffline: "يعمل offline",
    evenClosed: "حتى لو مغلق",
    alwaysNotify: "ينبه دائماً",
    scanToDownload: "امسح للتحميل",
    openAppBtn: "افتح التطبيق إن كان مثبتاً",
    permTitle: "أذونات المنبه",
    permRecheck: "إعادة الفحص",
    permRequired: "مطلوب",
    permGrant: "سماح",
    permOpenSettings: "الإعدادات",
    permNote: "أنت من يمنح هذه الأذونات للبرنامج. المنبه لا يُفعَّل إلا بعد منح الأذونات المطلوبة حتى يوقظك الفجر بالقوة.",
    perm_notifications: "الإشعارات",
    perm_notificationsDesc: "لرنين المنبه حتى لو كان التطبيق مغلقاً",
    perm_camera: "الكاميرا",
    perm_cameraDesc: "للتحقق البصري: الصنبور والمصلاة والوجه",
    perm_exactAlarm: "المنبه الدقيق",
    perm_exactAlarmDesc: "للرنين في الموعد المضبوط تماماً (في التطبيق فقط)",
    perm_battery: "تجاهل تحسين البطارية",
    perm_batteryDesc: "حتى لا يقتل النظام المنبه أثناء نومك (في التطبيق فقط)",
    perm_dnd: "تجاوز عدم الإزعاج",
    perm_dndDesc: "للرنين بأقصى صوت حتى في الوضع الصامت (مستحسن)",
    permWizardTitle: "امنح الأذونات أولاً 🔐",
    permWizardDesc: "حتى يوقظك الفجر بالقوة، امنح البرنامج هذه الأذونات. أنت المتحكم - يمكنك سحبها من إعدادات الهاتف في أي وقت.",
    permWizardLater: "لاحقاً",
    permWizardActivate: "تم - فعّل المنبه",
    footerMade: "يثبت كتطبيق أصلي - يعمل بدون إنترنت",
    footerRights: "© 2025 هتصلي يعني هتصلي",
    footerWorld: "صُنع للمسلمين حول العالم",
    footerInstalled: "مثبت على هاتفك",
    footerPhones: "مثبت على أكثر من 2000 هاتف",
    downloadModalTitle: "ثبّت هتصلي على هاتفك",
    downloadModalDesc: "سيصبح منبه الفجر تطبيق أصلي يوقظك",
    installingTitle: "جاري التثبيت...",
    installingDesc: "يثبت المنبه كتطبيق أصلي على هاتفك",
    successTitle: "تم التثبيت بنجاح! 🎉",
    successDesc1: "منبه هتصلي الآن مثبت على هاتفك كتطبيق أصلي",
    successDesc2: "سيوقظك الساعة",
    findIcon: "ابحث عن أيقونة هتصلي",
    onHomeScreen: "على الشاشة الرئيسية لهاتفك",
    worksWithoutNet: "يعمل بدون إنترنت",
    alarmWorksOffline: "المنبه سيعمل حتى لو بدون نت",
    notifyEvenClosed: "ينبه حتى لو مغلق",
    notifyDesc: "سيصلك إشعار حتى لو المتصفح مغلق",
    excellentOpen: "ممتاز - افتح التطبيق",
    installAsPWA: "ثبّت كتطبيق أصلي (PWA)",
    recommended: "موصى به ✓",
    downloadAPK: "تحميل ملف APK",
    manualMethod: "طريقة التثبيت اليدوي:",
    android: "أندرويد",
    androidDesc: 'القائمة ⋮ ثم "تثبيت التطبيق" أو "Add to Home Screen"',
    iphone: "آيفون",
    iphoneDesc: 'زر المشاركة ⎙ ثم "إضافة إلى الشاشة الرئيسية"',
    safe: "آمن 100% - لا يجمع بياناتك - يعمل بدون نت",
    installingProgress: "جاري تثبيت المنبه على هاتفك...",
    willAppearSoon: "سيظهر كتطبيق أصلي على الشاشة الرئيسية خلال ثوان",
    alarmDaysTitle: "أيام التكرار 📅",
    alarmDaysDesc: "اختر الأيام التي تريد أن يعمل فيها المنبه",
    selectDays: "اختر الأيام",
    daysCount: "عدد الأيام",
    durationTitle: "مدة عمل المنبه ⏳",
    durationDesc: "اختر كم يوم سيظل المنبه يعمل",
    forever: "دائم ♾️",
    days7: "7 أيام",
    days14: "14 يوم",
    days30: "30 يوم",
    customDays: "مخصص",
    daysLabel: "يوم",
    daysLabelPlural: "أيام",
    alarmWillWorkFor: "سيعمل المنبه لمدة",
    alarmPersistentTitle: "منبه لا يمكن إغلاقه 🔒",
    alarmPersistentDesc: "يعمل حتى بعد إغلاق التطبيق وحذف الإشعار - لا يتوقف إلا بالتصوير",
    cannotClose: "لا يمكن إغلاقه!",
    hardToCloseTitle: "إغلاق شبه مستحيل 🔒",
    hardToCloseDesc: "هذا المنبه مصمم ليكون صعب الإغلاق جداً - لن يتوقف إلا بعد تصوير الثلاث أشياء بالذكاء الاصطناعي",
    notificationWillReturn: "حتى لو حذفت الإشعار سيعود!",
    snoozeLimited: "غفوة واحدة فقط (10 ثواني)",
    snoozeUsed: "تم استخدام الغفوة - لن يتوقف الآن!",
    holdToSnooze: "اضغط مطولاً 3 ثواني للغفوة",
    days: {
      sat: "السبت",
      sun: "الأحد",
      mon: "الاثنين",
      tue: "الثلاثاء",
      wed: "الأربعاء",
      thu: "الخميس",
      fri: "الجمعة",
    },
    daysShort: {
      sat: "س",
      sun: "ح",
      mon: "ن",
      tue: "ث",
      wed: "ر",
      thu: "خ",
      fri: "ج",
    },
    everyday: "كل يوم",
    weekdays: "أيام العمل",
    weekend: "عطلة نهاية الأسبوع",
    alarmWorksAfterClose: "يعمل حتى بعد إغلاق التطبيق والهاتف",
    alarmWorksAfterCloseDesc: "المنبه محفوظ في النظام وسيعمل حتى لو أغلقت التطبيق أو حذفت الإشعار أو أعدت تشغيل الهاتف",
    clockBound: "مربوط بساعة هاتفك 🕰 — سيعمل في الموعد بالضبط حتى لو أغلقت التطبيق أو حذفت الإشعار",
    persistentAlarm: "منبه دائم",
    appUpdated: "تم تحديث التطبيق! 🎉",
    appUpdatedDesc: "التطبيق تم تحديثه تلقائياً إلى الإصدار الجديد",
    appUpdatedDetail: "صوت رجل محسن وذكاء اصطناعي أفضل وميزة التحديث التلقائي لجميع المستخدمين",
    refreshNow: "تحديث الآن",
    updating: "جاري التحديث...",
    newVersion: "إصدار جديد",
    autoUpdate: "تحديث تلقائي",
    autoUpdateDesc: "التحديثات تصل لجميع المستخدمين تلقائياً",
    maleVoiceImproved: "صوت رجل محسن 👨",
    maleVoiceImprovedDesc: "صوت رجل عميق وواضح جداً - نبرة منخفضة",
    language: "اللغة",
    theme: "المظهر",
    light: "فاتح",
    dark: "داكن",
    // تحميل APK الحقيقي
    apkOptionTitle: "تحميل تطبيق الأندرويد (APK)",
    apkOptionDesc: "ملف حقيقي يُثبّت كتطبيق مستقل على هاتفك",
    apkDownloadBtn: "تحميل ملف APK الآن",
    apkDownloading: "جاري تحميل ملف APK...",
    apkDownloadedTitle: "تم تحميل ملف APK بنجاح! 🎉",
    apkDownloadedDesc: "الملف الآن على هاتفك - اتبع الخطوات بالأسفل لتثبيته",
    apkOpenDownloads: "افتح ملف hatsally.apk من مجلد التنزيلات",
    apkStep1Title: "افتح ملف التحميل",
    apkStep1Desc: "افتح hatsally.apk من الإشعار أو مجلد التنزيلات",
    apkStep2Title: "اسمح بالتثبيت",
    apkStep2Desc: 'إذا طلب الهاتف، اسمح بـ "التثبيت من مصادر غير معروفة"',
    apkStep3Title: "ثبّت وافتح التطبيق",
    apkStep3Desc: "اضغط تثبيت ثم افتح هتصلي واضبط منبهك 🕌",
    apkVersion: "الإصدار",
    apkSize: "الحجم",
    apkPreparing: "جاري تجهيز ملف APK على الخادم... حاول بعد دقائق",
    apkBuildStatus: "يُبنى تلقائياً مع كل تحديث جديد",
    apkError: "تعذّر تحميل الملف - تحقق من الإنترنت وحاول مجدداً",
    apkRetry: "إعادة المحاولة",
    apkReleaseLink: "تحميل من GitHub مباشرة",
    orDivider: "أو",
    pwaOptionTitle: "تثبيت سريع من المتصفح",
    pwaOptionDesc: "بدون تحميل ملفات - يعمل على كل الأجهزة",
    nativeRunningTitle: "يعمل داخل التطبيق الأصلي ✓",
    nativeRunningDesc: "أنت تستخدم نسخة APK - المنبه والصوت يعملان بقدرات الهاتف الكاملة",
    // نتائج التحقق البصري الحقيقي
    msgTapOk: "صنبور مياه حقيقي ✓",
    msgTapFail: "لا يبدو صنبور مياه - حاول مجدداً",
    msgMatOk: "مصلاة حقيقية ✓",
    msgMatFail: "لا تبدو مصلاة - حاول مجدداً",
    msgFaceOk: "وجه وعينان مفتوحتان ✓",
    msgFaceFail: "تعذر تأكيد الوجه - حاول مجدداً",
    msgFaceNoFace: "لا يوجد وجه - أظهر وجهك للكاميرا",
    msgFaceSmall: "الوجه بعيد - اقترب أكثر",
    msgEyesClosed: "العينان مغلقتان - افتحهما جيداً!",
    cl_photo: "صورة واضحة",
    cl_sharp: "ثبات",
    cl_metal: "معدن",
    cl_chrome: "كروم",
    cl_shape: "شكل الصنبور",
    cl_solid: "جسم متماسك",
    cl_shine: "لمعة",
    cl_sink: "مغسلة",
    cl_symmetry: "تناظر",
    cl_colors: "ألوان سجاد",
    cl_texture: "نسيج",
    cl_border: "إطار",
    cl_pattern: "زخارف",
    cl_rich: "امتلاء",
    cl_faceFound: "وجه بشري",
    cl_faceSize: "قرب الوجه",
    cl_eyesOpen: "عينان مفتوحتان",
    tipLight: "حسّن الإضاءة حولك",
    tipSteady: "ثبت يدك أثناء التصوير",
    tipTapCloser: "اقترب من الصنبور حتى يملأ الصورة",
    tipTapAngle: "صوّر الصنبور من الأمام مباشرة",
    tipTapLight: "أضئ الصنبور ليظهر لمعان المعدن",
    tipTapSink: "أظهر المغسلة مع الصنبور",
    tipTapOnly: "اجعل الصنبور وحده في الصورة",
    tipNotFace: "هذه صورة وجه وليست المطلوب",
    tipNotTap: "هذا صنبور وليس مصلاة",
    tipMatCenter: "وسّط السجادة في الصورة",
    tipMatWhole: "أظهر السجادة كاملة بحدودها",
    tipMatCloser: "اقترب لتظهر الزخارف",
    tipMatColors: "تأكد من ظهور ألوان السجادة",
    tipMatFill: "املأ الصورة بالسجادة",
    tipFaceCloser: "قرّب وجهك من الكاميرا",
    tipEyesOpen: "افتح عينيك واسعاً وانظر للكاميرا",
    tipFaceRetry: "أعد التصوير بإضاءة أفضل",
    attemptsLabel: "المحاولات",
    canConfirmAnyway: "يمكنك التأكيد",
  },
  en: {
    appName: "HatSally - You WILL Pray",
    appNameShort: "HatSally",
    appSub: "Smart Fajr Alarm",
    tagline: "The First Smart Fajr Alarm",
    taglineInstalled: "Installed on your phone - Works offline",
    taglineReady: "Installable on phone - Works offline",
    heroTitle1: "An alarm that installs",
    heroTitle2: "and won't let you sleep",
    heroDesc: "Install with one tap as a native app, it calls you by name, escalates with annoying sounds, and works even when phone is silent or offline.",
    duaSentence: "This app was designed to wake you up for Fajr and all prayers, please don't forget us in your prayers 🤍",
    feature1: "Installs as native app",
    feature2: "Works offline",
    feature3: "Alerts even when closed",
    featureName: "Calls you by name",
    featureEscalate: "Gradual annoying escalation",
    featureCamera: "Photo verification",
    tryNow: "Try Alarm Now",
    downloadPhone: "Download to Phone",
    installNow: "Install Alarm on Your Phone Now",
    installedBadge: "Installed on your phone ✓ Alarm works even offline",
    installedShort: "Installed ✓",
    installedOnPhone: "Installed on Phone",
    readyToInstall: "Ready to install",
    installBannerTitle: "Install HatSally alarm on your phone now 📲",
    installBannerDesc: "Works offline and alerts even when browser is closed",
    installBtn: "Install Now",
    howItWorks: "How it works",
    step1Title: "One-tap install",
    step1Desc: "Tap install button, you'll get a native app install prompt like any app store app",
    step1Time: "Instant install",
    step2Title: "Calls you then annoys you",
    step2Desc: "Starts with gentle call by name, after 5 min annoying alarm, after 10 min unbearable nightmare until you wake",
    step2Time: "Smart escalation",
    step3Title: "Photo verification",
    step3Desc: "Won't stop until you photograph water tap, prayer mat, and your face with eyes open to prove you're awake",
    step3Time: "Forced verification",
    demoTitle: "Set your name and install now",
    demoDesc: "Enter your name and alarm time, then tap install - becomes native app working offline",
    settings: "Alarm Settings",
    fastMode: "Fast demo mode",
    maleVoice: "Male Voice 👨",
    maleVoiceDesc: "Deep male voice - continues until verified",
    aiAnalyzing: "AI Analyzing... 🤖",
    aiCheckingWater: "Checking water tap... 🚰",
    aiCheckingPrayer: "Checking prayer mat... 🕌",
    aiCheckingFace: "Checking face & eyes... 👁️",
    aiSuccessWater: "Real water tap ✓",
    aiSuccessPrayer: "Real prayer mat ✓",
    aiSuccessFace: "Face & open eyes ✓",
    aiFailWater: "Doesn't look like water tap, try again",
    aiFailPrayer: "Doesn't look like prayer mat, try again",
    aiFailFace: "Face not detected or eyes closed",
    aiFailNoFace: "No face found",
    aiFailEyesClosed: "Eyes closed - open your eyes wide!",
    aiConfidence: "Confidence",
    cameraPermission: "Camera Permission Required 📷",
    cameraPermissionDesc: "App needs camera permission to verify you're awake",
    allowCamera: "Allow Camera",
    cameraDenied: "Camera permission denied",
    cameraDeniedDesc: "Please allow camera from browser settings",
    cameraDeniedHint: "If you denied before: allow camera in browser/app settings then retry",
    cameraBusy: "Camera busy",
    cameraBusyDesc: "Another app is using the camera - close it and retry",
    cameraMissing: "No camera found",
    cameraMissingDesc: "Could not find a camera - try uploading from gallery",
    cameraRetry: "Retry",
    nextRing: "Next ring",
    nextRingNone: "No ring scheduled - check days and duration",
    tapToOpenCamera: "Tap to open camera",
    verificationSoundOn: "🔊 Sound continues until verification complete",
    verificationProgress: "Verification in progress - sound won't stop",
    aiPowered: "AI Powered Check",
    yourName: "Your name (alarm will call you)",
    namePlaceholder: "e.g. Ahmed, Mohamed, Fatima...",
    wakeTime: "Wake up time",
    installApp: "Install Alarm on Your Phone Now",
    installing: "Installing on your phone...",
    installedSuccess: "Installed on your phone ✓",
    setOnly: "Set only",
    tryRing: "Try ringing",
    alarmSet: "Alarm set for",
    willWake: "Will wake",
    ringingNow: "Ringing now - gentle call",
    annoyingMode: "Annoying mode - alarm bell",
    nightmareMode: "Nightmare mode - unbearable!",
    ringingSince: "Ringing since",
    wokeUp: "I'm awake ✓",
    snooze: "Snooze",
    sec: "s",
    min: "m",
    hello: "Hello",
    heroFajr: "Fajr hero",
    nextAlarm: "Next alarm",
    faucet: "Tap",
    prayerMat: "Prayer Mat",
    face: "Face",
    installStatus: "Install status",
    notInstalled: "Not installed",
    installOnPhone: "Install Alarm on Phone",
    set: "Set",
    setYourTime: "Installed ✓ Set your time",
    installFirst: "Install first then set",
    wakeUpName: "Wake up",
    getUpNow: "Get up",
    wakeNow: "Wake up NOW!!",
    fajrTime: "Fajr prayer time",
    annoyingBell: "🔔 Annoying alarm bell",
    nightmare: "🚨 Unbearable nightmare",
    willNotStop: "Won't stop until you prove you're awake",
    proveWake: "Prove you're awake",
    waterTap: "Water Tap",
    waterDesc: "Photograph water tap to prove wudu",
    prayerDesc: "Photograph prayer mat",
    faceDesc: "Take photo of your face with eyes open",
    openCamera: "Open Camera",
    uploadFromGallery: "Upload from gallery",
    aimWater: "Point camera to water tap",
    aimPrayer: "Point camera to prayer mat",
    aimFace: "Look at camera with eyes wide open",
    capture: "Capture",
    cancel: "Cancel",
    confirm: "Confirm",
    retake: "Retake",
    waterDetected: "Water tap detected ✓ Good wudu",
    prayerDetected: "Prayer mat detected ✓ May Allah accept",
    faceDetected: "Eyes open confirmed ✓ Morning energy!",
    done: "Done ✓",
    mayAllahAccept: "May Allah accept,",
    wellDone: "Well done! You proved you're awake and made wudu",
    nowPray: "Now go pray Fajr, it's better than sleep",
    wakeTimeLabel: "Wake time",
    newAlarm: "New alarm",
    neverStops: "Won't stop until you prove you're really awake",
    neverStopsDesc: 'After tapping "I\'m awake", the app will ask you to photograph three things to ensure you got out of bed and made wudu',
    waterStepTitle: "Water Tap",
    waterStepDesc: "Photograph water tap in bathroom to prove you got up and made wudu. Won't accept old photos, must be live from camera.",
    prayerStepTitle: "Prayer Mat",
    prayerStepDesc: "Photograph your prayer place or mat. This proves you went to prayer place and ready to pray.",
    faceStepTitle: "Your face with eyes open",
    faceStepDesc: "Take selfie with eyes clearly open. Uses AI to ensure you're not sleeping and eyes are open.",
    step1: "Step 1",
    step2: "Step 2",
    step3: "Step 3",
    directOnly: "Live capture only - gallery not accepted",
    downloadSectionTitle: "Install alarm on your phone",
    downloadSectionInstalledTitle: "Alarm installed and working!",
    downloadSectionSub: "One tap becomes native app",
    downloadSectionInstalledSub: "Works even offline",
    downloadSectionDesc: "Tap install button, you'll get install prompt. After install, find HatSally icon on home screen, works even when phone silent and offline.",
    downloadSectionInstalledDesc: "Excellent! Alarm now installed as native app. Will wake you even if browser closed or offline.",
    installNowBtn: "Install Now on Your Phone",
    installedBtn: "Installed on Phone ✓",
    manageAlarm: "Manage Alarm",
    installOptions: "Install Options",
    lightOnly: "Runs on all devices",
    veryLight: "From weak to powerful",
    offline: "Offline",
    worksOffline: "Works offline",
    evenClosed: "Even closed",
    alwaysNotify: "Always alerts",
    scanToDownload: "Scan to download",
    openAppBtn: "Open the app if installed",
    permTitle: "Alarm permissions",
    permRecheck: "Recheck",
    permRequired: "Required",
    permGrant: "Allow",
    permOpenSettings: "Settings",
    permNote: "You grant these permissions to the app. The alarm arms only after required permissions are granted, so Fajr wakes you up forcefully.",
    perm_notifications: "Notifications",
    perm_notificationsDesc: "To ring even when the app is closed",
    perm_camera: "Camera",
    perm_cameraDesc: "For visual verification: tap, mat and face",
    perm_exactAlarm: "Exact alarm",
    perm_exactAlarmDesc: "To ring at the exact set time (in-app only)",
    perm_battery: "Ignore battery optimization",
    perm_batteryDesc: "So the system never kills the alarm while you sleep (in-app only)",
    perm_dnd: "Override Do Not Disturb",
    perm_dndDesc: "To ring at max volume even in silent mode (recommended)",
    permWizardTitle: "Grant permissions first 🔐",
    permWizardDesc: "So Fajr wakes you up forcefully, grant the app these permissions. You're in control - revoke anytime from phone settings.",
    permWizardLater: "Later",
    permWizardActivate: "Done - arm the alarm",
    footerMade: "Installs as native app - Works offline",
    footerRights: "© 2025 HatSally - You WILL Pray",
    footerWorld: "Made for Muslims worldwide",
    footerInstalled: "Installed on your phone",
    footerPhones: "Installed on 2000+ phones",
    downloadModalTitle: "Install HatSally on your phone",
    downloadModalDesc: "Fajr alarm will become native app waking you at",
    installingTitle: "Installing...",
    installingDesc: "Installing alarm as native app on your phone",
    successTitle: "Installed Successfully! 🎉",
    successDesc1: "HatSally alarm now installed as native app",
    successDesc2: "Will wake you at",
    findIcon: "Find HatSally icon",
    onHomeScreen: "On your phone home screen",
    worksWithoutNet: "Works without internet",
    alarmWorksOffline: "Alarm will work even without internet",
    notifyEvenClosed: "Notifies even when closed",
    notifyDesc: "You'll get notification even if browser closed",
    excellentOpen: "Excellent - Open App",
    installAsPWA: "Install as Native App (PWA)",
    recommended: "Recommended ✓",
    downloadAPK: "Download APK File",
    manualMethod: "Manual install method:",
    android: "Android",
    androidDesc: 'Menu ⋮ then "Install App" or "Add to Home Screen"',
    iphone: "iPhone",
    iphoneDesc: 'Share button ⎙ then "Add to Home Screen"',
    safe: "100% Safe - No data collection - Works offline",
    installingProgress: "Installing alarm on your phone...",
    willAppearSoon: "Will appear as native app on home screen in seconds",
    alarmDaysTitle: "Repeat Days 📅",
    alarmDaysDesc: "Choose days alarm should work",
    selectDays: "Select Days",
    daysCount: "Days Count",
    durationTitle: "Alarm Duration ⏳",
    durationDesc: "How many days alarm will work",
    forever: "Forever ♾️",
    days7: "7 days",
    days14: "14 days",
    days30: "30 days",
    customDays: "Custom",
    daysLabel: "day",
    daysLabelPlural: "days",
    alarmWillWorkFor: "Alarm will work for",
    alarmPersistentTitle: "Unstoppable Alarm 🔒",
    alarmPersistentDesc: "Works even after closing app and dismissing notification - only stops with photos",
    cannotClose: "Cannot close!",
    hardToCloseTitle: "Almost Impossible to Close 🔒",
    hardToCloseDesc: "This alarm is designed to be extremely hard to close - only stops after 3 AI photo verifications",
    notificationWillReturn: "Even if you dismiss notification, it will return!",
    snoozeLimited: "One snooze only (10 sec)",
    snoozeUsed: "Snooze used - won't stop now!",
    holdToSnooze: "Hold 3 seconds to snooze",
    days: {
      sat: "Saturday",
      sun: "Sunday",
      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
      thu: "Thursday",
      fri: "Friday",
    },
    daysShort: {
      sat: "Sa",
      sun: "Su",
      mon: "Mo",
      tue: "Tu",
      wed: "We",
      thu: "Th",
      fri: "Fr",
    },
    everyday: "Everyday",
    weekdays: "Weekdays",
    weekend: "Weekend",
    alarmWorksAfterClose: "Works even after closing app and phone",
    alarmWorksAfterCloseDesc: "Alarm saved in system and will work even if you close app, dismiss notification, or restart phone",
    clockBound: "Tied to your phone's clock 🕰 - fires at the exact time even if you close the app or dismiss the notification",
    persistentAlarm: "Persistent Alarm",
    appUpdated: "App Updated! 🎉",
    appUpdatedDesc: "App automatically updated to new version",
    appUpdatedDetail: "Improved male voice, better AI, auto-update for all users",
    refreshNow: "Refresh Now",
    updating: "Updating...",
    newVersion: "New version",
    autoUpdate: "Auto Update",
    autoUpdateDesc: "Updates reach all users automatically",
    maleVoiceImproved: "Improved Male Voice 👨",
    maleVoiceImprovedDesc: "Deep and clear male voice - low pitch",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    // Real APK download
    apkOptionTitle: "Download Android App (APK)",
    apkOptionDesc: "A real file installed as a standalone app on your phone",
    apkDownloadBtn: "Download APK File Now",
    apkDownloading: "Downloading APK file...",
    apkDownloadedTitle: "APK Downloaded Successfully! 🎉",
    apkDownloadedDesc: "The file is now on your phone - follow steps below to install it",
    apkOpenDownloads: "Open hatsally.apk from Downloads folder",
    apkStep1Title: "Open the downloaded file",
    apkStep1Desc: "Open hatsally.apk from notification or Downloads folder",
    apkStep2Title: "Allow installation",
    apkStep2Desc: 'If asked, allow "Install from unknown sources"',
    apkStep3Title: "Install & open the app",
    apkStep3Desc: "Tap Install then open HatSally and set your alarm 🕌",
    apkVersion: "Version",
    apkSize: "Size",
    apkPreparing: "APK is being prepared on the server... try again in minutes",
    apkBuildStatus: "Built automatically with every new update",
    apkError: "Download failed - check internet and retry",
    apkRetry: "Retry",
    apkReleaseLink: "Download directly from GitHub",
    orDivider: "or",
    pwaOptionTitle: "Quick browser install",
    pwaOptionDesc: "No file download - works on all devices",
    nativeRunningTitle: "Running inside native app ✓",
    nativeRunningDesc: "You are using the APK version - alarm & voice use full phone capabilities",
    // Real visual verification results
    msgTapOk: "Real water tap ✓",
    msgTapFail: "Not a water tap - try again",
    msgMatOk: "Real prayer mat ✓",
    msgMatFail: "Not a prayer mat - try again",
    msgFaceOk: "Face with open eyes ✓",
    msgFaceFail: "Face not confirmed - try again",
    msgFaceNoFace: "No face - show your face",
    msgFaceSmall: "Face too far - get closer",
    msgEyesClosed: "Eyes closed - open them wide!",
    cl_photo: "Clear photo",
    cl_sharp: "Steady",
    cl_metal: "Metal",
    cl_chrome: "Chrome",
    cl_shape: "Tap shape",
    cl_solid: "Solid body",
    cl_shine: "Shine",
    cl_sink: "Sink",
    cl_symmetry: "Symmetry",
    cl_colors: "Rug colors",
    cl_texture: "Texture",
    cl_border: "Border",
    cl_pattern: "Patterns",
    cl_rich: "Fill",
    cl_faceFound: "Human face",
    cl_faceSize: "Face close",
    cl_eyesOpen: "Eyes open",
    tipLight: "Improve lighting around you",
    tipSteady: "Hold steady while capturing",
    tipTapCloser: "Get closer until tap fills the photo",
    tipTapAngle: "Photograph the tap straight from front",
    tipTapLight: "Light the tap to show metal shine",
    tipTapSink: "Show the sink with the tap",
    tipTapOnly: "Keep only the tap in the photo",
    tipNotFace: "This is a face photo, not what's needed",
    tipNotTap: "This is a tap, not a prayer mat",
    tipMatCenter: "Center the mat in the photo",
    tipMatWhole: "Show the whole mat with its borders",
    tipMatCloser: "Get closer to show patterns",
    tipMatColors: "Make sure mat colors are visible",
    tipMatFill: "Fill the photo with the mat",
    tipFaceCloser: "Bring your face closer to camera",
    tipEyesOpen: "Open your eyes wide, look at camera",
    tipFaceRetry: "Retake with better lighting",
    attemptsLabel: "Attempts",
    canConfirmAnyway: "You may confirm",
  },
};

export default function Page() {
  const [language, setLanguage] = useState<Language>("ar");
  const [theme, setTheme] = useState<Theme>("dark");
  const [userName, setUserName] = useState("");
  const [alarmTime, setAlarmTime] = useState("05:00");
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmStage, setAlarmStage] = useState<AlarmStage>("idle");
  const [timeSinceRinging, setTimeSinceRinging] = useState(0);
  const [fastMode, setFastMode] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [verificationTasks, setVerificationTasks] = useState<VerificationTask[]>([]);
  const [currentVerificationIndex, setCurrentVerificationIndex] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPermWizard, setShowPermWizard] = useState(false);
  const [permChecking, setPermChecking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ valid: boolean; confidence: number; message: string; checks: VisionCheck[]; tips: string[] } | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);
  const [cameraErrorCode, setCameraErrorCode] = useState("");
  const [cameraStreamActive, setCameraStreamActive] = useState(false);

  // New: Days and Duration + Hard to close
  const [selectedDays, setSelectedDays] = useState<number[]>([0,1,2,3,4,5,6]); // 0=Sun ... 6=Sat
  const [durationDays, setDurationDays] = useState<number | 'forever'>('forever'); // forever or 7/14/30
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [alarmStartDate, setAlarmStartDate] = useState<string | null>(null);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [snoozeHoldProgress, setSnoozeHoldProgress] = useState(0);
  const [isHoldingSnooze, setIsHoldingSnooze] = useState(false);
  const snoozeHoldRef = useRef<NodeJS.Timeout | null>(null);

  // PWA Install states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installStep, setInstallStep] = useState<"idle" | "installing" | "success">("idle");
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  // Auto-update states - v5
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; message: string } | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [appVersion] = useState("5.0.0-auto-male-voice");

  // Native APK + real APK download states
  const [isNativeApp, setIsNativeApp] = useState(false);
  // هل المنبه مسلح بمواعيد دقيقة على نظام الهاتف (AlarmManager)؟
  const [hatAlarmArmed, setHatAlarmArmed] = useState(false);
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkDownloading, setApkDownloading] = useState(false);
  const [apkDownloaded, setApkDownloaded] = useState(false);
  const [apkError, setApkError] = useState<string | null>(null);
  const alarmStageRef = useRef<AlarmStage>("idle");

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const escalationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const verificationSpeechRef = useRef<NodeJS.Timeout | null>(null);

  const t = translations[language];
  // ترجمة ديناميكية لمفاتيح الفحوصات والنصائح القادمة من محرك التحقق
  const tr = (key: string): string => ((t as unknown as Record<string, string>)[key] || key);
  const isDark = theme === "dark";
  const isRTL = language === "ar";

  // Initialize verification tasks based on language
  useEffect(() => {
    setVerificationTasks([
      {
        id: "water",
        title: t.waterTap,
        subtitle: t.waterDesc,
        icon: <Droplets className="w-6 h-6" />,
        completed: false,
        image: null,
      },
      {
        id: "prayer",
        title: t.prayerMat,
        subtitle: t.prayerDesc,
        icon: <div className="text-xl">🕌</div>,
        completed: false,
        image: null,
      },
      {
        id: "face",
        title: language === "ar" ? "وجهك وعيناك مفتوحتان" : "Your face with eyes open",
        subtitle: t.faceDesc,
        icon: <Eye className="w-6 h-6" />,
        completed: false,
        image: null,
      },
    ]);
  }, [language, t.waterTap, t.waterDesc, t.prayerMat, t.prayerDesc, t.faceDesc]);

  // Preload male voices for alarm - v5 improved
  useEffect(() => {
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const arVoices = voices.filter(v => v.lang.toLowerCase().includes("ar"));
          const enVoices = voices.filter(v => v.lang.toLowerCase().includes("en"));
          console.log(`🎙️ [Male Voice v5] Available voices: ${voices.length}, Arabic: ${arVoices.length}, English: ${enVoices.length}`);
          console.log("Arabic voices:", arVoices.map(v => `${v.name} (${v.lang}) - ${v.name.toLowerCase().includes('female') ? 'FEMALE' : 'MALE?'}`));
          console.log("English voices:", enVoices.slice(0,10).map(v => `${v.name} (${v.lang})`));
          // Try to find best male voice
          const testAr = voices.filter(v => v.lang.toLowerCase().includes("ar"));
          const maleCandidates = testAr.filter(v => {
            const n = v.name.toLowerCase();
            return !n.includes("female") && !n.includes("sara") && !n.includes("laila");
          });
          console.log(`🎙️ [Male Voice v5] Male Arabic candidates:`, maleCandidates.map(v => v.name));
          if (maleCandidates.length > 0) {
            console.log(`✅ Best male voice selected: ${maleCandidates[0].name}`);
          }
        }
      };
      loadVoices();
      // Voices may load async
      window.speechSynthesis.onvoiceschanged = loadVoices;
      // Force load
      window.speechSynthesis.getVoices();
      // Retry after 500ms
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1500);
    }
  }, []);

  // PWA & Theme & Language init
  useEffect(() => {
    const savedLang = localStorage.getItem("hatsally-lang") as Language;
    const savedTheme = localStorage.getItem("hatsally-theme") as Theme;
    const savedName = localStorage.getItem("hatsally-user-name");
    const savedTime = localStorage.getItem("hatsally-alarm-time");
    const savedDays = localStorage.getItem("hatsally-alarm-days");
    const savedDuration = localStorage.getItem("hatsally-alarm-duration");
    const savedStartDate = localStorage.getItem("hatsally-alarm-start-date");
    const savedActive = localStorage.getItem("hatsally-alarm-active");
    
    if (savedLang) setLanguage(savedLang);
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme("light");
    }
    if (savedName) setUserName(savedName);
    if (savedTime) setAlarmTime(savedTime);
    if (savedDays) {
      try { setSelectedDays(JSON.parse(savedDays)); } catch {}
    }
    if (savedDuration) {
      if (savedDuration === 'forever') setDurationDays('forever');
      else {
        const num = parseInt(savedDuration);
        if (!isNaN(num)) setDurationDays(num);
      }
    }
    if (savedStartDate) setAlarmStartDate(savedStartDate);
    if (savedActive === 'true') setIsAlarmActive(true);

    const checkStandalone = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      setIsInstalled(standalone || localStorage.getItem("hatsally-installed") === "true");
    };
    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallBanner(false);
      localStorage.setItem("hatsally-installed", "true");
      setInstallStep("success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    const timer = setTimeout(() => {
      if (!localStorage.getItem("hatsally-banner-dismissed") && !isInstalled) {
        setShowInstallBanner(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  // Native APK detection + fetch real APK info for download button
  useEffect(() => {
    alarmStageRef.current = alarmStage;
  }, [alarmStage]);

  useEffect(() => {
    // هل نعمل داخل تطبيق APK أصلي؟
    if (checkNativeApp()) {
      setIsNativeApp(true);
      setIsInstalled(true);
      setShowInstallBanner(false);
      localStorage.setItem("hatsally-installed", "true");
      localStorage.setItem("hatsally-native", "true");
      void requestNativePermissions();
      void guardBackButtonWhileRinging(
        () =>
          alarmStageRef.current === "ringing" ||
          alarmStageRef.current === "annoying" ||
          alarmStageRef.current === "extreme" ||
          alarmStageRef.current === "verification"
      );
      console.log("📱 Running inside native APK - full phone capabilities enabled");
    }
    // جلب معلومات آخر نسخة APK لزر التحميل
    void getApkInfo().then((info) => {
      if (info) {
        setApkInfo(info);
        console.log("📦 APK info:", info.available ? `${info.version} (${info.sizeLabel})` : "not built yet");
      }
    });
  }, []);

  // Auto-update system v5 - ensures all users get updates automatically
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Check for pending update from SW
    const pendingUpdate = localStorage.getItem("hatsally-update-pending");
    const lastUpdate = localStorage.getItem("hatsally-last-update");
    if (pendingUpdate === "true" && lastUpdate) {
      try {
        const info = JSON.parse(lastUpdate);
        setUpdateInfo({ version: info.version || appVersion, message: info.message || (language === "ar" ? "تم تحديث التطبيق تلقائياً" : "App updated automatically") });
        setShowUpdateBanner(true);
        // Auto hide after 8 seconds and clear flag
        setTimeout(() => {
          setShowUpdateBanner(false);
          localStorage.removeItem("hatsally-update-pending");
        }, 8000);
      } catch {}
    }

    // Check if just updated (after reload)
    const justUpdatedFlag = localStorage.getItem("hatsally-just-updated");
    const updateTime = localStorage.getItem("hatsally-update-time");
    if (justUpdatedFlag === "true" && updateTime) {
      const diff = Date.now() - parseInt(updateTime);
      if (diff < 15000) {
        setJustUpdated(true);
        setUpdateInfo({ version: appVersion, message: language === "ar" ? "تم تحديث التطبيق إلى الإصدار الجديد ✓" : "App updated to new version ✓" });
        setShowUpdateBanner(true);
        setTimeout(() => {
          setJustUpdated(false);
          setShowUpdateBanner(false);
          localStorage.removeItem("hatsally-just-updated");
          localStorage.removeItem("hatsally-update-time");
          localStorage.removeItem("hatsally-update-pending");
        }, 6000);
      } else {
        localStorage.removeItem("hatsally-just-updated");
      }
    }

    // Listen for custom events from layout.tsx script
    const handleAppUpdated = (e: any) => {
      const detail = e.detail || {};
      console.log("🎉 App updated event:", detail);
      setUpdateInfo({ version: detail.version || appVersion, message: detail.message || (language === "ar" ? "تم تحديث التطبيق تلقائياً" : "App updated automatically") });
      setShowUpdateBanner(true);
      setJustUpdated(true);
      // Vibrate to notify
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
      setTimeout(() => {
        setShowUpdateBanner(false);
        setJustUpdated(false);
      }, 8000);
    };

    const handleAppJustUpdated = (e: any) => {
      const detail = e.detail || {};
      setUpdateInfo({ version: detail.version || appVersion, message: language === "ar" ? "تم تحديث التطبيق بنجاح! 🎉" : "App updated successfully! 🎉" });
      setShowUpdateBanner(true);
      setJustUpdated(true);
      setTimeout(() => {
        setShowUpdateBanner(false);
        setJustUpdated(false);
      }, 6000);
    };

    const handleSWUpdateFound = () => {
      console.log("🆕 SW update found - preparing auto-update for all users");
      setUpdateInfo({ version: appVersion, message: language === "ar" ? "جاري تحديث التطبيق تلقائياً..." : "Updating app automatically..." });
      setShowUpdateBanner(true);
    };

    window.addEventListener("app-updated" as any, handleAppUpdated);
    window.addEventListener("app-just-updated" as any, handleAppJustUpdated);
    window.addEventListener("sw-update-found" as any, handleSWUpdateFound);

    // Periodic check for updates every 15 minutes + on visibility
    let updateCheckInterval: any = null;
    const checkForUpdates = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.update().then(() => {
            console.log("🔍 Auto-update check completed");
          }).catch(() => {});
        });
      }
    };

    updateCheckInterval = setInterval(checkForUpdates, 15 * 60 * 1000); // every 15 min

    const handleVisibility = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("app-updated" as any, handleAppUpdated);
      window.removeEventListener("app-just-updated" as any, handleAppJustUpdated);
      window.removeEventListener("sw-update-found" as any, handleSWUpdateFound);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (updateCheckInterval) clearInterval(updateCheckInterval);
    };
  }, [language, appVersion]);

  useEffect(() => {
    localStorage.setItem("hatsally-lang", language);
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
  }, [language, isRTL]);

  useEffect(() => {
    localStorage.setItem("hatsally-theme", theme);
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // فتح قفل الصوت عند أي تفاعل: بدونه يرنّ المنبه صامتاً (سياسة المتصفح)
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioContextRef.current && Ctor) audioContextRef.current = new Ctor();
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          void audioContextRef.current.resume();
        }
      } catch {}
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAllSounds();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
    };
  }, []);

  const stopAllSounds = useCallback(() => {
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    oscillatorsRef.current = [];
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    if (verificationSpeechRef.current) {
      clearInterval(verificationSpeechRef.current);
      verificationSpeechRef.current = null;
    }
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    void stopNativeSpeech();
  }, []);

  const [verificationAttempts, setVerificationAttempts] = useState(0);
  // Improved AI Image Analysis - much more lenient for face
  // محرك التحقق الحقيقي: رؤية حاسوبية للصنبور/المصلاة + شبكة عصبية للوجه
  // messageKey يُترجم عبر قاموس اللغة الحالي
  const analyzeImageWithAI = useCallback(async (
    imageDataUrl: string,
    taskId: VerificationId,
    attempt: number
  ): Promise<{ valid: boolean; confidence: number; message: string; checks: VisionCheck[]; tips: string[] }> => {
    const task = taskId as VerifyTask;
    const r = await verifyCapture(imageDataUrl, task, attempt);
    const dict = translations[language] as unknown as Record<string, string>;
    return {
      valid: r.valid,
      confidence: r.confidence,
      message: dict[r.messageKey] || r.messageKey,
      checks: r.checks,
      tips: r.tips,
    };
  }, [language]);

  // Helper: Get best male voice - v5 improved for real male voice
  const getBestMaleVoice = useCallback((langCode: string) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    
    const langVoices = voices.filter(v => v.lang.toLowerCase().includes(langCode.toLowerCase()));
    const searchPool = langVoices.length > 0 ? langVoices : voices;
    
    // Tier 1: Explicit male keywords
    let male = searchPool.find(v => {
      const n = v.name.toLowerCase();
      return n.includes("male") && !n.includes("female");
    });
    if (male) return male;
    
    // Tier 2: Known male Arabic/English names - most reliable
    const maleNames = [
      // Arabic male
      "maged", "majed", "majid", "naayf", "nayef", "naif", "tarik", "tariq", "omar", "ahmed", "ahmad", "mohamed", "mohammed", "khalid", "abdullah", "youssef", "yousef",
      // English male
      "david", "mark", "alex", "daniel", "james", "john", "michael", "robert", "thomas", "william", "george", "paul", "steven", "kevin", "brian", "google uk english male", "google us english male"
    ];
    male = searchPool.find(v => {
      const n = v.name.toLowerCase();
      return maleNames.some(mn => n.includes(mn));
    });
    if (male) return male;
    
    // Tier 3: Non-female voices (filter out known female)
    const femaleKeywords = ["female", "woman", "sara", "laila", "zara", "samantha", "karen", "moira", "tessa", "veena", "fiona", "susan", "lisa", "anna", "emma", "olivia", "amelie", "alice"];
    male = searchPool.find(v => {
      const n = v.name.toLowerCase();
      return !femaleKeywords.some(fk => n.includes(fk));
    });
    if (male) return male;
    
    // Tier 4: First voice of language, or first overall
    return langVoices[0] || voices[0] || null;
  }, []);

  const speakVerification = useCallback((taskId: VerificationId, name: string) => {
    let text = "";
    if (language === "ar") {
      if (taskId === "water") text = `يا ${name} صور صنبور المياه الآن لإثبات الوضوء! هيا يا ${name}! بصوت رجل!`;
      else if (taskId === "prayer") text = `أحسنت يا ${name}! الآن صور المصلاة يا ${name}! ممتاز يا بطل!`;
      else text = `ممتاز يا ${name}! الآن صور وجهك وعيناك مفتوحتان يا ${name}! افتح عينيك جيدا يا ${name}!`;
    } else {
      if (taskId === "water") text = `${name} photograph water tap now to prove wudu! Come on ${name}! Male voice!`;
      else if (taskId === "prayer") text = `Good ${name}! Now photograph prayer mat ${name}! Excellent!`;
      else text = `Excellent ${name}! Now photograph your face with eyes open ${name}! Open your eyes wide ${name}!`;
    }
    // داخل تطبيق APK: النطق عبر محرك الهاتف الأصلي (WebView لا يدعم speechSynthesis)
    if (isNativeApp) {
      if (!isMuted) void nativeSpeak(text, { lang: language === "ar" ? "ar-SA" : "en-US", rate: 0.92, pitch: 0.7 });
      return;
    }
    if (isMuted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "ar" ? "ar-SA" : "en-US";
    // Force male characteristics: very low pitch, slightly slower
    utterance.rate = 0.88;
    utterance.pitch = 0.45; // Very low for male
    utterance.volume = 1;
    
    const bestMale = getBestMaleVoice(language === "ar" ? "ar" : "en");
    if (bestMale) {
      utterance.voice = bestMale;
      console.log(`🎙️ [Male Voice v5] Verification using: ${bestMale.name} (${bestMale.lang}) pitch ${utterance.pitch}`);
    }
    
    // If voices not loaded, retry
    if (window.speechSynthesis.getVoices().length === 0) {
      setTimeout(() => speakVerification(taskId, name), 200);
      return;
    }
    
    window.speechSynthesis.speak(utterance);
  }, [isMuted, language, getBestMaleVoice, isNativeApp]);

  const speakWakeUp = useCallback(
    (name: string, urgent = false) => {
      const text = urgent
        ? language === "ar"
          ? `استيقظ يا ${name}! استيقظ حالاً يا ${name}! وقت الصلاة قد حان! قم يا ${name}! بصوت رجل قوي!`
          : `Wake up ${name}! Wake up now ${name}! Prayer time is here! Get up ${name}! Male voice!`
        : language === "ar"
        ? `استيقظ يا ${name}... استيقظ يا ${name}... حان وقت الفجر يا ${name}... قم للصلاة يا ${name}... بصوت رجل`
        : `Wake up ${name}... Wake up ${name}... It's Fajr time ${name}... Get up for prayer ${name}... Male voice`;

      // داخل تطبيق APK: النطق عبر محرك الهاتف الأصلي (WebView لا يدعم speechSynthesis)
      if (isNativeApp) {
        if (!isMuted) void nativeSpeak(text, { lang: language === "ar" ? "ar-SA" : "en-US", rate: urgent ? 1.0 : 0.9, pitch: urgent ? 0.75 : 0.65 });
        return;
      }
      if (isMuted || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ar" ? "ar-SA" : "en-US";
      // Force MALE voice: very low pitch 0.35-0.55, slower rate
      utterance.rate = urgent ? 0.95 : 0.82;
      utterance.pitch = urgent ? 0.55 : 0.38; // Extremely low for deep male voice
      utterance.volume = 1;

      const bestMale = getBestMaleVoice(language === "ar" ? "ar" : "en");
      if (bestMale) {
        utterance.voice = bestMale;
        console.log(`🎙️ [Male Voice v5] WakeUp using: ${bestMale.name} (${bestMale.lang}) pitch ${utterance.pitch} rate ${utterance.rate} urgent ${urgent}`);
      } else {
        console.log(`🎙️ [Male Voice v5] No male voice found, using low pitch ${utterance.pitch} to force male sound`);
      }

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        setTimeout(() => {
          const retryVoices = window.speechSynthesis.getVoices();
          if (retryVoices.length > 0) {
            speakWakeUp(name, urgent);
          }
        }, 200);
        return;
      }

      window.speechSynthesis.speak(utterance);
    },
    [isMuted, language, getBestMaleVoice, isNativeApp]
  );

  const stopOscillatorsOnly = useCallback(() => {
    oscillatorsRef.current.forEach((osc) => {
      try { osc.stop(); } catch {}
    });
    oscillatorsRef.current = [];
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  }, []);

  const playGentleToneForVerification = useCallback(() => {
    if (isMuted) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch {} }, 400);
  }, [isMuted]);

  const playGentleTone = useCallback(() => {
    if (isMuted) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscillatorsRef.current.push(osc);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    setTimeout(() => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        try { osc.stop(); } catch {}
      }, 600);
    }, 2000);
  }, [isMuted]);

  const playAnnoyingSounds = useCallback(() => {
    if (isMuted) return;
    stopOscillatorsOnly();
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "square" : i === 1 ? "sawtooth" : "triangle";
      osc.frequency.value = 800 + Math.random() * 600 + i * 200;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5 + i;
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      oscillatorsRef.current.push(osc, lfo);
      const interval = setInterval(() => {
        gain.gain.value = gain.gain.value > 0 ? 0 : 0.2;
      }, 300 + i * 100);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, [isMuted, stopOscillatorsOnly]);

  const playExtremeSounds = useCallback(() => {
    if (isMuted) return;
    stopOscillatorsOnly();
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = ["square", "sawtooth", "triangle", "square", "sawtooth"][i] as OscillatorType;
      osc.frequency.value = 300 + Math.random() * 2000;
      filter.type = "bandpass";
      filter.frequency.value = 1000 + Math.random() * 2000;
      gain.gain.value = 0.25;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const jumpInterval = setInterval(() => {
        osc.frequency.linearRampToValueAtTime(200 + Math.random() * 3000, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(Math.random() * 0.4 + 0.1, ctx.currentTime + 0.1);
      }, 150 + Math.random() * 300);
      oscillatorsRef.current.push(osc);
      setTimeout(() => clearInterval(jumpInterval), 15000);
    }
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.1;
    whiteNoise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start();
  }, [isMuted, stopOscillatorsOnly]);

  useEffect(() => {
    if (!isAlarmActive || alarmStage !== "idle") return;
    runAlarmCheck(); // فحص فوري عند التفعيل (يلحق بالموعد إن حان)
    const interval = setInterval(runAlarmCheck, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlarmActive, alarmStage, alarmTime, selectedDays, durationDays, alarmStartDate]);

  useEffect(() => {
    if (alarmStage === "idle" || alarmStage === "verification" || alarmStage === "completed") return;
    const escalationTime = fastMode ? 15 : 5 * 60;
    const extremeTime = fastMode ? 30 : 10 * 60;
    const interval = setInterval(() => {
      setTimeSinceRinging((prev) => {
        const next = prev + 1;
        if (next === escalationTime && alarmStage === "ringing") {
          setAlarmStage("annoying");
          playAnnoyingSounds();
          if (userName) speakWakeUp(userName, true);
          speechIntervalRef.current = setInterval(() => {
            if (userName) speakWakeUp(userName, true);
          }, 8000) as any;
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker?.controller.postMessage({ type: "TRIGGER_ALARM", name: userName, stage: "annoying" });
          }
        } else if (next === extremeTime && alarmStage === "annoying") {
          setAlarmStage("extreme");
          playExtremeSounds();
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker?.controller.postMessage({ type: "TRIGGER_ALARM", name: userName, stage: "extreme" });
          }
        }
        return next;
      });
    }, 1000);
    escalationIntervalRef.current = interval as any;
    return () => clearInterval(interval);
  }, [alarmStage, fastMode, userName, playAnnoyingSounds, playExtremeSounds, speakWakeUp]);

  const triggerAlarm = useCallback((opts?: { demo?: boolean }) => {
    // علّم اليوم كرنّ (مرة واحدة فقط) - زر التجربة لا يُعلَّم حتى لا يلغي الرنين الحقيقي
    if (!opts?.demo) {
      try { localStorage.setItem("hatsally-last-fired", getTodayKey(new Date())); } catch {}
    }
    // فتح قفل الصوت: المتصفح يعلّق AudioContext بدون تفاعل سابق فيرنّ صامتاً!
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    } catch {}
    setAlarmStage("ringing");
    setTimeSinceRinging(0);
    // تسخين محرك كشف الوجه مبكراً حتى يكون جاهزاً عند التحقق
    warmUpVerification();
    // فرض الاستيقاظ: صوت أقصى + شاشة مستيقظة فوق القفل
    void enforceRinging();
    // رنين على مستوى النظام (محرك المنبه الدقيق المربوط بساعة الهاتف):
    // إشعار مستمر + صوت متكرر يظلان يعملان حتى بعد إغلاق واجهة التطبيق
    // وحتى حذف الإشعار - لا يتوقفان إلا بعد اكتمال التحقق بالتصوير.
    // (زر التجربة demo لا يفعّل خدمة النظام - تجربة داخلية فقط)
    if (!opts?.demo && checkNativeApp()) void hatAlarmStart();
    if (userName) speakWakeUp(userName, false);
    playGentleTone();
    speechIntervalRef.current = setInterval(() => {
      if (userName) speakWakeUp(userName, false);
      playGentleTone();
    }, 6000) as any;
    if ("vibrate" in navigator) {
      navigator.vibrate([1000, 500, 1000, 500, 2000]);
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker?.controller.postMessage({ type: "TRIGGER_ALARM", name: userName, stage: "ringing" });
    }
  }, [userName, speakWakeUp, playGentleTone]);

  // نص الرنين القادم + العد التنازلي الحي (يُعاد حسابه كل ثانية مع عدّاد currentTime)
  const renderNextRing = () => {
    const next = computeNextRing(new Date(currentTime), { time: alarmTime, days: selectedDays, startDate: alarmStartDate, durationDays });
    if (!next) return <span className="opacity-70">{t.nextRingNone}</span>;
    const diffMs = Math.max(0, next.getTime() - currentTime.getTime());
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    const weekday = next.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { weekday: "long" });
    const hh = String(next.getHours()).padStart(2, "0");
    const mm = String(next.getMinutes()).padStart(2, "0");
    const countdown = language === "ar" ? `بعد ${h}س ${m}د ${s}ث` : `in ${h}h ${m}m ${s}s`;
    return <span>{t.nextRing}: <span className="font-bold">{weekday} {hh}:{mm}</span> <span className="font-mono">({countdown})</span></span>;
  };

  // الفحص الموحد للموعد: العدّاد الدوري + اللحاق عند الفتح/الاستئناف (الضغط على التنبيه وهو مغلق)
  const runAlarmCheck = useCallback(() => {
    if (!isAlarmActive || alarmStage !== "idle") return;
    let lastFired: string | null = null;
    try { lastFired = localStorage.getItem("hatsally-last-fired"); } catch {}
    const decision = decideAlarm(new Date(), {
      time: alarmTime,
      days: selectedDays,
      startDate: alarmStartDate,
      durationDays,
      lastFiredKey: lastFired,
    });
    if (decision.action === "ring") {
      console.log("⏰ Time reached - ringing!");
      triggerAlarm();
    } else if (decision.action === "missed") {
      // فات أكثر من المهلة: علّم اليوم حتى لا يتكرر
      try { localStorage.setItem("hatsally-last-fired", getTodayKey(new Date())); } catch {}
    } else if (decision.action === "expired") {
      setIsAlarmActive(false);
      setHatAlarmArmed(false);
      try { localStorage.setItem("hatsally-alarm-active", "false"); } catch {}
      // انتهت المدة: إلغاء كل المواعيد الدقيقة على النظام
      void hatAlarmCancel();
      void cancelNativeAlarm();
    }
  }, [isAlarmActive, alarmStage, alarmTime, selectedDays, durationDays, alarmStartDate, triggerAlarm]);

  // اللحاق بالرنين عند فتح التطبيق أو العودة إليه أو عودة الإنترنت
  useEffect(() => {
    runAlarmCheck();
    const onReturn = () => { if (!document.hidden) runAlarmCheck(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, [runAlarmCheck]);

  // مرجع دائم لآخر نسخة من triggerAlarm (لمستمع التنبيه الأصلي)
  const triggerAlarmRef = useRef(triggerAlarm);
  triggerAlarmRef.current = triggerAlarm;

  // الضغط على تنبيه المنبه الأصلي يبدأ الرنين فوراً (التطبيق كان مغلقاً أو في الخلفية)
  useEffect(() => {
    if (!isNativeApp) return;
    let off: (() => void) | null = null;
    void onNativeAlarmTap(() => {
      if (alarmStageRef.current === "idle") {
        console.log("⏰ Ringing from native notification tap");
        triggerAlarmRef.current();
      }
    }).then((fn) => { off = fn; });
    return () => { if (off) off(); };
  }, [isNativeApp]);

  // المزامنة مع محرك المنبه الدقيق عند فتح التطبيق (مربوط بساعة الهاتف) 🕰
  // 1) إذا كان رنين النظام يعمل (حلّ الموعد والتطبيق كان مغلقاً) → واجهة التطبيق
  //    تتزامن معه فوراً وتبدأ التصعيد والتحقق.
  // 2) إذا كان المنبه مفعلاً → إعادة مزامنة المواعيد الدقيقة على النظام حتى
  //    لا يضيع أبداً (تحديث التطبيق، إعادة تشغيل الهاتف، اقتلاع العملية).
  useEffect(() => {
    if (!isNativeApp) return;
    let cancelled = false;
    void (async () => {
      const st = await hatAlarmState();
      if (cancelled) return;
      setHatAlarmArmed(st.armed);
      // 1) المنبه النظامي يرن الآن → مزامنة الواجهة الداخلية فوراً
      if (st.ringing && alarmStageRef.current === "idle") {
        console.log("🚨 [HatAlarm] system alarm already ringing - syncing in-app UI");
        triggerAlarmRef.current();
        return;
      }
      // 2) إعادة مزامنة المواعيد إذا كان المنبه مفعلاً
      try {
        const active = localStorage.getItem("hatsally-alarm-active") === "true";
        if (active) {
          const time = localStorage.getItem("hatsally-alarm-time") || "05:00";
          const name = localStorage.getItem("hatsally-user-name") || "";
          const lang = (localStorage.getItem("hatsally-lang") as Language) || "ar";
          let days: number[] = [0, 1, 2, 3, 4, 5, 6];
          try {
            const d = JSON.parse(localStorage.getItem("hatsally-alarm-days") || "");
            if (Array.isArray(d) && d.length > 0) days = d;
          } catch {}
          const ok = await hatAlarmSchedule({ time, days, name, lang: lang === "en" ? "en" : "ar" });
          setHatAlarmArmed(ok);
          if (!ok) {
            // بديل إن تعذر محرك المنبه الدقيق: تنبيهات LocalNotifications
            void scheduleNativeAlarm({ time, name, days, lang: lang === "en" ? "en" : "ar" });
          }
        }
      } catch {
        /* تجاهل */
      }
    })();
    return () => { cancelled = true; };
  }, [isNativeApp]);

  // Listen to SW messages for persistent alarm + auto-update - must be after triggerAlarm
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleSWMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "ALARM_TRIGGERED") {
          console.log("🔔 SW triggered alarm", data);
          if (alarmStage === "idle") {
            triggerAlarm();
          }
        }
        if (data.type === "NOTIFICATION_WAKE") {
          console.log("🔔 SW notification tapped - waking", data);
          if (alarmStage === "idle") {
            triggerAlarm();
          }
        }
        if (data.type === "NOTIFICATION_RESURRECTED") {
          console.log("🔒 Notification resurrected - cannot dismiss");
          if (alarmStage !== "idle" && alarmStage !== "completed") {
            playExtremeSounds();
            if (userName) speakWakeUp(userName, true);
          }
        }
        if (data.type === "APP_UPDATED") {
          console.log("🎉 APP_UPDATED via SW message:", data.version);
          setUpdateInfo({ version: data.version || appVersion, message: data.message || (language === "ar" ? "تم تحديث التطبيق تلقائياً" : "App updated automatically") });
          setShowUpdateBanner(true);
          setJustUpdated(true);
          if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
          // Auto hide after 8 sec
          setTimeout(() => {
            setShowUpdateBanner(false);
            setJustUpdated(false);
          }, 8000);
          // Store for after reload
          localStorage.setItem("hatsally-last-update", JSON.stringify({ version: data.version, timestamp: Date.now(), message: data.message }));
          localStorage.setItem("hatsally-update-pending", "true");
        }
        if (data.type === "VERSION_INFO") {
          console.log("📦 Version info:", data.version);
        }
      };
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
      return () => navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    }
  }, [alarmStage, userName, triggerAlarm, playExtremeSounds, speakWakeUp, language, appVersion]);

  // Prevent closing when alarm is ringing / verification / extreme - after sound functions
  useEffect(() => {
    const shouldBlock = alarmStage === "ringing" || alarmStage === "annoying" || alarmStage === "extreme" || alarmStage === "verification";
    if (!shouldBlock) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = language === "ar" ? "المنبه يرن! لا يمكن إغلاق الصفحة إلا بالتصوير!" : "Alarm ringing! Can only stop with photo verification!";
      return e.returnValue;
    };
    const handleVisibilityChange = () => {
      if (document.hidden && shouldBlock) {
        if (userName) speakWakeUp(userName, true);
        if ("vibrate" in navigator) navigator.vibrate([500,200,500,200,1000]);
        if (isNativeApp) {
          void notifyNative(
            language === "ar" ? `⏰ ${t.cannotClose} - ${userName}` : `⏰ ${t.cannotClose} - ${userName}`,
            language === "ar" ? "المنبه لا يزال يعمل! لن يتوقف إلا بالتصوير" : "Alarm still ringing! Only photo verification stops it"
          );
        }
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(language === "ar" ? `⏰ ${t.cannotClose} - ${userName}` : `⏰ ${t.cannotClose} - ${userName}`, {
              body: language === "ar" ? "المنبه لا يزال يعمل! لن يتوقف إلا بالتصوير" : "Alarm still ringing! Only photo verification stops it",
              icon: "/icons/icon-192.png",
              requireInteraction: true,
              tag: "persistent-alarm",
            } as any);
          } catch {}
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const pushState = () => { history.pushState(null, "", location.href); };
    pushState();
    const handlePopState = () => {
      if (shouldBlock) {
        pushState();
        if (language === "ar") alert("لا يمكن الرجوع! المنبه يرن - يجب التصوير أولاً!");
        else alert("Cannot go back! Alarm ringing - must verify with photos!");
        if (userName) speakWakeUp(userName, true);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [alarmStage, language, userName, t.cannotClose, speakWakeUp, isNativeApp]);

  const handleSetAlarm = async () => {
    if (!userName.trim()) {
      alert(language === "ar" ? "الرجاء إدخال اسمك أولاً" : "Please enter your name first");
      return;
    }
    if (selectedDays.length === 0) {
      alert(language === "ar" ? "اختر يوماً واحداً على الأقل" : "Select at least one day");
      return;
    }
    // المستخدم يمنح الموافقات أولاً - لا منبه بدون الأذونات الحرجة
    const crit = await checkCritical();
    if (!crit.ok) {
      setShowPermWizard(true);
      return;
    }
    const startDate = new Date().toISOString();
    localStorage.setItem("hatsally-user-name", userName);
    localStorage.setItem("hatsally-alarm-time", alarmTime);
    localStorage.setItem("hatsally-alarm-days", JSON.stringify(selectedDays));
    localStorage.setItem("hatsally-alarm-duration", durationDays === 'forever' ? 'forever' : String(durationDays));
    localStorage.setItem("hatsally-alarm-start-date", startDate);
    localStorage.setItem("hatsally-alarm-active", "true");
    // تسليح جديد = يوم جديد: امسح علامة الرنين السابق حتى يرنّ اليوم لو أعيد الضبط
    try { localStorage.removeItem("hatsally-last-fired"); } catch {}
    setAlarmStartDate(startDate);
    setSnoozeCount(0);
    setIsAlarmActive(true);
    setAlarmStage("idle");
    setTimeSinceRinging(0);
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker?.controller.postMessage({
        type: "SET_ALARM",
        time: alarmTime,
        name: userName,
        days: selectedDays,
        duration: durationDays,
        startDate: startDate
      });
    }
    // داخل تطبيق APK: جدولة منبه دقيق على ساعة الهاتف (AlarmManager)
    // - يعمل حتى لو التطبيق مغلقاً تماماً أو أُعيد تشغيل الهاتف
    // - إشعار مستمر + خدمة نظام تظل تعملان حتى بعد حذف الإشعار
    if (isNativeApp) {
      const exactOk = await hatAlarmSchedule({ time: alarmTime, name: userName, days: selectedDays, lang: language });
      setHatAlarmArmed(exactOk);
      if (!exactOk) {
        // بديل: تنبيهات LocalNotifications الأسبوعية
        void scheduleNativeAlarm({ time: alarmTime, name: userName, days: selectedDays, lang: language });
      }
      void notifyNative(
        language === "ar" ? "✅ تم ضبط منبه هتصلي" : "✅ HatSally alarm set",
        language === "ar"
          ? `سيوقظك المنبه الساعة ${alarmTime} يا ${userName} - مربوط بساعة هاتفك وسيعمل حتى لو حذفته من الإشعارات`
          : `Alarm will wake you at ${alarmTime}, ${userName} - tied to your phone's clock and keeps working after you dismiss it`
      );
    }
    if ("Notification" in window && isInstalled && Notification.permission === "granted") {
      try {
        new Notification(language === "ar" ? "✅ تم ضبط منبه هتصلي" : "✅ HatSally alarm set", {
          body: language === "ar" ? `سيوقظك المنبه الساعة ${alarmTime} يا ${userName} - ${selectedDays.length===7? t.everyday : selectedDays.length+' أيام'} - ${durationDays==='forever'? t.forever : durationDays+' يوم'}` : `Alarm will wake you at ${alarmTime}, ${userName}`,
          icon: "/icons/icon-192.png",
        });
      } catch {}
    }
  };

  const handleWakeUp = () => {
    // المطلوب: الصوت يعمل حتى تسجيل الثلاث صور - لا نوقف الصوت
    // فقط نوقف escalation timer لكن نبقي صوت التنبيه والنداء مستمر
    if (escalationIntervalRef.current) {
      clearInterval(escalationIntervalRef.current);
      escalationIntervalRef.current = null;
    }
    // لا نستدعي stopAllSounds هنا - الصوت مستمر
    // نوقف فقط speechInterval القديم ونبدأ verification loop
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    setAlarmStage("verification");
    setCurrentVerificationIndex(0);
    setVerificationAttempts(0);
    setAiResult(null);
    // فتح الكاميرا تلقائياً للمهمة الأولى (داخل سياق ضغطة المستخدم فيُقبل طلب الصلاحية)
    void openCamera(verificationTasks[0]?.id);
    // بدء نداء التحقق بصوت رجل مستمر
    if (userName) {
      speakVerification("water", userName);
      // استمرار النداء كل 10 ثواني حتى يكمل التحقق
      verificationSpeechRef.current = setInterval(() => {
        const taskId = verificationTasks[currentVerificationIndex]?.id || "water";
        if (userName) speakVerification(taskId, userName);
        playGentleToneForVerification();
      }, 10000) as any;
    }
  };

  const handleSnooze = () => {
    if (snoozeCount >= 1) {
      // No more snooze allowed - make it harder
      if (language === "ar") alert("تم استخدام الغفوة! لا يمكن إغلاقه إلا بالتصوير!");
      else alert("Snooze used! Only photo verification stops it!");
      // Intensify sound
      playExtremeSounds();
      if ("vibrate" in navigator) navigator.vibrate([200,100,200,100,500]);
      return;
    }
    setSnoozeCount(prev => prev+1);
    stopAllSounds();
    // إيقاف رنين النظام أيضاً - لا صوت خلفية أثناء الغفوة (يعود مع الرنين القادم)
    void hatAlarmStop();
    if (verificationSpeechRef.current) {
      clearInterval(verificationSpeechRef.current);
      verificationSpeechRef.current = null;
    }
    setAlarmStage("idle");
    setTimeSinceRinging(0);
    setSnoozeHoldProgress(0);
    setIsHoldingSnooze(false);
    setTimeout(() => {
      triggerAlarm();
    }, fastMode ? 10000 : 5 * 60 * 1000);
  };

  const handleSnoozeHoldStart = () => {
    if (snoozeCount >= 1) {
      handleSnooze();
      return;
    }
    setIsHoldingSnooze(true);
    setSnoozeHoldProgress(0);
    const startTime = Date.now();
    const duration = 3000; // 3 seconds hold
    if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
    snoozeHoldRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setSnoozeHoldProgress(progress);
      if (elapsed >= duration) {
        if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
        setIsHoldingSnooze(false);
        setSnoozeHoldProgress(0);
        handleSnooze();
      }
    }, 50) as any;
  };

  const handleSnoozeHoldEnd = () => {
    if (snoozeHoldRef.current) {
      clearInterval(snoozeHoldRef.current);
      snoozeHoldRef.current = null;
    }
    setIsHoldingSnooze(false);
    setSnoozeHoldProgress(0);
  };

  // تحميل ملف APK الحقيقي على الهاتف مع نسبة تقدم
  const handleDownloadAPK = async () => {
    // الآيفون لا يدعم APK - نعرض خيار التثبيت من المتصفح فقط
    if (isIosDevice() && !isNativeApp) {
      setShowDownloadModal(true);
      return;
    }
    setApkError(null);
    setApkDownloaded(false);
    setApkProgress(0);
    setShowDownloadModal(true);

    // التأكد من معلومات آخر نسخة
    let info = apkInfo;
    if (!info) {
      info = await getApkInfo();
      if (info) setApkInfo(info);
    }

    const candidates = [
      info?.available ? info.url : null,
      "/downloads/hatsally.apk",
      info?.releaseUrl || APK_RELEASE_URL,
    ].filter(Boolean) as string[];
    // إزالة التكرار
    const urls = [...new Set(candidates)];

    setApkDownloading(true);
    let lastError: unknown = null;
    for (const url of urls) {
      try {
        console.log("📥 Trying APK download from:", url);
        const blob = await downloadApk(url, (pct) => setApkProgress(pct));
        // التأكد أن الملف APK حقيقي وليس صفحة خطأ (أكبر من 1MB ويبدأ بتوقيع ZIP)
        if (blob.size < 1024 * 1024) {
          const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
          const isZip = head[0] === 0x50 && head[1] === 0x4b;
          if (!isZip) throw new Error("not an APK file");
        }
        triggerBlobDownload(blob, info?.fileName || "hatsally.apk");
        setApkDownloading(false);
        setApkDownloaded(true);
        setApkProgress(100);
        if ("vibrate" in navigator) { try { navigator.vibrate([100, 50, 200]); } catch {} }
        return;
      } catch (e) {
        console.warn("APK download failed from", url, e);
        lastError = e;
        setApkProgress(0);
      }
    }
    setApkDownloading(false);
    console.error("All APK sources failed:", lastError);
    setApkError(t.apkError);
  };

  const handleInstallApp = async () => {
    if (!userName.trim()) {
      alert(language === "ar" ? "الرجاء إدخال اسمك أولاً قبل التثبيت" : "Please enter your name before installing");
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setInstallStep("installing");
    try {
      localStorage.setItem("hatsally-user-name", userName);
      localStorage.setItem("hatsally-alarm-time", alarmTime);
      // لا نضع installed true إلا بعد نجاح التثبيت الفعلي
      if ("Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
      if (deferredPrompt) {
        // PWA install prompt الحقيقي - يثبت التطبيق كـ standalone
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log("PWA install outcome:", outcome);
        if (outcome === "accepted") {
          setIsInstalled(true);
          setIsInstallable(false);
          setShowInstallBanner(false);
          localStorage.setItem("hatsally-installed", "true");
        }
        setDeferredPrompt(null);
      } else {
        // إذا لم يتوفر prompt، نحاول تسجيل service worker ونعرض تعليمات يدوية
        // لا نكذب على المستخدم أن التطبيق مثبت - نبقيه غير مثبت حتى يثبت يدوياً
        if ("serviceWorker" in navigator && navigator.serviceWorker) {
          try { await navigator.serviceWorker.ready; } catch {}
        }
        // على iOS/Android بدون prompt، التعليمات اليدوية هي الطريقة الصحيحة
        // لا نضع isInstalled true هنا إلا إذا كان standalone فعلاً
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        if (isStandalone) {
          setIsInstalled(true);
          localStorage.setItem("hatsally-installed", "true");
        }
      }
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker?.controller.postMessage({
          type: "SET_ALARM",
          time: alarmTime,
          name: userName,
        });
      }
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
      if (isNativeApp) {
        void notifyNative(
          language === "ar" ? "🎉 تم تثبيت هتصلي على هاتفك!" : "🎉 HatSally installed!",
          language === "ar" ? `المنبه الآن مثبت وسيوقظك الساعة ${alarmTime} يا ${userName}` : `Alarm installed and will wake you at ${alarmTime}, ${userName}`
        );
      }
      if ("Notification" in window && Notification.permission === "granted") {
        setTimeout(() => {
          try {
            new Notification(language === "ar" ? "🎉 تم تثبيت هتصلي على هاتفك!" : "🎉 HatSally installed!", {
              body: language === "ar" ? `المنبه الآن مثبت وسيوقظك الساعة ${alarmTime} يا ${userName}` : `Alarm installed and will wake you at ${alarmTime}, ${userName}`,
              icon: "/icons/icon-192.png",
              badge: "/icons/icon-192.png",
            });
          } catch {}
        }, 1000);
      }
      // إذا كان التثبيت الحقيقي تم، نعرض success
      const standaloneCheck = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true || localStorage.getItem("hatsally-installed") === "true";
      if (standaloneCheck || deferredPrompt === null) {
        // في حالة عدم وجود prompt، نعتبر التعليمات اليدوية كـ success بعد محاولة
        if (!standaloneCheck) {
          // لا نزال غير standalone، لكننا أظهرنا التعليمات
          setInstallStep("idle");
          return;
        }
      }
      setInstallStep("success");
      setShowInstallBanner(false);
      setTimeout(() => {
        setInstallStep("idle");
        setShowDownloadModal(false);
      }, 4000);
    } catch (error) {
      console.error("Install failed:", error);
      setInstallStep("idle");
      alert(language === "ar" ? "حدث خطأ أثناء التثبيت" : "Install failed, try again");
    }
  };

  // إلصاق البث بعنصر الفيديو عند ظهوره (العنصر غير موجود لحظة فتح الكاميرا - بدونه شاشة سوداء!)
  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen]);

  const openCamera = async (taskId?: VerificationId) => {
    const currentTaskId = taskId || verificationTasks[currentVerificationIndex]?.id || "water";
    setCameraPermissionError(false);
    setCameraErrorCode("");
    setAiResult(null);
    // أوقف أي بث قديم أولاً وإلا رفض الهاتف: الكاميرا مشغولة (خصوصاً عند تبديل أمامية/خلفية)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => { try { tr.stop(); } catch {} });
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
    const fail = (code: string) => {
      setCameraErrorCode(code);
      setCameraPermissionError(true);
      setCameraStreamActive(false);
    };
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fail("unsupported");
        return;
      }
      // اختيار الكاميرا المناسبة: أمامية للوجه، خلفية للباقي
      const facingMode = currentTaskId === "face" ? "user" : "environment";
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
      } catch (firstErr: unknown) {
        const n = (firstErr as { name?: string })?.name || "";
        // رفض الصلاحية: لا فائدة من المحاولة التلقائية - المستخدم يجب أن يسمح
        if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") throw firstErr;
        // خطأ قيود/جهاز: جرّب بدون شروط
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraStreamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraOpen(true);
      setCapturedImage(null);
      // اهتزاز للتأكيد
      if ("vibrate" in navigator) navigator.vibrate(50);
    } catch (err: unknown) {
      console.error("Camera error:", err);
      const n = (err as { name?: string })?.name || "";
      if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") fail("denied");
      else if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") fail("missing");
      else if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") fail("busy");
      else fail("unknown");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // للكاميرا الأمامية نحتاج mirror
      if (verificationTasks[currentVerificationIndex]?.id === "face") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedImage(dataUrl);
      // اهتزاز
      if ("vibrate" in navigator) navigator.vibrate([30, 20, 30]);
    }
  };

  const confirmCapture = async (forcePass = false) => {
    if (!capturedImage) return;
    const currentTaskId = verificationTasks[currentVerificationIndex]?.id;
    if (!currentTaskId) return;

    // If forcePass from UI (user pressed confirm anyway after low confidence)
    if (forcePass && aiResult) {
      // صارم: يُسمح بالتأكيد اليدوي فقط عند ثقة ≥30 أو بعد محاولتين
      if (aiResult.confidence < 25 && verificationAttempts < 2) {
        // Still too low, require at least one more try
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        return;
      }
      // Force valid
      setAiResult({ ...aiResult, valid: true, message: language === "ar" ? "تم التأكيد ✓" : "Confirmed ✓" });
    } else {
      // تشغيل تحليل AI
      setAiAnalyzing(true);
      setAiResult(null);
      try {
        let aiCheck = await analyzeImageWithAI(capturedImage, currentTaskId, verificationAttempts);

        setAiResult(aiCheck);
        setAiAnalyzing(false);
        setVerificationAttempts(prev => prev + 1);

        if (!aiCheck.valid) {
          // فشل التحليل - نعرض الفحوصات والنصائح، والمستخدم يعيد التصوير
          // زر "تأكيد على أي حال" يظهر فقط عند ثقة ≥30 أو بعد محاولتين
          if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]);
          return;
        }
      } catch (e) {
        console.error("AI analysis error", e);
        setAiAnalyzing(false);
        // عند الخطأ: فشل آمن مع إمكانية إعادة المحاولة (لا تمرير تلقائي)
        setAiResult({
          valid: false,
          confidence: 10,
          message: language === "ar" ? "تعذر تحليل الصورة - أعد التصوير" : "Analysis failed - retake photo",
          checks: [],
          tips: ["tipFaceRetry"],
        });
      }
    }

      // نجح التحليل
      if ("vibrate" in navigator) navigator.vibrate([50, 30, 50, 30, 100]);
      const updated = [...verificationTasks];
      updated[currentVerificationIndex].completed = true;
      updated[currentVerificationIndex].image = capturedImage;
      setVerificationTasks(updated);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsCameraOpen(false);
      setCameraStreamActive(false);
      setCapturedImage(null);
      setAiResult(null);

      if (currentVerificationIndex < verificationTasks.length - 1) {
        const nextIndex = currentVerificationIndex + 1;
        setCurrentVerificationIndex(nextIndex);
        setVerificationAttempts(0);
        // نطق تشجيعي للخطوة التالية
        const nextTaskId = verificationTasks[nextIndex]?.id || "prayer";
        if (userName) {
          setTimeout(() => speakVerification(nextTaskId, userName), 500);
        }
        // تحديث interval النداء للخطوة الجديدة
        if (verificationSpeechRef.current) {
          clearInterval(verificationSpeechRef.current);
          verificationSpeechRef.current = setInterval(() => {
            const tid = verificationTasks[nextIndex]?.id || nextTaskId;
            if (userName) speakVerification(tid, userName);
            playGentleToneForVerification();
          }, 10000) as any;
        }
        // فتح الكاميرا تلقائياً للخطوة التالية (بالعدسة المناسبة: أمامية للوجه/خلفية للباقي)
        void openCamera(nextTaskId as VerificationId);
      } else {
        // اكتملت كل المهام - الآن فقط نوقف الصوت
        if (verificationSpeechRef.current) {
          clearInterval(verificationSpeechRef.current);
          verificationSpeechRef.current = null;
        }
        if (speechIntervalRef.current) {
          clearInterval(speechIntervalRef.current);
          speechIntervalRef.current = null;
        }
        stopOscillatorsOnly();
        if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch {} }
        void stopNativeSpeech();
        // انتهى الفرض: إرجاع الصوت وتحرير قفل الشاشة
        void relaxAfterRinging();
        setAlarmStage("completed");
        // بعد الاكتمال: يبقى المنبه مسلحاً دائماً - الفحص الدوري هو من ينهي المدد المحدودة عند انتهائها
        // (الخلل القديم كان يقتل منبه 7/14/30 يوم بعد أول رنين!)
        setIsAlarmActive(true);
        localStorage.setItem("hatsally-alarm-active", "true");
        // إيقاف رنين النظام (الإشعار المستمر + الصوت المتكرر) - اكتمل التحقق
        void hatAlarmStop();
        // إعادة جدولة المواعيد القادمة على ساعة الهاتف (أيام الغد)
        void (async () => {
          const ok = await hatAlarmSchedule({ time: alarmTime, name: userName, days: selectedDays, lang: language });
          setHatAlarmArmed(ok);
          if (!ok) void scheduleNativeAlarm({ time: alarmTime, name: userName, days: selectedDays, lang: language });
        })();
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker?.controller.postMessage({ type: "ALARM_COMPLETED", name: userName });
        }
        // صوت نجاح - صوت رجل
        {
          const successText = language === "ar" ? `تقبل الله يا ${userName}! أحسنت الوضوء والاستيقاظ! بصوت رجل!` : `May Allah accept ${userName}! Well done! Male voice!`;
          if (isNativeApp) {
            if (!isMuted) void nativeSpeak(successText, { lang: language === "ar" ? "ar-SA" : "en-US", rate: 0.92, pitch: 0.7 });
          } else if (!isMuted && "speechSynthesis" in window) {
          const ut = new SpeechSynthesisUtterance(successText);
          ut.lang = language === "ar" ? "ar-SA" : "en-US";
          ut.pitch = 0.42; // Low male pitch
          ut.rate = 0.88;
          ut.volume = 1;
          const bestMale = getBestMaleVoice(language === "ar" ? "ar" : "en");
          if (bestMale) ut.voice = bestMale;
          console.log(`🎙️ [Male Voice v5] Success using: ${bestMale?.name} pitch ${ut.pitch}`);
          window.speechSynthesis.speak(ut);
          }
        }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      // حتى الصور من المعرض تخضع لـ AI
      // لكن نترك confirmCapture يتولى التحليل
    };
    reader.readAsDataURL(file);
  };

  const resetAlarm = () => {
    stopAllSounds();
    void relaxAfterRinging();
    if (verificationSpeechRef.current) {
      clearInterval(verificationSpeechRef.current);
      verificationSpeechRef.current = null;
    }
    if (snoozeHoldRef.current) {
      clearInterval(snoozeHoldRef.current);
      snoozeHoldRef.current = null;
    }
    setAlarmStage("idle");
    setIsAlarmActive(false);
    setTimeSinceRinging(0);
    setSnoozeCount(0);
    setSnoozeHoldProgress(0);
    setIsHoldingSnooze(false);
    setVerificationTasks((prev) => prev.map((t) => ({ ...t, completed: false, image: null })));
    setCurrentVerificationIndex(0);
    setVerificationAttempts(0);
    setAiAnalyzing(false);
    setAiResult(null);
    setCapturedImage(null);
    setIsCameraOpen(false);
    setCameraPermissionError(false);
    setCameraStreamActive(false);
    localStorage.setItem("hatsally-alarm-active", "false");
    // إلغاء محرك المنبه الدقيق على النظام (المواعيد + خدمة الرنين)
    setHatAlarmArmed(false);
    void hatAlarmCancel();
    void cancelNativeAlarm();
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker?.controller.postMessage({ type: "CLEAR_ALARM" });
    }
    if (escalationIntervalRef.current) clearInterval(escalationIntervalRef.current);
    if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const formatTimeSince = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Theme classes
  const bgMain = isDark ? "bg-[#060e0d] text-white" : "bg-[#f8faf9] text-zinc-900";
  const bgSecondary = isDark ? "bg-white/[0.02]" : "bg-zinc-900/[0.02]";
  const borderColor = isDark ? "border-white/[0.06]" : "border-zinc-900/[0.06]";
  const glassClass = isDark ? "glass" : "glass bg-white/60 backdrop-blur-xl border border-zinc-900/5";
  const glassDarkClass = isDark ? "glass-dark" : "glass-dark bg-white/90 backdrop-blur-xl border border-zinc-900/5 shadow-xl";
  const textMuted = isDark ? "text-white/60" : "text-zinc-600";
  const textFaint = isDark ? "text-white/40" : "text-zinc-500";
  const textFaint2 = isDark ? "text-white/30" : "text-zinc-400";

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-300 ${bgMain} ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-0 ${isRTL ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"} w-[800px] h-[800px] ${isDark ? "bg-emerald-900/20" : "bg-emerald-200/30"} rounded-full blur-[120px] -translate-y-1/2`} />
        <div className={`absolute bottom-0 ${isRTL ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"} w-[600px] h-[600px] ${isDark ? "bg-teal-900/15" : "bg-teal-200/20"} rounded-full blur-[100px] translate-y-1/2`} />
        <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1000px] bg-gradient-to-r from-emerald-950/10 to-teal-950/10 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Install Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="relative z-[60] bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">{t.installBannerTitle}</p>
              <p className="text-xs opacity-90">{t.installBannerDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstallApp} className="px-4 py-2 rounded-full bg-white text-emerald-700 font-bold text-xs hover:bg-white/90 transition flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {t.installBtn}
            </button>
            <button
              onClick={() => {
                setShowInstallBanner(false);
                localStorage.setItem("hatsally-banner-dismissed", "true");
              }}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isInstalled && (
        <div className={`relative z-50 ${isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"} border-b px-4 py-2 flex items-center justify-center gap-2 text-xs`}>
          <Check className="w-4 h-4" />
          <span className="font-medium">{t.installedBadge}</span>
          <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      )}

      {/* Auto-Update Banner v5 - Shows when app updated for all users */}
      {showUpdateBanner && updateInfo && (
        <div className="relative z-[70] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white px-4 py-3 flex items-center justify-between shadow-xl animate-slide-down">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
              <span className="text-lg">🎉</span>
            </div>
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                {language === "ar" ? "تم تحديث التطبيق! 🔄" : "App Updated! 🔄"}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20">v{updateInfo.version}</span>
                {justUpdated && <span className="w-2 h-2 bg-green-400 rounded-full animate-ping" />}
              </p>
              <p className="text-xs opacity-90">
                {updateInfo.message} - {language === "ar" ? "صوت رجل محسن وذكاء أفضل!" : "Improved male voice & better AI!"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full bg-white text-indigo-700 font-bold text-xs hover:bg-white/90 transition flex items-center gap-1.5 shadow-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {language === "ar" ? "تحديث الآن" : "Refresh Now"}
            </button>
            <button
              onClick={() => {
                setShowUpdateBanner(false);
                setJustUpdated(false);
                localStorage.removeItem("hatsally-update-pending");
                localStorage.removeItem("hatsally-just-updated");
              }}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`relative z-50 border-b ${borderColor} ${isDark ? "bg-black/20" : "bg-white/70"} backdrop-blur-xl sticky top-0`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Moon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">{t.appName}</h1>
              <p className={`text-[11px] ${textFaint} -mt-1 tracking-widest`}>{t.appSub.toUpperCase()}</p>
            </div>
            {isInstalled && <span className="hidden md:inline-flex ml-2 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 text-[10px] font-bold">{t.installedShort}</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className={`w-9 h-9 rounded-full ${glassClass} flex items-center justify-center hover:bg-white/10 transition font-bold text-xs`}
              title={t.language}
            >
              <Globe className="w-4 h-4" />
            </button>
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`w-9 h-9 rounded-full ${glassClass} flex items-center justify-center hover:bg-white/10 transition`}
              title={t.theme}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className={`w-9 h-9 rounded-full ${glassClass} flex items-center justify-center hover:bg-white/10 transition`}>
              <Volume2 className={`w-4 h-4 ${isMuted ? "opacity-30" : ""}`} />
            </button>
            {isInstalled ? (
              <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full ${isDark ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-emerald-100 border-emerald-200 text-emerald-700"} border text-xs font-medium`}>
                <Check className="w-4 h-4" />
                {t.installedOnPhone}
              </div>
            ) : (
              <button
                onClick={() => setShowDownloadModal(true)}
                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition shadow-lg animate-pulse-glow"
              >
                <Download className="w-4 h-4" />
                {language === "ar" ? "ثبّت المنبه" : "Install Alarm"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className={`order-2 lg:order-1 ${isRTL ? "text-right" : "text-left"}`}>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"} border text-xs font-medium mb-6`}>
              <Sparkles className="w-3.5 h-3.5" />
              {isInstalled ? t.taglineInstalled : t.taglineReady}
              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
            </div>

            <h1 className="text-[2.5rem] lg:text-[3.5rem] font-black leading-[0.95] tracking-tight mb-6">
              {t.heroTitle1}
              <br />
              <span className="bg-gradient-to-l from-emerald-500 via-teal-500 to-emerald-600 bg-clip-text text-transparent">{t.heroTitle2}</span>
            </h1>

            <p className={`text-[17px] leading-relaxed ${textMuted} mb-8 max-w-[520px]`}>{t.heroDesc}</p>

            <div className="flex flex-wrap gap-2.5 mb-10">
              {[
                { icon: <HardDrive className="w-3.5 h-3.5" />, text: t.feature1 },
                { icon: <WifiOff className="w-3.5 h-3.5" />, text: t.feature2 },
                { icon: <Bell className="w-3.5 h-3.5" />, text: t.feature3 },
              ].map((pill, i) => (
                <div key={i} className={`flex items-center gap-2 px-3.5 py-2 rounded-full ${glassClass} text-[13px] ${isDark ? "text-white/80" : "text-zinc-700"}`}>
                  <span className="text-emerald-500">{pill.icon}</span>
                  {pill.text}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { if (isInstalled) setShowDownloadModal(true); else void handleDownloadAPK(); }}
                className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-bold text-[15px] shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-5 h-5" />
                {isInstalled ? t.installedSuccess : t.installNow}
                <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => {
                  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex items-center justify-center gap-2 px-8 py-4 rounded-full ${glassClass} font-semibold text-[15px] hover:bg-white/10 transition`}
              >
                <Play className="w-5 h-5" />
                {t.tryNow}
              </button>
            </div>

            <div className="mt-10 flex items-center gap-6">
              <div className="flex -space-x-2 space-x-reverse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-[#060e0d] bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-[11px] font-bold text-white">
                    {["أحمد", "محمد", "عمر", "يوسف"][i - 1][0]}
                  </div>
                ))}
                <div className="w-9 h-9 rounded-full border-2 border-[#060e0d] bg-emerald-500 flex items-center justify-center text-[11px] font-bold text-black">+2k</div>
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="mr-1 font-bold">4.9</span>
                </div>
                <p className={`${textFaint} text-xs mt-0.5`}>{language === "ar" ? "مثبت على أكثر من 2,000 هاتف" : "Installed on 2000+ phones"}</p>
              </div>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[600px] bg-gradient-to-b from-emerald-500/20 to-teal-500/10 rounded-[3rem] blur-[60px]" />
            <div className="relative animate-float">
              <div className="relative w-[320px] h-[680px] bg-gradient-to-b from-zinc-800 to-black rounded-[3.2rem] p-[10px] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_60px_rgba(0,0,0,0.6),0_0_80px_rgba(16,185,129,0.15)]">
                <div className="w-full h-full bg-[#0a1210] rounded-[2.6rem] overflow-hidden relative border border-white/10 flex flex-col">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-20 flex items-center justify-center">
                    <div className="w-16 h-1 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-11 flex items-center justify-between px-7 pt-2 text-[13px] font-medium z-10 text-white">
                    <span className="font-mono">{currentTime.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    <div className="flex items-center gap-1.5">
                      <Signal className="w-4 h-4" />
                      <Wifi className="w-4 h-4" />
                      <div className="flex items-center gap-1 border border-white/20 rounded-[5px] px-1 py-0.5">
                        <div className="w-4 h-2 bg-white rounded-[2px]" />
                        <Battery className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-5 pb-6 flex flex-col relative overflow-hidden">
                    <div className="flex items-center justify-between mt-2 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Moon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="font-bold text-sm text-white">{t.appNameShort}</span>
                        {isInstalled && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-black font-bold">{language === "ar" ? "مثبت" : "ON"}</span>}
                      </div>
                      <Settings className="w-5 h-5 text-white/40" />
                    </div>

                    {/* Dua Sentence under icon - REQUIRED */}
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center mb-3 animate-pulse-glow">
                        <AlarmClock className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="font-black text-[16px] text-white mb-1">{t.appName}</h3>
                      <p className="text-[10px] text-white/50 mb-3 px-2 leading-relaxed">{t.duaSentence}</p>
                    </div>

                    <div className="w-full space-y-2.5">
                      <div className="glass rounded-2xl p-3 flex items-center justify-between">
                        <span className="text-xs text-white/60">{language === "ar" ? "الاسم" : "Name"}</span>
                        <span className="text-sm font-bold text-white">{userName || (language === "ar" ? "أحمد" : "Ahmed")}</span>
                      </div>
                      <div className="glass rounded-2xl p-3 flex items-center justify-between">
                        <span className="text-xs text-white/60">{t.wakeTime}</span>
                        <span className="text-sm font-mono font-bold text-white">{alarmTime}</span>
                      </div>
                      <div className="glass rounded-2xl p-3 flex items-center justify-between">
                        <span className="text-xs text-white/60">{t.installStatus}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          {isInstalled ? t.installedShort : t.readyToInstall}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto w-full">
                      <div className="h-12 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-black text-sm shadow-lg shadow-emerald-500/20">
                        {isAlarmActive ? `${t.set} - ${alarmTime}` : isInstalled ? t.setYourTime : t.installFirst}
                      </div>
                      {/* Dua sentence again under button for emphasis */}
                      <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[9px] text-emerald-200/80 leading-relaxed text-center flex items-center justify-center gap-1">
                          <Heart className="w-3 h-3 text-emerald-400" />
                          {t.duaSentence}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-8 flex items-center justify-center">
                    <div className="w-32 h-1 bg-white rounded-full" />
                  </div>
                </div>
                <div className="absolute -left-[3px] top-28 w-[3px] h-8 bg-zinc-700 rounded-l-md" />
                <div className="absolute -left-[3px] top-40 w-[3px] h-14 bg-zinc-700 rounded-l-md" />
                <div className="absolute -left-[3px] top-56 w-[3px] h-14 bg-zinc-700 rounded-l-md" />
                <div className="absolute -right-[3px] top-36 w-[3px] h-20 bg-zinc-700 rounded-r-md" />
              </div>

              <div className={`absolute -right-6 top-20 ${glassDarkClass} rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl animate-float`} style={{ animationDelay: "0.5s" }}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className={`text-[11px] font-bold leading-none ${isDark ? "text-white" : "text-zinc-900"}`}>{t.feature1}</p>
                  <p className={`text-[10px] ${isDark ? "text-white/50" : "text-zinc-500"} mt-1`}>{language === "ar" ? "مثل أي تطبيق أصلي" : "Like native app"}</p>
                </div>
              </div>

              <div className={`absolute -left-8 bottom-32 ${glassDarkClass} rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl animate-float`} style={{ animationDelay: "1s" }}>
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <WifiOff className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className={`text-[11px] font-bold leading-none ${isDark ? "text-white" : "text-zinc-900"}`}>{t.feature2}</p>
                  <p className={`text-[10px] ${isDark ? "text-white/50" : "text-zinc-500"} mt-1`}>{language === "ar" ? "المنبه لا يحتاج إنترنت" : "No internet needed"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`relative z-10 border-y ${borderColor} ${bgSecondary} backdrop-blur`}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: t.step1Title,
                desc: t.step1Desc,
                icon: <Download className="w-5 h-5" />,
                color: "from-emerald-400 to-teal-400",
                time: t.step1Time,
              },
              {
                step: "02",
                title: t.step2Title,
                desc: t.step2Desc,
                icon: <BellRing className="w-5 h-5" />,
                color: "from-amber-400 to-orange-400",
                time: t.step2Time,
              },
              {
                step: "03",
                title: t.step3Title,
                desc: t.step3Desc,
                icon: <Camera className="w-5 h-5" />,
                color: "from-red-400 to-rose-500",
                time: t.step3Time,
              },
            ].map((item, i) => (
              <div key={i} className={`group relative ${glassClass} rounded-[1.5rem] p-6 hover:bg-white/[0.06] transition`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-black shadow-lg`}>{item.icon}</div>
                  <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full ${isDark ? "bg-white/10 border-white/10" : "bg-zinc-900/5 border-zinc-900/10"} border`}>{item.time}</span>
                </div>
                <div className={`text-[11px] font-mono ${textFaint2} mb-2 tracking-widest`}>{item.step}</div>
                <h3 className="font-bold text-[15px] mb-2">{item.title}</h3>
                <p className={`text-[13px] leading-relaxed ${textMuted}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">{t.demoTitle}</h2>
          <p className={textMuted}>{t.demoDesc}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
          <div className={`${glassClass} rounded-[2rem] p-8 border ${isDark ? "border-white/10" : "border-zinc-900/5"}`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                {t.settings}
              </h3>
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className={`text-xs ${textFaint} group-hover:text-white/80 transition`}>{t.fastMode}</span>
                <div className="relative">
                  <input type="checkbox" checked={fastMode} onChange={(e) => setFastMode(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition ${fastMode ? "bg-emerald-500" : isDark ? "bg-white/20" : "bg-zinc-300"}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${fastMode ? (isRTL ? "-translate-x-5 mr-0.5" : "translate-x-5 ml-0.5") : "translate-x-0 ml-0.5"}`} />
                  </div>
                </div>
              </label>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  {t.yourName}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className={`w-full h-14 px-5 ${isRTL ? "pr-12" : "pl-12"} rounded-2xl ${isDark ? "bg-black/40 border-white/10 focus:border-emerald-500/50" : "bg-white border-zinc-200 focus:border-emerald-500/50"} border focus:bg-black/60 outline-none transition text-[15px] placeholder:text-zinc-400`}
                  />
                  <User className={`absolute ${isRTL ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 ${textFaint2}`} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  {t.wakeTime}
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    className={`w-full h-14 px-5 ${isRTL ? "pr-12" : "pl-12"} rounded-2xl ${isDark ? "bg-black/40 border-white/10" : "bg-white border-zinc-200"} border focus:border-emerald-500/50 outline-none transition text-[15px] font-mono`}
                  />
                  <Clock className={`absolute ${isRTL ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 ${textFaint2}`} />
                </div>
              </div>

              {/* Days Selection */}
              <div className={`${glassClass} rounded-2xl p-4 border`}>
                <label className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="text-base">📅</span>
                  {t.alarmDaysTitle}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"} ml-auto`}>
                    {selectedDays.length === 7 ? t.everyday : `${selectedDays.length} ${selectedDays.length===1? t.daysLabel : t.daysLabelPlural}`}
                  </span>
                </label>
                <p className={`text-[11px] ${textFaint} mb-3`}>{t.alarmDaysDesc}</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {[
                    { id: 0, key: 'sun', shortKey: 'sun' },
                    { id: 1, key: 'mon', shortKey: 'mon' },
                    { id: 2, key: 'tue', shortKey: 'tue' },
                    { id: 3, key: 'wed', shortKey: 'wed' },
                    { id: 4, key: 'thu', shortKey: 'thu' },
                    { id: 5, key: 'fri', shortKey: 'fri' },
                    { id: 6, key: 'sat', shortKey: 'sat' },
                  ].map((d) => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setSelectedDays(prev => isSelected ? prev.filter(x=>x!==d.id) : [...prev, d.id].sort());
                        }}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all border ${
                          isSelected 
                            ? "bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20 scale-105" 
                            : `${isDark ? "bg-white/5 border-white/10 text-white/60 hover:bg-white/10" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200"}`
                        }`}
                      >
                        <span className="text-[11px]">{(t.daysShort as any)[d.shortKey]}</span>
                        <span className="text-[8px] opacity-70 hidden md:block">{(t.days as any)[d.key]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 mt-3">
                  <button onClick={() => setSelectedDays([0,1,2,3,4,5,6])} className={`flex-1 h-8 rounded-full text-[10px] font-bold ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-zinc-200 hover:bg-zinc-300"} transition`}>{t.everyday}</button>
                  <button onClick={() => setSelectedDays([1,2,3,4,5])} className={`flex-1 h-8 rounded-full text-[10px] font-bold ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-zinc-200 hover:bg-zinc-300"} transition`}>{t.weekdays}</button>
                  <button onClick={() => setSelectedDays([0,6])} className={`flex-1 h-8 rounded-full text-[10px] font-bold ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-zinc-200 hover:bg-zinc-300"} transition`}>{t.weekend}</button>
                </div>
              </div>

              {/* Duration Selection */}
              <div className={`${glassClass} rounded-2xl p-4 border`}>
                <label className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  {t.durationTitle}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"} ml-auto`}>
                    {durationDays === 'forever' ? t.forever : `${durationDays} ${typeof durationDays==='number' && durationDays===1 ? t.daysLabel : t.daysLabelPlural}`}
                  </span>
                </label>
                <p className={`text-[11px] ${textFaint} mb-3`}>{t.durationDesc}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'forever' as const, label: t.forever },
                    { value: 7 as const, label: t.days7 },
                    { value: 14 as const, label: t.days14 },
                    { value: 30 as const, label: t.days30 },
                  ].map((opt) => {
                    const isSelected = durationDays === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => setDurationDays(opt.value)}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-amber-400 to-orange-500 text-black border-amber-400 shadow-lg"
                            : `${isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200"}`
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {typeof durationDays === 'number' && (
                  <div className={`mt-3 p-2.5 rounded-xl ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"} border text-center`}>
                    <p className="text-[11px] font-medium">
                      {t.alarmWillWorkFor} <span className="font-bold">{durationDays}</span> {durationDays===1? t.daysLabel : t.daysLabelPlural}
                    </p>
                  </div>
                )}
              </div>

              {/* Persistent Alarm Info */}
              <div className={`p-3 rounded-2xl ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"} border`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">🔒</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      {t.alarmPersistentTitle}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white animate-pulse">{t.cannotClose}</span>
                    </p>
                    <p className={`text-[10px] ${textFaint} mt-1 leading-relaxed`}>{t.alarmPersistentDesc}</p>
                    <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1">⚠️ {t.notificationWillReturn}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1">🔒 {t.hardToCloseDesc}</p>
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"} border flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">👨</div>
                  <div>
                    <p className="text-xs font-bold">{t.maleVoiceImproved || t.maleVoice}</p>
                    <p className={`text-[10px] ${textFaint}`}>{t.maleVoiceImprovedDesc || t.maleVoiceDesc}</p>
                    <p className="text-[9px] text-blue-500 font-bold mt-0.5">v{appVersion} - {t.autoUpdate || "Auto Update"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">MALE</span>
                </div>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"} border flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">🔄</div>
                  <div>
                    <p className="text-xs font-bold">{t.autoUpdate || "تحديث تلقائي"}</p>
                    <p className={`text-[10px] ${textFaint}`}>{t.autoUpdateDesc || "التحديثات تصل لجميع المستخدمين تلقائياً"}</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleInstallApp}
                  disabled={installStep === "installing"}
                  className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                    isInstalled ? "bg-emerald-500 text-black" : "bg-gradient-to-br from-emerald-400 to-teal-600 text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02]"
                  } disabled:opacity-50`}
                >
                  {installStep === "installing" ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      {t.installing}
                    </>
                  ) : isInstalled ? (
                    <>
                      <Check className="w-5 h-5" />
                      {t.installedSuccess}
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      {t.installApp}
                    </>
                  )}
                </button>

                {!isInstalled && (
                  <p className={`text-[11px] ${textFaint} text-center mt-3 flex items-center justify-center gap-1.5`}>
                    <HardDrive className="w-3 h-3" />
                    {language === "ar" ? "سيظهر كتطبيق أصلي على الشاشة الرئيسية - يعمل بدون إنترنت" : "Will appear as native app on home screen - works offline"}
                  </p>
                )}

                {isInstalled && (
                  <div className={`mt-3 p-3 rounded-xl ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"} border flex items-center gap-2`}>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <p className={`text-xs ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>{language === "ar" ? `المنبه مثبت ويعمل! ابحث عن أيقونة "${t.appNameShort}"` : `Alarm installed! Find "${t.appNameShort}" icon`}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleSetAlarm} disabled={isAlarmActive} className={`h-12 rounded-2xl ${glassClass} font-bold text-sm disabled:opacity-50 hover:bg-white/10 transition flex items-center justify-center gap-2`}>
                  <AlarmClock className="w-4 h-4" />
                  {isAlarmActive ? (language === "ar" ? "مضبوط" : "Set") : t.setOnly}
                </button>
                <button
                  onClick={() => {
                    if (!userName) setUserName(language === "ar" ? "أحمد" : "Ahmed");
                    setTimeout(() => triggerAlarm({ demo: true }), 300);
                  }}
                  className={`h-12 rounded-2xl ${isDark ? "bg-white/10" : "bg-zinc-900 text-white"} font-bold text-sm hover:bg-white/15 transition flex items-center justify-center gap-2`}
                >
                  <Play className="w-4 h-4" />
                  {t.tryRing}
                </button>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-200"}`}>
                <PermissionsPanel t={t as unknown as Record<string, string>} dark={isDark} rtl={isRTL} compact />
              </div>

              {isAlarmActive && (
                <div className={`p-4 rounded-2xl ${isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" : "bg-emerald-50 border-emerald-200 text-emerald-700"} border flex items-center gap-3`}>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm">
                      {t.alarmSet} <span className="font-mono font-bold">{alarmTime}</span> - {t.willWake} {userName || (language === "ar" ? "أحمد" : "Ahmed")}
                    </p>
                    <p className="text-xs mt-1 opacity-90">⏱ {renderNextRing()}</p>
                    {isNativeApp && hatAlarmArmed && (
                      <p className="text-[11px] mt-1.5 font-bold">🔒 {t.clockBound}</p>
                    )}
                  </div>
                </div>
              )}

              {(alarmStage === "ringing" || alarmStage === "annoying" || alarmStage === "extreme") && (
                <div className={`p-5 rounded-2xl border transition-all ${alarmStage === "extreme" ? "bg-red-500/10 border-red-500/30 animate-shake-intense" : alarmStage === "annoying" ? "bg-amber-500/10 border-amber-500/30 animate-shake" : isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      {alarmStage === "ringing" && t.ringingNow}
                      {alarmStage === "annoying" && t.annoyingMode}
                      {alarmStage === "extreme" && t.nightmareMode}
                    </span>
                    <span className={`font-mono text-xs px-2 py-1 rounded-full ${isDark ? "bg-black/40" : "bg-zinc-900/10"}`}>{formatTimeSince(timeSinceRinging)}</span>
                  </div>
                  <div className={`w-full h-2 ${isDark ? "bg-black/40" : "bg-zinc-900/10"} rounded-full overflow-hidden mb-3`}>
                    <div className={`h-full transition-all duration-1000 ${alarmStage === "extreme" ? "bg-red-400" : alarmStage === "annoying" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (timeSinceRinging / (fastMode ? 30 : 600)) * 100)}%` }} />
                  </div>
                  <div className={`mb-3 p-2 rounded-xl ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"} border flex items-center gap-2`}>
                    <span className="text-[11px]">🔒</span>
                    <p className="text-[10px] font-bold text-red-600">{t.hardToCloseTitle}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white ml-auto animate-pulse">{t.cannotClose}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleWakeUp} className="h-11 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition shadow-lg">
                      {t.wokeUp}
                    </button>
                    <div className="relative">
                      <button 
                        onMouseDown={handleSnoozeHoldStart}
                        onMouseUp={handleSnoozeHoldEnd}
                        onTouchStart={handleSnoozeHoldStart}
                        onTouchEnd={handleSnoozeHoldEnd}
                        onMouseLeave={handleSnoozeHoldEnd}
                        disabled={snoozeCount >= 1}
                        className={`w-full h-11 rounded-xl font-medium text-sm transition relative overflow-hidden flex items-center justify-center ${
                          snoozeCount >= 1 
                            ? "bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed" 
                            : `${glassClass} hover:bg-white/10`
                        }`}
                      >
                        {snoozeCount >= 1 ? t.snoozeUsed : isHoldingSnooze ? `${Math.round(snoozeHoldProgress)}%` : `${t.snooze} ${fastMode ? `10 ${t.sec}` : `5 ${t.min}`}`}
                        {isHoldingSnooze && (
                          <div className="absolute bottom-0 left-0 h-1 bg-emerald-400 transition-all" style={{ width: `${snoozeHoldProgress}%` }} />
                        )}
                      </button>
                      {snoozeCount < 1 && !isHoldingSnooze && (
                        <p className="text-[9px] text-center mt-1 opacity-60">{t.holdToSnooze}</p>
                      )}
                    </div>
                  </div>
                  {snoozeCount >= 1 && (
                    <p className="text-[10px] text-red-400 font-bold mt-2 text-center animate-pulse">⚠️ {t.snoozeLimited} - {t.snoozeUsed}</p>
                  )}
                  <p className="text-[9px] text-center mt-2 opacity-50">🔒 {t.notificationWillReturn}</p>
                </div>
              )}
            </div>
          </div>

          {/* Phone Simulator */}
          <div className="flex justify-center">
            <div className={`relative w-[340px] h-[760px] bg-gradient-to-b from-zinc-800 to-black rounded-[3.2rem] p-[10px] shadow-[0_20px_80px_rgba(0,0,0,0.6)] transition-all duration-500 ${alarmStage === "extreme" ? "animate-shake-intense" : alarmStage === "annoying" ? "animate-shake" : ""}`}>
              <div className="w-full h-full bg-[#080f0e] rounded-[2.6rem] overflow-hidden relative border border-white/10 flex flex-col">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-30" />
                <div className="h-12 flex items-center justify-between px-7 pt-2 text-[13px] z-20 text-white">
                  <span className="font-mono">{currentTime.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${alarmStage !== "idle" && alarmStage !== "completed" ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                  </div>
                </div>
                <div className="flex-1 relative overflow-hidden">
                  {alarmStage === "idle" && (
                    <div className="absolute inset-0 p-5 flex flex-col">
                      <div className="text-center mt-2">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center mb-2">
                          <Moon className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h2 className="text-[15px] font-black text-white">{t.appName}</h2>
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[9px] text-emerald-100 leading-relaxed text-center flex items-center justify-center gap-1">
                            <Heart className="w-3 h-3 text-emerald-400 shrink-0" />
                            {t.duaSentence}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2.5">
                        <div className="glass rounded-2xl p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/50">{t.hello}</span>
                            <span className="text-xs font-bold text-white">{userName || (language === "ar" ? t.heroFajr : t.heroFajr)}</span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-xl font-mono font-bold text-white">{alarmTime}</span>
                            <span className="text-[10px] text-white/40">{t.nextAlarm}</span>
                          </div>
                          <div className={`mt-2 h-1 bg-white/10 rounded-full overflow-hidden ${isAlarmActive ? "opacity-100" : "opacity-50"}`}>
                            <div className={`h-full bg-emerald-400 transition-all ${isAlarmActive ? "w-full animate-pulse" : "w-0"}`} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: t.faucet, icon: <Droplets className="w-3.5 h-3.5" /> },
                            { label: t.prayerMat, icon: <div className="text-sm">🕌</div> },
                            { label: t.face, icon: <Eye className="w-3.5 h-3.5" /> },
                          ].map((item, i) => (
                            <div key={i} className="glass rounded-xl p-2 text-center">
                              <div className="w-6 h-6 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-1 text-white">{item.icon}</div>
                              <span className="text-[8px] text-white/60">{item.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="glass rounded-xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] text-white">{t.installStatus}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isInstalled ? "bg-emerald-500 text-black" : "bg-white/10 text-white/60"}`}>{isInstalled ? t.installedShort : t.notInstalled}</span>
                        </div>
                      </div>
                      <div className="mt-auto">
                        <button onClick={handleInstallApp} className={`w-full h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${isInstalled ? "bg-emerald-500 text-black" : "bg-white text-black shadow-lg"}`}>
                          {isInstalled ? `${t.installedShort} ${alarmTime}` : t.installOnPhone}
                        </button>
                        <p className="text-[8px] text-white/30 text-center mt-2 leading-relaxed px-2">{t.duaSentence}</p>
                      </div>
                    </div>
                  )}
                  {(alarmStage === "ringing" || alarmStage === "annoying" || alarmStage === "extreme") && (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center p-5 text-center transition-colors ${alarmStage === "extreme" ? "bg-red-950/40" : alarmStage === "annoying" ? "bg-amber-950/30" : "bg-emerald-950/20"}`}>
                      <div className="relative mb-5">
                        <div className={`absolute inset-0 rounded-full ${alarmStage === "extreme" ? "bg-red-500/20" : alarmStage === "annoying" ? "bg-amber-500/20" : "bg-emerald-500/20"} animate-ping`} />
                        <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 ${alarmStage === "extreme" ? "bg-red-500 border-red-400 text-white" : alarmStage === "annoying" ? "bg-amber-500 border-amber-400 text-black" : "bg-emerald-500 border-emerald-400 text-black"} shadow-2xl`}>
                          <BellRing className={`w-10 h-10 ${alarmStage !== "ringing" ? "animate-shake" : "animate-pulse"}`} />
                        </div>
                      </div>
                      <h2 className="text-lg font-black mb-1 text-white">
                        {alarmStage === "ringing" && `${t.wakeUpName} ${userName || (language === "ar" ? "أحمد" : "Ahmed")}!`}
                        {alarmStage === "annoying" && `${t.getUpNow} ${userName || (language === "ar" ? "أحمد" : "Ahmed")}!`}
                        {alarmStage === "extreme" && t.wakeNow}
                      </h2>
                      <p className="text-xs text-white/70 mb-1">
                        {alarmStage === "ringing" && t.fajrTime}
                        {alarmStage === "annoying" && t.annoyingBell}
                        {alarmStage === "extreme" && t.nightmare}
                      </p>
                      <p className="text-[10px] font-mono text-white/40 mb-5">
                        {t.ringingSince} {formatTimeSince(timeSinceRinging)}
                      </p>
                      <div className="flex items-center justify-center gap-1 mb-6 h-5">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full ${alarmStage === "extreme" ? "bg-red-400" : alarmStage === "annoying" ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{
                              height: `${20 + Math.random() * 60}%`,
                              animation: `pulse ${0.3 + Math.random() * 0.5}s ease-in-out infinite`,
                              animationDelay: `${i * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="w-full space-y-2">
                        <div className="p-1.5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center gap-1 mb-1">
                          <span className="text-[8px]">🔒</span>
                          <span className="text-[8px] font-bold text-red-300">{t.cannotClose}</span>
                        </div>
                        <button onClick={handleWakeUp} className="w-full h-11 rounded-full bg-white text-black font-black text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          {t.wokeUp}
                        </button>
                        <div className="relative">
                          <button 
                            onMouseDown={handleSnoozeHoldStart}
                            onMouseUp={handleSnoozeHoldEnd}
                            onTouchStart={handleSnoozeHoldStart}
                            onTouchEnd={handleSnoozeHoldEnd}
                            disabled={snoozeCount >= 1}
                            className={`w-full h-9 rounded-full font-medium text-xs active:scale-95 transition-transform relative overflow-hidden flex items-center justify-center ${snoozeCount>=1 ? "bg-red-500/20 text-red-300 border border-red-500/30" : "glass text-white/80"}`}
                          >
                            {snoozeCount>=1 ? t.snoozeUsed : isHoldingSnooze ? `${Math.round(snoozeHoldProgress)}%` : `${t.snooze} ${fastMode ? `10 ${t.sec}` : `5 ${t.min}`} 💤`}
                            {isHoldingSnooze && <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-400" style={{ width: `${snoozeHoldProgress}%` }} />}
                          </button>
                          {snoozeCount<1 && <p className="text-[7px] text-white/40 text-center mt-1">{t.holdToSnooze}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                  {alarmStage === "verification" && (
                    <div className="absolute inset-0 p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          {t.proveWake}
                        </h3>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">{currentVerificationIndex + 1} / 3</span>
                      </div>
                      {/* Sound continuing banner */}
                      <div className="mb-3 p-2 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-2 animate-pulse">
                        <Volume2 className="w-3.5 h-3.5 text-red-400" />
                        <p className="text-[9px] text-red-200 font-bold">{t.verificationSoundOn}</p>
                        <div className="ml-auto flex gap-0.5">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-0.5 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mb-3">
                        {verificationTasks.map((task, i) => (
                          <div key={task.id} className={`flex-1 h-1 rounded-full transition-all ${i < currentVerificationIndex ? "bg-emerald-400" : i === currentVerificationIndex ? "bg-white animate-pulse" : "bg-white/20"}`} />
                        ))}
                      </div>
                      <div className="flex-1">
                        <div className="glass rounded-[1.2rem] p-3 border border-white/10">
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shrink-0">
                              {verificationTasks[currentVerificationIndex]?.icon}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                                {verificationTasks[currentVerificationIndex]?.title}
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">🤖 {t.aiPowered}</span>
                              </h4>
                              <p className="text-[10px] text-white/60 mt-1 leading-relaxed">{verificationTasks[currentVerificationIndex]?.subtitle}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            {cameraPermissionError ? (
                              <div className="aspect-[4/3] rounded-xl bg-red-950/30 border-2 border-red-500/30 flex flex-col items-center justify-center gap-3 p-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                  <Camera className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-red-200">
                                    {cameraErrorCode === "busy" ? t.cameraBusy : cameraErrorCode === "missing" || cameraErrorCode === "unsupported" ? t.cameraMissing : t.cameraDenied}
                                  </p>
                                  <p className="text-[10px] text-white/50 mt-1">
                                    {cameraErrorCode === "busy" ? t.cameraBusyDesc : cameraErrorCode === "missing" || cameraErrorCode === "unsupported" ? t.cameraMissingDesc : t.cameraDeniedDesc}
                                  </p>
                                  {(cameraErrorCode === "denied" || cameraErrorCode === "") && (
                                    <p className="text-[9px] text-amber-300/80 mt-1.5 leading-relaxed">{t.cameraDeniedHint}</p>
                                  )}
                                </div>
                                <button onClick={() => openCamera(verificationTasks[currentVerificationIndex]?.id)} className="px-4 py-2 rounded-full bg-red-500 text-white font-bold text-[11px] flex items-center gap-1.5">
                                  <Camera className="w-3.5 h-3.5" />
                                  {cameraErrorCode === "denied" || cameraErrorCode === "" ? t.allowCamera : t.cameraRetry}
                                </button>
                              </div>
                            ) : !isCameraOpen && !capturedImage ? (
                              <div className="aspect-[4/3] rounded-xl bg-black/50 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 p-4">
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                  <Camera className="w-5 h-5 text-white/40" />
                                </div>
                                <p className="text-[10px] text-white/40 text-center">
                                  {language === "ar" ? "صور" : "Photograph"} {verificationTasks[currentVerificationIndex]?.title}
                                </p>
                                <p className="text-[8px] text-emerald-400/60 text-center px-2">
                                  {verificationTasks[currentVerificationIndex]?.id === "water" && t.aimWater}
                                  {verificationTasks[currentVerificationIndex]?.id === "prayer" && t.aimPrayer}
                                  {verificationTasks[currentVerificationIndex]?.id === "face" && t.aimFace}
                                </p>
                                <button onClick={() => openCamera(verificationTasks[currentVerificationIndex]?.id)} className="mt-1 px-4 py-2 rounded-full bg-white text-black font-bold text-[11px] flex items-center gap-1.5 hover:bg-white/90 transition">
                                  <Camera className="w-3.5 h-3.5" />
                                  {t.tapToOpenCamera}
                                </button>
                                <label className="text-[9px] text-emerald-400 underline cursor-pointer mt-1">
                                  {t.uploadFromGallery}
                                  <input id={`file-input-${verificationTasks[currentVerificationIndex]?.id}`} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                </label>
                              </div>
                            ) : isCameraOpen && !capturedImage ? (
                              <div className="space-y-2">
                                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black relative">
                                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: verificationTasks[currentVerificationIndex]?.id === "face" ? "scaleX(-1)" : "none" }} />
                                  {/* AI scanning overlay */}
                                  <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute inset-0 border-2 border-emerald-400/50 rounded-xl" />
                                    <div className="absolute top-2 left-2 text-[8px] px-2 py-1 rounded-full bg-black/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                      {verificationTasks[currentVerificationIndex]?.id === "water" && t.aiCheckingWater}
                                      {verificationTasks[currentVerificationIndex]?.id === "prayer" && t.aiCheckingPrayer}
                                      {verificationTasks[currentVerificationIndex]?.id === "face" && t.aiCheckingFace}
                                    </div>
                                    {/* Crosshair */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/30 rounded-lg">
                                      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl-lg" />
                                      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr-lg" />
                                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl-lg" />
                                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white rounded-br-lg" />
                                    </div>
                                  </div>
                                  {/* Sound indicator */}
                                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/80 text-white text-[8px] font-bold">
                                      <Volume2 className="w-3 h-3 animate-pulse" />
                                      {language === "ar" ? "الصوت مستمر 🔊" : "Sound ON 🔊"}
                                    </div>
                                    <div className="flex gap-0.5">
                                      {[...Array(4)].map((_, i) => (
                                        <div key={i} className="w-0.5 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button onClick={capturePhoto} className="h-10 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-lg hover:bg-white/90 transition">
                                    <div className="w-4 h-4 rounded-full border-2 border-black flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                                    </div>
                                    {t.capture}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                                      setIsCameraOpen(false);
                                      setCameraStreamActive(false);
                                    }}
                                    className="h-10 rounded-full glass font-medium text-[11px] text-white border border-white/20"
                                  >
                                    {t.cancel}
                                  </button>
                                </div>
                              </div>
                            ) : capturedImage ? (
                              <div className="space-y-2">
                                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black relative">
                                  <img src={capturedImage} alt="captured" className="w-full h-full object-cover" />
                                  {aiAnalyzing && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                                      <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                      <p className="text-xs text-emerald-300 font-bold animate-pulse">{t.aiAnalyzing}</p>
                                      <div className="flex gap-1">
                                        {[...Array(3)].map((_, i) => (
                                          <div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {aiResult && (
                                    <div className={`absolute bottom-0 left-0 right-0 p-2 ${aiResult.valid ? "bg-emerald-500/90" : "bg-red-500/90"} backdrop-blur`}>
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-white flex items-center gap-1">
                                          {aiResult.valid ? "✓" : "✗"} {aiResult.message}
                                        </p>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/20 text-white">
                                          {t.aiConfidence}: {aiResult.confidence}%
                                        </span>
                                      </div>
                                      {!aiResult.valid && (
                                        <div className="mt-1 w-full h-1 bg-black/20 rounded-full overflow-hidden">
                                          <div className="h-full bg-white rounded-full" style={{ width: `${aiResult.confidence}%` }} />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button 
                                    onClick={() => {
                                      if (aiResult && !aiResult.valid) {
                                        // تأكيد يدوي فقط عند ثقة ≥30 أو بعد محاولتين، وإلا إعادة تحليل
                                        if (aiResult.confidence >= 30 || verificationAttempts >= 2) {
                                          confirmCapture(true);
                                        } else {
                                          // Retry analysis
                                          setAiResult(null);
                                          confirmCapture(false);
                                        }
                                      } else {
                                        confirmCapture(false);
                                      }
                                    }} 
                                    disabled={aiAnalyzing}
                                    className={`h-10 rounded-full font-bold text-[11px] flex items-center justify-center gap-1 transition ${aiAnalyzing ? "bg-white/20 text-white/50" : aiResult && !aiResult.valid ? (aiResult.confidence >= 30 || verificationAttempts >= 2 ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-amber-500 text-black") : "bg-emerald-500 text-black hover:bg-emerald-400"}`}
                                  >
                                    {aiAnalyzing ? (
                                      <>
                                        <div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                                        {t.aiAnalyzing}
                                      </>
                                    ) : aiResult && !aiResult.valid ? (
                                      aiResult.confidence >= 30 || verificationAttempts >= 2 ? (
                                        <>
                                          <Check className="w-3 h-3" />
                                          {language === "ar" ? "تأكيد على أي حال ✓" : "Confirm anyway ✓"}
                                        </>
                                      ) : (
                                        <>
                                          <RotateCcw className="w-3 h-3" />
                                          {language === "ar" ? "حاول مرة أخرى" : "Try again"}
                                        </>
                                      )
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3" />
                                        {t.confirm} 🤖
                                      </>
                                    )}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setCapturedImage(null);
                                      setAiResult(null);
                                      setAiAnalyzing(false);
                                    }} 
                                    disabled={aiAnalyzing}
                                    className="h-10 rounded-full glass font-medium text-[11px] flex items-center justify-center gap-1 text-white border border-white/20 disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    {t.retake}
                                  </button>
                                </div>
                                {aiResult && !aiResult.valid && aiResult.checks.length > 0 && (
                                  <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                                    <div className="grid grid-cols-2 gap-1">
                                      {aiResult.checks.map((c) => (
                                        <div key={c.id} className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[8px] font-bold ${c.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${c.passed ? "bg-emerald-500 text-black" : "bg-red-500 text-white"}`}>
                                            {c.passed ? "✓" : "✕"}
                                          </span>
                                          {tr("cl_" + c.id)}
                                        </div>
                                      ))}
                                    </div>
                                    {aiResult.tips.length > 0 && (
                                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        {aiResult.tips.map((tip) => (
                                          <p key={tip} className="text-[9px] text-amber-200 leading-relaxed">💡 {tr(tip)}</p>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-[8px] text-white/50 text-center">
                                      {t.aiConfidence}: {aiResult.confidence}% • {tr("attemptsLabel")}: {verificationAttempts}
                                      {(aiResult.confidence >= 30 || verificationAttempts >= 2) && ` • ${tr("canConfirmAnyway")}`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {verificationTasks.slice(0, currentVerificationIndex).map((task) => (
                            <div key={task.id} className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-black" />
                              </div>
                              <span className="text-[10px] font-medium text-white">{task.title} ✓ 🤖</span>
                              <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{t.done}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {alarmStage === "completed" && (
                    <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center bg-gradient-to-b from-emerald-950/50 to-[#080f0e]">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                        <Check className="w-7 h-7 text-black" />
                      </div>
                      <h2 className="text-[15px] font-black mb-1 text-white">
                        {t.mayAllahAccept} {userName || (language === "ar" ? "بطل الفجر" : "Fajr Hero")}! 🎉
                      </h2>
                      <p className="text-[11px] text-white/60 leading-relaxed mb-4">{t.wellDone}</p>
                      <p className="text-[9px] text-emerald-200/60 mb-4 px-2">{t.duaSentence}</p>
                      <div className="w-full grid grid-cols-3 gap-1.5 mb-4">
                        {verificationTasks.map((task) => (
                          <div key={task.id} className="glass rounded-xl p-1.5">
                            {task.image ? <img src={task.image} alt="" className="w-full aspect-square rounded-lg object-cover mb-1" /> : <div className="w-full aspect-square rounded-lg bg-white/5 mb-1" />}
                            <p className="text-[8px] font-medium truncate text-white">{task.title}</p>
                            <p className="text-[7px] text-emerald-400">{t.done}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={resetAlarm} className="w-full h-9 rounded-full bg-white text-black font-bold text-[11px]">
                        {t.newAlarm}
                      </button>
                    </div>
                  )}
                </div>
                <div className="h-7 flex items-center justify-center">
                  <div className="w-28 h-1 bg-white rounded-full" />
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Explanation */}
      <section className={`relative z-10 border-y ${borderColor} ${bgSecondary}`}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-black mb-4">{t.neverStops}</h2>
            <p className={textMuted}>{t.neverStopsDesc}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: <Droplets className="w-8 h-8" />,
                title: t.waterStepTitle,
                desc: t.waterStepDesc,
                color: "from-blue-400 to-cyan-400",
                step: t.step1,
              },
              {
                icon: <span className="text-3xl">🕌</span>,
                title: t.prayerStepTitle,
                desc: t.prayerStepDesc,
                color: "from-emerald-400 to-teal-400",
                step: t.step2,
              },
              {
                icon: <Eye className="w-8 h-8" />,
                title: t.faceStepTitle,
                desc: t.faceStepDesc,
                color: "from-amber-400 to-orange-400",
                step: t.step3,
              },
            ].map((item, i) => (
              <div key={i} className="group relative">
                <div className="absolute -inset-px bg-gradient-to-br from-white/10 to-transparent rounded-[1.8rem] opacity-0 group-hover:opacity-100 transition" />
                <div className={`relative ${glassClass} rounded-[1.8rem] p-7 h-full border ${isDark ? "border-white/10" : "border-zinc-900/5"} group-hover:border-white/15 transition`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-black shadow-lg`}>{item.icon}</div>
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${isDark ? "bg-white/5 border-white/10" : "bg-zinc-900/5 border-zinc-900/10"} border tracking-widest`}>{item.step}</span>
                  </div>
                  <h3 className="font-bold text-[16px] mb-3">{item.title}</h3>
                  <p className={`text-[13px] leading-relaxed ${textMuted}`}>{item.desc}</p>
                  <div className="mt-5 flex items-center gap-2 text-[11px] text-emerald-500">
                    <Camera className="w-3.5 h-3.5" />
                    {t.directOnly}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className={`relative rounded-[2.5rem] overflow-hidden border ${isDark ? "border-white/10 bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-[#0a1210]" : "border-zinc-900/5 bg-gradient-to-br from-emerald-50 via-teal-50 to-white"} p-8 md:p-12`}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"} 1px, transparent 0)`, backgroundSize: "40px 40px" }} />
          </div>
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div className={isRTL ? "text-right" : "text-left"}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${isDark ? "bg-white/10 border-white/10" : "bg-zinc-900/5 border-zinc-900/10"} border text-xs mb-6`}>
                <Smartphone className="w-3.5 h-3.5" />
                {isInstalled ? `${t.installedShort}` : language === "ar" ? "جاهز للتثبيت كتطبيق أصلي" : "Ready to install as native app"}
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">
                {isInstalled ? t.downloadSectionInstalledTitle : t.downloadSectionTitle}
                <br />
                <span className={isDark ? "text-white/60" : "text-zinc-500"}>{isInstalled ? t.downloadSectionInstalledSub : t.downloadSectionSub}</span>
              </h2>
              <p className={`${textMuted} leading-relaxed mb-8 max-w-[480px]`}>{isInstalled ? `${t.downloadSectionInstalledDesc} ${t.duaSentence}` : t.downloadSectionDesc}</p>

              <div className="flex flex-col sm:flex-row gap-3">
                {isInstalled ? (
                  <div className="flex items-center gap-3 px-6 py-4 rounded-full bg-emerald-500 text-black font-bold shadow-xl">
                    <Check className="w-5 h-5" />
                    {t.installedBtn}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 ml-2">{alarmTime}</span>
                  </div>
                ) : (
                  <button onClick={handleInstallApp} className="group flex items-center justify-center gap-3 px-7 py-4 rounded-full bg-white text-black font-bold shadow-xl hover:bg-white/90 transition border border-zinc-200">
                    <Download className="w-5 h-5" />
                    {t.installNowBtn}
                    <ArrowDown className="w-4 h-4 animate-bounce" />
                  </button>
                )}
                <button onClick={() => setShowDownloadModal(true)} className={`flex items-center justify-center gap-2 px-7 py-4 rounded-full ${glassClass} font-semibold hover:bg-white/10 transition`}>
                  <MoreVertical className="w-5 h-5" />
                  {isInstalled ? t.manageAlarm : t.installOptions}
                </button>
              </div>

              {/* فتح التطبيق المثبت من الموقع - أو تحميل APK إن لم يكن مثبتاً */}
              {!isNativeApp && isAndroidDevice() && (
                <button
                  onClick={() => openNativeAppOr(() => void handleDownloadAPK())}
                  className={`mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full ${glassClass} font-semibold text-sm hover:bg-white/10 transition`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  {t.openAppBtn}
                </button>
              )}

              <div className="mt-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-2">
                <Heart className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-200 leading-relaxed">{t.duaSentence}</p>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                {[
                  { icon: <HardDrive className="w-4 h-4" />, title: t.lightOnly, desc: t.veryLight },
                  { icon: <WifiOff className="w-4 h-4" />, title: t.offline, desc: t.worksOffline },
                  { icon: <Bell className="w-4 h-4" />, title: t.evenClosed, desc: t.alwaysNotify },
                ].map((f, i) => (
                  <div key={i} className={`${glassClass} rounded-xl p-3 text-center`}>
                    <div className="w-8 h-8 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-1.5 text-emerald-500">{f.icon}</div>
                    <p className="text-xs font-bold">{f.title}</p>
                    <p className={`text-[10px] ${textFaint}`}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <div className="w-[200px] h-[200px] rounded-[1.5rem] bg-white p-4 shadow-2xl border border-zinc-200">
                  <div className="w-full h-full rounded-xl bg-black flex items-center justify-center relative overflow-hidden">
                    <div className="w-full h-full p-2 bg-white flex items-center justify-center">
                      {typeof window !== "undefined" && (
                        <QRCode
                          value={window.location.href.split("?")[0]}
                          size={168}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className={`absolute -bottom-3 -right-3 ${glassDarkClass} rounded-full px-3 py-1.5 flex items-center gap-2 shadow-xl border`}>
                  <div className={`w-2 h-2 rounded-full ${isInstalled ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                  <span className="text-[11px] font-bold">{isInstalled ? (language === "ar" ? "مثبت ✓" : "Installed ✓") : t.scanToDownload}</span>
                </div>
                {isInstalled && (
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg animate-pulse">
                    <Check className="w-5 h-5 text-black" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 border-t ${borderColor} py-10`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">
                {t.appName} {isInstalled && `✓ ${language === "ar" ? "مثبت" : "Installed"}`}
              </p>
              <p className={`text-[11px] ${textFaint} flex items-center gap-1`}>
                <Heart className="w-3 h-3 text-red-400" />
                {t.duaSentence}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-6 text-xs ${textFaint}`}>
            <span>{t.footerRights}</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {isInstalled ? t.footerInstalled : t.footerPhones}
            </span>
          </div>
        </div>
      </footer>

      {/* Download & Install Modal */}
      {/* Permissions wizard - المستخدم يمنح الموافقات قبل تفعيل المنبه */}
      {showPermWizard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className={`relative w-full max-w-md ${isDark ? "glass-dark" : "bg-white border border-zinc-200 shadow-2xl"} rounded-[2rem] p-7 max-h-[90vh] overflow-y-auto`}>
            <button onClick={() => setShowPermWizard(false)} className={`absolute top-5 ${isRTL ? "left-5" : "right-5"} w-8 h-8 rounded-full ${isDark ? "bg-white/10" : "bg-zinc-100"} flex items-center justify-center hover:bg-white/20 transition`}>
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t.permWizardTitle}</h3>
              <p className={`text-sm ${textMuted} leading-relaxed`}>{t.permWizardDesc}</p>
            </div>
            <PermissionsPanel t={t as unknown as Record<string, string>} dark={isDark} rtl={isRTL} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => setShowPermWizard(false)}
                className={`h-12 rounded-full ${glassClass} font-semibold text-sm hover:bg-white/10 transition`}
              >
                {t.permWizardLater}
              </button>
              <button
                disabled={permChecking}
                onClick={async () => {
                  setPermChecking(true);
                  try {
                    const crit = await checkCritical();
                    if (crit.ok) {
                      setShowPermWizard(false);
                      await handleSetAlarm();
                    }
                  } finally {
                    setPermChecking(false);
                  }
                }}
                className="h-12 rounded-full bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {permChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t.permWizardActivate}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className={`relative w-full max-w-md ${isDark ? "glass-dark" : "bg-white border border-zinc-200 shadow-2xl"} rounded-[2rem] p-7 max-h-[90vh] overflow-y-auto`}>
            <button onClick={() => setShowDownloadModal(false)} className={`absolute top-5 ${isRTL ? "left-5" : "right-5"} w-8 h-8 rounded-full ${isDark ? "bg-white/10" : "bg-zinc-100"} flex items-center justify-center hover:bg-white/20 transition`}>
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              {apkDownloading || apkDownloaded || apkError ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
                    {apkDownloaded ? <Check className="w-8 h-8 text-black" /> : apkError ? <X className="w-8 h-8 text-black" /> : <div className="w-8 h-8 border-[3px] border-black/30 border-t-black rounded-full animate-spin" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{apkDownloaded ? t.apkDownloadedTitle : apkError ? t.apkError : t.apkDownloading}</h3>
                  {apkDownloading && !apkDownloaded && !apkError && (
                    <div className="space-y-3 mt-4">
                      <div className={`w-full h-3 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded-full overflow-hidden`}>
                        <div className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 rounded-full transition-all duration-300" style={{ width: `${apkProgress}%` }} />
                      </div>
                      <p className="text-sm font-bold text-emerald-500">{apkProgress}%</p>
                      {apkInfo?.available && (
                        <p className={`text-[11px] ${textFaint}`}>
                          {t.apkVersion}: {apkInfo.version} • {t.apkSize}: {apkInfo.sizeLabel}
                        </p>
                      )}
                    </div>
                  )}
                  {apkDownloaded && (
                    <div className="mt-4 space-y-3">
                      <p className={`text-sm ${textMuted} leading-relaxed`}>{t.apkDownloadedDesc}</p>
                      <div className={`${glassClass} rounded-2xl p-4 space-y-3 ${isRTL ? "text-right" : "text-left"}`}>
                        {[
                          { n: "1", title: t.apkStep1Title, desc: t.apkStep1Desc },
                          { n: "2", title: t.apkStep2Title, desc: t.apkStep2Desc },
                          { n: "3", title: t.apkStep3Title, desc: t.apkStep3Desc },
                        ].map((s) => (
                          <div key={s.n} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-black text-xs flex items-center justify-center shrink-0">{s.n}</div>
                            <div>
                              <p className="text-xs font-bold">{s.title}</p>
                              <p className={`text-[11px] ${textFaint}`}>{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setApkDownloaded(false);
                          setApkProgress(0);
                          setShowDownloadModal(false);
                        }}
                        className="w-full h-12 rounded-full bg-white text-black font-bold border border-zinc-200"
                      >
                        {t.excellentOpen}
                      </button>
                    </div>
                  )}
                  {apkError && !apkDownloading && (
                    <div className="mt-4 space-y-3">
                      {(!apkInfo || !apkInfo.available) && <p className={`text-[11px] ${textFaint}`}>{t.apkPreparing}</p>}
                      <button onClick={() => void handleDownloadAPK()} className="w-full h-12 rounded-full bg-emerald-500 text-black font-bold">
                        {t.apkRetry}
                      </button>
                      <a
                        href={apkInfo?.releaseUrl || APK_RELEASE_URL}
                        className={`w-full h-12 rounded-full ${glassClass} font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition`}
                      >
                        <Download className="w-4 h-4" />
                        {t.apkReleaseLink}
                      </a>
                      <button
                        onClick={() => {
                          setApkError(null);
                          setApkDownloaded(false);
                          setApkProgress(0);
                        }}
                        className="text-xs underline opacity-60"
                      >
                        {t.installOptions}
                      </button>
                    </div>
                  )}
                </>
              ) : installStep === "success" ? (
                <>
                  <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30 animate-pulse">
                    <Check className="w-10 h-10 text-black" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t.successTitle}</h3>
                  <p className={`text-sm ${textMuted} mb-6 leading-relaxed`}>
                    {t.successDesc1}
                    <br />
                    <span className="text-emerald-600 font-bold">
                      {t.successDesc2} {alarmTime} {language === "ar" ? `يا ${userName || "بطل الفجر"}` : userName || "Fajr Hero"}
                    </span>
                  </p>
                  <div className={`${glassClass} rounded-2xl p-4 text-right space-y-3 mb-4`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-xs font-bold">{t.findIcon}</p>
                        <p className={`text-[11px] ${textFaint}`}>{t.onHomeScreen}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <WifiOff className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-xs font-bold">{t.worksWithoutNet}</p>
                        <p className={`text-[11px] ${textFaint}`}>{t.alarmWorksOffline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Bell className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-xs font-bold">{t.notifyEvenClosed}</p>
                        <p className={`text-[11px] ${textFaint}`}>{t.notifyDesc}</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-2">
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-200 leading-relaxed text-center flex items-center justify-center gap-1">
                        <Heart className="w-3 h-3" />
                        {t.duaSentence}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowDownloadModal(false)} className="w-full h-12 rounded-full bg-white text-black font-bold border border-zinc-200">
                    {t.excellentOpen}
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
                    {installStep === "installing" ? <div className="w-8 h-8 border-3 border-black/30 border-t-black rounded-full animate-spin" /> : <Download className="w-8 h-8 text-black" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{installStep === "installing" ? t.installingTitle : t.downloadModalTitle}</h3>
                  <p className={`text-sm ${textMuted} mb-2`}>{installStep === "installing" ? t.installingDesc : `${t.downloadModalDesc} ${alarmTime}`}</p>
                  <p className="text-[11px] text-emerald-600 mb-6 flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" />
                    {t.duaSentence}
                  </p>

                  {installStep === "idle" && (
                    <div className="space-y-3">
                      {!isNativeApp && isAndroidDevice() && (
                        <button
                          onClick={() => openNativeAppOr(() => void handleDownloadAPK())}
                          className={`w-full h-12 rounded-2xl ${isDark ? "bg-white/10 hover:bg-white/15 border border-white/15" : "bg-zinc-100 hover:bg-zinc-200 border border-zinc-200"} font-bold text-sm flex items-center justify-center gap-2 transition`}
                        >
                          <Smartphone className="w-4 h-4 text-emerald-500" />
                          {t.openAppBtn}
                        </button>
                      )}
                      {isNativeApp ? (
                        <div className={`w-full p-4 rounded-2xl ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"} border text-center`}>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                            <p className="text-xs font-bold">{t.nativeRunningTitle}</p>
                          </div>
                          <p className="text-[10px] opacity-70 leading-relaxed">{t.nativeRunningDesc}</p>
                        </div>
                      ) : !isIosDevice() ? (
                        <>
                          <button onClick={() => void handleDownloadAPK()} className="w-full rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-bold p-4 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition shadow-lg">
                            <div className="flex items-center justify-center gap-2">
                              <Download className="w-5 h-5" />
                              {t.apkOptionTitle}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/15">APK</span>
                            </div>
                            <p className="text-[11px] font-semibold opacity-80 mt-1">{t.apkOptionDesc}</p>
                            <p className="text-[10px] opacity-70 mt-1">
                              {apkInfo?.available ? `${t.apkVersion}: ${apkInfo.version} • ${t.apkSize}: ${apkInfo.sizeLabel}` : t.apkBuildStatus}
                            </p>
                          </button>
                          <div className="flex items-center gap-3 opacity-60">
                            <div className={`flex-1 h-px ${isDark ? "bg-white/15" : "bg-zinc-300"}`} />
                            <span className="text-[11px]">{t.orDivider}</span>
                            <div className={`flex-1 h-px ${isDark ? "bg-white/15" : "bg-zinc-300"}`} />
                          </div>
                        </>
                      ) : null}

                      {!isNativeApp && (
                        <>
                          <button onClick={handleInstallApp} className={`w-full h-14 rounded-2xl ${isDark ? "bg-white/10 hover:bg-white/15 border border-white/15" : "bg-zinc-100 hover:bg-zinc-200 border border-zinc-200"} font-bold flex items-center justify-center gap-3 transition shadow`}>
                            <Smartphone className="w-5 h-5" />
                            {t.pwaOptionTitle}
                          </button>
                          <p className={`text-[10px] ${textFaint} -mt-1`}>{t.pwaOptionDesc}</p>
                        </>
                      )}

                      <div className="pt-2">
                        <p className={`text-[11px] ${textFaint} mb-3`}>{t.manualMethod}</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className={`${glassClass} rounded-xl p-3 ${isRTL ? "text-right" : "text-left"}`}>
                            <p className="font-bold flex items-center gap-1">
                              <span>🤖</span> {t.android}
                            </p>
                            <p className={`${textFaint} mt-1 leading-relaxed`}>{t.androidDesc}</p>
                          </div>
                          <div className={`${glassClass} rounded-xl p-3 ${isRTL ? "text-right" : "text-left"}`}>
                            <p className="font-bold flex items-center gap-1">
                              <span>🍎</span> {t.iphone}
                            </p>
                            <p className={`${textFaint} mt-1 leading-relaxed`}>{t.iphoneDesc}</p>
                          </div>
                        </div>
                      </div>

                      <div className={`pt-3 flex items-center justify-center gap-2 text-[11px] ${textFaint}`}>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {t.safe}
                      </div>
                    </div>
                  )}

                  {installStep === "installing" && (
                    <div className="space-y-4">
                      <div className={`w-full h-2 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded-full overflow-hidden`}>
                        <div className="h-full bg-emerald-400 rounded-full animate-pulse" style={{ width: "70%" }} />
                      </div>
                      <div className={`${glassClass} rounded-xl p-3 ${isRTL ? "text-right" : "text-left"}`}>
                        <p className="text-xs font-bold flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          {t.installingProgress}
                        </p>
                        <p className={`text-[11px] ${textFaint} mt-2`}>{t.willAppearSoon}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap");
        * {
          font-family: "Cairo", sans-serif;
        }
      `}</style>
    </div>
  );
}
