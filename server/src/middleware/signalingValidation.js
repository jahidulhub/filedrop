
const MAX_SDP_LENGTH = 60_000;
const MAX_CANDIDATE_LENGTH = 8_000;

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function isValidDescription(value, type) {
  return (
    isPlainObject(value) &&
    value.type === type &&
    typeof value.sdp === 'string' &&
    value.sdp.length > 0 &&
    value.sdp.length <= MAX_SDP_LENGTH
  );
}

function isValidCandidate(value) {
  // A null candidate can signal the end of ICE gathering.
  if (value === null) {
    return true;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.candidate !== 'string' ||
    value.candidate.length > MAX_CANDIDATE_LENGTH
  ) {
    return false;
  }

  if (
    value.sdpMid !== undefined &&
    value.sdpMid !== null &&
    typeof value.sdpMid !== 'string'
  ) {
    return false;
  }

  if (
    value.sdpMLineIndex !== undefined &&
    value.sdpMLineIndex !== null &&
    (
      !Number.isInteger(value.sdpMLineIndex) ||
      value.sdpMLineIndex < 0
    )
  ) {
    return false;
  }

  return true;
}

export function isValidSignalingMessage(message) {
  if (!isPlainObject(message)) {
    return false;
  }

  switch (message.type) {
    case 'offer':
      return isValidDescription(
        message.offer,
        'offer'
      );

    case 'answer':
      return isValidDescription(
        message.answer,
        'answer'
      );

    case 'ice-candidate':
      return isValidCandidate(
        message.candidate
      );

    default:
      return false;
  }
}
