import { BadRequestException } from '@nestjs/common';

export function parseArchivedQueryFilter(
  archived?: string,
  options?: { defaultWhenMissing?: boolean | 'all' },
): boolean | 'all' {
  const defaultWhenMissing = options?.defaultWhenMissing ?? 'all';

  if (archived === undefined) {
    return defaultWhenMissing;
  }

  if (archived === 'true') {
    return true;
  }

  if (archived === 'false') {
    return false;
  }

  if (archived === 'all') {
    return 'all';
  }

  throw new BadRequestException(
    'archived must be one of: true, false, all',
  );
}
