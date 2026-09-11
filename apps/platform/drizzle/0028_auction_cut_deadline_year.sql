ALTER TABLE `auctions` ADD `cut_deadline_year` integer;--> statement-breakpoint
-- Backfill: derive the cutting-deadline year from the free-form deadlines
-- JSON with the same tolerant key set the lot dossier reads
-- (loggingDeadline, logging, raie). The first value that is a non-empty
-- string and parses as a date wins; missing, blank, unparseable, and
-- non-text values yield NULL, mirroring the repository recompute in
-- cut-deadline-year.ts.
UPDATE `auctions` SET `cut_deadline_year` = CAST(
  CASE
    WHEN typeof(json_extract(`deadlines`, '$.loggingDeadline')) = 'text'
      AND trim(json_extract(`deadlines`, '$.loggingDeadline')) <> ''
      AND strftime('%Y', json_extract(`deadlines`, '$.loggingDeadline')) IS NOT NULL
      THEN strftime('%Y', json_extract(`deadlines`, '$.loggingDeadline'))
    WHEN typeof(json_extract(`deadlines`, '$.logging')) = 'text'
      AND trim(json_extract(`deadlines`, '$.logging')) <> ''
      AND strftime('%Y', json_extract(`deadlines`, '$.logging')) IS NOT NULL
      THEN strftime('%Y', json_extract(`deadlines`, '$.logging'))
    WHEN typeof(json_extract(`deadlines`, '$.raie')) = 'text'
      AND trim(json_extract(`deadlines`, '$.raie')) <> ''
      AND strftime('%Y', json_extract(`deadlines`, '$.raie')) IS NOT NULL
      THEN strftime('%Y', json_extract(`deadlines`, '$.raie'))
    ELSE NULL
  END AS INTEGER)
WHERE `deadlines` IS NOT NULL AND json_valid(`deadlines`);--> statement-breakpoint
CREATE INDEX `auctions_cut_deadline_year_idx` ON `auctions` (`cut_deadline_year`);
