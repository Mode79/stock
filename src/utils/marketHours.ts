/**
 * Helper to check EGX (Egyptian Exchange) market operating status.
 * Trading days: Sunday - Thursday
 * Trading session: 09:30 AM - 02:35 PM Cairo Time (Africa/Cairo)
 * Weekend (OFF): Friday & Saturday
 */
export function isEGXMarketOpen(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    let weekday = '';
    let hour = 0;
    let minute = 0;
    
    for (const p of parts) {
      if (p.type === 'weekday') weekday = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    }
    
    // Friday and Saturday are EGX weekend (Market is OFF)
    if (weekday === 'Fri' || weekday === 'Sat') {
      return false;
    }
    
    // Market session window: 09:30 AM to 02:35 PM (14:35) Cairo Time
    const currentMinute = hour * 60 + minute;
    const marketStart = 9 * 60 + 30; // 09:30 AM
    const marketEnd = 14 * 60 + 35;  // 02:35 PM
    
    return currentMinute >= marketStart && currentMinute <= marketEnd;
  } catch (e) {
    console.warn('Failed to parse Cairo market timezone:', e);
    return true; // Fallback to allowing fetch if timezone formatting fails
  }
}

export function getEGXMarketStatusText(): { isOpen: boolean; label: string; details: string } {
  const isOpen = isEGXMarketOpen();
  if (isOpen) {
    return {
      isOpen: true,
      label: 'EGX LIVE',
      details: 'Market is open (Sun-Thu 10:00-14:30 Cairo Time)'
    };
  }
  return {
    isOpen: false,
    label: 'EGX OFF',
    details: 'Market is closed (Sun-Thu 10:00-14:30 Cairo Time). Periodic queries paused.'
  };
}
