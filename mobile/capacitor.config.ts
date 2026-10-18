import type { CapacitorConfig } from "@capacitor/cli";

// The app is a native shell around the live site: every change to beforethebell.in reaches the app at once,
// with no new store release. The native pieces (push, Face ID, share, documents) are driven from
// public/js/app-bridge.js on the site, which loads only inside the app.
const config: CapacitorConfig = {
  appId: "in.beforethebell.app",
  appName: "Before the Bell",
  webDir: "www",
  appendUserAgent: "BeforeTheBellApp/1.0",
  backgroundColor: "#0b1730",
  server: {
    url: "https://beforethebell.in/dashboard?utm_source=app&utm_medium=app&utm_campaign=open",
    hostname: "beforethebell.in",
    androidScheme: "https",
    allowNavigation: ["beforethebell.in", "www.beforethebell.in"],
    errorPath: "offline.html",
  },
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false, scheme: "Before the Bell" },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, backgroundColor: "#0b1730", showSpinner: false, androidScaleType: "CENTER_CROP" },
    StatusBar: { style: "DEFAULT", overlaysWebView: false },
    FirebaseMessaging: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
