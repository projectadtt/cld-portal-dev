# schema-census.txt

The schema the ten migrations in `migrations/` are expected to produce, in a
canonical text form: every column with its type, nullability, default and
generated expression; every primary key, foreign key, unique and check
constraint; every index; every trigger.

It was generated from a throwaway local Postgres built by those same migration
files, so it is a statement about the migrations rather than about any one
database. To check a database against it:

    npm run db:schema -- --diff=supabase/schema-census.txt

`identical` means the connected database is structurally the same as the one
the write tests were proven on. Regenerate it, deliberately, only when a new
migration is meant to change the shape:

    npm run db:schema -- --save=supabase/schema-census.txt
