package com.talkpractice.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.talkpractice.app.ui.navigation.TalkPracticeNavHost
import com.talkpractice.app.ui.theme.TalkPracticeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TalkPracticeTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    TalkPracticeNavHost()
                }
            }
        }
    }
}
