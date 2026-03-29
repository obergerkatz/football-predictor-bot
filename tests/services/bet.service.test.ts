import { BetService } from '../../src/services/bet.service';
import { betRepository } from '../../src/db/repositories';
import { matchService } from '../../src/services/match.service';
import { MatchStatus } from '../../src/types';
import { SCORING_POINTS } from '../../src/constants';

// Mock the repositories and services
jest.mock('../../src/db/repositories', () => ({
  betRepository: {
    findByUserAndMatch: jest.fn(),
    create: jest.fn(),
    findByUser: jest.fn(),
    findByMatch: jest.fn(),
    getBetScore: jest.fn(),
    update: jest.fn(),
    findByUserAndMatchWithScore: jest.fn(),
  },
}));

jest.mock('../../src/services/match.service', () => ({
  matchService: {
    canPlaceBet: jest.fn(),
  },
}));

describe('BetService', () => {
  let betService: BetService;

  beforeEach(() => {
    betService = new BetService();
    jest.clearAllMocks();
  });

  describe('placeBet', () => {
    it('should create a new bet when no existing bet', async () => {
      const userId = 1;
      const matchId = 100;
      const homeScore = 2;
      const awayScore = 1;

      const mockBet = {
        id: 1,
        user_id: userId,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
        created_at: new Date(),
      };

      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({ allowed: true });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(null);
      (betRepository.create as jest.Mock).mockResolvedValue(mockBet);

      const result = await betService.placeBet(userId, matchId, { home: homeScore, away: awayScore });

      expect(result.success).toBe(true);
      expect(result.bet).toEqual(mockBet);
      expect(betRepository.create).toHaveBeenCalledWith(userId, matchId, homeScore, awayScore);
    });

    it('should reject bet for finished match', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'Match has already finished',
      });

      const result = await betService.placeBet(1, 100, { home: 2, away: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match has already finished');
      expect(betRepository.create).not.toHaveBeenCalled();
    });

    it('should reject bet for live match', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'Match has already started',
      });

      const result = await betService.placeBet(1, 100, { home: 2, away: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match has already started');
      expect(betRepository.create).not.toHaveBeenCalled();
    });

    it('should reject bet for past scheduled match', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'Match has already started',
      });

      const result = await betService.placeBet(1, 100, { home: 2, away: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match has already started');
    });

    it('should reject duplicate bet', async () => {
      const existingBet = {
        id: 1,
        user_id: 1,
        match_id: 100,
        predicted_home_score: 1,
        predicted_away_score: 0,
        created_at: new Date(),
      };

      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({ allowed: true });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(existingBet);

      const result = await betService.placeBet(1, 100, { home: 2, away: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already placed');
      expect(betRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserBets', () => {
    it('should return all user bets', async () => {
      const userId = 1;
      const mockBets = [
        {
          id: 1,
          user_id: userId,
          match_id: 100,
          predicted_home_score: 2,
          predicted_away_score: 1,
          created_at: new Date(),
          match: {
            id: 100,
            home_team: 'Team A',
            away_team: 'Team B',
            match_date: new Date(),
            status: MatchStatus.SCHEDULED,
          },
        },
      ];

      (betRepository.findByUser as jest.Mock).mockResolvedValue(mockBets);

      const result = await betService.getUserBets(userId);

      expect(result).toEqual(mockBets);
      expect(betRepository.findByUser).toHaveBeenCalledWith(userId);
    });

    it('should return empty array for user with no bets', async () => {
      (betRepository.findByUser as jest.Mock).mockResolvedValue([]);

      const result = await betService.getUserBets(999);

      expect(result).toEqual([]);
    });
  });

  describe('getBetScore', () => {
    it('should return score for scored bet', async () => {
      const betId = 1;
      const mockScore = { points_awarded: SCORING_POINTS.EXACT_MATCH };

      (betRepository.getBetScore as jest.Mock).mockResolvedValue(mockScore);

      const result = await betService.getBetScore(betId);

      expect(result).toEqual(mockScore);
      expect(betRepository.getBetScore).toHaveBeenCalledWith(betId);
    });

    it('should return null for unscored bet', async () => {
      (betRepository.getBetScore as jest.Mock).mockResolvedValue(null);

      const result = await betService.getBetScore(999);

      expect(result).toBeNull();
    });
  });

  describe('updateBet', () => {
    it('should update existing bet before match starts', async () => {
      const userId = 1;
      const matchId = 100;
      const newHomeScore = 3;
      const newAwayScore = 2;

      const existingBet = {
        id: 1,
        user_id: userId,
        match_id: matchId,
        predicted_home_score: 2,
        predicted_away_score: 1,
        created_at: new Date(),
      };

      const updatedBet = {
        ...existingBet,
        predicted_home_score: newHomeScore,
        predicted_away_score: newAwayScore,
      };

      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({ allowed: true });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(existingBet);
      (betRepository.update as jest.Mock).mockResolvedValue(updatedBet);

      const result = await betService.updateBet(userId, matchId, { home: newHomeScore, away: newAwayScore });

      expect(result.success).toBe(true);
      expect(result.bet).toEqual(updatedBet);
      expect(betRepository.update).toHaveBeenCalledWith(existingBet.id, newHomeScore, newAwayScore);
    });

    it('should reject modification if no existing bet', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({ allowed: true });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(null);

      const result = await betService.updateBet(1, 100, { home: 3, away: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No existing bet');
      expect(betRepository.update).not.toHaveBeenCalled();
    });

    it('should reject modification for finished match', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'Match has already finished',
      });

      const result = await betService.updateBet(1, 100, { home: 3, away: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match has already finished');
    });

    it('should reject modification for live match', async () => {
      (matchService.canPlaceBet as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'Match has already started',
      });

      const result = await betService.updateBet(1, 100, { home: 3, away: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match has already started');
    });
  });
});
