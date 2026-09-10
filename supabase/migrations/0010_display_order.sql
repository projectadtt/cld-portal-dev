-- 0010_display_order.sql
--
-- Row order is information, and the migration was losing it.
--
-- The static modules are curated lists, not alphabetical ones: the retailer
-- array runs roughly from the furthest-along account to the untouched one,
-- which is how several screens read when nothing else sorts them. A table has
-- no inherent order, so without a column the portal's rows came back in
-- whatever order the heap happened to hold -- and the comparison against the
-- static baseline showed exactly that, as dozens of "differences" that were
-- really one row appearing where another used to.
--
-- The workbook has row order too, and CLD curates it. Storing it is faithful
-- to both sources; deriving it is not possible, because the order is a
-- judgement rather than a function of any column.
--
-- Meetings and activities are deliberately excluded: those are ordered by when
-- they happened, which the data already carries.

alter table brokers           add column display_order integer;
alter table retailers         add column display_order integer;
alter table products          add column display_order integer;
alter table workstream_items  add column display_order integer;
alter table actions           add column display_order integer;
alter table opportunities     add column display_order integer;

-- The attendee array is ordered too: CLD's side is written first, and the
-- retailer detail screen renders it as "In the room - X, Y". Without this the
-- two names swapped places on every meeting.
alter table meeting_attendees  add column display_order integer;

create index retailers_order_idx        on retailers (client_id, display_order);
create index products_order_idx         on products (client_id, display_order);
create index workstream_items_order_idx on workstream_items (display_order);
create index meeting_attendees_order_idx on meeting_attendees (meeting_id, display_order);
