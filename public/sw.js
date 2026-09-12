// HatSally - هتصلي يعني هتصلي - Service Worker v6 Real Vision + Face Models
// Features: Auto update, persistent alarm, real faucet/mat verification, offline face models
const CACHE_NAME = "hatsally-v6-real-vision";
const APP_VERSION = "5.1.0-real-vision";
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

console.log(`[SW ${APP_VERSION}] Loading...`);

// IndexedDB helpers
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

function saveAlarmToDB(alarmData) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALARMS, "readwrite");
      const store = tx.objectStore(STORE_ALARMS);
      const data = {
        id: "main-alarm",
        time: alarmData.time,
        name: alarmData.name,
        days: alarmData.days || [0,1,2,3,4,5,6],
        duration: alarmData.duration || 'forever',
        startDate: alarmData.startDate || new Date().toISOString(),
        active: true,
        stage: "idle",
        createdAt: new Date().toISOString(),
        version: APP_VERSION
      };
      store.put(data);
      tx.oncomplete = () => resolve(data);
      tx.onerror = () => reject(tx.error);
    });
  });
}

function getAlarmFromDB() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALARMS, "readonly");
      const store = tx.objectStore(STORE_ALARMS);
      const req = store.get("main-alarm");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function clearAlarmFromDB() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALARMS, "readwrite");
      const store = tx.objectStore(STORE_ALARMS);
      store.delete("main-alarm");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function updateAlarmStageInDB(stage) {
  return getAlarmFromDB().then(alarm => {
    if (!alarm) return;
    alarm.stage = stage;
    alarm.lastTrigger = new Date().toISOString();
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ALARMS, "readwrite");
        const store = tx.objectStore(STORE_ALARMS);
        store.put(alarm);
        tx.oncomplete = () => resolve(alarm);
        tx.onerror = () => reject(tx.error);
      });
    });
  });
}

// Persistent notification options
function getPersistentNotificationOptions(name, stage, lang) {
  const isAr = lang === 'ar' || !lang;
  let title = "";
  let body = "";
  let vibrate = [1000,500,1000,500,2000];
  
  if (stage === "ringing") {
    title = isAr ? `🚨 استيقظ يا ${name}!` : `🚨 Wake up ${name}!`;
    body = isAr ? `حان وقت الفجر يا ${name}! قم للصلاة - لن يتوقف إلا بالتصوير! 🔒` : `Fajr time ${name}! Won't stop until photos! 🔒`;
  } else if (stage === "annoying") {
    title = isAr ? `🔔 قم حالاً يا ${name}!` : `🔔 Get up now ${name}!`;
    body = isAr ? `جرس مزعج! استيقظ يا ${name}! لا يمكن إغلاقه! 🔒` : `Annoying alarm! Wake up ${name}! Cannot close! 🔒`;
    vibrate = [500,200,500,200,1000,200,500];
  } else if (stage === "extreme") {
    title = isAr ? `🚨🚨 استيقظ الآن يا ${name}!!` : `🚨🚨 Wake NOW ${name}!!`;
    body = isAr ? `كابوس لا يحتمل! قم يا ${name}! صور الوضوء لإيقافه! 🔒 لا يمكن إغلاقه!` : `Unbearable nightmare! Get up ${name}! Photo verification only! 🔒 Cannot close!`;
    vibrate = [300,100,300,100,300,100,1000];
  } else if (stage === "verification") {
    title = isAr ? `📷 يا ${name} صور الآن!` : `📷 ${name} photograph now!`;
    body = isAr ? `الصوت مستمر! صور صنبور المياه والمصلاة ووجهك يا ${name}! 🔒` : `Sound continues! Photo tap, mat, face ${name}! 🔒`;
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
      data: { name, stage, persistent: true, timestamp: Date.now(), version: APP_VERSION },
      actions: [
        { action: "wake", title: isAr ? "استيقظت ✓" : "I'm awake ✓" },
        { action: "open", title: isAr ? "افتح التطبيق 📲" : "Open App 📲" }
      ]
    }
  };
}

function showPersistentAlarm(name, stage, lang) {
  const { title, options } = getPersistentNotificationOptions(name, stage, lang);
  return self.registration.showNotification(title, options);
}

