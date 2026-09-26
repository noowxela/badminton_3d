/** BWF doubles court dimensions (meters). 1 unit = 1 m. */

export const COURT_LENGTH = 13.4;
export const COURT_WIDTH = 6.1;
export const HALF_LENGTH = COURT_LENGTH / 2;
export const HALF_WIDTH = COURT_WIDTH / 2;

export const NET_POST_HEIGHT = 1.55;
export const NET_CENTER_HEIGHT = 1.524;
export const NET_THICKNESS = 0.02;

export const SHORT_SERVICE = 1.98;
export const LONG_SERVICE_INSET = 0.76;
export const SINGLES_INSET = 0.46;

/** Team A plays on -Z half (human); Team B on +Z half (AI). Y-up. */
export const TEAM = {
  A: 'A',
  B: 'B',
};

export const SCORE_TO_WIN = 21;
export const SCORE_CAP = 30;
export const WIN_BY = 2;

/** Shared hall shell (exterior + interior doorway alignment). */
export const HALL_FLOOR_PAD = 3.2;
export const HALL_WALL_H = 8.5;
export const HALL_WALL_T = 0.2;
export const HALL_DOOR_W = 2.4;
export const HALL_DOOR_H = 2.9;

