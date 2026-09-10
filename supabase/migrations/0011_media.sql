-- 0011_media.sql
--
-- Where a picture lives.
--
-- Files go to Supabase Storage. Postgres keeps one thing: the object's path
-- inside the bucket. Not the bytes, and deliberately not a URL either.
--
-- A URL is a rendering of a path plus a host plus, for a private bucket, a
-- signature with an expiry. Storing one means the database ages: move the
-- project, change the bucket's visibility, or let a signature lapse, and every
-- stored row is quietly wrong. The path is the only part that is actually a
-- fact about the file, so it is the only part that is stored. Every URL in the
-- portal is built from it at the moment it is needed.
--
-- The shape of the path is checked here rather than only in the write layer.
-- The application is not the only thing that can reach this table, and a path
-- is the one field on these rows that later gets concatenated into a request
-- to another service -- which is exactly the kind of value worth constraining
-- where it is stored. The pattern admits one shape and nothing else:
--
--     products/<owner-id>/<32 hex characters>.<jpg|jpeg|png|webp>
--
-- No leading slash, no "..", no second extension, no directory of its own
-- choosing. Traversal is not filtered out of the string; it simply cannot be
-- expressed in it.
--
-- Each table is pinned to its own prefix, so a product row cannot come to hold
-- a broker's photograph even if some future code passes the wrong argument.

alter table products  add column image_path text;
alter table brokers   add column image_path text;
alter table retailers add column image_path text;

alter table products add constraint products_image_path_shape
  check (image_path is null or image_path ~
    '^products/[a-z0-9][a-z0-9-]{0,79}/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$');

alter table brokers add constraint brokers_image_path_shape
  check (image_path is null or image_path ~
    '^brokers/[a-z0-9][a-z0-9-]{0,79}/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$');

alter table retailers add constraint retailers_image_path_shape
  check (image_path is null or image_path ~
    '^retailers/[a-z0-9][a-z0-9-]{0,79}/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$');

-- products.image_url is removed.
--
-- It held a path under /public -- a file committed to the repository beside
-- the code. That was right for a prototype whose data was static, and it is
-- wrong now: a picture of a product is business data, entered by whoever
-- enters the product, and the whole point of this application is that business
-- data lives in the database rather than in the source tree.
--
-- Nothing is lost. The column is null on every row in this database, which the
-- migration asserts rather than assumes -- if any row ever did carry a value,
-- this fails loudly instead of dropping it.

do $$
declare
  populated integer;
begin
  select count(*) into populated from products where image_url is not null;
  if populated > 0 then
    raise exception
      'products.image_url still holds % row(s). Move them into Storage before dropping the column.',
      populated;
  end if;
end $$;

alter table products drop column image_url;
