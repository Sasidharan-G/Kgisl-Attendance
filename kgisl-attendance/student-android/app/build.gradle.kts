import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

// Release signing: keystore.properties (git-ignored) next to settings.gradle.kts, see README.
val signingProps = Properties().apply {
  val file = rootProject.file("keystore.properties")
  if (file.exists()) file.inputStream().use { load(it) }
}

android {
  namespace = "edu.kgisl.attendance"
  compileSdk = 36

  defaultConfig {
    applicationId = "in.ac.kgisl.attendance"
    minSdk = 26
    targetSdk = 35
    versionCode = 3
    versionName = "1.1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    // Prototype manufacturer ID shared with the ESP32 firmware. Replace with a
    // lawfully assigned identifier before commercial distribution.
    buildConfigField("int", "BEACON_MANUFACTURER_ID", "0xFFFF")
    // Production API origin; override with -PapiBaseUrl=https://... when building.
    val apiBaseUrl = (project.findProperty("apiBaseUrl") as String?) ?: "https://kgisl-attendance.onrender.com"
    buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
  }

  signingConfigs {
    if (signingProps.getProperty("storeFile") != null) {
      create("release") {
        storeFile = rootProject.file(signingProps.getProperty("storeFile"))
        storePassword = signingProps.getProperty("storePassword")
        keyAlias = signingProps.getProperty("keyAlias")
        keyPassword = signingProps.getProperty("keyPassword")
      }
    }
  }

  buildTypes {
    release {
      // No R8: EncryptedSharedPreferences (Tink) and OkHttp rely on reflection, and a college app
      // gains little from obfuscation versus the risk of a release-only crash.
      isMinifyEnabled = false
      signingConfig = signingConfigs.findByName("release")
    }
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
