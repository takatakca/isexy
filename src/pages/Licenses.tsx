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
      { name: "Adyen 3DS2 Android SDK", version: "2.2.0", license: "Apache Version 2.0" },
      { name: "Adyen CSE", version: "1.0.5", license: "MIT License" },
      { name: "Android SDK hCaptcha", version: "4.4.0", license: "MIT License" },
      { name: "AutoValue Annotations", version: "1.6.3", license: "" },
      { name: "com.google.android.datatra...", version: "3.1.0", license: "Apache Version 2.0" },
      { name: "com.google.android.datatra...", version: "3.2.0", license: "Apache Version 2.0" },
      { name: "com.google.android.datatra...", version: "3.2.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "21.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "18.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "18.2.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "18.0.0", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "17.1.1", license: "Apache Version 2.0" },
      { name: "com.google.firebase:firebas...", version: "24.1.1", license: "Apache Version 2.0" },
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
      { name: "null", version: "1.0.5", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Aleksey Masny",
    items: [
      { name: "Fast NoSQL data storage fo...", version: "2.5", license: "Apache Version 2.0" },
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
      { name: "Jakarta Dependency Injection", version: "2.0.1", license: "Eclipse Public License v. 2.0GNU General Public License\n\nversion 2 with the GNU Classpath Exception\n\nApache Version 2.0" },
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
      { name: "Android ConstraintLayout C...", version: "1.0.4", license: "Apache Version 2.0" },
      { name: "Android Lifecycle Extensions", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Android Multi-Dex Library", version: "2.0.0", license: "Apache Version 2.0" },
      { name: "Android Resource Inspectio...", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Android Resources Library", version: "1.6.1", license: "Apache Version 2.0" },
      { name: "AndroidX Futures", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "AndroidX Futures Kotlin Ext...", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "androidx.core:core-viewtree", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "androidx.customview:poolin...", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "androidx.privacysandbox.ad...", version: "1.0.0-beta05", license: "Apache Version 2.0" },
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
      { name: "Compose Material Compon...", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Material Ripple", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Navigation", version: "2.8.9", license: "Apache Version 2.0" },
    ]
  },
];

export default function Licenses() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-4 py-5">
        <button 
          onClick={() => navigate(-1)}
          className="text-primary-foreground flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-primary-foreground text-xl font-medium mt-2">Licenses</h1>
      </div>

      {/* License List */}
      <div className="pb-6">
        {licensesData.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Author/Organization Header */}
            {group.author && (
              <div className="px-4 py-3">
                <h2 className="text-muted-foreground font-semibold text-sm">
                  {group.author}
                </h2>
              </div>
            )}

            {/* License Items */}
            {group.items.map((item, itemIndex) => (
              <div
                key={`${groupIndex}-${itemIndex}`}
                className="mx-2 mb-2 bg-card rounded-lg border border-border p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-foreground font-medium text-base flex-1 pr-4">
                    {item.name}
                  </h3>
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {item.version}
                  </span>
                </div>
                {item.license && (
                  <p className="text-primary text-sm whitespace-pre-line">
                    {item.license}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
