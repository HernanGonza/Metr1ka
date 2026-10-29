-- Rollback de 20261029000000_gps_fallos.sql (se pierde el historial de fallos).
drop table if exists public.gps_fallos;
