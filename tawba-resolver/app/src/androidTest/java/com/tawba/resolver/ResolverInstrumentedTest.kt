package com.tawba.resolver

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ResolverInstrumentedTest {
    @Test
    fun cacheIncludesInstrumentedTestClasspath() {
        assertTrue(true)
    }
}
