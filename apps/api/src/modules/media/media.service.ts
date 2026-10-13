import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { FinalizeUploadDto, UploadIntentDto } from "./media.dto.js";

const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

@Injectable()
export class MediaService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = config.get<string>("S3_BUCKET", "quizmaster");
    this.publicUrl = config.get<string>("S3_PUBLIC_URL", "");
    const endpoint = config.get<string>("S3_ENDPOINT");
    const accessKeyId = config.get<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("S3_SECRET_ACCESS_KEY");
    this.client = accessKeyId && secretAccessKey && this.publicUrl ? new S3Client({
      region: config.get<string>("S3_REGION", "auto"),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: config.get("NODE_ENV") !== "production",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }) : null;
  }

  async intent(dto: UploadIntentDto) {
    const client = this.requireStorage();
    this.validate(dto.mimeType, dto.sizeBytes);
    const extension = dto.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const objectKey = `questions/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: dto.mimeType,
        ContentLength: dto.sizeBytes,
      }),
      { expiresIn: 300 },
    );
    return { objectKey, uploadUrl, expiresInSeconds: 300 };
  }

  async finalize(dto: FinalizeUploadDto) {
    const client = this.requireStorage();
    this.validate(dto.mimeType, dto.sizeBytes);
    if (!dto.objectKey.startsWith("questions/")) throw new BadRequestException("Invalid object key");
    const head = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: dto.objectKey }));
    if (head.ContentLength !== dto.sizeBytes || head.ContentType !== dto.mimeType) {
      throw new BadRequestException("Uploaded object does not match the upload request");
    }
    return this.prisma.mediaAsset.create({
      data: {
        objectKey: dto.objectKey,
        publicUrl: `${this.publicUrl.replace(/\/$/, "")}/${dto.objectKey}`,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        ...(head.ChecksumSHA256 ? { checksum: head.ChecksumSHA256 } : {}),
      },
    });
  }

  private validate(mimeType: string, sizeBytes: number) {
    if (!MIME_TYPES.has(mimeType)) throw new BadRequestException("Unsupported image type");
    if (sizeBytes > 5_242_880) throw new BadRequestException("Image exceeds 5 MB");
  }

  private requireStorage(): S3Client {
    if (!this.client) throw new ServiceUnavailableException("Image uploads are not configured");
    return this.client;
  }
}
