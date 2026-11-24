package com.makesoft.lumina;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

/**
 * Receives pet + agenda snapshots from the web layer and refreshes
 * home-screen widgets (SharedPreferences-backed).
 */
@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    public static final String PREFS = "lumina_widgets";
    public static final String KEY_PET_TITLE = "pet_title";
    public static final String KEY_PET_SUB = "pet_subtitle";
    public static final String KEY_PET_ACCENT = "pet_accent";
    public static final String KEY_AGENDA_TITLE = "agenda_title";
    public static final String KEY_AGENDA_LINES = "agenda_lines";

    @PluginMethod
    public void updateWidgets(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor ed =
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();

        String petTitle = call.getString("petTitle", "Blink");
        String petSub = call.getString("petSubtitle", "Companion");
        String petAccent = call.getString("petAccent", "#3dffd4");
        String agendaTitle = call.getString("agendaTitle", "Upcoming · today");

        ed.putString(KEY_PET_TITLE, petTitle);
        ed.putString(KEY_PET_SUB, petSub);
        ed.putString(KEY_PET_ACCENT, petAccent);
        ed.putString(KEY_AGENDA_TITLE, agendaTitle);

        StringBuilder lines = new StringBuilder();
        JSArray arr = call.getArray("agendaLines");
        if (arr != null) {
            try {
                for (int i = 0; i < arr.length(); i++) {
                    Object v = arr.get(i);
                    if (v == null) continue;
                    if (lines.length() > 0) lines.append('\n');
                    lines.append(String.valueOf(v));
                }
            } catch (JSONException ignored) {
                /* keep whatever we have */
            }
        }
        ed.putString(KEY_AGENDA_LINES, lines.toString());
        ed.apply();

        refreshAll(ctx);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] petIds =
            mgr.getAppWidgetIds(new ComponentName(ctx, PetWidgetProvider.class));
        if (petIds.length > 0) {
            PetWidgetProvider.updateAll(ctx, mgr, petIds);
        }
        int[] agendaIds =
            mgr.getAppWidgetIds(new ComponentName(ctx, AgendaWidgetProvider.class));
        if (agendaIds.length > 0) {
            AgendaWidgetProvider.updateAll(ctx, mgr, agendaIds);
        }
    }
}
