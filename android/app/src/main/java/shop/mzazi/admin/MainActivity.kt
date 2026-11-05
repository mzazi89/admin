package shop.mzazi.admin

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import shop.mzazi.admin.databinding.ActivityMainBinding

/**
 * Thin, deliberately dumb shell around the admin panel.
 *
 * The panel is a Next.js app that ships continuously; anything implemented here
 * would be a second copy of the UI that drifts within a week. So this class does
 * only what a browser tab cannot: a launch icon, a back gesture that walks the
 * page history, file chooser support for uploads, download handling, and an
 * offline screen instead of Chromium's grey error page.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    /** Host the shell is allowed to navigate to in-app. */
    private val startHost: String by lazy { Uri.parse(BuildConfig.START_URL).host ?: "" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configureWebView()
        wireBackNavigation()

        binding.retry.setOnClickListener {
            binding.errorPanel.visibility = View.GONE
            binding.web.visibility = View.VISIBLE
            binding.web.loadUrl(BuildConfig.START_URL)
        }

        if (savedInstanceState == null) {
            binding.web.loadUrl(BuildConfig.START_URL)
        } else {
            binding.web.restoreState(savedInstanceState)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val web = binding.web
        val settings: WebSettings = web.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        // The panel renders at its own breakpoints; letting the WebView pick a
        // font scale from the system setting makes the tables unreadable.
        settings.textZoom = 100

        // Nothing is loaded from the filesystem or resolved through a content
        // provider — the panel is served entirely over HTTPS.
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setGeolocationEnabled(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = settings.userAgentString + " MzaziAdminApp/1.0"

        // The admin session cookie lives in the WebView jar; accepting cookies
        // is what keeps the operator signed in between launches.
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url
                val scheme = url.scheme ?: return true

                // Phone, mail and WhatsApp links belong to other apps, not here.
                if (scheme != "http" && scheme != "https") {
                    openExternally(url)
                    return true
                }
                // A different host is a different product — open the real
                // browser so the operator keeps their panel session intact.
                if (url.host != startHost) {
                    openExternally(url)
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView, url: String) {
                binding.refresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                // Only the main document counts: a blocked font or a failed
                // analytics pixel must not replace a working page with an
                // error screen.
                if (!request.isForMainFrame) return
                binding.refresh.isRefreshing = false
                binding.errorText.text = error.description
                binding.errorPanel.visibility = View.VISIBLE
                binding.web.visibility = View.INVISIBLE
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    startActivityForResult(
                        Intent.createChooser(params.createIntent(), "Select file"),
                        REQUEST_FILE
                    )
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    Toast.makeText(
                        this@MainActivity,
                        "No file manager available",
                        Toast.LENGTH_SHORT
                    ).show()
                    false
                }
            }
        }

        web.setDownloadListener(
            DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                // Session-authenticated files (exports, invoices) need the
                // cookies attached or they download as a login page.
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                    setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    // App-private Downloads: writing to the shared Downloads
                    // folder needs WRITE_EXTERNAL_STORAGE below API 29, which
                    // would mean asking for a storage permission just to save
                    // an invoice.
                    setDestinationInExternalFilesDir(
                        this@MainActivity,
                        android.os.Environment.DIRECTORY_DOWNLOADS,
                        android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
                    )
                }
                val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                manager.enqueue(request)
                Toast.makeText(this@MainActivity, "Downloading…", Toast.LENGTH_SHORT).show()
            }
        )

        binding.refresh.setOnRefreshListener {
            binding.web.reload()
        }
    }

    private fun wireBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.web.canGoBack()) {
                    binding.web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("WebView file chooser uses the activity result contract with no successor on this path")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_FILE) {
            filePathCallback?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            )
            filePathCallback = null
            return
        }
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.web.saveState(outState)
    }

    override fun onPause() {
        // Persist the session cookie now: the process can be killed from the
        // background without another callback.
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        binding.web.destroy()
        super.onDestroy()
    }

    private companion object {
        const val REQUEST_FILE = 1001
    }
}
