set client_min_messages to warning;

-- DANGER: this is NOT how to do it in the real world.
-- `drop schema` INSTANTLY ERASES EVERYTHING.

drop schema "public" cascade;

create schema "public";

create table "purchases" (
  "purchaseId"      serial,
  "category"        text    not null,
  "description"     text    not null,
  "amount"          numeric  not null,
  "date"            DATE NOT NULL DEFAULT CURRENT_DATE,
  primary key ("purchaseId")
);
