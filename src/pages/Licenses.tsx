import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LicenseItem {
  name: string;
  version: string;
  license: string;
}

interface LicenseGroup {
  author?: string;
  items: LicenseItem[];
}

const licensesData: LicenseGroup[] = [
  {
    items: [
      { name: "@anthropic-ai/sdk", version: "0.6.2", license: "MIT License" },
      { name: "@anthropic-ai/tokenizer", version: "0.0.4", license: "MIT License" },
      { name: "@babel/code-frame", version: "7.26.2", license: "MIT License" },
      { name: "@babel/compat-data", version: "7.26.8", license: "MIT License" },
      { name: "@babel/core", version: "7.26.9", license: "MIT License" },
      { name: "@babel/generator", version: "7.26.9", license: "MIT License" },
      { name: "@babel/helper-compilation-targets", version: "7.26.5", license: "MIT License" },
      { name: "@babel/helper-module-imports", version: "7.25.9", license: "MIT License" },
      { name: "@babel/helper-module-transforms", version: "7.26.0", license: "MIT License" },
      { name: "@babel/helper-plugin-utils", version: "7.26.5", license: "MIT License" },
      { name: "@babel/helper-string-parser", version: "7.25.9", license: "MIT License" },
      { name: "@babel/helper-validator-identifier", version: "7.25.9", license: "MIT License" },
      { name: "@babel/helper-validator-option", version: "7.25.9", license: "MIT License" },
      { name: "@babel/helpers", version: "7.26.9", license: "MIT License" },
      { name: "@babel/parser", version: "7.26.9", license: "MIT License" },
      { name: "@babel/plugin-transform-react-jsx-self", version: "7.25.9", license: "MIT License" },
      { name: "@babel/plugin-transform-react-jsx-source", version: "7.25.9", license: "MIT License" },
      { name: "@babel/template", version: "7.26.9", license: "MIT License" },
      { name: "@babel/traverse", version: "7.26.9", license: "MIT License" },
      { name: "@babel/types", version: "7.26.9", license: "MIT License" },
      { name: "@emnapi/runtime", version: "1.3.1", license: "MIT License" },
      { name: "@esbuild/aix-ppc64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/android-arm", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/android-arm64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/android-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/darwin-arm64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/darwin-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/freebsd-arm64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/freebsd-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-arm", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-arm64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-ia32", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-loong64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-mips64el", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-ppc64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-riscv64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-s390x", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/linux-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/netbsd-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/openbsd-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/sunos-x64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/win32-arm64", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/win32-ia32", version: "0.21.5", license: "MIT License" },
      { name: "@esbuild/win32-x64", version: "0.21.5", license: "MIT License" },
      { name: "@eslint-community/eslint-utils", version: "4.4.1", license: "MIT License" },
      { name: "@eslint-community/regexpp", version: "4.12.1", license: "MIT License" },
      { name: "@eslint/config-array", version: "0.19.2", license: "Apache Version 2.0" },
      { name: "@eslint/core", version: "0.12.0", license: "Apache Version 2.0" },
      { name: "@eslint/eslintrc", version: "3.3.0", license: "MIT License" },
      { name: "@eslint/js", version: "9.21.0", license: "MIT License" },
      { name: "@eslint/object-schema", version: "2.1.6", license: "Apache Version 2.0" },
      { name: "@eslint/plugin-kit", version: "0.2.7", license: "Apache Version 2.0" },
      { name: "@floating-ui/core", version: "1.6.9", license: "MIT License" },
      { name: "@floating-ui/dom", version: "1.6.13", license: "MIT License" },
      { name: "@floating-ui/react-dom", version: "2.1.2", license: "MIT License" },
      { name: "@floating-ui/utils", version: "0.2.9", license: "MIT License" },
      { name: "Adyen 3DS2 Android SDK", version: "2.2.0", license: "Apache Version 2.0" },
      { name: "Adyen CSE", version: "1.0.5", license: "MIT License" },
      { name: "Android SDK hCaptcha", version: "4.4.0", license: "MIT License" },
      { name: "AutoValue Annotations", version: "1.6.3", license: "" },
      { name: "com.google.android.datatransport:transport-api", version: "3.1.0", license: "Apache Version 2.0" },
      { name: "com.google.android.datatransport:transport-backend-cct", version: "3.2.0", license: "Apache Version 2.0" },
      { name: "com.google.android.datatransport:transport-runtime", version: "3.2.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-analytics", version: "21.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-common", version: "18.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-components", version: "18.2.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-config", version: "18.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-crashlytics", version: "17.1.1", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebase-messaging", version: "24.1.1", license: "Apache Version 2.0" },
      { name: "FindBugs-jsr305", version: "3.0.2", license: "Apache Version 2.0" },
      { name: "Jackson-core", version: "2.13.5", license: "Apache Version 2.0" },
      { name: "jackson-databind", version: "2.13.5", license: "Apache Version 2.0" },
      { name: "javax.inject", version: "1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Airbnb",
    items: [
      { name: "DeepLinkDispatch library", version: "6.2.2", license: "Apache Version 2.0" },
      { name: "Epoxy", version: "5.1.4", license: "Apache Version 2.0" },
      { name: "Epoxy annotations", version: "5.1.4", license: "Apache Version 2.0" },
      { name: "Lottie", version: "5.2.0", license: "Apache Version 2.0" },
      { name: "Lottie Compose", version: "5.2.0", license: "Apache Version 2.0" },
      { name: "paris", version: "1.0.5", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Aleksey Masny",
    items: [
      { name: "Fast NoSQL data storage for Android", version: "2.5", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Alessandro Crugnola",
    items: [
      { name: "ImageViewZoom", version: "2.3.0", license: "MIT License" },
    ]
  },
  {
    author: "Antoine Sabot-Durand, Martin Kouba, Tomas Remes, Matej Novotny",
    items: [
      { name: "Jakarta Dependency Injection", version: "2.0.1", license: "Eclipse Public License v. 2.0\nGNU General Public License version 2 with the GNU Classpath Exception\nApache Version 2.0" },
    ]
  },
  {
    author: "AOSP",
    items: [
      { name: "Activity", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Activity Compose", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Activity Kotlin Extensions", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Android AppCompat Library", version: "1.6.1", license: "Apache Version 2.0" },
      { name: "Android Arch-Common", version: "2.2.0", license: "Apache Version 2.0" },
      { name: "Android Arch-Runtime", version: "2.2.0", license: "Apache Version 2.0" },
      { name: "Android ConstraintLayout", version: "2.1.4", license: "Apache Version 2.0" },
      { name: "Android ConstraintLayout Core", version: "1.0.4", license: "Apache Version 2.0" },
      { name: "Android Lifecycle Extensions", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Android Multi-Dex Library", version: "2.0.0", license: "Apache Version 2.0" },
      { name: "Android Resource Inspection", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Android Resources Library", version: "1.6.1", license: "Apache Version 2.0" },
      { name: "AndroidX Futures", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "AndroidX Futures Kotlin Extensions", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "androidx.core:core-viewtree", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "androidx.customview:poolingcontainer", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "androidx.privacysandbox.ads:ads-adservices", version: "1.0.0-beta05", license: "Apache Version 2.0" },
      { name: "Annotation", version: "1.9.1", license: "Apache Version 2.0" },
      { name: "Biometric", version: "1.2.0-alpha04", license: "Apache Version 2.0" },
      { name: "Browser", version: "1.8.0", license: "Apache Version 2.0" },
      { name: "Camera Core", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Camera Lifecycle", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Camera Video", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Camera View", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Camera2", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "collections", version: "1.5.0", license: "Apache Version 2.0" },
      { name: "Collections Kotlin Extensions", version: "1.5.0", license: "Apache Version 2.0" },
      { name: "Compose Animation", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Animation Core", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Foundation", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Geometry", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Graphics", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Layouts", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Material Components", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Material Ripple", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Navigation", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Compose Runtime", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Saveable", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Preview Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Text", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Unit", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Util", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Core", version: "1.15.0", license: "Apache Version 2.0" },
      { name: "Core Kotlin Extensions", version: "1.15.0", license: "Apache Version 2.0" },
      { name: "CoordinatorLayout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "DataStore Core", version: "1.1.1", license: "Apache Version 2.0" },
      { name: "DataStore Preferences", version: "1.1.1", license: "Apache Version 2.0" },
      { name: "DocumentFile", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Emoji2", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Emoji2 Views Helper", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "ExifInterface", version: "1.3.7", license: "Apache Version 2.0" },
      { name: "Fragment", version: "1.8.5", license: "Apache Version 2.0" },
      { name: "Fragment Kotlin Extensions", version: "1.8.5", license: "Apache Version 2.0" },
      { name: "Hilt Android", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Core", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Interpolator", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Lifecycle Common", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData Core", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle Process", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime Compose", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle Service", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Compose", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Kotlin Extensions", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel SavedState", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "LocalBroadcastManager", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Media", version: "1.7.0", license: "Apache Version 2.0" },
      { name: "Media3 Common", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Container", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Database", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Datasource", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Decoder", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer Dash", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer HLS", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer RTSP", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer Smoothstreaming", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Extractor", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 Session", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Media3 UI", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "Navigation Common", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Common Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Fragment", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Fragment Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Runtime", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Runtime Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation UI", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation UI Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Paging Common", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Paging Common Kotlin Extensions", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Paging Runtime", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Paging Runtime Kotlin Extensions", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Palette", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Print", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "ProfileInstaller", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "RecyclerView", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Room Common", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Room Runtime", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Room Kotlin Extensions", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "SavedState", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "SavedState Kotlin Extensions", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Security Crypto", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "SlidingPaneLayout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Sqlite Framework", version: "2.5.0", license: "Apache Version 2.0" },
      { name: "Startup Runtime", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "SwipeRefreshLayout", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Tracing", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Transition", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Transition Kotlin Extensions", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "VectorDrawable", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "VectorDrawable Animated", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "VersionedParcelable", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "ViewPager", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "ViewPager2", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Window", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Window Extensions", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Work Manager", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "Work Manager Kotlin Extensions", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "Work Manager Runtime Kotlin Extensions", version: "2.10.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Apache Software Foundation",
    items: [
      { name: "Apache Commons Codec", version: "1.15", license: "Apache Version 2.0" },
      { name: "Apache Commons IO", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Apache Commons Lang", version: "3.12.0", license: "Apache Version 2.0" },
      { name: "Apache Commons Logging", version: "1.2", license: "Apache Version 2.0" },
      { name: "Apache Commons Text", version: "1.10.0", license: "Apache Version 2.0" },
      { name: "Apache HttpClient", version: "4.5.14", license: "Apache Version 2.0" },
      { name: "Apache HttpCore", version: "4.4.16", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Atlassian",
    items: [
      { name: "AndroidDeveloperOptions", version: "1.1.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Ben Manes",
    items: [
      { name: "Caffeine", version: "3.1.8", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Braze Inc.",
    items: [
      { name: "Braze Android SDK", version: "31.1.0", license: "MIT License" },
      { name: "Braze Android UI", version: "31.1.0", license: "MIT License" },
    ]
  },
  {
    author: "Bumptech",
    items: [
      { name: "Glide", version: "4.16.0", license: "BSD, Part MIT and Apache Version 2.0" },
      { name: "Glide Annotations", version: "4.16.0", license: "BSD, Part MIT and Apache Version 2.0" },
      { name: "Glide DiskLRUCache", version: "4.16.0", license: "BSD, Part MIT and Apache Version 2.0" },
      { name: "Glide GIF Decoder", version: "4.16.0", license: "BSD, Part MIT and Apache Version 2.0" },
      { name: "Glide Compose", version: "1.0.0", license: "BSD, Part MIT and Apache Version 2.0" },
    ]
  },
  {
    author: "CameraX",
    items: [
      { name: "CameraX Core", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "CameraX Lifecycle", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "CameraX View", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "CameraX Camera2", version: "1.4.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Chris Banes",
    items: [
      { name: "PhotoView", version: "2.3.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Cloudflare",
    items: [
      { name: "Cloudflare Turnstile", version: "0.1.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Dagger Team",
    items: [
      { name: "Dagger", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Dagger Android", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Dagger Android Support", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Android", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Android Compiler", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Core", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Navigation Compose", version: "1.2.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Facebook",
    items: [
      { name: "Facebook Android SDK", version: "16.3.0", license: "MIT License" },
      { name: "Facebook Core SDK", version: "16.3.0", license: "MIT License" },
      { name: "Facebook Login SDK", version: "16.3.0", license: "MIT License" },
      { name: "Facebook Share SDK", version: "16.3.0", license: "MIT License" },
      { name: "Fresco", version: "3.1.3", license: "MIT License" },
      { name: "Fresco DraweeBackend", version: "3.1.3", license: "MIT License" },
      { name: "Fresco ImagePipeline", version: "3.1.3", license: "MIT License" },
      { name: "Fresco ImagePipeline Base", version: "3.1.3", license: "MIT License" },
      { name: "Fresco Native ImageTranscoder", version: "3.1.3", license: "MIT License" },
      { name: "Shimmer", version: "0.5.0", license: "BSD License" },
      { name: "SoLoader", version: "0.11.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Google",
    items: [
      { name: "Android Ads Identifier", version: "18.0.1", license: "Apache Version 2.0" },
      { name: "Android GMS Base", version: "18.0.1", license: "Apache Version 2.0" },
      { name: "Android GMS Location", version: "21.0.1", license: "Apache Version 2.0" },
      { name: "Android GMS Maps", version: "18.2.0", license: "Apache Version 2.0" },
      { name: "Android GMS Tasks", version: "18.0.2", license: "Apache Version 2.0" },
      { name: "Android GMS Wallet", version: "19.3.0", license: "Apache Version 2.0" },
      { name: "Android Play App Update", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Android Play Core", version: "1.10.3", license: "Apache Version 2.0" },
      { name: "Android Play Review", version: "2.0.1", license: "Apache Version 2.0" },
      { name: "Android Play Services Auth", version: "21.2.0", license: "Apache Version 2.0" },
      { name: "Android Play Services Auth API Phone", version: "18.1.0", license: "Apache Version 2.0" },
      { name: "Android Play Services Basement", version: "18.4.0", license: "Apache Version 2.0" },
      { name: "Android Play Services Identity", version: "18.1.0", license: "Apache Version 2.0" },
      { name: "Android Play Services InstallReferrer", version: "2.2", license: "Apache Version 2.0" },
      { name: "ErrorProne Annotations", version: "2.27.1", license: "Apache Version 2.0" },
      { name: "ExoPlayer", version: "2.19.1", license: "Apache Version 2.0" },
      { name: "Firebase Analytics", version: "21.6.2", license: "Apache Version 2.0" },
      { name: "Firebase Auth", version: "23.1.0", license: "Apache Version 2.0" },
      { name: "Firebase Cloud Messaging", version: "24.1.0", license: "Apache Version 2.0" },
      { name: "Firebase Common", version: "21.0.0", license: "Apache Version 2.0" },
      { name: "Firebase Config", version: "22.0.1", license: "Apache Version 2.0" },
      { name: "Firebase Crashlytics", version: "19.3.0", license: "Apache Version 2.0" },
      { name: "Firebase Dynamic Links", version: "22.1.0", license: "Apache Version 2.0" },
      { name: "Firebase IID", version: "21.1.0", license: "Apache Version 2.0" },
      { name: "Firebase Installations", version: "18.0.0", license: "Apache Version 2.0" },
      { name: "Firebase Perf", version: "21.0.3", license: "Apache Version 2.0" },
      { name: "Google Material Components", version: "1.12.0", license: "Apache Version 2.0" },
      { name: "Gson", version: "2.10.1", license: "Apache Version 2.0" },
      { name: "Guava", version: "33.0.0-android", license: "Apache Version 2.0" },
      { name: "LibPhoneNumber", version: "8.13.31", license: "Apache Version 2.0" },
      { name: "ML Kit Barcode Scanning", version: "17.3.0", license: "Apache Version 2.0" },
      { name: "ML Kit Face Detection", version: "16.1.7", license: "Apache Version 2.0" },
      { name: "ML Kit Vision Common", version: "17.3.0", license: "Apache Version 2.0" },
      { name: "Protocol Buffers Lite", version: "3.25.1", license: "BSD 3-Clause" },
      { name: "Tink", version: "1.14.1", license: "Apache Version 2.0" },
      { name: "Truth", version: "1.4.2", license: "Apache Version 2.0" },
      { name: "Zxing Core", version: "3.5.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Greenrobot",
    items: [
      { name: "EventBus", version: "3.3.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Jake Wharton",
    items: [
      { name: "Butter Knife", version: "10.2.3", license: "Apache Version 2.0" },
      { name: "DiskLruCache", version: "2.0.2", license: "Apache Version 2.0" },
      { name: "RxBinding", version: "4.0.0", license: "Apache Version 2.0" },
      { name: "ThreeTenABP", version: "1.4.7", license: "Apache Version 2.0" },
      { name: "Timber", version: "5.0.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "JetBrains",
    items: [
      { name: "Kotlin Coroutines Android", version: "1.8.1", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Core", version: "1.8.1", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Reactive", version: "1.8.1", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines RxJava2", version: "1.8.1", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines RxJava3", version: "1.8.1", license: "Apache Version 2.0" },
      { name: "Kotlin Reflect", version: "1.9.24", license: "Apache Version 2.0" },
      { name: "Kotlin StdLib", version: "1.9.24", license: "Apache Version 2.0" },
      { name: "Kotlin StdLib Common", version: "1.9.24", license: "Apache Version 2.0" },
      { name: "Kotlin StdLib JDK7", version: "1.9.24", license: "Apache Version 2.0" },
      { name: "Kotlin StdLib JDK8", version: "1.9.24", license: "Apache Version 2.0" },
      { name: "KotlinX Collections Immutable", version: "0.3.7", license: "Apache Version 2.0" },
      { name: "KotlinX DateTime", version: "0.6.1", license: "Apache Version 2.0" },
      { name: "KotlinX Serialization Core", version: "1.7.3", license: "Apache Version 2.0" },
      { name: "KotlinX Serialization JSON", version: "1.7.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Koin",
    items: [
      { name: "Koin Android", version: "3.5.6", license: "Apache Version 2.0" },
      { name: "Koin Core", version: "3.5.6", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Mockito",
    items: [
      { name: "Mockito Android", version: "5.11.0", license: "MIT License" },
      { name: "Mockito Core", version: "5.11.0", license: "MIT License" },
      { name: "Mockito Kotlin", version: "5.3.1", license: "MIT License" },
    ]
  },
  {
    author: "OkHttp",
    items: [
      { name: "OkHttp", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkHttp Logging Interceptor", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkHttp TLS", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkIO", version: "3.9.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Open AI",
    items: [
      { name: "OpenAI SDK", version: "3.7.0", license: "MIT License" },
    ]
  },
  {
    author: "React Native",
    items: [
      { name: "React Native", version: "0.74.5", license: "MIT License" },
      { name: "React Native Animated", version: "0.74.5", license: "MIT License" },
      { name: "React Native Async Storage", version: "1.24.0", license: "MIT License" },
      { name: "React Native CLI", version: "14.1.1", license: "MIT License" },
      { name: "React Native Gesture Handler", version: "2.20.2", license: "MIT License" },
      { name: "React Native Navigation", version: "6.1.18", license: "MIT License" },
      { name: "React Native Permissions", version: "4.1.5", license: "MIT License" },
      { name: "React Native Reanimated", version: "3.16.2", license: "MIT License" },
      { name: "React Native Safe Area Context", version: "4.14.0", license: "MIT License" },
      { name: "React Native Screens", version: "4.0.0", license: "MIT License" },
      { name: "React Native SVG", version: "15.8.0", license: "MIT License" },
      { name: "React Native Vector Icons", version: "10.2.0", license: "MIT License" },
      { name: "React Native WebView", version: "14.0.3", license: "MIT License" },
    ]
  },
  {
    author: "ReactiveX",
    items: [
      { name: "RxAndroid", version: "3.0.2", license: "Apache Version 2.0" },
      { name: "RxJava", version: "3.1.9", license: "Apache Version 2.0" },
      { name: "RxJava2", version: "2.2.21", license: "Apache Version 2.0" },
      { name: "RxKotlin", version: "3.0.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Retrofit",
    items: [
      { name: "Retrofit", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Gson", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Jackson", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Moshi", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Scalars", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit RxJava2 Adapter", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit RxJava3 Adapter", version: "2.11.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Sentry",
    items: [
      { name: "Sentry Android", version: "7.14.0", license: "MIT License" },
      { name: "Sentry Android Core", version: "7.14.0", license: "MIT License" },
      { name: "Sentry Android NDK", version: "7.14.0", license: "MIT License" },
      { name: "Sentry Android OkHttp", version: "7.14.0", license: "MIT License" },
      { name: "Sentry Android Timber", version: "7.14.0", license: "MIT License" },
    ]
  },
  {
    author: "Squareup",
    items: [
      { name: "Curtains", version: "1.2.5", license: "Apache Version 2.0" },
      { name: "LeakCanary", version: "2.14", license: "Apache Version 2.0" },
      { name: "Moshi", version: "1.15.1", license: "Apache Version 2.0" },
      { name: "Moshi Kotlin", version: "1.15.1", license: "Apache Version 2.0" },
      { name: "Picasso", version: "2.8", license: "Apache Version 2.0" },
      { name: "SQLDelight", version: "2.0.2", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Stripe",
    items: [
      { name: "Stripe Android SDK", version: "20.48.6", license: "MIT License" },
      { name: "Stripe Payments UI", version: "20.48.6", license: "MIT License" },
    ]
  },
  {
    author: "TanStack",
    items: [
      { name: "React Query", version: "5.83.0", license: "MIT License" },
      { name: "React Query DevTools", version: "5.83.0", license: "MIT License" },
    ]
  },
  {
    author: "Twilio",
    items: [
      { name: "Twilio Conversations", version: "4.1.0", license: "MIT License" },
      { name: "Twilio Video", version: "7.7.2", license: "MIT License" },
      { name: "Twilio Voice", version: "6.6.2", license: "MIT License" },
    ]
  },
  {
    author: "Uber",
    items: [
      { name: "AutoDispose", version: "2.2.1", license: "Apache Version 2.0" },
      { name: "Nullaway", version: "0.11.0", license: "MIT License" },
      { name: "RIBs", version: "0.14.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Vercel",
    items: [
      { name: "AI SDK", version: "3.4.33", license: "MIT License" },
      { name: "AI SDK React", version: "0.0.70", license: "MIT License" },
      { name: "SWR", version: "2.2.5", license: "MIT License" },
    ]
  },
  {
    author: "Zod",
    items: [
      { name: "Zod", version: "3.25.76", license: "MIT License" },
    ]
  },
  {
    author: "Zustand",
    items: [
      { name: "Zustand", version: "4.5.5", license: "MIT License" },
    ]
  },
  {
    author: "Other Libraries",
    items: [
      { name: "@fontsource/nunito", version: "5.2.7", license: "OFL-1.1" },
      { name: "@hookform/resolvers", version: "3.10.0", license: "MIT License" },
      { name: "@radix-ui/react-accordion", version: "1.2.11", license: "MIT License" },
      { name: "@radix-ui/react-alert-dialog", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-aspect-ratio", version: "1.1.7", license: "MIT License" },
      { name: "@radix-ui/react-avatar", version: "1.1.10", license: "MIT License" },
      { name: "@radix-ui/react-checkbox", version: "1.3.2", license: "MIT License" },
      { name: "@radix-ui/react-collapsible", version: "1.1.11", license: "MIT License" },
      { name: "@radix-ui/react-context-menu", version: "2.2.15", license: "MIT License" },
      { name: "@radix-ui/react-dialog", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-dropdown-menu", version: "2.1.15", license: "MIT License" },
      { name: "@radix-ui/react-hover-card", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-label", version: "2.1.7", license: "MIT License" },
      { name: "@radix-ui/react-menubar", version: "1.1.15", license: "MIT License" },
      { name: "@radix-ui/react-navigation-menu", version: "1.2.13", license: "MIT License" },
      { name: "@radix-ui/react-popover", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-progress", version: "1.1.7", license: "MIT License" },
      { name: "@radix-ui/react-radio-group", version: "1.3.7", license: "MIT License" },
      { name: "@radix-ui/react-scroll-area", version: "1.2.9", license: "MIT License" },
      { name: "@radix-ui/react-select", version: "2.2.5", license: "MIT License" },
      { name: "@radix-ui/react-separator", version: "1.1.7", license: "MIT License" },
      { name: "@radix-ui/react-slider", version: "1.3.5", license: "MIT License" },
      { name: "@radix-ui/react-slot", version: "1.2.3", license: "MIT License" },
      { name: "@radix-ui/react-switch", version: "1.2.5", license: "MIT License" },
      { name: "@radix-ui/react-tabs", version: "1.1.12", license: "MIT License" },
      { name: "@radix-ui/react-toast", version: "1.2.14", license: "MIT License" },
      { name: "@radix-ui/react-toggle", version: "1.1.9", license: "MIT License" },
      { name: "@radix-ui/react-toggle-group", version: "1.1.10", license: "MIT License" },
      { name: "@radix-ui/react-tooltip", version: "1.2.7", license: "MIT License" },
      { name: "@supabase/supabase-js", version: "2.89.0", license: "MIT License" },
      { name: "class-variance-authority", version: "0.7.1", license: "Apache Version 2.0" },
      { name: "clsx", version: "2.1.1", license: "MIT License" },
      { name: "cmdk", version: "1.1.1", license: "MIT License" },
      { name: "date-fns", version: "3.6.0", license: "MIT License" },
      { name: "embla-carousel-react", version: "8.6.0", license: "MIT License" },
      { name: "input-otp", version: "1.4.2", license: "MIT License" },
      { name: "lucide-react", version: "0.462.0", license: "ISC License" },
      { name: "next-themes", version: "0.3.0", license: "MIT License" },
      { name: "react", version: "18.3.1", license: "MIT License" },
      { name: "react-day-picker", version: "8.10.1", license: "MIT License" },
      { name: "react-dom", version: "18.3.1", license: "MIT License" },
      { name: "react-hook-form", version: "7.61.1", license: "MIT License" },
      { name: "react-resizable-panels", version: "2.1.9", license: "MIT License" },
      { name: "react-router-dom", version: "6.30.1", license: "MIT License" },
      { name: "recharts", version: "2.15.4", license: "MIT License" },
      { name: "sonner", version: "1.7.4", license: "MIT License" },
      { name: "tailwind-merge", version: "2.6.0", license: "MIT License" },
      { name: "tailwindcss-animate", version: "1.0.7", license: "MIT License" },
      { name: "vaul", version: "0.9.9", license: "MIT License" },
    ]
  },
];

export default function Licenses() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header - Tinder style pink */}
      <div className="bg-primary px-4 py-6 sticky top-0 z-10">
        <h1 className="text-primary-foreground text-2xl font-semibold">Licenses</h1>
      </div>

      {/* License List */}
      <div className="pb-20">
        {licensesData.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Author/Organization Header */}
            {group.author && (
              <div className="px-4 py-3 bg-muted/30">
                <h2 className="text-muted-foreground font-bold text-sm uppercase tracking-wide">
                  {group.author}
                </h2>
              </div>
            )}

            {/* License Items */}
            {group.items.map((item, itemIndex) => (
              <div
                key={`${groupIndex}-${itemIndex}`}
                className="bg-card border-l-4 border-l-muted mx-3 mb-1.5 rounded-md shadow-sm"
              >
                <div className="px-4 py-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-foreground font-medium text-base flex-1 pr-4 leading-tight">
                      {item.name}
                    </h3>
                    <span className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                      {item.version}
                    </span>
                  </div>
                  {item.license && (
                    <p className="text-muted-foreground text-sm whitespace-pre-line">
                      {item.license}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
