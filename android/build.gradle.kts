// Plugin versions live here, once. These are the versions the account's other
// Android project already builds with on GitHub Actions — a known-good
// toolchain rather than a guess.
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
