import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from '../api-keys/schemas/api-key.schema';
import { ShortUrl, ShortUrlSchema } from '../urls/schemas/short-url.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ShortUrl.name, schema: ShortUrlSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
    ]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
