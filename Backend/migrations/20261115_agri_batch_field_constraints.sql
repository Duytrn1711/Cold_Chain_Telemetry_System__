BEGIN;

ALTER TABLE agri_batches
    ALTER COLUMN product_type SET NOT NULL;

ALTER TABLE agri_batches
    ADD CONSTRAINT agri_batches_product_name_length_check
        CHECK (char_length(btrim(product_name)) BETWEEN 2 AND 200),
    ADD CONSTRAINT agri_batches_product_type_length_check
        CHECK (char_length(btrim(product_type)) BETWEEN 2 AND 200),
    ADD CONSTRAINT agri_batches_origin_length_check
        CHECK (char_length(btrim(origin)) BETWEEN 2 AND 200),
    ADD CONSTRAINT agri_batches_unit_length_check
        CHECK (char_length(btrim(unit)) BETWEEN 1 AND 50);

COMMIT;
