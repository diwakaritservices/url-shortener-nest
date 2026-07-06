import type { DomainEventName } from './domain-event.constants';
import type { DomainEventPayload } from './domain-event.types';

export interface DomainEventHandler {
  readonly consumerGroup: string;
  supports(event: DomainEventName): boolean;
  handle(
    event: DomainEventName,
    payload: DomainEventPayload[DomainEventName],
  ): Promise<void>;
}
