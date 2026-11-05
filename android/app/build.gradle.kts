plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The address the shell opens.
//
// Passed in by the Actions workflow (-PappUrl=https://…) so the same commit can
// produce a build for a Vercel preview URL, a custom domain, or a local tunnel
// without editing a resource. The default is the production admin host.
val appUrl: String = (project.findProperty("appUrl") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: "https://admin.mzazi.shop"

// Shown in Settings → Apps. A release build says which panel it targets, which
// matters the moment there is more than one (production, staging, a preview).
val appVersionName: String = (project.findProperty("versionName") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: "1.0.0"

android {
    namespace = "shop.mzazi.admin"
    compileSdk = 34

    defaultConfig {
        applicationId = "shop.mzazi.admin"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = appVersionName

        // Quoted once here so the generated BuildConfig constant is a Java
        // string literal, not a bare identifier.
        buildConfigField("String", "START_URL", "\"$appUrl\"")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
}
