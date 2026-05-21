import { getConversationCryptoKey } from './api';
import {
  cacheGroupKey,
  decryptMessage,
  getCachedGroupKey,
  isEncryptedPayload,
} from './chatCrypto';

export async function loadGroupKey(conversationId) {
  const cached = getCachedGroupKey(conversationId);
  if (cached) return cached;
  const { groupKey } = await getConversationCryptoKey(conversationId);
  cacheGroupKey(conversationId, groupKey);
  return groupKey;
}

export async function messageDisplayText(body, conversationId, groupKey) {
  if (!body) return '';
  if (!isEncryptedPayload(body)) return body;
  const key = groupKey || (await loadGroupKey(conversationId));
  return decryptMessage(body, key);
}
