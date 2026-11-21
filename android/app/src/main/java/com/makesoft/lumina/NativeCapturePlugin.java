package com.makesoft.lumina;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Settings;
import android.provider.Telephony;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Sideload / debug native capture:
 * - READ_SMS inbox query (honest Play-policy note in README)
 * - Consume ACTION_SEND / SEND_MULTIPLE share payloads (text + audio)
 *
 * Not a silent no-op: methods return explicit unavailable / denied status.
 */
@CapacitorPlugin(
    name = "NativeCapture",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.READ_SMS }
        )
    }
)
public class NativeCapturePlugin extends Plugin {

    private static String pendingShareText = null;
    private static String pendingShareMime = null;
    private static String pendingShareAudioBase64 = null;
    private static String pendingShareAudioName = null;
    private static String pendingShareAudioMime = null;

    /** Called from MainActivity when a share intent arrives. */
    public static void stashShareIntent(Intent intent, ContentResolver resolver) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null && text.length() > 0) {
                pendingShareText = text.toString();
                pendingShareMime = intent.getType() != null ? intent.getType() : "text/plain";
            }

            Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream == null && Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                ArrayList<Uri> many = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (many != null && !many.isEmpty()) {
                    stream = many.get(0);
                }
            }
            if (stream != null) {
                String type = intent.getType();
                if (type == null) {
                    type = resolver.getType(stream);
                }
                if (type != null && type.startsWith("audio/")) {
                    try {
                        InputStream in = resolver.openInputStream(stream);
                        if (in != null) {
                            ByteArrayOutputStream bos = new ByteArrayOutputStream();
                            byte[] buf = new byte[8192];
                            int n;
                            int total = 0;
                            final int max = 10 * 1024 * 1024;
                            while ((n = in.read(buf)) > 0) {
                                total += n;
                                if (total > max) break;
                                bos.write(buf, 0, n);
                            }
                            in.close();
                            pendingShareAudioBase64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                            pendingShareAudioMime = type;
                            String name = stream.getLastPathSegment();
                            pendingShareAudioName = name != null ? name : "shared-audio";
                        }
                    } catch (Exception ignored) {
                        /* leave audio null — JS gets honest empty */
                    }
                } else if (pendingShareText == null && type != null && type.startsWith("text/")) {
                    try {
                        InputStream in = resolver.openInputStream(stream);
                        if (in != null) {
                            ByteArrayOutputStream bos = new ByteArrayOutputStream();
                            byte[] buf = new byte[4096];
                            int n;
                            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                            in.close();
                            pendingShareText = bos.toString("UTF-8");
                            pendingShareMime = type;
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        }
    }

    /** Always lowercase granted/denied/prompt for JS comparisons. */
    private static String smsStateString(PermissionState state) {
        if (state == null) return "prompt";
        return state.toString().toLowerCase(Locale.ROOT);
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        ret.put("smsReadable", true);
        ret.put("shareTarget", true);
        ret.put("voicemailOem", false);
        ret.put("playPolicyNote",
            "READ_SMS may be rejected by Play; sideload/debug path works. Prefer Notification Listener or user-granted SMS later.");
        call.resolve(ret);
    }

    @PluginMethod
    public void checkSmsPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("sms", smsStateString(getPermissionState("sms")));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("sms", "granted");
            call.resolve(ret);
            return;
        }
        // Permanent deny: system dialog may not show — still resolve via callback.
        requestPermissionForAlias("sms", call, "smsPermCallback");
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("sms", smsStateString(getPermissionState("sms")));
        call.resolve(ret);
    }

    /**
     * Opens system App Info for LUMINA so the user can re-enable SMS after a
     * permanent deny (Don't ask again).
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put(
                "error",
                e.getMessage() != null ? e.getMessage() : "Could not open app settings."
            );
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void readRecentSms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            JSObject denied = new JSObject();
            denied.put("ok", false);
            denied.put("error", "sms_permission_denied");
            denied.put("hint", "Grant SMS permission, or paste/share a thread instead.");
            denied.put("messages", new JSArray());
            denied.put("count", 0);
            call.resolve(denied);
            return;
        }

        int max = call.getInt("max", 200);
        if (max < 1) max = 1;
        if (max > 300) max = 300;
        int days = call.getInt("days", 30);
        if (days < 1) days = 1;
        if (days > 90) days = 90;
        long since = System.currentTimeMillis() - (days * 24L * 60L * 60L * 1000L);

        List<JSObject> rows = new ArrayList<>();
        ContentResolver cr = getContext().getContentResolver();
        String[] projection = new String[] {
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE
        };
        String selection = Telephony.Sms.DATE + ">=?";
        String[] args = new String[] { String.valueOf(since) };
        try (Cursor cursor = cr.query(
            Telephony.Sms.CONTENT_URI,
            projection,
            selection,
            args,
            Telephony.Sms.DATE + " DESC"
        )) {
            if (cursor != null) {
                int addressIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                int bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY);
                int dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE);
                int typeIdx = cursor.getColumnIndex(Telephony.Sms.TYPE);
                while (cursor.moveToNext() && rows.size() < max) {
                    String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : null;
                    if (body == null || body.trim().isEmpty()) continue;
                    JSObject row = new JSObject();
                    row.put("address", addressIdx >= 0 ? nullToEmpty(cursor.getString(addressIdx)) : "");
                    row.put("body", body);
                    row.put("date", dateIdx >= 0 ? cursor.getLong(dateIdx) : 0L);
                    row.put("type", typeIdx >= 0 ? cursor.getInt(typeIdx) : 0);
                    rows.add(row);
                }
            }
        } catch (SecurityException se) {
            JSObject denied = new JSObject();
            denied.put("ok", false);
            denied.put("error", "sms_permission_denied");
            denied.put("hint", "SMS permission was revoked — grant again or paste a thread.");
            denied.put("messages", new JSArray());
            denied.put("count", 0);
            call.resolve(denied);
            return;
        } catch (Exception e) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", "sms_read_failed");
            err.put("hint", e.getMessage() != null ? e.getMessage() : "Could not read SMS inbox.");
            err.put("messages", new JSArray());
            err.put("count", 0);
            call.resolve(err);
            return;
        }

        JSArray arr = new JSArray();
        for (JSObject row : rows) arr.put(row);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("messages", arr);
        ret.put("count", rows.size());
        call.resolve(ret);
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    @PluginMethod
    public void consumeSharedPayload(PluginCall call) {
        JSObject ret = new JSObject();
        boolean has =
            pendingShareText != null ||
            pendingShareAudioBase64 != null;
        ret.put("ok", true);
        ret.put("hasPayload", has);
        if (pendingShareText != null) {
            ret.put("text", pendingShareText);
            ret.put("mime", pendingShareMime != null ? pendingShareMime : "text/plain");
        }
        if (pendingShareAudioBase64 != null) {
            ret.put("audioBase64", pendingShareAudioBase64);
            ret.put("audioName", pendingShareAudioName);
            ret.put("audioMime", pendingShareAudioMime);
        }
        // One-shot — clear after handoff to JS.
        pendingShareText = null;
        pendingShareMime = null;
        pendingShareAudioBase64 = null;
        pendingShareAudioName = null;
        pendingShareAudioMime = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void getVoicemailStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("oemAvailable", false);
        ret.put("hint",
            "OEM visual voicemail APIs are fragmented — share audio into LUMINA or paste a transcript. Whisper STT runs when Google is connected.");
        call.resolve(ret);
    }
}
