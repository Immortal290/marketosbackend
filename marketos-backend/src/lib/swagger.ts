import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MarketOS API',
      version: '1.0.0',
      description:
        'Enterprise-grade AI-powered marketing operations platform API. ' +
        'Use the Authorize button to supply a JWT Bearer token for protected endpoints.',
      contact: { name: 'MarketOS Engineering' },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Local Development' },
      { url: 'http://localhost:3000', description: 'Health / System endpoints' },
    ],
    tags: [
      { name: 'System',                  description: 'Health checks and system status' },
      { name: 'Auth',                    description: 'Authentication – register, login, token refresh' },
      { name: 'Dashboard',               description: 'Executive KPI grid, activity feed, agent status' },
      { name: 'Campaigns',               description: 'Campaign lifecycle management – CRUD, launch, pause' },
      { name: 'Campaign Detail',         description: 'Per-campaign deep-dive: overview, audience, assets, channels, A/B tests, analytics, finance' },
      { name: 'Analytics',               description: 'Executive dashboard, attribution, funnel, journey and cohort analytics' },
      { name: 'Audience',                description: 'Contacts, segments, lead scores, personas and lifecycle stages' },
      { name: 'Settings',                description: 'Workspace, team, integrations, compliance, billing and security settings' },
      { name: 'AI Command Center',       description: 'Natural language commands, agent monitor, task explorer, supervisor decisions, agent memory, automation rules' },
      { name: 'Creative Studio',         description: 'Asset library, brand kit, AI-generated creatives, templates, design editor' },
      { name: 'Reports',                 description: 'Scheduled, custom and executive reports + exports' },
      { name: 'Competitive Intelligence', description: 'Competitor tracking, ad monitoring, pricing changes, SEO comparison, opportunity feed' },
      { name: 'Finance & ROI',           description: 'Spend dashboard, revenue attribution, ROAS analysis, budget controls, forecasting' },
      { name: 'Monitoring & Alerts',     description: 'Health dashboard, alert center, incident history, auto-remediation' },
      { name: 'Audit Logs',              description: 'Activity, agent, API, compliance logs and live event stream' },
      { name: 'Agents',                  description: 'AI agent status, memory, tasks and direct command interface' },
      { name: 'Workflow Engine',         description: 'Agent DAG, execution flow, dependencies and automation builder' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from POST /auth/login',
        },
      },
      parameters: {
        workspaceId: {
          name: 'workspaceId',
          in: 'query',
          required: true,
          description: 'UUID of the workspace',
          schema: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        },
        resourceId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Resource UUID',
          schema: { type: 'string', format: 'uuid' },
        },
        page: {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        limit: {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        campaignId: {
          name: 'campaignId',
          in: 'path',
          required: true,
          description: 'Campaign UUID',
          schema: { type: 'string', format: 'uuid' },
        },
      },
      schemas: {
        /* ── Generic wrappers ──────────────────────────────────────── */
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { description: 'Response payload (type varies per endpoint)' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total:   { type: 'integer', example: 150 },
            page:    { type: 'integer', example: 1 },
            limit:   { type: 'integer', example: 20 },
            pages:   { type: 'integer', example: 8 },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error:   { type: 'string',  example: 'Resource not found' },
            code:    { type: 'string',  example: 'NOT_FOUND' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error:   { type: 'string',  example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field:   { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        /* ── Auth ──────────────────────────────────────────────────── */
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName', 'workspaceName'],
          properties: {
            email:         { type: 'string', format: 'email', example: 'john@acme.com' },
            password:      { type: 'string', minLength: 8,    example: 'S3cur3Pass!' },
            firstName:     { type: 'string', example: 'John' },
            lastName:      { type: 'string', example: 'Doe' },
            workspaceName: { type: 'string', example: 'Acme Corp' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'john@acme.com' },
            password: { type: 'string', example: 'S3cur3Pass!' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string', example: 'eyJhbGci...' },
            refreshToken: { type: 'string', example: 'eyJhbGci...' },
            expiresIn:    { type: 'integer', example: 3600 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            email:     { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName:  { type: 'string' },
            role:      { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        /* ── Campaigns ─────────────────────────────────────────────── */
        Campaign: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'Q4 Product Launch' },
            status:      { type: 'string', enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
            workspaceId: { type: 'string', format: 'uuid' },
            healthScore: { type: 'number', format: 'float', example: 87.5 },
            roas:        { type: 'number', format: 'float', example: 4.2 },
            budget:      { type: 'number', format: 'float', example: 50000 },
            spend:       { type: 'number', format: 'float', example: 23400 },
            createdAt:   { type: 'string', format: 'date-time' },
            updatedAt:   { type: 'string', format: 'date-time' },
          },
        },
        CreateCampaignRequest: {
          type: 'object',
          required: ['name', 'workspaceId'],
          properties: {
            name:        { type: 'string', example: 'Summer Sale Campaign' },
            workspaceId: { type: 'string', format: 'uuid' },
            budget:      { type: 'number', example: 10000 },
            channels:    { type: 'array', items: { type: 'string', enum: ['EMAIL', 'SMS', 'SOCIAL', 'PAID_ADS'] } },
            startDate:   { type: 'string', format: 'date-time' },
            endDate:     { type: 'string', format: 'date-time' },
          },
        },
        UpdateCampaignRequest: {
          type: 'object',
          properties: {
            name:   { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
            budget: { type: 'number' },
          },
        },
        CampaignStats: {
          type: 'object',
          properties: {
            total:     { type: 'integer', example: 42 },
            active:    { type: 'integer', example: 8 },
            paused:    { type: 'integer', example: 3 },
            scheduled: { type: 'integer', example: 5 },
            completed: { type: 'integer', example: 26 },
          },
        },
        /* ── Dashboard ─────────────────────────────────────────────── */
        KpiGrid: {
          type: 'object',
          properties: {
            revenueInfluenced: { type: 'number', example: 1200000 },
            revenueGenerated:  { type: 'number', example: 340000 },
            pipelineGenerated: { type: 'number', example: 5600000 },
            leadsGenerated:    { type: 'integer', example: 12400 },
            mqls:              { type: 'integer', example: 1870 },
            sqls:              { type: 'integer', example: 430 },
            conversionRate:    { type: 'number', example: 3.47 },
            activeCampaigns:   { type: 'integer', example: 8 },
            activeAgents:      { type: 'integer', example: 11 },
            roas:              { type: 'number', example: 4.2 },
          },
        },
        ActivityEvent: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            type:      { type: 'string', enum: ['AGENT_EVENT', 'CAMPAIGN_EVENT', 'COMPLIANCE_EVENT', 'SYSTEM_EVENT'] },
            message:   { type: 'string' },
            severity:  { type: 'string', enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] },
            timestamp: { type: 'string', format: 'date-time' },
            metadata:  { type: 'object' },
          },
        },
        AlertItem: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            type:      { type: 'string', enum: ['CRITICAL', 'WARNING', 'CAMPAIGN', 'INFRASTRUCTURE'] },
            title:     { type: 'string' },
            message:   { type: 'string' },
            resolved:  { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        /* ── Agents ────────────────────────────────────────────────── */
        Agent: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'CopyAgent' },
            type:        { type: 'string', enum: ['SUPERVISOR','COPY','CREATIVE','ANALYTICS','COMPLIANCE','EMAIL','SMS','SOCIAL','SEO','COMPETITOR','FINANCE'] },
            status:      { type: 'string', enum: ['IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'STOPPED'] },
            currentTask: { type: 'string', example: 'Generating email subject lines' },
            queueLength: { type: 'integer', example: 3 },
            successRate: { type: 'number', example: 98.4 },
            runtimeMs:   { type: 'integer', example: 142000 },
            tokenUsage:  { type: 'integer', example: 48300 },
            costUsd:     { type: 'number', example: 0.97 },
          },
        },
        /* ── Audience ──────────────────────────────────────────────── */
        Contact: {
          type: 'object',
          properties: {
            id:             { type: 'string', format: 'uuid' },
            email:          { type: 'string', format: 'email' },
            firstName:      { type: 'string' },
            lastName:       { type: 'string' },
            phone:          { type: 'string' },
            leadScore:      { type: 'integer', example: 72 },
            lifecycleStage: { type: 'string', enum: ['LEAD', 'MQL', 'SQL', 'OPPORTUNITY', 'CUSTOMER', 'EVANGELIST'] },
            createdAt:      { type: 'string', format: 'date-time' },
          },
        },
        Segment: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'High-Value Leads' },
            description: { type: 'string' },
            size:        { type: 'integer', example: 3420 },
            rules:       { type: 'object', description: 'Segment filter rules' },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        /* ── Competitive Intelligence ──────────────────────────────── */
        Competitor: {
          type: 'object',
          properties: {
            id:      { type: 'string', format: 'uuid' },
            name:    { type: 'string', example: 'RivalCo' },
            website: { type: 'string', format: 'uri' },
            adSpend: { type: 'number', example: 250000 },
            keywords: { type: 'array', items: { type: 'string' } },
          },
        },
        /* ── Finance ───────────────────────────────────────────────── */
        SpendSummary: {
          type: 'object',
          properties: {
            totalBudget:    { type: 'number', example: 500000 },
            totalSpend:     { type: 'number', example: 214300 },
            remainingBudget:{ type: 'number', example: 285700 },
            projectedSpend: { type: 'number', example: 490000 },
            roas:           { type: 'number', example: 4.2 },
            roi:            { type: 'number', example: 3.2 },
          },
        },
        /* ── Monitoring ────────────────────────────────────────────── */
        HealthStatus: {
          type: 'object',
          properties: {
            overall:     { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            api:         { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            database:    { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            redis:       { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            kafka:       { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            agents:      { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'CRITICAL'] },
            uptime:      { type: 'number', example: 99.97 },
            checkedAt:   { type: 'string', format: 'date-time' },
          },
        },
        /* ── Reports ───────────────────────────────────────────────── */
        Report: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'Q4 Executive Report' },
            type:        { type: 'string', enum: ['SCHEDULED', 'CUSTOM', 'EXECUTIVE'] },
            format:      { type: 'string', enum: ['PDF', 'CSV', 'EXCEL', 'JSON'] },
            status:      { type: 'string', enum: ['PENDING', 'GENERATING', 'READY', 'FAILED'] },
            downloadUrl: { type: 'string', format: 'uri' },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        /* ── Creative Studio ───────────────────────────────────────── */
        Asset: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            name:      { type: 'string' },
            type:      { type: 'string', enum: ['IMAGE', 'VIDEO', 'COPY', 'TEMPLATE', 'LANDING_PAGE'] },
            url:       { type: 'string', format: 'uri' },
            tags:      { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/app.ts', './src/modules/**/*.ts'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: 'MarketOS API Docs',
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        persistAuthorization: true,
      },
    }),
  );
};
