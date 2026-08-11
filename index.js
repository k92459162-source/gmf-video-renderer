const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const app = express();
app.use(express.json({ limit: '15mb' }));

ffmpeg.setFfmpegPath(ffmpegPath);

app.post('/render', (req, res) => {
    const { imageUrl, audioUrl, topText, bottomText } = req.body;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    console.log(`Rendering video...`);

    ffmpeg()
        .input(imageUrl)
        .input(audioUrl)
        .videoFilters([
            'scale=720:1280:force_original_aspect_ratio=increase',
            'crop=720:1280'
            // We temporarily removed the text overlays to test if the font was crashing it
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
            res.status(500).send('FFMPEG_ERROR: ' + err.message); // This will tell us the real error!
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Renderer running on port ${PORT}`));
