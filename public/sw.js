// HatSally - هتصلي يعني هتصلي - Service Worker v9: Multi-Alarm Daily Repeat
// المميزات: منبهات متعددة، كل منبه يرن في نفس موعده كل يوم، إشعار دائم لا يُحذف،
//          تحديث تلقائي، عمل بدون إنترنت، نماذج كشف الوجه مخزّنة محلياً.
const CACHE_NAME = "hatsally-v9-multi-alarm";
const APP_VERSION = "6.0.0-multi-alarm";
const PRECACHE_URLS = [
  "/",
  "/icons/icon-192.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512.png",
  "/icons/icon-512x512.png",
  "/manifest.webmanifest",
  // نماذج كشف الوجه - تعمل بدون إنترنت بعد أول تحميل
  "/models/tiny_face_detector_model-weights_manifest.json",
  "/models/tiny_face_detector_model.bin",
  "/models/face_landmark_68_tiny_model-weights_manifest.json",
  "/models/face_landmark_68_tiny_model.bin"
];

const DB_NAME = "hatSallyDB";
const DB_VERSION = 1;
const STORE_ALARMS = "alarms";
/** سجل خاص يحفظ حالة المنبه الذي يرن الآن (لإعادة الإشعار عند حذفه) */
const RINGING_ID = "__ringing__";
/** مهلة اللحاق بالموعد بالدقائق - مطابقة لـ lib/schedule.ts */
const RING_GRACE_MINUTES = 45;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

console.log(`[SW ${APP_VERSION}] Loading... (multi-alarm daily repeat)`);

// ------------------------------------------------------------------
// IndexedDB helpers
// ------------------------------------------------------------------
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ALARMS)) {
        const store = db.createObjectStore(STORE_ALARMS, { keyPath: "id" });
        store.createIndex("time", "time", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALARMS, mode);
      const store = tx.objectStore(STORE_ALARMS);
      const result = fn(store, resolve, reject);
      tx.oncomplete = () => resolve(result === undefined ? true : result);
      tx.onerror = () => reject(tx.error);
    });
  });
}

/** حذف كل سجلات المنبهات (عدا سجل حالة الرنين) */
function deleteAlarmsRecords() {
  return txStore("readwrite", (store) => {
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value && cursor.value.id !== RINGING_ID) cursor.delete();
        cursor.continue();
      }
    };
  });
}

/** كتابة قائمة المنبهات كاملة (تحل محل ما قبلها) */
function saveAlarmsToDB(alarms, name) {
  const list = Array.isArray(alarms) ? alarms : [];
  // معاملتان منفصلتان: الحذف أولاً ثم الكتابة (حتى لا يحذف المؤشر السجلات الجديدة)
  return deleteAlarmsRecords()
    .then(() =>
      txStore("readwrite", (store) => {
        list.forEach((a, i) => {
          const duration = a.duration !== undefined && a.duration !== null ? a.duration : a.durationDays;
          store.put({
            id: String(a.id || `alarm-${i}`),
            label: a.label || "",
            time: a.time || "05:00",
            name: a.name || name || "",
            days: Array.isArray(a.days) && a.days.length ? a.days : ALL_DAYS,
            duration: duration === undefined || duration === null ? "forever" : duration,
            startDate: a.startDate || null,
            active: a.enabled !== false && a.active !== false,
            lastFiredKey: a.lastFiredKey || null,
            updatedAt: new Date().toISOString(),
            version: APP_VERSION
          });
        });
      })
    )
    .then(() => {
      console.log(`[SW ${APP_VERSION}] Saved ${list.length} alarms to DB (daily repeat)`);
      return list.length;
    });
}

function getAllAlarmsFromDB() {
  return txStore("readonly", (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).filter((r) => r && r.id !== RINGING_ID));
  }).then((v) => (Array.isArray(v) ? v : []));
}

function putRecord(record) {
  return txStore("readwrite", (store) => {
    store.put(record);
  });
}

