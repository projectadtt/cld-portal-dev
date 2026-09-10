-- down/0011_media.sql
--
-- Puts image_url back, empty, and takes the storage paths away. The rollback
-- cannot restore a /public path that no row ever had, and it deliberately does
-- not delete anything from Storage: rolling a schema back is not a decision to
-- destroy files.

alter table products  drop constraint if exists products_image_path_shape;
alter table brokers   drop constraint if exists brokers_image_path_shape;
alter table retailers drop constraint if exists retailers_image_path_shape;

alter table products  drop column if exists image_path;
alter table brokers   drop column if exists image_path;
alter table retailers drop column if exists image_path;

alter table products add column if not exists image_url text;
