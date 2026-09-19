package com.tawba.feature.prayer

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.tawba.core.designsystem.TawbaTheme
import org.junit.Rule
import org.junit.Test

class PrayerFeatureInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun prayerSetupIsDisplayedWithoutRequestingPermissionAtLaunch() {
        composeRule.setContent {
            TawbaTheme {
                PrayerScreen(
                    state = PrayerUiState(isLoading = false),
                    onLocate = {},
                    onCitySelected = {},
                    onMethodSelected = {},
                    onMadhabSelected = {},
                    onAdjustmentChanged = { _, _ -> },
                    onClearLocation = {},
                    onRetry = {},
                )
            }
        }
        composeRule.onNodeWithTag("prayer-screen").assertIsDisplayed()
    }
}
