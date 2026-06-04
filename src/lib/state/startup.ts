import type { PremiumSweepService } from '../services/PremiumSweepService';

export const startup: { started: boolean; startTime: number; sweepService?: PremiumSweepService } = { started: false, startTime: 0 };
