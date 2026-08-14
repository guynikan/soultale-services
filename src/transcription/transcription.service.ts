import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperUrl = process.env.WHISPER_SERVER_URL ?? 'http://127.0.0.1:8081/inference';

  async transcribe(audio: Buffer): Promise<string> {
    const id = randomUUID();
    const rawPath = path.join(os.tmpdir(), `${id}.input`);
    const wavPath = path.join(os.tmpdir(), `${id}.wav`);

    try {
      await fs.writeFile(rawPath, audio);

      try {
        // Normalize whatever container/codec the client recorded (Android and iOS
        // produce different formats) to the 16kHz mono PCM WAV whisper.cpp expects.
        await execFileAsync('ffmpeg', ['-y', '-i', rawPath, '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath], {
          timeout: 30_000,
        });
      } catch (error) {
        this.logger.warn(`ffmpeg normalization failed: ${String(error)}`);
        throw new UnprocessableEntityException('Não foi possível processar o áudio enviado.');
      }

      const wavBuffer = await fs.readFile(wavPath);
      const form = new FormData();
      form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
      form.append('response_format', 'json');
      form.append('language', 'pt');

      let res: Response;
      try {
        res = await fetch(this.whisperUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
      } catch (error) {
        this.logger.error(`whisper-server unreachable: ${String(error)}`);
        throw new ServiceUnavailableException('Serviço de transcrição indisponível no momento.');
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`whisper-server returned ${res.status}: ${body.slice(0, 300)}`);
        throw new InternalServerErrorException('Falha ao transcrever o áudio.');
      }

      const data = (await res.json()) as { text?: string };
      return (data.text ?? '').trim();
    } finally {
      await Promise.allSettled([fs.unlink(rawPath), fs.unlink(wavPath)]);
    }
  }
}
