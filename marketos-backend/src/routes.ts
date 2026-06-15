import { Router } from 'express';

import authRoutes from './modules/auth/routes';
import settingsRoutes from './modules/settings/routes';
import dashboardRoutes from './modules/dashboard/routes';
import campaignsRoutes from './modules/campaigns/routes';
import campaignDetailRoutes from './modules/campaign_detail/routes';
import analyticsRoutes from './modules/analytics/routes';
import audienceRoutes from './modules/audience/routes';
import aiCommandCenterRoutes from './modules/ai_command_center/routes';
import agentsRoutes from './modules/agents/routes';
import workflowEngineRoutes from './modules/workflow_engine/routes';
import creativeStudioRoutes from './modules/creative_studio/routes';
import competitiveIntelligenceRoutes from './modules/competitive_intelligence/routes';
import financeRoutes from './modules/finance/routes';
import reportsRoutes from './modules/reports/routes';
import monitoringRoutes from './modules/monitoring/routes';
import auditLogsRoutes from './modules/audit_logs/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/campaign-detail', campaignDetailRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audience', audienceRoutes);
router.use('/ai-command-center', aiCommandCenterRoutes);
router.use('/agents', agentsRoutes);
router.use('/workflow-engine', workflowEngineRoutes);
router.use('/creative-studio', creativeStudioRoutes);
router.use('/competitive-intelligence', competitiveIntelligenceRoutes);
router.use('/finance', financeRoutes);
router.use('/reports', reportsRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/audit-logs', auditLogsRoutes);

export default router;
