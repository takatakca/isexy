import { ChevronLeft, Search, X, ChevronDown, ChevronUp, SortAsc, Filter, List, Grid3X3, Copy, Check, Maximize2, Minimize2, ArrowUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface LicenseItem {
  name: string;
  version: string;
  license: string;
}

interface LicenseGroup {
  author?: string;
  items: LicenseItem[];
}

// Full license texts for expandable details
const licenseTexts: Record<string, string> = {
  "MIT License": `MIT License

Copyright (c) [year] [copyright holders]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  "Apache Version 2.0": `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.
"License" shall mean the terms and conditions for use, reproduction, and distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity authorized by the copyright owner that is granting the License.

"Legal Entity" shall mean the union of the acting entity and all other entities that control, are controlled by, or are under common control with that entity.

2. Grant of Copyright License.
Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form.

3. Grant of Patent License.
Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Work.

4. Redistribution.
You may reproduce and distribute copies of the Work or Derivative Works thereof in any medium, with or without modifications, and in Source or Object form, provided that You meet the conditions set forth in this License.

5. Submission of Contributions.
Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You to the Licensor shall be under the terms and conditions of this License.

6. Trademarks.
This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor.

7. Disclaimer of Warranty.
Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

8. Limitation of Liability.
In no event and under no legal theory shall any Contributor be liable to You for damages, including any direct, indirect, special, incidental, or consequential damages of any character arising as a result of this License or out of the use or inability to use the Work.

9. Accepting Warranty or Additional Liability.
While redistributing the Work or Derivative Works thereof, You may choose to offer, and charge a fee for, acceptance of support, warranty, indemnity, or other liability obligations.`,
  "BSD 3-Clause License": `BSD 3-Clause License

Copyright (c) [year], [copyright holder]
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.`,
  "ISC License": `ISC License

Copyright (c) [year], [copyright holder]

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.`,
  "Eclipse Public License v. 2.0\nGNU General Public License version 2 with the GNU Classpath Exception\nApache Version 2.0": `This software is available under multiple licenses:

1. Eclipse Public License v. 2.0
2. GNU General Public License version 2 with the GNU Classpath Exception  
3. Apache License Version 2.0

You may choose which license applies to your use of this software.`,
};

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
      { name: "Compose Tooling Data", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Preview Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Text", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Tooling", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Unit", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose UI Util", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Unit", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "Compose Util", version: "1.9.0", license: "Apache Version 2.0" },
      { name: "ConstraintLayout for Jetpack Compose", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Core", version: "1.16.0", license: "Apache Version 2.0" },
      { name: "Core Kotlin Extensions", version: "1.16.0", license: "Apache Version 2.0" },
      { name: "CoordinatorLayout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Credentials", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Credentials Play Services Auth", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "DataStore", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DataStore Core", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DataStore Core Okio", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DataStore Preferences", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "DocumentFile", version: "1.0.1", license: "Apache Version 2.0" },
      { name: "Emoji2", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Emoji2 Views", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Emoji2 Views Helper", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "ExifInterface", version: "1.3.7", license: "Apache Version 2.0" },
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
      { name: "Fragment", version: "1.8.5", license: "Apache Version 2.0" },
      { name: "Fragment Kotlin Extensions", version: "1.6.2", license: "Apache Version 2.0" },
      { name: "Hilt Android", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Hilt Core", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Interpolator", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Lifecycle Common", version: "2.8.7", license: "Apache Version 2.0" },
      { name: "Lifecycle Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle LiveData Core", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Process", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Reactivestreams", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ReactiveStreams Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Runtime Compose", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle Service", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Compose", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle ViewModel with SavedState", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle-Common", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "Lifecycle-Common for Java 8", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "LiveData Core Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "LiveData Kotlin Extensions", version: "2.8.6", license: "Apache Version 2.0" },
      { name: "LocalBroadcastManager", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Material Components for Android", version: "1.12.0", license: "Apache Version 2.0" },
      { name: "Media", version: "1.7.0", license: "Apache Version 2.0" },
      { name: "Media3 common module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Container module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 database module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 DataSource module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 decoder module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer HLS module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 ExoPlayer module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Extractor module", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 Session", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Media3 UI", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "Navigation Common", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Common Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Compose Hilt Integration", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Navigation Fragment", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Fragment Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Hilt Extension", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Navigation Runtime", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation Runtime Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation UI", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Navigation UI Kotlin Extensions", version: "2.8.9", license: "Apache Version 2.0" },
      { name: "Paging-Common", version: "3.2.1", license: "Apache Version 2.0" },
      { name: "Paging-Common Kotlin Extensions", version: "3.2.1", license: "Apache Version 2.0" },
      { name: "Paging-Compose", version: "3.2.1", license: "Apache Version 2.0" },
      { name: "Paging-Runtime", version: "3.2.1", license: "Apache Version 2.0" },
      { name: "Paging-RXJava2", version: "3.2.1", license: "Apache Version 2.0" },
      { name: "Palette", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Preferences DataStore", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "Preferences DataStore Core", version: "1.1.3", license: "Apache Version 2.0" },
      { name: "Print", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Privacy Sandbox for Ad Services", version: "1.0.0-beta05", license: "Apache Version 2.0" },
      { name: "Profile Installer", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "ProfileInstaller", version: "1.4.1", license: "Apache Version 2.0" },
      { name: "RecyclerView", version: "1.4.0", license: "Apache Version 2.0" },
      { name: "Room Common", version: "2.6.1", license: "Apache Version 2.0" },
      { name: "Room Runtime", version: "2.6.1", license: "Apache Version 2.0" },
      { name: "Room Kotlin Extensions", version: "2.6.1", license: "Apache Version 2.0" },
      { name: "Saved State", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Saved State Compose", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "SavedState", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "SavedState Kotlin Extensions", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Security Crypto", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "SlidingPaneLayout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "SplashScreen", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "SQLite", version: "2.4.0", license: "Apache Version 2.0" },
      { name: "SQLite Framework Integration", version: "2.4.0", license: "Apache Version 2.0" },
      { name: "SQLite Kotlin Extensions", version: "2.4.0", license: "Apache Version 2.0" },
      { name: "Sqlite Framework", version: "2.5.0", license: "Apache Version 2.0" },
      { name: "Startup Runtime", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Support AnimatedVectorDrawable", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Support Async Layout Inflater", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support CardView v7", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Coordinator Layout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Support core UI", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support core utils", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Cursor Adapter", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Custom View", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Support Document File", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Drawer Layout", version: "1.1.1", license: "Apache Version 2.0" },
      { name: "Support DynamicAnimation", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support ExifInterface", version: "1.3.6", license: "Apache Version 2.0" },
      { name: "Support fragment", version: "1.6.2", license: "Apache Version 2.0" },
      { name: "Support Grid Layout", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Interpolators", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support loader", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Support Local Broadcast Manager", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Support media compat", version: "1.6.0", license: "Apache Version 2.0" },
      { name: "Support Palette v7", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Print", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support Sliding Pane Layout", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "Support v4", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "Support VectorDrawable", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Support View Pager", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "SwipeRefreshLayout", version: "1.1.0", license: "Apache Version 2.0" },
      { name: "Tracing", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Tracing Kotlin Extensions", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Transition", version: "1.5.0", license: "Apache Version 2.0" },
      { name: "Transition Kotlin Extensions", version: "1.5.1", license: "Apache Version 2.0" },
      { name: "VectorDrawable", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "VectorDrawable Animated", version: "1.2.0", license: "Apache Version 2.0" },
      { name: "VersionedParcelable", version: "1.1.1", license: "Apache Version 2.0" },
      { name: "ViewPager", version: "1.0.0", license: "Apache Version 2.0" },
      { name: "ViewPager2", version: "1.1.0-beta02", license: "Apache Version 2.0" },
      { name: "WebKit", version: "1.12.1", license: "Apache Version 2.0" },
      { name: "Window", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Window Extensions", version: "1.3.0", license: "Apache Version 2.0" },
      { name: "Work Manager", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "Work Manager Kotlin Extensions", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "Work Manager Runtime Kotlin Extensions", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "WorkManager Kotlin Extensions", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "WorkManager Runtime", version: "2.10.0", license: "Apache Version 2.0" },
      { name: "WorkManager RxJava2", version: "2.10.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Ben Christensen",
    items: [
      { name: "rxkotlin", version: "2.3.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Branch Metrics",
    items: [
      { name: "Branch Android SDK", version: "5.20.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Braze",
    items: [
      { name: "Braze Android SDK", version: "28.0.0", license: "MIT License" },
      { name: "Braze Content Cards UI", version: "28.0.0", license: "MIT License" },
    ]
  },
  {
    author: "Bump Technologies",
    items: [
      { name: "Glide", version: "4.16.0", license: "BSD 3-Clause License" },
      { name: "Glide Compose", version: "4.16.0", license: "BSD 3-Clause License" },
      { name: "Glide Disk LRU Cache", version: "4.16.0", license: "BSD 3-Clause License" },
      { name: "Glide GIF Decoder", version: "4.16.0", license: "BSD 3-Clause License" },
    ]
  },
  {
    author: "Cash App",
    items: [
      { name: "paging-common", version: "3.1.1-0.3.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "CashApp",
    items: [
      { name: "wire-runtime", version: "5.3.5", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Chris Banes",
    items: [
      { name: "Insetter", version: "0.6.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Cloudinary",
    items: [
      { name: "cloudinary_java", version: "1.32.2", license: "MIT License" },
    ]
  },
  {
    author: "Codehaus",
    items: [
      { name: "Moshi", version: "1.15.0", license: "Apache Version 2.0" },
      { name: "Moshi Kotlin", version: "1.15.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "David Karnok",
    items: [
      { name: "RxJava", version: "2.2.21", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Facebook",
    items: [
      { name: "Fresco", version: "3.1.3", license: "MIT License" },
      { name: "Shimmer", version: "0.5.0", license: "BSD 3-Clause License" },
      { name: "SoLoader", version: "0.10.5", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Google",
    items: [
      { name: "Accompanist Permissions", version: "0.34.0", license: "Apache Version 2.0" },
      { name: "Accompanist System UI Controller", version: "0.34.0", license: "Apache Version 2.0" },
      { name: "Accompanist WebView", version: "0.34.0", license: "Apache Version 2.0" },
      { name: "Auto Service Annotations", version: "1.1.1", license: "Apache Version 2.0" },
      { name: "Dagger", version: "2.51.1", license: "Apache Version 2.0" },
      { name: "Error Prone Annotations", version: "2.28.0", license: "Apache Version 2.0" },
      { name: "flexbox-layout", version: "3.0.0", license: "Apache Version 2.0" },
      { name: "Google Auth Library for Java", version: "1.24.0", license: "BSD 3-Clause License" },
      { name: "Google Play In-App Review", version: "2.0.1", license: "Apache Version 2.0" },
      { name: "Google Play In-App Update", version: "2.1.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Auth", version: "21.0.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Auth API Phone", version: "18.0.2", license: "Apache Version 2.0" },
      { name: "Google Play Services Base", version: "18.3.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Basement", version: "18.3.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Identity", version: "18.0.1", license: "Apache Version 2.0" },
      { name: "Google Play Services Location", version: "21.2.0", license: "Apache Version 2.0" },
      { name: "Google Play Services Maps", version: "18.2.0", license: "Apache Version 2.0" },
      { name: "Gson", version: "2.10.1", license: "Apache Version 2.0" },
      { name: "Guava", version: "33.0.0-android", license: "Apache Version 2.0" },
      { name: "J2ObjC Annotations", version: "2.8", license: "Apache Version 2.0" },
      { name: "libphonenumber", version: "8.13.35", license: "Apache Version 2.0" },
      { name: "ML Kit Barcode Scanning", version: "17.2.0", license: "Apache Version 2.0" },
      { name: "Protocol Buffers", version: "3.25.3", license: "BSD 3-Clause License" },
      { name: "zxing", version: "3.5.3", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Jetbrains",
    items: [
      { name: "Kotlin Coroutines Android", version: "1.8.0", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Core", version: "1.8.0", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines Reactive", version: "1.8.0", license: "Apache Version 2.0" },
      { name: "Kotlin Coroutines RxJava2", version: "1.8.0", license: "Apache Version 2.0" },
      { name: "Kotlin Standard Library", version: "1.9.23", license: "Apache Version 2.0" },
      { name: "Kotlin Standard Library Common", version: "1.9.23", license: "Apache Version 2.0" },
      { name: "Kotlin Standard Library JDK7", version: "1.9.23", license: "Apache Version 2.0" },
      { name: "Kotlin Standard Library JDK8", version: "1.9.23", license: "Apache Version 2.0" },
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
    author: "OkHttp",
    items: [
      { name: "OkHttp", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkHttp Logging Interceptor", version: "4.12.0", license: "Apache Version 2.0" },
      { name: "OkIO", version: "3.9.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Realm",
    items: [
      { name: "Realm Database", version: "10.18.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "ReactiveX",
    items: [
      { name: "RxAndroid", version: "3.0.2", license: "Apache Version 2.0" },
      { name: "RxJava", version: "3.1.8", license: "Apache Version 2.0" },
      { name: "RxKotlin", version: "3.0.1", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Retrofit",
    items: [
      { name: "Retrofit", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Gson", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit Converter Moshi", version: "2.11.0", license: "Apache Version 2.0" },
      { name: "Retrofit RxJava3 Adapter", version: "2.11.0", license: "Apache Version 2.0" },
    ]
  },
  {
    author: "Segment",
    items: [
      { name: "Analytics-Android", version: "4.11.3", license: "MIT License" },
    ]
  },
  {
    author: "Stripe",
    items: [
      { name: "Stripe Android SDK", version: "20.38.0", license: "MIT License" },
      { name: "Stripe Identity", version: "20.38.0", license: "MIT License" },
    ]
  },
  {
    author: "Timber",
    items: [
      { name: "Timber", version: "5.0.1", license: "Apache Version 2.0" },
    ]
  },
];

type SortOption = 'author' | 'alphabetical' | 'license';

export default function Licenses() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('author');
  const [licenseFilter, setLicenseFilter] = useState<string>('all');
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle scroll for Back to Top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      // Escape to close search or clear search query
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery("");
        } else if (showSearch) {
          setShowSearch(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, searchQuery]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const copyToClipboard = async (text: string, itemKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(itemKey));
      toast.success("License text copied to clipboard!");
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Get unique license types for filter dropdown
  const licenseTypes = useMemo(() => {
    const types = new Set<string>();
    licensesData.forEach(group => {
      group.items.forEach(item => {
        if (item.license) {
          // Get the primary license type
          const primaryLicense = item.license.split('\n')[0].trim();
          types.add(primaryLicense);
        }
      });
    });
    return Array.from(types).sort();
  }, []);

  // Filter and sort data
  const processedData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    // First filter by search and license type
    let filteredGroups: LicenseGroup[] = licensesData.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const matchesSearch = !query || 
          item.name.toLowerCase().includes(query) ||
          item.license.toLowerCase().includes(query) ||
          item.version.toLowerCase().includes(query) ||
          (group.author && group.author.toLowerCase().includes(query));
        
        const matchesLicense = licenseFilter === 'all' || 
          item.license.toLowerCase().includes(licenseFilter.toLowerCase());
        
        return matchesSearch && matchesLicense;
      })
    })).filter(group => group.items.length > 0);

    // Then apply sorting
    if (sortBy === 'alphabetical') {
      // Flatten all items and sort alphabetically
      const allItems = filteredGroups.flatMap(g => 
        g.items.map(item => ({ ...item, author: g.author }))
      );
      allItems.sort((a, b) => a.name.localeCompare(b.name));
      
      // Group by first letter
      const letterGroups = new Map<string, LicenseItem[]>();
      allItems.forEach(item => {
        const letter = item.name[0].toUpperCase();
        if (!letterGroups.has(letter)) {
          letterGroups.set(letter, []);
        }
        letterGroups.get(letter)!.push(item);
      });
      
      return Array.from(letterGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, items]) => ({
          author: letter,
          items
        }));
    } else if (sortBy === 'license') {
      // Group by license type
      const licenseGroups = new Map<string, LicenseItem[]>();
      filteredGroups.forEach(group => {
        group.items.forEach(item => {
          const primaryLicense = item.license.split('\n')[0].trim() || 'No License';
          if (!licenseGroups.has(primaryLicense)) {
            licenseGroups.set(primaryLicense, []);
          }
          licenseGroups.get(primaryLicense)!.push(item);
        });
      });
      
      return Array.from(licenseGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([license, items]) => ({
          author: license,
          items: items.sort((a, b) => a.name.localeCompare(b.name))
        }));
    }
    
    // Default: sort by author
    return filteredGroups.sort((a, b) => {
      const authorA = a.author || '';
      const authorB = b.author || '';
      return authorA.localeCompare(authorB);
    });
  }, [searchQuery, sortBy, licenseFilter]);

  const totalResults = processedData.reduce((sum, group) => sum + group.items.length, 0);

  // Generate all item keys for expand/collapse all functionality
  const allItemKeys = useMemo(() => {
    const keys: string[] = [];
    processedData.forEach((group, groupIndex) => {
      group.items.forEach((item, itemIndex) => {
        keys.push(`${groupIndex}-${itemIndex}-${item.name}`);
      });
    });
    return keys;
  }, [processedData]);

  const allExpanded = allItemKeys.length > 0 && allItemKeys.every(key => expandedItems.has(key));

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedItems(new Set(allItemKeys));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  const getLicenseText = (license: string): string => {
    // Check for exact match first
    if (licenseTexts[license]) {
      return licenseTexts[license];
    }
    // Check for primary license
    const primaryLicense = license.split('\n')[0].trim();
    if (licenseTexts[primaryLicense]) {
      return licenseTexts[primaryLicense];
    }
    return `Full license text for "${license}" is available from the respective project repository.`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="text-primary-foreground p-1 -ml-1"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-primary-foreground text-xl font-semibold">Licenses</h1>
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className="text-primary-foreground p-1 -mr-1"
          >
            {showSearch ? <X className="w-6 h-6" /> : <Search className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Search Input */}
        {showSearch && (
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search libraries, licenses... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/95 border-0 text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter & Sort Controls */}
      <div className="px-4 py-3 bg-muted/30 border-b flex flex-wrap gap-2 items-center">
        {/* Sort By */}
        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="author">
                <div className="flex items-center gap-2">
                  <List className="w-3 h-3" />
                  By Author
                </div>
              </SelectItem>
              <SelectItem value="alphabetical">
                <div className="flex items-center gap-2">
                  <SortAsc className="w-3 h-3" />
                  A-Z
                </div>
              </SelectItem>
              <SelectItem value="license">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-3 h-3" />
                  By License
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* License Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={licenseFilter} onValueChange={setLicenseFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
              <SelectValue placeholder="Filter license" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50 max-h-[300px]">
              <SelectItem value="all">All Licenses</SelectItem>
              {licenseTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
        </Select>
        </div>

        {/* Expand/Collapse All Button */}
        {totalResults > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                Collapse All
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                Expand All
              </>
            )}
          </Button>
        )}

        {/* Results count */}
        <div className="ml-auto">
          <p className="text-xs text-muted-foreground">
            {totalResults} {totalResults === 1 ? 'library' : 'libraries'}
          </p>
        </div>
      </div>

      {/* License List */}
      <div className="pb-20">
        {processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No licenses found {searchQuery && `matching "${searchQuery}"`}
              {licenseFilter !== 'all' && ` with license type "${licenseFilter}"`}
            </p>
          </div>
        ) : (
          processedData.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Author/Organization/Category Header */}
              {group.author && (
                <div className="px-4 py-3 bg-muted/30 sticky top-[60px] z-[5]">
                  <h2 className="text-muted-foreground font-bold text-sm uppercase tracking-wide">
                    {group.author}
                  </h2>
                </div>
              )}

              {/* License Items */}
              {group.items.map((item, itemIndex) => {
                const itemKey = `${groupIndex}-${itemIndex}-${item.name}`;
                const isExpanded = expandedItems.has(itemKey);
                
                return (
                  <Collapsible
                    key={itemKey}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(itemKey)}
                  >
                    <div className="bg-card border-l-4 border-l-primary/30 mx-3 mb-1.5 rounded-md shadow-sm overflow-hidden">
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="px-4 py-3">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="text-foreground font-medium text-sm flex-1 pr-4 leading-tight">
                              {item.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs font-medium whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded">
                                {item.version}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          {item.license && (
                            <p className="text-primary text-xs whitespace-pre-line font-medium">
                              {item.license}
                            </p>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 border-t border-muted/50">
                          <div className="bg-muted/20 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                License Text
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(getLicenseText(item.license), itemKey);
                                }}
                              >
                                {copiedItems.has(itemKey) ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-green-500">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                              {getLicenseText(item.license)}
                            </pre>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Back to Top Floating Button */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 p-0"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