function getRecord(id) {
  return txStore("readonly", (store, resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
  });
}

function clearAlarmsFromDB() {
  return txStore("readwrite", (store) => {
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

function setRingingState(state) {
  return putRecord(Object.assign({ id: RINGING_ID, updatedAt: new Date().toISOString() }, state || {}));
}

function getRingingState() {
  return getRecord(RINGING_ID);
}

// ------------------------------------------------------------------
// Persistent notification options
// ------------------------------------------------------------------
function getPersistentNotificationOptions(name, stage, lang, extra) {
  const isAr = lang === "ar" || !lang;
  const label = (extra && extra.label) ? ` - ${extra.label}` : "";
  const time = (extra && extra.time) ? ` (${extra.time})` : "";
  let title = "";
  let body = "";
  let vibrate = [1000, 500, 1000, 500, 2000];

  if (stage === "ringing") {
    title = isAr ? `🚨 استيقظ يا ${name}!${label}` : `🚨 Wake up ${name}!${label}`;
    body = isAr
      ? `المنبه${time} يرن الآن يا ${name}! قم للصلاة - لن يتوقف إلا بالتصوير 🔒`
      : `Alarm${time} is ringing ${name}! Get up for prayer - only photos stop it 🔒`;
  } else if (stage === "annoying") {
    title = isAr ? `🔔 قم حالاً يا ${name}!${label}` : `🔔 Get up now ${name}!${label}`;
    body = isAr ? `جرس مزعج! استيقظ يا ${name}! لا يمكن إغلاقه! 🔒` : `Annoying alarm! Wake up ${name}! Cannot close! 🔒`;
    vibrate = [500, 200, 500, 200, 1000, 200, 500];
  } else if (stage === "extreme") {
    title = isAr ? `🚨🚨 استيقظ الآن يا ${name}!!${label}` : `🚨🚨 Wake NOW ${name}!!${label}`;
    body = isAr
      ? `كابوس لا يحتمل! قم يا ${name}! صور الوضوء لإيقافه! 🔒 لا يمكن إغلاقه!`
      : `Unbearable nightmare! Get up ${name}! Photo verification only! 🔒 Cannot close!`;
    vibrate = [300, 100, 300, 100, 300, 100, 1000];
  } else if (stage === "verification") {
    title = isAr ? `📷 يا ${name} صور الآن!${label}` : `📷 ${name} photograph now!${label}`;
    body = isAr
      ? `الصوت مستمر! صور صنبور المياه والمصلاة ووجهك يا ${name}! 🔒`
      : `Sound continues! Photo tap, mat and face ${name}! 🔒`;
  }

  return {
    title,
    options: {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate,
      requireInteraction: true,
      tag: "hatsally-persistent-alarm",
      renotify: true,
      silent: false,
      data: Object.assign({ name, stage, persistent: true, timestamp: Date.now(), version: APP_VERSION }, extra || {}),
      actions: [
        { action: "wake", title: isAr ? "استيقظت ✓" : "I'm awake ✓" },
        { action: "open", title: isAr ? "افتح التطبيق 📲" : "Open App 📲" }
      ]
    }
  };
}

function showPersistentAlarm(name, stage, lang, extra) {
  const { title, options } = getPersistentNotificationOptions(name, stage, lang, extra);
  return self.registration.showNotification(title, options);
}

// ------------------------------------------------------------------
// محرك الرنين اليومي لكل المنبهات
// ------------------------------------------------------------------
function todayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isAlarmExpired(now, alarm) {
  const duration = alarm.duration !== undefined ? alarm.duration : alarm.durationDays;
  if (duration === "forever" || duration === undefined || duration === null) return false;
  if (!alarm.startDate) return false;
  const limit = typeof duration === "number" ? duration : parseInt(duration, 10);
  if (isNaN(limit)) return false;
  const diffDays = Math.floor((startOfDay(now).getTime() - startOfDay(new Date(alarm.startDate)).getTime()) / 86400000);
  return diffDays >= limit;
}

/**
 * الفحص الدوري: كل منبه مفعّل يرن في نفس موعده كل يوم (مرة واحدة في اليوم).
 * - لم يحن الوقت → لا شيء
 * - حان الوقت (أو فات ضمن 45 دقيقة) ولم يرنّ اليوم → رنين + تعليم اليوم
 * - فات أكثر من المهلة → يُعلَّم اليوم بصمت (لحاق بدون إزعاج متأخر)
 * - انتهت مدته → يُوقف
 */
function checkAndTriggerAlarm() {
  return getAllAlarmsFromDB().then((alarms) => {
    if (!alarms || alarms.length === 0) return;
    const now = new Date();
    const key = todayKey(now);
    const due = [];
    const writes = [];

    alarms.forEach((alarm) => {
      if (!alarm || !alarm.active) return;

      if (isAlarmExpired(now, alarm)) {
        writes.push(Object.assign({}, alarm, { active: false, updatedAt: now.toISOString() }));
        console.log(`[SW ${APP_VERSION}] Alarm ${alarm.id} expired - deactivated`);
        return;
      }

      const days = Array.isArray(alarm.days) && alarm.days.length ? alarm.days : ALL_DAYS;
      if (!days.includes(now.getDay())) return; // ليس يومه
      if (alarm.lastFiredKey === key) return;   // رنّ اليوم already

      const parts = String(alarm.time || "05:00").split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return;
      const scheduled = new Date(now);
      scheduled.setHours(h, m, 0, 0);
      if (now.getTime() < scheduled.getTime()) return; // لم يحن بعد

      const lateMin = (now.getTime() - scheduled.getTime()) / 60000;
      if (lateMin > RING_GRACE_MINUTES) {
        writes.push(Object.assign({}, alarm, { lastFiredKey: key }));
        return; // فات كثيراً: لا رنين متأخر مزعج
      }
      due.push({ alarm, scheduled });
    });

    const flushWrites = () =>
      writes.length === 0 ? Promise.resolve() : Promise.all(writes.map((w) => putRecord(w)));

    if (due.length === 0) return flushWrites();

    due.sort((a, b) => a.scheduled.getTime() - b.scheduled.getTime());
    const first = due[0].alarm;
    // كل المنبهات التي حان موعدها الآن تُعلَّم معاً (استيقاظ واحد يكفي عنها)
    due.forEach((d) => writes.push(Object.assign({}, d.alarm, { lastFiredKey: key })));

    console.log(`[SW ${APP_VERSION}] 🔔 Ringing alarm ${first.id} at ${first.time} for ${first.name} (daily repeat)`);

    return flushWrites()
      .then(() =>
        setRingingState({
          alarmId: first.id,
          name: first.name,
          label: first.label,
          time: first.time,
          stage: "ringing",
          lastTrigger: now.toISOString()
        })
      )
      .then(() => showPersistentAlarm(first.name || "بطل الفجر", "ringing", "ar", { alarmId: first.id, label: first.label, time: first.time }))
      .then(() =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "ALARM_TRIGGERED",
              alarmId: first.id,
              time: first.time,
              label: first.label,
              name: first.name,
              stage: "ringing",
              version: APP_VERSION
            });
          });
        })
      );
  }).catch((err) => console.error(`[SW ${APP_VERSION}] check error`, err));
}