function checkAndTriggerAlarm() {
  return getAlarmFromDB().then(alarm => {
    if (!alarm || !alarm.active) return;
    
    if (alarm.duration !== 'forever' && alarm.startDate) {
      const start = new Date(alarm.startDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000*60*60*24));
      const limit = typeof alarm.duration === 'number' ? alarm.duration : parseInt(alarm.duration);
      if (!isNaN(limit) && diffDays >= limit) {
        return clearAlarmFromDB().then(() => {
          console.log(`[SW ${APP_VERSION}] Alarm expired after`, limit, "days");
        });
      }
    }

    const today = new Date().getDay();
    if (alarm.days && alarm.days.length > 0 && !alarm.days.includes(today)) {
      return;
    }

    const now = new Date();
    const [alarmH, alarmM] = alarm.time.split(":").map(Number);
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    
    const timeDiff = Math.abs((nowH*60+nowM) - (alarmH*60+alarmM));
    const isTimeMatch = (nowH === alarmH && nowM === alarmM) || (timeDiff <= 1 && alarm.stage === "idle");
    
    if (isTimeMatch) {
      if (alarm.lastTrigger) {
        const last = new Date(alarm.lastTrigger);
        const diffMinutes = (now.getTime() - last.getTime()) / (1000*60);
        if (diffMinutes < 4 && alarm.stage !== "idle") {
          return;
        }
      }
      
      console.log(`[SW ${APP_VERSION}] 🔔 Triggering persistent alarm!`, alarm.time, "for", alarm.name);
      return updateAlarmStageInDB("ringing").then(() => {
        return showPersistentAlarm(alarm.name, "ringing", "ar");
      }).then(() => {
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "ALARM_TRIGGERED", time: alarm.time, name: alarm.name, stage: "ringing", version: APP_VERSION });
          });
        });
      });
    }
  }).catch(err => console.error(`[SW ${APP_VERSION}] check error`, err));
}

let alarmCheckInterval = null;
function startPeriodicCheck() {
  if (alarmCheckInterval) clearInterval(alarmCheckInterval);
  alarmCheckInterval = setInterval(() => {
    checkAndTriggerAlarm();
  }, 60 * 1000);
  checkAndTriggerAlarm();
  console.log(`[SW ${APP_VERSION}] Periodic alarm check started every 60s`);
}

function notifyAllClientsAboutUpdate() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    console.log(`[SW ${APP_VERSION}] Notifying ${clients.length} clients about update`);
    clients.forEach(client => {
      client.postMessage({ 
        type: "APP_UPDATED", 
        version: APP_VERSION, 
        message: "تم تحديث التطبيق تلقائياً",
        messageEn: "App updated automatically",
        timestamp: Date.now()
      });
    });
  });
}

