// Database Models

export interface User {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string;
  created_at: Date;
}

export interface League {
  id: number;
  api_league_id: number;
  code: string | null;
  name: string;
  country: string;
  season: number;
  is_active: boolean;
  logo_url?: string | null;
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
}

export interface Match {
  id: number;
  api_fixture_id: number;
  league_id: number;
  home_team: string;
  away_team: string;
  match_date: Date;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_score_ft: number | null;
  away_score_ft: number | null;
  updated_at: Date;
}

export interface Bet {
  id: number;
  user_id: number;
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  created_at: Date;
}

export enum ScoreType {
  EXACT = 'exact',
  GOAL_DIFF = 'goal_diff',
  PARTIAL = 'partial',
  NONE = 'none',
}

export interface Score {
  id: number;
  bet_id: number;
  points_awarded: number;
  score_type: ScoreType;
  calculated_at: Date;
}

// DTOs and Service Types

export interface ScorePrediction {
  home: number;
  away: number;
}

export interface ScoringResult {
  points: number;
  type: ScoreType;
  details?: string;
}

export interface BetWithMatch extends Bet {
  match: Match;
  score?: Score;
}

export interface LeaderboardEntry {
  user_id: number;
  telegram_id: string;
  username: string | null;
  first_name: string;
  total_points: number;
  total_bets: number;
  rank: number;
  exact_scores: number;
  goal_diffs: number;
  three_pt_scores: number;
  one_pt_scores: number;
  zero_scores: number;
  scored_bets: number;
  bonus_points: number;
}

export interface MatchWithLeague extends Match {
  league: League;
}

export interface UserStats {
  user: User;
  total_points: number;
  total_bets: number;
  scored_bets: number;
  pending_bets: number;
  rank: number;
  total_users: number;
  exact_scores: number;
  goal_diffs: number;
  three_pt_scores: number;
  one_pt_scores: number;
  zero_scores: number;
  bonus_points: number;
}

export interface TournamentPrediction {
  id: number;
  user_id: number;
  league_id: number;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
  bonus_points: number;
  is_scored: boolean;
  created_at: Date;
}

export interface GroupStagePrediction {
  id: number;
  user_id: number;
  league_id: number;
  predictions: Record<string, string[]>; // { "A": ["Team1", "Team2"], "B": [...], ... }
  bonus_points: number;
  is_scored: boolean;
  created_at: Date;
  updated_at: Date;
}

export enum NotificationType {
  PRE_MATCH_NO_BET = 'pre_match_no_bet',
  POST_MATCH_POINTS = 'post_match_points',
}

export interface Notification {
  id: number;
  user_id: number;
  match_id: number | null;
  notification_type: NotificationType;
  message: string;
  sent_at: Date;
}

// API-Football Response Types

export interface APIFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    season: number;
    round?: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface APIFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

// Football-data.org Standings Types
export interface StandingsTableEntry {
  position: number;
  team: {
    id: number;
    name: string;
    crest?: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface StandingsGroup {
  stage: string;
  type: string;
  group?: string;
  table: StandingsTableEntry[];
}

export interface StandingsResponse {
  filters: Record<string, unknown>;
  area: {
    id: number;
    name: string;
    code: string;
    flag: string;
  };
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner: unknown;
  };
  standings: StandingsGroup[];
}
