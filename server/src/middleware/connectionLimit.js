

export function createConnectionLimiter({
  maxPerIp = 5,
  maxTotal = 100
} = {}) {
  const connections = new Map();

  let totalConnections = 0;

  function reserve(ip) {
    if (
      typeof ip !== 'string' ||
      ip.length === 0
    ) {
      return false;
    }

    if (totalConnections >= maxTotal) {
      return false;
    }

    const current = connections.get(ip) || 0;

    if (current >= maxPerIp) {
      return false;
    }

    connections.set(ip, current + 1);
    totalConnections++;

    return true;
  }

  function release(ip) {
    const current = connections.get(ip) || 0;

    if (current === 0) {
      return;
    }

    if (current === 1) {
      connections.delete(ip);
    } else {
      connections.set(ip, current - 1);
    }

    totalConnections--;
  }

  function getCount(ip) {
    return connections.get(ip) || 0;
  }

  function getTotal() {
    return totalConnections;
  }

  return {
    reserve,
    release,
    getCount,
    getTotal
  };
}
