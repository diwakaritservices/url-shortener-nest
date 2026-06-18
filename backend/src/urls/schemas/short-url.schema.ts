import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShortUrlDocument = HydratedDocument<ShortUrl>;

@Schema({ timestamps: true })
export class ShortUrl {
  @Prop({ required: true, trim: true, maxlength: 2048 })
  fullUrl: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
  })
  shortId: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'User',
    index: true,
  })
  ownerId: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt?: Date | null;
}

export const ShortUrlSchema = SchemaFactory.createForClass(ShortUrl);

ShortUrlSchema.index({ ownerId: 1, createdAt: -1 });
ShortUrlSchema.index({ ownerId: 1, archivedAt: 1 });
ShortUrlSchema.index({ ownerId: 1, fullUrl: 1 }, { unique: true });
