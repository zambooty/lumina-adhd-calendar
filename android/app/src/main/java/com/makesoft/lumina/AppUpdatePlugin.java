package com.makesoft.lumina;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sideload / debug in-app updates:
 * check installed version → download APK → open system installer
 * (REQUEST_INSTALL_PACKAGES / unknown-apps settings).
 *
 * Same signing key required for in-place upgrade (debug keystore or release).
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final int MAX_APK_BYTES = 80 * 1024 * 1024;
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            PackageInfo info =
                Build.VERSION.SDK_INT >= 33
                    ? pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
                    : pm.getPackageInfo(pkg, 0);
            long code =
                Build.VERSION.SDK_INT >= 28
                    ? info.getLongVersionCode()
                    : info.versionCode;
            ret.put("ok", true);
            ret.put("applicationId", pkg);
            ret.put("versionName", info.versionName != null ? info.versionName : "");
            ret.put("versionCode", code);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put(
                "error",
                e.getMessage() != null ? e.getMessage() : "version_lookup_failed"
            );
            ret.put("applicationId", getContext().getPackageName());
            ret.put("versionName", "");
            ret.put("versionCode", 0);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        ret.put("ok", true);
        ret.put("allowed", allowed);
        ret.put("needsSettings", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(
                    Uri.parse("package:" + getContext().getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put(
                "error",
                e.getMessage() != null ? e.getMessage() : "settings_open_failed"
            );
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "missing_url");
            err.put("hint", "No APK download URL.");
            call.resolve(err);
            return;
        }
        if (!url.startsWith("https://")) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "insecure_url");
            err.put("hint", "APK URL must be https.");
            call.resolve(err);
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "download_in_progress");
            err.put("hint", "An update download is already running.");
            call.resolve(err);
            return;
        }

        final String downloadUrl = url.trim();
        final String fileName = call.getString("fileName", "lumina-update.apk");
        call.setKeepAlive(true);

        EXEC.execute(() -> {
            File outFile = null;
            HttpURLConnection conn = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) {
                    fail(call, "cache_dir_failed", "Could not create update cache.");
                    return;
                }
                outFile = new File(dir, sanitizeFileName(fileName));
                if (outFile.exists() && !outFile.delete()) {
                    /* overwrite via stream */
                }

                URL target = new URL(downloadUrl);
                conn = (HttpURLConnection) target.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(30_000);
                conn.setReadTimeout(120_000);
                conn.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
                conn.setRequestProperty("User-Agent", "LUMINA-AppUpdate/1");
                conn.connect();

                int code = conn.getResponseCode();
                // Follow one manual redirect hop if needed (some hosts).
                if (code >= 300 && code < 400) {
                    String loc = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (loc == null || loc.isEmpty()) {
                        fail(call, "redirect_missing", "Download redirected without Location.");
                        return;
                    }
                    conn = (HttpURLConnection) new URL(loc).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(30_000);
                    conn.setReadTimeout(120_000);
                    conn.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
                    conn.setRequestProperty("User-Agent", "LUMINA-AppUpdate/1");
                    conn.connect();
                    code = conn.getResponseCode();
                }

                if (code == 401 || code == 403 || code == 404) {
                    fail(
                        call,
                        code == 404 ? "apk_not_found" : "apk_auth_required",
                        code == 404
                            ? "APK not found — publish a GitHub Release with a .apk asset, then try again."
                            : "Download blocked — open the GitHub release in a browser, or retry later."
                    );
                    return;
                }
                if (code < 200 || code >= 300) {
                    fail(call, "download_http_" + code, "Download failed (HTTP " + code + ").");
                    return;
                }

                long contentLength = conn.getContentLengthLong();
                if (contentLength > MAX_APK_BYTES) {
                    fail(call, "apk_too_large", "APK exceeds size limit.");
                    return;
                }

                try (
                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    FileOutputStream out = new FileOutputStream(outFile)
                ) {
                    byte[] buf = new byte[16 * 1024];
                    long total = 0;
                    int n;
                    int lastPct = -1;
                    while ((n = in.read(buf)) >= 0) {
                        total += n;
                        if (total > MAX_APK_BYTES) {
                            fail(call, "apk_too_large", "APK exceeds size limit.");
                            return;
                        }
                        out.write(buf, 0, n);
                        if (contentLength > 0) {
                            int pct = (int) Math.min(100, (total * 100) / contentLength);
                            if (pct != lastPct && (pct == 100 || pct - lastPct >= 2)) {
                                lastPct = pct;
                                JSObject progress = new JSObject();
                                progress.put("percent", pct);
                                progress.put("bytes", total);
                                progress.put("total", contentLength);
                                notifyListeners("downloadProgress", progress);
                            }
                        }
                    }
                    out.flush();
                }

                if (outFile.length() < 1024) {
                    fail(call, "apk_too_small", "Downloaded file does not look like an APK.");
                    return;
                }

                JSObject install = installApkFile(outFile);
                call.resolve(install);
            } catch (Exception e) {
                fail(
                    call,
                    "download_failed",
                    e.getMessage() != null ? e.getMessage() : "Download failed."
                );
            } finally {
                if (conn != null) {
                    try {
                        conn.disconnect();
                    } catch (Exception ignored) {
                    }
                }
                downloading.set(false);
            }
        });
    }

    @PluginMethod
    public void installDownloadedApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "missing_path");
            call.resolve(err);
            return;
        }
        File file = new File(path);
        call.resolve(installApkFile(file));
    }

    private JSObject installApkFile(File apk) {
        JSObject ret = new JSObject();
        if (apk == null || !apk.isFile()) {
            ret.put("ok", false);
            ret.put("error", "apk_missing");
            ret.put("hint", "Downloaded APK missing — try again.");
            return ret;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                ret.put("ok", false);
                ret.put("error", "install_permission_required");
                ret.put(
                    "hint",
                    "Allow LUMINA to install unknown apps, then tap Install again."
                );
                ret.put("path", apk.getAbsolutePath());
                ret.put("needsSettings", true);
                return ret;
            }
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(intent);
            } else {
                getContext().startActivity(intent);
            }
            ret.put("ok", true);
            ret.put("path", apk.getAbsolutePath());
            ret.put("openedInstaller", true);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", "install_intent_failed");
            ret.put(
                "hint",
                e.getMessage() != null ? e.getMessage() : "Could not open installer."
            );
            ret.put("path", apk.getAbsolutePath());
        }
        return ret;
    }

    private void fail(PluginCall call, String error, String hint) {
        JSObject err = new JSObject();
        err.put("ok", false);
        err.put("error", error);
        err.put("hint", hint);
        call.resolve(err);
    }

    private static String sanitizeFileName(String name) {
        String base = name != null ? name : "lumina-update.apk";
        String cleaned = base.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!cleaned.toLowerCase().endsWith(".apk")) {
            cleaned = cleaned + ".apk";
        }
        if (cleaned.length() > 80) {
            cleaned = cleaned.substring(0, 76) + ".apk";
        }
        return cleaned;
    }
}
