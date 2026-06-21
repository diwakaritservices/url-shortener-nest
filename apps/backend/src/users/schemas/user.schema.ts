import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, trim: true, maxlength: 80, default: null })
  name: string | null;

  @Prop({ type: Boolean, default: true })
  emailVerified: boolean;

  @Prop({ type: Boolean, default: false })
  mfaEnabled: boolean;

  @Prop({ type: String, default: null, select: false })
  totpSecret: string | null;

  @Prop({ type: String, default: null, select: false })
  mfaPendingSecret: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
