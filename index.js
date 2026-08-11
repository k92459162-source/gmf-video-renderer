const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static'); // This ensures FFmpeg works on Render
const app = express();
app.use(express.json({ limit: '15mb' }));

ffmpeg.setFfmpegPath(ffmpegPath);

// Escape text so FFmpeg doesn't break on spaces or special characters
function escapeText(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/:/g, '\\:');
}

app.post('/render', (req, res) => {
    const { imageUrl, audioUrl, topText, bottomText } = req.body;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    console.log(`Starting render for image: ${imageUrl}`);

    ffmpeg()
        .input(imageUrl)
        .input(audioUrl)
        .videoFilters([
            'scale=720:1280:force_original_aspect_ratio=increase',
            'crop=720:1280',
            // Using a built-in font path so it never fails
            `drawtext=text='${escapeText(topText)}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.5`,
            `drawtext=text='${escapeText(bottomText)}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-100:box=1:boxcolor=black@0.5`
        ])
        .outputOptions(['-shortest', '-c:v libx264', '-c:a aac', '-pix_fmt yuv420p'])
        .save(outputPath)
        .on('end', () => {
            console.log('Render finished successfully!');
            res.download(outputPath, () => {
                require('fs').unlinkSync(outputPath);
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg Error:', err.message);
            res.status(500).json({ error: err.message });
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Renderer running on port ${PORT}`));
