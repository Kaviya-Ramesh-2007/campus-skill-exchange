export interface SignedUploadRequest {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
}

export interface SignedUpload {
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  objectKey: string;
}

export interface ObjectStorageProvider {
  createSignedUpload(request: SignedUploadRequest): Promise<SignedUpload>;
  createSignedDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}

export interface EmailMessage {
  recipients: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailDeliveryResult {
  providerMessageId: string;
  acceptedAt: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export interface MeetingRequest {
  topic: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  participantCount: number;
}

export interface MeetingResult {
  provider: string;
  externalMeetingId: string;
  joinUrl: string;
  startsAt: string;
  endsAt: string;
}

export interface MeetingProvider {
  createMeeting(request: MeetingRequest): Promise<MeetingResult>;
  cancelMeeting(externalMeetingId: string): Promise<void>;
}

export interface PaymentProviderRequest {
  amountMinor: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  description: string;
}

export interface PaymentProviderResult {
  provider: string;
  providerPaymentId: string;
  status: string;
  redirectUrl?: string;
}

export interface PaymentProvider {
  createPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<unknown>;
}

export interface AiSuggestionRequest {
  purpose: string;
  content: string;
  constraints?: Record<string, unknown>;
}

export interface AiSuggestionResult {
  provider: string;
  model: string;
  suggestion: string;
  requestId: string;
}

export interface AiAssistantProvider {
  suggest(request: AiSuggestionRequest): Promise<AiSuggestionResult>;
}
