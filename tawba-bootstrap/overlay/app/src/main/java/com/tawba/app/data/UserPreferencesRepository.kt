package com.tawba.app.data

import android.content.Context
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(
    name = "tawba_preferences",
    corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
)

class UserPreferencesRepository(context: Context) {
    private val appContext = context.applicationContext

    private object Keys {
        val theme = stringPreferencesKey("theme")
        val quranFont = stringPreferencesKey("quran_font")
        val textSize = floatPreferencesKey("quran_text_size")
        val bookmarks = stringPreferencesKey("bookmarks")
        val lastRead = intPreferencesKey("last_read")
    }

    val preferences: Flow<UserPreferences> = appContext.dataStore.data
        .catch { failure ->
            if (failure is IOException) emit(emptyPreferences()) else throw failure
        }
        .map { storedPreferences -> storedPreferences.toModel() }

    suspend fun setTheme(mode: AppThemeMode) {
        appContext.dataStore.edit { it[Keys.theme] = mode.name }
    }

    suspend fun setFont(font: QuranFont) {
        appContext.dataStore.edit { it[Keys.quranFont] = font.name }
    }

    suspend fun setTextSize(size: Float) {
        appContext.dataStore.edit { it[Keys.textSize] = size.coerceIn(MINIMUM_TEXT_SIZE, MAXIMUM_TEXT_SIZE) }
    }

    suspend fun setLastRead(globalId: Int) {
        if (globalId !in QuranRepository.VALID_GLOBAL_ID_RANGE) return
        appContext.dataStore.edit { it[Keys.lastRead] = globalId }
    }

    suspend fun toggleBookmark(globalId: Int) {
        if (globalId !in QuranRepository.VALID_GLOBAL_ID_RANGE) return
        appContext.dataStore.edit { preferences ->
            val ids = preferences.bookmarkIds().toMutableSet()
            if (!ids.add(globalId)) ids.remove(globalId)
            preferences[Keys.bookmarks] = ids.sorted().joinToString(",")
        }
    }

    private fun Preferences.toModel() = UserPreferences(
        theme = enumValueOrDefault(this[Keys.theme], AppThemeMode.IVORY),
        font = enumValueOrDefault(this[Keys.quranFont], QuranFont.AMIRI_QURAN),
        textSize = (this[Keys.textSize] ?: DEFAULT_TEXT_SIZE).coerceIn(MINIMUM_TEXT_SIZE, MAXIMUM_TEXT_SIZE),
        bookmarks = bookmarkIds(),
        lastReadGlobalId = this[Keys.lastRead]?.takeIf { it in QuranRepository.VALID_GLOBAL_ID_RANGE },
    )

    private fun Preferences.bookmarkIds(): Set<Int> = this[Keys.bookmarks]
        ?.split(',')
        ?.asSequence()
        ?.mapNotNull(String::toIntOrNull)
        ?.filter { it in QuranRepository.VALID_GLOBAL_ID_RANGE }
        ?.toSet()
        .orEmpty()

    private inline fun <reified T : Enum<T>> enumValueOrDefault(rawValue: String?, default: T): T =
        rawValue?.let { value -> enumValues<T>().firstOrNull { it.name == value } } ?: default

    companion object {
        const val MINIMUM_TEXT_SIZE = 22f
        const val MAXIMUM_TEXT_SIZE = 48f
        const val DEFAULT_TEXT_SIZE = 32f
    }
}

data class UserPreferences(
    val theme: AppThemeMode = AppThemeMode.IVORY,
    val font: QuranFont = QuranFont.AMIRI_QURAN,
    val textSize: Float = UserPreferencesRepository.DEFAULT_TEXT_SIZE,
    val bookmarks: Set<Int> = emptySet(),
    val lastReadGlobalId: Int? = null,
)
