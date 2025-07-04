CREATE TABLE prs (
  trnno INTEGER,
  islno INTEGER,
  stn_code TEXT,
  arrv_time TEXT,
  dept_time TEXT, 
  route INTEGER,
  cummulative_distance NUMERIC,
  stn_status_flag INTEGER,
  day_count_new INTEGER,
  train_ttchng_date TIMESTAMP
);


CREATE TABLE satsang (
  train_number INTEGER,
  seq_number INTEGER,
  stn_code TEXT,
  arvl_sec INTEGER,
  dprt_sec INTEGER,
  dayofrun INTEGER,
  cummulative_distance NUMERIC
);
