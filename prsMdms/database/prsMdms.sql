CREATE TABLE IF NOT EXISTS prs (
  id SERIAL PRIMARY KEY,
  serial_no INT,
  coach_code TEXT,
  composite_flag BOOLEAN,
  class TEXT,
  berth_number INT,
  berth_type TEXT
);


CREATE TABLE IF NOT EXISTS mdms (
  id SERIAL PRIMARY KEY,
  serial_no INT,
  layout_variant_no TEXT,
  composite_flag BOOLEAN,
  coach_class_first TEXT,
  coach_class_second TEXT,
  prs_coach_code TEXT,
  coach_class TEXT,
  berth_no INT,
  berth_qualifier TEXT
);
