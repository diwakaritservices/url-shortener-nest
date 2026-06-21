import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  '111111',
  '123123',
  'letmein',
  'welcome',
  'admin',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'shadow',
  'superman',
  'trustno1',
  'passw0rd',
  'secret',
  'secret123',
  'changeme',
  'access',
  'login',
  'guest',
  'root',
  'test',
  'testing',
  'moklay',
  'shortener',
]);

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: unknown): boolean {
    if (typeof password !== 'string') {
      return false;
    }

    if (password.length < 15 || password.length > 128) {
      return false;
    }

    return !COMMON_PASSWORDS.has(password.trim().toLowerCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at least 15 characters and must not be a commonly used password`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
