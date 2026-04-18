import { Router } from 'express';
import { AIService } from '../../services/scholar/ai.service';
import { authenticate, authorizeRole } from '../../middleware/scholar/auth';

const router = Router();
const aiService = new AIService();

router.post('/summary', authenticate, authorizeRole(['Admin']), aiService.handleGenerateSummary);
router.post('/participation', authenticate, authorizeRole(['Admin']), aiService.handleGenerateParticipation);
router.post('/custom-analysis', authenticate, authorizeRole(['Admin']), aiService.handleCustomAnalysis);

export default router;
