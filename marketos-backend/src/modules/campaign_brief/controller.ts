import { Request, Response, NextFunction } from 'express';
import { CampaignBriefService } from './service';
import { StatusCodes } from 'http-status-codes';

export class CampaignBriefController {
  private service = new CampaignBriefService();

  /**
   * POST /campaign/brief
   * Creates the brief and forwards the request to the agent service.
   * Streams the agent response back to the client using SSE.
   */
  public createAndLaunch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { brief, campaign, agentPayload } =
        await this.service.createAndLaunch(req.body);

      const agentServiceUrl =
        process.env.AGENT_SERVICE_URL || 'http://localhost:8000';
      
      // Forward to the new structured endpoint on the agent service
      const agentRes = await fetch(`${agentServiceUrl}/v1/pipeline/campaign/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentPayload),
      });

      if (!agentRes.ok) {
        throw new Error(`Agent service returned ${agentRes.status}`);
      }

      if (!agentRes.body) {
        throw new Error('Agent service returned no body');
      }

      // Stream the SSE response back to the client
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = agentRes.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }

      res.end();
    } catch (error) {
      next(error);
    }
  };
}
