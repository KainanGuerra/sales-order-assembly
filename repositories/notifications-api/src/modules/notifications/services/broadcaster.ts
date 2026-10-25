import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

// Tells the people who have a stream open that something changed for them. It
// carries no content on purpose: the screen asks again for the list, so a
// message that was missed (a dropped connection) is made up for the same way.
// It lives in the process: with more than one replica it would need a broker.
@Injectable()
export class NotificationsBroadcaster {
  private readonly changes = new Subject<string>();

  notifyChanged(recipientIds: string[]): void {
    for (const id of recipientIds) {
      this.changes.next(id);
    }
  }

  // The moments something changed for this person.
  changesFor(recipientId: string): Observable<void> {
    return this.changes.pipe(
      filter((id) => id === recipientId),
      map(() => undefined),
    );
  }
}
