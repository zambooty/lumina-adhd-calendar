package com.makesoft.lumina;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

/**
 * Home-screen companion widget — stage / spark snapshot from WidgetSync.
 */
public class PetWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(
        Context context,
        AppWidgetManager appWidgetManager,
        int[] appWidgetIds
    ) {
        updateAll(context, appWidgetManager, appWidgetIds);
    }

    static void updateAll(
        Context context,
        AppWidgetManager mgr,
        int[] appWidgetIds
    ) {
        SharedPreferences prefs =
            context.getSharedPreferences(
                WidgetSyncPlugin.PREFS,
                Context.MODE_PRIVATE
            );
        String title = prefs.getString(WidgetSyncPlugin.KEY_PET_TITLE, "Blink");
        String sub =
            prefs.getString(
                WidgetSyncPlugin.KEY_PET_SUB,
                "Open LUMINA · grow with pulls"
            );
        String accentHex =
            prefs.getString(WidgetSyncPlugin.KEY_PET_ACCENT, "#3dffd4");
        int accent = Color.parseColor("#3dffd4");
        try {
            accent = Color.parseColor(accentHex);
        } catch (IllegalArgumentException ignored) {
            /* keep default */
        }

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        PendingIntent pi =
            PendingIntent.getActivity(
                context,
                11,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

        for (int id : appWidgetIds) {
            RemoteViews views =
                new RemoteViews(context.getPackageName(), R.layout.widget_pet);
            views.setTextViewText(R.id.widget_pet_title, title);
            views.setTextViewText(R.id.widget_pet_sub, sub);
            views.setTextColor(R.id.widget_pet_title, accent);
            views.setOnClickPendingIntent(R.id.widget_pet_root, pi);
            mgr.updateAppWidget(id, views);
        }
    }
}
