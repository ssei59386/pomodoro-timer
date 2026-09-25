package com.talkpractice.app.ui.report

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.talkpractice.app.domain.model.RadarScores
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * A minimal 3-axis radar/spider chart for PRD §3③'s score visualization. No charting
 * library dependency — three axes drawn directly with [Canvas] is simple enough not to
 * warrant one, and the numeric legend (see [ReportScreen]) carries the exact values.
 */
@Composable
fun RadarChart(scores: RadarScores, modifier: Modifier = Modifier) {
    val axisValues = listOf(
        scores.drawingOutPersonalTopics,
        scores.aizuchiTiming,
        scores.conversationBalance,
    )
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val fillColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
    val strokeColor = MaterialTheme.colorScheme.primary

    Canvas(
        modifier = modifier
            .aspectRatio(1f)
            .padding(16.dp),
    ) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = minOf(size.width, size.height) / 2f * 0.85f
        val angleStep = (2f * PI / axisValues.size).toFloat()
        val startAngle = -PI.toFloat() / 2f

        fun pointAt(index: Int, fraction: Float): Offset {
            val angle = startAngle + angleStep * index
            return Offset(
                x = center.x + radius * fraction * cos(angle),
                y = center.y + radius * fraction * sin(angle),
            )
        }

        // Grid rings at 25/50/75/100%.
        for (ring in 1..4) {
            val fraction = ring / 4f
            val ringPath = Path().apply {
                axisValues.indices.forEach { i ->
                    val p = pointAt(i, fraction)
                    if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y)
                }
                close()
            }
            drawPath(ringPath, color = gridColor, style = Stroke(width = 1.dp.toPx()))
        }

        // Spokes from center to each axis's max.
        axisValues.indices.forEach { i ->
            drawLine(gridColor, center, pointAt(i, 1f), strokeWidth = 1.dp.toPx())
        }

        // The actual score polygon.
        val dataPath = Path().apply {
            axisValues.forEachIndexed { i, score ->
                val p = pointAt(i, score.coerceIn(0, 100) / 100f)
                if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y)
            }
            close()
        }
        drawPath(dataPath, color = fillColor)
        drawPath(dataPath, color = strokeColor, style = Stroke(width = 2.5.dp.toPx()))

        axisValues.forEachIndexed { i, score ->
            drawCircle(strokeColor, radius = 4.dp.toPx(), center = pointAt(i, score.coerceIn(0, 100) / 100f))
        }
    }
}
