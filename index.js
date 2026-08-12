const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const https = require('https');
const http = require('http');
const app = express();
app.use(express.json({ limit: '20mb' }));

ffmpeg.setFfmpegPath(ffmpegPath);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        };
        const file = fs.createWriteStream(dest);
        protocol.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download audio. Status: ${response.statusCode}`));
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
    const { imageBase64, audioUrl } = req.body;
    const tempImg = `/tmp/img_${Date.now()}.jpg`;
    const tempAudio = `/tmp/audio_${Date.now()}.mp3`;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    try {
        console.log('1. Saving image from Base64 data...');
        fs.writeFileSync(tempImg, Buffer.from(imageBase64, 'base64'));
        
        console.log('2. Downloading audio...', audioUrl);
        await downloadFile(audioUrl, tempAudio);
        
        console.log('3. Rendering video...');
        ffmpeg()
            .input(tempImg)
            .inputOptions(['-loop 1', '-framerate 30'])
            .input(tempAudio)
            .videoFilters([
                'scale=720:1280:force_original_aspect_ratio=increase', // Scale to fit
                'crop=720:1280' // Crop to exact even dimensions
            ])
            .outputOptions(['-shortest', '-c:v libx264', '-c:a aac', '-pix_fmt yuv420p', '-r 30'])
            .save(outputPath)
            .on('end', () => {
                console.log('4. Render finished successfully!');
                res.download(outputPath, () => {
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
        console.error('Error:', err.message);
        res.status(500).send('ERROR: ' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Renderer running on port ${PORT}`));
