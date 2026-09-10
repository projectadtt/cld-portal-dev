import { NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import {
  formatLongDate,
  getOwnerName,
  type RetailerNote,
} from "@/lib/selectors";

/**
 * Narrative notes, set as prose. This is the part of the account that a
 * spreadsheet cannot hold, and the part most useful to read aloud in a
 * client meeting.
 */
export function MeetingNotes({ notes }: { notes: RetailerNote[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState icon={NotebookPen} message="No meeting notes recorded yet." />
    );
  }

  return (
    <ul className="space-y-5">
      {notes.map((note) => (
        <li
          key={note.id}
          className="border-t border-rule-soft pt-4 first:border-t-0 first:pt-0"
        >
          <p className="type-label">
            {formatLongDate(note.date) + " · " + getOwnerName(note.authorId)}
          </p>
          <p className="mt-1.5 text-sm text-ink">{note.title}</p>
          {note.body ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
              {note.body}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">
              Nothing was written up from this meeting.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
