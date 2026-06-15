export interface CreateCampaignDto {
  name: string;
  workspaceId: string;
}

export interface UpdateCampaignDto {
  name?: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}
