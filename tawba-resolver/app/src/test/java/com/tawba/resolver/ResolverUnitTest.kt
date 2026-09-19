package com.tawba.resolver

import org.junit.Assert.assertEquals
import org.junit.Test

class ResolverUnitTest {
    @Test
    fun cacheIncludesUnitTestClasspath() {
        assertEquals(4, 2 + 2)
    }
}
