import { Controller, Post, Req, UnprocessableEntityException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { TranscriptionService } from './transcription.service';

@Controller('transcription')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  async transcribe(@Req() req: FastifyRequest): Promise<{ text: string }> {
    const file = await req.file();
    if (!file) throw new UnprocessableEntityException('Nenhum arquivo de áudio enviado.');

    const buffer = await file.toBuffer();
    if (buffer.length === 0) throw new UnprocessableEntityException('Arquivo de áudio vazio.');

    const text = await this.transcriptionService.transcribe(buffer);
    return { text };
  }
}
