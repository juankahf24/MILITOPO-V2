package com.tawba.app.util

object QuranSearchNormalizer {
    private val diacritics = Regex("[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]")
    private val tatweel = Regex("\\u0640")
    private val whitespace = Regex("\\s+")

    fun normalize(input: String): String = input
        .trim()
        .replace(tatweel, "")
        .replace(diacritics, "")
        .replace('ٱ', 'ا')
        .replace('أ', 'ا')
        .replace('إ', 'ا')
        .replace('آ', 'ا')
        .replace('ى', 'ي')
        .replace('ؤ', 'و')
        .replace('ئ', 'ي')
        .replace("ء", "")
        .replace(whitespace, " ")
}
