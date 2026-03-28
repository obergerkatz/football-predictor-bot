# Telegram Commands

## User Commands

| Command | Description |
|---------|-------------|
| `/start` | Register and display main menu |
| `/help` | Display help message and scoring rules |
| `/today` | View today's matches with your bets |
| `/matches` | Browse upcoming matches for betting |
| `/mybets` | View all your predictions (pending and scored) |
| `/me` | View your stats, points, and rank |
| `/leaderboard` | View top players on the leaderboard |
| `/results` | View recent match results |
| `/tournament_prediction` | Predict Top 4 teams |
| `/group_stage` | Predict group stage qualifiers |

## Button Actions

### Main Menu Buttons
- Today Matches
- Upcoming Matches
- Completed Matches
- My Bets
- My Stats
- Leaderboard
- Group Stage Prediction
- Top 4 Prediction
- Help

### Betting Flow
1. Select match from upcoming matches
2. Choose home and away scores (0-9 or custom)
3. Confirm prediction
4. Modify or cancel before match starts

### Tournament Predictions
- Select teams for 1st, 2nd, 3rd, 4th place
- Modify individual positions without redoing all
- View existing predictions with country flags

### Group Stage Predictions
- Select top 2 qualifiers from each group (A-L)
- Modify individual groups
- View predictions with checkmarks for completed groups

## Admin Commands

Available to users listed in `ADMIN_TELEGRAM_IDS` environment variable:

| Command | Description |
|---------|-------------|
| `/admin_fetch_new_fixtures` | Fetch and sync new fixtures from API (expensive API operation) |
| `/admin_refresh_matches_statuses` | Update live match statuses and scores (expensive API operation) |
| `/admin_calculate_user_points` | Calculate and update user points for finished matches |
| `/admin_send_pre_match_notifications` | Manually trigger pre-match notifications (users without bets for matches starting in 1-2 hours) |
| `/admin_send_post_match_notifications` | Manually trigger post-match notifications (notify users of points earned for recently finished matches) |

### Admin Button Actions
- 🤖 Fetch New Fixtures
- 🤖 Refresh Match Statuses
- 🤖 Calculate User Points
- 🤖 Send Pre-Match Notifications
- 🤖 Send Post-Match Notifications

**Note**: Admin commands can trigger expensive API operations. Only add trusted users to the admin list.
