import { Router } from 'express';
import { AgentsController } from './controller';

const router = Router();
const controller = new AgentsController();

/**
 * @openapi
 * /agents:
 *   get:
 *     summary: List all AI agents
 *     description: Returns live status and metadata for all 18 AI agents in the MarketOS fleet.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agents list
 */
router.get('/', controller.getAllAgents);

/**
 * @openapi
 * /agents/{agentType}:
 *   get:
 *     summary: Get agent status by type
 *     description: Returns detailed status, configuration, and performance metrics for a specific agent type.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent detail
 *       404:
 *         description: Agent type not found
 */
router.get('/:agentType', controller.getAgentByType);

/**
 * @openapi
 * /agents/{agentType}/tasks:
 *   get:
 *     summary: Get tasks for a specific agent
 *     description: Returns all tasks (running, queued, failed, completed) assigned to the specified agent.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *     responses:
 *       200:
 *         description: Agent tasks
 */
router.get('/:agentType/tasks', controller.getAgentTasks);

/**
 * @openapi
 * /agents/{agentType}/memory:
 *   get:
 *     summary: Get agent memory
 *     description: Returns the working, episodic, and semantic memory for the specified agent.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *     responses:
 *       200:
 *         description: Agent memory entries
 */
router.get('/:agentType/memory', controller.getAgentMemory);

/**
 * @openapi
 * /agents/{agentType}/command:
 *   post:
 *     summary: Send a direct command to an agent
 *     description: Sends a direct operational command to a specific agent via Kafka.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *                 enum: [PAUSE, RESUME, CLEAR_QUEUE, RESTART, EXECUTE_TASK]
 *               taskPayload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Command accepted
 *       400:
 *         description: Invalid command
 */
router.post('/:agentType/command', controller.executeCommand);

export default router;
