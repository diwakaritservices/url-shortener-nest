import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { RedirectController } from './redirect.controller';
import { ShortUrl, ShortUrlSchema } from './schemas/short-url.schema';
import { UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    RedisModule,
    MongooseModule.forFeature([
      { name: ShortUrl.name, schema: ShortUrlSchema },
    ]),
  ],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService],
  exports: [UrlsService],
})
export class UrlsModule {}