self.addEventListener("install", (event) => {
  console.log(`[SW ${APP_VERSION}] Installing - Auto update mode...`);
  // Force immediate activation for auto-update
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
        })
      );
    }).then(() => {
      console.log(`[SW ${APP_VERSION}] Claiming clients for auto-update`);
      return self.clients.claim();
    }).then(() => {
      startPeriodicCheck();
      // Notify all clients about the update - this is key for auto-update message
      return notifyAllClientsAboutUpdate();
    }).then(() => {
      // Show update notification even if app closed (if permission granted)
      return self.registration.getNotifications({ tag: "hatsally-update" }).then(existing => {
        existing.forEach(n => n.close());
      }).then(() => {
        // Check if we should show update notification
        // We show it always on activation to inform users
        console.log(`[SW ${APP_VERSION}] Showing update notification`);
        return self.registration.showNotification("🎉 تم تحديث هتصلي! 🔄", {
          body: "التطبيق تم تحديثه تلقائياً إلى الإصدار الجديد مع صوت رجل محسن وذكاء اصطناعي أفضل! افتح التطبيق الآن.",
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
        }).catch(err => console.log("Update notification failed (no permission):", err));
      });
    }).then(() => {
      // Also try to broadcast to all clients again after a short delay to ensure delivery
      return new Promise(resolve => setTimeout(resolve, 1000)).then(() => notifyAllClientsAboutUpdate());
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // For navigation requests (HTML), always try network first to get latest version - crucial for auto-updates
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

  // For other assets, cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Update cache in background for auto-update
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
  // Check if it's an update push
  if (data.type === "APP_UPDATE") {
    const title = data.title || "🎉 تم تحديث هتصلي! 🔄";
    const options = {
      body: data.body || `الإصدار الجديد ${data.version || APP_VERSION} متاح الآن! صوت رجل محسن وذكاء اصطناعي أفضل.`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
      tag: "hatsally-update",
      requireInteraction: false,
      data: { ...data, version: APP_VERSION, type: "update" },
      actions: [
        { action: "open", title: "افتح التطبيق 📲" },
        { action: "dismiss", title: "حسناً ✓" }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
    // Also trigger update check
    event.waitUntil(
      self.registration.update().then(() => notifyAllClientsAboutUpdate())
    );
    return;
  }

  const title = data.title || "هتصلي يعني هتصلي - وقت الفجر! 🕌";
  const options = {
    body: data.body || `استيقظ يا ${data.name || "بطل الفجر"}! حان وقت صلاة الفجر - لا يمكن إغلاقه إلا بالتصوير 🔒`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [1000, 500, 1000, 500, 2000, 500, 1000],
    requireInteraction: true,
    tag: "hatsally-persistent-alarm",
    renotify: true,
    data: { ...data, persistent: true, version: APP_VERSION },
    actions: [
      { action: "wake", title: "استيقظت ✓" },
      { action: "open", title: "افتح التطبيق 📲" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  
  if (data.type === "update") {
    if (event.action === "dismiss") return;
    // For update notification, open app
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
            client.postMessage({ type: "NOTIFICATION_WAKE", name: data.name, stage: data.stage, version: APP_VERSION });
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
  // Don't resurrect update notifications
  if (data.type === "update") return;
  
  console.log(`[SW ${APP_VERSION}] Notification closed/dismissed, data:`, data);
  
  if (data.persistent && event.notification.tag === "hatsally-persistent-alarm") {
    event.waitUntil(
      getAlarmFromDB().then(alarm => {
        if (!alarm || !alarm.active) {
          return;
        }
        const activeStages = ["ringing", "annoying", "extreme", "verification"];
        if (activeStages.includes(alarm.stage) || activeStages.includes(data.stage)) {
          console.log(`[SW ${APP_VERSION}] 🔒 Resurrecting alarm notification - cannot dismiss!`);
          return new Promise(resolve => setTimeout(resolve, 2000)).then(() => {
            const stageToShow = alarm.stage !== "idle" ? alarm.stage : (data.stage || "ringing");
            return showPersistentAlarm(alarm.name || data.name || "بطل الفجر", stageToShow, "ar");
          }).then(() => {
            return self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: "NOTIFICATION_RESURRECTED", name: alarm.name, stage: alarm.stage, version: APP_VERSION });
              });
            });
          });
        }
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
  
  if (event.data.type === "SET_ALARM") {
    const { time, name, days, duration, startDate } = event.data;
    console.log(`[SW ${APP_VERSION}] Alarm set for ${time} for ${name}, days:`, days, "duration:", duration);
    event.waitUntil(
      saveAlarmToDB({ time, name, days, duration, startDate }).then(() => {
        startPeriodicCheck();
        if (self.registration) {
          return self.registration.showNotification("✅ تم ضبط منبه هتصلي الدائم 🔒", {
            body: `سيوقظك المنبه الساعة ${time} يا ${name} - يعمل حتى بعد إغلاق التطبيق وحذف الإشعار! ${days ? days.length+' أيام' : ''} - ${duration==='forever' ? 'دائم' : duration+' يوم'} - الإصدار ${APP_VERSION}`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: "hatsally-confirmation",
            vibrate: [200, 100, 200],
            requireInteraction: false,
          }).catch(() => {});
        }
      })
    );
  }
  
  if (event.data.type === "CLEAR_ALARM") {
    console.log(`[SW ${APP_VERSION}] Clearing alarm from DB`);
    event.waitUntil(
      clearAlarmFromDB().then(() => {
        if (alarmCheckInterval) clearInterval(alarmCheckInterval);
        return self.registration.getNotifications({ tag: "hatsally-persistent-alarm" }).then(notifications => {
          notifications.forEach(n => n.close());
        });
      })
    );
  }
  
  if (event.data.type === "TRIGGER_ALARM") {
    const { name, stage } = event.data;
    console.log(`[SW ${APP_VERSION}] Trigger alarm message stage: ${stage}`);
    event.waitUntil(
      updateAlarmStageInDB(stage || "ringing").then(() => {
        return showPersistentAlarm(name || "بطل الفجر", stage || "ringing", "ar");
      })
    );
  }

  if (event.data.type === "ALARM_COMPLETED") {
    console.log(`[SW ${APP_VERSION}] Alarm completed - clearing persistent`);
    event.waitUntil(
      getAlarmFromDB().then(alarm => {
        if (alarm) {
          alarm.stage = "completed";
          if (alarm.duration === 'forever' || alarm.duration > 0) {
            alarm.active = true;
            alarm.stage = "idle";
          } else {
            alarm.active = false;
          }
          return openDB().then(db => {
            return new Promise((resolve, reject) => {
              const tx = db.transaction(STORE_ALARMS, "readwrite");
              const store = tx.objectStore(STORE_ALARMS);
              store.put(alarm);
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
          });
        }
      }).then(() => {
        return self.registration.getNotifications({ tag: "hatsally-persistent-alarm" }).then(notifications => {
          notifications.forEach(n => n.close());
        });
      })
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
    event.ports && event.ports[0] && event.ports[0].postMessage({ version: APP_VERSION, cache: CACHE_NAME });
    // Also broadcast via client postMessage
    event.source && event.source.postMessage && event.source.postMessage({ type: "VERSION_INFO", version: APP_VERSION, cache: CACHE_NAME });
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
      caches.delete(CACHE_NAME).then(() => {
        return self.registration.update();
      }).then(() => self.skipWaiting())
    );
  }

  if (!alarmCheckInterval) startPeriodicCheck();
});

startPeriodicCheck();
console.log(`[SW ${APP_VERSION}] Service Worker loaded - Auto update enabled for all users!`);
