/**
 * Server-only capture provider env helpers.
 * Optional secrets (never required for paste/upload MVP):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   WHISPER_API_KEY or OPENAI_API_KEY (speech-to-text)
 *   IMAP_LIVE_ENABLED=1 (future live IMAP fetch flag)
 * Never import this module from client/browser code.
 */

export type CaptureEnvStatus = {
  twilioConfigured: boolean
  whisperConfigured: boolean
  imapLiveConfigured: boolean
  whisperKeySource: 'whisper' | 'openai' | null
}

export function readCaptureEnv(): CaptureEnvStatus {
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim()
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  const whisperKey = (process.env.WHISPER_API_KEY ?? '').trim()
  const openaiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  const imapLive =
    (process.env.IMAP_LIVE_ENABLED ?? '').trim() === '1' ||
    (process.env.IMAP_LIVE_ENABLED ?? '').toLowerCase() === 'true'

  const whisperConfigured = Boolean(whisperKey || openaiKey)
  return {
    twilioConfigured: Boolean(twilioSid && twilioToken),
    whisperConfigured,
    imapLiveConfigured: imapLive,
    whisperKeySource: whisperKey ? 'whisper' : openaiKey ? 'openai' : null,
  }
}

export function readWhisperApiKey(): string | null {
  const whisperKey = (process.env.WHISPER_API_KEY ?? '').trim()
  if (whisperKey) return whisperKey
  const openaiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  return openaiKey || null
}
