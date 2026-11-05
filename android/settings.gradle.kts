pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

// The shell that wraps the admin panel. Kept in the same repository as the
// panel so a change to the panel and the shell that shows it are one commit
// and one Actions run.
rootProject.name = "MzaziAdmin"
include(":app")
