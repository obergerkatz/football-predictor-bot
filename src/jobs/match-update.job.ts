import { footballDataClient } from '../api/football-data.client';
import { matchRepository } from '../db/repositories';
import { matchService } from '../services/match.service';
import { MatchStatus } from '../types';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache.service';
import { scoringJob } from './scoring.job';

const INTERVAL_LIVE_MS = 60_000;
const INTERVAL_IDLE_MS = 5 * 60_000;

export class MatchUpdateJob {
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    logger.info('Starting match update job (self-scheduling)');
    void this.runAndReschedule();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => this.runAndReschedule(), delayMs);
  }

  private async runAndReschedule(): Promise<void> {
    let hasLive = false;
    try {
      hasLive = await this.run();
    } catch (error) {
      logger.error('Match update job failed', { error });
    } finally {
      this.scheduleNext(hasLive ? INTERVAL_LIVE_MS : INTERVAL_IDLE_MS);
    }
  }

  // Returns true if any live matches were found (drives the next interval)
  async run(): Promise<boolean> {
    logger.info('Starting match update job');

    const matches = await matchRepository.findLiveAndRecent();

    if (matches.length === 0) {
      logger.debug('No matches to update');
      return false;
    }

    const hasLive = matches.some((m) => m.status === MatchStatus.LIVE);
    logger.info(`Updating ${matches.length} matches (live: ${hasLive})`);

    let updated = 0;

    const results = await Promise.all(
      matches.map(async (match) => {
        try {
          const apiMatch = await footballDataClient.getMatchById(match.api_fixture_id);

          if (!apiMatch) {
            logger.warn(`Match not found in API`, { apiFixtureId: match.api_fixture_id });
            return 0;
          }

          const newStatus = footballDataClient.mapStatusToMatchStatus(apiMatch.status);
          const score90min = footballDataClient.get90MinuteScore(apiMatch);
          const scoreFt = footballDataClient.getFullTimeScore(apiMatch);

          const statusChanged = match.status !== newStatus;
          const scoresChanged =
            match.home_score !== score90min.home ||
            match.away_score !== score90min.away ||
            match.home_score_ft !== scoreFt.home ||
            match.away_score_ft !== scoreFt.away;

          if (statusChanged || scoresChanged) {
            await matchRepository.upsert(
              apiMatch.id,
              match.league_id,
              apiMatch.homeTeam.name,
              apiMatch.awayTeam.name,
              new Date(apiMatch.utcDate),
              newStatus,
              score90min.home,
              score90min.away,
              scoreFt.home,
              scoreFt.away
            );

            matchService.clearMatchCache(match.id);
            cacheService.delete(`fd:match:${match.api_fixture_id}`);

            if (newStatus === MatchStatus.FINISHED && match.status !== MatchStatus.FINISHED) {
              scoringJob.run().catch((err) =>
                logger.error('Failed to run scoring job after match finished', { err })
              );
            }

            logger.info('Match updated', {
              matchId: match.id,
              apiFixtureId: match.api_fixture_id,
              oldStatus: match.status,
              newStatus,
              score: score90min.home !== null ? `${score90min.home}-${score90min.away}` : 'N/A',
            });

            return 1;
          }
          return 0;
        } catch (error) {
          logger.error(`Failed to update match`, { error, matchId: match.id });
          return 0;
        }
      })
    );

    for (const r of results) {
      updated += r;
    }

    if (updated > 0) {
      matchService.clearMatchListCaches();
    }

    logger.info(`Match update job completed. Updated ${updated} matches`);
    return hasLive;
  }
}

export const matchUpdateJob = new MatchUpdateJob();
