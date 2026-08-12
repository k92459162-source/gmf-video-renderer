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

// Escape text so it doesn't break FFmpeg
function escapeText(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/:/g, '\\:');
}

app.post('/render', async (req, res) => {
    const { imageBase64, audioUrl, topText, bottomText } = req.body;
    const tempImg = `/tmp/img_${Date.now()}.jpg`;
    const tempAudio = `/tmp/audio_${Date.now()}.mp3`;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    try {
        console.log('1. Saving image from Base64 data...');
        fs.writeFileSync(tempImg, Buffer.from(imageBase64, 'base64'));
        
        console.log('2. Downloading audio...', audioUrl);
        await downloadFile(audioUrl, tempAudio);
        
        console.log('3. Rendering video with Motion & Text...');
        ffmpeg()
            .input(tempImg)
            .inputOptions(['-loop 1', '-framerate 30'])
            .input(tempAudio)
            .videoFilters([
                'scale=720:1280:force_original_aspect_ratio=increase', // Fill screen
                'crop=720:1280', // Crop to exactly 9:16
                'setsar=1',
                'zoompan=z=\'min(zoom+0.001,1.3)\':d=500:s=720x1280:fps=30', // Slow zoom in effect
                // Add Product Name at the top
                `drawtext=text='${escapeText(topText)}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=54:x=(w-text_w)/2:y=80:box=1:boxcolor=black@0.5:boxborderw=15`,
                // Add "Shop Now" at the bottom
                `drawtext=text='${escapeText(bottomText)}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=44:x=(w-text_w)/2:y=h-150:box=1:boxcolor=black@0.5:boxborderw=15`
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
