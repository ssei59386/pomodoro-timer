package com.talkpractice.app.ui.conversation

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.talkpractice.app.ui.theme.SpeakingGlow

/**
 * One character/user avatar in the conversation screen. [isSpeaking] drives the "光る"
 * requirement from PRD §3②: a pulsing glow ring plus a slight scale-up while true. This
 * is purely presentational — [isSpeaking] is fed a mock rotation in step 2 and will be
 * driven by real `LiveEvent.SpeakerChanged` events in step 3.
 */
@Composable
fun SpeakerAvatar(
    label: String,
    isSpeaking: Boolean,
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.secondaryContainer,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "speaking-glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 650, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glow-alpha",
    )
    val scale by animateFloatAsState(targetValue = if (isSpeaking) 1.1f else 1f, label = "avatar-scale")

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Box(
            modifier = Modifier
                .size(84.dp)
                .scale(scale),
            contentAlignment = Alignment.Center,
        ) {
            if (isSpeaking) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .clip(CircleShape)
                        .background(SpeakingGlow.copy(alpha = glowAlpha)),
                )
            }
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(containerColor)
                    .let { base ->
                        if (isSpeaking) base.border(3.dp, SpeakingGlow, CircleShape) else base
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(text = label.take(1), style = MaterialTheme.typography.headlineSmall)
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (isSpeaking) FontWeight.Bold else FontWeight.Normal,
        )
    }
}
