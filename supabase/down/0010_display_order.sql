-- down/0010_display_order.sql
drop index if exists retailers_order_idx;
drop index if exists products_order_idx;
drop index if exists workstream_items_order_idx;
alter table brokers          drop column if exists display_order;
alter table retailers        drop column if exists display_order;
alter table products         drop column if exists display_order;
alter table workstream_items drop column if exists display_order;
alter table actions          drop column if exists display_order;
alter table opportunities    drop column if exists display_order;
drop index if exists meeting_attendees_order_idx;
alter table meeting_attendees drop column if exists display_order;
