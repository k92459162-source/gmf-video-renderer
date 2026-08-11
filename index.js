const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
app.use(express.json({ limit: '15mb' }));

app.post('/render', (req, res) => {
    const { imageUrl, audioUrl, topText, bottomText } = req.body;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    ffmpeg()
        .input(imageUrl)
        .input(audioUrl)
        .videoFilters([
            'scale=720:1280:force_original_aspect_ratio=increase',
            'crop=720:1280',
            `drawtext=text='${topText}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.5`,
            `drawtext=text='${bottomText}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-100:box=1:boxcolor=black@0.5`
        ])
        .outputOptions(['-shortest', '-c:v libx264', '-c:a aac'])
        .save(outputPath)
        .on('end', () => {
            res.download(outputPath, () => {
                require('fs').unlinkSync(outputPath);
            });
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).send('Rendering failed');
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Renderer running on port ${PORT}`));
