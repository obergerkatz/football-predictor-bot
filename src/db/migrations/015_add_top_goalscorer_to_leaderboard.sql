-- Migration 015: Add top goalscorer bonus points to leaderboard view

DROP VIEW IF EXISTS leaderboard_view;

CREATE VIEW leaderboard_view AS
SELECT
    u.id AS user_id,
    u.telegram_id,
    u.username,
    u.first_name,
    COALESCE(SUM(s.points_awarded), 0) + COALESCE(SUM(tp.bonus_points), 0) + COALESCE(SUM(gsp.bonus_points), 0) + COALESCE(SUM(tgs.bonus_points), 0) AS total_points,
    COUNT(b.id) AS total_bets,
    COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) AS scored_bets,
    COUNT(CASE WHEN s.score_type = 'exact' THEN 1 END) AS exact_scores,
    COUNT(CASE WHEN s.score_type = 'goal_diff' THEN 1 END) AS goal_diffs,
    COUNT(CASE WHEN s.score_type = 'partial' AND s.points_awarded = 3 THEN 1 END) AS three_pt_scores,
    COUNT(CASE WHEN s.score_type = 'correct_result' THEN 1 END) AS two_pt_scores,
    COUNT(CASE WHEN s.score_type = 'partial' AND s.points_awarded = 1 THEN 1 END) AS one_pt_scores,
    COUNT(CASE WHEN s.score_type = 'none' THEN 1 END) AS zero_scores,
    COALESCE(SUM(tp.bonus_points), 0) + COALESCE(SUM(gsp.bonus_points), 0) + COALESCE(SUM(tgs.bonus_points), 0) AS bonus_points
FROM users u
LEFT JOIN bets b ON u.id = b.user_id
LEFT JOIN scores s ON b.id = s.bet_id
LEFT JOIN tournament_predictions tp ON u.id = tp.user_id
LEFT JOIN group_stage_predictions gsp ON u.id = gsp.user_id
LEFT JOIN top_goalscorer_predictions tgs ON u.id = tgs.user_id
LEFT JOIN leagues l_tp ON tp.league_id = l_tp.id
LEFT JOIN leagues l_gsp ON gsp.league_id = l_gsp.id
LEFT JOIN leagues l_tgs ON tgs.league_id = l_tgs.id
WHERE (l_tp.is_active = true OR tp.league_id IS NULL)
  AND (l_gsp.is_active = true OR gsp.league_id IS NULL)
  AND (l_tgs.is_active = true OR tgs.league_id IS NULL)
GROUP BY u.id, u.telegram_id, u.username, u.first_name;
