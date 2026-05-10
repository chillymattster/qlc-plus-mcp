import ffmpeg from 'fluent-ffmpeg';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
// @ts-ignore
import wavDecoder from 'wav-decoder';
// @ts-ignore
import MusicTempo from 'music-tempo';

export interface AnalysisResult {
    bpm: number;
    beats: number[];
    duration: number;
}

export class AudioAnalyzer {
    /**
     * Analyze an audio file to extract BPM and beats
     * @param inputPath Path or URL to the audio file
     */
    async analyze(inputPath: string): Promise<AnalysisResult> {
        const tempWavPath = join(tmpdir(), `${randomUUID()}.wav`);

        try {
            // Convert to WAV (required by wav-decoder)
            await this.convertToWav(inputPath, tempWavPath);

            // Read the WAV file
            const buffer = await readFile(tempWavPath);
            const audioData = await wavDecoder.decode(buffer);

            // Mix down to mono if stereo
            let channelData = audioData.channelData[0];
            if (audioData.channelData.length > 1) {
                const left = audioData.channelData[0];
                const right = audioData.channelData[1];
                channelData = new Float32Array(left.length);
                for (let i = 0; i < left.length; i++) {
                    channelData[i] = (left[i] + right[i]) / 2;
                }
            }

            // Detect tempo and beats
            const mt = new MusicTempo(channelData);

            return {
                bpm: parseFloat(mt.tempo),
                beats: mt.beats,
                duration: audioData.length / audioData.sampleRate
            };

        } finally {
            // Cleanup temp file
            try {
                await unlink(tempWavPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

    private convertToWav(input: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(input)
                .toFormat('wav')
                .audioFrequency(44100)
                .audioChannels(2) // Convert to stereo to be safe, we mix down later
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(output);
        });
    }
}
