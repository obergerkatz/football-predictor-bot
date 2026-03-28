# Database Schema

## Tables

### users
User registration and profile information.

- `id`: Primary key
- `telegram_id`: Unique Telegram user ID
- `username`: Telegram username (nullable)
- `first_name`: User's first name
- `created_at`: Registration timestamp

### leagues
Competition and season information.

- `id`: Primary key
- `api_league_id`: football-data.org competition ID
- `name`: League/competition name
- `country`: Country or region
- `season`: Season year
- `is_active`: Whether league is active for betting
- `logo_url`: League logo URL (nullable)

### matches
Match fixtures and results.

- `id`: Primary key
- `api_fixture_id`: External API match ID
- `league_id`: Foreign key to leagues
- `home_team`: Home team name
- `away_team`: Away team name
- `match_date`: Match date and time
- `status`: Match status (scheduled/live/finished/cancelled/postponed)
- `home_score`: Current home score (90 minutes)
- `away_score`: Current away score (90 minutes)
- `home_score_ft`: Full-time home score (with extra time)
- `away_score_ft`: Full-time away score (with extra time)
- `updated_at`: Last update timestamp

### bets
User match predictions.

- `id`: Primary key
- `user_id`: Foreign key to users
- `match_id`: Foreign key to matches
- `predicted_home_score`: User's home team prediction
- `predicted_away_score`: User's away team prediction
- `created_at`: Bet creation timestamp
- Unique constraint: (user_id, match_id) - one bet per user per match

### scores
Calculated points for user bets.

- `id`: Primary key
- `bet_id`: Foreign key to bets (unique)
- `points_awarded`: Total points earned
- `score_type`: Type of score (exact/goal_diff/partial/none)
- `calculated_at`: Scoring timestamp

### tournament_predictions
Top 4 team predictions.

- `id`: Primary key
- `user_id`: Foreign key to users (unique)
- `first_place`: Predicted 1st place team
- `second_place`: Predicted 2nd place team
- `third_place`: Predicted 3rd place team
- `fourth_place`: Predicted 4th place team
- `bonus_points`: Points awarded (default: 0)
- `is_scored`: Whether prediction has been scored
- `created_at`: Prediction timestamp

### group_stage_predictions
Group stage qualifier predictions.

- `id`: Primary key
- `user_id`: Foreign key to users (unique)
- `predictions`: JSONB field storing group predictions (format: `{"A": ["Team1", "Team2"], ...}`)
- `bonus_points`: Points awarded (default: 0)
- `is_scored`: Whether prediction has been scored
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### notifications
Notification tracking to prevent duplicate messages.

- `id`: Primary key
- `user_id`: Foreign key to users
- `match_id`: Foreign key to matches (nullable)
- `notification_type`: Type of notification (pre_match_no_bet/post_match_points)
- `message`: Full notification message text
- `sent_at`: Timestamp when notification was sent

## Views

### leaderboard_view
Materialized view for optimized leaderboard queries.

**Columns:**
- `user_id`: User identifier
- `telegram_id`: Telegram user ID
- `username`: Telegram username
- `first_name`: User's first name
- `total_points`: Total points (match predictions + bonus points)
- `total_bets`: Total number of bets placed
- `scored_bets`: Number of bets that have been scored
- `exact_scores`: Count of 6-point predictions
- `goal_diffs`: Count of 4-point predictions
- `three_pt_scores`: Count of 3-point predictions
- `one_pt_scores`: Count of 1-point predictions
- `zero_scores`: Count of 0-point predictions
- `bonus_points`: Total bonus points from tournament predictions

The view is automatically refreshed when scores are calculated.

## Indexes

Performance indexes for common queries:

- `users.telegram_id` (unique)
- `matches.status`
- `matches.match_date`
- `bets.user_id`
- `bets.match_id`
- `scores.bet_id` (unique)
- `notifications.user_id`
- `notifications.match_id`
- `notifications.notification_type`
- `notifications(user_id, match_id, notification_type)` (composite index for duplicate detection)

## Key Features

- **90-minute scoring**: Matches store both 90-minute (`home_score`, `away_score`) and full-time scores (`home_score_ft`, `away_score_ft`). Scoring uses 90-minute results only.
- **Unique bets**: One prediction per user per match enforced by unique constraint.
- **JSONB flexibility**: Group stage predictions stored as JSON for flexible group structures (supports any number of groups).
- **Optimized queries**: Leaderboard view pre-aggregates all statistics for fast queries.
- **Referential integrity**: Foreign key constraints ensure data consistency.
- **Notification tracking**: Prevents duplicate notifications by tracking sent messages per user/match/type combination.

## Migration Files

Schema changes are managed through SQL migration files in `src/db/migrations/`:

1. `001_initial_schema.sql` - Core tables (users, leagues, matches, bets, scores)
2. `002_tournament_predictions.sql` - Tournament predictions table
3. `007_create_group_stage_predictions.sql` - Group stage predictions table
4. `008_expand_group_stage_to_12_groups.sql` - Support for 12 groups
5. `009_add_league_code.sql` - Add league code field
6. `010_add_league_to_predictions.sql` - Add league foreign keys to predictions
7. `011_create_notifications.sql` - Notifications tracking table

Migrations are run automatically on application startup.
