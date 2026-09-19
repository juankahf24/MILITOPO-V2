package com.tawba.resolver

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import com.batoulapps.adhan.CalculationMethod
import com.batoulapps.adhan.Coordinates
import com.batoulapps.adhan.PrayerTimes
import com.batoulapps.adhan.data.DateComponents
import java.time.LocalDate

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val today = LocalDate.now()
        val prayerTimes = PrayerTimes(
            Coordinates(38.7223, -9.1393),
            DateComponents(today.year, today.monthValue, today.dayOfMonth),
            CalculationMethod.MUSLIM_WORLD_LEAGUE.parameters,
        )
        setContent { Text("Tawba ${prayerTimes.fajr.time}") }
    }
}
