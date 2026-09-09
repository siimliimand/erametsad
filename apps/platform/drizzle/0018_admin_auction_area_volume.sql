ALTER TABLE `auctions` ADD `area_ha` real;--> statement-breakpoint
ALTER TABLE `auctions` ADD `volume_m3` real;--> statement-breakpoint
-- Backfill: promote lot-level area/volume scalars out of the deadlines JSON.
-- Missing keys and invalid JSON yield NULL; the JSON copies stay in place for
-- legacy readers (guest preview).
UPDATE `auctions` SET `area_ha` = CAST(json_extract(`deadlines`, '$.areaHa') AS REAL), `volume_m3` = CAST(json_extract(`deadlines`, '$.volumeM3') AS REAL) WHERE `deadlines` IS NOT NULL AND json_valid(`deadlines`);