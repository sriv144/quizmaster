import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { Roles } from "../../common/roles.decorator.js";
import { Role } from "../../generated/prisma/enums.js";
import { FinalizeUploadDto, UploadIntentDto } from "./media.dto.js";
import { MediaService } from "./media.service.js";

@Controller("media")
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-intents")
  intent(@Body() dto: UploadIntentDto) {
    return this.media.intent(dto);
  }

  @Post("finalize")
  finalize(@Body() dto: FinalizeUploadDto) {
    return this.media.finalize(dto);
  }
}
