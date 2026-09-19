import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "هتصلي يعني هتصلي - منبه الفجر الذكي",
  description: "تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - منبه ذكي يناديك باسمك بصوت رجل، يفحص الصور بالذكاء الاصطناعي، يعمل بدون إنترنت، يثبت كتطبيق أصلي",
  keywords: ["هتصلي يعني هتصلي", "منبه", "منبه الفجر", "منبه إسلامي", "صلاة الفجر", "استيقاظ", "PWA", "تطبيق منبه"],
  authors: [{ name: "HatSally Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "هتصلي",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "هتصلي يعني هتصلي - منبه الفجر الذكي",
    description: "تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - يثبت كتطبيق أصلي يعمل بدون إنترنت",
    type: "website",
    locale: "ar_SA",
    siteName: "هتصلي يعني هتصلي",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "هتصلي",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="هتصلي" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="هتصلي" />
        <meta name="msapplication-TileColor" content="#10b981" />
        <meta name="msapplication-TileImage" content="/icons/icon-192x192.png" />
      </head>
      <body className="antialiased min-h-screen selection:bg-emerald-500/30">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(reg => {
                      console.log('✅ HatSally SW v5 auto-update registered:', reg.scope, 'Version: 5.0.0-auto-male-voice');
                      // Check for updates immediately and every 30 minutes
                      function checkForUpdates() {
                        reg.update().then(() => {
                          console.log('🔍 Checked for SW updates');
                        }).catch(() => {});
                      }
                      // Initial check after 5 seconds
                      setTimeout(checkForUpdates, 5000);
                      // Periodic check every 30 minutes for auto-update
                      setInterval(checkForUpdates, 30 * 60 * 1000);
                      
                      // Also check when page becomes visible (user returns to app)
                      document.addEventListener('visibilitychange', () => {
                        if (!document.hidden) {
                          checkForUpdates();
                        }
                      });

                      // Listen for new SW installing
                      reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        console.log('🆕 New Service Worker found, installing...', newWorker);
                        newWorker.addEventListener('statechange', () => {
                          console.log('🔄 New SW state:', newWorker.state);
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🎉 New version available! Will auto-activate');
                            // Tell new SW to skip waiting and activate immediately
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            // Show update message via custom event
                            window.dispatchEvent(new CustomEvent('sw-update-found', { detail: { version: '5.2.0' } }));
                          }
                        });
                      });
                    })
                    .catch(err => console.log('SW registration failed:', err));
                });

                // Listen for messages from SW (APP_UPDATED etc)
                navigator.serviceWorker.addEventListener('message', (event) => {
                  const data = event.data;
                  if (!data) return;
                  console.log('📨 SW message received:', data.type, data);
                  if (data.type === 'APP_UPDATED') {
                    console.log('🎉 App updated to version', data.version);
                    // Store update info for page to show banner
                    localStorage.setItem('hatsally-last-update', JSON.stringify({
                      version: data.version,
                      timestamp: Date.now(),
                      message: data.message || 'تم تحديث التطبيق'
                    }));
                    localStorage.setItem('hatsally-update-pending', 'true');
                    // Dispatch event for React to catch
                    window.dispatchEvent(new CustomEvent('app-updated', { detail: data }));
                    // Show browser notification if permission granted
                    if (Notification.permission === 'granted') {
                      try {
                        new Notification('🎉 تم تحديث هتصلي! 🔄', {
                          body: 'التطبيق تم تحديثه تلقائياً إلى الإصدار الجديد مع صوت رجل محسن! افتح التطبيق الآن.',
                          icon: '/icons/icon-192.png',
                          tag: 'hatsally-update-page',
                          requireInteraction: false
                        });
                      } catch(e) {}
                    }
                  }
                });

                // Listen for controller change - new SW took over, reload to get latest
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  if (!refreshing) {
                    refreshing = true;
                    console.log('🔄 SW controller changed - New version activated! Reloading for all users...');
                    // Store that we are updating
                    localStorage.setItem('hatsally-just-updated', 'true');
                    localStorage.setItem('hatsally-update-time', Date.now().toString());
                    // Small delay to allow message to show, then reload for auto-update
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  }
                });

                // Check if we just updated on load
                if (localStorage.getItem('hatsally-just-updated') === 'true') {
                  const updateTime = localStorage.getItem('hatsally-update-time');
                  const now = Date.now();
                  // If updated within last 10 seconds, show message and clear flag
                  if (updateTime && (now - parseInt(updateTime)) < 10000) {
                    console.log('✅ App just auto-updated for user!');
                    setTimeout(() => {
                      localStorage.removeItem('hatsally-just-updated');
                      window.dispatchEvent(new CustomEvent('app-just-updated', { detail: { version: '5.2.0' } }));
                    }, 1000);
                  } else {
                    localStorage.removeItem('hatsally-just-updated');
                  }
                }
              }
              // Prevent zoom on double tap for app-like feel
              document.addEventListener('touchstart', function (event) {
                if (event.touches.length > 1) {
                  event.preventDefault();
                }
              }, { passive: false });
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function (event) {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);
              // Detect standalone mode
              if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
                console.log('📱 Running in standalone PWA mode - هتصلي مثبت كتطبيق أصلي');
                document.documentElement.classList.add('pwa-standalone');
                localStorage.setItem('hatsally-installed', 'true');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
