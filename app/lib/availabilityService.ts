import { ghlService, isGHLConfigured } from './integrations/gohighlevel';

export const availabilityService = {
  getAvailableSlots: async (): Promise<Date[]> => {
    // Check if GHL is configured
    if (isGHLConfigured() && process.env.GHL_CALENDAR_ID) {
      try {
        // Get slots for the next 7 days
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        
        // Fetch available slots from GoHighLevel
        const ghlSlots = await ghlService.getAvailableSlots(
          process.env.GHL_CALENDAR_ID,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        
        // Convert GHL slots to Date objects and return first 3
        const availableSlots = ghlSlots
          .filter(slot => slot.available)
          .map(slot => new Date(slot.startTime))
          .slice(0, 3);
        
        if (availableSlots.length > 0) {
          console.log('✅ Retrieved', availableSlots.length, 'slots from GoHighLevel');
          return availableSlots;
        }
        
        console.log('⚠️  No available slots from GHL, using fallback');
      } catch (error) {
        console.error('Error fetching GHL calendar slots:', error);
        console.log('⚠️  Falling back to dummy slots');
      }
    }
    
    // Fallback: Generate dummy slots for testing
    const slots: Date[] = [];
    const now = new Date();
    let current = new Date(now.getTime());
    current.setHours(current.getHours() + 2); // Start 2 hours from now to be safe
    current.setMinutes(0);
    current.setSeconds(0);
    current.setMilliseconds(0);

    while (slots.length < 3) {
      current.setHours(current.getHours() + 1);
      const hour = current.getHours();
      // Let's assume business hours are 9am to 5pm (17:00)
      if (hour >= 9 && hour <= 17) {
        // Only add slots on the hour
        if (current.getMinutes() === 0) {
            slots.push(new Date(current.getTime()));
        }
      }

      // If it's past 5pm, move to the next day
      if (hour > 17) {
        current.setDate(current.getDate() + 1);
        current.setHours(9);
        current.setMinutes(0);
      }
    }
    return slots;
  },
  
  // Helper to format slots for display
  formatSlotsForDisplay: (slots: Date[]): string[] => {
    return slots.map(slot => {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      return slot.toLocaleString('en-US', options);
    });
  }
};