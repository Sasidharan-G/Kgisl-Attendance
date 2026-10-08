plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "edu.kgisl.attendance"
  compileSdk = 36

  defaultConfig {
    applicationId = "in.ac.kgisl.attendance"
    minSdk = 26
    targetSdk = 35
    versionCode = 2
    versionName = "1.0.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    // Prototype manufacturer ID shared with the ESP32 firmware. Replace with a
    // lawfully assigned identifier before commercial distribution.
    buildConfigField("int", "BEACON_MANUFACTURER_ID", "0xFFFF")
    // Production API origin; override with -PapiBaseUrl=https://... when building.
    val apiBaseUrl = (project.findProperty("apiBaseUrl") as String?) ?: "https://kgisl-attendance.onrender.com"
    buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
  }

  buildFeatures { buildConfig = true; viewBinding = true }
  compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
  kotlinOptions { jvmTarget = "17" }
}

dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.fragment:fragment-ktx:1.8.5")
  implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("com.google.android.gms:play-services-location:21.3.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.journeyapps:zxing-android-embedded:4.3.0")
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.json:json:20240303")
}
