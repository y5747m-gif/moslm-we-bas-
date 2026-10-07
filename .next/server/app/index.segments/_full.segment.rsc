1:"$Sreact.fragment"
2:I[39756,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"default"]
3:I[37457,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"default"]
7:I[68027,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"default",1]
:HL["/_next/static/chunks/0y_i2vkiagjmm.css","style"]
:HL["https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&display=swap","style"]
4:T1b11,
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
            0:{"P":null,"c":["",""],"q":"","i":false,"f":[[["",{"children":["__PAGE__",{}]},"$undefined","$undefined",16],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/0y_i2vkiagjmm.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","script","script-0",{"src":"/_next/static/chunks/0dbhjjzl8qfwv.js","async":true,"nonce":"$undefined"}]],["$","html",null,{"lang":"ar","dir":"rtl","suppressHydrationWarning":true,"children":[["$","head",null,{"children":[["$","link",null,{"rel":"preconnect","href":"https://fonts.googleapis.com"}],["$","link",null,{"rel":"preconnect","href":"https://fonts.gstatic.com","crossOrigin":"anonymous"}],["$","link",null,{"href":"https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&display=swap","rel":"stylesheet"}],["$","link",null,{"rel":"apple-touch-icon","href":"/icons/icon-192x192.png"}],["$","link",null,{"rel":"apple-touch-icon","sizes":"192x192","href":"/icons/icon-192x192.png"}],["$","link",null,{"rel":"apple-touch-icon","sizes":"512x512","href":"/icons/icon-512x512.png"}],["$","meta",null,{"name":"apple-mobile-web-app-capable","content":"yes"}],["$","meta",null,{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","meta",null,{"name":"apple-mobile-web-app-title","content":"هتصلي"}],["$","meta",null,{"name":"mobile-web-app-capable","content":"yes"}],["$","meta",null,{"name":"application-name","content":"هتصلي"}],["$","meta",null,{"name":"msapplication-TileColor","content":"#10b981"}],["$","meta",null,{"name":"msapplication-TileImage","content":"/icons/icon-192x192.png"}]]}],["$","body",null,{"className":"antialiased min-h-screen selection:bg-emerald-500/30","children":[["$","$L2",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L3",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}],["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$4"}}]]}]]}]]}],{"children":["$L5",{},null,false,null]},null,false,null],"$L6",false]],"m":"$undefined","G":["$7",["$L8"]],"S":true,"h":null,"s":"$undefined","l":"$undefined","p":"$undefined","d":"$undefined","b":"sNUjew0pdO6HiJJdujLAP"}
9:I[47257,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"ClientPageRoot"]
a:I[31713,["/_next/static/chunks/0dbhjjzl8qfwv.js","/_next/static/chunks/15g5.jc_hx90s.js","/_next/static/chunks/0sdaj1l-hu6mb.js"],"default"]
d:I[97367,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"OutletBoundary"]
e:"$Sreact.suspense"
10:I[97367,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"ViewportBoundary"]
12:I[97367,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"MetadataBoundary"]
5:["$","$1","c",{"children":[["$","$L9",null,{"Component":"$a","serverProvidedParams":{"searchParams":{},"params":{},"promises":["$@b","$@c"]}}],[["$","script","script-0",{"src":"/_next/static/chunks/15g5.jc_hx90s.js","async":true,"nonce":"$undefined"}],["$","script","script-1",{"src":"/_next/static/chunks/0sdaj1l-hu6mb.js","async":true,"nonce":"$undefined"}]],["$","$Ld",null,{"children":["$","$e",null,{"name":"Next.MetadataOutlet","children":"$@f"}]}]]}]
6:["$","$1","h",{"children":[null,["$","$L10",null,{"children":"$L11"}],["$","div",null,{"hidden":true,"children":["$","$L12",null,{"children":["$","$e",null,{"name":"Next.Metadata","children":"$L13"}]}]}],null]}]
8:["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/0y_i2vkiagjmm.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]
b:{}
c:"$5:props:children:0:props:serverProvidedParams:params"
11:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"}],["$","meta","2",{"name":"theme-color","content":"#10b981"}],["$","meta","3",{"name":"color-scheme","content":"dark light"}]]
14:I[27201,["/_next/static/chunks/0dbhjjzl8qfwv.js"],"IconMark"]
f:null
13:[["$","title","0",{"children":"هتصلي يعني هتصلي - منبه الفجر الذكي"}],["$","meta","1",{"name":"description","content":"تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - منبه ذكي يناديك باسمك بصوت رجل، يفحص الصور بالذكاء الاصطناعي، يعمل بدون إنترنت، يثبت كتطبيق أصلي"}],["$","meta","2",{"name":"author","content":"HatSally Team"}],["$","link","3",{"rel":"manifest","href":"/manifest.webmanifest","crossOrigin":"$undefined"}],["$","meta","4",{"name":"keywords","content":"هتصلي يعني هتصلي,منبه,منبه الفجر,منبه إسلامي,صلاة الفجر,استيقاظ,PWA,تطبيق منبه"}],["$","meta","5",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","6",{"name":"apple-mobile-web-app-capable","content":"yes"}],["$","meta","7",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","meta","8",{"name":"apple-mobile-web-app-title","content":"هتصلي"}],["$","meta","9",{"name":"format-detection","content":"telephone=no"}],["$","meta","10",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","11",{"name":"apple-mobile-web-app-title","content":"هتصلي"}],["$","link","12",{"href":"/icons/icon-512x512.png","media":"(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)","rel":"apple-touch-startup-image"}],["$","meta","13",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","meta","14",{"property":"og:title","content":"هتصلي يعني هتصلي - منبه الفجر الذكي"}],["$","meta","15",{"property":"og:description","content":"تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - يثبت كتطبيق أصلي يعمل بدون إنترنت"}],["$","meta","16",{"property":"og:site_name","content":"هتصلي يعني هتصلي"}],["$","meta","17",{"property":"og:locale","content":"ar_SA"}],["$","meta","18",{"property":"og:type","content":"website"}],["$","meta","19",{"name":"twitter:card","content":"summary"}],["$","meta","20",{"name":"twitter:title","content":"هتصلي يعني هتصلي - منبه الفجر الذكي"}],["$","meta","21",{"name":"twitter:description","content":"تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - يثبت كتطبيق أصلي يعمل بدون إنترنت"}],["$","link","22",{"rel":"shortcut icon","href":"/icons/icon-192x192.png"}],["$","link","23",{"rel":"icon","href":"/icons/icon-192x192.png","sizes":"192x192","type":"image/png"}],["$","link","24",{"rel":"icon","href":"/icons/icon-192.png","sizes":"192x192","type":"image/png"}],["$","link","25",{"rel":"icon","href":"/icons/icon-512x512.png","sizes":"512x512","type":"image/png"}],["$","link","26",{"rel":"icon","href":"/icons/icon-512.png","sizes":"512x512","type":"image/png"}],["$","link","27",{"rel":"apple-touch-icon","href":"/icons/icon-192x192.png","sizes":"192x192","type":"image/png"}],["$","link","28",{"rel":"apple-touch-icon","href":"/icons/icon-512x512.png","sizes":"512x512","type":"image/png"}],["$","$L14","29",{}]]
