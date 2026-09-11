-- D2 (portal-parity-gap-closure): legacy logging-type codes → demo taxonomy.
-- Only the two unambiguous pairs move: H→HR (harvendusraie) and L→LR
-- (lageraie). Every other value — U, T, R, lowercase codes, objects without
-- a text `code` — stays untouched. Entries keep their shape: bare strings
-- are rewritten in place, objects are patched via json_set so extra keys
-- survive.
UPDATE `auctions`
SET `logging_types` = (
  SELECT json_group_array(
    CASE je.type
      WHEN 'text' THEN
        CASE je.value
          WHEN 'H' THEN 'HR'
          WHEN 'L' THEN 'LR'
          ELSE je.value
        END
      WHEN 'object' THEN
        CASE json_type(je.value, '$.code')
          WHEN 'text' THEN
            json_set(
              je.value,
              '$.code',
              CASE json_extract(je.value, '$.code')
                WHEN 'H' THEN 'HR'
                WHEN 'L' THEN 'LR'
                ELSE json_extract(je.value, '$.code')
              END
            )
          ELSE je.value
        END
      ELSE je.value
    END
  )
  FROM json_each(`auctions`.`logging_types`) je
)
WHERE `logging_types` IS NOT NULL
  AND json_valid(`logging_types`)
  AND json_type(`logging_types`) = 'array';