let alarmCheckInterval = null;
function startPeriodicCheck() {
  if (alarmCheckInterval) clearInterval(alarmCheckInterval);
  alarmCheckInterval = setInterval(() => {
    checkAndTriggerAlarm();
  }, 30 * 1000);
  checkAndTriggerAlarm();
  console.log(`[SW ${APP_VERSION}] Periodic alarm check started every 30s`);
}

function notifyAllClientsAboutUpdate() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    console.log(`[SW ${APP_VERSION}] Notifying ${clients.length} clients about update`);
    clients.forEach((client) => {
      client.postMessage({
        type: "APP_UPDATED",
        version: APP_VERSION,
        message: "تم تحديث التطبيق تلقائياً - منبهات متعددة وكل منبه يرن كل يوم",
        messageEn: "App updated automatically - multiple alarms, each ringing daily",
        timestamp: Date.now()
      });
    });
  });
}

self.addEventListener("install", (event) => {
  console.log(`[SW ${APP_VERSION}] Installing - Auto update mode...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).then(() => {
        console.log(`[SW ${APP_VERSION}] Precached all assets`);
      }).catch((err) => {
        console.warn(`[SW ${APP_VERSION}] Precache failed, but continuing`, err);
        return cache.add("/").catch(() => Promise.resolve());
      });
    }).then(() => {
      startPeriodicCheck();
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log(`[SW ${APP_VERSION}] Activating - Auto update for all users...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW ${APP_VERSION}] Deleting old cache:`, cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      console.log(`[SW ${APP_VERSION}] Claiming clients for auto-update`);
      return self.clients.claim();
    }).then(() => {
      startPeriodicCheck();
      return notifyAllClientsAboutUpdate();
    }).then(() => {
      return self.registration.getNotifications({ tag: "hatsally-update" }).then((existing) => {
        existing.forEach((n) => n.close());
      }).then(() => {
        console.log(`[SW ${APP_VERSION}] Showing update notification`);
        return self.registration.showNotification("🎉 تم تحديث هتصلي! 🔄", {
          body: "منبهات متعددة الآن! كل منبه يرن في نفس موعده كل يوم - افتح التطبيق وأضف منبهاتك.",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: "hatsally-update",
          requireInteraction: false,
          vibrate: [200, 100, 200, 100, 200],
          data: { version: APP_VERSION, type: "update", timestamp: Date.now() },
          actions: [
            { action: "open", title: "افتح التطبيق 📲" },
            { action: "dismiss", title: "حسناً ✓" }
          ]
        }).catch((err) => console.log("Update notification failed (no permission):", err));
      });
    }).then(() => {
      return new Promise((resolve) => setTimeout(resolve, 1000)).then(() => notifyAllClientsAboutUpdate());
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // صفحات HTML: الشبكة أولاً دائماً (ضروري للتحديث التلقائي)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match("/").then((root) => root || fetch("/"));
          });
        })
    );
    return;
  }

  // باقي الأصول: الكاش أولاً مع تحديث في الخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (request.destination === "image") {
          return caches.match("/icons/icon-192.png");
        }
      });
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  if (data.type === "APP_UPDATE") {
    const title = data.title || "🎉 تم تحديث هتصلي! 🔄";
    const options = {
      body: data.body || `الإصدار الجديد ${data.version || APP_VERSION} متاح الآن! منبهات متعددة وكل منبه يرن كل يوم.`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
      tag: "hatsally-update",
      requireInteraction: false,
      data: Object.assign({}, data, { version: APP_VERSION, type: "update" }),
      actions: [
        { action: "open", title: "افتح التطبيق 📲" },
        { action: "dismiss", title: "حسناً ✓" }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
    event.waitUntil(self.registration.update().then(() => notifyAllClientsAboutUpdate()));
    return;
  }

  const title = data.title || "هتصلي يعني هتصلي - وقت الصلاة! 🕌";
  const options = {
    body: data.body || `استيقظ يا ${data.name || "بطل الفجر"}! حان موعد المنبه - لا يمكن إغلاقه إلا بالتصوير 🔒`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [1000, 500, 1000, 500, 2000, 500, 1000],
    requireInteraction: true,
    tag: "hatsally-persistent-alarm",
    renotify: true,
    data: Object.assign({}, data, { persistent: true, version: APP_VERSION }),
    actions: [
      { action: "wake", title: "استيقظت ✓" },
      { action: "open", title: "افتح التطبيق 📲" }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  if (data.type === "update") {
    if (event.action === "dismiss") return;
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.postMessage({ type: "APP_UPDATED_CLICKED", version: APP_VERSION });
            return client.focus();
          }
        }
        return clients.openWindow("/?update=latest&version=" + APP_VERSION);
      })
    );
    return;
  }

  if (event.action === "wake" || event.action === "open") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.postMessage({
              type: "NOTIFICATION_WAKE",
              alarmId: data.alarmId,
              name: data.name,
              stage: data.stage,
              version: APP_VERSION
            });
            return client.focus();
          }
        }
        return clients.openWindow("/?alarm=wake&persistent=1");
      })
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // الضغط على جسم تنبيه المنبه يوقظ الصفحة رنيناً (وليس مجرد تركيز صامت)
            if (data && data.persistent === true) {
              client.postMessage({
                type: "ALARM_TRIGGERED",
                alarmId: data.alarmId,
                name: data.name,
                stage: data.stage || "ringing",
                version: APP_VERSION
              });
            }
            return client.focus();
          }
        }
        return clients.openWindow("/?alarm=ringing&persistent=1");
      })
    );
  }
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  if (data.type === "update") return;

  console.log(`[SW ${APP_VERSION}] Notification closed/dismissed, data:`, data);

  if (data.persistent && event.notification.tag === "hatsally-persistent-alarm") {
    event.waitUntil(
      getRingingState().then((ringing) => {
        const activeStages = ["ringing", "annoying", "extreme", "verification"];
        const stage = ringing && ringing.stage ? ringing.stage : data.stage;
        if (!ringing || !activeStages.includes(stage)) return;
        console.log(`[SW ${APP_VERSION}] 🔒 Resurrecting alarm notification - cannot dismiss!`);
        return new Promise((resolve) => setTimeout(resolve, 2000))
          .then(() =>
            showPersistentAlarm(ringing.name || data.name || "بطل الفجر", stage, "ar", {
              alarmId: ringing.alarmId || data.alarmId,
              label: ringing.label || data.label,
              time: ringing.time || data.time
            })
          )
          .then(() =>
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({
                  type: "NOTIFICATION_RESURRECTED",
                  alarmId: ringing.alarmId,
                  name: ringing.name,
                  stage,
                  version: APP_VERSION
                });
              });
            })
          );
      })
    );
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "hatsally-alarm-check") {
    event.waitUntil(checkAndTriggerAlarm());
  }
  if (event.tag === "hatsally-update-check") {
    event.waitUntil(
      self.registration.update().then(() => {
        console.log(`[SW ${APP_VERSION}] Periodic update check done`);
        return notifyAllClientsAboutUpdate();
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  // حفظ قائمة المنبهات كاملة (كل منبه يرن في نفس موعده كل يوم)
  if (event.data.type === "SET_ALARMS") {
    const alarms = event.data.alarms || [];
    const name = event.data.name || "";
    console.log(`[SW ${APP_VERSION}] SET_ALARMS: ${alarms.length} alarms for ${name}`);
    event.waitUntil(
      saveAlarmsToDB(alarms, name).then(() => {
        startPeriodicCheck();
        // إشعار التأكيد يظهر فقط عند الحفظ الصريح من المستخدم (لا مع كل مزامنة صامتة)
        if (event.data.notify !== true) return;
        const active = alarms.filter((a) => a.enabled !== false);
        if (active.length === 0) return;
        const summary = active.map((a) => `${a.time}${a.label ? " " + a.label : ""}`).join(" | ");
        return self.registration
          .showNotification("✅ تم ضبط منبهات هتصلي 🔒", {
            body: `${active.length} منبه يعمل: ${summary} - كل منبه يرن في نفس موعده كل يوم حتى لو أُغلق التطبيق`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: "hatsally-confirmation",
            vibrate: [200, 100, 200],
            requireInteraction: false
          })
          .catch(() => {});
      })
    );
  }

  // توافق مع الرسالة القديمة (منبه واحد)
  if (event.data.type === "SET_ALARM") {
    const { time, name, days, duration, startDate } = event.data;
    console.log(`[SW ${APP_VERSION}] Legacy SET_ALARM ${time} for ${name}`);
    event.waitUntil(
      putRecord({
        id: "main-alarm",
        label: "",
        time,
        name,
        days: days || ALL_DAYS,
        duration: duration || "forever",
        startDate: startDate || new Date().toISOString(),
        active: true,
        lastFiredKey: null,
        updatedAt: new Date().toISOString(),
        version: APP_VERSION
      }).then(() => {
        startPeriodicCheck();
        return self.registration
          .showNotification("✅ تم ضبط منبه هتصلي الدائم 🔒", {
            body: `سيوقظك المنبه الساعة ${time} يا ${name} كل يوم - يعمل حتى بعد إغلاق التطبيق وحذف الإشعار!`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: "hatsally-confirmation",
            vibrate: [200, 100, 200],
            requireInteraction: false
          })
          .catch(() => {});
      })
    );
  }

  if (event.data.type === "CLEAR_ALARM" || event.data.type === "CLEAR_ALARMS") {
    console.log(`[SW ${APP_VERSION}] Clearing alarms from DB`);
    event.waitUntil(
      clearAlarmsFromDB().then(() => {
        if (alarmCheckInterval) clearInterval(alarmCheckInterval);
        alarmCheckInterval = null;
        return self.registration.getNotifications({ tag: "hatsally-persistent-alarm" }).then((notifications) => {
          notifications.forEach((n) => n.close());
        });
      })
    );
  }

  if (event.data.type === "TRIGGER_ALARM") {
    const { name, stage, alarmId, label, time } = event.data;
    console.log(`[SW ${APP_VERSION}] Trigger alarm message stage: ${stage} alarm: ${alarmId}`);
    event.waitUntil(
      setRingingState({ alarmId, name, label, time, stage: stage || "ringing", lastTrigger: new Date().toISOString() }).then(() =>
        showPersistentAlarm(name || "بطل الفجر", stage || "ringing", "ar", { alarmId, label, time })
      )
    );
  }

  if (event.data.type === "ALARM_COMPLETED") {
    console.log(`[SW ${APP_VERSION}] Alarm completed - clearing ringing state`);
    event.waitUntil(
      setRingingState({ stage: "idle", completedAt: new Date().toISOString() }).then(() =>
        self.registration.getNotifications({ tag: "hatsally-persistent-alarm" }).then((notifications) => {
          notifications.forEach((n) => n.close());
        })
      ).then(() => startPeriodicCheck())
    );
  }

  if (event.data.type === "CHECK_ALARM") {
    event.waitUntil(checkAndTriggerAlarm());
  }

  if (event.data.type === "SKIP_WAITING") {
    console.log(`[SW ${APP_VERSION}] SKIP_WAITING received - activating new version`);
    self.skipWaiting();
  }

  if (event.data.type === "GET_VERSION") {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: APP_VERSION, cache: CACHE_NAME });
    }
    if (event.source && event.source.postMessage) {
      event.source.postMessage({ type: "VERSION_INFO", version: APP_VERSION, cache: CACHE_NAME });
    }
  }

  if (event.data.type === "CHECK_FOR_UPDATES") {
    console.log(`[SW ${APP_VERSION}] Checking for updates...`);
    event.waitUntil(
      self.registration.update().then(() => {
        console.log(`[SW ${APP_VERSION}] Update check completed`);
        return notifyAllClientsAboutUpdate();
      })
    );
  }

  if (event.data.type === "FORCE_UPDATE") {
    console.log(`[SW ${APP_VERSION}] Force update requested`);
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => self.registration.update()).then(() => self.skipWaiting())
    );
  }

  if (!alarmCheckInterval) startPeriodicCheck();
});

startPeriodicCheck();
console.log(`[SW ${APP_VERSION}] Service Worker loaded - multi-alarm daily repeat enabled!`);
