import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

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
    author: "AOSP",
    items: [
      { name: "Compose Runtime Annotati...", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Saveable", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Tooling Data", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Preview Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Text", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Unit", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Util", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "ConstraintLayout for Jetpac...", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Core", version: "1.16.0", license: "Apache Version 2.0" },
      { name: "Core Kotlin Extensions", version: "1.16.0", license: "Apache Version 2.0" },
      { name: "Credentials", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Credentials Play Services A...", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "DataStore", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DataStore Core", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DataStore Core Okio", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "Emoji2", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Emoji2 Views", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Emoji2 Views Helper", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "exoplayer", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-common", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-core", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-dash", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-database", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-datasource", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-decoder", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-extractor", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-hls", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-rtsp", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-smoothstreaming", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "exoplayer-ui", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "Experimental annotation", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "extension-okhttp", version: "2.18.7", license: "Apache Version 2.0" },
      { name: "Fragment Kotlin Extensions", version: "1.6.2", license: "Apache Version 2.0" },
      { name: "Lifecycle Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData Core", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Process", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Reactivestreams", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ReactiveStreams K...", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime Compose", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Service", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Comp...", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Kotlin ...", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel with S...", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle-Common", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle-Common for Java 8", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "LiveData Core Kotlin Extensi...", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "LiveData Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Material Components for An...", version: "1.12.0", license: "Apache Version 2.0" },
      { name: "Media3 common module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Container module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 database module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 DataSource module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 decoder module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer HLS mod...", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer DASH", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer RTSP", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Extractor module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Session module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Smoothstreaming", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 UI module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Navigation Common", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Compose", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Fragment", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Runtime", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation UI", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Paging Common", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Paging Compose", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "Paging Runtime", version: "3.3.6", license: "Apache Version 2.0" },
      { name: "ProfileInstaller", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "RecyclerView", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Room Common", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Room Kotlin Extensions", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Room Runtime", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "SavedState", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Security Crypto", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Sqlite Framework", version: "2.5.0", license: "Apache Version 2.0" },
      { name: "Startup Runtime", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "SwipeRefreshLayout", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Tracing", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Transition", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "VectorDrawable", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "VectorDrawable Animated", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "ViewPager2", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Window", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Work Manager", version: "2.10.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "React & Web Libraries",
    items: [
      { name: "@radix-ui/react-accordion", version: "1.2.11", license: "MIT License" },
      { name: "@radix-ui/react-alert-dialog", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-avatar", version: "1.1.10", license: "MIT License" },
      { name: "@radix-ui/react-checkbox", version: "1.3.2", license: "MIT License" },
      { name: "@radix-ui/react-dialog", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-dropdown-menu", version: "2.1.15", license: "MIT License" },
      { name: "@radix-ui/react-label", version: "2.1.7", license: "MIT License" },
      { name: "@radix-ui/react-popover", version: "1.1.14", license: "MIT License" },
      { name: "@radix-ui/react-progress", version: "1.1.7", license: "MIT License" },
      { name: "@radix-ui/react-select", version: "2.2.5", license: "MIT License" },
      { name: "@radix-ui/react-separator", version: "1.1.7", license: "MIT License" },
      { name: "@radix-ui/react-slider", version: "1.3.5", license: "MIT License" },
      { name: "@radix-ui/react-slot", version: "1.2.3", license: "MIT License" },
      { name: "@radix-ui/react-switch", version: "1.2.5", license: "MIT License" },
      { name: "@radix-ui/react-tabs", version: "1.1.12", license: "MIT License" },
      { name: "@radix-ui/react-toast", version: "1.2.14", license: "MIT License" },
      { name: "@radix-ui/react-tooltip", version: "1.2.7", license: "MIT License" },
      { name: "@supabase/supabase-js", version: "2.89.0", license: "MIT License" },
      { name: "@tanstack/react-query", version: "5.83.0", license: "MIT License" },
      { name: "class-variance-authority", version: "0.7.1", license: "Apache Version 2.0" },
      { name: "clsx", version: "2.1.1", license: "MIT License" },
      { name: "cmdk", version: "1.1.1", license: "MIT License" },
      { name: "date-fns", version: "3.6.0", license: "MIT License" },
      { name: "embla-carousel-react", version: "8.6.0", license: "MIT License" },
      { name: "framer-motion", version: "11.0.0", license: "MIT License" },
      { name: "lucide-react", version: "0.462.0", license: "ISC License" },
      { name: "react", version: "18.3.1", license: "MIT License" },
      { name: "react-day-picker", version: "8.10.1", license: "MIT License" },
      { name: "react-dom", version: "18.3.1", license: "MIT License" },
      { name: "react-hook-form", version: "7.61.1", license: "MIT License" },
      { name: "react-router-dom", version: "6.30.1", license: "MIT License" },
      { name: "recharts", version: "2.15.4", license: "MIT License" },
      { name: "sonner", version: "1.7.4", license: "MIT License" },
      { name: "tailwind-merge", version: "2.6.0", license: "MIT License" },
      { name: "tailwindcss-animate", version: "1.0.7", license: "MIT License" },
      { name: "vaul", version: "0.9.9", license: "MIT License" },
      { name: "zod", version: "3.25.76", license: "MIT License" },
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
    author: "Google",
    items: [
      { name: "Accompanist Permissions", version: "0.34.0", license: "Apache Version 2.0" },
      { name: "Accompanist SystemUICon...", version: "0.34.0", license: "Apache Version 2.0" },
      { name: "Android Play Core Library", version: "1.10.3", license: "Android Software Devel..." },
      { name: "Firebase Analytics", version: "22.1.2", license: "Apache Version 2.0" },
      { name: "Firebase Auth", version: "23.1.0", license: "Apache Version 2.0" },
      { name: "Firebase Cloud Messaging", version: "24.1.0", license: "Apache Version 2.0" },
      { name: "Firebase Common", version: "21.0.0", license: "Apache Version 2.0" },
      { name: "Firebase Config", version: "22.0.1", license: "Apache Version 2.0" },
      { name: "Firebase Crashlytics", version: "19.3.0", license: "Apache Version 2.0" },
      { name: "Firebase Firestore", version: "25.1.1", license: "Apache Version 2.0" },
      { name: "Firebase Messaging", version: "24.1.0", license: "Apache Version 2.0" },
      { name: "Google Auth Library OAuth...", version: "0.25.5", license: "BSD 3-Clause" },
      { name: "Google HTTP Client", version: "1.41.2", license: "Apache Version 2.0" },
      { name: "Google Maps SDK", version: "18.2.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Auth", version: "21.3.0", license: "Android Software Devel..." },
      { name: "Google Play Services Base", version: "18.6.0", license: "Android Software Devel..." },
      { name: "Google Play Services Loca...", version: "21.3.0", license: "Android Software Devel..." },
      { name: "Google Play Services Maps", version: "19.0.0", license: "Android Software Devel..." },
      { name: "Gson", version: "2.10.1", license: "Apache Version 2.0" },
      { name: "Guava Android", version: "33.4.0", license: "Apache Version 2.0" },
      { name: "Hilt Android", version: "2.52", license: "Apache Version 2.0" },
      { name: "Hilt Core", version: "2.52", license: "Apache Version 2.0" },
      { name: "Hilt Navigation Compose", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "libphonenumber", version: "8.13.52", license: "Apache Version 2.0" },
      { name: "Material Design Components", version: "1.12.0", license: "Apache Version 2.0" },
      { name: "ML Kit Barcode Scanning", version: "17.3.0", license: "ML Kit Terms of Service" },
      { name: "ML Kit Face Detection", version: "16.1.7", license: "ML Kit Terms of Service" },
      { name: "ML Kit Text Recognition", version: "16.0.1", license: "ML Kit Terms of Service" },
      { name: "Protocol Buffers", version: "3.25.5", license: "BSD 3-Clause" },
      { name: "Truth", version: "1.4.4", license: "Apache Version 2.0" },
      { name: "Tink Cryptography", version: "1.15.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Square",
    items: [
      { name: "Moshi", version: "1.15.2", license: "Apache Version 2.0" },
      { name: "Moshi Kotlin", version: "1.15.2", license: "Apache Version 2.0" },
      { name: "OkHttp", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkHttp Logging Interceptor", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkIO", version: "3.9.1", license: "Apache Version 2.0" },
      { name: "Retrofit", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Gson", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Moshi", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "LeakCanary", version: "2.14", license: "Apache Version 2.0" },
      { name: "Picasso", version: "2.8", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "JetBrains",
    items: [
      { name: "Kotlin Coroutines Android", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Core", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Play Ser...", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Kotlin Reflect", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Kotlin Stdlib", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Kotlin Stdlib JDK7", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Kotlin Stdlib JDK8", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Kotlinx Collections Immuta...", version: "0.3.8", license: "Apache Version 2.0" },
      { name: "Kotlinx Datetime", version: "0.6.1", license: "Apache Version 2.0" },
      { name: "Kotlinx Serialization Core", version: "1.7.3", license: "Apache Version 2.0" },
      { name: "Kotlinx Serialization Json", version: "1.7.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Apache Software Foundation",
    items: [
      { name: "Apache Commons Codec", version: "1.17.1", license: "Apache Version 2.0" },
      { name: "Apache Commons Compress", version: "1.27.1", license: "Apache Version 2.0" },
      { name: "Apache Commons IO", version: "2.18.0", license: "Apache Version 2.0" },
      { name: "Apache Commons Lang", version: "3.17.0", license: "Apache Version 2.0" },
      { name: "Apache Commons Logging", version: "1.3.4", license: "Apache Version 2.0" },
      { name: "Apache Commons Text", version: "1.12.0", license: "Apache Version 2.0" },
      { name: "Apache HttpClient", version: "4.5.14", license: "Apache Version 2.0" },
      { name: "Apache HttpCore", version: "4.4.16", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Other Open Source",
    items: [
      { name: "Coil", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Coil Compose", version: "2.7.0", license: "Apache Version 2.0" },
      { name: "Glide", version: "4.16.0", license: "Apache Version 2.0" },
      { name: "Glide Compose", version: "1.0.0-beta01", license: "Apache Version 2.0" },
      { name: "SLF4J API", version: "2.0.16", license: "MIT License" },
      { name: "Timber", version: "5.0.1", license: "Apache Version 2.0" },
      { name: "Dagger", version: "2.52", license: "Apache Version 2.0" },
      { name: "ZXing Core", version: "3.5.3", license: "Apache Version 2.0" },
      { name: "ZXing Android Embedded", version: "4.3.0", license: "Apache Version 2.0" },
      { name: "Facebook SDK", version: "17.0.2", license: "Facebook Platform License" },
      { name: "Facebook Login", version: "17.0.2", license: "Facebook Platform License" },
      { name: "Facebook Share", version: "17.0.2", license: "Facebook Platform License" },
      { name: "Stripe Android", version: "20.54.0", license: "MIT License" },
      { name: "Braintree Drop-In", version: "6.19.0", license: "MIT License" },
      { name: "PayPal Checkout SDK", version: "1.3.2", license: "Apache Version 2.0" },
      { name: "Sentry Android", version: "7.18.1", license: "MIT License" },
      { name: "Mixpanel Android", version: "7.7.0", license: "Apache Version 2.0" },
      { name: "Amplitude Android", version: "1.17.0", license: "MIT License" },
    ]
  },
];

const Licenses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = licensesData.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.license.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-white sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold ml-2">Licenses</h1>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 bg-background sticky top-16 z-10 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search licenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* License Groups */}
      <div className="pb-20">
        {filteredData.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Group Header */}
            {group.author && (
              <div className="px-4 py-3 bg-muted/50 border-b border-border">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                  {group.author}
                </h2>
              </div>
            )}

            {/* License Items */}
            <div className="divide-y divide-border">
              {group.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="px-4 py-4 bg-card hover:bg-muted/30 transition-colors border-l-4 border-l-transparent hover:border-l-primary"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.license}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono shrink-0">
                      {item.version}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredData.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No licenses found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-6 bg-muted/30 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          CubaDate uses open source software. We are grateful to the open source community for their contributions.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Total libraries: {licensesData.reduce((acc, group) => acc + group.items.length, 0)}
        </p>
      </div>
    </div>
  );
};

export default Licenses;
