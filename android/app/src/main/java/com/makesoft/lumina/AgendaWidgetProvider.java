package com.makesoft.lumina;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Home-screen agenda widget — upcoming events + daily todos from WidgetSync.
 */
public class AgendaWidgetProvider extends AppWidgetProvider {

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
        String title =
            prefs.getString(WidgetSyncPlugin.KEY_AGENDA_TITLE, "Upcoming · today");
        String lines =
            prefs.getString(
                WidgetSyncPlugin.KEY_AGENDA_LINES,
                "Nothing queued · open LUMINA"
            );

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        PendingIntent pi =
            PendingIntent.getActivity(
                context,
                12,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

        for (int id : appWidgetIds) {
            RemoteViews views =
                new RemoteViews(
                    context.getPackageName(),
                    R.layout.widget_agenda
                );
            views.setTextViewText(R.id.widget_agenda_title, title);
            views.setTextViewText(R.id.widget_agenda_lines, lines);
            views.setOnClickPendingIntent(R.id.widget_agenda_root, pi);
            mgr.updateAppWidget(id, views);
        }
    }
}
