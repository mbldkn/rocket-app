// Message Types
export enum MessageType {
  ROCKET_LAUNCHED = 'RocketLaunched',
  ROCKET_SPEED_INCREASED = 'RocketSpeedIncreased',
  ROCKET_SPEED_DECREASED = 'RocketSpeedDecreased',
  ROCKET_EXPLODED = 'RocketExploded',
  ROCKET_MISSION_CHANGED = 'RocketMissionChanged',
}

export enum RocketStatus {
  ACTIVE = 'ACTIVE',
  EXPLODED = 'EXPLODED',
}

// Message Metadata
export interface MessageMetadata {
  channel: string;
  messageNumber: number;
  messageTime: string;
  messageType: MessageType;
}

// Message Payloads
export interface RocketLaunchedPayload {
  type: string;
  launchSpeed: number;
  mission: string;
}

export interface RocketSpeedIncreasedPayload {
  by: number;
}

export interface RocketSpeedDecreasedPayload {
  by: number;
}

export interface RocketExplodedPayload {
  reason: string;
}

export interface RocketMissionChangedPayload {
  newMission: string;
}

export type MessagePayload =
  | RocketLaunchedPayload
  | RocketSpeedIncreasedPayload
  | RocketSpeedDecreasedPayload
  | RocketExplodedPayload
  | RocketMissionChangedPayload;

// Complete Message Structure
export interface IncomingMessage {
  metadata: MessageMetadata;
  message: MessagePayload;
}

// Rocket State
export interface RocketState {
  id: string;
  channel: string;
  type: string;
  currentSpeed: number;
  mission: string;
  status: RocketStatus;
  explosionReason: string | null;
  lastMessageNumber: number;
  lastMessageTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

// Query Parameters
export interface RocketListQuery {
  sortBy?: 'speed' | 'mission' | 'status' | 'type' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  status?: RocketStatus;
}
