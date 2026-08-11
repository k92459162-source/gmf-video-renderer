const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const https = require('https');
const http = require('http');
const app = express();
app.use(express.json({ limit: '15mb' }));

ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to download files to Render's local disk first
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download. Status: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(dest));
            });
        }).on('error', err => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

app.post('/render', async (req, res) => {
    const { imageUrl, audioUrl } = req.body;
    const tempImg = `/tmp/img_${Date.now()}.jpg`;
    const tempAudio = `/tmp/audio_${Date.now()}.mp3`;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    try {
        console.log('1. Downloading image...');
        await downloadFile(imageUrl, tempImg);
        
        console.log('2. Downloading audio...');
        await downloadFile(audioUrl, tempAudio);
        
        console.log('3. Rendering video...');
        ffmpeg()
            .input(tempImg)
            .input(tempAudio)
            .outputOptions(['-shortest', '-c:v libx264', '-c:a aac', '-pix_fmt yuv420p', '-r 30'])
            .save(outputPath)
            .on('end', () => {
                console.log('4. Render finished successfully!');
                res.download(outputPath, () => {
                    // Clean up files
                    fs.unlinkSync(tempImg);
                    fs.unlinkSync(tempAudio);
                    fs.unlinkSync(outputPath);
                });
            })
            .on('error', (err) => {
                console.error('FFmpeg Error:', err.message);
                res.status(500).send('FFMPEG_ERROR: ' + err.message);
            });
    } catch (err) {
        console.error('Download Error:', err.message);
        res.status(500).send('DOWNLOAD_ERROR: ' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Renderer running on port ${PORT}`));
